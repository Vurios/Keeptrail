/**
 * Keeptrail Free Local Android Pilot — Core Domain Types
 * Source of truth: Keeptrail_Free_APK_Pilot_Blueprint_V2.md (Revision 8) and
 * Keeptrail_Local_Storage_and_Backup_Guide.md
 *
 * Strict Local Architecture: No accounts, no cloud backend, no subscriptions.
 */

export type DocumentType =
  | "receipt"
  | "invoice"
  | "payment_screenshot"
  | "order_confirmation"
  | "supporting_document"
  | "unknown";

export type ReviewStatus = "unreviewed" | "reviewed" | "needs_attention";

export interface ReceiptRecord {
  id: string;
  title: string;
  merchant: string | null;
  transaction_date: string | null; // ISO 8601 YYYY-MM-DD
  currency: string | null; // e.g. 'PHP', 'USD'
  total_minor_units: number | null; // Integer minor units (e.g. 157900 for 1579.00 PHP). Null if unknown.
  subtotal_minor_units: number | null;
  tax_minor_units: number | null;
  document_type: DocumentType;
  review_status: ReviewStatus;
  notes: string | null;
  purpose: string | null;
  tags: string[];
  /** Values for CustomFieldDefinition ids. Absent means the user left it blank. */
  custom_fields: Record<string, string>;
  collection_ids: string[];
  is_trashed: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface AttachmentRecord {
  id: string;
  receipt_id: string;
  file_name: string;
  relative_path: string; // Relative to app-private receipts directory, e.g. "originals/2026/09/rec_123.jpg"
  mime_type: string;
  file_size_bytes: number;
  sha256_hash: string;
  page_order: number;
  ocr_text: string | null;
  created_at: string;
}

/**
 * A user-defined field. Typed, so a "Warranty ends" value can be validated as a
 * date rather than stored as arbitrary text (blueprint section 4).
 */
export type CustomFieldType = "text" | "number" | "date";

export interface CustomFieldDefinition {
  id: string;
  label: string;
  field_type: CustomFieldType;
  created_at: string;
}

export interface CollectionRecord {
  id: string;
  name: string;
  color: string; // e.g. '#146B55'
  icon: string; // e.g. 'folder', 'cart'
  description: string | null;
  created_at: string;
  updated_at: string;
}

export type ActionType =
  | "return_deadline"
  | "refund_followup"
  | "reimbursement"
  | "missing_document"
  | "custom_reminder";

export type ActionStatus = "pending" | "completed" | "cancelled";

export interface ActionRecord {
  id: string;
  receipt_id: string;
  action_type: ActionType;
  title: string;
  due_date: string; // ISO 8601 YYYY-MM-DD
  status: ActionStatus;
  amount_minor_units: number | null;
  currency: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * An in-progress capture, persisted before the user confirms it.
 *
 * Blueprint section 4: "Save a durable draft before confirming capture. Recover
 * after process death." The attachment is already written to durable storage by
 * the time a draft exists, so a recovered draft never points at a lost file.
 */
export interface CaptureDraft {
  id: string;
  merchant: string;
  transaction_date: string;
  amount: string;
  currency: string;
  document_type: DocumentType;
  purpose: string;
  notes: string;
  tags: string[];
  collection_ids: string[];
  /** Relative path of the original already committed to storage, if any. */
  attachment_relative_path: string | null;
  attachment_file_name: string | null;
  attachment_mime_type: string | null;
  attachment_sha256: string | null;
  attachment_size_bytes: number | null;
  source_text: string | null;
  /** Fields populated by extraction that the user has not edited. */
  unconfirmed_fields: string[];
  created_at: string;
  updated_at: string;
}

export interface CurrencyTotal {
  currency: string;
  total_minor_units: number;
  formatted: string;
  record_count: number;
}

export interface MultiCurrencySummary {
  currencies: Record<string, CurrencyTotal>;
  total_records_reviewed: number;
  total_records_unreviewed: number;
  total_records_unknown_amount: number;
  total_records_excluded: number;
}

export interface BackupManifest {
  format_version: "keeptrail.v1";
  export_id: string;
  created_at: string;
  app_version: string;
  receipt_count: number;
  attachment_count: number;
  collection_count: number;
  action_count: number;
  attachments_meta: Array<{
    id: string;
    receipt_id: string;
    relative_path: string;
    file_size_bytes: number;
    sha256_hash: string;
  }>;
}

export interface BackupArchiveContent {
  manifest: BackupManifest;
  receipts: ReceiptRecord[];
  attachments: AttachmentRecord[];
  collections: CollectionRecord[];
  actions: ActionRecord[];
  custom_field_definitions?: CustomFieldDefinition[];
  // File contents mapped by relative_path -> base64 or binary Uint8Array
  files: Record<string, Uint8Array>;
}
