// ============================================================
// Lyric glance: the line on, and the one the singer reads ahead to
// ============================================================

import { describe, expect, it } from 'vitest'
import { lyricGlance } from './lyric-glance'

const line = (text: string) => ({
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
    expect(lyricGlance(LINES, 0)).toEqual({
      current: 'The harbour lights are low',
      next: 'And the tide is coming in',
    })
  })

  it('shows only the coming line before the first, and in a rest', () => {
    expect(lyricGlance(LINES, -1)).toEqual({
      current: null,
      next: 'The harbour lights are low',
    })
    expect(lyricGlance(LINES, 1)).toEqual({
      current: null,
      next: 'And the tide is coming in',
    })
  })

  it('has nothing to read ahead to on the last line', () => {
    expect(lyricGlance(LINES, 3)).toEqual({
      current: 'Hold the rope',
      next: null,
    })
  })

  it('finds the next line whatever order the map was filled in', () => {
    const shuffled = new Map([...LINES].reverse())

    expect(lyricGlance(shuffled, 0).next).toBe('And the tide is coming in')
  })

  it('is empty for a song without lyrics', () => {
    expect(lyricGlance(new Map(), -1)).toEqual({ current: null, next: null })
  })
})
