// Render quality policy tests — mobile selection is stable and cached shadows stay bounded.

import { describe, expect, it } from 'vitest'
import { createShadowUpdateCadence, effectiveGlassPixelRatio, parseGlassRenderQualityPreference, resolveGlassRenderQuality, } from './render-quality'

const DESKTOP = {
  cssWidth: 1440,
  cssHeight: 900,
  coarsePointer: false,
  mobileHint: false,
}

describe('glass render quality', () => {
  it('preserves explicit choices and falls malformed persistence back to auto', () => {
    expect(parseGlassRenderQualityPreference('high')).toBe('high')
    expect(parseGlassRenderQualityPreference('balanced')).toBe('balanced')
    expect(parseGlassRenderQualityPreference('auto')).toBe('auto')
    expect(parseGlassRenderQualityPreference('fastest')).toBe('auto')
    expect(parseGlassRenderQualityPreference(null)).toBe('auto')
  })

  it('keeps fine-pointer desktop high and selects balanced for a compact touch viewport', () => {
    expect(resolveGlassRenderQuality('auto', DESKTOP).profile).toBe('high')
    expect(
      resolveGlassRenderQuality('auto', {
        cssWidth: 390,
        cssHeight: 844,
        coarsePointer: true,
        mobileHint: false,
      }).profile,
    ).toBe('balanced')
  })

  it('uses the device mobile hint without treating a temporary zero-size container as compact', () => {
    expect(
      resolveGlassRenderQuality('auto', {
        cssWidth: 0,
        cssHeight: 0,
        coarsePointer: true,
        mobileHint: false,
      }).profile,
    ).toBe('high')
    expect(
      resolveGlassRenderQuality('auto', {
        ...DESKTOP,
        mobileHint: true,
      }).profile,
    ).toBe('balanced')
  })

  it('keeps current high settings and bounds balanced DPR without upscaling', () => {
    const high = resolveGlassRenderQuality('high', DESKTOP)
    const balanced = resolveGlassRenderQuality('balanced', DESKTOP)
    expect(high).toEqual({
      profile: 'high',
      maximumPixelRatio: 1.5,
      shadowFrameInterval: 1,
      shadowMapSize: 1024,
      transmissionResolutionScale: 0.5,
    })
    expect(balanced).toEqual({
      profile: 'balanced',
      maximumPixelRatio: 1.25,
      shadowFrameInterval: 2,
      shadowMapSize: 1024,
      transmissionResolutionScale: 0.5,
    })
    expect(effectiveGlassPixelRatio(3, high)).toBe(1.5)
    expect(effectiveGlassPixelRatio(3, balanced)).toBe(1.25)
    expect(effectiveGlassPixelRatio(1, balanced)).toBe(1)
  })
})

describe('shadow update cadence', () => {
  it('updates every high-quality frame', () => {
    const cadence = createShadowUpdateCadence(1)
    expect([cadence.next(), cadence.next(), cadence.next()]).toEqual([
      true,
      true,
      true,
    ])
  })

  it('reuses at most one balanced frame and honors invalidation immediately', () => {
    const cadence = createShadowUpdateCadence(2)
    expect([cadence.next(), cadence.next(), cadence.next()]).toEqual([
      true,
      false,
      true,
    ])
    cadence.invalidate()
    expect(cadence.next()).toBe(true)
    expect(cadence.next()).toBe(false)
    expect(cadence.next()).toBe(true)
  })

  it('invalidates when the quality interval changes', () => {
    const cadence = createShadowUpdateCadence(1)
    cadence.next()
    cadence.setInterval(2)
    expect([cadence.next(), cadence.next(), cadence.next()]).toEqual([
      true,
      false,
      true,
    ])
  })
})
