import { describe, expect, it } from 'vitest'
import { lineRange, overallLineScore, scoreLines, scoreLiveLine, toSongTime, } from '@/lib/jam/jam-line-scoring'
import type { JamSongNote, LyricsLineTiming, TimeStampedPitchSample, } from '@/lib/jam/types'

/** A4 = 440Hz = MIDI 69, the note everything below is sung against. */
const A4 = 440

function samplesAt(
  timesMs: readonly number[],
  freq: number,
): TimeStampedPitchSample[] {
  return timesMs.map((timestamp) => ({
    timestamp,
    frequency: freq,
    midi: 69,
    cents: 0,
    noteName: 'A',
    clarity: 1,
  }))
}

const LINES: LyricsLineTiming[] = [
  { text: 'first', startSec: 0, endSec: 2 },
  { text: 'second', startSec: 2, endSec: 4 },
]

const NOTES: JamSongNote[] = [
  { midi: 69, startSec: 0, endSec: 2 },
  { midi: 69, startSec: 2, endSec: 4 },
]

describe('lineRange', () => {
  it('uses the line’s own end when it has one', () => {
    expect(lineRange(LINES, 0)).toEqual({ startSec: 0, endSec: 2 })
  })

  it('falls back to the next line’s start', () => {
    const open: LyricsLineTiming[] = [
      { text: 'a', startSec: 1 },
      { text: 'b', startSec: 5 },
    ]
    expect(lineRange(open, 0)).toEqual({ startSec: 1, endSec: 5 })
  })

  it('gives a trailing open line a bounded end, not the rest of the song', () => {
    const open: LyricsLineTiming[] = [{ text: 'last', startSec: 10 }]
    // Without a bound this line would swallow the outro and everything
    // sung over it.
    expect(lineRange(open, 0).endSec).toBe(16)
  })

  it('returns an empty range for an index that is not there', () => {
    expect(lineRange(LINES, 9)).toEqual({ startSec: 0, endSec: 0 })
  })
})

describe('toSongTime', () => {
  it('maps wall-clock stamps onto the song clock through the anchor', () => {
    const out = toSongTime(samplesAt([1000, 1500], A4), {
      atMs: 1000,
      positionSec: 30,
    })
    expect(out.map((s) => s.time)).toEqual([30, 30.5])
  })

  it('drops silent frames rather than scoring a breath as wrong', () => {
    const mixed: TimeStampedPitchSample[] = [
      {
        timestamp: 0,
        frequency: 0,
        midi: 0,
        cents: 0,
        noteName: '',
        clarity: 0,
      },
      {
        timestamp: 100,
        frequency: A4,
        midi: 69,
        cents: 0,
        noteName: 'A',
        clarity: 1,
      },
    ]
    expect(toSongTime(mixed, { atMs: 0, positionSec: 0 })).toHaveLength(1)
  })

  it('treats a missing buffer as no samples', () => {
    expect(toSongTime(undefined, { atMs: 0, positionSec: 0 })).toEqual([])
  })
})

describe('scoreLines', () => {
  const anchor = { atMs: 0, positionSec: 0 }

  it('scores a line sung on pitch highly', () => {
    const samples = samplesAt([0, 200, 400, 600, 800, 1000, 1200, 1400], A4)
    const [first] = scoreLines(LINES, NOTES, samples, anchor)
    expect(first?.score).toBeGreaterThan(90)
    expect(first?.voiced).toBe(true)
  })

  it('scores a line with notes that went unsung as zero, and marks it unvoiced', () => {
    // Sung only through the first line; the second is silence.
    const samples = samplesAt([0, 500, 1000, 1500], A4)
    const [, second] = scoreLines(LINES, NOTES, samples, anchor)
    expect(second?.score).toBe(0)
    expect(second?.voiced).toBe(false)
    expect(second?.noteCount).toBe(1)
  })

  it('marks a line with nothing to sing as noteCount 0 rather than a miss', () => {
    const lines: LyricsLineTiming[] = [
      { text: 'instrumental', startSec: 8, endSec: 10 },
    ]
    const [only] = scoreLines(lines, NOTES, [], anchor)
    expect(only?.noteCount).toBe(0)
    expect(only?.score).toBe(0)
  })

  it('does not credit the right notes sung in the wrong slot', () => {
    // Everything sung during line one, nothing during line two.
    const crammed = samplesAt([0, 100, 200, 300, 400, 500], A4)
    const [, second] = scoreLines(LINES, NOTES, crammed, anchor)
    expect(second?.score).toBe(0)
  })

  it('scores every line, including ones never reached', () => {
    expect(scoreLines(LINES, NOTES, [], anchor)).toHaveLength(LINES.length)
  })
})

describe('scoreLiveLine', () => {
  it('anchors to when the line started, so a mid-song line scores like a first one', () => {
    // The playhead reached 30s at wall time 100000, singing the note that
    // belongs at 30-32s.
    const lines: LyricsLineTiming[] = [{ text: 'x', startSec: 30, endSec: 32 }]
    const notes: JamSongNote[] = [{ midi: 69, startSec: 30, endSec: 32 }]
    const samples = samplesAt([100000, 100400, 100800, 101200, 101600], A4)
    const score = scoreLiveLine(lines, 0, notes, samples, {
      atMs: 100000,
      positionSec: 30,
    })
    expect(score.score).toBeGreaterThan(90)
  })

  it('is unaffected by a seek, because the anchor comes from the line', () => {
    // Same audio, but the singer jumped here from elsewhere: a run-wide
    // anchor would place these samples in the wrong part of the song.
    const lines: LyricsLineTiming[] = [{ text: 'x', startSec: 90, endSec: 92 }]
    const notes: JamSongNote[] = [{ midi: 69, startSec: 90, endSec: 92 }]
    const samples = samplesAt([5000, 5400, 5800, 6200, 6600], A4)
    const score = scoreLiveLine(lines, 0, notes, samples, {
      atMs: 5000,
      positionSec: 90,
    })
    expect(score.score).toBeGreaterThan(90)
  })
})

describe('overallLineScore', () => {
  const scored = (score: number, noteCount: number, voiced = true) => ({
    lineIndex: 0,
    startSec: 0,
    endSec: 1,
    score,
    voiced,
    noteCount,
  })

  it('averages only the lines that had something to sing', () => {
    // The 0 here is an instrumental bar, not a miss -- including it would
    // drag an otherwise perfect run down to 50.
    const out = overallLineScore([scored(100, 4), scored(0, 0, false)])
    expect(out?.score).toBe(100)
    expect(out?.totalLines).toBe(1)
  })

  it('counts a line with notes that went unsung against you', () => {
    const out = overallLineScore([scored(100, 4), scored(0, 4, false)])
    expect(out?.score).toBe(50)
    expect(out?.sungLines).toBe(1)
    expect(out?.totalLines).toBe(2)
  })

  it('returns null when nothing was scoreable, which is not the same as zero', () => {
    expect(overallLineScore([scored(0, 0, false)])).toBeNull()
    expect(overallLineScore([])).toBeNull()
  })
})
