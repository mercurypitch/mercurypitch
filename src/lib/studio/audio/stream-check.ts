// ============================================================
// Studio stream checks — a saved take's checks, made on its bytes as they stream past, with no copy of the take.
// ============================================================
//
// A backup reads each take 16 KiB at a time on its way into the archive.
// These checks see the same slices and reach the verdict that
// validatePreparedStudioAsset reaches on the whole take: the original's size,
// type and hash, and the canonical PCM's header, samples and hash. Holding a
// slice instead of the take is what keeps a backup's memory to one batch.
import type { StudioAsset } from '../model/types'
import { validateStudioAsset } from '../model/validation'
import { CANONICAL_PCM_HEADER_BYTES, checkCanonicalPcmHeader, checkCanonicalSize, } from './canonical-pcm'
import type { StudioImportLimits } from './import-limits'
import { importLimits } from './import-limits'
import { createStudioSha256 } from './sha256'

export interface StudioStreamCheck {
  /** The next bytes, in order. Throws as soon as they cannot be right. */
  update(bytes: Uint8Array): void
  /** After the last bytes: throws unless every byte matched. */
  finish(): void
}

const sizeOf = (bytes: Blob | ArrayBuffer) =>
  bytes instanceof Blob ? bytes.size : bytes.byteLength

/** The original file as it streams: its size, type and hash. Stored bytes carry no type of their own. */
export function checkOriginalStream(
  original: Blob | ArrayBuffer,
  asset: StudioAsset,
  overrides: Partial<StudioImportLimits> = {},
): StudioStreamCheck {
  validateStudioAsset(asset)
  const limits = importLimits(overrides)
  const size = sizeOf(original)
  if (!Number.isSafeInteger(size) || size <= 0 || size > limits.maxEncodedBytes)
    throw new Error('This audio is empty or too large. Choose a smaller file.')
  if (
    size !== asset.byteLength ||
    (original instanceof Blob &&
      (original.type || 'application/octet-stream') !== asset.mimeType)
  )
    throw new Error('Original audio does not match its saved metadata')
  const hash = createStudioSha256()
  let read = 0
  return {
    update(bytes) {
      read += bytes.length
      hash.update(bytes)
    },
    finish() {
      if (read !== asset.byteLength || hash.digest() !== asset.sha256)
        throw new Error('Original audio checksum failed')
    },
  }
}

/** Canonical PCM as it streams: the header first, then finite samples and the hash. */
export function checkCanonicalStream(
  canonicalPcm: Blob | ArrayBuffer,
  asset: StudioAsset,
  overrides: Partial<StudioImportLimits> = {},
): StudioStreamCheck {
  const limits = importLimits(overrides)
  const size = sizeOf(canonicalPcm)
  checkCanonicalSize(size, asset, limits)
  const hash = createStudioSha256()
  let read = 0
  return {
    update(bytes) {
      // The header is 32 bytes and every slice but the last a multiple of 4,
      // so samples never straddle two slices.
      if (read === 0)
        checkCanonicalPcmHeader(
          new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength),
          size,
          asset,
          limits,
        )
      if (read % 4 !== 0 || bytes.byteLength % 4 !== 0)
        throw new Error('Studio audio does not match its saved metadata')
      checkFinite(bytes, read === 0 ? CANONICAL_PCM_HEADER_BYTES : 0)
      read += bytes.byteLength
      hash.update(bytes)
    },
    finish() {
      if (read !== size || hash.digest() !== asset.canonicalPcmSha256)
        throw new Error('Studio audio checksum failed')
    },
  }
}

// Canonical PCM is little-endian Float32: on a little-endian platform (every
// browser in use) samples are read through a typed view, not one at a time.
const LITTLE_ENDIAN = new Uint8Array(new Uint32Array([1]).buffer)[0] === 1

function checkFinite(bytes: Uint8Array, from: number): void {
  const count = (bytes.byteLength - from) / 4
  if (LITTLE_ENDIAN && (bytes.byteOffset + from) % 4 === 0) {
    const samples = new Float32Array(
      bytes.buffer,
      bytes.byteOffset + from,
      count,
    )
    for (let index = 0; index < count; index++)
      if (!Number.isFinite(samples[index])) throw invalidSamples()
    return
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  for (let index = 0; index < count; index++)
    if (!Number.isFinite(view.getFloat32(from + index * 4, true)))
      throw invalidSamples()
}

function invalidSamples(): Error {
  return new Error('Studio audio contains invalid samples')
}
