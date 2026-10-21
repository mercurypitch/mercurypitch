// Collectible scale tests — storage and live adjustments share bounded presentation values.
import { expect, it } from 'vitest'
import { COLLECTIBLE_ARTWORK_BASE_METERS, COLLECTIBLE_ARTWORK_SCALE, normalizeCollectibleArtworkScale, } from './collectible-artwork'

it('defaults invalid values, clamps finite adjustments and preserves fine tuning', () => {
  for (const invalid of [null, undefined, '', ' ', 'no', NaN, Infinity])
    expect(normalizeCollectibleArtworkScale(invalid)).toBe(1.2)
  expect(normalizeCollectibleArtworkScale(-2)).toBe(0.8)
  expect(normalizeCollectibleArtworkScale('2.4')).toBe(1.6)
  expect(normalizeCollectibleArtworkScale('1.37')).toBe(1.37)
  expect(
    COLLECTIBLE_ARTWORK_BASE_METERS * COLLECTIBLE_ARTWORK_SCALE.default,
  ).toBe(0.78)
})
