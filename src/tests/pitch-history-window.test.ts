// ============================================================
// Pitch History Window Tests — oscilloscope-style sliding window
// GH #301 sub-item: pitch display history
// ============================================================

import { describe, expect, it } from 'vitest'
import { beatToHistoryX, HISTORY_FILL_RATIO, HISTORY_WINDOW_BEATS, } from '@/lib/pitch-history-window'

describe('beatToHistoryX', () => {
  const W = 800 // canvas width

  it('short melody: window covers entire melody, beat 2 maps to 50% of canvas', () => {
    // 4 beats, currentBeat doesn't matter when total <= window
    const x = beatToHistoryX(2, W, 0, 4)
    // windowStart=0, windowBeats=4, beat 2 → (2/4)*800 = 400 (50%)
    expect(x).toBeCloseTo(400, 0)
  })

  it('long melody early playback: windowStart=0, beat maps absolutely within first 16 beats', () => {
    // beat 3 < 16*0.65=10.4 → windowStart=0, windowBeats=16
    const x = beatToHistoryX(3, W, 3, 64)
    // (3-0)/16 * 800 = 150
    expect(x).toBeCloseTo(150, 0)
  })

  it('long melody mid-playback: current beat sits at ~65% of canvas', () => {
    // beat 20: windowStart = 20 - 10.4 = 9.6
    const x = beatToHistoryX(20, W, 20, 64)
    // windowStart=9.6, windowBeats=16
    // (20 - 9.6)/16 * 800 = 10.4/16 * 800 = 520 = 65% of 800
    expect(x).toBeCloseTo(520, -2)
    expect(x / W).toBeCloseTo(HISTORY_FILL_RATIO, 1)
  })

  it('long melody near end: windowStart clamped so window fits within totalBeats', () => {
    // total=64, beat 55: raw windowStart=55-10.4=44.6
    // clamp: 44.6 ≤ 64-16=48 → stays at 44.6 (not clamped)
    const x1 = beatToHistoryX(55, W, 55, 64)
    expect(x1).toBeCloseTo(((55 - 44.6) / 16) * 800, -2)

    // beat 60: raw windowStart=60-10.4=49.6
    // clamp: max(0, min(49.6, 48)) = 48
    const x2 = beatToHistoryX(60, W, 60, 64)
    // windowStart=48, windowBeats=16
    // (60 - 48)/16 * 800 = 12/16 * 800 = 600 = 75%
    expect(x2).toBeCloseTo(600, 0)
    expect(x2 / W).toBeCloseTo(0.75, 1)
  })

  it('boundary: currentBeat=0, windowStart=0', () => {
    const x = beatToHistoryX(0, W, 0, 64)
    expect(x).toBe(0)

    // beat 0 should be at left edge
    const x2 = beatToHistoryX(5, W, 0, 64)
    // windowStart=0, windowBeats=16
    expect(x2).toBeCloseTo((5 / 16) * 800, 0)
  })

  it('handles edge cases: NaN, Infinity, zero width', () => {
    expect(beatToHistoryX(NaN, W, 0, 64)).toBe(0)
    expect(beatToHistoryX(Infinity, W, 0, 64)).toBe(0)
    expect(beatToHistoryX(10, 0, 10, 64)).toBe(0)
    // zero totalBeats is clamped to 1, so beat 5 maps to (5/1)*800=4000
    expect(beatToHistoryX(5, W, 5, 0)).toBe(4000)
  })

  it('window never exceeds totalBeats range', () => {
    // Pick a random beat in a 10-beat melody
    const x = beatToHistoryX(7, W, 7, 10)
    // Should produce a valid finite X within canvas
    expect(x).toBeGreaterThanOrEqual(0)
    expect(x).toBeLessThanOrEqual(W)

    const x0 = beatToHistoryX(0, W, 0, 10)
    expect(x0).toBeGreaterThanOrEqual(0)
    expect(x0).toBeLessThanOrEqual(W)

    const xEnd = beatToHistoryX(10, W, 10, 10)
    expect(xEnd).toBeGreaterThanOrEqual(0)
    expect(xEnd).toBeLessThanOrEqual(W)
  })

  it('HISTORY_WINDOW_BEATS is 16', () => {
    expect(HISTORY_WINDOW_BEATS).toBe(16)
  })

  it('HISTORY_FILL_RATIO is 0.65', () => {
    expect(HISTORY_FILL_RATIO).toBe(0.65)
  })
})
