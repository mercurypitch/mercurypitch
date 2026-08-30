import { describe, expect, it } from 'vitest'
import { computeRangeFit, createSteadyDetector } from './range-finder'

describe('createSteadyDetector', () => {
  it('locks after the hold time within tolerance', () => {
    const det = createSteadyDetector(700, 0.75)
    let locked: number | null = null
    for (let t = 0; t <= 800 && locked === null; t += 50) {
      locked = det.push(t, 57 + Math.sin(t) * 0.3)
    }
    expect(locked).not.toBeNull()
    expect(Math.abs((locked ?? 0) - 57)).toBeLessThan(0.5)
  })

  it('silence resets the run', () => {
    const det = createSteadyDetector(700, 0.75)
    for (let t = 0; t <= 600; t += 50) det.push(t, 57)
    det.push(650, null)
    // resumes from scratch: 600 more ms of the note is not enough yet
    let locked: number | null = null
    for (let t = 700; t <= 1300; t += 50) locked = det.push(t, 57)
    expect(locked).toBeNull()
    expect(det.push(1450, 57)).not.toBeNull()
  })

  it('a slide into the note re-anchors instead of locking early', () => {
    const det = createSteadyDetector(700, 0.75)
    // glide up from 50 to 57 over 600ms, then hold 57
    let locked: number | null = null
    for (let t = 0; t <= 600; t += 50) {
      locked = det.push(t, 50 + (t / 600) * 7)
      expect(locked).toBeNull()
    }
    for (let t = 650; t <= 1400 && locked === null; t += 50) {
      locked = det.push(t, 57)
    }
    expect(locked).not.toBeNull()
    expect(Math.abs((locked ?? 0) - 57)).toBeLessThan(0.8)
  })

  it('reports hold progress', () => {
    const det = createSteadyDetector(700, 0.75)
    det.push(0, 60)
    det.push(350, 60)
    expect(det.progress(350)).toBeCloseTo(0.5)
    expect(det.progress(700)).toBe(1)
  })
})

describe('computeRangeFit', () => {
  it('bias is where the range center sits relative to the comfy hum', () => {
    // comfy A3 (57), range 50..68 → center 59 → songs sit 2 higher
    expect(computeRangeFit(57, 50, 68, 12).biasSemis).toBe(2)
    // hum above the center → songs sit lower
    expect(computeRangeFit(60, 48, 64, 12).biasSemis).toBe(-4)
  })

  it('a centered hum needs no bias', () => {
    expect(computeRangeFit(57, 50, 64, 12).biasSemis).toBe(0)
  })

  it('sorts a swapped low/high and clamps a wild measurement', () => {
    const fit = computeRangeFit(57, 69, 50, 12)
    expect(fit.loMidi).toBe(50)
    expect(fit.hiMidi).toBe(69)
    expect(computeRangeFit(40, 70, 90, 12).biasSemis).toBe(12)
  })
})
