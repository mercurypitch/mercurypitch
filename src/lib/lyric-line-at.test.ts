// ============================================================
// Lyric line at: the line the sheet lights at a moment of the song
// ============================================================

import { describe, expect, it } from 'vitest'
import { lyricLineAt } from './lyric-line-at'

// Timed lines, numbered as canonical lines are: a rest (2) sits between two
// lines, and the numbers need not match the positions.
const TIMED = [
  { time: 4, canonicalIndex: 0 },
  { time: 9, canonicalIndex: 1 },
  { time: 14, canonicalIndex: 2 },
  { time: 20, canonicalIndex: 3 },
]

describe('the line being sung', () => {
  it('is none before the first timed line', () => {
    expect(lyricLineAt(TIMED, 0, 3.9, 60)).toBe(-1)
  })

  it('is the last timed line whose time has come', () => {
    expect(lyricLineAt(TIMED, 0, 4, 60)).toBe(0)
    expect(lyricLineAt(TIMED, 0, 13.99, 60)).toBe(1)
    expect(lyricLineAt(TIMED, 0, 14, 60)).toBe(2)
    expect(lyricLineAt(TIMED, 0, 500, 60)).toBe(3)
  })

  it('shares the song evenly between untimed lines', () => {
    expect(lyricLineAt([], 4, 0, 60)).toBe(0)
    expect(lyricLineAt([], 4, 15, 60)).toBe(1)
    expect(lyricLineAt([], 4, 59.9, 60)).toBe(3)
  })

  it('has no answer for untimed lines before the song has a length', () => {
    expect(lyricLineAt([], 4, 15, 0)).toBeNull()
  })

  it('has no answer for a song without lyrics', () => {
    expect(lyricLineAt([], 0, 15, 60)).toBeNull()
  })
})
