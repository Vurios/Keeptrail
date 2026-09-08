/**
 * Keeptrail On-Device Receipt Extractor
 *
 * Rules:
 * 1. Receipt text is untrusted input.
 * 2. Missing facts remain null (never invent merchants, amounts, or policies).
 * 3. Exact currency detection (PHP, USD, etc.).
 * 4. Date parsing with ambiguity detection.
 * 5. Arithmetic validation where facts exist.
 */

import type { DocumentType } from "./types";
import { parseMoneyToMinorUnits } from "./deterministic-money";

export interface ExtractedReceiptData {
  merchant: string | null;
  transaction_date: string | null;
  currency: string | null;
  total_minor_units: number | null;
  subtotal_minor_units: number | null;
  tax_minor_units: number | null;
  document_type: DocumentType;
  date_is_ambiguous: boolean;
  arithmetic_matches: boolean | null;
  raw_line_count: number;
}

const NOISE_WORDS = new Set([
  "RECEIPT",
  "OFFICIAL RECEIPT",
  "SALES INVOICE",
  "TAX INVOICE",
  "WELCOME",
  "ORDER",
  "PAYMENT",
  "THANK YOU",
  "CUSTOMER COPY",
  "MERCHANT COPY",
  "TRANSACTION",
  "INVOICE",
  "REPRINT",
]);

/**
 * Extract structured receipt data from raw OCR text on device.
 */
export function extractReceiptFromText(rawText: string): ExtractedReceiptData {
  if (!rawText || !rawText.trim()) {
    return {
      merchant: null,
      transaction_date: null,
      currency: null,
      total_minor_units: null,
      subtotal_minor_units: null,
      tax_minor_units: null,
      document_type: "unknown",
      date_is_ambiguous: false,
      arithmetic_matches: null,
      raw_line_count: 0,
    };
  }

  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const raw_line_count = lines.length;

  // 1. Detect Document Type
  let document_type: DocumentType = "receipt";
  const upperFullText = rawText.toUpperCase();

  if (
    upperFullText.includes("PAYMENT SCREENSHOT") ||
    upperFullText.includes("GCASH") ||
    upperFullText.includes("MAYA") ||
    upperFullText.includes("TRANSFER SUCCESSFUL") ||
    upperFullText.includes("SENT MONEY")
  ) {
    document_type = "payment_screenshot";
  } else if (upperFullText.includes("INVOICE") || upperFullText.includes("BILLING STATEMENT")) {
    document_type = "invoice";
  } else if (
    upperFullText.includes("ORDER CONFIRMATION") ||
    upperFullText.includes("ORDER SUMMARY") ||
    upperFullText.includes("SHOPEE") ||
    upperFullText.includes("LAZADA")
  ) {
    document_type = "order_confirmation";
  }

  // 2. Detect Currency
  let currency: string | null = null;
  if (
    rawText.includes("₱") ||
    upperFullText.includes("PHP") ||
    upperFullText.includes("PHILIPPINE PESO")
  ) {
    currency = "PHP";
  } else if (
    rawText.includes("$") ||
    upperFullText.includes("USD") ||
    upperFullText.includes("DOLLAR")
  ) {
    currency = "USD";
  } else if (rawText.includes("€") || upperFullText.includes("EUR")) {
    currency = "EUR";
  } else if (rawText.includes("¥") || upperFullText.includes("JPY")) {
    currency = "JPY";
  }

  // 3. Extract Merchant (first non-noise line among top 5 lines)
  let merchant: string | null = null;
  for (let i = 0; i < Math.min(lines.length, 6); i++) {
    const candidate = lines[i];
    if (!candidate) continue;
    const upperCandidate = candidate.toUpperCase();

    // Skip short or purely numeric lines
    if (candidate.length < 3 || /^\d+$/.test(candidate)) continue;

    // Skip noise headers
    if (NOISE_WORDS.has(upperCandidate)) continue;

    // Skip date-only lines
    if (/\b\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4}\b/.test(candidate)) continue;

    merchant = candidate;
    break;
  }

  // 4. Extract Date
  let transaction_date: string | null = null;
  let date_is_ambiguous = false;

  // Patterns: YYYY-MM-DD, MM/DD/YYYY, DD/MM/YYYY, Month DD, YYYY
  const isoMatch = rawText.match(/\b(20\d{2})[-/.](0[1-9]|1[0-2])[-/.](0[1-9]|[12]\d|3[01])\b/);
  if (isoMatch && isoMatch[1] && isoMatch[2] && isoMatch[3]) {
    transaction_date = `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  } else {
    const slashMatch = rawText.match(
      /\b(0?[1-9]|1[0-2])[-/.](0?[1-9]|[12]\d|3[01])[-/.](20\d{2}|\d{2})\b/,
    );
    if (slashMatch && slashMatch[1] && slashMatch[2] && slashMatch[3]) {
      let year = slashMatch[3];
      if (year.length === 2) year = `20${year}`;
      const part1 = parseInt(slashMatch[1], 10);
      const part2 = parseInt(slashMatch[2], 10);

      // If both part1 and part2 are <= 12, ambiguous whether DD/MM or MM/DD
      if (part1 <= 12 && part2 <= 12 && part1 !== part2) {
        date_is_ambiguous = true;
      }

      // Default interpretation MM-DD-YYYY
      const mm = String(part1).padStart(2, "0");
      const dd = String(part2).padStart(2, "0");
      transaction_date = `${year}-${mm}-${dd}`;
    }
  }

  // 5. Extract Totals, Subtotal, Tax
  let total_minor_units: number | null = null;
  let subtotal_minor_units: number | null = null;
  let tax_minor_units: number | null = null;

  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    if (!line) continue;
    const upperLine = line.toUpperCase();

    // Look for Total / Amount
    if (
      total_minor_units === null &&
      (upperLine.includes("TOTAL") ||
        upperLine.includes("AMOUNT") ||
        upperLine.includes("GRAND TOTAL") ||
        upperLine.includes("TOTAL DUE")) &&
      !upperLine.includes("SUBTOTAL") &&
      !upperLine.includes("TAX")
    ) {
      const parsed = parseAmountFromLine(line, currency || "PHP");
      if (parsed !== null) {
        total_minor_units = parsed;
      }
    }

    // Look for Subtotal
    if (subtotal_minor_units === null && upperLine.includes("SUBTOTAL")) {
      const parsed = parseAmountFromLine(line, currency || "PHP");
      if (parsed !== null) {
        subtotal_minor_units = parsed;
      }
    }

    // Look for Tax / VAT
    if (
      tax_minor_units === null &&
      (upperLine.includes("TAX") || upperLine.includes("VAT")) &&
      !upperLine.includes("TOTAL")
    ) {
      const parsed = parseAmountFromLine(line, currency || "PHP");
      if (parsed !== null) {
        tax_minor_units = parsed;
      }
    }
  }

  // Fallback: If no line with "TOTAL" or "AMOUNT" matched, look for the largest amount on bottom half
  if (total_minor_units === null) {
    const amounts: number[] = [];
    for (let i = Math.floor(lines.length / 2); i < lines.length; i++) {
      const candidateLine = lines[i];
      if (!candidateLine) continue;
      const parsed = parseAmountFromLine(candidateLine, currency || "PHP");
      if (parsed !== null) {
        amounts.push(parsed);
      }
    }
    if (amounts.length > 0) {
      total_minor_units = Math.max(...amounts);
    }
  }

  // 6. Arithmetic Validation (if subtotal, tax, and total exist)
  let arithmetic_matches: boolean | null = null;
  if (total_minor_units !== null && subtotal_minor_units !== null && tax_minor_units !== null) {
    const diff = Math.abs(subtotal_minor_units + tax_minor_units - total_minor_units);
    // Allow up to 2 minor units (e.g. 2 cents) for rounding discrepancy
    arithmetic_matches = diff <= 2;
  }

  return {
    merchant,
    transaction_date,
    currency,
    total_minor_units,
    subtotal_minor_units,
    tax_minor_units,
    document_type,
    date_is_ambiguous,
    arithmetic_matches,
    raw_line_count,
  };
}

function parseAmountFromLine(line: string, currency: string): number | null {
  // Strip percentage strings like "12%", "5.5%" so they don't get parsed as amounts
  const cleaned = line.replace(/\b\d+(\.\d+)?\s*%/g, "");

  // Match currency symbols or numbers with decimal points (e.g. 1,579.00 or 19.80)
  // Or standalone integers up to 7 digits that do NOT start with leading 0 (avoiding phone numbers like 0917...)
  const matches = cleaned.matchAll(
    /(?:[₱$€¥]|PHP|USD)?\s*([0-9]{1,3}(?:,[0-9]{3})*\.[0-9]{2}|[1-9][0-9]{0,6}(?:\.[0-9]{2})?)/gi,
  );

  let bestAmount: number | null = null;
  for (const m of matches) {
    const candidate = m[1];
    if (!candidate) continue;
    // Skip phone-like or ref-like numbers without decimals that are longer than 6 digits
    if (!candidate.includes(".") && candidate.length > 6) continue;
    const parsed = parseMoneyToMinorUnits(candidate, currency);
    if (parsed !== null) {
      bestAmount = parsed;
    }
  }

  return bestAmount;
}
