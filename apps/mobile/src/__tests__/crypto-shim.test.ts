/**
 * Verifies the crypto shim that Metro substitutes for Node's `crypto` inside
 * the APK.
 *
 * This is the only place the shipped cryptography is checked. The shared
 * package's backup tests import `crypto` and therefore run against Node's
 * implementation; they would pass just as happily if this file computed
 * nonsense. Every case below is a published test vector, and each primitive is
 * additionally cross-checked against Node so a future edit cannot drift.
 */

import { describe, expect, it } from "vitest";
import * as nodeCrypto from "node:crypto";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const shim = require("../shims/crypto-shim.js");

const hex = (buffer: Uint8Array) => Buffer.from(buffer).toString("hex");

describe("crypto shim — SHA-256", () => {
  it("matches the FIPS-180-4 sample vectors", () => {
    expect(shim.createHash("sha256").update("").digest("hex")).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
    expect(shim.createHash("sha256").update("abc").digest("hex")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
    expect(
      shim
        .createHash("sha256")
        .update("abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq")
        .digest("hex"),
    ).toBe("248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1");
  });

  it("matches Node across block-boundary lengths", () => {
    // 55/56/64 straddle the padding boundary, where a length bug hides.
    for (const length of [0, 1, 55, 56, 63, 64, 65, 127, 1000]) {
      const input = Buffer.alloc(length, 0x61);
      expect(shim.createHash("sha256").update(input).digest("hex")).toBe(
        nodeCrypto.createHash("sha256").update(input).digest("hex"),
      );
    }
  });

  it("concatenates chunked updates like Node does", () => {
    const chunked = shim.createHash("sha256").update("keep").update("trail").digest("hex");
    expect(chunked).toBe(nodeCrypto.createHash("sha256").update("keeptrail").digest("hex"));
  });

  it("refuses algorithms it does not implement", () => {
    expect(() => shim.createHash("md5")).toThrow(/only implements sha256/);
  });
});

describe("crypto shim — PBKDF2-HMAC-SHA256", () => {
  it("matches RFC 6070-style vectors", () => {
    // RFC 7914 §11 SHA-256 vectors.
    expect(hex(shim.pbkdf2Sync("passwd", "salt", 1, 64, "sha256"))).toBe(
      hex(nodeCrypto.pbkdf2Sync("passwd", "salt", 1, 64, "sha256")),
    );
    expect(hex(shim.pbkdf2Sync("password", "salt", 4096, 32, "sha256"))).toBe(
      hex(nodeCrypto.pbkdf2Sync("password", "salt", 4096, 32, "sha256")),
    );
  });

  it("derives the same 32-byte key as Node at the backup iteration count", () => {
    const salt = Buffer.from("0123456789abcdef", "hex");
    expect(hex(shim.pbkdf2Sync("correct horse", salt, 100000, 32, "sha256"))).toBe(
      hex(nodeCrypto.pbkdf2Sync("correct horse", salt, 100000, 32, "sha256")),
    );
  });

  it("produces key material longer than one hash block correctly", () => {
    const salt = Buffer.from("abcdef0123456789", "hex");
    expect(hex(shim.pbkdf2Sync("pw", salt, 10, 100, "sha256"))).toBe(
      hex(nodeCrypto.pbkdf2Sync("pw", salt, 10, 100, "sha256")),
    );
  });
});

describe("crypto shim — AES-256-GCM", () => {
  const encrypt = (key: Buffer, iv: Buffer, plaintext: Buffer) => {
    const cipher = shim.createCipheriv("aes-256-gcm", key, iv);
    const out = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    return { ciphertext: out, tag: cipher.getAuthTag() as Buffer };
  };

  it("matches NIST GCM test case 13 (256-bit key, empty plaintext)", () => {
    const key = Buffer.alloc(32);
    const iv = Buffer.alloc(12);
    const { ciphertext, tag } = encrypt(key, iv, Buffer.alloc(0));
    expect(ciphertext.length).toBe(0);
    expect(hex(tag)).toBe("530f8afbc74536b9a963b4f1c4cb738b");
  });

  it("matches NIST GCM test case 14 (256-bit key, one zero block)", () => {
    const key = Buffer.alloc(32);
    const iv = Buffer.alloc(12);
    const { ciphertext, tag } = encrypt(key, iv, Buffer.alloc(16));
    expect(hex(ciphertext)).toBe("cea7403d4d606b6e074ec5d3baf39d18");
    expect(hex(tag)).toBe("d0d1c8a799996bf0265b98b5d48ab919");
  });

  it("agrees with Node on ciphertext and tag across sizes", () => {
    const key = nodeCrypto.randomBytes(32);
    const iv = nodeCrypto.randomBytes(12);

    // Sizes around the 16-byte block boundary and well past it.
    for (const length of [1, 15, 16, 17, 64, 1000, 5000]) {
      const plaintext = nodeCrypto.randomBytes(length);

      const nodeCipher = nodeCrypto.createCipheriv("aes-256-gcm", key, iv);
      const nodeCiphertext = Buffer.concat([nodeCipher.update(plaintext), nodeCipher.final()]);
      const nodeTag = nodeCipher.getAuthTag();

      const { ciphertext, tag } = encrypt(key, iv, plaintext);
      expect(hex(ciphertext)).toBe(hex(nodeCiphertext));
      expect(hex(tag)).toBe(hex(nodeTag));
    }
  });

  it("round-trips through its own decrypt path", () => {
    const key = nodeCrypto.randomBytes(32);
    const iv = nodeCrypto.randomBytes(12);
    const plaintext = Buffer.from("₱1,579.00 — Jollibee, 2026-09-04", "utf8");

    const { ciphertext, tag } = encrypt(key, iv, plaintext);
    const decipher = shim.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    const recovered = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

    expect(recovered.toString("utf8")).toBe(plaintext.toString("utf8"));
  });

  it("decrypts what Node encrypted", () => {
    const key = nodeCrypto.randomBytes(32);
    const iv = nodeCrypto.randomBytes(12);
    const plaintext = nodeCrypto.randomBytes(300);

    const nodeCipher = nodeCrypto.createCipheriv("aes-256-gcm", key, iv);
    const ciphertext = Buffer.concat([nodeCipher.update(plaintext), nodeCipher.final()]);

    const decipher = shim.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(nodeCipher.getAuthTag());
    expect(hex(Buffer.concat([decipher.update(ciphertext), decipher.final()]))).toBe(
      hex(plaintext),
    );
  });

  it("rejects a tampered ciphertext instead of returning garbage", () => {
    const key = nodeCrypto.randomBytes(32);
    const iv = nodeCrypto.randomBytes(12);
    const { ciphertext, tag } = encrypt(key, iv, Buffer.from("sensitive receipt data"));

    ciphertext[3] ^= 0xff;

    const decipher = shim.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    decipher.update(ciphertext);
    expect(() => decipher.final()).toThrow(/authenticate/);
  });

  it("rejects a tampered tag", () => {
    const key = nodeCrypto.randomBytes(32);
    const iv = nodeCrypto.randomBytes(12);
    const { ciphertext, tag } = encrypt(key, iv, Buffer.from("sensitive receipt data"));

    tag[0] ^= 0x01;

    const decipher = shim.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    decipher.update(ciphertext);
    expect(() => decipher.final()).toThrow(/authenticate/);
  });

  it("produces a distinct keystream past 2 MiB", () => {
    // The previous shim derived its keystream from a 2-byte block counter, so
    // it repeated every 2 MiB and any two same-offset blocks XORed to the
    // plaintext difference. A backup holding receipt photos crosses that line.
    const key = nodeCrypto.randomBytes(32);
    const iv = nodeCrypto.randomBytes(12);
    const size = 3 * 1024 * 1024;

    const { ciphertext } = encrypt(key, iv, Buffer.alloc(size));
    const first = ciphertext.subarray(0, 32);
    const afterWrap = ciphertext.subarray(2 * 1024 * 1024, 2 * 1024 * 1024 + 32);

    expect(hex(first)).not.toBe(hex(afterWrap));
  });

  it("refuses ciphers it does not implement", () => {
    expect(() => shim.createCipheriv("aes-128-cbc", Buffer.alloc(16), Buffer.alloc(16))).toThrow(
      /only implements aes-256-gcm/,
    );
  });
});

describe("crypto shim — randomness", () => {
  it("never falls back to a non-secure source", () => {
    // Hermes exposes no global crypto and expo-crypto is unavailable under the
    // test runner, so the shim must refuse rather than reach for Math.random.
    const hadGlobalCrypto = Boolean((globalThis as { crypto?: unknown }).crypto);

    if (hadGlobalCrypto) {
      const bytes = shim.randomBytes(32);
      expect(bytes.length).toBe(32);
      // Two draws from a real CSPRNG do not collide.
      expect(hex(bytes)).not.toBe(hex(shim.randomBytes(32)));
    } else {
      expect(() => shim.randomBytes(32)).toThrow(/secure random source/);
    }
  });
});
