// ============================================================
// The Leagues screen's words
// ============================================================

import { describe, expect, it } from 'vitest'
import type { LeagueMe, LeagueRung } from '@/db/services/league-service'
import { boardLine, cutInWords, nextCutLine, placeLine, pointsWord, rulesLines, rungLine, rungName, zoneLine, } from './league-lines'

function rung(rank: number, over: Partial<LeagueRung> = {}): LeagueRung {
  return {
    id: `l${rank}`,
    rank,
    name: ['', 'Mercling', 'Sparkwing', 'Skyvox'][rank] ?? `Rung ${rank}`,
    trophyAsset: `/leagues/l${rank}.webp`,
    badgeAsset: null,
    isMystery: false,
    promoteCount: 10,
    relegateCount: 10,
    ...over,
  }
}

const NEAR = { up: rung(3), down: rung(1) }
const NONE = { up: undefined, down: undefined }

describe('the place', () => {
  it('reads as words, with the points spelled out', () => {
    const me: LeagueMe = {
      eligible: true,
      rank: 4,
      cohortSize: 23,
      points: 120,
    }
    expect(placeLine(me)).toBe('4th of 23 this week, 120 points')
    expect(placeLine({ ...me, rank: 1, points: 1 })).toBe(
      '1st of 23 this week, 1 point',
    )
    expect(placeLine({ ...me, rank: null })).toBe('No points yet this week')
    expect(pointsWord(0)).toBe('0 points')
  })
})

describe('the zone', () => {
  it('says where the singer is headed, by name', () => {
    expect(zoneLine('promote', NEAR)).toBe('On course to move up to Skyvox')
    expect(zoneLine('demote', NEAR)).toBe('On course to drop to Mercling')
    expect(zoneLine('hold', NEAR)).toBe('Holding your rung')
    expect(zoneLine(null, NEAR)).toBeNull()
  })

  it('still reads before the ladder has', () => {
    expect(zoneLine('promote', NONE)).toBe('On course to move up a rung')
    expect(zoneLine('demote', NONE)).toBe('On course to drop a rung')
  })
})

describe("the rung's rules", () => {
  it('names who moves up and who drops', () => {
    expect(rulesLines(rung(2), NEAR)).toEqual([
      'The top 10 with points move up to Skyvox.',
      'The bottom 10 drop to Mercling.',
    ])
  })

  it('says so on the first rung and the top one', () => {
    expect(
      rulesLines(rung(1, { promoteCount: 15, relegateCount: 0 }), {
        up: rung(2),
        down: undefined,
      }),
    ).toEqual([
      'The top 15 with points move up to Sparkwing.',
      'Nobody drops from this rung.',
    ])
    expect(rulesLines(rung(6, { promoteCount: 0 }), NONE)).toEqual([
      'The highest rung there is for now: hold it.',
      'The bottom 10 drop a rung.',
    ])
  })
})

describe('the next cut', () => {
  it('is days or hours in words, never "3d 4h"', () => {
    const hour = 3_600_000
    expect(cutInWords(3 * 24 * hour + 4 * hour)).toBe('3 days')
    expect(cutInWords(30 * hour)).toBe('a day')
    expect(cutInWords(5 * hour + 10 * 60_000)).toBe('5 hours')
    expect(cutInWords(hour + 1)).toBe('an hour')
    expect(cutInWords(20 * 60_000)).toBe('less than an hour')
    expect(nextCutLine(2 * 24 * hour)).toBe('The next cut is in 2 days')
  })

  it('rounds to the nearest unit, never to half the time left', () => {
    const hour = 3_600_000
    const minute = 60_000
    expect(cutInWords(47 * hour + 59 * minute)).toBe('2 days')
    expect(cutInWords(36 * hour)).toBe('2 days')
    expect(cutInWords(35 * hour)).toBe('a day')
    expect(cutInWords(23 * hour + 40 * minute)).toBe('a day')
    expect(cutInWords(hour + 59 * minute)).toBe('2 hours')
    expect(cutInWords(59 * minute)).toBe('an hour')
    expect(cutInWords(6 * 24 * hour + 23 * hour)).toBe('7 days')
  })
})

describe('the board and the ladder', () => {
  it('says what each line across the board means', () => {
    expect(boardLine('promote', 'Skyvox')).toBe('Above this line, up to Skyvox')
    expect(boardLine('demote', 'Mercling')).toBe(
      'Below this line, down to Mercling',
    )
    expect(boardLine('promote', undefined)).toBe('Above this line, up a rung')
  })

  it('names the mystery rung for what it is, and veils what is above', () => {
    const mystery = rung(7, { name: '???', isMystery: true })
    expect(rungName(mystery)).toBe('Coming soon')
    expect(rungLine(mystery, 2, true)).toBe('A league still to come')
    expect(rungLine(rung(2), 2, true)).toBe('Your league')
    expect(rungLine(rung(3), 2, false)).toBe(
      'Reach Skyvox to unveil its trophy',
    )
    expect(rungLine(rung(1), 2, true)).toBeNull()
  })
})
