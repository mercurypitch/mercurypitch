import { describe, expect, it } from 'vitest'
import type { LoopState } from '@/lib/ab-loop'
import { clampLoopB, isSeekOutsideLoop, loopRegionPct, shouldLoopBack, } from '@/lib/ab-loop'

// A valid, enabled loop over beats [4, 8) with no manual-seek escape.
const base: LoopState = { enabled: true, a: 4, b: 8, seekedOutside: false }

describe('shouldLoopBack', () => {
  it('loops back once the playhead reaches B', () => {
    expect(shouldLoopBack(8, base)).toBe(true)
    expect(shouldLoopBack(9, base)).toBe(true)
  })

  it('does not loop before B is reached', () => {
    expect(shouldLoopBack(7.999, base)).toBe(false)
  })

  it('does not loop when B is unset (only A marked)', () => {
    expect(shouldLoopBack(10, { ...base, b: 0 })).toBe(false)
  })

  it('does not loop when B is before A (backwards region)', () => {
    // a=8, b=4 → a < b is false, never loops.
    expect(shouldLoopBack(10, { ...base, a: 8, b: 4 })).toBe(false)
  })

  it('does not loop when the playhead is still short of A', () => {
    expect(shouldLoopBack(2, base)).toBe(false)
  })

  it('does not loop past the region when disabled', () => {
    expect(shouldLoopBack(9, { ...base, enabled: false })).toBe(false)
  })

  it('is suppressed while the user has seeked outside the loop', () => {
    // Even though beat >= b, the manual-seek escape flag keeps us from yanking
    // the playhead back to A.
    expect(shouldLoopBack(9, { ...base, seekedOutside: true })).toBe(false)
  })

  it('treats beat exactly at B as a loop point', () => {
    expect(shouldLoopBack(base.b, base)).toBe(true)
  })
})

describe('isSeekOutsideLoop', () => {
  it('is true for a seek before A', () => {
    expect(isSeekOutsideLoop(2, 4, 8)).toBe(true)
  })

  it('is true for a seek at or after B (half-open region)', () => {
    expect(isSeekOutsideLoop(8, 4, 8)).toBe(true)
    expect(isSeekOutsideLoop(10, 4, 8)).toBe(true)
  })

  it('is false for a seek inside [A, B)', () => {
    expect(isSeekOutsideLoop(4, 4, 8)).toBe(false)
    expect(isSeekOutsideLoop(6, 4, 8)).toBe(false)
    expect(isSeekOutsideLoop(7.999, 4, 8)).toBe(false)
  })

  it('is false when the region is invalid (a >= b)', () => {
    expect(isSeekOutsideLoop(2, 8, 4)).toBe(false)
    expect(isSeekOutsideLoop(2, 4, 4)).toBe(false)
  })
})

describe('loopRegionPct', () => {
  it('returns null when the timeline has no length', () => {
    expect(loopRegionPct(4, 8, 0)).toBeNull()
    expect(loopRegionPct(4, 8, -1)).toBeNull()
  })

  it('returns null for an incomplete or invalid region', () => {
    expect(loopRegionPct(0, 8, 16)).toBeNull() // A unset
    expect(loopRegionPct(4, 0, 16)).toBeNull() // B unset
    expect(loopRegionPct(8, 4, 16)).toBeNull() // backwards
    expect(loopRegionPct(4, 4, 16)).toBeNull() // zero width
  })

  it('computes left and width as percentages of the timeline', () => {
    // [4, 8) of 16 beats → left 25%, width 25%.
    expect(loopRegionPct(4, 8, 16)).toEqual({ left: 25, width: 25 })
  })

  it('floors the width at 0.5% so a tiny loop stays visible', () => {
    // A 0.01-beat loop in a 100-beat song would be 0.01% wide.
    const r = loopRegionPct(10, 10.01, 100)
    expect(r).not.toBeNull()
    expect(r!.width).toBe(0.5)
  })

  it('keeps left + width within 100% even when B exceeds the timeline', () => {
    // B past the end: width clamps so the overlay never spills off the rail.
    const r = loopRegionPct(8, 20, 10)
    expect(r).not.toBeNull()
    expect(r!.left + r!.width).toBeLessThanOrEqual(100)
  })

  it('clamps a near-full loop so it does not overflow the rail', () => {
    const r = loopRegionPct(99.99, 100, 100)
    expect(r).not.toBeNull()
    // left ~99.99, min width 0.5 would overflow → width clamped to <= 0.01.
    expect(r!.left + r!.width).toBeLessThanOrEqual(100)
  })
})

describe('clampLoopB', () => {
  it('clamps a candidate B to the timeline length', () => {
    expect(clampLoopB(20, 4, 16)).toBe(16)
  })

  it('leaves a B within the timeline untouched', () => {
    expect(clampLoopB(8, 4, 16)).toBe(8)
  })

  it('can return a value <= A that the caller then rejects', () => {
    // clampLoopB itself does not enforce A < B; a B at/under A is the caller's
    // signal to treat the loop as invalid.
    expect(clampLoopB(3, 4, 16)).toBe(3)
  })
})
