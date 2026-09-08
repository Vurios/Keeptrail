/**
 * Wraps a raw vault store so everything at rest is encrypted.
 *
 * The record index and every original document are sealed with the device key
 * before they touch the filesystem. App-private storage already keeps other
 * apps out; this protects against a rooted device, an ADB pull, or physical
 * extraction of the flash.
 *
 * Both the index and the originals travel as bytes. An earlier version
 * base64-encoded the sealed index into a text file, which round-tripped
 * perfectly in memory and produced an unreadable vault on device — the encoding
 * layer existed only because the store contract used to be a string, and
 * deleting it removed the whole class of bug.
 *
 * Two behaviours matter more than the encryption itself:
 *
 * - **Unreadable is not empty.** If a sealed blob cannot be opened, this
 *   throws. Returning null would present an empty vault to a user whose records
 *   are intact but locked, and would then let a save overwrite them.
 * - **Old plaintext is migrated, not rejected.** A vault written before
 *   encryption shipped still opens, and is rewritten sealed on the next write.
 */

import { isSealed, openBytes, sealBytes, type VaultStore } from "@katibay/shared";

export class EncryptedVaultStore implements VaultStore {
  constructor(
    private readonly inner: VaultStore,
    private readonly key: Uint8Array,
  ) {}

  readIndex(): Uint8Array | null {
    const stored = this.inner.readIndex();
    if (stored === null || stored.length === 0) return null;
    // Written before at-rest encryption shipped: readable, and upgraded to a
    // sealed form on the next write rather than discarded.
    if (!isSealed(stored)) return stored;
    return openBytes(this.key, stored);
  }

  writeIndex(serialized: Uint8Array): void {
    this.inner.writeIndex(sealBytes(this.key, serialized));
  }

  readAttachment(relativePath: string): Uint8Array | null {
    const stored = this.inner.readAttachment(relativePath);
    if (stored === null) return null;
    if (!isSealed(stored)) return stored;
    return openBytes(this.key, stored);
  }

  writeAttachment(relativePath: string, bytes: Uint8Array): void {
    this.inner.writeAttachment(relativePath, sealBytes(this.key, bytes));
  }

  deleteAttachment(relativePath: string): void {
    this.inner.deleteAttachment(relativePath);
  }

  attachmentSize(relativePath: string): number {
    // The on-disk size, which is what the storage screen should report.
    return this.inner.attachmentSize(relativePath);
  }

  listAttachmentPaths(): string[] {
    return this.inner.listAttachmentPaths();
  }
}
