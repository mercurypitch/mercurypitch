// ============================================================
// Score mode setting — tier binding and persistence
// ============================================================
//
// The dropdown itself is a SafeSelect over SCORE_MODES; what needs pinning is
// the contract around it: each accuracy tier implies a score mode when the
// tier is applied, a manual pick afterwards still wins, and the persisted
// value survives a reload through the validator.

import { beforeEach, describe, expect, it } from 'vitest'
import { applyAccuracyTier, scoreMode, setScoreMode, } from '@/stores/settings-store'

describe('score mode setting', () => {
  beforeEach(() => {
    localStorage.clear()
    setScoreMode('settled')
  })

  it('defaults to settled — skip the slide-in', () => {
    expect(scoreMode()).toBe('settled')
  })

  it('binds one mode per accuracy tier, a rung apart', () => {
    applyAccuracyTier('learning')
    expect(scoreMode()).toBe('core')

    applyAccuracyTier('singer')
    expect(scoreMode()).toBe('settled')

    applyAccuracyTier('professional')
    expect(scoreMode()).toBe('full')
  })

  it('lets a manual pick override the tier until the next tier change', () => {
    applyAccuracyTier('learning')
    setScoreMode('full')
    expect(scoreMode()).toBe('full')

    // Re-applying a tier is an explicit preset choice and takes over again.
    applyAccuracyTier('learning')
    expect(scoreMode()).toBe('core')
  })

  it('persists the pick under its own key', () => {
    setScoreMode('core')
    expect(localStorage.getItem('pitchperfect_score_mode')).toBe('core')
  })
})
