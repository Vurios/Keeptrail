/**
 * Keeptrail Deterministic Money Tools
 * 
 * Rules:
 * 1. Money is integer minor units (e.g. cents, centavos). No floating-point rounding errors.
 * 2. Missing/unknown amounts stay null. Never convert unknown amounts to zero.
 * 3. Never aggregate multiple currencies into one combined total.
 * 4. Distinctly count reviewed, unreviewed, and unknown amount records.
 * 5. Guard against CSV formula injection.
 */

import type { MultiCurrencySummary, ReceiptRecord } from "./types";

export const CURRENCY_SYMBOLS: Record<string, string> = {
  PHP: "₱",
  USD: "$",
  EUR: "€",
  GBP: "£",
  JPY: "¥",
  SGD: "S$",
  CAD: "CA$",
  AUD: "A$",
};

export const CURRENCY_MINOR_UNIT_DIGITS: Record<string, number> = {
  PHP: 2,
  USD: 2,
  EUR: 2,
  GBP: 2,
  JPY: 0,
  SGD: 2,
  CAD: 2,
  AUD: 2,
};

/**
 * Format minor units into human-readable currency string.
 * Example: (157900, "PHP") => "₱1,579.00"
 * Example: (null, "PHP") => "Unknown"
 */
export function formatMoney(
  minorUnits: number | null | undefined,
  currency: string | null | undefined
): string {
  if (minorUnits === null || minorUnits === undefined) {
    return "Unknown";
  }

  const curr = (currency || "PHP").toUpperCase();
  const digits = CURRENCY_MINOR_UNIT_DIGITS[curr] ?? 2;
  const symbol = CURRENCY_SYMBOLS[curr] ?? `${curr} `;

  const divisor = Math.pow(10, digits);
  const major = minorUnits / divisor;

  const formattedNumber = major.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });

  return `${symbol}${formattedNumber}`;
}

/**
 * Parse a user input string into integer minor units.
 * Example: "1,579.00", "PHP" => 157900
 * Example: "50", "JPY" => 50
 * Returns null if invalid or empty.
 */
export function parseMoneyToMinorUnits(
  input: string | null | undefined,
  currency: string = "PHP"
): number | null {
  if (!input || !input.trim()) return null;

  // Clean currency symbols, commas, whitespace
  const cleaned = input
    .replace(/[^\d.-]/g, "")
    .trim();

  if (!cleaned || isNaN(Number(cleaned))) return null;

  const num = parseFloat(cleaned);
  if (isNaN(num)) return null;

  const curr = currency.toUpperCase();
  const digits = CURRENCY_MINOR_UNIT_DIGITS[curr] ?? 2;
  const factor = Math.pow(10, digits);

  return Math.round(num * factor);
}

/**
 * Calculate deterministic multi-currency totals over a set of receipts.
 * Deduplicates by receipt ID and separates currencies strictly.
 */
export function calculateReceiptTotals(
  receipts: ReceiptRecord[],
  options?: {
    reviewedOnly?: boolean;
    excludeTrashed?: boolean;
  }
): MultiCurrencySummary {
  const excludeTrashed = options?.excludeTrashed ?? true;
  const reviewedOnly = options?.reviewedOnly ?? false;

  // Deduplicate by receipt ID
  const seenIds = new Set<string>();
  const uniqueReceipts: ReceiptRecord[] = [];

  for (const r of receipts) {
    if (seenIds.has(r.id)) continue;
    seenIds.add(r.id);
    uniqueReceipts.push(r);
  }

  const summary: MultiCurrencySummary = {
    currencies: {},
    total_records_reviewed: 0,
    total_records_unreviewed: 0,
    total_records_unknown_amount: 0,
    total_records_excluded: 0,
  };

  for (const r of uniqueReceipts) {
    if (excludeTrashed && r.is_trashed) {
      summary.total_records_excluded++;
      continue;
    }

    if (r.review_status === "reviewed") {
      summary.total_records_reviewed++;
    } else {
      summary.total_records_unreviewed++;
    }

    if (reviewedOnly && r.review_status !== "reviewed") {
      summary.total_records_excluded++;
      continue;
    }

    if (r.total_minor_units === null || r.currency === null) {
      summary.total_records_unknown_amount++;
      continue;
    }

    const curr = r.currency.toUpperCase();
    if (!summary.currencies[curr]) {
      summary.currencies[curr] = {
        currency: curr,
        total_minor_units: 0,
        formatted: "",
        record_count: 0,
      };
    }

    const currObj = summary.currencies[curr];
    if (currObj) {
      currObj.total_minor_units += r.total_minor_units;
      currObj.record_count++;
    }
  }

  // Format summaries
  for (const curr of Object.keys(summary.currencies)) {
    const item = summary.currencies[curr];
    if (item) {
      item.formatted = formatMoney(item.total_minor_units, curr);
    }
  }

  return summary;
}

/**
 * Guard against spreadsheet formula injection in CSV/export generation.
 * If a field starts with =, +, -, @, \t, or \r, prefix it with a single quote.
 */
export function sanitizeForExport(val: string | null | undefined): string {
  if (val === null || val === undefined) return "";
  const str = String(val);
  if (/^[=+\-@\t\r]/.test(str)) {
    return `'${str}`;
  }
  return str;
}
