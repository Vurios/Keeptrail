/**
 * Pilot acceptance checks (blueprint §"Pilot acceptance" and §4).
 *
 * These cover the properties the blueprint names as release conditions rather
 * than the units already covered elsewhere: durability across a restart, a
 * receipt counted once no matter how many collections it sits in, unknown
 * amounts never becoming zero, currencies never blended, and a restore that
 * leaves existing records untouched when it fails.
 */

import { describe, expect, it } from "vitest";
import {
  InMemoryVaultStore,
  LocalReceiptVault,
  buildAttachmentPath,
  calculateReceiptTotals,
  computeSha256,
  createEncryptedBackup,
  restoreEncryptedBackup,
  type ReceiptRecord,
  type VaultStore,
} from "../index";

function receipt(overrides: Partial<ReceiptRecord> & { id: string }): ReceiptRecord {
  return {
    title: overrides.id,
    merchant: "Test Merchant",
    transaction_date: "2026-09-04",
    currency: "PHP",
    total_minor_units: 10000,
    subtotal_minor_units: null,
    tax_minor_units: null,
    document_type: "receipt",
    review_status: "reviewed",
    notes: null,
    purpose: null,
    tags: [],
    custom_fields: {},
    collection_ids: [],
    is_trashed: false,
    created_at: "2026-09-04T00:00:00.000Z",
    updated_at: "2026-09-04T00:00:00.000Z",
    deleted_at: null,
    ...overrides,
  };
}

describe("durability across a restart", () => {
  it("reloads every record from the store a fresh vault opens", () => {
    const store: VaultStore = new InMemoryVaultStore();

    const first = new LocalReceiptVault(store);
    first.saveReceipt(receipt({ id: "rec_1", merchant: "Highland Coffee" }));
    const bytes = new TextEncoder().encode("HIGHLAND COFFEE TOTAL 302.40");
    const path = buildAttachmentPath("rec_1", ".txt", new Date("2026-09-04T00:00:00Z"));
    first.saveAttachment(
      {
        id: "att_1",
        receipt_id: "rec_1",
        file_name: "rec_1.txt",
        relative_path: path,
        mime_type: "text/plain",
        file_size_bytes: bytes.length,
        sha256_hash: computeSha256(bytes),
        page_order: 1,
        ocr_text: "HIGHLAND COFFEE TOTAL 302.40",
        created_at: "2026-09-04T00:00:00.000Z",
      },
      bytes,
    );

    // A second vault over the same store stands in for the next app launch.
    const relaunched = new LocalReceiptVault(store);

    expect(relaunched.listReceipts().map((r) => r.id)).toEqual(["rec_1"]);
    expect(relaunched.getReceipt("rec_1")?.merchant).toBe("Highland Coffee");
    expect(relaunched.getAttachmentsForReceipt("rec_1")).toHaveLength(1);
    expect(relaunched.getFileBytes(path)).toEqual(bytes);
  });

  it("refuses to open a corrupt index rather than replacing it with an empty one", () => {
    const store = new InMemoryVaultStore();
    store.writeIndex(new TextEncoder().encode("{ this is not json"));

    // Opening must fail. Starting empty would look like "no receipts yet" and
    // the very next save would overwrite whatever is still on disk, turning a
    // recoverable problem into permanent loss.
    expect(() => new LocalReceiptVault(store)).toThrow(/could not be parsed/i);

    // The stored bytes are left exactly as they were, so a repair or a restore
    // is still possible.
    expect(new TextDecoder().decode(store.readIndex()!)).toBe("{ this is not json");
  });

  it("keeps the previous index when a write fails midway", () => {
    let failNextWrite = false;
    const inner = new InMemoryVaultStore();
    const flaky: VaultStore = {
      readIndex: () => inner.readIndex(),
      writeIndex: (serialized) => {
        if (failNextWrite) throw new Error("storage full");
        inner.writeIndex(serialized);
      },
      readAttachment: (p) => inner.readAttachment(p),
      writeAttachment: (p, b) => inner.writeAttachment(p, b),
      deleteAttachment: (p) => inner.deleteAttachment(p),
      attachmentSize: (p) => inner.attachmentSize(p),
      listAttachmentPaths: () => inner.listAttachmentPaths(),
    };

    const vault = new LocalReceiptVault(flaky);
    vault.saveReceipt(receipt({ id: "rec_keep" }));

    failNextWrite = true;
    expect(() => vault.saveReceipt(receipt({ id: "rec_lost" }))).toThrow(/storage full/);

    failNextWrite = false;
    const relaunched = new LocalReceiptVault(flaky);
    expect(relaunched.listReceipts().map((r) => r.id)).toEqual(["rec_keep"]);
  });
});

describe("a receipt is counted once, however it is filed", () => {
  it("does not multiply a receipt across its collections", () => {
    const vault = new LocalReceiptVault(new InMemoryVaultStore());
    vault.saveReceipt(
      receipt({
        id: "rec_multi",
        total_minor_units: 50000,
        collection_ids: ["col_purchases", "col_work", "col_utilities"],
      }),
    );

    const all = vault.listReceipts();
    expect(all).toHaveLength(1);

    const totals = calculateReceiptTotals(all);
    expect(totals.currencies.PHP?.total_minor_units).toBe(50000);
    expect(totals.currencies.PHP?.record_count).toBe(1);

    // It is visible from each collection, but it is still one purchase.
    for (const collectionId of ["col_purchases", "col_work", "col_utilities"]) {
      expect(vault.listReceipts({ collectionId })).toHaveLength(1);
    }
  });

  it("counts a duplicate id once even if the same record is passed twice", () => {
    const one = receipt({ id: "rec_dupe", total_minor_units: 25000 });
    const totals = calculateReceiptTotals([one, { ...one }]);
    expect(totals.currencies.PHP?.record_count).toBe(1);
    expect(totals.currencies.PHP?.total_minor_units).toBe(25000);
  });
});

describe("money handling", () => {
  it("never turns an unknown amount into zero", () => {
    const totals = calculateReceiptTotals([
      receipt({ id: "rec_known", total_minor_units: 30000 }),
      receipt({ id: "rec_unknown", total_minor_units: null }),
    ]);

    expect(totals.currencies.PHP?.total_minor_units).toBe(30000);
    expect(totals.currencies.PHP?.record_count).toBe(1);
    // The unknown one is reported, not silently dropped and not added as 0.
    expect(totals.total_records_unknown_amount).toBe(1);
  });

  it("never adds two currencies together", () => {
    const totals = calculateReceiptTotals([
      receipt({ id: "rec_php", currency: "PHP", total_minor_units: 100000 }),
      receipt({ id: "rec_usd", currency: "USD", total_minor_units: 5000 }),
    ]);

    expect(Object.keys(totals.currencies).sort()).toEqual(["PHP", "USD"]);
    expect(totals.currencies.PHP?.total_minor_units).toBe(100000);
    expect(totals.currencies.USD?.total_minor_units).toBe(5000);
  });

  it("stays exact where floating point would not", () => {
    // 0.1 + 0.2 in floats is 0.30000000000000004; in minor units it is 30.
    const totals = calculateReceiptTotals([
      receipt({ id: "a", total_minor_units: 10 }),
      receipt({ id: "b", total_minor_units: 20 }),
    ]);
    expect(totals.currencies.PHP?.total_minor_units).toBe(30);
  });

  it("excludes trashed receipts from totals and says how many", () => {
    const totals = calculateReceiptTotals([
      receipt({ id: "live", total_minor_units: 10000 }),
      receipt({ id: "gone", total_minor_units: 99900, is_trashed: true }),
    ]);
    expect(totals.currencies.PHP?.total_minor_units).toBe(10000);
    expect(totals.total_records_excluded).toBe(1);
  });
});

describe("backup and restore on a clean install", () => {
  function seed(store: VaultStore): LocalReceiptVault {
    const vault = new LocalReceiptVault(store);
    vault.saveReceipt(
      receipt({ id: "rec_a", merchant: "Alpha", collection_ids: ["col_work", "col_purchases"] }),
    );
    vault.saveReceipt(receipt({ id: "rec_b", merchant: "Beta", total_minor_units: null }));
    const bytes = new TextEncoder().encode("ALPHA ORIGINAL DOCUMENT");
    const path = buildAttachmentPath("rec_a", ".txt", new Date("2026-09-04T00:00:00Z"));
    vault.saveAttachment(
      {
        id: "att_a",
        receipt_id: "rec_a",
        file_name: "rec_a.txt",
        relative_path: path,
        mime_type: "text/plain",
        file_size_bytes: bytes.length,
        sha256_hash: computeSha256(bytes),
        page_order: 1,
        ocr_text: "ALPHA ORIGINAL DOCUMENT",
        created_at: "2026-09-04T00:00:00.000Z",
      },
      bytes,
    );
    return vault;
  }

  it("restores records and originals into an empty vault", () => {
    const source = seed(new InMemoryVaultStore());
    const archive = createEncryptedBackup(source.getBackupPayload(), "correct horse battery");

    // A clean install: a brand new store with nothing in it.
    const freshStore = new InMemoryVaultStore();
    const fresh = new LocalReceiptVault(freshStore);
    expect(fresh.listReceipts()).toHaveLength(0);

    fresh.restoreFromPayload(restoreEncryptedBackup(archive, "correct horse battery"));

    expect(
      fresh
        .listReceipts()
        .map((r) => r.id)
        .sort(),
    ).toEqual(["rec_a", "rec_b"]);
    // Multi-collection membership survives the round trip.
    expect(fresh.getReceipt("rec_a")?.collection_ids.sort()).toEqual(["col_purchases", "col_work"]);
    // An unknown amount is still unknown, not zero.
    expect(fresh.getReceipt("rec_b")?.total_minor_units).toBeNull();
    // The original document came back byte for byte.
    const path = buildAttachmentPath("rec_a", ".txt", new Date("2026-09-04T00:00:00Z"));
    expect(new TextDecoder().decode(fresh.getFileBytes(path)!)).toBe("ALPHA ORIGINAL DOCUMENT");
    expect(fresh.reconcileAttachments().missingFiles).toHaveLength(0);
  });

  it("leaves existing records untouched when the password is wrong", () => {
    const source = seed(new InMemoryVaultStore());
    const archive = createEncryptedBackup(source.getBackupPayload(), "right password");

    const targetStore = new InMemoryVaultStore();
    const target = new LocalReceiptVault(targetStore);
    target.saveReceipt(receipt({ id: "rec_existing", merchant: "Do not lose me" }));

    expect(() => restoreEncryptedBackup(archive, "wrong password")).toThrow(/password|corrupt/i);

    // Nothing was written, so the vault is exactly as it was.
    expect(target.listReceipts().map((r) => r.id)).toEqual(["rec_existing"]);
    expect(new LocalReceiptVault(targetStore).listReceipts().map((r) => r.id)).toEqual([
      "rec_existing",
    ]);
  });

  it("leaves existing records untouched when the archive is tampered with", () => {
    const source = seed(new InMemoryVaultStore());
    const archive = createEncryptedBackup(source.getBackupPayload(), "a good password");
    // Flip a byte inside the ciphertext.
    const target_index = archive.length - 5;
    archive[target_index] = (archive[target_index] ?? 0) ^ 0xff;

    const targetStore = new InMemoryVaultStore();
    const target = new LocalReceiptVault(targetStore);
    target.saveReceipt(receipt({ id: "rec_existing" }));

    expect(() => restoreEncryptedBackup(archive, "a good password")).toThrow();
    expect(target.listReceipts().map((r) => r.id)).toEqual(["rec_existing"]);
  });

  it("refuses an archive that is not a Keeptrail backup", () => {
    expect(() => restoreEncryptedBackup(new Uint8Array(200), "any")).toThrow(/not a valid/i);
  });
});

describe("trash lifecycle", () => {
  it("separates active, trashed and all receipts unambiguously", () => {
    const vault = new LocalReceiptVault(new InMemoryVaultStore());
    vault.saveReceipt(receipt({ id: "live" }));
    vault.saveReceipt(receipt({ id: "binned" }));
    vault.moveToTrash("binned");

    expect(vault.listReceipts({ trashScope: "active" }).map((r) => r.id)).toEqual(["live"]);
    expect(vault.listReceipts({ trashScope: "trashed" }).map((r) => r.id)).toEqual(["binned"]);
    expect(
      vault
        .listReceipts({ trashScope: "all" })
        .map((r) => r.id)
        .sort(),
    ).toEqual(["binned", "live"]);
  });

  it("erases the original file when a receipt is permanently deleted", () => {
    const store = new InMemoryVaultStore();
    const vault = new LocalReceiptVault(store);
    vault.saveReceipt(receipt({ id: "rec_gone" }));
    const bytes = new TextEncoder().encode("evidence");
    const path = buildAttachmentPath("rec_gone", ".txt", new Date("2026-09-04T00:00:00Z"));
    vault.saveAttachment(
      {
        id: "att_gone",
        receipt_id: "rec_gone",
        file_name: "rec_gone.txt",
        relative_path: path,
        mime_type: "text/plain",
        file_size_bytes: bytes.length,
        sha256_hash: computeSha256(bytes),
        page_order: 1,
        ocr_text: null,
        created_at: "2026-09-04T00:00:00.000Z",
      },
      bytes,
    );

    vault.moveToTrash("rec_gone");
    vault.emptyTrash();

    expect(vault.listReceipts({ trashScope: "all" })).toHaveLength(0);
    expect(store.readAttachment(path)).toBeNull();
    expect(vault.reconcileAttachments().orphanedFiles).toHaveLength(0);
  });
});

describe("search covers what the user was told it covers", () => {
  it("finds a receipt by text scanned off the document", () => {
    const vault = new LocalReceiptVault(new InMemoryVaultStore());
    vault.saveReceipt(receipt({ id: "rec_ocr", merchant: "Jollibee", notes: null }));
    const bytes = new TextEncoder().encode("CHICKENJOY WITH RICE 85.00");
    vault.saveAttachment(
      {
        id: "att_ocr",
        receipt_id: "rec_ocr",
        file_name: "rec_ocr.txt",
        relative_path: buildAttachmentPath("rec_ocr", ".txt", new Date("2026-09-04T00:00:00Z")),
        mime_type: "text/plain",
        file_size_bytes: bytes.length,
        sha256_hash: computeSha256(bytes),
        page_order: 1,
        ocr_text: "CHICKENJOY WITH RICE 85.00",
        created_at: "2026-09-04T00:00:00.000Z",
      },
      bytes,
    );

    expect(vault.listReceipts({ searchQuery: "chickenjoy" }).map((r) => r.id)).toEqual(["rec_ocr"]);
  });
});
