// Where the mixer's A and B may go, and which spans the playback clock loops.
import { describe, expect, it } from 'vitest'
import type { LoopPoints } from './loop-points'
import { LOOP_MIN_GAP, loopSpan, placeLoopPoint } from './loop-points'

const UNSET: LoopPoints = { start: null, end: null }

describe('placeLoopPoint', () => {
  it('counts an A at 0:00 as set', () => {
    expect(placeLoopPoint('A', 0, UNSET)).toEqual({
      placed: true,
      points: { start: 0, end: null },
    })
  })

  it('refuses a B on the same instant as A, and says why', () => {
    const result = placeLoopPoint('B', 5, { start: 5, end: null })

    expect(result).toEqual({
      placed: false,
      reason: 'The loop end (B) has to be at least 0.1 s after its start (A).',
    })
  })

  it('refuses a B up to 0.1 s after A, or before it', () => {
    const a: LoopPoints = { start: 5, end: null }

    expect(placeLoopPoint('B', 5 + LOOP_MIN_GAP, a).placed).toBe(false)
    expect(placeLoopPoint('B', 4, a).placed).toBe(false)
    expect(placeLoopPoint('B', 5.2, a)).toEqual({
      placed: true,
      points: { start: 5, end: 5.2 },
    })
  })

  it('refuses an A at B, past it, or within 0.1 s before it', () => {
    const loop: LoopPoints = { start: 2, end: 10 }

    expect(placeLoopPoint('A', 10 - LOOP_MIN_GAP, loop)).toEqual({
      placed: false,
      reason: 'The loop start (A) has to be at least 0.1 s before its end (B).',
    })
    expect(placeLoopPoint('A', 10, loop).placed).toBe(false)
    expect(placeLoopPoint('A', 12, loop).placed).toBe(false)
    expect(placeLoopPoint('A', 9.8, loop)).toEqual({
      placed: true,
      points: { start: 9.8, end: 10 },
    })
  })

  it('starts a B set on its own at 0:00, the start it loops from', () => {
    expect(placeLoopPoint('B', 10, UNSET)).toEqual({
      placed: true,
      points: { start: 0, end: 10 },
    })
    expect(placeLoopPoint('B', LOOP_MIN_GAP, UNSET).placed).toBe(false)
  })

  it('reads a time before the song as its start', () => {
    expect(placeLoopPoint('A', -3, UNSET)).toEqual({
      placed: true,
      points: { start: 0, end: null },
    })
  })
})

describe('loopSpan', () => {
  it('loops nothing while the loop is off', () => {
    expect(loopSpan(false, { start: 5, end: 10 }, 30)).toBeNull()
  })

  it('loops nothing between an A and a B on the same instant', () => {
    expect(loopSpan(true, { start: 5, end: 5 }, 30)).toBeNull()
    expect(loopSpan(true, { start: 5, end: 5.05 }, 30)).toBeNull()
    expect(loopSpan(true, { start: 10, end: 5 }, 30)).toBeNull()
  })

  it('loops a span exactly 0.1 s long, as a dragged marker leaves it', () => {
    const start = 0.7
    expect(
      loopSpan(true, { start, end: start + LOOP_MIN_GAP }, 30),
    ).not.toBeNull()
  })

  it('loops from the start of the song without an A, and to its end without a B', () => {
    expect(loopSpan(true, { start: null, end: 10 }, 30)).toEqual({
      start: 0,
      end: 10,
    })
    expect(loopSpan(true, { start: 20, end: null }, 30)).toEqual({
      start: 20,
      end: 30,
    })
  })
})
