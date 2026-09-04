// ============================================================
// Beside Cue app config tests — single V2 product delivery
// ============================================================

import { describe, expect, it } from 'vitest'
import { DEFAULT_BESIDE_CUE_CONFIG } from './app-config'

describe('Beside Cue app config', () => {
  it('selects caption-first V2 as the only default first-run flow', () => {
    const onboarding = DEFAULT_BESIDE_CUE_CONFIG.onboarding

    expect(onboarding).toEqual({
      delivery: 'v2-first-run',
      revision: 'beside-cue-v2.5-main-v1',
      contractVersion: '1.0',
    })
    expect(Object.isFrozen(DEFAULT_BESIDE_CUE_CONFIG)).toBe(true)
    expect(Object.isFrozen(onboarding)).toBe(true)
  })
})
