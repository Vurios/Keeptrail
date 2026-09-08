/**
 * At-rest encryption for the vault itself.
 *
 * The backup archive was already encrypted; the records and originals sitting
 * on the device were not. App-private storage keeps other apps out, but it does
 * not protect a rooted phone, an ADB backup, or a physical extraction — and the
 * guide (S1) asks for the local database and private originals to be encrypted
 * with the key held by the platform.
 *
 * Format, per sealed blob:
 *   [MAGIC 4 bytes "KTS1"]
 *   [VERSION 1 byte]
 *   [IV 12 bytes]
 *   [AUTH TAG 16 bytes]
 *   [CIPHERTEXT ...]
 *
 * The key is 32 random bytes generated once per installation and held by the
 * platform keystore. It never appears in this module's inputs as a password and
 * is never derived from one: this is device-bound protection, distinct from the
 * password-derived key that protects an exported archive.
 */

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { Buffer } from "buffer";

const MAGIC = "KTS1";
const VERSION = 1;
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const HEADER_LENGTH = MAGIC.length + 1 + IV_LENGTH + TAG_LENGTH;

export const VAULT_KEY_LENGTH_BYTES = 32;

/**
 * Compares bytes against an ASCII marker without going through `toString`.
 *
 * `buffer.subarray(...).toString("ascii")` is not portable: Node returns a
 * Buffer from `subarray`, so it decodes as text, while the `buffer` polyfill
 * that ships in the React Native bundle returns a plain Uint8Array, whose
 * `toString` yields "75,84,83,49" instead of "KTS1". The comparison then fails
 * on perfectly valid data — on device only, invisible to a Node test run.
 * Comparing byte values has no such ambiguity.
 */
export function bytesStartWithAscii(data: Uint8Array, marker: string): boolean {
  if (data.length < marker.length) return false;
  for (let i = 0; i < marker.length; i++) {
    if (data[i] !== marker.charCodeAt(i)) return false;
  }
  return true;
}

/** Generates a new device vault key. Callers must persist it in secure storage. */
export function generateVaultKey(): Uint8Array {
  return new Uint8Array(randomBytes(VAULT_KEY_LENGTH_BYTES));
}

function assertKey(key: Uint8Array): Buffer {
  if (key.length !== VAULT_KEY_LENGTH_BYTES) {
    throw new Error(`Vault key must be ${VAULT_KEY_LENGTH_BYTES} bytes, received ${key.length}.`);
  }
  return Buffer.from(key);
}

/** Encrypts arbitrary bytes under the device vault key. */
export function sealBytes(key: Uint8Array, plaintext: Uint8Array): Uint8Array {
  const keyBuffer = assertKey(key);
  const iv = randomBytes(IV_LENGTH);

  const cipher = createCipheriv("aes-256-gcm", keyBuffer, iv);
  const ciphertext = Buffer.concat([cipher.update(Buffer.from(plaintext)), cipher.final()]);
  const tag = cipher.getAuthTag();

  return new Uint8Array(
    Buffer.concat([Buffer.from(MAGIC, "ascii"), Buffer.from([VERSION]), iv, tag, ciphertext]),
  );
}

/**
 * Decrypts bytes produced by `sealBytes`.
 *
 * Throws on a wrong key, a truncated blob or any tampering. Callers must treat
 * a throw as "this data is unreadable", never as "this data is empty" — the
 * difference decides whether a user sees an error or silently loses records.
 */
export function openBytes(key: Uint8Array, sealed: Uint8Array): Uint8Array {
  const keyBuffer = assertKey(key);
  const buffer = Buffer.from(sealed);

  if (buffer.length < HEADER_LENGTH) {
    throw new Error("Encrypted vault data is truncated.");
  }
  if (!bytesStartWithAscii(sealed, MAGIC)) {
    throw new Error("Data is not an encrypted Keeptrail vault blob.");
  }

  const version = buffer[MAGIC.length];
  if (version !== VERSION) {
    throw new Error(`Unsupported encrypted vault format v${version}.`);
  }

  let offset = MAGIC.length + 1;
  const iv = buffer.subarray(offset, offset + IV_LENGTH);
  offset += IV_LENGTH;
  const tag = buffer.subarray(offset, offset + TAG_LENGTH);
  offset += TAG_LENGTH;
  const ciphertext = buffer.subarray(offset);

  const decipher = createDecipheriv("aes-256-gcm", keyBuffer, iv);
  decipher.setAuthTag(tag);

  try {
    return new Uint8Array(Buffer.concat([decipher.update(ciphertext), decipher.final()]));
  } catch {
    throw new Error(
      "The vault could not be decrypted with this device's key. The key may have been " +
        "invalidated, or the data may be damaged.",
    );
  }
}

/** Convenience wrappers for the record index, which is UTF-8 text. */
export function sealText(key: Uint8Array, text: string): Uint8Array {
  return sealBytes(key, new Uint8Array(Buffer.from(text, "utf8")));
}

export function openText(key: Uint8Array, sealed: Uint8Array): string {
  return Buffer.from(openBytes(key, sealed)).toString("utf8");
}

/** True when a blob carries the sealed-vault header. */
export function isSealed(data: Uint8Array): boolean {
  return bytesStartWithAscii(data, MAGIC);
}
