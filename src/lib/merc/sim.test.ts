// ============================================================
// Merc sim tests — determinism and stability of every state
// ============================================================

import { describe, expect, it } from 'vitest'
import type { MercState } from './constants'
import { STATES } from './constants'
import type { MercPose, MercVoice } from './sim'
import { Sim, STEP } from './sim'

const SINGING: MercVoice = {
  voiced: true,
  cents: 120,
  level: 0.6,
  steady: 0.8,
  midi: 57,
}
const IN_TUNE: MercVoice = {
  voiced: true,
  cents: 8,
  level: 0.55,
  steady: 0.9,
  midi: 57,
}

// Sings for 1.5 s, rests for 0.5 s, sweeping from below the note to a fifth
// above it, so every state meets glides, silence and steady holds.
const sweep = (t: number): MercVoice => ({
  voiced: t % 2 < 1.5,
  cents: -300 + 800 * Math.sin(t * 1.3) ** 2,
  level: 0.3 + 0.5 * Math.abs(Math.sin(t * 2.1)),
  steady: 0.5 + 0.5 * Math.cos(t * 0.7),
  midi: 57,
})

function simAt(
  state: MercState,
  seconds: number,
  voice?: (t: number) => MercVoice,
): Sim {
  const sim = new Sim(state)
  sim.voiceAt = voice ?? null
  const steps = Math.round(seconds / STEP)
  for (let i = 0; i < steps; i++) sim.step(STEP)
  return sim
}

function numbersIn(pose: MercPose): number[] {
  return Object.values(pose).flat(2) as number[]
}

describe('Sim', () => {
  it('replays every state to the same pose, to the last bit', () => {
    for (const state of STATES) {
      // Arrange
      const a = simAt(state, 2.5, sweep)
      const b = simAt(state, 2.5, sweep)

      // Act
      const pa = a.pose()
      const pb = b.pose()

      // Assert
      expect(pb, state).toEqual(pa)
    }
  })

  it('keeps every pose value finite and in frame through 20 s of each state', () => {
    for (const state of STATES) {
      // Arrange
      const sim = new Sim(state)
      sim.voiceAt = sweep
      const bad: string[] = []

      // Act
      for (let i = 1; i <= 20 * 240; i++) {
        sim.step(STEP)
        if (i % 60 !== 0) continue
        const p = sim.pose()
        if (!numbersIn(p).every(Number.isFinite)) bad.push(`non-finite at ${i}`)
        // The raw spring: pose() clamps its copy at 0.3.
        const sq = sim.s.sq.x
        if (sq < 0.3 || sq > 1.6) bad.push(`squash ${sq}`)
        // Sing's lift spring undershoots the floor by about a millimetre when
        // a high note ends (the study does the same); a centimetre is a fault.
        if (Math.abs(p.root[0]) > 0.6 || p.root[1] < -0.01 || p.root[1] > 2) {
          bad.push(`root ${p.root.join(', ')}`)
        }
      }

      // Assert
      expect(bad, state).toEqual([])
    }
  })

  it('lands the drop on the floor and settles back to its rest shape', () => {
    // Arrange
    const sim = new Sim('drop')
    const rootYs: number[] = []

    // Act
    for (let i = 1; i <= 3 * 240; i++) {
      sim.step(STEP)
      if (sim.t > 0.56) rootYs.push(sim.rootY)
    }

    // Assert
    expect(Math.max(...rootYs.map(Math.abs))).toBe(0)
    expect(Math.abs(sim.pose().shape[0] - 1)).toBeLessThan(0.06)
  })

  it('sinks into sleep with both eyes shut', () => {
    // Arrange
    const sim = simAt('sleep', 4)

    // Act
    const p = sim.pose()

    // Assert
    expect(p.shape[0]).toBeGreaterThan(0.62)
    expect(p.shape[0]).toBeLessThan(0.7)
    expect(p.eyeA[0]).toBeLessThan(0.05)
    expect(p.eyeB[2]).toBeGreaterThan(0.95)
  })

  it('locks on a steady in-tune voice and closes his eyes into happy arcs', () => {
    // Arrange
    const sim = simAt('lock', 1.5, () => IN_TUNE)

    // Act
    const p = sim.pose()

    // Assert
    expect(sim.lock.on).toBe(true)
    expect(p.eyeB[0]).toBeGreaterThan(0.9)
    expect(p.color[2]).toBeGreaterThan(0.3)
  })

  it('does not lock on a voice sung a semitone sharp', () => {
    // Arrange
    const sim = simAt('lock', 1.5, () => ({ ...IN_TUNE, cents: 100 }))

    // Act
    const p = sim.pose()

    // Assert
    expect(sim.lock.on).toBe(false)
    expect(p.color[2]).toBe(0)
  })

  it('opens his mouth while singing and closes it when the voice stops', () => {
    // Arrange
    const sim = simAt('sing', 1, () => SINGING)
    const singing = sim.pose().mouth[1]

    // Act
    sim.voiceAt = null
    for (let i = 0; i < 240; i++) sim.step(STEP)

    // Assert
    expect(singing).toBeGreaterThan(0.6)
    expect(sim.pose().mouth[1]).toBeLessThan(0.05)
  })

  it('replays the same frames after restoring a snapshot', () => {
    // Arrange
    const sim = simAt('idle', 1)
    sim.voiceAt = sweep
    sim.setState('celebrate')
    const snap = sim.snapshot()
    for (let i = 0; i < 168; i++) sim.step(STEP)
    const first = sim.pose()

    // Act
    sim.restore(snap)
    for (let i = 0; i < 168; i++) sim.step(STEP)
    const replay = sim.pose()
    sim.restore(snap)

    // Assert
    expect(replay).toEqual(first)
    expect(sim.t).toBe(snap.t)
  })
})
