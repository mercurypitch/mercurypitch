// ── Jam Canvas Coordinate Math Tests ─────────────────────────────────
// Tests for the pure coordinate transform functions used by
// JamExerciseCanvas and JamSharedPitchCanvas. These are extracted
// and exercised directly without needing a real canvas context.

import { describe, expect, it } from 'vitest'

// ── Reproductions of the pure math from JamExerciseCanvas ─────────────

const MARGIN_LEFT = 40
const MARGIN_RIGHT = 20
const MARGIN_TOP = 16
const MARGIN_BOTTOM = 20
const PLAYHEAD_PCT = 0.6

/** Maps a beat position to an x-pixel given the current playhead beat. */
function beatToX(
  beat: number,
  w: number,
  totalBeats: number,
  currentBeat: number,
): number {
  const drawW = w - MARGIN_LEFT - MARGIN_RIGHT
  const playheadX = MARGIN_LEFT + drawW * PLAYHEAD_PCT
  const pxPerBeat = drawW / Math.max(totalBeats, 16)
  return playheadX + (beat - currentBeat) * pxPerBeat
}

/** Maps a MIDI note number to a y-pixel within the canvas. */
function midiToY(
  midi: number,
  h: number,
  minMidi: number,
  maxMidi: number,
): number {
  const range = maxMidi - minMidi
  const pct = (midi - minMidi) / range
  return h - MARGIN_BOTTOM - pct * (h - MARGIN_TOP - MARGIN_BOTTOM)
}

// ── Reproductions of the pure math from JamSharedPitchCanvas ──────────

const SHARED_PITCH_MARGIN = 36

/** Maps a frequency to a y-pixel using log2 scale. */
const MIN_FREQ = 55
const MAX_FREQ = 2093
const LOG_MIN = Math.log2(MIN_FREQ)
const LOG_MAX = Math.log2(MAX_FREQ)
const LOG_RANGE = LOG_MAX - LOG_MIN

function freqToY(freq: number, h: number): number {
  const log = Math.log2(Math.max(freq, MIN_FREQ))
  const pct = 1 - (log - LOG_MIN) / LOG_RANGE
  return SHARED_PITCH_MARGIN + pct * (h - SHARED_PITCH_MARGIN * 2)
}

/** Maps a sample timestamp to x using the 60% anchor. */
function sampleToX(
  timestampMs: number,
  nowMs: number,
  w: number,
  windowMs = 10000,
): number {
  const ANCHOR_PCT = 0.6
  const drawW = w - SHARED_PITCH_MARGIN * 2
  const anchorX = SHARED_PITCH_MARGIN + drawW * ANCHOR_PCT
  const pxPerMs = (drawW * ANCHOR_PCT) / windowMs
  return anchorX + (timestampMs - nowMs) * pxPerMs
}

// ── beatToX tests ─────────────────────────────────────────────────────

describe('beatToX — exercise canvas', () => {
  const W = 600
  const TOTAL = 32

  it('places the current beat exactly at the 60% mark', () => {
    const currentBeat = 16
    const x = beatToX(currentBeat, W, TOTAL, currentBeat)
    const expectedX =
      MARGIN_LEFT + (W - MARGIN_LEFT - MARGIN_RIGHT) * PLAYHEAD_PCT
    expect(x).toBeCloseTo(expectedX, 5)
  })

  it('places past notes to the LEFT of the playhead', () => {
    const currentBeat = 16
    const pastBeat = 10
    const playheadX = beatToX(currentBeat, W, TOTAL, currentBeat)
    const pastX = beatToX(pastBeat, W, TOTAL, currentBeat)
    expect(pastX).toBeLessThan(playheadX)
  })

  it('places future notes to the RIGHT of the playhead', () => {
    const currentBeat = 16
    const futureBeat = 24
    const playheadX = beatToX(currentBeat, W, TOTAL, currentBeat)
    const futureX = beatToX(futureBeat, W, TOTAL, currentBeat)
    expect(futureX).toBeGreaterThan(playheadX)
  })

  it('beat=0 at start is LEFT of playhead when currentBeat > 0', () => {
    const x = beatToX(0, W, TOTAL, 8)
    const playheadX = beatToX(8, W, TOTAL, 8)
    expect(x).toBeLessThan(playheadX)
  })

  it('uses minimum totalBeats of 16 to prevent over-compression', () => {
    // Even with totalBeats=4, pxPerBeat should use max(4,16)=16
    const x1 = beatToX(1, W, 4, 0)
    const x2 = beatToX(1, W, 16, 0)
    expect(x1).toBeCloseTo(x2, 5)
  })

  it('is linear — equal beat steps produce equal pixel steps', () => {
    const step = (b: number) =>
      beatToX(b + 1, W, TOTAL, 0) - beatToX(b, W, TOTAL, 0)
    expect(step(0)).toBeCloseTo(step(5), 5)
    expect(step(10)).toBeCloseTo(step(15), 5)
  })
})

// ── midiToY tests ─────────────────────────────────────────────────────

describe('midiToY — exercise canvas', () => {
  const H = 400
  const MIN = 48
  const MAX = 84

  it('maps minMidi to the bottom of the drawable area', () => {
    const y = midiToY(MIN, H, MIN, MAX)
    expect(y).toBeCloseTo(H - MARGIN_BOTTOM, 5)
  })

  it('maps maxMidi to the top of the drawable area', () => {
    const y = midiToY(MAX, H, MIN, MAX)
    expect(y).toBeCloseTo(MARGIN_TOP, 5)
  })

  it('maps middle MIDI to the middle of the drawable area', () => {
    const mid = (MIN + MAX) / 2
    const y = midiToY(mid, H, MIN, MAX)
    const drawH = H - MARGIN_TOP - MARGIN_BOTTOM
    const expected = H - MARGIN_BOTTOM - 0.5 * drawH
    expect(y).toBeCloseTo(expected, 5)
  })

  it('higher MIDI always maps to lower y value (canvas is Y-down)', () => {
    const yLow = midiToY(60, H, MIN, MAX)
    const yHigh = midiToY(72, H, MIN, MAX)
    expect(yHigh).toBeLessThan(yLow)
  })
})

// ── freqToY tests (shared pitch canvas) ───────────────────────────────

describe('freqToY — shared pitch canvas (log scale)', () => {
  const H = 300

  it('maps minimum frequency to the bottom of the drawable area', () => {
    const y = freqToY(MIN_FREQ, H)
    // pct = 1.0 → top position (which is near bottom due to 1-pct inversion)
    // Actually: pct = 1 - (log2(MIN_FREQ) - LOG_MIN)/LOG_RANGE = 1 - 0 = 1
    // y = MARGIN + 1 * (h - MARGIN*2) = near bottom
    const expected = SHARED_PITCH_MARGIN + 1.0 * (H - SHARED_PITCH_MARGIN * 2)
    expect(y).toBeCloseTo(expected, 3)
  })

  it('maps maximum frequency to the top of the drawable area', () => {
    const y = freqToY(MAX_FREQ, H)
    // pct = 1 - (log2(MAX_FREQ) - LOG_MIN)/LOG_RANGE = 1 - 1 = 0
    const expected = SHARED_PITCH_MARGIN
    expect(y).toBeCloseTo(expected, 3)
  })

  it('higher frequency always maps to lower y (canvas Y-down)', () => {
    expect(freqToY(880, H)).toBeLessThan(freqToY(440, H))
  })

  it('clips frequencies below MIN_FREQ to MIN_FREQ', () => {
    expect(freqToY(10, H)).toBeCloseTo(freqToY(MIN_FREQ, H), 5)
  })
})

// ── sampleToX tests (shared pitch canvas) ─────────────────────────────

describe('sampleToX — shared pitch canvas (60% anchor)', () => {
  const W = 800

  it('places a sample at "now" at the 60% mark', () => {
    const now = 1000000
    const x = sampleToX(now, now, W)
    const drawW = W - SHARED_PITCH_MARGIN * 2
    const expected = SHARED_PITCH_MARGIN + drawW * 0.6
    expect(x).toBeCloseTo(expected, 5)
  })

  it('places older samples to the LEFT of the anchor', () => {
    const now = 1000000
    const anchor = sampleToX(now, now, W)
    const older = sampleToX(now - 5000, now, W)
    expect(older).toBeLessThan(anchor)
  })

  it('future timestamps (clock skew) appear to the RIGHT', () => {
    const now = 1000000
    const anchor = sampleToX(now, now, W)
    const ahead = sampleToX(now + 1000, now, W)
    expect(ahead).toBeGreaterThan(anchor)
  })

  it('a sample 10 seconds old maps to the left margin', () => {
    const now = 10000
    const x = sampleToX(0, now, W, 10000)
    expect(x).toBeCloseTo(SHARED_PITCH_MARGIN, 1)
  })
})
