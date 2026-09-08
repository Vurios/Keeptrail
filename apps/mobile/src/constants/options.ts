/**
 * Fixed option sets.
 *
 * Currency and document type were free-text fields. A single typo in a currency
 * code forked the user's totals into a bucket the UI could count but never
 * show, so both are now closed sets the user picks from.
 */

import { CURRENCY_SYMBOLS, type ActionType, type DocumentType } from "@katibay/shared";
import { palette } from "../theme/tokens";

export const CURRENCY_OPTIONS: { value: string; label: string }[] = Object.keys(
  CURRENCY_SYMBOLS,
).map((code) => ({ value: code, label: `${CURRENCY_SYMBOLS[code]} ${code}` }));

export const DOCUMENT_TYPE_OPTIONS: { value: DocumentType; label: string }[] = [
  { value: "receipt", label: "Receipt" },
  { value: "payment_screenshot", label: "Payment screenshot" },
  { value: "invoice", label: "Invoice" },
  { value: "order_confirmation", label: "Order confirmation" },
  { value: "supporting_document", label: "Supporting document" },
  { value: "unknown", label: "Not sure" },
];

export const ACTION_TYPE_OPTIONS: { value: ActionType; label: string }[] = [
  { value: "return_deadline", label: "Return window" },
  { value: "refund_followup", label: "Refund follow-up" },
  { value: "reimbursement", label: "Reimbursement" },
  { value: "missing_document", label: "Missing document" },
  { value: "custom_reminder", label: "Other" },
];

/**
 * Which collection a newly captured receipt lands in, chosen from what was
 * detected rather than always "Purchases".
 */
export function defaultCollectionForDocumentType(documentType: DocumentType): string {
  switch (documentType) {
    case "invoice":
      return "col_utilities";
    case "receipt":
    case "order_confirmation":
      return "col_purchases";
    default:
      return "col_inbox";
  }
}

/**
 * Collection colours, named so a screen reader announces "Evergreen" rather
 * than "#146B55", and drawn from the theme palette rather than fresh literals.
 */
export const COLLECTION_COLOR_OPTIONS: { value: string; label: string }[] = [
  { value: palette.evergreen600, label: "Evergreen" },
  { value: palette.blue700, label: "Deep blue" },
  { value: palette.brass600, label: "Brass" },
  { value: palette.red700, label: "Clay red" },
  { value: palette.paper600, label: "Slate" },
  { value: palette.amber800, label: "Amber" },
];
