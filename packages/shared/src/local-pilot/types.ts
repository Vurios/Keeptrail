/**
 * Keeptrail Free Local Android Pilot — Core Domain Types
 * Source of Truth: Keeptrail_Free_APK_Pilot_Blueprint.md & Keeptrail_Local_Storage_and_Backup_Guide.md
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
  // File contents mapped by relative_path -> base64 or binary Uint8Array
  files: Record<string, Uint8Array>;
}
