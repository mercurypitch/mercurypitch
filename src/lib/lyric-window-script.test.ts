// ============================================================
// Lyric window script: the song worked out ahead for iOS's window
// ============================================================

import { describe, expect, it } from 'vitest'
import type { GlanceLine } from './lyric-glance'
import type { LyricWindowSegment, LyricWindowSource, } from './lyric-window-script'
import { lyricWindowScript } from './lyric-window-script'

// A canonical song: an intro, a word-timed line, a rest, a line timed only
// as a whole, then the end.
const LINES = new Map<number, GlanceLine>([
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
  [1, { words: [], time: 14, endTime: 20 }],
  [2, { words: ['Low', 'tide'], time: 20, endTime: 24 }],
])
const TIMED = [
  { time: 10, canonicalIndex: 0 },
  { time: 14, canonicalIndex: 1 },
  { time: 20, canonicalIndex: 2 },
]

const timedSong = (duration = 30): LyricWindowSource => ({
  title: 'Harbour Lights',
  lines: LINES,
  timed: TIMED,
  untimedCount: 0,
  duration,
})

/** A pair of seconds, to within a sample of the stage's own reading. */
function expectNear(
  actual: readonly (readonly [number, number])[],
  expected: [number, number][],
): void {
  expect(actual).toHaveLength(expected.length)
  actual.forEach(([start, end], i) => {
    expect(Math.abs(start - (expected[i]?.[0] ?? NaN))).toBeLessThanOrEqual(
      0.021,
    )
    expect(Math.abs(end - (expected[i]?.[1] ?? NaN))).toBeLessThanOrEqual(0.021)
  })
}

const segmentAt = (
  segments: readonly LyricWindowSegment[],
  t: number,
): LyricWindowSegment | undefined =>
  segments.filter((segment) => segment.at <= t).at(-1)

describe('the lines, from when they are sung', () => {
  it('starts with the intro, waiting on the first line', () => {
    const script = lyricWindowScript(timedSong())

    expect(script.segments[0]).toEqual({
      at: 0,
      current: [],
      next: 'Hold the rope',
      words: [],
    })
  })

  it('changes line when the stage does', () => {
    const script = lyricWindowScript(timedSong())

    expect(script.segments.map((segment) => segment.at)).toEqual([
      0, 10, 14, 20,
    ])
    expect(segmentAt(script.segments, 12)).toMatchObject({
      current: ['Hold', 'the', 'rope'],
      next: 'Low tide',
    })
  })

  it('has no line being sung in a rest, and the coming one next', () => {
    const script = lyricWindowScript(timedSong())

    expect(segmentAt(script.segments, 16)).toEqual({
      at: 14,
      current: [],
      next: 'Low tide',
      words: [],
    })
  })

  it('has nothing to read ahead to on the last line', () => {
    const script = lyricWindowScript(timedSong())

    expect(script.segments.at(-1)).toMatchObject({
      current: ['Low', 'tide'],
      next: null,
    })
  })

  it('names the song and its length', () => {
    expect(lyricWindowScript(timedSong(246.5))).toMatchObject({
      title: 'Harbour Lights',
      duration: 246.5,
    })
  })
})

describe('the words, as they fill', () => {
  it('fills each timed word over its own marked span', () => {
    const script = lyricWindowScript(timedSong())

    expectNear(segmentAt(script.segments, 12)?.words ?? [], [
      [10, 11],
      [11, 12],
      [12, 13],
    ])
  })

  it('shares a line timed as a whole between its words, as the stage does', () => {
    const script = lyricWindowScript(timedSong())

    expectNear(segmentAt(script.segments, 22)?.words ?? [], [
      [20, 22],
      [22, 24],
    ])
  })
})

describe('lyrics without timing', () => {
  const untimed = (duration: number): LyricWindowSource => ({
    title: 'Harbour Lights',
    lines: new Map<number, GlanceLine>([
      [0, { words: ['Hold', 'the', 'rope'] }],
      [1, { words: ['Low', 'tide'] }],
    ]),
    timed: [],
    untimedCount: 2,
    duration,
  })

  it('shares the song between the lines, every word lit at once', () => {
    const script = lyricWindowScript(untimed(60))

    expect(script.segments).toEqual([
      {
        at: 0,
        current: ['Hold', 'the', 'rope'],
        next: 'Low tide',
        words: [
          [0, 0],
          [0, 0],
          [0, 0],
        ],
      },
      {
        at: 30,
        current: ['Low', 'tide'],
        next: null,
        words: [
          [30, 30],
          [30, 30],
        ],
      },
    ])
  })

  it('waits on the first line until the song has a length', () => {
    expect(lyricWindowScript(untimed(0))).toEqual({
      title: 'Harbour Lights',
      duration: 0,
      segments: [{ at: 0, current: [], next: 'Hold the rope', words: [] }],
    })
  })
})

describe('the edges', () => {
  it('runs timed lyrics to their end before the song has a length', () => {
    const script = lyricWindowScript(timedSong(0))

    expect(script.duration).toBe(0)
    expect(script.segments.map((segment) => segment.at)).toEqual([
      0, 10, 14, 20,
    ])
  })

  it('is one empty stretch for a song without lyrics', () => {
    expect(
      lyricWindowScript({
        title: 'Harbour Lights',
        lines: new Map(),
        timed: [],
        untimedCount: 0,
        duration: 180,
      }).segments,
    ).toEqual([{ at: 0, current: [], next: null, words: [] }])
  })
})
