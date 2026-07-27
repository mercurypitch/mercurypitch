// ============================================================
// Weekly league cut — pure promotion/relegation rules
// ============================================================
//
// The rules the whole ladder hangs on: inactive members never promote,
// the bottom M relegate (inactive first), the grace rung never drops
// anyone, the top playable rung never promotes, and ordering is
// deterministic so a re-run decides the same moves.

import { describe, expect, it } from 'vitest'
import type { CutMember, CutRung } from '../../workers/db-worker/src/league-cut'
import { computeCohortCut, orderStandings, } from '../../workers/db-worker/src/league-cut'

const rung = (over: Partial<CutRung> = {}): CutRung => ({
  promoteCount: 2,
  relegateCount: 2,
  upLeagueId: 'l3',
  downLeagueId: 'l1',
  ...over,
})

const m = (userId: string, points: number): CutMember => ({ userId, points })

describe('orderStandings', () => {
  it('orders by points desc with userId as a deterministic tiebreak', () => {
    const ordered = orderStandings([m('b', 10), m('c', 20), m('a', 10)])
    expect(ordered.map((x) => x.userId)).toEqual(['c', 'a', 'b'])
  })
})

describe('computeCohortCut', () => {
  it('promotes the top N active and relegates the bottom M', () => {
    const moves = computeCohortCut(
      [m('u1', 50), m('u2', 40), m('u3', 30), m('u4', 20), m('u5', 10)],
      rung(),
    )
    expect(moves).toEqual([
      { userId: 'u1', toLeagueId: 'l3', kind: 'promote' },
      { userId: 'u2', toLeagueId: 'l3', kind: 'promote' },
      { userId: 'u5', toLeagueId: 'l1', kind: 'relegate' },
      { userId: 'u4', toLeagueId: 'l1', kind: 'relegate' },
    ])
  })

  it('never promotes inactive members, even with empty promote slots', () => {
    // Only one active member — the second promote slot must go unfilled
    // rather than dragging a zero-point member up a rung.
    const moves = computeCohortCut(
      [m('active', 5), m('idle1', 0), m('idle2', 0)],
      rung({ relegateCount: 0, downLeagueId: null }),
    )
    expect(moves).toEqual([
      { userId: 'active', toLeagueId: 'l3', kind: 'promote' },
    ])
  })

  it('relegates inactive members first (they sit at the bottom)', () => {
    const moves = computeCohortCut(
      [m('u1', 30), m('u2', 20), m('idle', 0)],
      rung({ relegateCount: 1 }),
    )
    expect(moves).toContainEqual({
      userId: 'idle',
      toLeagueId: 'l1',
      kind: 'relegate',
    })
    expect(moves.filter((x) => x.kind === 'relegate')).toHaveLength(1)
  })

  it('grace rung: relegation disabled via downLeagueId null', () => {
    const moves = computeCohortCut(
      [m('u1', 10), m('idle', 0)],
      rung({ downLeagueId: null }),
    )
    expect(moves.every((x) => x.kind === 'promote')).toBe(true)
  })

  it('top playable rung: promotion disabled via upLeagueId null', () => {
    const moves = computeCohortCut(
      [m('u1', 99), m('u2', 1), m('idle', 0)],
      rung({ upLeagueId: null, relegateCount: 1 }),
    )
    expect(moves).toEqual([
      { userId: 'idle', toLeagueId: 'l1', kind: 'relegate' },
    ])
  })

  it('never both promotes and relegates the same member in a tiny cohort', () => {
    // Two members, promote 2, relegate 2: the promoted pair must not also
    // fill the relegation quota.
    const moves = computeCohortCut([m('u1', 10), m('u2', 5)], rung())
    const byUser = new Map<string, number>()
    for (const mv of moves)
      byUser.set(mv.userId, (byUser.get(mv.userId) ?? 0) + 1)
    expect([...byUser.values()].every((n) => n === 1)).toBe(true)
    expect(moves.every((x) => x.kind === 'promote')).toBe(true)
  })

  it('handles an empty cohort', () => {
    expect(computeCohortCut([], rung())).toEqual([])
  })
})
