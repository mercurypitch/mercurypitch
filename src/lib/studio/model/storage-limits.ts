// Studio storage limits — engineering admission bounds that leave portable backup headroom.
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
