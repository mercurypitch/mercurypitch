import { describe, expect, it } from 'vitest'
import type { VibratoConfig } from './vibrato'
import { createVibratoDetector } from './vibrato'

const CFG: VibratoConfig = {
  windowSec: 1.0,
  minHz: 3.5,
  maxHz: 8.5,
  minDepthCents: 15,
  maxDepthCents: 140,
  minSamples: 20,
  resetGapMs: 250,
}

/** Feed a synthetic pitch stream: base midi + sine wobble. */
const run = (
  det: ReturnType<typeof createVibratoDetector>,
  seconds: number,
  hz: number,
  depthSemis: number,
  stepMs = 16,
) => {
  let st = det.feed(0, 60)
  for (let t = stepMs; t <= seconds * 1000; t += stepMs) {
    const m = 60 + depthSemis * Math.sin(2 * Math.PI * hz * (t / 1000))
    st = det.feed(t, m)
  }
  return st
}

describe('createVibratoDetector', () => {
  it('hears a 5.5 Hz half-semitone wave as vibrato', () => {
    const st = run(createVibratoDetector(CFG), 1.4, 5.5, 0.25)
    expect(st.active).toBe(true)
    expect(st.rateHz).toBeGreaterThan(4)
    expect(st.rateHz).toBeLessThan(7)
    expect(st.depthCents).toBeCloseTo(25, -1)
    expect(st.strength).toBeGreaterThan(0.2)
  })

  it('a steady note is not vibrato', () => {
    const st = run(createVibratoDetector(CFG), 1.4, 5.5, 0)
    expect(st.active).toBe(false)
  })

  it('slow scooping (1 Hz) is not vibrato', () => {
    const st = run(createVibratoDetector(CFG), 1.6, 1.0, 0.4)
    expect(st.active).toBe(false)
  })

  it('a wild wide trill (two semitones) is beyond the band', () => {
    const st = run(createVibratoDetector(CFG), 1.4, 5.0, 2.0)
    expect(st.active).toBe(false)
  })

  it('needs a filled window before judging', () => {
    const det = createVibratoDetector(CFG)
    const st = run(det, 0.2, 5.5, 0.25)
    expect(st.active).toBe(false)
  })

  it('a long silence gap resets the window', () => {
    const det = createVibratoDetector(CFG)
    run(det, 1.2, 5.5, 0.25)
    const st = det.feed(2000, 60) // 800 ms gap
    expect(st.active).toBe(false)
  })
})
