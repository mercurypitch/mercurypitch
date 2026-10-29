import { describe, expect, it } from 'vitest'
import { EXPERIMENTAL_FEATURES, isExperimentalFeature, parseFeatureOverrides, parseFeatureSwitch, resolveExperimentalFeature, } from './experimental-features'

describe('the experimental features list', () => {
  it('names Studio, and knows nothing else', () => {
    expect([...EXPERIMENTAL_FEATURES]).toEqual(['studio'])
    expect(isExperimentalFeature('studio')).toBe(true)
    for (const value of ['Studio', 'studio-night', '', 'ghost', null, 1])
      expect(isExperimentalFeature(value)).toBe(false)
  })
})

describe('resolving a feature for a page', () => {
  it("uses the owner's switch where one is set, either way", () => {
    expect(resolveExperimentalFeature('studio', false, { studio: true })).toBe(
      true,
    )
    expect(resolveExperimentalFeature('studio', true, { studio: false })).toBe(
      false,
    )
  })

  it("falls back to the build's default where none is", () => {
    expect(resolveExperimentalFeature('studio', true, {})).toBe(true)
    expect(resolveExperimentalFeature('studio', false, {})).toBe(false)
  })
})

describe('reading GET /api/features', () => {
  it('keeps a known name with a boolean', () => {
    expect(parseFeatureOverrides({ studio: false })).toEqual({ studio: false })
    expect(parseFeatureOverrides({ studio: true })).toEqual({ studio: true })
  })

  it('drops names it does not know and values that are not booleans', () => {
    expect(parseFeatureOverrides({ ghost: true, studio: 'true' })).toEqual({})
    expect(parseFeatureOverrides({ studio: 1 })).toEqual({})
  })

  it('reads anything that is not an object as no switch at all', () => {
    for (const value of [null, undefined, 'studio', 7, [true], ['studio']])
      expect(parseFeatureOverrides(value)).toEqual({})
  })
})

describe('reading the PUT body', () => {
  it('takes true, false, or null to clear the switch', () => {
    expect(parseFeatureSwitch({ enabled: true })).toEqual({
      ok: true,
      enabled: true,
    })
    expect(parseFeatureSwitch({ enabled: false })).toEqual({
      ok: true,
      enabled: false,
    })
    expect(parseFeatureSwitch({ enabled: null })).toEqual({
      ok: true,
      enabled: null,
    })
  })

  it('refuses a missing or mistyped switch, and any other field', () => {
    const error = 'enabled must be true, false or null'
    expect(parseFeatureSwitch({})).toEqual({ ok: false, error })
    expect(parseFeatureSwitch({ enabled: 'on' })).toEqual({ ok: false, error })
    expect(parseFeatureSwitch({ enabled: 0 })).toEqual({ ok: false, error })
    expect(parseFeatureSwitch({ enabled: true, name: 'studio' })).toEqual({
      ok: false,
      error: 'Unknown field: name',
    })
  })

  it('refuses a body that is not an object', () => {
    for (const value of [null, true, 'enabled', [{ enabled: true }]])
      expect(parseFeatureSwitch(value)).toEqual({
        ok: false,
        error: 'Body must be a JSON object',
      })
  })
})
