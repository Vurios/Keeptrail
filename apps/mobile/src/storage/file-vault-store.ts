/**
 * Durable vault storage backed by app-private files.
 *
 * Everything lives under the document directory, which Android does not
 * reclaim under storage pressure the way it reclaims the cache directory. The
 * guide (S0) is explicit that the cache directory is for rebuildable data only,
 * so nothing authoritative is written there.
 *
 * Layout:
 *   <documents>/keeptrail/vault.json              record index
 *   <documents>/keeptrail/vault.json.tmp          staging file, never read
 *   <documents>/keeptrail/originals/<yyyy>/<mm>/  evidence files
 */

import { Directory, File, Paths } from "expo-file-system";
import { Buffer } from "buffer";
import type { VaultStore } from "@katibay/shared";

const ROOT_DIR_NAME = "keeptrail";
const INDEX_FILE_NAME = "vault.json";
const STAGING_FILE_NAME = "vault.json.tmp";
const ATTACHMENTS_DIR_NAME = "originals";

function ensureDirectory(directory: Directory): void {
  if (!directory.exists) {
    directory.create({ intermediates: true, idempotent: true });
  }
}

export class FileVaultStore implements VaultStore {
  private readonly root: Directory;
  private readonly attachmentsRoot: Directory;

  constructor() {
    this.root = new Directory(Paths.document, ROOT_DIR_NAME);
    ensureDirectory(this.root);
    this.attachmentsRoot = new Directory(this.root, ATTACHMENTS_DIR_NAME);
    ensureDirectory(this.attachmentsRoot);
  }

  /** Absolute location of the vault, for display in storage settings. */
  get location(): string {
    return this.root.uri;
  }

  private get indexFile(): File {
    return new File(this.root, INDEX_FILE_NAME);
  }

  private attachmentFile(relativePath: string): File {
    // Paths come from `buildAttachmentPath`, but a restored archive is
    // untrusted input, so traversal segments are rejected rather than joined.
    const segments = relativePath.split("/").filter(Boolean);
    if (segments.some((segment) => segment === "." || segment === "..")) {
      throw new Error(`Refusing unsafe attachment path: ${relativePath}`);
    }
    return new File(this.root, ...segments);
  }

  readIndex(): string | null {
    const file = this.indexFile;
    if (!file.exists) return null;
    return file.textSync();
  }

  writeIndex(serialized: string): void {
    // Staged write: a crash mid-write destroys only the staging file, leaving
    // the previous good index in place.
    const staging = new File(this.root, STAGING_FILE_NAME);
    staging.create({ overwrite: true });
    staging.write(serialized);

    const target = this.indexFile;
    if (target.exists) target.delete();
    staging.moveSync(target);
  }

  readAttachment(relativePath: string): Uint8Array | null {
    const file = this.attachmentFile(relativePath);
    if (!file.exists) return null;
    return file.bytesSync();
  }

  writeAttachment(relativePath: string, bytes: Uint8Array): void {
    const file = this.attachmentFile(relativePath);
    file.create({ intermediates: true, overwrite: true });
    file.write(bytes);
  }

  deleteAttachment(relativePath: string): void {
    const file = this.attachmentFile(relativePath);
    if (file.exists) file.delete();
  }

  attachmentSize(relativePath: string): number {
    const file = this.attachmentFile(relativePath);
    return file.exists ? file.size : 0;
  }

  listAttachmentPaths(): string[] {
    const paths: string[] = [];
    const rootPrefix = `${this.root.uri.replace(/\/$/, "")}/`;

    const walk = (directory: Directory) => {
      if (!directory.exists) return;
      for (const entry of directory.list()) {
        if (entry instanceof Directory) {
          walk(entry);
        } else {
          paths.push(decodeURIComponent(entry.uri.replace(rootPrefix, "")));
        }
      }
    };

    walk(this.attachmentsRoot);
    return paths;
  }

  /**
   * Writes an exported archive next to the vault so the user has a real file
   * they can copy off the phone, and returns where it landed. Bytes are
   * base64-encoded on the way in because `write` takes text or bytes and the
   * archive is binary.
   */
  writeBackupArchive(fileName: string, bytes: Uint8Array): string {
    const backupsDir = new Directory(this.root, "backups");
    ensureDirectory(backupsDir);
    const file = new File(backupsDir, fileName);
    file.create({ overwrite: true });
    file.write(bytes);
    return file.uri;
  }

  listBackupArchives(): { name: string; uri: string; sizeBytes: number }[] {
    const backupsDir = new Directory(this.root, "backups");
    if (!backupsDir.exists) return [];
    return backupsDir
      .list()
      .filter((entry): entry is File => entry instanceof File)
      .map((file) => ({
        name: file.name,
        uri: file.uri,
        sizeBytes: file.size,
      }))
      .sort((a, b) => b.name.localeCompare(a.name));
  }

  readBackupArchive(uri: string): Uint8Array {
    return new File(uri).bytesSync();
  }

  deleteBackupArchive(uri: string): void {
    const file = new File(uri);
    if (file.exists) file.delete();
  }

  /** Total bytes held under the vault root, including index and backups. */
  totalBytes(): number {
    return this.root.size ?? 0;
  }
}

/** Base64 helper kept here so screens never touch Buffer directly. */
export function bytesToBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}
