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
 * 2. A write must not be able to leave the vault unreadable. An implementation
 *    either writes atomically or keeps the previous good copy until the new one
 *    has been read back successfully.
 *
 * The index is exchanged as bytes rather than text. It used to be a string,
 * which meant an encrypting implementation had to base64 its ciphertext into
 * a text file; that round trip corrupted the index on device while passing
 * every in-memory test. Bytes in, bytes out, no encoding layer to get wrong.
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
  readIndex(): Uint8Array | null;
  /** Persists the index durably, without risking the previous copy. */
  writeIndex(serialized: Uint8Array): void;

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
  private index: Uint8Array | null = null;
  private files = new Map<string, Uint8Array>();

  readIndex(): Uint8Array | null {
    return this.index;
  }

  writeIndex(serialized: Uint8Array): void {
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
