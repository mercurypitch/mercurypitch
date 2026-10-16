// Which A and B make a loop: one rule, whoever asks.
import { describe, expect, it } from 'vitest'
import { hasPlayableLoop, LOOP_MIN_GAP } from './loop-gap'

describe('hasPlayableLoop', () => {
  it('waits for a B: an A alone would loop to the end of the song, which is not a loop the singer set', () => {
    expect(hasPlayableLoop(null, null)).toBe(false)
    expect(hasPlayableLoop(5, null)).toBe(false)
  })

  it('lets a B alone loop from 0:00', () => {
    expect(hasPlayableLoop(null, 9)).toBe(true)
    expect(hasPlayableLoop(null, 0.05)).toBe(false)
  })

  it('wants a span the clock would play, not only a B after the A', () => {
    expect(hasPlayableLoop(5, 9)).toBe(true)
    expect(hasPlayableLoop(9, 9)).toBe(false)
    expect(hasPlayableLoop(9, 5)).toBe(false)
    expect(hasPlayableLoop(5, 5.05)).toBe(false)
  })

  it('reads a span exactly 0.1 s long as ready, as a dragged marker leaves it', () => {
    // 0.7 s and 0.7 s + the gap are a hair under the gap apart in floating
    // point, and the clock loops them.
    const start = 0.7
    expect(start + LOOP_MIN_GAP - start).toBeLessThan(LOOP_MIN_GAP)
    expect(hasPlayableLoop(start, start + LOOP_MIN_GAP)).toBe(true)
  })
})
