import { describe, expect, it } from 'vitest'
import type { EmitOptions, Landing } from './note-rain'
import { createNoteRain, emitNote, flightTime, GRAVITY, MAX_NOTES, stepNoteRain, } from './note-rain'

/** A fixed sequence, so every flight is the same on every run. */
function seeded(seed = 7): () => number {
  let state = seed
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 4294967296
  }
}

/** A throw from the middle of a 300 px stage, onto a key at 260. */
const throwAt = (overrides: Partial<EmitOptions>): EmitOptions => ({
  x: 100,
  y: 110,
  targetX: 100,
  floorY: 260,
  ceilingY: 0,
  midi: 60,
  level: 0.8,
  label: null,
  random: seeded(),
  ...overrides,
})

describe('flightTime', () => {
  it('is the time a throw takes to come back down to the floor', () => {
    const y = 120
    const lift = 400
    const floor = 260
    const t = flightTime(y, lift, floor)
    expect(y - lift * t + 0.5 * GRAVITY * t * t).toBeCloseTo(floor, 6)
  })
})

describe('note rain', () => {
  it('lands every note on the key it was thrown at', () => {
    const random = seeded()
    const rain = createNoteRain()
    const targets = [80, 240, 410]
    for (const targetX of targets) {
      emitNote(rain, throwAt({ x: targetX + 15, targetX, random }))
    }
    const landings: Landing[] = []
    for (let i = 0; i < 400 && rain.notes.length > 0; i++) {
      landings.push(...stepNoteRain(rain, 1 / 240, 260, random))
    }
    expect(rain.notes).toHaveLength(0)
    const landed = landings.map((l) => l.x).sort((a, b) => a - b)
    landed.forEach((x, i) => {
      expect(Math.abs(x - targets[i])).toBeLessThan(4)
    })
  })

  it('never throws a glyph past the top of the stage', () => {
    const random = seeded(5)
    const rain = createNoteRain()
    // A loud voice from a ribbon near the top: the throw it would like to
    // make carries well past the edge.
    emitNote(rain, throwAt({ y: 60, ceilingY: 0, level: 1, random }))
    const size = rain.notes[0].size
    let highest = Infinity
    for (let i = 0; i < 2000 && rain.notes.length > 0; i++) {
      highest = Math.min(highest, rain.notes[0].y)
      stepNoteRain(rain, 1 / 480, 260, random)
    }
    expect(highest).toBeGreaterThanOrEqual(size * 0.6 - 1)
    expect(highest).toBeLessThan(60)
  })

  it('splashes into sparks that fade away', () => {
    const random = seeded(3)
    const rain = createNoteRain()
    emitNote(
      rain,
      throwAt({ y: 200, floorY: 210, midi: 64, level: 0, label: 'E4', random }),
    )
    let landed: Landing[] = []
    for (let i = 0; i < 200 && landed.length === 0; i++) {
      landed = stepNoteRain(rain, 1 / 120, 210, random)
    }
    expect(landed).toEqual([{ midi: 64, x: expect.any(Number) }])
    expect(rain.sparks.length).toBeGreaterThan(0)
    for (let i = 0; i < 120; i++) stepNoteRain(rain, 1 / 60, 210, random)
    expect(rain.sparks).toHaveLength(0)
  })

  it('keeps only the newest notes when a long hold throws too many', () => {
    const random = seeded(11)
    const rain = createNoteRain()
    for (let i = 0; i < MAX_NOTES + 15; i++) {
      emitNote(
        rain,
        throwAt({
          x: 50,
          y: 100,
          targetX: 50,
          floorY: 300,
          midi: 48 + (i % 12),
          level: 0.5,
          random,
        }),
      )
    }
    expect(rain.notes).toHaveLength(MAX_NOTES)
    expect(rain.notes[rain.notes.length - 1].midi).toBe(
      48 + ((MAX_NOTES + 14) % 12),
    )
  })
})
