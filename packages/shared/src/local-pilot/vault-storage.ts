/**
 * Keeptrail Vault Storage Contract
 *
 * Separates *what* the vault stores from *where* it lands, so the domain layer
 * stays platform-free and testable while the phone writes to app-private
 * storage.
 *
 * Two rules the guide (S0) imposes on any implementation:
 *
 * 1. Records and evidence live apart. The record index is a small serialisable
 *    document; attachment bytes are individual durable files addressed by a
 *    stable relative path. Evidence never sits in the JavaScript heap once it
 *    has been written.
 * 2. Index writes are staged. `writeIndex` must not leave a partially written
 *    index behind if the process dies mid-write — write to a temporary path and
 *    swap it into place.
 */

import type {
  ActionRecord,
  AttachmentRecord,
  CaptureDraft,
  CollectionRecord,
  CustomFieldDefinition,
  ReceiptRecord,
} from "./types";

/**
 * Bumped when the on-disk index shape changes.
 *
 * v1 -> v2 added tags, custom field values, custom field definitions and
 * capture drafts. The migration is additive and runs when the vault loads, so
 * an index written by an older build opens without losing anything.
 */
export const VAULT_INDEX_VERSION = 2;
export const OLDEST_SUPPORTED_INDEX_VERSION = 1;

export interface VaultIndex {
  version: number;
  receipts: ReceiptRecord[];
  attachments: AttachmentRecord[];
  collections: CollectionRecord[];
  actions: ActionRecord[];
  custom_field_definitions: CustomFieldDefinition[];
  drafts: CaptureDraft[];
  last_backup_timestamp: string | null;
  records_modified_since_backup: number;
}

export interface VaultStore {
  /** Returns the serialised index, or null when the vault has never been written. */
  readIndex(): string | null;
  /** Persists the index durably. Must be crash-safe (stage, then swap). */
  writeIndex(serialized: string): void;

  readAttachment(relativePath: string): Uint8Array | null;
  writeAttachment(relativePath: string, bytes: Uint8Array): void;
  deleteAttachment(relativePath: string): void;
  /** Byte size on disk, or 0 when the file is missing. */
  attachmentSize(relativePath: string): number;
  /** Every attachment path the store currently holds. */
  listAttachmentPaths(): string[];
}

/**
 * Reference implementation used by tests and by any environment without a
 * filesystem. It is explicitly not durable, and says so.
 */
export class InMemoryVaultStore implements VaultStore {
  private index: string | null = null;
  private files = new Map<string, Uint8Array>();

  readIndex(): string | null {
    return this.index;
  }

  writeIndex(serialized: string): void {
    this.index = serialized;
  }

  readAttachment(relativePath: string): Uint8Array | null {
    return this.files.get(relativePath) ?? null;
  }

  writeAttachment(relativePath: string, bytes: Uint8Array): void {
    this.files.set(relativePath, bytes);
  }

  deleteAttachment(relativePath: string): void {
    this.files.delete(relativePath);
  }

  attachmentSize(relativePath: string): number {
    return this.files.get(relativePath)?.length ?? 0;
  }

  listAttachmentPaths(): string[] {
    return Array.from(this.files.keys());
  }
}

/**
 * Builds the relative path for a receipt's attachment, partitioned by the date
 * the record was created so a directory never accumulates unboundedly.
 */
export function buildAttachmentPath(
  receiptId: string,
  extension: string,
  createdAt: Date = new Date(),
): string {
  const year = createdAt.getUTCFullYear();
  const month = String(createdAt.getUTCMonth() + 1).padStart(2, "0");
  const safeExtension = extension.startsWith(".") ? extension : `.${extension}`;
  return `originals/${year}/${month}/${receiptId}${safeExtension}`;
}
