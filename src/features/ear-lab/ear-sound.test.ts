import { describe, expect, it } from 'vitest'
import { EAR_VOLUME, formatEarVolume, persistEarVolume } from './ear-sound'

describe('ear-sound', () => {
  it('keeps the stage volume inside 0..1', () => {
    expect(EAR_VOLUME.defaultValue).toBe(0.7)
    expect(persistEarVolume(1.4)).toBe(1)
    expect(persistEarVolume(-1)).toBe(0)
    expect(persistEarVolume(0.55)).toBe(0.55)
  })

  it('prints the level as a percent', () => {
    expect(formatEarVolume(0.7)).toBe('70%')
    expect(formatEarVolume(1)).toBe('100%')
  })
})
