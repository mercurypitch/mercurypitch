// ============================================================
// Merc glide tests — hum's rings and ride's lean
// ============================================================
//
// The glide rooms (Ng slides, later Lip roll) feed Merc the sung pitch as
// MercVoice.midi. `hum` closes his mouth and sends soft rings from the front
// of his face while the voice sounds; `ride` does the same and leans with
// the pitch's slope. These drive the real Sim at its fixed step.

import { describe, expect, it } from 'vitest'
import type { MercState } from './constants'
import type { MercVoice } from './sim'
import { Sim, STEP } from './sim'
import type { GlideMouth } from './sim-glide'
import { RIDE, rideLean } from './sim-glide'
import { TAU } from './sim-math'

const hum = (midi: number, level = 0.6): MercVoice => ({
  voiced: true,
  cents: 0,
  level,
  steady: 0.9,
  midi,
})
const SILENT: MercVoice = {
  voiced: false,
  cents: 0,
  level: 0,
  steady: 0,
  midi: 57,
}

// The rooms hand a new reading over once a frame: hold each for 1/60 s.
const perFrame =
  (voice: (t: number) => MercVoice) =>
  (t: number): MercVoice =>
    voice(Math.floor(t * 60) / 60)

function simIn(state: MercState, voice: (t: number) => MercVoice): Sim {
  const sim = new Sim(state)
  sim.voiceAt = perFrame(voice)
  return sim
}

/** Steps the sim for `seconds`, returning every step's lean spring. */
function leans(sim: Sim, seconds: number): number[] {
  const out: number[] = []
  for (let i = 0; i < Math.round(seconds / STEP); i++) {
    sim.step(STEP)
    out.push(sim.s.lx.x)
  }
  return out
}

const step = (sim: Sim, seconds: number): void => {
  leans(sim, seconds)
}

const maxAbs = (xs: readonly number[]): number => Math.max(...xs.map(Math.abs))

// A seeded generator, so the noisy voice is the same on every run.
function seeded(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 2 ** 32
  }
}

describe('rideLean', () => {
  it('stays upright through a held note and pitch wobble', () => {
    expect(rideLean(0)).toBe(0)
    expect(rideLean(RIDE.dead)).toBe(0)
    expect(rideLean(-RIDE.dead)).toBe(0)
  })

  it('leans forward up a rise and back down a fall, by the same amount', () => {
    // Act
    const up = rideLean(4)
    const down = rideLean(-4)

    // Assert
    expect(up).toBeGreaterThan(0)
    expect(down).toBe(-up)
  })

  it('grows with the slope and stops at his full lean', () => {
    // Act
    const steps = [1, 2, 3, 4, 5].map((slope) => rideLean(slope))

    // Assert
    for (let i = 1; i < steps.length; i++) {
      expect(steps[i]).toBeGreaterThan(steps[i - 1])
    }
    expect(rideLean(RIDE.full)).toBe(RIDE.lean)
    expect(rideLean(40)).toBe(RIDE.lean)
    expect(rideLean(-400)).toBe(-RIDE.lean)
  })
})

describe('Sim, ride', () => {
  it('reads the slope of a rising glide from the sung pitch', () => {
    // Arrange: up four semitones a second, as a slide up a fifth does.
    const sim = simIn('ride', (t) => hum(57 + 4 * t))

    // Act
    step(sim, 1)

    // Assert
    expect(sim.vs.slope).toBeGreaterThan(3.7)
    expect(sim.vs.slope).toBeLessThan(4.3)
  })

  it('follows a slide as fast as an octave in half a second', () => {
    // Arrange: Lip roll's octave, at its quickest.
    const sim = simIn('ride', (t) => hum(45 + 24 * t))

    // Act
    step(sim, 0.5)

    // Assert: read as a slide, not as a run of jumps.
    expect(sim.vs.slope).toBeGreaterThan(20)
    expect(sim.vs.slope).toBeLessThan(26)
  })

  it('leans forward up a rise and back down a fall', () => {
    // Arrange
    const up = simIn('ride', (t) => hum(57 + 4 * t))
    const down = simIn('ride', (t) => hum(64 - 4 * t))

    // Act
    step(up, 1.2)
    step(down, 1.2)

    // Assert: settled on the lean the slope asks for.
    const want = rideLean(4)
    expect(up.s.lx.x).toBeGreaterThan(0.85 * want)
    expect(up.s.lx.x).toBeLessThan(1.15 * want)
    expect(down.s.lx.x).toBeLessThan(-0.85 * want)
    expect(up.pose().lean[0]).toBe(up.s.lx.x)
  })

  it('stands upright on a flat, held note', () => {
    // Arrange
    const sim = simIn('ride', () => hum(57))

    // Act
    const lx = leans(sim, 2)

    // Assert
    expect(maxAbs(lx)).toBeLessThan(0.002)
  })

  it('does not twitch with tracker noise and vibrato on a held note', () => {
    // Arrange: a quarter-semitone of frame-to-frame noise on a 5.5 Hz,
    // third-of-a-semitone vibrato.
    const rnd = seeded(7)
    const noise = Array.from({ length: 400 }, () => (rnd() - 0.5) * 0.5)
    const sim = simIn('ride', (t) =>
      hum(
        57 +
          0.33 * Math.sin(2 * Math.PI * 5.5 * t) +
          noise[Math.floor(t * 60) % 400],
      ),
    )

    // Act
    const lx = leans(sim, 4)

    // Assert
    expect(maxAbs(lx)).toBeLessThan(0.2 * RIDE.lean)
  })

  it('shrugs off a one-frame octave slip from the tracker', () => {
    // Arrange
    const sim = simIn('ride', (t) => hum(t >= 1 && t < 1 + 1 / 60 ? 69 : 57))

    // Act
    const lx = leans(sim, 2.5)

    // Assert
    expect(maxAbs(lx)).toBeLessThan(0.25 * RIDE.lean)
  })

  it('never leans past his full lean, however steep the slide', () => {
    // Arrange: an octave in a quarter second, again and again.
    const sim = simIn('ride', (t) => hum(57 + 48 * (t % 1)))

    // Act
    const lx = leans(sim, 4)

    // Assert: the spring's overshoot on top of the clamp, no more.
    expect(Math.max(...lx)).toBeLessThan(1.25 * RIDE.lean)
    expect(Math.max(...lx)).toBeGreaterThan(0.9 * RIDE.lean)
  })

  it('comes back upright when the slide tops out on a held note', () => {
    // Arrange
    const sim = simIn('ride', (t) => hum(57 + 7 * Math.min(1, t / 1.5)))
    const climbing = leans(sim, 1.4)

    // Act
    step(sim, 1.6)

    // Assert
    expect(Math.max(...climbing)).toBeGreaterThan(0.5 * RIDE.lean)
    expect(Math.abs(sim.s.lx.x)).toBeLessThan(0.01)
  })

  it('does not lurch when the voice comes back on another note', () => {
    // Arrange: hum A3, breathe, come back on E4.
    const sim = simIn('ride', (t) =>
      t < 0.6 ? hum(57) : t < 1 ? SILENT : hum(64),
    )

    // Act
    const lx = leans(sim, 2)

    // Assert
    expect(maxAbs(lx)).toBeLessThan(0.002)
    expect(Math.abs(sim.vs.slope)).toBeLessThan(0.01)
  })

  it('stands upright and still under reduced motion', () => {
    // Arrange
    const sim = simIn('ride', (t) => hum(57 + 4 * t))
    sim.still = true

    // Act
    const lx = leans(sim, 1.5)

    // Assert
    expect(maxAbs(lx)).toBeLessThan(0.002)
  })
})

describe('Sim, hum', () => {
  it('keeps his mouth closed while he hums', () => {
    // Arrange
    const sim = simIn('hum', () => hum(57, 0.9))

    // Act
    step(sim, 1)

    // Assert
    const p = sim.pose()
    expect(p.mouth[1]).toBeLessThan(0.01)
    expect(p.mouth[2]).toBeLessThan(0.01)
  })

  it('sends rings from the front of his face while the voice sounds', () => {
    // Arrange
    const sim = simIn('hum', () => hum(57))

    // Act
    step(sim, 0.6)

    // Assert: one fan, on the side he faces, beside his face.
    const p = sim.pose()
    expect(p.arcs[2]).toBeGreaterThan(0.3)
    expect(p.arcs[0]).toBeGreaterThan(sim.rootX + 0.3)
    expect(p.arcs[1]).toBeGreaterThan(0.4)
    expect(p.arcs[1]).toBeLessThan(0.75)
    expect(p.arcs2[2]).toBe(0)
  })

  it('draws no rings before the voice and lets them go when it stops', () => {
    // Arrange
    const sim = simIn('hum', (t) => (t >= 0.5 && t < 1.5 ? hum(57) : SILENT))
    step(sim, 0.45)
    const before = sim.pose().arcs[2]
    step(sim, 1)
    const during = sim.pose().arcs[2]

    // Act
    step(sim, 0.6)

    // Assert
    expect(before).toBe(0)
    expect(during).toBeGreaterThan(0.3)
    expect(sim.pose().arcs[2]).toBeLessThan(0.01)
  })

  it('sends bigger, brighter rings, faster, for a louder voice', () => {
    // Arrange
    const soft = simIn('hum', () => hum(57, 0.15))
    const loud = simIn('hum', () => hum(57, 0.9))
    step(soft, 0.5)
    step(loud, 0.5)
    const phase0 = [soft.arcPhase, loud.arcPhase]

    // Act
    step(soft, 1)
    step(loud, 1)

    // Assert
    const [ps, pl] = [soft.pose(), loud.pose()]
    expect(pl.arcs[2]).toBeGreaterThan(ps.arcs[2])
    expect(pl.arcs2[3]).toBeGreaterThan(ps.arcs2[3])
    expect(loud.arcPhase - phase0[1]).toBeGreaterThan(soft.arcPhase - phase0[0])
  })

  it('holds the rings in place and fades them with the voice under reduced motion', () => {
    // Arrange
    const sim = simIn('hum', (t) => (t < 1 ? hum(57) : SILENT))
    sim.still = true
    step(sim, 0.5)
    const p0 = sim.pose()

    // Act
    step(sim, 0.4)
    const p1 = sim.pose()
    step(sim, 0.8)

    // Assert: no travel, no ripple in the resin, just the fade.
    expect(p1.arcs[3]).toBe(p0.arcs[3])
    expect(p1.arcs[2]).toBeGreaterThan(0.3)
    expect(p1.ripple[0]).toBe(0)
    expect(sim.pose().arcs[2]).toBeLessThan(0.01)
  })
})

describe('Sim, with his rings off', () => {
  it('rides with no rings at all, and still leans with the pitch', () => {
    // Arrange: the same rising voice, rings on and rings off.
    const voice = (t: number): MercVoice => hum(57 + 4 * t)
    const ringed = simIn('ride', voice)
    const plain = simIn('ride', voice)
    plain.soundRings = false

    // Act
    const ringedLeans = leans(ringed, 1)
    const plainLeans = leans(plain, 1)

    // Assert: no fan ever, the same lean, the same closed mouth.
    expect(ringed.pose().arcs[2]).toBeGreaterThan(0.3)
    expect(plain.pose().arcs[2]).toBe(0)
    expect(plain.pose().arcs2[2]).toBe(0)
    expect(plainLeans).toEqual(ringedLeans)
    expect(plain.pose().lean[0]).toBeGreaterThan(0.5 * RIDE.lean)
    expect(plain.pose().mouth).toEqual(ringed.pose().mouth)
  })

  it('hums with no rings, and draws none while the voice sounds', () => {
    // Arrange
    const sim = simIn('hum', () => hum(57, 0.9))
    sim.soundRings = false
    let most = 0

    // Act
    for (let i = 0; i < Math.round(1.5 / STEP); i++) {
      sim.step(STEP)
      most = Math.max(most, sim.pose().arcs[2])
    }

    // Assert
    expect(most).toBe(0)
  })
})

describe.each(['hum', 'ride'] as const)(
  "Sim, %s with a lip roll's mouth",
  (state) => {
    const withMouth = (
      mouth: GlideMouth,
      voice: (t: number) => MercVoice = () => hum(57),
    ): Sim => {
      const sim = simIn(state, voice)
      sim.glideMouth = mouth
      return sim
    }

    it('keeps the closed smile and no lips unless the room names another mouth', () => {
      // Arrange
      const sim = simIn(state, () => hum(57))

      // Act
      step(sim, 1)

      // Assert
      expect(sim.glideMouth).toBe('closed')
      expect(sim.pose().mouth[3]).toBe(0)
    })

    it('buzzes his lips together while the voice sounds, the O shut, and smiles again once it stops', () => {
      // Arrange
      const sim = withMouth('buzz', (t) => (t < 1 ? hum(57) : SILENT))
      step(sim, 0.9)
      const during = sim.pose().mouth

      // Act
      step(sim, 0.7)

      // Assert
      expect(during[3]).toBeGreaterThan(0.9)
      expect(during[1]).toBeLessThan(0.01)
      expect(during[2]).toBeLessThan(0.01)
      expect(sim.pose().mouth[3]).toBeLessThan(0.05)
    })

    it('flutters his lips eight times a second, and holds them still under reduced motion', () => {
      // Arrange
      const moving = withMouth('buzz')
      const still = withMouth('buzz')
      still.still = true
      step(moving, 0.5)
      step(still, 0.5)
      const [m0, s0] = [moving.pose().ripple[2], still.pose().ripple[2]]

      // Act
      step(moving, 0.5)
      step(still, 0.5)

      // Assert: the shader ripples them on this phase.
      expect(moving.pose().ripple[2] - m0).toBeCloseTo(TAU * 8 * 0.5, 6)
      expect(still.pose().ripple[2]).toBe(s0)
      expect(still.pose().mouth[3]).toBeGreaterThan(0.9)
    })

    it("opens as Long note's sing does, with the voice's level", () => {
      // Arrange
      const open = withMouth('open')
      const sing = simIn('sing', () => hum(57))

      // Act
      step(open, 1)
      step(sing, 1)

      // Assert
      const [o, g] = [open.pose().mouth, sing.pose().mouth]
      expect(o[1]).toBeGreaterThan(0.5)
      expect(o[1]).toBeCloseTo(g[1], 6)
      expect(o[0]).toBeCloseTo(g[0], 6)
      expect(o[3]).toBe(0)
    })
  },
)

describe("Sim, ride on a lip roll's buzz", () => {
  // A trill's pitch flutters with the lips: a semitone either way, five
  // times a second, on a held note.
  const flutter = (t: number): MercVoice => hum(57 + Math.sin(TAU * 5 * t))
  // Lip roll's narrowest wave at Learning: half an octave up in 2.4 s.
  const smoothstep = (x: number): number => x * x * (3 - 2 * x)
  const narrowRise = (t: number): MercVoice =>
    hum(50 + 6 * smoothstep(Math.min(1, t / 2.4)))
  const buzzing = (voice: (t: number) => MercVoice): Sim => {
    const sim = simIn('ride', voice)
    sim.glideMouth = 'buzz'
    return sim
  }

  it('stands through the flutter of a held note, where a hum would rock him', () => {
    // Arrange
    const buzz = buzzing(flutter)
    const humming = simIn('ride', flutter)
    step(buzz, 1)
    step(humming, 1)

    // Act
    const buzzLean = maxAbs(leans(buzz, 2))
    const humLean = maxAbs(leans(humming, 2))

    // Assert
    expect(buzzLean).toBeLessThan(0.1 * RIDE.lean)
    expect(humLean).toBeGreaterThan(3 * buzzLean)
  })

  it('still leans into the narrowest wave, half an octave in 2.4 s', () => {
    // Arrange
    const sim = buzzing(narrowRise)

    // Act
    const rise = leans(sim, 2.4)

    // Assert: forward, by a good part of his full lean.
    expect(Math.max(...rise)).toBeGreaterThan(0.3 * RIDE.lean)
    expect(Math.min(...rise)).toBeGreaterThan(-0.01)
  })
})

describe('Sim, into and out of hum and ride', () => {
  it('rides while humming: the same face and rings, plus the lean', () => {
    // Arrange
    const voice = (t: number): MercVoice => hum(57 + 4 * t)
    const humming = simIn('hum', voice)
    const riding = simIn('ride', voice)

    // Act
    step(humming, 1)
    step(riding, 1)

    // Assert
    const [h, r] = [humming.pose(), riding.pose()]
    expect(r.mouth).toEqual(h.mouth)
    expect(r.arcs[2]).toBeCloseTo(h.arcs[2], 6)
    expect(Math.abs(h.lean[0])).toBeLessThan(0.03)
    expect(r.lean[0]).toBeGreaterThan(0.5 * RIDE.lean)
  })

  it('closes his mouth going from sing to ride, and opens it going back', () => {
    // Arrange
    const sim = simIn('sing', (t) => hum(57 + 4 * t, 0.8))
    step(sim, 0.8)
    const singing = sim.pose().mouth[1]

    // Act
    sim.setState('ride')
    step(sim, 0.4)
    const riding = sim.pose()
    sim.setState('sing')
    step(sim, 0.4)

    // Assert
    expect(singing).toBeGreaterThan(0.6)
    expect(riding.mouth[1]).toBeLessThan(0.05)
    expect(riding.lean[0]).toBeGreaterThan(0)
    expect(sim.pose().mouth[1]).toBeGreaterThan(0.6)
  })

  it('lets the rings and the lean go when he goes back to idle', () => {
    // Arrange
    const sim = simIn('ride', (t) => hum(57 + 4 * t))
    step(sim, 1)
    sim.setState('hum')
    step(sim, 0.3)
    expect(sim.pose().arcs[2]).toBeGreaterThan(0.3)

    // Act
    sim.setState('idle')
    step(sim, 0.4)
    const rings = sim.pose().arcs[2]
    step(sim, 1.6)

    // Assert
    expect(rings).toBe(0)
    expect(Math.abs(sim.s.lx.x)).toBeLessThan(0.03)
  })
})
