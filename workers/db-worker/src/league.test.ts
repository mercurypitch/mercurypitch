import { describe, expect, it } from 'vitest'
import type { StandingRead } from './league'
import { placeStandings } from './league'

const row = (
  userId: string,
  points: number,
  flags: { named?: number; hidden?: number } = {},
): StandingRead => ({
  userId,
  displayName: userId,
  points,
  named: flags.named ?? 1,
  hidden: flags.hidden ?? 0,
})

describe('the league standings a member is sent', () => {
  it('says which rows show a name, and which are a weekly stand-in', () => {
    const { shown } = placeStandings([
      row('ada', 300),
      // A member who never opted in: a membership id under a pseudonym.
      row('member-7f3a', 200, { named: 0 }),
      row('viewer', 100),
    ])

    expect(shown.map((standing) => [standing.userId, standing.named])).toEqual([
      ['ada', true],
      ['member-7f3a', false],
      ['viewer', true],
    ])
  })

  it('places the whole cohort before it leaves out a member hidden from the viewer', () => {
    const { placed, shown } = placeStandings([
      row('ada', 300, { hidden: 1 }),
      row('ben', 200),
      row('viewer', 100),
    ])

    expect(placed.map((standing) => standing.rank)).toEqual([1, 2, 3])
    expect(shown.map((standing) => [standing.userId, standing.rank])).toEqual([
      ['ben', 2],
      ['viewer', 3],
    ])
  })
})
