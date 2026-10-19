// ============================================================
// Merc reach tests — climbing with the voice's height
// ============================================================
//
// The onboarding's range feeds Merc the sung pitch's height in the
// singer's range as MercVoice.cents from its middle (REACH_CENTS at either
// end). `reach` squashes him at the foot, stretches him at the top and
// leans his gradient teal low and violet high (S7b §3.3). These drive the
// real Sim at its fixed step.

import { describe, expect, it } from 'vitest'
import { REACH_CENTS } from './constants'
import type { MercVoice } from './sim'
import { Sim, STEP } from './sim'

const at = (height: number, level = 0.6): MercVoice => ({
  voiced: true,
  cents: height * REACH_CENTS,
  level,
  steady: 0.9,
  midi: 57,
})
const SILENT: MercVoice = {
  voiced: false,
  cents: 0,
  level: 0,
  steady: 0,
  midi: 57,
}

function simAt(voice: (t: number) => MercVoice, still = false): Sim {
  const sim = new Sim('reach')
  sim.still = still
  sim.voiceAt = voice
  return sim
}

/** Steps the sim for `seconds`; his squash and hue, averaged over the last half. */
function settle(sim: Sim, seconds: number): { sq: number; hue: number } {
  const steps = Math.round(seconds / STEP)
  let sq = 0
  let hue = 0
  let n = 0
  for (let i = 0; i < steps; i++) {
    sim.step(STEP)
    if (i >= steps / 2) {
      sq += sim.s.sq.x
      hue += sim.s.hue.x
      n += 1
    }
  }
  return { sq: sq / n, hue: hue / n }
}

describe('Sim, reach', () => {
  it('stretches him tall and leans him violet at the top of the range', () => {
    // Arrange
    const sim = simAt(() => at(1))

    // Act
    const top = settle(sim, 1.5)

    // Assert
    expect(top.sq).toBeGreaterThan(1.12)
    expect(top.hue).toBeGreaterThan(0.85)
  })

  it('squashes him low and leans him teal at the foot of the range', () => {
    // Arrange
    const sim = simAt(() => at(-1))

    // Act
    const foot = settle(sim, 1.5)

    // Assert
    expect(foot.sq).toBeLessThan(0.88)
    expect(foot.hue).toBeLessThan(-0.85)
  })

  it('stands his own height, in his own colour, in the middle of it', () => {
    // Arrange
    const sim = simAt(() => at(0))

    // Act
    const middle = settle(sim, 1.5)

    // Assert
    expect(Math.abs(middle.sq - 1)).toBeLessThan(0.03)
    expect(Math.abs(middle.hue)).toBeLessThan(0.05)
  })

  it('follows the voice up a slide, taller with every step of it', () => {
    // Arrange: up the range over three seconds, a third at a time.
    const sim = simAt((t) => at(Math.min(1, -1 + Math.floor(t) * (2 / 3))))

    // Act
    const steps = [settle(sim, 1), settle(sim, 1), settle(sim, 1)]

    // Assert
    expect(steps[1].sq).toBeGreaterThan(steps[0].sq + 0.05)
    expect(steps[2].sq).toBeGreaterThan(steps[1].sq + 0.05)
    expect(steps[2].hue).toBeGreaterThan(steps[0].hue)
  })

  it('settles back to his own height and colour once the voice stops', () => {
    // Arrange: a second at the top, then silence.
    const sim = simAt((t) => (t < 1 ? at(1) : SILENT))
    settle(sim, 1)

    // Act
    const after = settle(sim, 2)

    // Assert
    expect(Math.abs(after.sq - 1)).toBeLessThan(0.03)
    expect(Math.abs(after.hue)).toBeLessThan(0.05)
  })

  it('keeps his height under reduced motion, and only his colour follows', () => {
    // Arrange
    const top = simAt(() => at(1), true)
    const foot = simAt(() => at(-1), true)

    // Act
    const high = settle(top, 1.5)
    const low = settle(foot, 1.5)

    // Assert
    expect(Math.abs(high.sq - 1)).toBeLessThan(0.03)
    expect(Math.abs(low.sq - 1)).toBeLessThan(0.03)
    expect(high.hue).toBeGreaterThan(0.85)
    expect(low.hue).toBeLessThan(-0.85)
  })
})
