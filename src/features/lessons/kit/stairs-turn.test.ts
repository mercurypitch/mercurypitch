// ============================================================
// Staircase turn tests — each stair lands on its head, and nothing stays behind
// ============================================================
//
// Lesson 16's Step 1 (its WEB-SPEC, Toys 3): the turn lays a ghost of each
// stair over the figures and takes it onto its note's head in 0.8 s, or,
// with motion paused, fades the heads in at their places; either way the
// ghosts are gone once it ends or is cut short.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import './browser-doubles.test-fixtures'
import type * as MotionSwitch from './motion-switch'
import type { Box } from './stairs-turn'
import { FADE_SEC, TURN_SEC, turnStairs, turnTransform } from './stairs-turn'

let paused = false
vi.mock('./motion-switch', async (actual) => {
  const real = await actual<typeof MotionSwitch>()
  return {
    ...real,
    Motion: {
      ...real.Motion,
      get paused() {
        return paused
      },
    },
  }
})

/** Five stairs, each 40 px wide and taller as it climbs, and five heads on a staff to their right. */
const FROM: Box[] = [0, 1, 2, 3, 4].map((i) => ({
  x: 10 + i * 40,
  y: 200 - [0, 2, 4, 5, 7][i] * 10,
  w: 40,
  h: 40 + [0, 2, 4, 5, 7][i] * 10,
}))
const TO: Box[] = [0, 1, 2, 3, 4].map((i) => ({
  x: 300 + i * 30,
  y: 120 - i * 6,
  w: 14,
  h: 10,
}))

let layer: HTMLElement
const ghosts = (): HTMLElement[] =>
  Array.from(layer.querySelectorAll<HTMLElement>('.stairs-ghost'))

beforeEach(() => {
  vi.useFakeTimers()
  paused = false
  document.body.innerHTML = '<div id="pair"></div>'
  layer = document.getElementById('pair') as HTMLElement
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('turnTransform', () => {
  it('moves a box onto the other by their centres, a quarter turn, scaled so that once turned it is the other box', () => {
    // Arrange: a 40 x 60 stair onto a 14 x 10 head
    const a: Box = { x: 0, y: 0, w: 40, h: 60 }
    const b: Box = { x: 100, y: 50, w: 14, h: 10 }

    // Act
    const t = turnTransform(a, b)

    // Assert: across, the turned height (60 x 14/60); down, the turned width (40 x 10/40)
    expect(t).toBe(
      'translate(87.0px, 25.0px) rotate(-90deg) scale(0.250, 0.233)',
    )
  })
})

describe('turnStairs', () => {
  it('lays a ghost on each stair, takes it to its head in 0.8 s, then takes the ghosts away', async () => {
    // Arrange
    const animate = vi.fn(() => ({ cancel: vi.fn() }) as unknown as Animation)
    HTMLElement.prototype.animate =
      animate as unknown as typeof HTMLElement.prototype.animate

    // Act
    const turn = turnStairs({ from: FROM, to: TO, layer })
    const laid = ghosts().map((g) => [g.style.left, g.style.top, g.style.width])
    vi.advanceTimersByTime(TURN_SEC * 1000)

    // Assert: hidden from screen readers, one per stair, from where each stair stands
    expect(laid).toEqual(FROM.map((b) => [`${b.x}px`, `${b.y}px`, '40px']))
    expect(animate).toHaveBeenCalledTimes(5)
    expect(animate.mock.calls[2]).toMatchObject([
      [
        { transform: 'none' },
        { transform: turnTransform(FROM[2], TO[2]), borderRadius: '50%' },
      ],
      { duration: 800 },
    ])
    expect(await turn.done).toBe(true)
    expect(layer.querySelector('.stairs-turn')).toBeNull()
  })

  it('with motion paused, fades the heads in at their places in 0.3 s, and nothing travels', async () => {
    // Arrange
    paused = true
    const animate = vi.fn(() => ({ cancel: vi.fn() }) as unknown as Animation)
    HTMLElement.prototype.animate =
      animate as unknown as typeof HTMLElement.prototype.animate

    // Act
    const turn = turnStairs({ from: FROM, to: TO, layer })
    const laid = ghosts().map((g) => [g.className, g.style.left, g.style.top])
    vi.advanceTimersByTime(FADE_SEC * 1000)

    // Assert
    expect(laid).toEqual(
      TO.map((b) => ['stairs-ghost is-head', `${b.x}px`, `${b.y}px`]),
    )
    expect(animate.mock.calls[0]).toMatchObject([
      [{ opacity: 0 }, { opacity: 1 }],
      { duration: 300 },
    ])
    expect(await turn.done).toBe(true)
    expect(ghosts()).toEqual([])
  })

  it('cut short, stops its animations, says so, and leaves no ghost', async () => {
    // Arrange
    const cancels: ReturnType<typeof vi.fn>[] = []
    HTMLElement.prototype.animate = vi.fn(() => {
      const cancel = vi.fn()
      cancels.push(cancel)
      return { cancel } as unknown as Animation
    }) as unknown as typeof HTMLElement.prototype.animate
    const turn = turnStairs({ from: FROM, to: TO, layer })

    // Act
    vi.advanceTimersByTime(300)
    turn.cancel()

    // Assert
    expect(await turn.done).toBe(false)
    expect(cancels.every((c) => c.mock.calls.length === 1)).toBe(true)
    expect(ghosts()).toEqual([])
  })
})
