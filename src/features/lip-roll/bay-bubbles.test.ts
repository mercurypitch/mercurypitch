// ============================================================
// The bubbles the voice sheds: born at its head, gone in a second
// ============================================================

import { describe, expect, it } from 'vitest'
import { BUBBLE_LIFE_SEC, BUBBLE_RATE, createBubbleStream, MAX_BUBBLES, } from './bay-bubbles'

/** A stream stepped at 60 frames a second for `seconds`. */
function run(
  seconds: number,
  head: { x: number; y: number } | null = { x: 1, y: 1.2 },
) {
  const stream = createBubbleStream(() => 0.5)
  for (let i = 0; i <= Math.round(seconds * 60); i++) {
    stream.step(i / 60, head)
  }
  return stream
}

describe('the bubble stream', () => {
  it('sheds bubbles at its rate while the voice sounds', () => {
    const stream = run(0.5)

    expect(stream.live().length).toBeGreaterThanOrEqual(
      Math.floor(0.5 * BUBBLE_RATE) - 1,
    )
  })

  it('keeps at most MAX_BUBBLES alive however long the voice sounds', () => {
    expect(run(10).live().length).toBeLessThanOrEqual(MAX_BUBBLES)
  })

  it('sheds none while the voice is silent, and the old ones go within their life', () => {
    const stream = run(0.5)
    stream.step(0.5 + BUBBLE_LIFE_SEC + 0.01, null)

    expect(stream.live()).toEqual([])
    expect(run(1, null).live()).toEqual([])
  })

  it('lets each bubble rise from where it was born, in the world, and fade', () => {
    const stream = createBubbleStream(() => 0.5)
    stream.step(0, { x: 2, y: 1.3 })
    stream.step(0.1, { x: 2, y: 1.3 })
    const [born] = stream.live()
    stream.step(0.6, null)
    const [later] = stream.live()

    expect(later.y).toBeLessThan(born.y)
    expect(later.x).toBeLessThan(born.x + 0.01)
    expect(later.alpha).toBeLessThan(1)
  })

  it('starts empty again when cleared', () => {
    const stream = run(0.5)
    stream.clear()

    expect(stream.live()).toEqual([])
  })
})
