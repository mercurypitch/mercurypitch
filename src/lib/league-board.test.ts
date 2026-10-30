// ============================================================
// The league board reads the cut the server makes (league-cut.ts)
// ============================================================

import { describe, expect, it } from 'vitest'
import type { LeagueMe, LeagueRung, LeagueStanding, } from '@/db/services/league-service'
import type { LeagueBoardItem } from './league-board'
import { leagueBoard, leagueNeighbours, leagueWeekStart, leagueZoneOf, ordinal, rungRevealed, } from './league-board'

function rung(rank: number, over: Partial<LeagueRung> = {}): LeagueRung {
  return {
    id: `l${rank}`,
    rank,
    name: `Rung ${rank}`,
    trophyAsset: `/leagues/l${rank}.webp`,
    badgeAsset: null,
    isMystery: false,
    promoteCount: 10,
    relegateCount: 10,
    ...over,
  }
}

const LADDER: LeagueRung[] = [
  rung(1, { name: 'Mercling', promoteCount: 15, relegateCount: 0 }),
  rung(2, { name: 'Sparkwing' }),
  rung(3, { name: 'Skyvox' }),
  rung(6, { name: 'Mercapex', promoteCount: 0 }),
  rung(7, { name: '???', isMystery: true, promoteCount: 0, relegateCount: 0 }),
]

/** A cohort's standings, best first, with these points. */
function standings(points: number[]): LeagueStanding[] {
  return points.map((p, i) => ({
    userId: `u${i + 1}`,
    displayName: `Singer ${i + 1}`,
    points: p,
    rank: i + 1,
  }))
}

function me(
  points: number[],
  league: LeagueRung,
  over: Partial<LeagueMe> = {},
): LeagueMe {
  return {
    eligible: true,
    weekStart: '2026-10-26T00:00:00.000Z',
    league,
    points: points[0],
    rank: 1,
    cohortSize: points.length,
    standings: standings(points),
    ...over,
  }
}

/** The board as a string: P, H, D per row, and ^ / v for the lines. */
function shape(items: LeagueBoardItem[]): string {
  return items
    .map((item) =>
      item.kind === 'line'
        ? item.zone === 'promote'
          ? '^'
          : 'v'
        : item.zone === 'promote'
          ? 'P'
          : item.zone === 'demote'
            ? 'D'
            : 'H',
    )
    .join('')
}

const descending = (n: number, from = 300): number[] =>
  Array.from({ length: n }, (_, i) => from - i)

describe('the league board', () => {
  it('moves the top ten up and drops the bottom ten of a full cohort', () => {
    const items = leagueBoard(me(descending(30), LADDER[1]), LADDER)
    expect(shape(items)).toBe(
      `${'P'.repeat(10)}^${'H'.repeat(10)}v${'D'.repeat(10)}`,
    )
    expect(items.find((item) => item.kind === 'line')).toEqual({
      kind: 'line',
      zone: 'promote',
      to: 'Skyvox',
    })
  })

  it('moves only members with points up, as the cut does', () => {
    const points = [40, 20, 5, ...Array<number>(27).fill(0)]
    const items = leagueBoard(me(points, LADDER[1]), LADDER)
    expect(shape(items)).toBe(`PPP^${'H'.repeat(17)}v${'D'.repeat(10)}`)
  })

  it('never drops a member who moves up, in a small cohort', () => {
    const points = [...descending(8), 0, 0, 0, 0]
    expect(shape(leagueBoard(me(points, LADDER[1]), LADDER))).toBe(
      `${'P'.repeat(8)}^vDDDD`,
    )
  })

  it('drops nobody from the first rung', () => {
    expect(shape(leagueBoard(me(descending(20), LADDER[0]), LADDER))).toBe(
      `${'P'.repeat(15)}^${'H'.repeat(5)}`,
    )
  })

  it('moves nobody up from the top playable rung', () => {
    const shown = shape(leagueBoard(me(descending(20), LADDER[3]), LADDER))
    expect(shown).toBe(`${'H'.repeat(10)}v${'D'.repeat(10)}`)
  })

  it('draws the relegation line from the whole cohort, not the rows sent', () => {
    // The server sends the top 50 of an 80-strong cohort: the bottom ten
    // are all past the rows on the phone.
    const sent = me(descending(50), LADDER[1], { cohortSize: 80 })
    expect(shape(leagueBoard(sent, LADDER))).toBe(
      `${'P'.repeat(10)}^${'H'.repeat(40)}`,
    )
  })

  it('names the zone of every row the same way for the singer on it', () => {
    for (const points of [
      descending(30),
      [40, 20, 5, ...Array<number>(27).fill(0)],
      [...descending(8), 0, 0, 0, 0],
    ]) {
      for (const league of [LADDER[0], LADDER[1], LADDER[3]]) {
        const items = leagueBoard(me(points, league), LADDER)
        const rows = items.filter(
          (item): item is Extract<LeagueBoardItem, { kind: 'row' }> =>
            item.kind === 'row',
        )
        rows.forEach((item, index) => {
          const own = me(points, league, {
            rank: index + 1,
            points: points[index],
          })
          expect(leagueZoneOf(own), `${league.name}, row ${index + 1}`).toBe(
            item.zone,
          )
        })
      }
    }
  })

  it('puts a singer with no points in the top ten in the holding zone', () => {
    // What the Progress card called "Promotion zone": the cut would not
    // move them, because they have no points this week.
    const points = [10, 0, ...Array<number>(18).fill(0)]
    expect(leagueZoneOf(me(points, LADDER[1], { rank: 2, points: 0 }))).toBe(
      'hold',
    )
  })

  it('has no zone without a place this week', () => {
    expect(leagueZoneOf(me([0], LADDER[1], { rank: null }))).toBeNull()
    expect(leagueZoneOf({ eligible: false, reason: 'anonymous' })).toBeNull()
  })
})

describe('the ladder', () => {
  it('never names the mystery rung as the one a promotion reaches', () => {
    expect(leagueNeighbours(6, LADDER)).toEqual({
      up: undefined,
      down: undefined,
    })
    expect(leagueNeighbours(2, LADDER)).toEqual({
      up: LADDER[2],
      down: LADDER[0],
    })
  })

  it('veils every rung above the singer, and shows the mystery one', () => {
    expect(rungRevealed(LADDER[0], undefined)).toBe(true)
    expect(rungRevealed(LADDER[1], undefined)).toBe(false)
    expect(rungRevealed(LADDER[1], 2)).toBe(true)
    expect(rungRevealed(LADDER[2], 2)).toBe(false)
    expect(rungRevealed(LADDER[4], 1)).toBe(true)
  })
})

describe('the words', () => {
  it('writes a place as an ordinal', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 101, 111].map(ordinal)).toEqual(
      [
        '1st',
        '2nd',
        '3rd',
        '4th',
        '11th',
        '12th',
        '13th',
        '21st',
        '22nd',
        '23rd',
        '101st',
        '111th',
      ],
    )
  })
})

describe('the league week', () => {
  it('starts on Monday at midnight UTC, as the server counts it', () => {
    expect(leagueWeekStart(Date.parse('2026-11-01T23:59:00Z'))).toBe(
      '2026-10-26T00:00:00.000Z',
    )
    expect(leagueWeekStart(Date.parse('2026-11-02T00:00:00Z'))).toBe(
      '2026-11-02T00:00:00.000Z',
    )
  })
})
