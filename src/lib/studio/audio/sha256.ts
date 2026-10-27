// ============================================================
// Studio SHA-256 — hashes audio the caller already holds, without a copy
// ============================================================
//
// WebCrypto's digest copies its whole input before it starts, so hashing a
// canonical take held in memory needs that take's size again. Restoring a
// backup and copying a song already hold every take, so they hash here
// instead: a plain FIPS 180-4 SHA-256 that reads the bytes where they are, a
// slice at a time, and yields between slices so Cancel and the page keep up.
import { importCheckpoint } from './import-limits'

// The first 32 bits of the fractional parts of the cube roots of the first
// 64 primes, and of the square roots of the first 8 (FIPS 180-4, 4.2.2/5.3.3).
const K = new Int32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
  0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
  0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
  0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
  0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
  0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
])
const INITIAL = [
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c,
  0x1f83d9ab, 0x5be0cd19,
]
/** Bytes hashed between two yields: about a millisecond of work. */
const SLICE_BYTES = 256 * 1024

/** Fold one 64-byte block at `at` into the running state. */
function compress(
  state: Int32Array,
  words: Int32Array,
  bytes: Uint8Array,
  at: number,
): void {
  for (let index = 0; index < 16; index++) {
    const from = at + index * 4
    words[index] =
      (bytes[from] << 24) |
      (bytes[from + 1] << 16) |
      (bytes[from + 2] << 8) |
      bytes[from + 3]
  }
  for (let index = 16; index < 64; index++) {
    const early = words[index - 15]
    const late = words[index - 2]
    // Rotations are written out: a shared helper measured 40% slower.
    const sigma0 =
      ((early >>> 7) | (early << 25)) ^
      ((early >>> 18) | (early << 14)) ^
      (early >>> 3)
    const sigma1 =
      ((late >>> 17) | (late << 15)) ^
      ((late >>> 19) | (late << 13)) ^
      (late >>> 10)
    words[index] = (words[index - 16] + sigma0 + words[index - 7] + sigma1) | 0
  }
  let a = state[0]
  let b = state[1]
  let c = state[2]
  let d = state[3]
  let e = state[4]
  let f = state[5]
  let g = state[6]
  let h = state[7]
  for (let index = 0; index < 64; index++) {
    const sum1 =
      ((e >>> 6) | (e << 26)) ^
      ((e >>> 11) | (e << 21)) ^
      ((e >>> 25) | (e << 7))
    const first =
      (h + sum1 + ((e & f) ^ (~e & g)) + K[index] + words[index]) | 0
    const sum0 =
      ((a >>> 2) | (a << 30)) ^
      ((a >>> 13) | (a << 19)) ^
      ((a >>> 22) | (a << 10))
    const second = (sum0 + ((a & b) ^ (a & c) ^ (b & c))) | 0
    h = g
    g = f
    f = e
    e = (d + first) | 0
    d = c
    c = b
    b = a
    a = (first + second) | 0
  }
  state[0] += a
  state[1] += b
  state[2] += c
  state[3] += d
  state[4] += e
  state[5] += f
  state[6] += g
  state[7] += h
}

export interface StudioSha256 {
  update(bytes: Uint8Array): void
  /** Lowercase hex, as `sha256Bytes` writes it. Ends the hash. */
  digest(): string
}

/** An incremental SHA-256: feed it the bytes in any number of parts. */
export function createStudioSha256(): StudioSha256 {
  const state = Int32Array.from(INITIAL)
  const words = new Int32Array(64)
  const block = new Uint8Array(64)
  let filled = 0
  let length = 0
  return {
    update(bytes) {
      length += bytes.length
      let at = 0
      if (filled > 0) {
        at = Math.min(64 - filled, bytes.length)
        block.set(bytes.subarray(0, at), filled)
        filled += at
        if (filled < 64) return
        compress(state, words, block, 0)
        filled = 0
      }
      for (; at + 64 <= bytes.length; at += 64)
        compress(state, words, bytes, at)
      block.set(bytes.subarray(at), 0)
      filled = bytes.length - at
    },
    digest() {
      // A 1 bit, zeros, then the length in bits as a 64-bit big-endian number.
      const tail = new Uint8Array(filled < 56 ? 64 : 128)
      tail.set(block.subarray(0, filled))
      tail[filled] = 0x80
      const view = new DataView(tail.buffer)
      view.setUint32(tail.length - 8, Math.floor(length / 0x20000000))
      view.setUint32(tail.length - 4, (length * 8) >>> 0)
      for (let at = 0; at < tail.length; at += 64)
        compress(state, words, tail, at)
      return Array.from(state, (word) =>
        (word >>> 0).toString(16).padStart(8, '0'),
      ).join('')
    },
  }
}

/** SHA-256 of bytes the caller holds, read in place, yielding between slices. */
export async function sha256InPlace(
  bytes: ArrayBuffer,
  signal?: AbortSignal,
): Promise<string> {
  const view = new Uint8Array(bytes)
  const hash = createStudioSha256()
  for (let at = 0; at < view.length; at += SLICE_BYTES) {
    hash.update(view.subarray(at, Math.min(view.length, at + SLICE_BYTES)))
    await importCheckpoint(signal)
  }
  return hash.digest()
}
