/**
 * React Native shim for the Node `crypto` API surface the shared package uses.
 *
 * Metro aliases `crypto` to this file (see metro.config.js), so THIS is the
 * implementation that ships inside the APK — the shared package's tests run
 * under Node and exercise Node's real crypto, never this code. Anything wrong
 * here is invisible to that suite, which is why `crypto-shim.test.js` checks
 * every primitive below against published test vectors.
 *
 * Provides: randomBytes, createHash("sha256"), pbkdf2Sync (HMAC-SHA256),
 * createCipheriv/createDecipheriv for "aes-256-gcm".
 */

const { Buffer } = require("buffer");

// --- CSPRNG ------------------------------------------------------------------

let expoRandomBytes = null;
try {
  // expo-crypto delegates to the platform CSPRNG (SecRandomCopyBytes /
  // java.security.SecureRandom).
  expoRandomBytes = require("expo-crypto").getRandomBytes;
} catch {
  expoRandomBytes = null;
}

/**
 * Cryptographically secure random bytes.
 *
 * There is deliberately no Math.random fallback. Hermes has no global
 * `crypto`, so a fallback would be the path actually taken on device, and
 * predictable salts and IVs silently destroy the guarantees of everything
 * built on top of them. Failing loudly is the correct behaviour.
 */
function randomBytes(size) {
  if (typeof globalThis !== "undefined" && globalThis.crypto?.getRandomValues) {
    const out = Buffer.alloc(size);
    globalThis.crypto.getRandomValues(out);
    return out;
  }
  if (expoRandomBytes) {
    return Buffer.from(expoRandomBytes(size));
  }
  throw new Error(
    "No cryptographically secure random source is available. " +
      "Keeptrail will not generate keys or nonces from a non-secure source.",
  );
}

// --- SHA-256 -----------------------------------------------------------------

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

function rightRotate(n, d) {
  return (n >>> d) | (n << (32 - d));
}

function sha256Bytes(data) {
  const bytes = Buffer.isBuffer(data) ? data : Buffer.from(data);

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

  // Big-endian 64-bit length
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

function createHash(algo) {
  if (String(algo).toLowerCase() !== "sha256") {
    throw new Error(`crypto shim only implements sha256, received "${algo}"`);
  }
  const buffers = [];
  return {
    update(chunk) {
      buffers.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      return this;
    },
    digest(encoding) {
      const digestBuf = sha256Bytes(Buffer.concat(buffers));
      return encoding === "hex" ? digestBuf.toString("hex") : digestBuf;
    },
  };
}

// --- HMAC-SHA256 and PBKDF2 --------------------------------------------------

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
  if (digest && String(digest).toLowerCase() !== "sha256") {
    throw new Error(`crypto shim only implements pbkdf2 with sha256, received "${digest}"`);
  }
  const p = Buffer.isBuffer(password) ? password : Buffer.from(password);
  const s = Buffer.isBuffer(salt) ? salt : Buffer.from(salt);
  const hLen = 32;
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
    t.copy(result, start, 0, Math.min(hLen, keylen - start));
  }

  return result;
}

// --- AES-256 block cipher ----------------------------------------------------
// Textbook AES (FIPS-197). Constant-time behaviour is not claimed; the threat
// model here is an attacker holding the exported archive file, not one timing
// the phone's key schedule.

const SBOX = new Uint8Array(256);
const INV_SBOX = new Uint8Array(256);

(function buildSboxes() {
  const p = new Uint8Array(256);
  const l = new Uint8Array(256);
  let x = 1;
  for (let i = 0; i < 255; i++) {
    p[i] = x;
    l[x] = i;
    x ^= (x << 1) ^ ((x & 0x80) !== 0 ? 0x11b : 0);
    x &= 0xff;
  }
  // The exponent table has period 255, so wrapping index 255 back to 0 is what
  // makes the inverse below correct for a = 1 (log 0).
  p[255] = p[0];

  const inverse = (a) => (a === 0 ? 0 : p[255 - l[a]]);

  for (let i = 0; i < 256; i++) {
    const inv = inverse(i);
    let s = inv;
    let acc = inv;
    for (let t = 0; t < 4; t++) {
      acc = ((acc << 1) | (acc >>> 7)) & 0xff;
      s ^= acc;
    }
    s ^= 0x63;
    SBOX[i] = s;
    INV_SBOX[s] = i;
  }
})();

function xtime(a) {
  return ((a << 1) ^ ((a & 0x80) !== 0 ? 0x1b : 0)) & 0xff;
}

function gmul(a, b) {
  let result = 0;
  let x = a;
  let y = b;
  while (y) {
    if (y & 1) result ^= x;
    x = xtime(x);
    y >>>= 1;
  }
  return result & 0xff;
}

function expandKey(key) {
  // AES-256: 32-byte key, 14 rounds, 60 words.
  const Nk = 8;
  const Nr = 14;
  const w = new Uint8Array(4 * 4 * (Nr + 1));
  key.copy ? key.copy(w, 0, 0, 32) : w.set(key.subarray(0, 32), 0);

  let rcon = 1;
  for (let i = Nk; i < 4 * (Nr + 1); i++) {
    const t = [w[(i - 1) * 4], w[(i - 1) * 4 + 1], w[(i - 1) * 4 + 2], w[(i - 1) * 4 + 3]];
    if (i % Nk === 0) {
      const tmp = t[0];
      t[0] = SBOX[t[1]] ^ rcon;
      t[1] = SBOX[t[2]];
      t[2] = SBOX[t[3]];
      t[3] = SBOX[tmp];
      rcon = xtime(rcon);
    } else if (i % Nk === 4) {
      for (let j = 0; j < 4; j++) t[j] = SBOX[t[j]];
    }
    for (let j = 0; j < 4; j++) {
      w[i * 4 + j] = w[(i - Nk) * 4 + j] ^ t[j];
    }
  }
  return w;
}

/** Encrypts one 16-byte block in place into `out`. */
function encryptBlock(roundKeys, input, out) {
  const Nr = 14;
  const state = new Uint8Array(16);
  for (let i = 0; i < 16; i++) state[i] = input[i] ^ roundKeys[i];

  for (let round = 1; round <= Nr; round++) {
    // SubBytes
    for (let i = 0; i < 16; i++) state[i] = SBOX[state[i]];

    // ShiftRows (state is column-major: index = col * 4 + row)
    const t = Uint8Array.from(state);
    for (let row = 1; row < 4; row++) {
      for (let col = 0; col < 4; col++) {
        state[col * 4 + row] = t[((col + row) % 4) * 4 + row];
      }
    }

    // MixColumns (skipped in the final round)
    if (round !== Nr) {
      for (let col = 0; col < 4; col++) {
        const a0 = state[col * 4];
        const a1 = state[col * 4 + 1];
        const a2 = state[col * 4 + 2];
        const a3 = state[col * 4 + 3];
        state[col * 4] = gmul(a0, 2) ^ gmul(a1, 3) ^ a2 ^ a3;
        state[col * 4 + 1] = a0 ^ gmul(a1, 2) ^ gmul(a2, 3) ^ a3;
        state[col * 4 + 2] = a0 ^ a1 ^ gmul(a2, 2) ^ gmul(a3, 3);
        state[col * 4 + 3] = gmul(a0, 3) ^ a1 ^ a2 ^ gmul(a3, 2);
      }
    }

    // AddRoundKey
    for (let i = 0; i < 16; i++) state[i] ^= roundKeys[round * 16 + i];
  }

  for (let i = 0; i < 16; i++) out[i] = state[i];
}

// --- GHASH (GF(2^128) multiplication over the GCM field) ---------------------

function ghashMultiply(x, y) {
  // Right-shift based multiplication in GF(2^128) with reduction poly 0xe1.
  const z = new Uint8Array(16);
  const v = Uint8Array.from(y);

  for (let i = 0; i < 128; i++) {
    const bit = (x[i >>> 3] >>> (7 - (i & 7))) & 1;
    if (bit) {
      for (let j = 0; j < 16; j++) z[j] ^= v[j];
    }
    const lsb = v[15] & 1;
    for (let j = 15; j > 0; j--) {
      v[j] = ((v[j] >>> 1) | ((v[j - 1] & 1) << 7)) & 0xff;
    }
    v[0] >>>= 1;
    if (lsb) v[0] ^= 0xe1;
  }
  return z;
}

function ghash(hashSubkey, data) {
  let y = new Uint8Array(16);
  for (let offset = 0; offset < data.length; offset += 16) {
    const block = new Uint8Array(16);
    const slice = data.subarray(offset, Math.min(offset + 16, data.length));
    block.set(slice, 0);
    for (let i = 0; i < 16; i++) y[i] ^= block[i];
    y = ghashMultiply(y, hashSubkey);
  }
  return y;
}

function incrementCounter(counterBlock) {
  for (let i = 15; i >= 12; i--) {
    counterBlock[i] = (counterBlock[i] + 1) & 0xff;
    if (counterBlock[i] !== 0) break;
  }
}

function gcmCore(key, iv, input, isEncrypt, expectedTag) {
  const roundKeys = expandKey(Buffer.isBuffer(key) ? key : Buffer.from(key));

  // H = E(K, 0^128)
  const hashSubkey = new Uint8Array(16);
  encryptBlock(roundKeys, new Uint8Array(16), hashSubkey);

  // J0: for a 96-bit IV, IV || 0^31 || 1
  const j0 = new Uint8Array(16);
  if (iv.length === 12) {
    j0.set(iv, 0);
    j0[15] = 1;
  } else {
    const lengthBlock = new Uint8Array(16);
    const bitLen = iv.length * 8;
    lengthBlock[12] = (bitLen >>> 24) & 0xff;
    lengthBlock[13] = (bitLen >>> 16) & 0xff;
    lengthBlock[14] = (bitLen >>> 8) & 0xff;
    lengthBlock[15] = bitLen & 0xff;
    const padded = new Uint8Array(Math.ceil(iv.length / 16) * 16);
    padded.set(iv, 0);
    const combined = new Uint8Array(padded.length + 16);
    combined.set(padded, 0);
    combined.set(lengthBlock, padded.length);
    j0.set(ghash(hashSubkey, combined), 0);
  }

  // CTR over J0+1
  const counter = Uint8Array.from(j0);
  incrementCounter(counter);

  const output = new Uint8Array(input.length);
  const keyStream = new Uint8Array(16);
  for (let offset = 0; offset < input.length; offset += 16) {
    encryptBlock(roundKeys, counter, keyStream);
    const blockLen = Math.min(16, input.length - offset);
    for (let i = 0; i < blockLen; i++) {
      output[offset + i] = input[offset + i] ^ keyStream[i];
    }
    incrementCounter(counter);
  }

  // Tag over the ciphertext (no additional authenticated data is used).
  const ciphertext = isEncrypt ? output : input;
  const padLen = (16 - (ciphertext.length % 16)) % 16;
  // Final GHASH block is [bitlen(AAD)]_64 || [bitlen(C)]_64, big-endian. No
  // additional authenticated data is used, so the first half stays zero.
  const lengthBlock = new Uint8Array(16);
  const cipherBits = ciphertext.length * 8;
  const cipherBitsHigh = Math.floor(cipherBits / 0x100000000);
  const cipherBitsLow = cipherBits >>> 0;
  lengthBlock[8] = (cipherBitsHigh >>> 24) & 0xff;
  lengthBlock[9] = (cipherBitsHigh >>> 16) & 0xff;
  lengthBlock[10] = (cipherBitsHigh >>> 8) & 0xff;
  lengthBlock[11] = cipherBitsHigh & 0xff;
  lengthBlock[12] = (cipherBitsLow >>> 24) & 0xff;
  lengthBlock[13] = (cipherBitsLow >>> 16) & 0xff;
  lengthBlock[14] = (cipherBitsLow >>> 8) & 0xff;
  lengthBlock[15] = cipherBitsLow & 0xff;

  const ghashInput = new Uint8Array(ciphertext.length + padLen + 16);
  ghashInput.set(ciphertext, 0);
  ghashInput.set(lengthBlock, ciphertext.length + padLen);

  const s = ghash(hashSubkey, ghashInput);
  const tagMask = new Uint8Array(16);
  encryptBlock(roundKeys, j0, tagMask);
  const tag = Buffer.alloc(16);
  for (let i = 0; i < 16; i++) tag[i] = s[i] ^ tagMask[i];

  if (!isEncrypt && expectedTag) {
    let diff = 0;
    for (let i = 0; i < 16; i++) diff |= tag[i] ^ expectedTag[i];
    if (diff !== 0) {
      throw new Error("Unsupported state or unable to authenticate data");
    }
  }

  return { output: Buffer.from(output), tag };
}

function assertAes256Gcm(algo) {
  if (String(algo).toLowerCase() !== "aes-256-gcm") {
    throw new Error(`crypto shim only implements aes-256-gcm, received "${algo}"`);
  }
}

function createCipheriv(algo, key, iv) {
  assertAes256Gcm(algo);
  const chunks = [];
  let authTag = null;

  return {
    update(chunk) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      return Buffer.alloc(0);
    },
    final() {
      const plaintext = Buffer.concat(chunks);
      const { output, tag } = gcmCore(key, iv, plaintext, true, null);
      authTag = tag;
      return output;
    },
    getAuthTag() {
      if (!authTag) {
        throw new Error("getAuthTag() called before final()");
      }
      return authTag;
    },
  };
}

function createDecipheriv(algo, key, iv) {
  assertAes256Gcm(algo);
  const chunks = [];
  let expectedTag = null;

  return {
    setAuthTag(tag) {
      expectedTag = Buffer.isBuffer(tag) ? tag : Buffer.from(tag);
      return this;
    },
    update(chunk) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      return Buffer.alloc(0);
    },
    final() {
      if (!expectedTag) {
        throw new Error("setAuthTag() must be called before final()");
      }
      const ciphertext = Buffer.concat(chunks);
      return gcmCore(key, iv, ciphertext, false, expectedTag).output;
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
