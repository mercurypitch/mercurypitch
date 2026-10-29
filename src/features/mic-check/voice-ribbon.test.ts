import { describe, expect, it } from 'vitest'
import { bandLevel, createRibbonMotion, stepRibbonMotion } from './voice-ribbon'

const FRAME = 1 / 60

/** Step the motion for `seconds` at a steady input. */
function settle(
  seconds: number,
  levels: { rms: number; peak: number; low: number; mid: number; high: number },
  focus: number | null = null,
  motion = createRibbonMotion(),
) {
  for (let t = 0; t < seconds; t += FRAME) {
    stepRibbonMotion(motion, levels, FRAME, focus)
  }
  return motion
}

const SINGING = { rms: 0.05, peak: 0.2, low: 0.5, mid: 0.6, high: 0.2 }
const SILENT = { rms: 0, peak: 0, low: 0, mid: 0, high: 0 }

describe('bandLevel', () => {
  it('averages the bins between two frequencies', () => {
    // 48 kHz over a 2048-point FFT is 23.4375 Hz a bin, so 60-350 Hz reads
    // bins 2 to 15: the bins that hold any of the band count.
    const spectrum = new Uint8Array(1024)
    spectrum.fill(255, 2, 16)
    expect(bandLevel(spectrum, 48000, 2048, 60, 350)).toBe(1)
    expect(bandLevel(spectrum, 48000, 2048, 2600, 10000)).toBe(0)
  })

  it('answers zero for nothing to read', () => {
    expect(bandLevel(new Uint8Array(0), 48000, 2048, 60, 350)).toBe(0)
  })
})

describe('stepRibbonMotion', () => {
  it('stays at rest in silence', () => {
    expect(settle(1, SILENT).energy).toBe(0)
  })

  it('rises with a voice and settles back after it', () => {
    const motion = settle(1, SINGING)
    expect(motion.energy).toBeGreaterThan(0.3)
    expect(motion.mid).toBeGreaterThan(0.4)
    settle(2, SILENT, null, motion)
    expect(motion.energy).toBeLessThan(0.01)
  })

  it('leans towards a held note and lets go when it ends', () => {
    const motion = settle(1, SINGING, 0.6)
    expect(motion.lean).toBeCloseTo(0.6, 2)
    expect(motion.leanWeight).toBeGreaterThan(0.95)
    settle(2, SINGING, null, motion)
    expect(motion.leanWeight).toBeLessThan(0.01)
  })

  it('never leans past the ribbon ends', () => {
    expect(settle(1, SINGING, 3).lean).toBeLessThanOrEqual(0.95)
  })
})
