// ============================================================
// Lyric glance: the line on, and the one the singer reads ahead to
// ============================================================

import { describe, expect, it } from 'vitest'
import type { GlanceLine } from './lyric-glance'
import { lyricGlance } from './lyric-glance'

const line = (text: string): GlanceLine => ({
  words: text === '' ? [] : text.split(' '),
})

// A rest (no words) between the first two lines, as a canonical LRC has.
const LINES = new Map([
  [0, line('The harbour lights are low')],
  [1, line('')],
  [2, line('And the tide is coming in')],
  [3, line('Hold the rope')],
])

describe('a lyric glance', () => {
  it('names the line being sung and the next one', () => {
    const glance = lyricGlance(LINES, 0)

    expect(glance.current).toBe('The harbour lights are low')
    expect(glance.next).toBe('And the tide is coming in')
  })

  it('shows only the coming line before the first, and in a rest', () => {
    expect(lyricGlance(LINES, -1)).toMatchObject({
      current: null,
      next: 'The harbour lights are low',
      words: [],
    })
    expect(lyricGlance(LINES, 1)).toMatchObject({
      current: null,
      next: 'And the tide is coming in',
      words: [],
    })
  })

  it('has nothing to read ahead to on the last line', () => {
    expect(lyricGlance(LINES, 3)).toMatchObject({
      current: 'Hold the rope',
      next: null,
    })
  })

  it('finds the next line whatever order the map was filled in', () => {
    const shuffled = new Map([...LINES].reverse())

    expect(lyricGlance(shuffled, 0).next).toBe('And the tide is coming in')
  })

  it('is empty for a song without lyrics', () => {
    expect(lyricGlance(new Map(), -1)).toEqual({
      current: null,
      next: null,
      words: [],
      sungUpTo: -1,
      sweep: 0,
    })
  })
})

describe('the words sung so far', () => {
  // Word-timed: each word starts a second after the last and is sung to
  // the end of its marked interval.
  const TIMED = new Map<number, GlanceLine>([
    [
      0,
      {
        words: ['Hold', 'the', 'rope'],
        time: 10,
        endTime: 14,
        wordTimes: [10, 11, 12],
        wordEndTimes: [11, 12, 13],
      },
    ],
  ])

  it('lights none before the line starts', () => {
    expect(lyricGlance(TIMED, 0, 9.5)).toMatchObject({
      words: ['Hold', 'the', 'rope'],
      sungUpTo: -1,
      sweep: 0,
    })
  })

  it('fills the word being sung, with the ones before it lit', () => {
    const glance = lyricGlance(TIMED, 0, 11.5)

    expect(glance.sungUpTo).toBe(0)
    expect(glance.sweep).toBeCloseTo(0.5)
  })

  it('lights the whole line once it is sung', () => {
    expect(lyricGlance(TIMED, 0, 13.5)).toMatchObject({ sungUpTo: 2, sweep: 0 })
  })

  it('lights a line with no timing all at once', () => {
    expect(lyricGlance(LINES, 2, 40)).toMatchObject({ sungUpTo: 5, sweep: 0 })
  })
})
