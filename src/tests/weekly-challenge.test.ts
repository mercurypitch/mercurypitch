// ============================================================
// Weekly Legend — pure client logic tests
// ============================================================

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { needsSignIn } from '@/db/services/auth-service'
import { saveSessionRecord } from '@/db/services/session-service'
import { clearChallengeResult, lastChallengeResult, } from '@/features/challenges/challenge-result-store'
import { practisePastChallenge } from '@/features/challenges/PastWeeklyChallenges'
import { activeWeeklyAttempt, beginWeeklyAttempt, clearWeeklyAttempt, recordWeeklyAttempt, weeklyAttemptComparabilityKey, weeklyTier, } from '@/features/challenges/weekly-attempt'
import { hoursUntil, melodyItemsToNotes, notesToMelodyItems, parseTargetNotes, } from '@/features/challenges/weekly-service'
import { TAB_HOME } from '@/features/tabs/constants'
import { showActionNotification, showNotification, } from '@/stores/notifications-store'
import { activeTab, challengeStageLaunch, closeChallengeStage, setActiveTab, } from '@/stores/ui-store'

vi.mock('@/db/services/session-service', () => ({
  saveSessionRecord: vi.fn(async () => ({})),
}))
vi.mock('@/db/services/auth-service', () => ({
  needsSignIn: vi.fn(() => false),
}))
vi.mock('@/db/services/badge-grant-engine', () => ({
  checkAndGrantBadges: vi.fn(async () => undefined),
  grantBadgeByRef: vi.fn(async () => undefined),
}))
vi.mock('@/lib/analytics', () => ({ trackEvent: vi.fn() }))
vi.mock('@/stores/notifications-store', () => ({
  removeNotification: vi.fn(),
  removeNotificationsByChannel: vi.fn(),
  showActionNotification: vi.fn(() => 1),
  showNotification: vi.fn(),
  TOUR_OFFER_CHANNEL: 'tour-offer',
}))

afterEach(() => {
  clearWeeklyAttempt()
  clearChallengeResult()
})

describe('weeklyTier', () => {
  it('grades below target as attempted', () => {
    expect(weeklyTier(60, 70, null)).toBe('attempted')
  })

  it('grades meeting the target as completed', () => {
    expect(weeklyTier(70, 70, null)).toBe('completed')
    expect(weeklyTier(85, 70, null)).toBe('completed')
  })

  it('grades beating the founder as beat-founder (outranks completed)', () => {
    expect(weeklyTier(95, 70, 90)).toBe('beat-founder')
  })

  it('needs a strictly higher score than the founder', () => {
    // Tying the founder is not beating them.
    expect(weeklyTier(90, 70, 90)).toBe('completed')
  })

  it('ignores the founder when no seed score exists', () => {
    expect(weeklyTier(95, 70, null)).toBe('completed')
    expect(weeklyTier(95, 70, undefined)).toBe('completed')
  })
})

describe('weekly attempt comparability', () => {
  it('keys the exact scored note task and omits unknown targets', () => {
    const target = {
      challengeId: 'w1',
      title: 'Vincero',
      exercise: 'sight-singing' as const,
      targetScore: 70,
      targetItems: notesToMelodyItems('G3 C4 E4'),
    }
    expect(weeklyAttemptComparabilityKey(target)).toBe(
      weeklyAttemptComparabilityKey({ ...target }),
    )
    expect(weeklyAttemptComparabilityKey(target)).not.toBe(
      weeklyAttemptComparabilityKey({
        ...target,
        targetItems: notesToMelodyItems('G3 C4 F4'),
      }),
    )
    expect(
      weeklyAttemptComparabilityKey({ ...target, targetItems: undefined }),
    ).toBeUndefined()
  })
})

describe('recordWeeklyAttempt', () => {
  it('presents the result without navigating away from the challenge stage', async () => {
    setActiveTab(TAB_HOME)
    beginWeeklyAttempt({
      challengeId: 'w-overlay',
      title: 'Vincero',
      exercise: 'sight-singing',
      targetScore: 70,
    })

    await recordWeeklyAttempt({ type: 'sight-singing', score: 80 })

    expect(activeTab()).toBe(TAB_HOME)
  })

  it('consumes exactly one matching run, then disarms', async () => {
    beginWeeklyAttempt({
      challengeId: 'w1',
      title: 'The Impossible Note',
      exercise: 'sight-singing',
      targetScore: 70,
    })

    expect(
      await recordWeeklyAttempt({ type: 'sight-singing', score: 80 }),
    ).toBe(true)
    // The next same-type run is ordinary practice — staying armed used to
    // post every later sight-singing run to the Legend board.
    expect(activeWeeklyAttempt()).toBe(null)
    expect(
      await recordWeeklyAttempt({ type: 'sight-singing', score: 95 }),
    ).toBe(false)
  })

  it('tells the follow-up same-type run it was a practice round, once', async () => {
    beginWeeklyAttempt({
      challengeId: 'w3',
      title: 'Vincero',
      exercise: 'sight-singing',
      targetScore: 70,
    })
    await recordWeeklyAttempt({ type: 'sight-singing', score: 80 })
    vi.mocked(showNotification).mockClear()

    await recordWeeklyAttempt({ type: 'sight-singing', score: 90 })
    expect(showNotification).toHaveBeenCalledTimes(1)
    expect(vi.mocked(showNotification).mock.calls[0][0]).toContain(
      'Practice round',
    )

    // No nagging: further runs stay quiet until another attempt is armed.
    await recordWeeklyAttempt({ type: 'sight-singing', score: 91 })
    expect(showNotification).toHaveBeenCalledTimes(1)
  })

  it('a mismatched run disarms without being consumed', async () => {
    beginWeeklyAttempt({
      challengeId: 'w2',
      title: 'T',
      exercise: 'sight-singing',
      targetScore: 70,
    })
    expect(await recordWeeklyAttempt({ type: 'vibrato', score: 50 })).toBe(
      false,
    )
    expect(activeWeeklyAttempt()).toBe(null)
  })

  it('hands the Exercise capture outcome to the Legend result', async () => {
    beginWeeklyAttempt({
      challengeId: 'w4',
      title: 'A New Line',
      exercise: 'sight-singing',
      targetScore: 75,
    })
    const voiceCapture = { state: 'unsupported', take: null } as const

    await recordWeeklyAttempt({
      type: 'sight-singing',
      score: 82,
      voiceCapture,
    })

    expect(lastChallengeResult()?.voiceCapture).toBe(voiceCapture)
  })
})

describe('hoursUntil', () => {
  it('floors at zero for a past deadline', () => {
    expect(hoursUntil('2000-01-01T00:00:00Z')).toBe(0)
  })

  it('returns a positive count for a future deadline', () => {
    const inTwoDays = new Date(Date.now() + 2 * 86_400_000).toISOString()
    expect(hoursUntil(inTwoDays)).toBeGreaterThanOrEqual(47)
  })
})

describe('past weekly challenge practice', () => {
  it('disarms a live-week take and opens the archive melody unranked', () => {
    beginWeeklyAttempt({
      challengeId: 'current-week',
      title: 'Current Legend',
      exercise: 'sight-singing',
      targetScore: 70,
    })

    practisePastChallenge({
      id: 'past-week',
      slug: 'past-week',
      title: 'Past Legend',
      description: 'A finished melody.',
      featType: 'sustain',
      voiceTypeSplit: null,
      difficulty: 'beginner',
      targetItems: notesToMelodyItems('C4 C4'),
      targetScore: 60,
      hearItUrl: null,
      startsAt: '2026-07-20T00:00:00.000Z',
      endsAt: '2026-07-27T00:00:00.000Z',
      rewardBadgeId: null,
      founderScore: null,
      founderTrace: null,
      status: 'closed',
    })

    expect(activeWeeklyAttempt()).toBe(null)
    expect(challengeStageLaunch()).toMatchObject({
      challengeId: 'past-week',
      mode: 'practice',
    })
    closeChallengeStage()
  })
})

describe('target-note (de)serialization', () => {
  it('renders note + octave exactly once (no doubled octave)', () => {
    const items = notesToMelodyItems('G3 C4 E4 D4')
    const rendered = melodyItemsToNotes(items)
    expect(rendered).toBe('G3 C4 E4 D4')
    expect(rendered).not.toMatch(/\d\d/) // guards against the "G33" bug
  })

  it('stores the bare letter in note.name (renderers append the octave)', () => {
    // Pin the field itself: midiToNoteName returns "G3", but NoteName is
    // letter-only and canvases render name + octave — "G33" otherwise.
    const items = notesToMelodyItems('G3 C#4')
    expect(items[0].note.name).toBe('G')
    expect(items[1].note.name).toBe('C#')
    // Negative octaves must strip too (midi 0 is "C-1").
    expect(notesToMelodyItems('C-1')[0].note.name).toBe('C')
  })

  it('round-trips cleanly (parse -> render -> parse is stable)', () => {
    const first = notesToMelodyItems('A2 F#4 Bb3')
    const rendered = melodyItemsToNotes(first) // flats normalize to sharps (Bb3 -> A#3)
    const second = notesToMelodyItems(rendered)
    expect(melodyItemsToNotes(second)).toBe(rendered)
    expect(second.map((i) => i.note.midi)).toEqual(
      first.map((i) => i.note.midi),
    )
  })
})

// ── Saying WHY a Legend attempt was not saved ────────────────────────
//
// The message used to be "We couldn't save that Legend attempt" whatever the
// reason, which names the effect and withholds the cause — so a singer who
// simply needs to sign in retries the line, and it fails again identically.
describe('a Legend attempt that could not be saved', () => {
  function armAttempt(): void {
    beginWeeklyAttempt({
      challengeId: 'w-save',
      title: 'Nessun Dorma',
      exercise: 'sight-singing',
      targetScore: 70,
    })
  }

  beforeEach(() => {
    vi.mocked(showNotification).mockClear()
    vi.mocked(showActionNotification).mockClear()
    vi.mocked(needsSignIn).mockReturnValue(false)
    vi.mocked(saveSessionRecord).mockResolvedValue(null)
  })

  afterEach(() => {
    vi.mocked(saveSessionRecord).mockResolvedValue(
      {} as Awaited<ReturnType<typeof saveSessionRecord>>,
    )
  })

  it('asks the singer to sign in when that is the actual reason', async () => {
    // The state this fires in is specific: an anonymous account that was
    // upgraded and then signed out of, where the server refuses anonymous
    // re-auth for the device. Nothing about it looks like a network fault to
    // the singer, and nothing about it fixes itself.
    vi.mocked(needsSignIn).mockReturnValue(true)
    armAttempt()

    await recordWeeklyAttempt({ type: 'sight-singing', score: 80 })

    expect(showActionNotification).toHaveBeenCalledTimes(1)
    const [message, , action] = vi.mocked(showActionNotification).mock.calls[0]
    expect(message).toContain('Sign in to post Legend scores')
    // Names both losses, because the practice row is not written either.
    expect(message).toContain('not in your practice history')
    expect(action.label).toBe('Sign in')
    // No second, contradictory toast.
    expect(showNotification).not.toHaveBeenCalled()
  })

  it('does not blame the singer when the cause is not a missing sign-in', async () => {
    armAttempt()

    await recordWeeklyAttempt({ type: 'sight-singing', score: 80 })

    expect(showNotification).toHaveBeenCalledTimes(1)
    const message = vi.mocked(showNotification).mock.calls[0][0]
    expect(message).toContain("couldn't save that Legend attempt")
    // Telling somebody to sign in when they already are is worse than vague.
    expect(message).not.toContain('Sign in')
    expect(showActionNotification).not.toHaveBeenCalled()
  })
})

describe('parseTargetNotes', () => {
  it('names the tokens it could not read instead of dropping them', () => {
    // The silent drop is the bug: six notes in, five saved, no warning.
    const { items, rejected } = parseTargetNotes('Bb4 H4 D5')

    expect(items.map((i) => i.note.midi)).toEqual([70, 74])
    expect(rejected).toEqual(['H4'])
  })

  it('keeps every note when the list is written with unicode flats', () => {
    const { items, rejected } = parseTargetNotes('B♭4 A4 B♭4 D5 C5 B♭4')

    expect(rejected).toEqual([])
    expect(items.map((i) => i.note.midi)).toEqual([70, 69, 70, 74, 72, 70])
  })

  it('rejects nothing for a list it reads in full', () => {
    expect(parseTargetNotes('G4 A4 B4').rejected).toEqual([])
  })

  it('numbers the surviving notes consecutively when one is rejected', () => {
    // ids/startBeats come from the loop index — skipping a token used to
    // leave a hole, and the stage reads startBeat as the playback position.
    const { items } = parseTargetNotes('G4 H4 B4')

    expect(items.map((i) => i.id)).toEqual([1, 2])
    expect(items.map((i) => i.startBeat)).toEqual([0, 1])
  })
})
