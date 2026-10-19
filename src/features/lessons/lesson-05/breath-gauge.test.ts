// ============================================================
// Lesson 5 breath gauge tests — one long note's breath, after Sundberg
// ============================================================

import { describe, expect, it } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import { balanceAt, CROSSING, GAUGE_SEC, gaugePhases, gaugeSummary, lungsPush, noteNeeds, nowWords, } from './breath-gauge'
import { gaugeValueText } from './toy-gauge'

/** The area between the lungs' push and what the note needs, up to the crossing: how much the body holds back. */
function heldBack(n: 'quiet' | 'loud'): number {
  let sum = 0
  for (let t = 0; t < CROSSING[n]; t += 0.01)
    sum += (lungsPush(t) - noteNeeds(n)) * 0.01
  return sum
}

describe('the gauge (FACTS 74)', () => {
  it("crosses the lungs' falling push at 7 s for a quiet note and at 3 s for a loud one", () => {
    expect(GAUGE_SEC).toBe(10)
    expect(CROSSING).toEqual({ quiet: 7, loud: 3 })
    for (const n of ['quiet', 'loud'] as const)
      expect(lungsPush(CROSSING[n])).toBeCloseTo(noteNeeds(n), 12)
    // the lungs' push falls in a straight line
    expect(lungsPush(0) - lungsPush(5)).toBeCloseTo(
      lungsPush(5) - lungsPush(10),
      12,
    )
  })

  it('holds back before the crossing and adds after it', () => {
    expect([2, 6.9, 7, 9].map((t) => balanceAt('quiet', t))).toEqual([
      'holding back',
      'holding back',
      'adding',
      'adding',
    ])
    expect(nowWords('loud', 1)).toBe('Now: holding back')
    expect(nowWords('loud', 4)).toBe('Now: adding')
  })

  it('needs less holding back for a loud note', () => {
    expect(heldBack('loud')).toBeLessThan(heldBack('quiet'))
  })

  it('says its summary as WEB-SPEC words it, and lists both phases for reduced motion', () => {
    expect(gaugeSummary('quiet')).toBe(
      'Quiet note: for the first 7 of 10 seconds the lungs push harder than the note needs, so the body holds back; after that it adds',
    )
    expect(gaugeSummary('loud')).toBe(
      'Loud note: for the first 3 of 10 seconds the lungs push harder than the note needs, so the body holds back; after that it adds',
    )
    expect(gaugePhases('loud')).toEqual([
      'The first 3 seconds: holding back',
      'The last 7 seconds: adding',
    ])
    expect(gaugeValueText('quiet', 4)).toBe('4.0 seconds of 10: holding back')
  })
})
