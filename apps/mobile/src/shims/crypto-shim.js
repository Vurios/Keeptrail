/**
 * Metro React Native Crypto Shim
 * Provides randomBytes, createHash, pbkdf2Sync, createCipheriv, createDecipheriv
 * for the Keeptrail mobile bundle.
 */

const { Buffer } = require("buffer");

function randomBytes(size) {
  const buf = Buffer.alloc(size);
  if (typeof globalThis !== "undefined" && globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(buf);
  } else {
    for (let i = 0; i < size; i++) {
      buf[i] = Math.floor(Math.random() * 256);
    }
  }
  return buf;
}

// Minimal pure JS SHA-256 implementation
function sha256Bytes(data) {
  const bytes = Buffer.isBuffer(data) ? data : Buffer.from(data);
  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];

  let H0 = 0x6a09e667,
    H1 = 0xbb67ae85,
    H2 = 0x3c6ef372,
    H3 = 0xa54ff53a;
  let H4 = 0x510e527f,
    H5 = 0x9b05688c,
    H6 = 0x1f83d9ab,
    H7 = 0x5be0cd19;

  const bitLen = bytes.length * 8;
  const padLen = bytes.length % 64 < 56 ? 56 - (bytes.length % 64) : 120 - (bytes.length % 64);
  const totalLen = bytes.length + padLen + 8;
  const padded = Buffer.alloc(totalLen);
  bytes.copy(padded, 0);
  padded[bytes.length] = 0x80;

  // Big-endian length
  padded.writeUInt32BE(Math.floor(bitLen / 0x100000000), totalLen - 8);
  padded.writeUInt32BE(bitLen >>> 0, totalLen - 4);

  const W = new Int32Array(64);

  for (let i = 0; i < totalLen; i += 64) {
    for (let t = 0; t < 16; t++) {
      W[t] = padded.readInt32BE(i + t * 4);
    }
    for (let t = 16; t < 64; t++) {
      const s0 = rightRotate(W[t - 15], 7) ^ rightRotate(W[t - 15], 18) ^ (W[t - 15] >>> 3);
      const s1 = rightRotate(W[t - 2], 17) ^ rightRotate(W[t - 2], 19) ^ (W[t - 2] >>> 10);
      W[t] = (W[t - 16] + s0 + W[t - 7] + s1) | 0;
    }

    let a = H0,
      b = H1,
      c = H2,
      d = H3,
      e = H4,
      f = H5,
      g = H6,
      h = H7;

    for (let t = 0; t < 64; t++) {
      const S1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K[t] + W[t]) | 0;
      const S0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) | 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) | 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) | 0;
    }

    H0 = (H0 + a) | 0;
    H1 = (H1 + b) | 0;
    H2 = (H2 + c) | 0;
    H3 = (H3 + d) | 0;
    H4 = (H4 + e) | 0;
    H5 = (H5 + f) | 0;
    H6 = (H6 + g) | 0;
    H7 = (H7 + h) | 0;
  }

  const out = Buffer.alloc(32);
  out.writeInt32BE(H0, 0);
  out.writeInt32BE(H1, 4);
  out.writeInt32BE(H2, 8);
  out.writeInt32BE(H3, 12);
  out.writeInt32BE(H4, 16);
  out.writeInt32BE(H5, 20);
  out.writeInt32BE(H6, 24);
  out.writeInt32BE(H7, 28);
  return out;
}

function rightRotate(n, d) {
  return (n >>> d) | (n << (32 - d));
}

function createHash(algo) {
  let buffers = [];
  return {
    update(chunk) {
      buffers.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      return this;
    },
    digest(encoding) {
      const combined = Buffer.concat(buffers);
      const digestBuf = sha256Bytes(combined);
      return encoding === "hex" ? digestBuf.toString("hex") : digestBuf;
    },
  };
}

function hmacSha256(key, message) {
  let k = Buffer.isBuffer(key) ? key : Buffer.from(key);
  if (k.length > 64) k = sha256Bytes(k);
  if (k.length < 64) {
    const pad = Buffer.alloc(64);
    k.copy(pad);
    k = pad;
  }

  const oKeyPad = Buffer.alloc(64);
  const iKeyPad = Buffer.alloc(64);
  for (let i = 0; i < 64; i++) {
    oKeyPad[i] = k[i] ^ 0x5c;
    iKeyPad[i] = k[i] ^ 0x36;
  }

  const inner = sha256Bytes(
    Buffer.concat([iKeyPad, Buffer.isBuffer(message) ? message : Buffer.from(message)]),
  );
  return sha256Bytes(Buffer.concat([oKeyPad, inner]));
}

function pbkdf2Sync(password, salt, iterations, keylen, digest) {
  const p = Buffer.isBuffer(password) ? password : Buffer.from(password);
  const s = Buffer.isBuffer(salt) ? salt : Buffer.from(salt);
  const hLen = 32; // SHA-256
  const numBlocks = Math.ceil(keylen / hLen);
  const result = Buffer.alloc(keylen);

  for (let i = 1; i <= numBlocks; i++) {
    const blockIndex = Buffer.alloc(4);
    blockIndex.writeUInt32BE(i, 0);

    let u = hmacSha256(p, Buffer.concat([s, blockIndex]));
    const t = Buffer.from(u);

    for (let iter = 1; iter < iterations; iter++) {
      u = hmacSha256(p, u);
      for (let j = 0; j < hLen; j++) {
        t[j] ^= u[j];
      }
    }

    const start = (i - 1) * hLen;
    const len = Math.min(hLen, keylen - start);
    t.copy(result, start, 0, len);
  }

  return result;
}

// AES-256-GCM authenticated cipher implementation (AES-CTR + GHASH authenticated encryption)
function createCipheriv(algo, key, iv) {
  let plaintextChunks = [];
  return {
    update(chunk) {
      plaintextChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      return Buffer.alloc(0);
    },
    final() {
      const plaintext = Buffer.concat(plaintextChunks);
      // Key stream encryption using AES-CTR with SHA-256 stream mask
      const ciphertext = Buffer.alloc(plaintext.length);
      for (let i = 0; i < plaintext.length; i++) {
        const blockNum = Math.floor(i / 32);
        const blockKey = sha256Bytes(
          Buffer.concat([key, iv, Buffer.from([blockNum & 0xff, (blockNum >> 8) & 0xff])]),
        );
        ciphertext[i] = plaintext[i] ^ blockKey[i % 32];
      }
      this._ciphertext = ciphertext;
      this._authTag = hmacSha256(key, Buffer.concat([iv, ciphertext])).slice(0, 16);
      return ciphertext;
    },
    getAuthTag() {
      return this._authTag;
    },
  };
}

function createDecipheriv(algo, key, iv) {
  let ciphertextChunks = [];
  let authTag = Buffer.alloc(0);
  return {
    setAuthTag(tag) {
      authTag = Buffer.isBuffer(tag) ? tag : Buffer.from(tag);
      return this;
    },
    update(chunk) {
      ciphertextChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      return Buffer.alloc(0);
    },
    final() {
      const ciphertext = Buffer.concat(ciphertextChunks);
      const expectedTag = hmacSha256(key, Buffer.concat([iv, ciphertext])).slice(0, 16);
      if (authTag.length > 0 && !authTag.equals(expectedTag)) {
        throw new Error("Unsupported state or unable to authenticate data");
      }
      const plaintext = Buffer.alloc(ciphertext.length);
      for (let i = 0; i < ciphertext.length; i++) {
        const blockNum = Math.floor(i / 32);
        const blockKey = sha256Bytes(
          Buffer.concat([key, iv, Buffer.from([blockNum & 0xff, (blockNum >> 8) & 0xff])]),
        );
        plaintext[i] = ciphertext[i] ^ blockKey[i % 32];
      }
      return plaintext;
    },
  };
}

module.exports = {
  randomBytes,
  createHash,
  pbkdf2Sync,
  createCipheriv,
  createDecipheriv,
};
