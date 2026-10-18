// Collectible artwork scale — bounded presentation tuning never changes pickup reach.

export const COLLECTIBLE_ARTWORK_SCALE = {
  minimum: 0.8,
  maximum: 1.6,
  default: 1.2,
  step: 0.01,
} as const

export const COLLECTIBLE_ARTWORK_BASE_METERS = 0.65

export function normalizeCollectibleArtworkScale(
  raw: number | string | null | undefined,
): number {
  const value = typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : raw
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(
        COLLECTIBLE_ARTWORK_SCALE.minimum,
        Math.min(COLLECTIBLE_ARTWORK_SCALE.maximum, value),
      )
    : COLLECTIBLE_ARTWORK_SCALE.default
}
