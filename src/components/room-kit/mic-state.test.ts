// ============================================================
// The mic's states: its names, and the ring's numbers
// ============================================================

import { describe, expect, it } from 'vitest'
import type { MicState } from './mic-state'
import { micLabel, RING_FLOOR, RING_REST_OPACITY, RING_STEP_AT, ringLevel, ringLook, smoothLevel, } from './mic-state'

/** The ring's level after `ms` of one target, a frame every 16 ms. */
function after(from: number, target: number, ms: number): number {
  let level = from
  for (let t = 0; t < ms; t += 16) level = smoothLevel(level, target, 16)
  return level
}

describe('the mic names its state', () => {
  it('gives each state its own name, and ready the room start line', () => {
    const states: MicState[] = ['ready', 'wait', 'sing', 'done']

    const names = states.map((state) => micLabel(state, 'Start: hold A3'))

    expect(names[0]).toBe('Start: hold A3')
    expect(new Set(names).size).toBe(4)
  })

  it('tells a screen reader the turn is not the singer yet while it waits', () => {
    expect(micLabel('wait', 'Start')).toMatch(/^Wait for your turn/u)
    expect(micLabel('sing', 'Start')).toMatch(/^Listening/u)
  })
})

describe('the ring follows a voice', () => {
  it('rises to a voice faster than it falls back to silence', () => {
    const risen = after(0, 1, 96)
    const fallen = after(1, 0, 96)

    expect(risen).toBeGreaterThan(0.85)
    expect(fallen).toBeGreaterThan(0.6)
  })

  it('settles back to rest within a second of silence', () => {
    expect(after(1, 0, 1000)).toBeLessThan(0.05)
  })

  it('holds still when the level holds still', () => {
    expect(smoothLevel(0.4, 0.4, 16)).toBe(0.4)
    expect(smoothLevel(0.4, 1, 0)).toBe(0.4)
  })

  it('reads the room under -45 dBFS as silence and a full voice as full', () => {
    expect(ringLevel(0)).toBe(0)
    // The hum of a room at -50 to -45 dBFS: silence, not a little below it.
    expect(ringLevel(RING_FLOOR / 2)).toBe(0)
    expect(ringLevel(RING_FLOOR)).toBe(0)
    expect(ringLevel(Number.NaN)).toBe(0)
    expect(ringLevel(1)).toBe(1)
    expect(ringLevel(0.5)).toBeGreaterThan(ringLevel(0.3))
  })
})

describe('the ring as drawn', () => {
  it('grows and brightens with the voice', () => {
    const rest = ringLook(0, false)
    const full = ringLook(1, false)

    expect(rest).toEqual({ scale: 1, opacity: RING_REST_OPACITY })
    expect(full.scale).toBeGreaterThan(1.2)
    expect(full.opacity).toBeCloseTo(1, 6)
  })

  it('keeps its size with reduced motion and brightens in steps', () => {
    const levels = Array.from({ length: 101 }, (_, i) => i / 100)

    const looks = levels.map((level) => ringLook(level, true))

    expect(looks.every((look) => look.scale === 1)).toBe(true)
    const opacities = new Set(looks.map((look) => look.opacity))
    expect(opacities.size).toBe(RING_STEP_AT.length + 1)
    expect(ringLook(RING_STEP_AT[0], true).opacity).toBeGreaterThan(
      RING_REST_OPACITY,
    )
  })
})
