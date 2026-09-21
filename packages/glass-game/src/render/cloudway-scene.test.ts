// Cloudway scene theme tests — authored presentation data selects open-sky rendering for future trials.

import { describe, expect, it } from 'vitest'
import { CLOUDWAY_GLASS_RIBBON } from '../content/cloudway-trial'
import { isCloudwayLevel } from './cloudway-scene'

describe('Cloudway scene theme', () => {
  it('selects the theme from presentation data instead of a level id', () => {
    expect(
      isCloudwayLevel({
        ...CLOUDWAY_GLASS_RIBBON,
        id: 'future-cloudway-ferry',
      }),
    ).toBe(true)
    expect(
      isCloudwayLevel({
        ...CLOUDWAY_GLASS_RIBBON,
        presentation: {
          ...CLOUDWAY_GLASS_RIBBON.presentation!,
          theme: 'museum',
        },
      }),
    ).toBe(false)
    expect(
      isCloudwayLevel({
        ...CLOUDWAY_GLASS_RIBBON,
        presentation: {
          ...CLOUDWAY_GLASS_RIBBON.presentation!,
          theme: undefined,
        },
      }),
    ).toBe(false)
  })
})
