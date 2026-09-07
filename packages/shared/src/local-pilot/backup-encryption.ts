/**
 * Keeptrail Encrypted Backup & Restore Engine
 *
 * Container Format: .keeptrail (version: keeptrail.v1)
 * Cryptography:
 * - PBKDF2 (SHA-256, 100,000 iterations) with 16-byte random salt
 * - AES-256-GCM authenticated encryption with 12-byte random IV (nonce) and 16-byte auth tag
 *
 * Payload Structure:
 * [MAGIC 8 bytes "KEEPTRAIL"]
 * [VERSION 2 bytes (0x00, 0x01)]
 * [SALT 16 bytes]
 * [IV 12 bytes]
 * [AUTH_TAG 16 bytes]
 * [ENCRYPTED_CIPHERTEXT (JSON stringified container of manifest, records, and base64 files)]
 */

import { randomBytes, pbkdf2Sync, createCipheriv, createDecipheriv, createHash } from "crypto";
import { Buffer } from "buffer";
import type {
  BackupArchiveContent,
  BackupManifest,
  ReceiptRecord,
  AttachmentRecord,
  CollectionRecord,
  ActionRecord,
} from "./types";

const MAGIC_HEADER = "KEEPTRAIL"; // 9 ASCII characters
const FORMAT_VERSION_MAJOR = 1;
const FORMAT_VERSION_MINOR = 0;
const PBKDF2_ITERATIONS = 100000;
const KEY_LENGTH_BYTES = 32; // AES-256
const SALT_LENGTH_BYTES = 16;
const IV_LENGTH_BYTES = 12; // Standard GCM IV length
const AUTH_TAG_LENGTH_BYTES = 16;

export interface EncryptBackupOptions {
  receipts: ReceiptRecord[];
  attachments: AttachmentRecord[];
  collections: CollectionRecord[];
  actions: ActionRecord[];
  files: Record<string, Uint8Array>; // relative_path -> Uint8Array
  appVersion?: string;
}

/**
 * Compute SHA-256 hex digest of a byte buffer
 */
export function computeSha256(data: Uint8Array): string {
  return createHash("sha256").update(data).digest("hex");
}

/**
 * Package and encrypt receipt vault into a .keeptrail binary buffer
 */
export function createEncryptedBackup(data: EncryptBackupOptions, password: string): Uint8Array {
  if (!password || password.length < 4) {
    throw new Error("Backup password must be at least 4 characters.");
  }

  // 1. Build Manifest with SHA-256 hashes
  const attachmentsMeta: BackupManifest["attachments_meta"] = [];

  for (const att of data.attachments) {
    const fileBytes = data.files[att.relative_path];
    const actualHash = fileBytes ? computeSha256(fileBytes) : att.sha256_hash;
    const actualSize = fileBytes ? fileBytes.length : att.file_size_bytes;

    attachmentsMeta.push({
      id: att.id,
      receipt_id: att.receipt_id,
      relative_path: att.relative_path,
      file_size_bytes: actualSize,
      sha256_hash: actualHash,
    });
  }

  const manifest: BackupManifest = {
    format_version: "keeptrail.v1",
    export_id: `bck_${Date.now()}_${randomBytes(4).toString("hex")}`,
    created_at: new Date().toISOString(),
    app_version: data.appVersion || "1.0.0-pilot",
    receipt_count: data.receipts.length,
    attachment_count: data.attachments.length,
    collection_count: data.collections.length,
    action_count: data.actions.length,
    attachments_meta: attachmentsMeta,
  };

  // Convert binary files to base64 for JSON packaging
  const filesBase64: Record<string, string> = {};
  for (const [relPath, bytes] of Object.entries(data.files)) {
    filesBase64[relPath] = Buffer.from(bytes).toString("base64");
  }

  const payloadObject = {
    manifest,
    receipts: data.receipts,
    attachments: data.attachments,
    collections: data.collections,
    actions: data.actions,
    files: filesBase64,
  };

  const plaintextJson = JSON.stringify(payloadObject);
  const plaintextBuffer = Buffer.from(plaintextJson, "utf8");

  // 2. Key Derivation & AES-256-GCM Encryption
  const salt = randomBytes(SALT_LENGTH_BYTES);
  const key = pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, KEY_LENGTH_BYTES, "sha256");
  const iv = randomBytes(IV_LENGTH_BYTES);

  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintextBuffer), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // 3. Assemble Header and Container
  const magicBuffer = Buffer.from(MAGIC_HEADER, "ascii");
  const versionBuffer = Buffer.from([FORMAT_VERSION_MAJOR, FORMAT_VERSION_MINOR]);

  const outputBuffer = Buffer.concat([magicBuffer, versionBuffer, salt, iv, authTag, ciphertext]);

  return new Uint8Array(outputBuffer);
}

/**
 * Decrypt and validate a .keeptrail backup archive
 */
export function restoreEncryptedBackup(
  archiveBuffer: Uint8Array,
  password: string,
): BackupArchiveContent {
  const buf = Buffer.from(archiveBuffer);

  // 1. Validate Header
  const magicLen = MAGIC_HEADER.length;
  if (buf.length < magicLen + 2 + SALT_LENGTH_BYTES + IV_LENGTH_BYTES + AUTH_TAG_LENGTH_BYTES) {
    throw new Error("Invalid or truncated .keeptrail backup file.");
  }

  const magic = buf.subarray(0, magicLen).toString("ascii");
  if (magic !== MAGIC_HEADER) {
    throw new Error("File is not a valid Keeptrail backup archive.");
  }

  let offset = magicLen;
  const majorVersion = buf[offset++];
  const minorVersion = buf[offset++];

  if (majorVersion !== FORMAT_VERSION_MAJOR) {
    throw new Error(
      `Unsupported backup archive version v${majorVersion}.${minorVersion}. Current app supports v${FORMAT_VERSION_MAJOR}.x.`,
    );
  }

  const salt = buf.subarray(offset, offset + SALT_LENGTH_BYTES);
  offset += SALT_LENGTH_BYTES;

  const iv = buf.subarray(offset, offset + IV_LENGTH_BYTES);
  offset += IV_LENGTH_BYTES;

  const authTag = buf.subarray(offset, offset + AUTH_TAG_LENGTH_BYTES);
  offset += AUTH_TAG_LENGTH_BYTES;

  const ciphertext = buf.subarray(offset);

  // 2. Key Derivation & AES-GCM Decryption
  const key = pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, KEY_LENGTH_BYTES, "sha256");

  let plaintextBuffer: Buffer;
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);
    plaintextBuffer = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } catch {
    throw new Error("Decryption failed: Incorrect password or corrupted backup file.");
  }

  // 3. Parse and Validate Decrypted JSON Content
  let payload: {
    manifest: BackupManifest;
    receipts: ReceiptRecord[];
    attachments: AttachmentRecord[];
    collections: CollectionRecord[];
    actions: ActionRecord[];
    files: Record<string, string>;
  };

  try {
    payload = JSON.parse(plaintextBuffer.toString("utf8"));
  } catch {
    throw new Error("Corrupted backup payload: Malformed JSON data.");
  }

  // 4. Manifest Integrity Validation
  if (!payload.manifest || payload.manifest.format_version !== "keeptrail.v1") {
    throw new Error("Invalid or missing manifest in backup archive.");
  }

  // Decode binary files and verify SHA-256 hashes
  const restoredFiles: Record<string, Uint8Array> = {};
  for (const meta of payload.manifest.attachments_meta) {
    const b64 = payload.files[meta.relative_path];
    if (!b64) {
      throw new Error(
        `Backup archive is incomplete: Missing attachment file "${meta.relative_path}".`,
      );
    }

    const fileBytes = new Uint8Array(Buffer.from(b64, "base64"));
    const actualHash = computeSha256(fileBytes);

    if (actualHash !== meta.sha256_hash) {
      throw new Error(
        `Integrity check failed: Attachment "${meta.relative_path}" checksum does not match manifest.`,
      );
    }

    restoredFiles[meta.relative_path] = fileBytes;
  }

  return {
    manifest: payload.manifest,
    receipts: payload.receipts || [],
    attachments: payload.attachments || [],
    collections: payload.collections || [],
    actions: payload.actions || [],
    files: restoredFiles,
  };
}
