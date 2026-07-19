import { describe, expect, it } from 'vitest'
import { createPitchCompareEngine, foldCentsToOctave, } from '@/lib/pitch-compare-engine'
import { midiToFreq } from '@/lib/scale-data'

/** Feed `ms` worth of frames at ~60fps starting at `t0` (seconds). */
function feed(
  engine: ReturnType<typeof createPitchCompareEngine>,
  t0: number,
  ms: number,
  refFreq: number,
  micFreq: number,
): { judged: number; hits: number; t: number } {
  let judged = 0
  let hits = 0
  let t = t0
  const frames = Math.round(ms / 16.7)
  for (let i = 0; i < frames; i++) {
    const p = engine.push(t, refFreq, micFreq)
    if (p) {
      judged++
      if (p.inTolerance) hits++
    }
    t += 0.0167
  }
  return { judged, hits, t }
}

describe('foldCentsToOctave', () => {
  it('folds whole octaves to zero', () => {
    expect(foldCentsToOctave(1200)).toBe(0)
    expect(foldCentsToOctave(-1200)).toBe(0)
    expect(foldCentsToOctave(2400)).toBe(0)
  })

  it('keeps small offsets untouched', () => {
    expect(foldCentsToOctave(30)).toBe(30)
    expect(foldCentsToOctave(-45)).toBe(-45)
  })

  it('folds an octave-and-a-bit to the bit', () => {
    expect(foldCentsToOctave(1230)).toBe(30)
    expect(foldCentsToOctave(-1240)).toBeCloseTo(-40, 6)
  })

  it('maps a perfect fifth to -500 (still wrong)', () => {
    expect(foldCentsToOctave(700)).toBe(-500)
  })
})

describe('createPitchCompareEngine', () => {
  const A3 = midiToFreq(57)
  const A4 = midiToFreq(69)
  const C5 = midiToFreq(72)
  const E4 = midiToFreq(64)

  it('scores singing one octave below the reference as in tolerance', () => {
    const e = createPitchCompareEngine()
    const { judged, hits } = feed(e, 0, 600, A4, A3)
    expect(judged).toBeGreaterThan(0)
    expect(hits).toBe(judged)
  })

  it('rejects a perfect-fifth error even octave-folded', () => {
    const e = createPitchCompareEngine()
    const { judged, hits } = feed(e, 0, 600, A4, E4)
    expect(judged).toBeGreaterThan(0)
    expect(hits).toBe(0)
  })

  it('gates frames during the reference stability window', () => {
    const e = createPitchCompareEngine({ stableMs: 130 })
    // Only ~100ms on the note: nothing should be judged yet.
    const { judged } = feed(e, 0, 100, A4, A4)
    expect(judged).toBe(0)
  })

  it('re-arms the grace window on note transitions', () => {
    const e = createPitchCompareEngine({ stableMs: 130 })
    feed(e, 0, 400, A4, A4)
    // Reference moves to C5; the first ~130ms after the move is not judged.
    const { judged } = feed(e, 0.4, 100, C5, C5)
    expect(judged).toBe(0)
    const { judged: after } = feed(e, 0.5, 300, C5, C5)
    expect(after).toBeGreaterThan(0)
  })

  it('ignores sub-minNote reference blips in note stats', () => {
    const e = createPitchCompareEngine({ minNoteMs: 150 })
    feed(e, 0, 80, A4, 0) // 80ms blip
    e.push(0.08, 0, 0) // silence closes it
    expect(e.noteStats()).toEqual({ notesTotal: 0, notesHit: 0 })
  })

  it('counts unsung notes as misses in note stats', () => {
    const e = createPitchCompareEngine()
    const { t } = feed(e, 0, 500, A4, A4) // sung note
    e.push(t, 0, 0)
    const { t: t2 } = feed(e, t + 0.1, 500, C5, 0) // note the singer skipped
    e.push(t2, 0, 0)
    expect(e.noteStats()).toEqual({ notesTotal: 2, notesHit: 1 })
  })

  it('includes the still-active segment in note stats', () => {
    const e = createPitchCompareEngine()
    feed(e, 0, 500, A4, A4)
    expect(e.noteStats()).toEqual({ notesTotal: 1, notesHit: 1 })
  })

  it('does not judge frames where the singer is silent', () => {
    const e = createPitchCompareEngine()
    const { judged } = feed(e, 0, 500, A4, 0)
    expect(judged).toBe(0)
  })

  it('tracks marks for loop iterations', () => {
    const e = createPitchCompareEngine()
    feed(e, 0, 500, A4, A4)
    const firstRun = e.pointsSinceMark()
    expect(firstRun).toBeGreaterThan(0)
    e.mark()
    expect(e.pointsSinceMark()).toBe(0)
    feed(e, 1, 300, A4, A4)
    expect(e.pointsSinceMark()).toBeGreaterThan(0)
    expect(e.pointCount()).toBeGreaterThan(e.pointsSinceMark())
  })

  it('reset clears everything', () => {
    const e = createPitchCompareEngine()
    feed(e, 0, 500, A4, A4)
    e.reset()
    expect(e.pointCount()).toBe(0)
    expect(e.noteStats()).toEqual({ notesTotal: 0, notesHit: 0 })
  })

  it('reports folded cents on the point', () => {
    const e = createPitchCompareEngine()
    feed(e, 0, 300, A4, A4)
    const p = e.push(0.32, A4, A3 * Math.pow(2, 20 / 1200))
    expect(p).not.toBeNull()
    expect(Math.abs(p!.centsOff - 20)).toBeLessThan(1)
  })
})
