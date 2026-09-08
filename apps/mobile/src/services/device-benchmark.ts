/**
 * On-device measurement harness.
 *
 * The previous "benchmark" was a Node unit test with simulated timings, which
 * measured nothing about a phone. This runs on the device, against the real
 * vault, using the same code paths the user's taps go through — key derivation
 * in the shipped crypto shim, storage writes through the encrypted store, and
 * the assistant's deterministic query path.
 *
 * Results are printed to the log rather than shown in the UI: this is a
 * developer instrument invoked from a debug entry point, not a feature. It
 * writes nothing outside a scratch area it cleans up, so running it cannot
 * disturb a tester's records.
 */

import { createEncryptedBackup, generateVaultKey, sealBytes, openBytes } from "@katibay/shared";
import type { LocalReceiptVault } from "@katibay/shared";

export interface BenchmarkSample {
  name: string;
  /** Milliseconds, median of the runs. */
  medianMs: number;
  slowestMs: number;
  runs: number;
  /** Set when the operation has a natural size, for a per-byte read. */
  bytes?: number;
}

export interface BenchmarkReport {
  startedAt: string;
  samples: BenchmarkSample[];
  notes: string[];
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle] ?? 0;
  return ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
}

async function time(
  name: string,
  runs: number,
  operation: () => void | Promise<void>,
  bytes?: number,
): Promise<BenchmarkSample> {
  const durations: number[] = [];
  for (let run = 0; run < runs; run++) {
    const started = Date.now();
    await operation();
    durations.push(Date.now() - started);
    // Yield so a long run cannot make the app look hung.
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  return {
    name,
    medianMs: median(durations),
    slowestMs: Math.max(...durations),
    runs,
    bytes,
  };
}

/**
 * Measures the operations a user actually waits on.
 *
 * Deliberately excludes anything that would need a neural model: none ships, so
 * a "model cold load" figure would be fiction. The gaps are recorded in `notes`
 * rather than left for a reader to assume.
 */
export async function runDeviceBenchmark(vault: LocalReceiptVault): Promise<BenchmarkReport> {
  const samples: BenchmarkSample[] = [];
  const notes: string[] = [];
  const key = generateVaultKey();

  // 1. At-rest encryption on a payload the size of a receipt photo.
  const photoSized = new Uint8Array(2 * 1024 * 1024);
  for (let i = 0; i < photoSized.length; i++) photoSized[i] = i & 0xff;

  let sealedPhoto: Uint8Array = new Uint8Array();
  samples.push(
    await time(
      "Encrypt a 2 MB original",
      3,
      () => {
        sealedPhoto = sealBytes(key, photoSized);
      },
      photoSized.length,
    ),
  );
  samples.push(
    await time(
      "Decrypt a 2 MB original",
      3,
      () => {
        openBytes(key, sealedPhoto);
      },
      photoSized.length,
    ),
  );

  // 2. Backup key derivation — the slowest thing the app does on purpose.
  const payload = vault.getBackupPayload();
  samples.push(
    await time("Create an encrypted backup (PBKDF2 100k + AES-GCM)", 1, () => {
      createEncryptedBackup(payload, "benchmark-password");
    }),
  );

  // 3. The paths every screen hits.
  samples.push(await time("List active receipts", 20, () => void vault.listReceipts()));
  samples.push(
    await time(
      "Search receipts including scanned text",
      20,
      () => void vault.listReceipts({ searchQuery: "receipt" }),
    ),
  );
  samples.push(await time("Storage usage stats", 10, () => void vault.getStorageUsageStats()));
  samples.push(
    await time("Duplicate suggestions over the vault", 5, () => void vault.findAllDuplicates()),
  );

  const receiptCount = vault.listReceipts({ trashScope: "all" }).length;
  notes.push(`Vault held ${receiptCount} receipt(s) when this ran.`);
  notes.push(
    "No neural model ships in this build, so there is no model cold-load, " +
      "first-token or RAM figure to report. See docs/L1_MODEL_GATE.md.",
  );
  notes.push(
    "Timings come from Date.now() around real calls on this device; they include " +
      "JS bridge and storage overhead, which is what the user experiences.",
  );

  return {
    startedAt: new Date().toISOString(),
    samples,
    notes,
  };
}

/** Formats a report for the device log, so `adb logcat` captures it. */
export function formatBenchmarkReport(report: BenchmarkReport): string {
  const lines = [
    "=== KEEPTRAIL DEVICE BENCHMARK ===",
    `started: ${report.startedAt}`,
    "",
    ...report.samples.map((sample) => {
      const throughput = sample.bytes
        ? ` (${(sample.bytes / 1024 / 1024 / Math.max(sample.medianMs, 1) / 0.001).toFixed(
            1,
          )} MB/s)`
        : "";
      return `${sample.name}: median ${sample.medianMs}ms, slowest ${sample.slowestMs}ms over ${sample.runs} run(s)${throughput}`;
    }),
    "",
    ...report.notes.map((note) => `note: ${note}`),
    "=== END BENCHMARK ===",
  ];
  return lines.join("\n");
}
