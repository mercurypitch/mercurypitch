// ============================================================
// Funnel event allowlist — client/Worker activation contract
// ============================================================

import { describe, expect, it } from 'vitest'
import { FUNNEL_EVENTS } from './index'

describe('Karaoke activation event allowlist', () => {
  it('accepts every real Karaoke activation milestone', () => {
    for (const event of [
      'karaoke_mic_granted',
      'karaoke_first_pitch',
      'karaoke_first_score',
      'karaoke_scorecard_view',
    ]) {
      expect(FUNNEL_EVENTS.has(event)).toBe(true)
    }
  })

  it('does not accept an unregistered lookalike event', () => {
    expect(FUNNEL_EVENTS.has('karaoke_scorecard_viewed')).toBe(false)
  })
})
