import { describe, expect, it } from 'vitest'
import { lineRange, overallLineScore, scoreableLineIndices, scoreLines, scoreLiveLine, toSongTime, } from '@/lib/jam/jam-line-scoring'
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

describe('scoreableLineIndices', () => {
  it('finds the stable song denominator before any line is performed', () => {
    expect(scoreableLineIndices(LINES, NOTES)).toEqual([0, 1])
    expect(
      scoreableLineIndices(
        [...LINES, { text: 'instrumental', startSec: 8, endSec: 10 }],
        NOTES,
      ),
    ).toEqual([0, 1])
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
    expect(out?.completedLines).toBe(1)
    expect(out?.totalLines).toBe(1)
  })

  it('counts a line with notes that went unsung against you', () => {
    const out = overallLineScore([scored(100, 4), scored(0, 4, false)])
    expect(out?.score).toBe(50)
    expect(out?.sungLines).toBe(1)
    expect(out?.completedLines).toBe(2)
    expect(out?.totalLines).toBe(2)
  })

  it('keeps the expected song total stable while completed lines grow', () => {
    const out = overallLineScore([scored(100, 4)], 8)
    expect(out).toMatchObject({
      score: 100,
      sungLines: 1,
      completedLines: 1,
      totalLines: 8,
    })
  })

  it('returns null when nothing was scoreable, which is not the same as zero', () => {
    expect(overallLineScore([scored(0, 0, false)])).toBeNull()
    expect(overallLineScore([])).toBeNull()
  })
})

// ── Singing where nothing is written ─────────────────────────────────
//
// Asked directly (2026-09-19): does noise in a gap count against you?
// It does not, and this is the guard on that staying true. The scorer
// only ever looks INSIDE a note's own [startSec, endSec), and a line
// with no notes is noteCount 0 and leaves the denominator. Both are
// easy to lose by accident -- a "score the whole line" refactor, or an
// `|| 1` on a divisor -- and neither shows up as a failing case unless
// one is written down.
//
// Named `noise` rather than `wrong note` on purpose: an ad lib, a
// cough, a count-in and somebody else's mic bleeding in all arrive here
// as exactly this.

/** Samples at given times, each at its own frequency. */
function noiseAt(
  entries: readonly [timeMs: number, freq: number][],
): TimeStampedPitchSample[] {
  return entries.map(([timestamp, frequency]) => ({
    timestamp,
    frequency,
    midi: 60,
    cents: 0,
    noteName: 'C',
    clarity: 1,
  }))
}

describe('singing where no note is written', () => {
  const anchor = { atMs: 0, positionSec: 0 }
  /** One line, two notes, and two seconds of nothing between them. */
  const GAPPED_LINE: LyricsLineTiming[] = [
    { text: 'hold ... hold', startSec: 0, endSec: 4 },
  ]
  const GAPPED_NOTES: JamSongNote[] = [
    { midi: 69, startSec: 0, endSec: 1 },
    { midi: 69, startSec: 3, endSec: 4 },
  ]
  const ON_THE_NOTES = samplesAt([0, 250, 500, 750, 3000, 3250, 3500, 3750], A4)

  it('scores the same whether the gap is silent or full of noise', () => {
    const clean = scoreLines(GAPPED_LINE, GAPPED_NOTES, ON_THE_NOTES, anchor)
    const noisy = scoreLines(
      GAPPED_LINE,
      GAPPED_NOTES,
      [
        ...ON_THE_NOTES,
        // Two seconds of a completely different note, right between them.
        ...noiseAt([
          [1200, 261.63],
          [1600, 261.63],
          [2000, 293.66],
          [2400, 329.63],
          [2800, 261.63],
        ]),
      ],
      anchor,
    )
    expect(clean[0]?.score).toBeGreaterThan(90)
    expect(noisy[0]?.score).toBe(clean[0]?.score)
    expect(noisy[0]?.noteCount).toBe(clean[0]?.noteCount)
  })

  it('leaves the run total alone when a whole line has nothing to sing', () => {
    // Line two is an instrumental break. Wailing over it must not add a
    // line to the denominator, which is what would turn a perfect run
    // into a half-marked one.
    const lines: LyricsLineTiming[] = [
      { text: 'verse', startSec: 0, endSec: 2 },
      { text: '(solo)', startSec: 2, endSec: 6 },
    ]
    const notes: JamSongNote[] = [{ midi: 69, startSec: 0, endSec: 2 }]
    const overSolo = noiseAt([
      [2500, 261.63],
      [3000, 293.66],
      [4000, 329.63],
      [5000, 261.63],
    ])

    const scores = scoreLines(
      lines,
      notes,
      [...samplesAt([0, 400, 800, 1200, 1600], A4), ...overSolo],
      anchor,
    )
    expect(scores[1]?.noteCount).toBe(0)
    // It WAS voiced -- the samples are real -- and still does not count.
    expect(scores[1]?.voiced).toBe(true)

    const out = overallLineScore(scores)
    expect(out?.completedLines).toBe(1)
    expect(out?.totalLines).toBe(1)
    expect(out?.score).toBeGreaterThan(90)
    expect(scoreableLineIndices(lines, notes)).toEqual([0])
  })

  it('does not let noise before a line starts bleed into it', () => {
    // The count-in case: four bars of somebody talking over the intro.
    const lines: LyricsLineTiming[] = [
      { text: 'verse', startSec: 4, endSec: 6 },
    ]
    const notes: JamSongNote[] = [{ midi: 69, startSec: 4, endSec: 6 }]
    const sung = samplesAt([4000, 4400, 4800, 5200, 5600], A4)
    const withIntro = [
      ...noiseAt([
        [0, 261.63],
        [1000, 293.66],
        [2000, 329.63],
      ]),
      ...sung,
    ]
    const clean = scoreLines(lines, notes, sung, anchor)
    const noisy = scoreLines(lines, notes, withIntro, anchor)
    expect(clean[0]?.score).toBeGreaterThan(90)
    expect(noisy[0]?.score).toBe(clean[0]?.score)
  })

  it('holds for the live path too, which is the one that runs', () => {
    // scoreLiveLine is what the room actually calls, line by line; the
    // after-the-fact path above is only used for a whole take.
    const live = (samples: TimeStampedPitchSample[]) =>
      scoreLiveLine(GAPPED_LINE, 0, GAPPED_NOTES, samples, anchor).score
    expect(
      live([
        ...ON_THE_NOTES,
        ...noiseAt([
          [1500, 261.63],
          [2500, 329.63],
        ]),
      ]),
    ).toBe(live(ON_THE_NOTES))
  })
})
