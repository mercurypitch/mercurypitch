// Studio storage limits — engineering admission bounds that leave portable backup headroom.
//
// A take counts at the size it is stored: its original file plus its
// canonical copy, 32-bit floats at Full quality or 16-bit steps to Save space
// (storage-quality.ts). The bounds stay the same in both, so a song still
// fits its backup's 512 MiB, and Save space fits more takes into them.
import type { StudioAsset } from './types'

export const STUDIO_PROJECT_STORAGE_LIMITS = {
  assetCount: 128,
  audioBytes: 480 * 1024 * 1024,
} as const

/** Count retained owned audio too, even when no current clip references it. */
export function fitsStudioProjectStorageBudget(
  assets: readonly Pick<StudioAsset, 'byteLength' | 'canonicalPcmByteLength'>[],
): boolean {
  if (assets.length > STUDIO_PROJECT_STORAGE_LIMITS.assetCount) return false
  let bytes = 0
  for (const asset of assets) {
    if (
      !Number.isSafeInteger(asset.byteLength) ||
      asset.byteLength < 0 ||
      !Number.isSafeInteger(asset.canonicalPcmByteLength) ||
      asset.canonicalPcmByteLength < 0
    )
      return false
    bytes += asset.byteLength + asset.canonicalPcmByteLength
    if (
      !Number.isSafeInteger(bytes) ||
      bytes > STUDIO_PROJECT_STORAGE_LIMITS.audioBytes
    )
      return false
  }
  return true
}

/**
 * How much of its audio budget a song uses, from 0 to 1 and over: the
 * larger of its bytes' share and its takes' share, counted as the budget
 * counts them, retained takes no clip uses included.
 */
export function studioProjectStorageShare(
  assets: readonly Pick<StudioAsset, 'byteLength' | 'canonicalPcmByteLength'>[],
): number {
  let bytes = 0
  for (const asset of assets)
    bytes += asset.byteLength + asset.canonicalPcmByteLength
  return Math.max(
    bytes / STUDIO_PROJECT_STORAGE_LIMITS.audioBytes,
    assets.length / STUDIO_PROJECT_STORAGE_LIMITS.assetCount,
  )
}
