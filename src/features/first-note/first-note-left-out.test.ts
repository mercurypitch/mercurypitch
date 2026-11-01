// ============================================================
// Why a song of the singer's own sits out: counted, and said
// ============================================================
//
// first-note-left-out.ts counts a read's reasons (the ones entry-rules.ts
// gives and the log tells) and says them on the Songs sheet's "i".

import { describe, expect, it } from 'vitest'
import { isLeftOut, leftKind, leftOutOf, leftOutWords, } from './first-note-left-out'

describe('the reasons a read gives', () => {
  it('are each of one kind, as the rules word them', () => {
    expect(leftKind('16.02 no steady note')).toBe('unsteady')
    expect(leftKind('16.02 no steady note (a pitch in 40% of its voice)')).toBe(
      'unsteady',
    )
    expect(leftKind('30.52 the note settles 0.66 s in')).toBe('late')
    expect(leftKind('71.52 YIN C4, notes A3')).toBe('disagree')
    expect(leftKind('101.92 36 cents off G3')).toBe('offKey')
    expect(leftKind("12.00 C5 is far from the song's A3")).toBe('farOff')
    expect(leftKind('no notes')).toBeNull()
  })

  it('are counted with the lines looked at and those with no breath', () => {
    expect(
      leftOutOf({
        lines: 58,
        breathless: 42,
        dropped: [
          '16.02 no steady note',
          '150.62 no steady note (a pitch in 12% of its voice)',
          '30.52 the note settles 0.66 s in',
          'no notes',
        ],
      }),
    ).toEqual({ lines: 58, breathless: 42, left: { unsteady: 2, late: 1 } })
    // A read that heard no notes looked at no lines.
    expect(leftOutOf({ dropped: ['no notes'] })).toEqual({
      lines: 0,
      breathless: 0,
      left: {},
    })
  })

  it('are kept only as counts', () => {
    expect(isLeftOut({ lines: 58, breathless: 42, left: { late: 1 } })).toBe(
      true,
    )
    expect(isLeftOut({ lines: 58, breathless: 42, left: { late: -1 } })).toBe(
      false,
    )
    expect(isLeftOut({ lines: 58, left: {} })).toBe(false)
    expect(isLeftOut({ lines: 58, breathless: 1, left: null })).toBe(false)
    expect(isLeftOut(null)).toBe(false)
  })
})

describe('why a song sits out, in plain words', () => {
  it('says what was found against what a song needs, the most common reason first', () => {
    const words = leftOutWords(
      {
        lines: 20,
        breathless: 1,
        left: { unsteady: 2, late: 5, disagree: 1, offKey: 3, farOff: 1 },
      },
      0,
    )
    expect(words.head).toBe(
      'Of its 20 lines, none is a clear place to come in. A song needs at least 2.',
    )
    expect(words.reasons).toEqual([
      '5 settle on their note too late after the voice comes in.',
      '3 are sung a little out of tune.',
      '2 start with no clear note: the voice slides, rasps or wavers into it.',
      '1 comes straight after the line before, with no pause where the band plays alone.',
      '1 has a first note we could not pin down: two ways of hearing it disagree.',
      "1 starts far from the rest of the song's notes.",
    ])
    expect(words.tip).toMatch(/pause before their lines/u)
  })

  it('says one line, and one entry, in the singular', () => {
    const words = leftOutWords(
      { lines: 1, breathless: 0, left: { offKey: 1 } },
      1,
    )
    expect(words.head).toBe(
      'Of its 1 line, only 1 is a clear place to come in. A song needs at least 2.',
    )
    expect(words.reasons).toEqual(['1 is sung a little out of tune.'])
  })

  it('says so when its voice gave no notes at all', () => {
    const words = leftOutWords({ lines: 0, breathless: 0, left: {} }, 0)
    expect(words.head).toBe('We found no notes in its voice to read.')
    expect(words.reasons).toEqual([])
  })
})
