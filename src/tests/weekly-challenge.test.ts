// ============================================================
// Weekly Legend — pure client logic tests
// ============================================================

import { describe, expect, it, vi } from 'vitest'
import { activeWeeklyAttempt, beginWeeklyAttempt, recordWeeklyAttempt, weeklyTier, } from '@/features/challenges/weekly-attempt'
import { hoursUntil, melodyItemsToNotes, notesToMelodyItems, } from '@/features/challenges/weekly-service'
import { showNotification } from '@/stores/notifications-store'

vi.mock('@/db/services/session-service', () => ({
  saveSessionRecord: vi.fn(async () => ({})),
}))
vi.mock('@/db/services/badge-grant-engine', () => ({
  checkAndGrantBadges: vi.fn(async () => undefined),
  grantBadgeByRef: vi.fn(async () => undefined),
}))
vi.mock('@/lib/analytics', () => ({ trackEvent: vi.fn() }))
vi.mock('@/stores/notifications-store', () => ({ showNotification: vi.fn() }))

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

describe('recordWeeklyAttempt', () => {
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
