// ============================================================
// lrc-offset — global timing shift
// ============================================================

import { describe, expect, it } from 'vitest'
import type { ShiftableTimings } from '@/features/stem-mixer/lrc-offset'
import { clampShift, earliestTime, parseLrcOffsetTag, shiftTimings, } from '@/features/stem-mixer/lrc-offset'
import { parseLrcFile, parseLrcWordTimings } from '@/lib/lyrics-service'

const empty: ShiftableTimings = {
  lineTimes: [],
  wordTimings: {},
  wordEndTimings: {},
  wordSweepTimings: {},
}

const song: ShiftableTimings = {
  lineTimes: [10, 20, undefined],
  wordTimings: { 0: [10, 10.5], 1: [20, 20.5] },
  wordEndTimings: { 0: [10.4, 10.9] },
  wordSweepTimings: {
    0: {
      1: [
        { time: 10.5, progress: 0 },
        { time: 10.9, progress: 1 },
      ],
    },
  },
}

describe('earliestTime', () => {
  it('finds the first moment across every kind of timing', () => {
    expect(earliestTime(song)).toBe(10)
    expect(
      earliestTime({ ...empty, wordSweepTimings: song.wordSweepTimings }),
    ).toBe(10.5)
  })

  it('is null for a mapping with nothing in it', () => {
    expect(earliestTime(empty)).toBeNull()
    // A line with no start is not a time.
    expect(earliestTime({ ...empty, lineTimes: [undefined] })).toBeNull()
  })
})

describe('clampShift', () => {
  it('never pushes the earliest timing before the start of the track', () => {
    expect(clampShift(song, -10)).toBe(-10)
    expect(clampShift(song, -12)).toBe(-10)
  })

  it('leaves forward shifts alone', () => {
    expect(clampShift(song, 900)).toBe(900)
  })

  it('cannot shift an empty mapping backwards', () => {
    expect(clampShift(empty, -5)).toBe(0)
  })
})

describe('shiftTimings', () => {
  it('moves every timing by the same amount', () => {
    const { timings, applied } = shiftTimings(song, 0.2)
    expect(applied).toBe(0.2)
    expect(timings.lineTimes).toEqual([10.2, 20.2, undefined])
    expect(timings.wordTimings).toEqual({ 0: [10.2, 10.7], 1: [20.2, 20.7] })
    expect(timings.wordEndTimings).toEqual({ 0: [10.6, 11.1] })
    expect(timings.wordSweepTimings[0][1]).toEqual([
      { time: 10.7, progress: 0 },
      { time: 11.1, progress: 1 },
    ])
  })

  it('preserves every interval when the shift is bounded', () => {
    // The point of bounding the delta rather than clamping each time: ask for
    // more than the song can give and the mapping still holds its shape.
    const { timings, applied } = shiftTimings(song, -60)
    expect(applied).toBe(-10)
    expect(timings.lineTimes).toEqual([0, 10, undefined])
    expect(timings.wordTimings[0]).toEqual([0, 0.5])
    expect(timings.wordEndTimings[0]).toEqual([0.4, 0.9])
  })

  it('rounds to milliseconds so a nudge cannot accrue float dust', () => {
    let current = song
    for (let i = 0; i < 10; i++) current = shiftTimings(current, 0.1).timings
    expect(current.lineTimes[0]).toBe(11)
  })

  it('leaves the input alone', () => {
    shiftTimings(song, 5)
    expect(song.lineTimes[0]).toBe(10)
    expect(song.wordSweepTimings[0][1][0].time).toBe(10.5)
  })

  it('keeps a word that never got a time untimed', () => {
    // Built with a hole rather than an elision literal, because that is how
    // restoreWordTimingsMap produces them: indexed assignment, gaps left.
    const times: number[] = []
    times[0] = 1
    times[2] = 3
    const { timings } = shiftTimings({ ...empty, wordTimings: { 0: times } }, 1)
    expect(timings.wordTimings[0][0]).toBe(2)
    expect(timings.wordTimings[0][1]).toBeUndefined()
    expect(timings.wordTimings[0][2]).toBe(4)
  })
})

describe('parseLrcOffsetTag', () => {
  it('reads a positive tag as an earlier shift', () => {
    // The LRC convention: [offset:+200] means show the lyrics 200 ms sooner.
    expect(parseLrcOffsetTag('[offset:+200]\n[00:10.00]hi')).toBe(-0.2)
  })

  it('reads a negative tag as a later shift', () => {
    expect(parseLrcOffsetTag('[offset:-500]\n[00:10.00]hi')).toBe(0.5)
  })

  it('accepts the tag without a sign, and with padding', () => {
    expect(parseLrcOffsetTag('[offset: 250 ]')).toBe(-0.25)
  })

  it('is zero when there is no tag, or it cannot be read', () => {
    expect(parseLrcOffsetTag('[00:10.00]hi')).toBe(0)
    expect(parseLrcOffsetTag('[offset:soon]')).toBe(0)
    // Not on its own line — this is lyric text that happens to look like one.
    expect(parseLrcOffsetTag('[00:10.00][offset:200] words')).toBe(0)
  })
})

describe('parseLrcFile honouring [offset:]', () => {
  it('moves line starts by the tag', () => {
    const lines = parseLrcFile('[offset:+500]\n[00:10.00]one\n[00:20.00]two')
    expect(lines.map((l) => l.time)).toEqual([9.5, 19.5])
  })

  it('moves the embedded word stamps by the same amount', () => {
    // Shifting line starts alone would be worse than ignoring the tag: the
    // words would keep their original times while their line moved.
    const [line] = parseLrcFile('[offset:+500]\n[00:10.00]one [00:11.00]two')
    expect(line.time).toBe(9.5)
    const words = parseLrcWordTimings(line.text, line.time)
    expect(words?.words).toEqual(['one', 'two'])
    expect(words?.wordTimes).toEqual([9.5, 10.5])
  })

  it('does not let a large offset produce negative times', () => {
    const lines = parseLrcFile('[offset:+90000]\n[00:10.00]one\n[01:40.00]two')
    expect(lines.map((l) => l.time)).toEqual([0, 10])
  })

  it('leaves a file with no tag byte-identical', () => {
    const text = '[00:10.00]one [00:11.00]two'
    expect(parseLrcFile(text)).toEqual(parseLrcFile(`[offset:0]\n${text}`))
  })
})
