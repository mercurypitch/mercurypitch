// Loop-span tests pin the one description every looping surface shares.
// ============================================================

import { describe, expect, it } from 'vitest'
import { foldIntoLoop, normalizeLoopSpan, quantizeSpanToBeats, shouldWrapToStart, } from './loop-span'

describe('normalizeLoopSpan', () => {
  it('orders the two marks however they were dropped', () => {
    expect(normalizeLoopSpan(12, 4, 60)).toEqual({ start: 4, end: 12 })
    expect(normalizeLoopSpan(4, 12, 60)).toEqual({ start: 4, end: 12 })
  })

  it('keeps the span inside the timeline', () => {
    expect(normalizeLoopSpan(-5, 90, 60)).toEqual({ start: 0, end: 60 })
  })

  it('has no span until both marks exist', () => {
    expect(normalizeLoopSpan(4, null, 60)).toBeNull()
    expect(normalizeLoopSpan(null, 12, 60)).toBeNull()
  })

  it('refuses a loop too short to hear as one', () => {
    expect(normalizeLoopSpan(4, 4.1, 60)).toBeNull()
    expect(normalizeLoopSpan(4, 4, 60)).toBeNull()
  })

  it('falls back to the marks when the timeline length is unknown', () => {
    // A streamed backing reports duration 0 until its first read.
    expect(normalizeLoopSpan(4, 12, 0)).toEqual({ start: 4, end: 12 })
    expect(normalizeLoopSpan(4, 12, Number.NaN)).toEqual({ start: 4, end: 12 })
  })
})

describe('shouldWrapToStart', () => {
  const span = { start: 4, end: 12 }

  it('waits until the playhead has passed B', () => {
    expect(shouldWrapToStart(11.9, span)).toBe(false)
    expect(shouldWrapToStart(12, span)).toBe(true)
  })

  it('never wraps a playhead that has not reached the loop yet', () => {
    // Setting a loop must not yank the player back mid-phrase.
    expect(shouldWrapToStart(0, span)).toBe(false)
  })

  it('is inert without a loop', () => {
    expect(shouldWrapToStart(99, null)).toBe(false)
  })
})

describe('foldIntoLoop', () => {
  const span = { start: 4, end: 12 }

  it('leaves everything before B alone', () => {
    expect(foldIntoLoop(0, span)).toBe(0)
    expect(foldIntoLoop(11.5, span)).toBe(11.5)
  })

  it('folds a monotonic clock back into the span', () => {
    expect(foldIntoLoop(12, span)).toBe(4)
    expect(foldIntoLoop(13, span)).toBe(5)
    // Second pass, third pass: still inside the same eight units.
    expect(foldIntoLoop(20, span)).toBe(4)
    expect(foldIntoLoop(29, span)).toBe(5)
  })

  it('is the identity without a loop', () => {
    expect(foldIntoLoop(42, null)).toBe(42)
  })
})

describe('quantizeSpanToBeats', () => {
  it('snaps to whole beats so the downbeat cannot drift', () => {
    expect(quantizeSpanToBeats({ start: 3.6, end: 11.2 })).toEqual({
      start: 4,
      end: 11,
    })
  })

  it('keeps at least one beat of loop', () => {
    expect(quantizeSpanToBeats({ start: 4.1, end: 4.2 })).toEqual({
      start: 4,
      end: 5,
    })
  })
})
