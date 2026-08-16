// ============================================================
// Beside Cue app config tests — guarded cinematic delivery mode
// ============================================================

import { describe, expect, it } from 'vitest'
import { DEFAULT_BESIDE_CUE_CONFIG } from './app-config'

describe('Beside Cue app config', () => {
  it('keeps cinematic onboarding off the first-run path until Phase 5 media lands', () => {
    expect(DEFAULT_BESIDE_CUE_CONFIG.onboarding).toMatchObject({
      delivery: 'welcome-only',
      revision: 'cinematic-onboarding-v0.2-architecture',
      contractVersion: '0.2.0',
    })
    expect('media' in DEFAULT_BESIDE_CUE_CONFIG.onboarding).toBe(false)
  })
})
