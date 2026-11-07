// Level health tests — a clipped signal before anything else, a room as loud as the player, and a noise floor that falls at once and rises over seconds.

import { describe, expect, it } from 'vitest'
import { createNoiseFloorFollower, describeInputHealth } from './level-health'

describe('describeInputHealth', () => {
  it('calls a clipped signal unusable before anything else', () => {
    // Loud and noisy at once: clipping is the one the player must fix first.
    expect(describeInputHealth(0.999, 0.6).state).toBe('clipping')
  })

  it('says nothing is coming in rather than guessing at a level', () => {
    expect(describeInputHealth(0.004, 0).state).toBe('silent')
  })

  it('calls out a room as loud as the guitar', () => {
    expect(describeInputHealth(0.2, 0.12).state).toBe('noisy')
  })

  it('warns before clipping, not only after', () => {
    expect(describeInputHealth(0.85, 0.01).state).toBe('hot')
  })

  it('asks for more signal when there is barely any', () => {
    expect(describeInputHealth(0.03, 0.002).state).toBe('quiet')
  })

  it('stays out of the way when the level is fine', () => {
    const reading = describeInputHealth(0.4, 0.01)
    expect(reading.state).toBe('good')
    expect(reading.hint).not.toBe('')
  })

  it('keeps an uncertain note distinct from silence', () => {
    const uncertain = {
      state: 'uncertain' as const,
      hint: 'Signal is present, but the note is not stable enough to name.',
    }
    expect(uncertain.state).not.toBe('silent')
    expect(uncertain.hint).toContain('not stable enough')
  })
})

describe('createNoiseFloorFollower', () => {
  it('drops to a quieter moment immediately', () => {
    const follower = createNoiseFloorFollower()
    follower.push(0.3, 0.003)
    expect(follower.push(0.02, 0.003)).toBeCloseTo(0.02, 6)
  })

  it('takes seconds to accept that the room got louder', () => {
    const follower = createNoiseFloorFollower(3)
    follower.push(0.01, 0.003)
    // A second of loud playing barely moves it — that is the point: this
    // measures the room, not the guitar.
    for (let block = 0; block < 333; block += 1) follower.push(0.5, 0.003)
    expect(follower.value()).toBeLessThan(0.2)

    for (let block = 0; block < 3000; block += 1) follower.push(0.5, 0.003)
    expect(follower.value()).toBeGreaterThan(0.45)
  })

  it('starts from what it first hears instead of from silence', () => {
    const follower = createNoiseFloorFollower()
    expect(follower.push(0.08, 0.003)).toBeCloseTo(0.08, 6)
    follower.reset()
    expect(follower.value()).toBe(0)
  })
})
