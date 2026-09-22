// Sky backdrop regression — portrait and panoramic viewports never expose the plate's wrap boundary.
import { Texture } from 'three'
import { expect, it } from 'vitest'
import { fitSkyBackdrop } from './sky-backdrop'

it.each([
  [320, 740],
  [1024, 768],
  [2560, 720],
])(
  'covers a %s × %s view without stretching or sampling outside the artwork',
  (width, height) => {
    const texture = new Texture({ width: 2048, height: 1024 })
    fitSkyBackdrop(texture, width, height)
    const cropAspect = (2048 * texture.repeat.x) / (1024 * texture.repeat.y)
    expect(cropAspect).toBeCloseTo(width / height)
    for (const axis of ['x', 'y'] as const) {
      expect(texture.offset[axis]).toBeGreaterThanOrEqual(0)
      expect(texture.offset[axis] + texture.repeat[axis]).toBeLessThanOrEqual(1)
    }
  },
)
