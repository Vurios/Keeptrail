/**
 * Duplicate suggestions.
 *
 * Blueprint §4: "Duplicate detection suggests matches using hashes and field
 * similarity; never deletes automatically." Everything here returns a
 * suggestion with a stated reason. Nothing in this module mutates the vault.
 *
 * Two signals, in order of confidence:
 *
 * 1. An identical attachment checksum. The same file has been imported twice.
 *    This is certain, not a guess.
 * 2. Field similarity — same merchant, same amount, same or near date. This is
 *    a guess and is labelled as one, because two identical coffees on the same
 *    day are a real thing that happens.
 */

import type { AttachmentRecord, ReceiptRecord } from "./types";

export type DuplicateConfidence = "identical_file" | "likely" | "possible";

export interface DuplicateSuggestion {
  receiptId: string;
  candidateId: string;
  confidence: DuplicateConfidence;
  /** Plain-language reason, shown to the user verbatim. */
  reason: string;
}

/** Days apart that still counts as "around the same date". */
const NEAR_DATE_DAYS = 1;

function normalizeMerchant(value: string | null): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function daysBetween(a: string | null, b: string | null): number | null {
  if (!a || !b) return null;
  const parsedA = Date.parse(`${a}T00:00:00Z`);
  const parsedB = Date.parse(`${b}T00:00:00Z`);
  if (Number.isNaN(parsedA) || Number.isNaN(parsedB)) return null;
  return Math.abs(Math.round((parsedA - parsedB) / 86400000));
}

/**
 * Finds candidates that may duplicate `receipt`.
 *
 * `attachmentsByReceipt` maps a receipt id to its attachments so checksum
 * comparison does not require a second pass over storage.
 */
export function findDuplicateSuggestions(
  receipt: ReceiptRecord,
  others: ReceiptRecord[],
  attachmentsByReceipt: Map<string, AttachmentRecord[]>,
): DuplicateSuggestion[] {
  const suggestions: DuplicateSuggestion[] = [];

  const ownHashes = new Set((attachmentsByReceipt.get(receipt.id) ?? []).map((a) => a.sha256_hash));
  const merchant = normalizeMerchant(receipt.merchant);

  for (const candidate of others) {
    if (candidate.id === receipt.id) continue;
    if (candidate.is_trashed) continue;

    // 1. Identical file content.
    const candidateHashes = (attachmentsByReceipt.get(candidate.id) ?? []).map(
      (a) => a.sha256_hash,
    );
    const sharedHash = candidateHashes.find((hash) => ownHashes.has(hash));
    if (sharedHash) {
      suggestions.push({
        receiptId: receipt.id,
        candidateId: candidate.id,
        confidence: "identical_file",
        reason: "The attached original is byte-for-byte the same file.",
      });
      continue;
    }

    // 2. Field similarity. Requires a merchant and an amount to say anything;
    // two receipts with unknown totals are not evidence of anything.
    if (!merchant || receipt.total_minor_units === null) continue;
    if (normalizeMerchant(candidate.merchant) !== merchant) continue;
    if (candidate.total_minor_units !== receipt.total_minor_units) continue;
    if ((candidate.currency ?? "") !== (receipt.currency ?? "")) continue;

    const gap = daysBetween(receipt.transaction_date, candidate.transaction_date);
    if (gap === 0) {
      suggestions.push({
        receiptId: receipt.id,
        candidateId: candidate.id,
        confidence: "likely",
        reason: "Same merchant, same amount and same date.",
      });
    } else if (gap !== null && gap <= NEAR_DATE_DAYS) {
      suggestions.push({
        receiptId: receipt.id,
        candidateId: candidate.id,
        confidence: "possible",
        reason: `Same merchant and amount, ${gap} day apart.`,
      });
    }
  }

  return suggestions;
}

/**
 * Every duplicate suggestion across the vault, each pair reported once.
 * Ordered strongest-first so the UI can show what matters without sorting.
 */
export function findAllDuplicateSuggestions(
  receipts: ReceiptRecord[],
  attachmentsByReceipt: Map<string, AttachmentRecord[]>,
): DuplicateSuggestion[] {
  const active = receipts.filter((r) => !r.is_trashed);
  const seenPairs = new Set<string>();
  const all: DuplicateSuggestion[] = [];

  for (const receipt of active) {
    for (const suggestion of findDuplicateSuggestions(receipt, active, attachmentsByReceipt)) {
      const pairKey = [suggestion.receiptId, suggestion.candidateId].sort().join("|");
      if (seenPairs.has(pairKey)) continue;
      seenPairs.add(pairKey);
      all.push(suggestion);
    }
  }

  const rank: Record<DuplicateConfidence, number> = {
    identical_file: 0,
    likely: 1,
    possible: 2,
  };
  return all.sort((a, b) => rank[a.confidence] - rank[b.confidence]);
}
