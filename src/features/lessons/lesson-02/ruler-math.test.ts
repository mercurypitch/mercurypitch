// ============================================================
// Lesson 2 ruler maths tests — cents, hertz and how the app reads them
// ============================================================

import { describe, expect, it } from 'vitest'
import { appName, appSpoken, centsHz, hz1, hz2, hzCents, markerAt, reading, rulerValueText, } from './ruler-math'

describe('cents and hertz', () => {
  it('doubles 220 Hz in 1,200 cents, a hundred to each equal semitone (FACTS 22, 29a)', () => {
    expect(centsHz(0)).toBe(220)
    expect(centsHz(1200)).toBeCloseTo(440, 9)
    expect(hz2(centsHz(100))).toBe('233.08')
    expect(hz2(centsHz(200))).toBe('246.94')
    expect(hzCents(centsHz(437))).toBeCloseTo(437, 9)
  })

  it('prints hertz to two decimals on the ruler and to one on the monitor', () => {
    expect(hz2(centsHz(37))).toBe('224.75')
    expect(hz1(centsHz(37))).toBe('224.8')
  })
})

describe('reading', () => {
  it('names the nearest note and flips to the next one at 50 cents, as the monitor does (FACTS 24, 30)', () => {
    expect(reading(49)).toEqual({ midi: 57, off: 49 })
    expect(reading(50)).toEqual({ midi: 58, off: -50 })
    expect(reading(160)).toEqual({ midi: 59, off: -40 })
  })

  it('puts the marker at the bar ends at -50 and +50, and in the middle on the note', () => {
    expect(markerAt(-50)).toBe(0)
    expect(markerAt(0)).toBe(0.5)
    expect(markerAt(50)).toBe(1)
    expect(markerAt(80)).toBe(1)
  })

  it("spells the note the app's way, with sharps: A#3, then in words", () => {
    expect(appName(58)).toBe('A#3')
    expect(appName(60)).toBe('C4')
    expect(appSpoken(58)).toBe('A sharp 3')
  })
})

describe('rulerValueText', () => {
  it('says the nearest note, the distance from it, then the frequency (WEB-SPEC Toys 2)', () => {
    expect(rulerValueText(37)).toBe('A3 plus 37 cents, 224.75 hertz')
    expect(rulerValueText(60)).toBe('A sharp 3 minus 40 cents, 227.76 hertz')
    expect(rulerValueText(0)).toBe('A3 exactly, 220.00 hertz')
    expect(rulerValueText(1)).toBe('A3 plus 1 cent, 220.13 hertz')
    expect(rulerValueText(1200)).toBe('A4 exactly, 440.00 hertz')
  })
})
