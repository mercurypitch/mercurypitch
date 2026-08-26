// ============================================================
// Beside Cue app config tests — approved cinematic delivery mode
// ============================================================

import { describe, expect, it } from 'vitest'
import { DEFAULT_BESIDE_CUE_CONFIG } from './app-config'
import { CORKY_ONBOARDING_MEDIA_V0_8, validateCinematicOnboardingMediaManifest, } from './onboarding'

describe('Beside Cue app config', () => {
  it('selects the v0.4 product flow over approved picture on first run', () => {
    const onboarding = DEFAULT_BESIDE_CUE_CONFIG.onboarding

    expect(onboarding).toMatchObject({
      delivery: 'cinematic-first-run',
      revision: 'corky-onboarding-v0.8',
      contractVersion: '0.4.0',
      media: CORKY_ONBOARDING_MEDIA_V0_8,
    })
    if (onboarding.delivery !== 'cinematic-first-run') {
      throw new Error('Expected the default cinematic-first-run config.')
    }
    expect(validateCinematicOnboardingMediaManifest(onboarding.media)).toEqual(
      [],
    )
  })
})
