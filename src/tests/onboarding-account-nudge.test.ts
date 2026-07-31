import { describe, expect, it } from 'vitest'
import type { NudgeState } from '@/features/onboarding/account-nudge'
import { isNudgeDue, NUDGE_QUIET_DAYS, } from '@/features/onboarding/account-nudge'

const DAY = 24 * 60 * 60 * 1000
const NOW = 1_800_000_000_000

const state = (over: Partial<NudgeState> = {}): NudgeState => ({
  dismissedAt: null,
  satisfied: false,
  ...over,
})

describe('isNudgeDue', () => {
  it('shows an ask that has never been dismissed', () => {
    expect(isNudgeDue(state(), NOW)).toBe(true)
  })

  it('stays quiet for the whole quiet period after a dismissal', () => {
    const dismissed = state({ dismissedAt: NOW })
    expect(isNudgeDue(dismissed, NOW)).toBe(false)
    expect(isNudgeDue(dismissed, NOW + DAY)).toBe(false)
    expect(isNudgeDue(dismissed, NOW + (NUDGE_QUIET_DAYS - 1) * DAY)).toBe(
      false,
    )
  })

  it('comes back once the quiet period has elapsed', () => {
    const dismissed = state({ dismissedAt: NOW })
    expect(isNudgeDue(dismissed, NOW + NUDGE_QUIET_DAYS * DAY)).toBe(true)
    expect(isNudgeDue(dismissed, NOW + 30 * DAY)).toBe(true)
  })

  it('never asks again once an account exists', () => {
    expect(isNudgeDue(state({ satisfied: true }), NOW)).toBe(false)
    // Even long after a dismissal would have expired.
    expect(
      isNudgeDue(state({ satisfied: true, dismissedAt: NOW }), NOW + 365 * DAY),
    ).toBe(false)
  })

  it('does not resurrect on a clock that jumped backwards', () => {
    // A device whose clock moved back must not read as "quiet period
    // elapsed" — the elapsed time is negative, which is < the window.
    const dismissed = state({ dismissedAt: NOW })
    expect(isNudgeDue(dismissed, NOW - 10 * DAY)).toBe(false)
  })
})
