import { describe, expect, it } from 'vitest'
import { canActOnStanding, singerOfEntry, withoutBlocked } from './singer-rows'

describe('a league row', () => {
  it('can be acted on when it shows another member’s own name', () => {
    expect(canActOnStanding({ userId: 'ada', named: true }, 'me')).toBe(true)
  })

  it('cannot be acted on as a weekly stand-in, as the viewer’s own, or from an older worker', () => {
    expect(
      canActOnStanding({ userId: 'member-7f3a', named: false }, 'me'),
    ).toBe(false)
    expect(canActOnStanding({ userId: 'me', named: true }, 'me')).toBe(false)
    // A worker before `named` sends none: no row can be told from a stand-in.
    expect(canActOnStanding({ userId: 'ada' }, 'me')).toBe(false)
  })
})

describe('a Legend board entry', () => {
  it('names the singer behind it', () => {
    expect(singerOfEntry({ userId: 'ada', isFounder: false }, 'me')).toBe('ada')
  })

  it('names nobody for the Founder, the viewer, or an entry with no id', () => {
    expect(singerOfEntry({ isFounder: true }, 'me')).toBeNull()
    // Even were the Founder's entry to carry an id, it is nobody's account.
    expect(singerOfEntry({ userId: 'house', isFounder: true }, 'me')).toBeNull()
    expect(singerOfEntry({ userId: 'me', isFounder: false }, 'me')).toBeNull()
    expect(singerOfEntry({ isFounder: false }, 'me')).toBeNull()
  })
})

describe('a block', () => {
  it('drops the blocked singer’s rows and leaves every other place as it was', () => {
    const rows = [
      { userId: 'ada', rank: 1 },
      { userId: 'ben', rank: 2 },
      { userId: null, rank: 3 },
      { userId: 'cleo', rank: 4 },
    ]

    const kept = withoutBlocked(rows, new Set(['ben']), (row) => row.userId)

    expect(kept.map((row) => row.rank)).toEqual([1, 3, 4])
  })
})
