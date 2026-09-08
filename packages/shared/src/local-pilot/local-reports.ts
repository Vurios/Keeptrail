/**
 * Local CSV and PDF reports.
 *
 * Blueprint §4, "Summaries and reports": totals are computed by deterministic
 * queries, each canonical receipt id is counted once, currencies are listed
 * separately, unknown amounts are excluded with an explicit count, and exported
 * text is escaped against spreadsheet formula injection.
 *
 * Nothing here writes a file or talks to a platform API — it returns strings the
 * mobile layer hands to the filesystem and the share sheet. That keeps the
 * money and escaping rules testable without a device.
 */

import { calculateReceiptTotals, formatMoney, sanitizeForExport } from "./deterministic-money";
import type { CollectionRecord, ReceiptRecord } from "./types";

export interface ReportScope {
  /** Shown in the report header so the reader knows what was included. */
  title: string;
  /** Inclusive ISO date bounds, when the user narrowed the range. */
  startDate?: string | null;
  endDate?: string | null;
  /** Set when the export was taken from one collection. */
  collectionName?: string | null;
  includesUnreviewed: boolean;
}

const CSV_COLUMNS = [
  "receipt_id",
  "merchant",
  "transaction_date",
  "currency",
  "amount_minor_units",
  "amount",
  "document_type",
  "review_status",
  "purpose",
  "notes",
  "tags",
  "collections",
] as const;

/** Wraps a value for CSV, escaping quotes and neutralising formula injection. */
function csvCell(value: string | null | undefined): string {
  const safe = sanitizeForExport(value ?? "");
  return `"${safe.replace(/"/g, '""')}"`;
}

/**
 * A CSV of the supplied receipts.
 *
 * The amount appears twice on purpose: `amount_minor_units` is the exact
 * integer the app stores and should be used for any further arithmetic, while
 * `amount` is the formatted figure a person reads. An unknown amount is empty
 * in both, never `0`.
 */
export function buildReceiptsCsv(
  receipts: ReceiptRecord[],
  collections: CollectionRecord[],
): string {
  const collectionNames = new Map(collections.map((c) => [c.id, c.name]));
  const seen = new Set<string>();
  const rows: string[] = [CSV_COLUMNS.join(",")];

  for (const receipt of receipts) {
    // Canonical id counted once, however many collections it belongs to.
    if (seen.has(receipt.id)) continue;
    seen.add(receipt.id);

    rows.push(
      [
        csvCell(receipt.id),
        csvCell(receipt.merchant ?? receipt.title),
        csvCell(receipt.transaction_date),
        csvCell(receipt.currency),
        csvCell(receipt.total_minor_units === null ? "" : String(receipt.total_minor_units)),
        csvCell(
          receipt.total_minor_units === null
            ? ""
            : formatMoney(receipt.total_minor_units, receipt.currency),
        ),
        csvCell(receipt.document_type),
        csvCell(receipt.review_status),
        csvCell(receipt.purpose),
        csvCell(receipt.notes),
        csvCell(receipt.tags.join("; ")),
        csvCell(receipt.collection_ids.map((id) => collectionNames.get(id) ?? id).join("; ")),
      ].join(","),
    );
  }

  return `${rows.join("\r\n")}\r\n`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * A self-contained HTML document for the platform's print-to-PDF pipeline.
 *
 * Styling mirrors the app's tokens rather than inventing a second visual
 * language, and every figure is rendered from the deterministic summary — no
 * total in this document was produced by anything other than integer
 * arithmetic over the receipts passed in.
 */
export function buildReceiptsReportHtml(
  receipts: ReceiptRecord[],
  collections: CollectionRecord[],
  scope: ReportScope,
  generatedAt: Date = new Date(),
): string {
  const collectionNames = new Map(collections.map((c) => [c.id, c.name]));

  const unique: ReceiptRecord[] = [];
  const seen = new Set<string>();
  for (const receipt of receipts) {
    if (seen.has(receipt.id)) continue;
    seen.add(receipt.id);
    unique.push(receipt);
  }

  const summary = calculateReceiptTotals(unique);
  const currencyRows = Object.values(summary.currencies)
    .sort((a, b) => b.total_minor_units - a.total_minor_units)
    .map(
      (entry) => `
        <tr>
          <td>${escapeHtml(entry.currency)}</td>
          <td class="num">${escapeHtml(entry.formatted)}</td>
          <td class="num">${entry.record_count}</td>
        </tr>`,
    )
    .join("");

  const receiptRows = unique
    .map(
      (receipt) => `
        <tr>
          <td>${escapeHtml(receipt.transaction_date ?? "—")}</td>
          <td>${escapeHtml(receipt.merchant ?? receipt.title)}</td>
          <td>${escapeHtml(receipt.purpose ?? "")}</td>
          <td>${escapeHtml(
            receipt.collection_ids.map((id) => collectionNames.get(id) ?? id).join(", "),
          )}</td>
          <td class="num">${
            receipt.total_minor_units === null
              ? '<span class="unknown">Unknown</span>'
              : escapeHtml(formatMoney(receipt.total_minor_units, receipt.currency))
          }</td>
        </tr>`,
    )
    .join("");

  const scopeLines: string[] = [];
  if (scope.collectionName) scopeLines.push(`Collection: ${scope.collectionName}`);
  if (scope.startDate || scope.endDate) {
    scopeLines.push(`Dates: ${scope.startDate ?? "any"} to ${scope.endDate ?? "any"}`);
  }
  scopeLines.push(
    scope.includesUnreviewed
      ? "Includes receipts that have not been reviewed"
      : "Reviewed receipts only",
  );

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(scope.title)}</title>
<style>
  :root { color-scheme: light; }
  body {
    font-family: -apple-system, Roboto, "Segoe UI", sans-serif;
    color: #182824; background: #FFFFFF;
    margin: 32px; font-size: 12px; line-height: 1.5;
  }
  h1 { font-size: 22px; margin: 0 0 4px; letter-spacing: -0.3px; }
  .meta { color: #5A6A62; font-size: 11px; margin-bottom: 24px; }
  .meta div { margin-top: 2px; }
  h2 {
    font-size: 11px; text-transform: uppercase; letter-spacing: 0.6px;
    color: #5A6A62; margin: 28px 0 8px;
  }
  table { width: 100%; border-collapse: collapse; }
  th, td {
    text-align: left; padding: 7px 8px;
    border-bottom: 1px solid #DCE4DE; vertical-align: top;
  }
  th { font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #5A6A62; }
  .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .unknown { color: #5A6A62; font-style: italic; }
  .note { color: #5A6A62; font-size: 11px; margin-top: 10px; }
  footer { margin-top: 32px; color: #5A6A62; font-size: 10px; }
</style>
</head>
<body>
  <h1>${escapeHtml(scope.title)}</h1>
  <div class="meta">
    <div>Generated ${escapeHtml(
      generatedAt.toISOString().slice(0, 16).replace("T", " "),
    )} on this device</div>
    ${scopeLines.map((line) => `<div>${escapeHtml(line)}</div>`).join("")}
  </div>

  <h2>Totals by currency</h2>
  <table>
    <thead><tr><th>Currency</th><th class="num">Total</th><th class="num">Receipts</th></tr></thead>
    <tbody>${currencyRows || '<tr><td colspan="3">No amounts recorded.</td></tr>'}</tbody>
  </table>
  <div class="note">
    Currencies are listed separately and never added together.
    ${
      summary.total_records_unknown_amount > 0
        ? `${summary.total_records_unknown_amount} receipt(s) have no recorded amount and are excluded from these totals.`
        : ""
    }
  </div>

  <h2>Receipts (${unique.length})</h2>
  <table>
    <thead>
      <tr><th>Date</th><th>Merchant</th><th>Purpose</th><th>Collections</th><th class="num">Amount</th></tr>
    </thead>
    <tbody>${receiptRows || '<tr><td colspan="5">No receipts in this scope.</td></tr>'}</tbody>
  </table>

  <footer>
    Produced by Keeptrail on this phone. This report is a summary of records the
    user saved; it does not authenticate any receipt.
  </footer>
</body>
</html>`;
}
