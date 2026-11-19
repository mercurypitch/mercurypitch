import { describe, expect, it } from 'vitest'
import { ON_IN_PRODUCTION, onInProduction, } from './experimental-feature-defaults'
import { isExperimentalFeature } from './experimental-features'

describe('the experimental features on in production', () => {
  it('name Studio, on the owner of 19 Nov 2026, and nothing else', () => {
    expect([...ON_IN_PRODUCTION]).toEqual(['studio'])
    for (const name of ON_IN_PRODUCTION)
      expect(isExperimentalFeature(name), name).toBe(true)
  })

  it('leave every other name off in production, a feature this build does not know included', () => {
    expect(onInProduction('studio')).toBe(true)
    for (const name of ['Studio', 'studio-night', 'karaoke-v2', ''])
      expect(onInProduction(name), name).toBe(false)
  })
})
