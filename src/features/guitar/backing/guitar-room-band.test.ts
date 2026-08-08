// Room-band tests pin the click's beat map, especially when it repeats a span.
// ============================================================

import { describe, expect, it } from 'vitest'
import { groupNotesByBeat, resolveBandLoop } from './guitar-room-band'

describe('resolveBandLoop', () => {
  it('keeps a loop the exercise actually contains', () => {
    expect(resolveBandLoop({ start: 4, end: 8 }, 16)).toEqual({
      start: 4,
      end: 8,
    })
  })

  it('trims a loop that runs off the end of the exercise', () => {
    expect(resolveBandLoop({ start: 12, end: 40 }, 16)).toEqual({
      start: 12,
      end: 16,
    })
  })

  it('refuses a loop that starts past the exercise', () => {
    expect(resolveBandLoop({ start: 20, end: 24 }, 16)).toBeNull()
  })

  it('refuses a loop shorter than one beat, which the pulse cannot express', () => {
    expect(resolveBandLoop({ start: 4, end: 4.5 }, 16)).toBeNull()
  })

  it('is absent when nothing was asked for', () => {
    expect(resolveBandLoop(null, 16)).toBeNull()
    expect(resolveBandLoop(undefined, 16)).toBeNull()
  })
})

describe('groupNotesByBeat', () => {
  it('buckets a note by the beat it starts in, fraction and all', () => {
    const grouped = groupNotesByBeat([
      { midi: 40, startBeat: 0, durationBeats: 0.5 },
      { midi: 43, startBeat: 0.5, durationBeats: 0.5 },
      { midi: 45, startBeat: 2.75, durationBeats: 0.25 },
    ])
    expect(grouped.get(0)?.map((note) => note.midi)).toEqual([40, 43])
    expect(grouped.get(2)?.map((note) => note.midi)).toEqual([45])
    expect(grouped.get(1)).toBeUndefined()
  })

  it('drops a note with no position rather than sounding it on beat one', () => {
    const grouped = groupNotesByBeat([
      { midi: 40, startBeat: Number.NaN, durationBeats: 1 },
      { midi: 41, startBeat: -2, durationBeats: 1 },
    ])
    expect(grouped.size).toBe(0)
  })
})
