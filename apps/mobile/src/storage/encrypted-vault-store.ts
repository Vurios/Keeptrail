/**
 * Wraps a raw vault store so everything at rest is encrypted.
 *
 * The record index and every original document are sealed with the device key
 * before they touch the filesystem. App-private storage already keeps other
 * apps out; this protects against a rooted device, an ADB pull, or physical
 * extraction of the flash.
 *
 * Two behaviours matter more than the encryption itself:
 *
 * - **Unreadable is not empty.** If a sealed blob cannot be opened, the wrapper
 *   throws. Returning null would present an empty vault to a user whose records
 *   are intact but locked, and would then let a save overwrite them.
 * - **Old plaintext is migrated, not rejected.** A vault written before
 *   encryption shipped still opens, and is rewritten sealed on the next write.
 */

import {
  isSealed,
  openBytes,
  openText,
  sealBytes,
  sealText,
  type VaultStore,
} from "@katibay/shared";
import { Buffer } from "buffer";

export class EncryptedVaultStore implements VaultStore {
  constructor(
    private readonly inner: VaultStore,
    private readonly key: Uint8Array,
  ) {}

  readIndex(): string | null {
    const raw = this.inner.readIndex();
    if (raw === null) return null;

    // The raw store hands back text. A sealed index is base64 of the blob, so
    // that the file stays a text file the staged-write path can handle.
    if (!raw.startsWith(SEALED_TEXT_PREFIX)) {
      // Written before at-rest encryption shipped. Readable, and upgraded on
      // the next write rather than discarded.
      return raw;
    }

    const sealed = new Uint8Array(Buffer.from(raw.slice(SEALED_TEXT_PREFIX.length), "base64"));
    return openText(this.key, sealed);
  }

  writeIndex(serialized: string): void {
    const sealed = sealText(this.key, serialized);
    this.inner.writeIndex(SEALED_TEXT_PREFIX + Buffer.from(sealed).toString("base64"));
  }

  readAttachment(relativePath: string): Uint8Array | null {
    const stored = this.inner.readAttachment(relativePath);
    if (stored === null) return null;
    // Originals written before encryption shipped are returned as they are.
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

/**
 * Marks an index file as sealed. Present so a plaintext index from an earlier
 * build is distinguishable from ciphertext without trying to decrypt it first.
 */
const SEALED_TEXT_PREFIX = "keeptrail.sealed.v1:";
