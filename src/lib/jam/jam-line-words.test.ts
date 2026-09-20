// ── A lyric line, word by word ────────────────────────────────────────
// The arithmetic is `computeActiveWord`'s and is tested where it lives
// (src/tests/lyrics-service.test.ts). What is pinned here is the jam's own
// half: which timing a line is allowed to bring, given that it arrives from
// another browser with nothing checking it on the way.

import { describe, expect, it } from 'vitest'
import { jamLineWords, jamWordProgress, NOTHING_SUNG, } from '@/lib/jam/jam-line-words'
import type { LyricsLineTiming } from '@/lib/jam/types'

const mapped = (): LyricsLineTiming => ({
  text: 'sing it out loud',
  startSec: 10,
  endSec: 16,
  words: ['sing', 'it', 'out', 'loud'],
  wordStartsSec: [10, 11, 12, 13],
})

describe('jamLineWords', () => {
  it("uses the line's own mapping when it holds together", () => {
    expect(jamLineWords(mapped())).toEqual({
      words: ['sing', 'it', 'out', 'loud'],
      startsSec: [10, 11, 12, 13],
    })
  })

  it('splits the text when the line was never mapped', () => {
    expect(jamLineWords({ text: '  two   words ', startSec: 0 })).toEqual({
      words: ['two', 'words'],
    })
  })

  it('keeps only the ends somebody marked, and only real ones', () => {
    const line = {
      ...mapped(),
      wordEndsSec: [null, 11.6, undefined, Number.NaN, 99],
    }
    const { endsSec } = jamLineWords(line)
    expect(endsSec?.[0]).toBeUndefined()
    expect(endsSec?.[1]).toBe(11.6)
    expect(endsSec?.[3]).toBeUndefined()
    // A fifth end for a four-word line is somebody else's word.
    expect(endsSec?.length).toBe(2)
  })

  it.each([
    ['a start short', { wordStartsSec: [10, 11, 12] }],
    ['a start that is not a time', { wordStartsSec: [10, 11, Number.NaN, 13] }],
    ['a negative start', { wordStartsSec: [10, -1, 12, 13] }],
    ['words that are not the text', { words: ['sing', 'it', 'out', 'LOUD'] }],
    ['words that are not an array', { words: 'sing it out loud' }],
    ['starts that are not an array', { wordStartsSec: { 0: 10 } }],
  ])('falls back to the text for %s', (_, broken) => {
    // Straight off the wire: there is no schema between two browsers.
    const line = { ...mapped(), ...broken } as unknown as LyricsLineTiming
    expect(jamLineWords(line)).toEqual({
      words: ['sing', 'it', 'out', 'loud'],
    })
  })

  it('reads a line once, however often it is asked', () => {
    const line = mapped()
    expect(jamLineWords(line)).toBe(jamLineWords(line))
  })
})

describe('jamWordProgress', () => {
  const lines = [mapped(), { text: 'and again', startSec: 16 }]

  it('has sung nothing before the line starts', () => {
    expect(jamWordProgress(lines, 0, 9.5)).toEqual(NOTHING_SUNG)
  })

  it('is part way through the word whose start has passed', () => {
    const at = jamWordProgress(lines, 0, 11.1)
    expect(at.sungUpTo).toBe(0)
    expect(at.fraction).toBeGreaterThan(0)
    expect(at.fraction).toBeLessThan(1)
  })

  it('holds a word lit once it has been sung, until the next one starts', () => {
    // "it" is a short word: sung long before "out" starts a second later.
    expect(jamWordProgress(lines, 0, 11.9)).toEqual({
      sungUpTo: 1,
      fraction: 0,
    })
  })

  it('sweeps a marked word for as long as it was marked', () => {
    const held = [{ ...mapped(), wordEndsSec: [null, null, null, 15.5] }]
    // Two seconds into a word held for two and a half.
    const at = jamWordProgress(held, 0, 15)
    expect(at.sungUpTo).toBe(2)
    expect(at.fraction).toBeCloseTo(0.8, 5)
  })

  it('shares an unmapped line out evenly, so every sheet lights up', () => {
    const plain = [
      { text: 'one two three four', startSec: 0, endSec: 2 },
      { text: 'next', startSec: 2 },
    ]
    expect(jamWordProgress(plain, 0, 0.75).sungUpTo).toBe(0)
    expect(jamWordProgress(plain, 0, 1.25).sungUpTo).toBe(1)
    expect(jamWordProgress(plain, 0, 1.99).sungUpTo).toBe(2)
  })

  it('ends a line with no end of its own where the next one starts', () => {
    const open = [
      { text: 'one two', startSec: 0 },
      { text: 'next', startSec: 1 },
    ]
    // Half a second in is the second half of a one-second line.
    expect(jamWordProgress(open, 0, 0.75).sungUpTo).toBe(0)
  })

  it('answers for the last line of a song, which has nothing after it', () => {
    const last = [{ text: 'the end', startSec: 100 }]
    expect(jamWordProgress(last, 0, 100.1).sungUpTo).toBe(-1)
    expect(jamWordProgress(last, 0, 130).sungUpTo).toBe(1)
  })

  it('has nothing to say about a line that is not there', () => {
    expect(jamWordProgress(lines, -1, 12)).toEqual(NOTHING_SUNG)
    expect(jamWordProgress(lines, 9, 12)).toEqual(NOTHING_SUNG)
    expect(jamWordProgress([{ text: '', startSec: 0 }], 0, 1)).toEqual(
      NOTHING_SUNG,
    )
  })
})
