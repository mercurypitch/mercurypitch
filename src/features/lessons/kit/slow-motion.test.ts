// ============================================================
// Slow motion tests — 220 Hz slowed 220 times is once a second
// ============================================================

import { describe, expect, it } from 'vitest'
import { createSlowClock, SLOW_FACTOR, slowRate } from './slow-motion'

describe('createSlowClock', () => {
  it('counts one cycle a second at 220 Hz and two at 440 Hz (FACTS 22)', () => {
    // Arrange
    const a3 = createSlowClock()
    const a4 = createSlowClock()

    // Act: three seconds in sixtieths
    for (let i = 0; i < 180; i++) {
      a3.advance(1 / 60, 220)
      a4.advance(1 / 60, 440)
    }

    // Assert
    expect(SLOW_FACTOR).toBe(220)
    expect(a3.cycles).toBe(3)
    expect(a4.cycles).toBe(6)
  })

  it('says when a step completes a cycle, and only then', () => {
    // Arrange
    const clock = createSlowClock()

    // Act
    const early = clock.advance(0.5, 220)
    const crossing = clock.advance(0.6, 220)

    // Assert
    expect([early, crossing]).toEqual([false, true])
    expect(clock.phase).toBeCloseTo(0.1, 6)
  })

  it('keeps its phase when the pitch changes mid-count, and resets to zero', () => {
    // Arrange
    const clock = createSlowClock()
    clock.advance(0.25, 220)

    // Act
    clock.advance(0.25, 440)
    const phase = clock.phase
    clock.reset()

    // Assert
    expect(phase).toBeCloseTo(0.75, 6)
    expect([clock.cycles, clock.phase]).toEqual([0, 0])
  })
})

describe('slowRate', () => {
  it('reads whole rates plainly and others to one place', () => {
    expect(slowRate(220)).toBe('1')
    expect(slowRate(440)).toBe('2')
    expect(slowRate(330)).toBe('1.5')
    expect(slowRate(110)).toBe('0.5')
  })
})
