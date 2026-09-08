/**
 * Keeptrail Local Vault Engine
 *
 * Owns the receipt record set and its evidence files. Records are held in
 * memory for query speed and written through to a `VaultStore` after every
 * mutation; evidence bytes are never held in the heap at all — they go
 * straight to the store and are read back on demand.
 *
 * Implements the S0/S1 durable lifecycle rules, trash retention, and search.
 */

import type {
  ReceiptRecord,
  AttachmentRecord,
  CaptureDraft,
  CollectionRecord,
  CustomFieldDefinition,
  ActionRecord,
  ReviewStatus,
} from "./types";
import type { EncryptBackupOptions } from "./backup-encryption";
import {
  findAllDuplicateSuggestions,
  findDuplicateSuggestions,
  type DuplicateSuggestion,
} from "./duplicate-detection";
import {
  InMemoryVaultStore,
  OLDEST_SUPPORTED_INDEX_VERSION,
  VAULT_INDEX_VERSION,
  type VaultIndex,
  type VaultStore,
} from "./vault-storage";

export interface StorageUsageStats {
  receiptCount: number;
  unreviewedCount: number;
  trashedCount: number;
  attachmentCount: number;
  totalAttachmentBytes: number;
  indexBytes: number;
  lastBackupTimestamp: string | null;
  recordsModifiedSinceLastBackup: number;
}

export interface ReceiptFilter {
  searchQuery?: string;
  collectionId?: string;
  reviewStatus?: ReviewStatus;
  /**
   * `"active"` (default) hides trashed records, `"trashed"` returns only them,
   * `"all"` returns both. The previous boolean could not express "everything",
   * which made `includeTrashed: true` silently mean "trashed only".
   */
  trashScope?: "active" | "trashed" | "all";
  currency?: string;
  startDate?: string;
  endDate?: string;
  minAmountMinorUnits?: number;
  maxAmountMinorUnits?: number;
}

export const DEFAULT_COLLECTIONS: CollectionRecord[] = [
  {
    id: "col_inbox",
    name: "Inbox",
    color: "#5C6C65",
    icon: "inbox",
    description: "Newly saved receipts that have not been filed yet",
    created_at: new Date(0).toISOString(),
    updated_at: new Date(0).toISOString(),
  },
  {
    id: "col_purchases",
    name: "Purchases",
    color: "#146B55",
    icon: "bag",
    description: "Personal and family shopping receipts",
    created_at: new Date(0).toISOString(),
    updated_at: new Date(0).toISOString(),
  },
  {
    id: "col_utilities",
    name: "Bills & Utilities",
    color: "#245BB2",
    icon: "flash",
    description: "Electricity, water, internet, and subscriptions",
    created_at: new Date(0).toISOString(),
    updated_at: new Date(0).toISOString(),
  },
  {
    id: "col_work",
    name: "Work & Reimbursements",
    color: "#865500",
    icon: "briefcase",
    description: "Business and work-related expenses for claim",
    created_at: new Date(0).toISOString(),
    updated_at: new Date(0).toISOString(),
  },
];

export class LocalReceiptVault {
  private receipts: Map<string, ReceiptRecord> = new Map();
  private attachments: Map<string, AttachmentRecord> = new Map();
  private collections: Map<string, CollectionRecord> = new Map();
  private actions: Map<string, ActionRecord> = new Map();
  private customFields: Map<string, CustomFieldDefinition> = new Map();
  private drafts: Map<string, CaptureDraft> = new Map();
  private lastBackupTimestamp: string | null = null;
  private recordsModifiedSinceBackup: number = 0;

  private readonly store: VaultStore;
  /** Suppresses write-through while a bulk load or restore is in flight. */
  private suspendPersist = false;

  constructor(store: VaultStore = new InMemoryVaultStore()) {
    this.store = store;
    if (!this.load()) {
      this.initDefaultCollections();
      this.persist();
    }
  }

  // --- Durability ---

  /**
   * Hydrates from the store. Returns false only when there is genuinely
   * nothing stored yet.
   *
   * A store that exists but cannot be read throws. This is deliberate and it
   * matters more than it looks: the constructor writes a fresh empty index
   * whenever `load` reports "nothing here", so swallowing a read error would
   * turn one unreadable byte into permanent, silent data loss. An unreadable
   * vault must reach the user as a failure they can act on.
   */
  private load(): boolean {
    const stored = this.store.readIndex();
    if (!stored || stored.length === 0) return false;

    let index: VaultIndex;
    try {
      index = JSON.parse(new TextDecoder().decode(stored)) as VaultIndex;
    } catch (error) {
      throw new Error(
        "The vault index is present but could not be parsed, so Keeptrail will not " +
          "overwrite it with an empty one. " +
          (error instanceof Error ? error.message : String(error)),
      );
    }

    if (!index || typeof index.version !== "number") {
      throw new Error(
        "The vault index is present but does not carry a recognisable version, so " +
          "Keeptrail will not overwrite it.",
      );
    }
    // A newer index than this build understands is left strictly alone: opening
    // it read-write would drop whatever fields this version does not know.
    if (index.version > VAULT_INDEX_VERSION) {
      throw new Error(
        `This vault was written by a newer version of Keeptrail (format v${index.version}). ` +
          "Update the app rather than opening it with this build.",
      );
    }
    if (index.version < OLDEST_SUPPORTED_INDEX_VERSION) {
      throw new Error(
        `This vault uses format v${index.version}, which this build can no longer read. ` +
          "Restore from a backup archive rather than starting over.",
      );
    }

    this.suspendPersist = true;
    try {
      for (const c of index.collections ?? []) this.collections.set(c.id, c);
      for (const r of index.receipts ?? []) {
        // v1 records predate tags and custom fields.
        this.receipts.set(r.id, {
          ...r,
          tags: r.tags ?? [],
          custom_fields: r.custom_fields ?? {},
        });
      }
      for (const a of index.attachments ?? []) this.attachments.set(a.id, a);
      for (const act of index.actions ?? []) this.actions.set(act.id, act);
      for (const def of index.custom_field_definitions ?? []) {
        this.customFields.set(def.id, def);
      }
      for (const draft of index.drafts ?? []) this.drafts.set(draft.id, draft);
      this.lastBackupTimestamp = index.last_backup_timestamp ?? null;
      this.recordsModifiedSinceBackup = index.records_modified_since_backup ?? 0;
    } finally {
      this.suspendPersist = false;
    }

    // Write the upgraded shape back so the migration happens once, not on
    // every launch.
    const migrated = index.version < VAULT_INDEX_VERSION;

    // Collections shipped in a later version are added without disturbing
    // anything the user already has.
    let addedDefaults = false;
    for (const c of DEFAULT_COLLECTIONS) {
      if (!this.collections.has(c.id)) {
        this.collections.set(c.id, c);
        addedDefaults = true;
      }
    }
    if (addedDefaults || migrated) this.persist();

    return true;
  }

  private toIndex(): VaultIndex {
    return {
      version: VAULT_INDEX_VERSION,
      receipts: Array.from(this.receipts.values()),
      attachments: Array.from(this.attachments.values()),
      collections: Array.from(this.collections.values()),
      actions: Array.from(this.actions.values()),
      custom_field_definitions: Array.from(this.customFields.values()),
      drafts: Array.from(this.drafts.values()),
      last_backup_timestamp: this.lastBackupTimestamp,
      records_modified_since_backup: this.recordsModifiedSinceBackup,
    };
  }

  private persist(): void {
    if (this.suspendPersist) return;
    this.store.writeIndex(new TextEncoder().encode(JSON.stringify(this.toIndex())));
  }

  /** Records a change and writes the index through to the store. */
  private commit(): void {
    this.recordsModifiedSinceBackup++;
    this.persist();
  }

  private initDefaultCollections() {
    for (const c of DEFAULT_COLLECTIONS) {
      this.collections.set(c.id, c);
    }
  }

  // --- Receipts CRUD ---

  public saveReceipt(
    receipt: Omit<ReceiptRecord, "created_at" | "updated_at" | "custom_fields"> & {
      created_at?: string;
      updated_at?: string;
      custom_fields?: Record<string, string>;
    },
  ): ReceiptRecord {
    const now = new Date().toISOString();
    const existing = this.receipts.get(receipt.id);

    const record: ReceiptRecord = {
      ...receipt,
      // Omitting custom fields preserves what is already stored, so saving from
      // a screen that has no custom-field UI cannot silently wipe them. Passing
      // an explicit object replaces them.
      custom_fields: receipt.custom_fields ?? existing?.custom_fields ?? {},
      created_at: existing ? existing.created_at : receipt.created_at || now,
      updated_at: now,
    };

    this.receipts.set(record.id, record);
    this.commit();
    return record;
  }

  public getReceipt(id: string): ReceiptRecord | null {
    return this.receipts.get(id) || null;
  }

  public listReceipts(filter?: ReceiptFilter): ReceiptRecord[] {
    let list = Array.from(this.receipts.values());

    const scope = filter?.trashScope ?? "active";
    if (scope === "active") {
      list = list.filter((r) => !r.is_trashed);
    } else if (scope === "trashed") {
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
        (r) => r.total_minor_units !== null && r.total_minor_units >= filter.minAmountMinorUnits!,
      );
    }

    if (filter?.maxAmountMinorUnits !== undefined) {
      list = list.filter(
        (r) => r.total_minor_units !== null && r.total_minor_units <= filter.maxAmountMinorUnits!,
      );
    }

    if (filter?.searchQuery && filter.searchQuery.trim()) {
      const q = filter.searchQuery.trim().toLowerCase();
      const ocrByReceipt = this.buildOcrTextIndex();
      list = list.filter((r) => {
        const haystack = [
          r.merchant || "",
          r.title || "",
          r.notes || "",
          r.purpose || "",
          r.tags.join(" "),
          // Scanned text is searchable too: onboarding promises the user can
          // find a receipt by an item printed on it, not only by its title.
          ocrByReceipt.get(r.id) || "",
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(q);
      });
    }

    // Sort latest first
    return list.sort((a, b) => {
      const dateA = a.transaction_date || a.created_at;
      const dateB = b.transaction_date || b.created_at;
      return dateB.localeCompare(dateA);
    });
  }

  private buildOcrTextIndex(): Map<string, string> {
    const index = new Map<string, string>();
    for (const att of this.attachments.values()) {
      if (!att.ocr_text) continue;
      const existing = index.get(att.receipt_id);
      index.set(att.receipt_id, existing ? `${existing} ${att.ocr_text}` : att.ocr_text);
    }
    return index;
  }

  public moveToTrash(id: string): boolean {
    const record = this.receipts.get(id);
    if (!record) return false;
    record.is_trashed = true;
    record.deleted_at = new Date().toISOString();
    record.updated_at = new Date().toISOString();
    this.commit();
    return true;
  }

  public restoreFromTrash(id: string): boolean {
    const record = this.receipts.get(id);
    if (!record) return false;
    record.is_trashed = false;
    record.deleted_at = null;
    record.updated_at = new Date().toISOString();
    this.commit();
    return true;
  }

  public permanentlyDeleteReceipt(id: string): boolean {
    const record = this.receipts.get(id);
    if (!record) return false;

    // Delete associated attachments & files
    const atts = this.getAttachmentsForReceipt(id);
    for (const a of atts) {
      this.store.deleteAttachment(a.relative_path);
      this.attachments.delete(a.id);
    }

    // Delete associated actions
    for (const [actionId, act] of this.actions.entries()) {
      if (act.receipt_id === id) {
        this.actions.delete(actionId);
      }
    }

    this.receipts.delete(id);
    this.commit();
    return true;
  }

  public emptyTrash(): number {
    const trashed = Array.from(this.receipts.values()).filter((r) => r.is_trashed);
    this.suspendPersist = true;
    try {
      for (const r of trashed) {
        this.permanentlyDeleteReceipt(r.id);
      }
    } finally {
      this.suspendPersist = false;
    }
    this.persist();
    return trashed.length;
  }

  // --- Attachments & Durable File Operations ---

  public saveAttachment(attachment: AttachmentRecord, fileBytes?: Uint8Array): void {
    // Evidence is written before the record that points at it, so a crash
    // between the two leaves an orphan file rather than a record referencing
    // a file that was never stored.
    if (fileBytes) {
      this.store.writeAttachment(attachment.relative_path, fileBytes);
    }
    this.attachments.set(attachment.id, attachment);
    this.commit();
  }

  /**
   * Writes an evidence file that no record points at yet.
   *
   * Used while capturing: the original is durable before the user has finished
   * typing, so a process death leaves a file the recovered draft still refers
   * to. `discardDraft` cleans it up if the capture is abandoned.
   */
  public stageFile(relativePath: string, bytes: Uint8Array): void {
    this.store.writeAttachment(relativePath, bytes);
  }

  public getAttachmentsForReceipt(receiptId: string): AttachmentRecord[] {
    return Array.from(this.attachments.values())
      .filter((a) => a.receipt_id === receiptId)
      .sort((a, b) => a.page_order - b.page_order);
  }

  public getFileBytes(relativePath: string): Uint8Array | null {
    return this.store.readAttachment(relativePath);
  }

  /**
   * Reports attachment records whose backing file is missing, and files on disk
   * that no record claims. Both are recoverable states rather than crashes, so
   * the UI can report them honestly instead of pretending the vault is intact.
   */
  public reconcileAttachments(): {
    missingFiles: AttachmentRecord[];
    orphanedFiles: string[];
  } {
    const referenced = new Set<string>();
    const missingFiles: AttachmentRecord[] = [];

    for (const att of this.attachments.values()) {
      referenced.add(att.relative_path);
      if (this.store.readAttachment(att.relative_path) === null) {
        missingFiles.push(att);
      }
    }

    const orphanedFiles = this.store.listAttachmentPaths().filter((path) => !referenced.has(path));

    return { missingFiles, orphanedFiles };
  }

  // --- Collections CRUD ---

  public saveCollection(collection: CollectionRecord): void {
    this.collections.set(collection.id, collection);
    this.commit();
  }

  public listCollections(): CollectionRecord[] {
    return Array.from(this.collections.values());
  }

  public getCollection(id: string): CollectionRecord | null {
    return this.collections.get(id) ?? null;
  }

  public deleteCollection(id: string): boolean {
    // Remove collection ID from receipts
    for (const r of this.receipts.values()) {
      if (r.collection_ids.includes(id)) {
        r.collection_ids = r.collection_ids.filter((cId) => cId !== id);
      }
    }
    const res = this.collections.delete(id);
    if (res) this.commit();
    return res;
  }

  /** Replaces a receipt's collection membership. */
  public setReceiptCollections(receiptId: string, collectionIds: string[]): boolean {
    const record = this.receipts.get(receiptId);
    if (!record) return false;
    const known = collectionIds.filter((id) => this.collections.has(id));
    record.collection_ids = known;
    record.updated_at = new Date().toISOString();
    this.commit();
    return true;
  }

  // --- Tags ---

  /** Every tag in use, with how many active receipts carry it. */
  public listTags(): { tag: string; count: number }[] {
    const counts = new Map<string, number>();
    for (const receipt of this.receipts.values()) {
      if (receipt.is_trashed) continue;
      for (const tag of receipt.tags) {
        const key = tag.trim();
        if (!key) continue;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
  }

  public setReceiptTags(receiptId: string, tags: string[]): boolean {
    const record = this.receipts.get(receiptId);
    if (!record) return false;
    // Trimmed, de-duplicated case-insensitively, first spelling wins.
    const seen = new Set<string>();
    const cleaned: string[] = [];
    for (const raw of tags) {
      const tag = raw.trim();
      if (!tag) continue;
      const key = tag.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      cleaned.push(tag);
    }
    record.tags = cleaned;
    record.updated_at = new Date().toISOString();
    this.commit();
    return true;
  }

  // --- Custom fields ---

  public listCustomFieldDefinitions(): CustomFieldDefinition[] {
    return Array.from(this.customFields.values()).sort((a, b) =>
      a.created_at.localeCompare(b.created_at),
    );
  }

  public saveCustomFieldDefinition(definition: CustomFieldDefinition): void {
    this.customFields.set(definition.id, definition);
    this.commit();
  }

  /** Removes a definition and every stored value for it. */
  public deleteCustomFieldDefinition(id: string): boolean {
    if (!this.customFields.delete(id)) return false;
    for (const receipt of this.receipts.values()) {
      if (id in receipt.custom_fields) {
        const remaining: Record<string, string> = {};
        for (const [fieldId, value] of Object.entries(receipt.custom_fields)) {
          if (fieldId !== id) remaining[fieldId] = value;
        }
        receipt.custom_fields = remaining;
      }
    }
    this.commit();
    return true;
  }

  public setReceiptCustomFields(receiptId: string, values: Record<string, string>): boolean {
    const record = this.receipts.get(receiptId);
    if (!record) return false;
    const kept: Record<string, string> = {};
    for (const [fieldId, value] of Object.entries(values)) {
      // A value for a definition that no longer exists is dropped rather than
      // kept as an orphan the UI can never show.
      if (!this.customFields.has(fieldId)) continue;
      const trimmed = value.trim();
      if (trimmed) kept[fieldId] = trimmed;
    }
    record.custom_fields = kept;
    record.updated_at = new Date().toISOString();
    this.commit();
    return true;
  }

  // --- Capture drafts ---

  /**
   * Persists an in-progress capture. Called as the user types, so a process
   * death mid-capture does not lose the work or the original already written.
   */
  public saveDraft(draft: CaptureDraft): void {
    this.drafts.set(draft.id, { ...draft, updated_at: new Date().toISOString() });
    this.persist();
  }

  public listDrafts(): CaptureDraft[] {
    return Array.from(this.drafts.values()).sort((a, b) =>
      b.updated_at.localeCompare(a.updated_at),
    );
  }

  public getDraft(id: string): CaptureDraft | null {
    return this.drafts.get(id) ?? null;
  }

  /**
   * Discards a draft. `keepAttachment` is false when the user abandons the
   * capture, so the orphaned original is cleaned up with it.
   */
  public discardDraft(id: string, keepAttachment: boolean): boolean {
    const draft = this.drafts.get(id);
    if (!draft) return false;
    if (!keepAttachment && draft.attachment_relative_path) {
      this.store.deleteAttachment(draft.attachment_relative_path);
    }
    this.drafts.delete(id);
    this.persist();
    return true;
  }

  // --- Duplicate suggestions ---

  private attachmentsByReceipt(): Map<string, AttachmentRecord[]> {
    const index = new Map<string, AttachmentRecord[]>();
    for (const attachment of this.attachments.values()) {
      const list = index.get(attachment.receipt_id);
      if (list) list.push(attachment);
      else index.set(attachment.receipt_id, [attachment]);
    }
    return index;
  }

  /** Possible duplicates of one receipt. Suggestions only; nothing is deleted. */
  public findDuplicatesOf(receiptId: string): DuplicateSuggestion[] {
    const receipt = this.receipts.get(receiptId);
    if (!receipt) return [];
    return findDuplicateSuggestions(
      receipt,
      Array.from(this.receipts.values()),
      this.attachmentsByReceipt(),
    );
  }

  /** Every duplicate pair in the vault, strongest evidence first. */
  public findAllDuplicates(): DuplicateSuggestion[] {
    return findAllDuplicateSuggestions(
      Array.from(this.receipts.values()),
      this.attachmentsByReceipt(),
    );
  }

  // --- Actions & Deadlines ---

  public saveAction(action: ActionRecord): void {
    this.actions.set(action.id, action);
    this.commit();
  }

  public listActions(receiptId?: string): ActionRecord[] {
    let list = Array.from(this.actions.values());
    if (receiptId) {
      list = list.filter((a) => a.receipt_id === receiptId);
    }
    return list.sort((a, b) => a.due_date.localeCompare(b.due_date));
  }

  public deleteAction(id: string): boolean {
    const removed = this.actions.delete(id);
    if (removed) this.commit();
    return removed;
  }

  public updateActionStatus(id: string, status: ActionRecord["status"]): boolean {
    const act = this.actions.get(id);
    if (!act) return false;
    act.status = status;
    act.updated_at = new Date().toISOString();
    this.commit();
    return true;
  }

  // --- Storage Usage & Backup Bookkeeping ---

  public getStorageUsageStats(): StorageUsageStats {
    const allReceipts = Array.from(this.receipts.values());

    let totalAttachmentBytes = 0;
    for (const att of this.attachments.values()) {
      totalAttachmentBytes += this.store.attachmentSize(att.relative_path);
    }

    const indexBytes = JSON.stringify(this.toIndex()).length;

    return {
      receiptCount: allReceipts.filter((r) => !r.is_trashed).length,
      unreviewedCount: allReceipts.filter((r) => !r.is_trashed && r.review_status === "unreviewed")
        .length,
      trashedCount: allReceipts.filter((r) => r.is_trashed).length,
      attachmentCount: this.attachments.size,
      totalAttachmentBytes,
      indexBytes,
      lastBackupTimestamp: this.lastBackupTimestamp,
      recordsModifiedSinceLastBackup: this.recordsModifiedSinceBackup,
    };
  }

  public markBackupCompleted(): void {
    this.lastBackupTimestamp = new Date().toISOString();
    this.recordsModifiedSinceBackup = 0;
    this.persist();
  }

  // --- Export / Import Packaging ---

  public getBackupPayload(): EncryptBackupOptions {
    const filesRecord: Record<string, Uint8Array> = {};
    for (const att of this.attachments.values()) {
      const bytes = this.store.readAttachment(att.relative_path);
      if (bytes) filesRecord[att.relative_path] = bytes;
    }

    return {
      receipts: Array.from(this.receipts.values()),
      attachments: Array.from(this.attachments.values()),
      collections: Array.from(this.collections.values()),
      actions: Array.from(this.actions.values()),
      custom_field_definitions: Array.from(this.customFields.values()),
      files: filesRecord,
    };
  }

  public restoreFromPayload(
    payload: EncryptBackupOptions,
    mode: "overwrite" | "merge" = "overwrite",
  ): void {
    this.suspendPersist = true;
    try {
      if (mode === "overwrite") {
        for (const path of this.store.listAttachmentPaths()) {
          this.store.deleteAttachment(path);
        }
        this.receipts.clear();
        this.attachments.clear();
        this.collections.clear();
        this.actions.clear();
        this.customFields.clear();
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
      for (const def of payload.custom_field_definitions ?? []) {
        this.customFields.set(def.id, def);
      }
      for (const [path, bytes] of Object.entries(payload.files)) {
        this.store.writeAttachment(path, bytes);
      }

      // A restored archive may predate a collection the current build ships.
      for (const c of DEFAULT_COLLECTIONS) {
        if (!this.collections.has(c.id)) this.collections.set(c.id, c);
      }
    } finally {
      this.suspendPersist = false;
    }

    this.markBackupCompleted();
  }
}
