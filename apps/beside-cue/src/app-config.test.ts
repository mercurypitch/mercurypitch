// ============================================================
// Beside Cue app config tests — approved cinematic delivery mode
// ============================================================

import { describe, expect, it } from 'vitest'
import { DEFAULT_BESIDE_CUE_CONFIG, V2_BESIDE_CUE_PREVIEW_CONFIG, } from './app-config'
import { CORKY_ONBOARDING_MEDIA_V0_9, validateCinematicOnboardingMediaManifest, } from './onboarding'

describe('Beside Cue app config', () => {
  it('selects the v0.5 product flow with the breathing beat on first run', () => {
    const onboarding = DEFAULT_BESIDE_CUE_CONFIG.onboarding

    expect(onboarding).toMatchObject({
      delivery: 'cinematic-first-run',
      revision: 'corky-onboarding-v0.9',
      contractVersion: '0.5.0',
      media: CORKY_ONBOARDING_MEDIA_V0_9,
    })
    if (onboarding.delivery !== 'cinematic-first-run') {
      throw new Error('Expected the default cinematic-first-run config.')
    }
    expect(validateCinematicOnboardingMediaManifest(onboarding.media)).toEqual(
      [],
    )
  })

  it('keeps V2 behind a separate developer-preview contract', () => {
    expect(V2_BESIDE_CUE_PREVIEW_CONFIG.onboarding).toEqual({
      delivery: 'v2-first-run',
      revision: 'beside-cue-v2-preview-v2',
      contractVersion: '1.0',
      activation: 'developer-preview',
    })
    expect(V2_BESIDE_CUE_PREVIEW_CONFIG.onboarding).not.toBe(
      DEFAULT_BESIDE_CUE_CONFIG.onboarding,
    )
    expect(DEFAULT_BESIDE_CUE_CONFIG.onboarding.delivery).toBe(
      'cinematic-first-run',
    )
    expect(Object.isFrozen(V2_BESIDE_CUE_PREVIEW_CONFIG)).toBe(true)
    expect(Object.isFrozen(V2_BESIDE_CUE_PREVIEW_CONFIG.onboarding)).toBe(true)
  })
})
