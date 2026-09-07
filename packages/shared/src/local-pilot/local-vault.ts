/**
 * Keeptrail Local Vault Engine
 * 
 * Provides local database and storage repository management.
 * Implements S0/S1 durable lifecycle rules, trash retention, and search.
 */

import type {
  ReceiptRecord,
  AttachmentRecord,
  CollectionRecord,
  ActionRecord,
  ReviewStatus,
} from "./types";
import type { EncryptBackupOptions } from "./backup-encryption";

export interface StorageUsageStats {
  receiptCount: number;
  unreviewedCount: number;
  trashedCount: number;
  attachmentCount: number;
  totalAttachmentBytes: number;
  databaseEstimatedBytes: number;
  lastBackupTimestamp: string | null;
  recordsModifiedSinceLastBackup: number;
}

export interface ReceiptFilter {
  searchQuery?: string;
  collectionId?: string;
  reviewStatus?: ReviewStatus;
  includeTrashed?: boolean;
  currency?: string;
  startDate?: string;
  endDate?: string;
  minAmountMinorUnits?: number;
  maxAmountMinorUnits?: number;
}

export class LocalReceiptVault {
  private receipts: Map<string, ReceiptRecord> = new Map();
  private attachments: Map<string, AttachmentRecord> = new Map();
  private collections: Map<string, CollectionRecord> = new Map();
  private actions: Map<string, ActionRecord> = new Map();
  private files: Map<string, Uint8Array> = new Map(); // relative_path -> Uint8Array
  private lastBackupTimestamp: string | null = null;
  private recordsModifiedSinceBackup: number = 0;

  constructor() {
    this.initDefaultCollections();
  }

  private initDefaultCollections() {
    const defaults: CollectionRecord[] = [
      {
        id: "col_purchases",
        name: "Purchases",
        color: "#146B55",
        icon: "bag",
        description: "Personal and family shopping receipts",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: "col_utilities",
        name: "Bills & Utilities",
        color: "#245BB2",
        icon: "flash",
        description: "Electricity, water, internet, and subscriptions",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: "col_work",
        name: "Work & Reimbursements",
        color: "#865500",
        icon: "briefcase",
        description: "Business and work-related expenses for claim",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    for (const c of defaults) {
      this.collections.set(c.id, c);
    }
  }

  // --- Receipts CRUD ---

  public saveReceipt(
    receipt: Omit<ReceiptRecord, "created_at" | "updated_at"> & {
      created_at?: string;
      updated_at?: string;
    }
  ): ReceiptRecord {
    const now = new Date().toISOString();
    const existing = this.receipts.get(receipt.id);

    const record: ReceiptRecord = {
      ...receipt,
      created_at: existing ? existing.created_at : receipt.created_at || now,
      updated_at: now,
    };

    this.receipts.set(record.id, record);
    this.recordsModifiedSinceBackup++;
    return record;
  }

  public getReceipt(id: string): ReceiptRecord | null {
    return this.receipts.get(id) || null;
  }

  public listReceipts(filter?: ReceiptFilter): ReceiptRecord[] {
    let list = Array.from(this.receipts.values());

    const includeTrashed = filter?.includeTrashed ?? false;
    if (!includeTrashed) {
      list = list.filter((r) => !r.is_trashed);
    } else if (filter?.includeTrashed === true) {
      list = list.filter((r) => r.is_trashed);
    }

    if (filter?.collectionId) {
      list = list.filter((r) => r.collection_ids.includes(filter.collectionId!));
    }

    if (filter?.reviewStatus) {
      list = list.filter((r) => r.review_status === filter.reviewStatus);
    }

    if (filter?.currency) {
      list = list.filter((r) => r.currency?.toUpperCase() === filter.currency!.toUpperCase());
    }

    if (filter?.startDate) {
      list = list.filter((r) => (r.transaction_date || "") >= filter.startDate!);
    }

    if (filter?.endDate) {
      list = list.filter((r) => (r.transaction_date || "") <= filter.endDate!);
    }

    if (filter?.minAmountMinorUnits !== undefined) {
      list = list.filter(
        (r) => r.total_minor_units !== null && r.total_minor_units >= filter.minAmountMinorUnits!
      );
    }

    if (filter?.maxAmountMinorUnits !== undefined) {
      list = list.filter(
        (r) => r.total_minor_units !== null && r.total_minor_units <= filter.maxAmountMinorUnits!
      );
    }

    if (filter?.searchQuery && filter.searchQuery.trim()) {
      const q = filter.searchQuery.trim().toLowerCase();
      list = list.filter((r) => {
        const m = (r.merchant || "").toLowerCase();
        const t = (r.title || "").toLowerCase();
        const n = (r.notes || "").toLowerCase();
        const p = (r.purpose || "").toLowerCase();
        const tags = r.tags.map((tg) => tg.toLowerCase()).join(" ");
        return (
          m.includes(q) ||
          t.includes(q) ||
          n.includes(q) ||
          p.includes(q) ||
          tags.includes(q)
        );
      });
    }

    // Sort latest first
    return list.sort((a, b) => {
      const dateA = a.transaction_date || a.created_at;
      const dateB = b.transaction_date || b.created_at;
      return dateB.localeCompare(dateA);
    });
  }

  public moveToTrash(id: string): boolean {
    const record = this.receipts.get(id);
    if (!record) return false;
    record.is_trashed = true;
    record.deleted_at = new Date().toISOString();
    record.updated_at = new Date().toISOString();
    this.recordsModifiedSinceBackup++;
    return true;
  }

  public restoreFromTrash(id: string): boolean {
    const record = this.receipts.get(id);
    if (!record) return false;
    record.is_trashed = false;
    record.deleted_at = null;
    record.updated_at = new Date().toISOString();
    this.recordsModifiedSinceBackup++;
    return true;
  }

  public permanentlyDeleteReceipt(id: string): boolean {
    const record = this.receipts.get(id);
    if (!record) return false;

    // Delete associated attachments & files
    const atts = this.getAttachmentsForReceipt(id);
    for (const a of atts) {
      this.files.delete(a.relative_path);
      this.attachments.delete(a.id);
    }

    // Delete associated actions
    for (const [actionId, act] of this.actions.entries()) {
      if (act.receipt_id === id) {
        this.actions.delete(actionId);
      }
    }

    this.receipts.delete(id);
    this.recordsModifiedSinceBackup++;
    return true;
  }

  public emptyTrash(): number {
    const trashed = Array.from(this.receipts.values()).filter((r) => r.is_trashed);
    for (const r of trashed) {
      this.permanentlyDeleteReceipt(r.id);
    }
    return trashed.length;
  }

  // --- Attachments & Durable File Operations ---

  public saveAttachment(
    attachment: AttachmentRecord,
    fileBytes?: Uint8Array
  ): void {
    this.attachments.set(attachment.id, attachment);
    if (fileBytes) {
      this.files.set(attachment.relative_path, fileBytes);
    }
    this.recordsModifiedSinceBackup++;
  }

  public getAttachmentsForReceipt(receiptId: string): AttachmentRecord[] {
    return Array.from(this.attachments.values())
      .filter((a) => a.receipt_id === receiptId)
      .sort((a, b) => a.page_order - b.page_order);
  }

  public getFileBytes(relativePath: string): Uint8Array | null {
    return this.files.get(relativePath) || null;
  }

  // --- Collections CRUD ---

  public saveCollection(collection: CollectionRecord): void {
    this.collections.set(collection.id, collection);
    this.recordsModifiedSinceBackup++;
  }

  public listCollections(): CollectionRecord[] {
    return Array.from(this.collections.values());
  }

  public deleteCollection(id: string): boolean {
    // Remove collection ID from receipts
    for (const r of this.receipts.values()) {
      if (r.collection_ids.includes(id)) {
        r.collection_ids = r.collection_ids.filter((cId) => cId !== id);
      }
    }
    const res = this.collections.delete(id);
    if (res) this.recordsModifiedSinceBackup++;
    return res;
  }

  // --- Actions & Deadlines ---

  public saveAction(action: ActionRecord): void {
    this.actions.set(action.id, action);
    this.recordsModifiedSinceBackup++;
  }

  public listActions(receiptId?: string): ActionRecord[] {
    let list = Array.from(this.actions.values());
    if (receiptId) {
      list = list.filter((a) => a.receipt_id === receiptId);
    }
    return list.sort((a, b) => a.due_date.localeCompare(b.due_date));
  }

  public updateActionStatus(id: string, status: ActionRecord["status"]): boolean {
    const act = this.actions.get(id);
    if (!act) return false;
    act.status = status;
    act.updated_at = new Date().toISOString();
    this.recordsModifiedSinceBackup++;
    return true;
  }

  // --- Storage Usage & Backup Bookkeeping ---

  public getStorageUsageStats(): StorageUsageStats {
    const allReceipts = Array.from(this.receipts.values());
    let totalAttachmentBytes = 0;
    for (const bytes of this.files.values()) {
      totalAttachmentBytes += bytes.length;
    }

    // Rough estimated SQLite database size based on JSON representation
    const jsonSize = new TextEncoder().encode(
      JSON.stringify({
        receipts: allReceipts,
        attachments: Array.from(this.attachments.values()),
        collections: Array.from(this.collections.values()),
        actions: Array.from(this.actions.values()),
      })
    ).length;

    return {
      receiptCount: allReceipts.filter((r) => !r.is_trashed).length,
      unreviewedCount: allReceipts.filter(
        (r) => !r.is_trashed && r.review_status === "unreviewed"
      ).length,
      trashedCount: allReceipts.filter((r) => r.is_trashed).length,
      attachmentCount: this.attachments.size,
      totalAttachmentBytes,
      databaseEstimatedBytes: jsonSize,
      lastBackupTimestamp: this.lastBackupTimestamp,
      recordsModifiedSinceLastBackup: this.recordsModifiedSinceBackup,
    };
  }

  public markBackupCompleted(): void {
    this.lastBackupTimestamp = new Date().toISOString();
    this.recordsModifiedSinceBackup = 0;
  }

  // --- Export / Import Packaging ---

  public getBackupPayload(): EncryptBackupOptions {
    const filesRecord: Record<string, Uint8Array> = {};
    for (const [path, bytes] of this.files.entries()) {
      filesRecord[path] = bytes;
    }

    return {
      receipts: Array.from(this.receipts.values()),
      attachments: Array.from(this.attachments.values()),
      collections: Array.from(this.collections.values()),
      actions: Array.from(this.actions.values()),
      files: filesRecord,
    };
  }

  public restoreFromPayload(
    payload: EncryptBackupOptions,
    mode: "overwrite" | "merge" = "overwrite"
  ): void {
    if (mode === "overwrite") {
      this.receipts.clear();
      this.attachments.clear();
      this.collections.clear();
      this.actions.clear();
      this.files.clear();
    }

    for (const c of payload.collections) {
      this.collections.set(c.id, c);
    }
    for (const r of payload.receipts) {
      this.receipts.set(r.id, r);
    }
    for (const a of payload.attachments) {
      this.attachments.set(a.id, a);
    }
    for (const act of payload.actions) {
      this.actions.set(act.id, act);
    }
    for (const [path, bytes] of Object.entries(payload.files)) {
      this.files.set(path, bytes);
    }

    this.markBackupCompleted();
  }
}
