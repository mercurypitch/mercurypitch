// ============================================================
// The Legend room's words
// ============================================================

import { describe, expect, it } from 'vitest'
import type { ArchivedWeeklyChallenge, WeeklyBoard, } from '@/features/challenges/weekly-service'
import type { MelodyItem } from '@/types'
import { askLine, closesLine, closesShortLine, countsLine, endedLine, LEGEND_GRACE_MS, litLine, mercLine, missLine, notesLine, rangeLine, rangeSide, standingLine, } from './legend-lines'

const HOUR = 3_600_000
const NOW = Date.parse('2026-10-31T12:00:00Z')

function item(midi: number): MelodyItem {
  return { note: { midi } } as unknown as MelodyItem
}

function board(over: Partial<WeeklyBoard> = {}): WeeklyBoard {
  return {
    top: [],
    attemptedCount: 23,
    rankedCount: 18,
    completedCount: 8,
    targetScore: 70,
    founderScore: 88,
    frozen: false,
    you: null,
    ...over,
  }
}

const YOU = {
  best: 82.4,
  rank: 3,
  percentile: 12,
  beatFounder: false,
  completed: true,
  ranked: true,
}

describe('the close', () => {
  it('is the time left in words, rounded, never a period', () => {
    const at = (ms: number): string => new Date(NOW + ms).toISOString()
    expect(closesLine(at(3 * 24 * HOUR + 2 * HOUR), NOW)).toBe('Ends in 3 days')
    expect(closesLine(at(47 * HOUR + 59 * 60_000), NOW)).toBe('Ends in 2 days')
    expect(closesLine(at(5 * HOUR), NOW)).toBe('Ends in 5 hours')
    expect(closesLine(at(20 * 60_000), NOW)).toBe('Ends in less than an hour')
    expect(closesLine(at(-HOUR), NOW)).toBe(
      'Closing: takes still count for a little longer',
    )
  })

  it('says when a past Legend closed', () => {
    const past = {
      endsAt: '2026-10-19T00:00:00Z',
      results: { closedAt: '2026-10-21T08:00:00Z' },
    } as unknown as ArchivedWeeklyChallenge
    expect(endedLine(past)).toMatch(/^Closed .*21/u)
  })
})

describe('the range', () => {
  const range = { min: 48, max: 67 }

  it('is said, never fixed by moving the line', () => {
    expect(rangeSide([item(60), item(72)], range)).toBe('above')
    expect(rangeSide([item(45), item(60)], range)).toBe('below')
    expect(rangeSide([item(50), item(64)], range)).toBeNull()
    expect(rangeSide([], range)).toBeNull()
    // A note with no pitch is left out, as the rest of the pipeline does.
    const broken = [{} as MelodyItem, item(Number.NaN), item(72)]
    expect(rangeSide(broken, range)).toBe('above')
    expect(rangeLine('above', 'baritone')).toBe(
      'This Legend is written above your baritone range, a feat for another voice. Sing it anyway if you like: it is scored as written.',
    )
  })
})

describe('the board', () => {
  it('counts who sang it, and who completed it', () => {
    expect(countsLine(board())).toBe(
      '23 singers have sung this, 8 completed it',
    )
    expect(countsLine(board({ attemptedCount: 1, completedCount: 0 }))).toBe(
      '1 singer has sung this',
    )
    expect(countsLine(board({ attemptedCount: 0 }))).toBeNull()
  })

  it("says the singer's standing in words, never their rank", () => {
    expect(standingLine(board({ you: YOU }))).toBe(
      'Your best 82%, in the top 12% of 18',
    )
    expect(standingLine(board({ you: { ...YOU, beatFounder: true } }))).toBe(
      'You beat the Founder: your best is 82%',
    )
    expect(
      standingLine(board({ you: { ...YOU, ranked: false, rank: 0 } })),
    ).toBe(
      'Your best 82%. Not on the board: turn on public boards in Account to be ranked.',
    )
    expect(standingLine(board())).toBeNull()
  })
})

describe('the close, in a few words', () => {
  it('says the time left, then Closing through the grace, then nothing', () => {
    const at = (ms: number): string => new Date(NOW + ms).toISOString()
    expect(closesShortLine(at(3 * 24 * HOUR), NOW)).toBe('Ends in 3 days')
    expect(closesShortLine(at(-HOUR), NOW)).toBe('Closing')
    expect(closesShortLine(at(-LEGEND_GRACE_MS + HOUR), NOW)).toBe('Closing')
    expect(closesShortLine(at(-LEGEND_GRACE_MS), NOW)).toBeNull()
    expect(closesShortLine('not a date', NOW)).toBeNull()
  })
})

describe('the take', () => {
  it('says what the Legend asks under a score the number already shows', () => {
    expect(askLine(82, 70)).toBe('The Legend asks for 70%, and you reached it.')
    expect(askLine(55, 70)).toBe('The Legend asks for 70%.')
    // Practice passes no score: what it asks, and nothing on reaching it.
    expect(askLine(null, 70)).toBe('The Legend asks for 70%.')
  })

  it('names the line by its notes, from the lowest to the highest', () => {
    const line = [60, 62, 64, 67, 65, 64, 62, 60].map((midi) => ({ midi }))
    expect(notesLine(line)).toBe('8 notes · C4 to G4')
    expect(notesLine([{ midi: 60 }])).toBe('1 note · C4')
    expect(notesLine([])).toBeNull()
  })

  it('counts the notes lit', () => {
    expect(litLine(7, 8)).toBe('7 of 8 lit')
  })

  it('says which notes were missed, and which way', () => {
    expect(missLine([])).toBeNull()
    expect(missLine([{ label: 'E4', side: 'flat' }])).toBe(
      'E4 missed, sung flat',
    )
    expect(
      missLine([
        { label: 'E4', side: 'flat' },
        { label: 'F4', side: 'sharp' },
      ]),
    ).toBe('E4 flat, F4 sharp')
    expect(
      missLine([
        { label: 'E4', side: 'flat' },
        { label: 'F4', side: 'unsung' },
        { label: 'D4', side: 'unsteady' },
        { label: 'C4', side: 'sharp' },
      ]),
    ).toBe('4 missed: E4 flat, F4 not sung and 2 more')
  })

  it('gives Merc a word for each way a posted take went', () => {
    expect(mercLine('beat-founder')).toBe("The Founder's mark is yours now.")
    expect(mercLine('completed')).toBe('That one is on the board.')
    expect(mercLine('attempted')).toBe(
      'On the board. Every take trains the climb.',
    )
  })

  it('never names a period', () => {
    const lines = [
      closesLine(new Date(NOW + 3 * 24 * HOUR).toISOString(), NOW),
      countsLine(board()),
      standingLine(board({ you: YOU })),
      askLine(82, 70),
      mercLine('attempted'),
      mercLine('completed'),
      mercLine('beat-founder'),
    ].join(' ')
    expect(lines).not.toMatch(
      /\b(weekly|monthly|fortnightly|this week|this month)\b/iu,
    )
  })
})
