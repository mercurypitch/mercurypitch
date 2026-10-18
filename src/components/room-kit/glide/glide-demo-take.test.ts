// ============================================================
// A glide room's demo take: a script sung through the glide engine
// ============================================================

import { describe, expect, it } from 'vitest'
import { VOICE_STEP } from '@/components/demo-kit/demo-voice'
import { midiToFrequency } from '@/lib/frequency-to-note'
import { LIP_ROLL_SEMITONES, lipRollPath } from '@/lib/glide/glide-path'
import { LIP_ROLL_LEVELS } from '@/lib/glide/glide-presets'
import type { GlideDemoScript } from './glide-demo-take'
import { attack, pathCents, singGlideDemo } from './glide-demo-take'

const PRESET = LIP_ROLL_LEVELS.learning
const ROOT = 50
const PLAN = {
  path: lipRollPath([ROOT], LIP_ROLL_SEMITONES, PRESET),
  countIn: 1.5,
}
const WAVE = PLAN.path.arches[0]

/** The arch itself, from its start to its landing. */
const ride: GlideDemoScript = (tau, path) =>
  tau < WAVE.start || tau >= WAVE.landingEnd
    ? null
    : { cents: pathCents(path, tau), onset: WAVE.start }
const silence: GlideDemoScript = () => null

/** Cents of `f0` over the root. */
const centsOver = (f0: number): number =>
  1200 * Math.log2(f0 / midiToFrequency(ROOT))

describe('pathCents and attack', () => {
  it("reads the path's note above its root, an octave at the top", () => {
    expect(pathCents(PLAN.path, WAVE.start)).toBeCloseTo(0, 9)
    expect(pathCents(PLAN.path, (WAVE.topStart + WAVE.topEnd) / 2)).toBeCloseTo(
      1200,
      9,
    )
  })

  it('opens a run 25 cents under its note and lands on it in 80 ms', () => {
    expect(attack(2, 2)).toBe(-25)
    expect(attack(2.04, 2)).toBeCloseTo(-12.5, 9)
    expect(attack(2.08, 2)).toBeCloseTo(0, 9)
    expect(Math.abs(attack(3, 2))).toBe(0)
    expect(attack(1.9, 2)).toBe(-25)
  })
})

describe('singGlideDemo', () => {
  it('sings to the end of the arch, its events on the take clock', () => {
    const sung = singGlideDemo(
      ROOT,
      PLAN,
      ride,
      { seed: 0x11b1, level: 0.7 },
      PRESET,
    )
    const last = sung.frames[sung.frames.length - 1]

    expect(sung.length).toBe(last.t)
    expect(last.t).toBeGreaterThan(PLAN.countIn + WAVE.end)
    const end = sung.events.find((e) => e.type === 'archEnd')
    expect(end?.at).toBeGreaterThan(PLAN.countIn + WAVE.start)
    expect(sung.coverage).toBeGreaterThan(0.9)
  })

  it('hears nothing, and covers nothing, from a silent script', () => {
    const sung = singGlideDemo(
      ROOT,
      PLAN,
      silence,
      { seed: 0x11b0, level: 0.7 },
      PRESET,
    )

    expect(sung.frames.every((f) => f.f0 === 0)).toBe(true)
    expect(sung.coverage).toBe(0)
    expect(sung.voice.every((p) => p.level === 0 && p.cents === 0)).toBe(true)
  })

  it('draws the voice line every VOICE_STEP, at its loudness where it sings', () => {
    const sung = singGlideDemo(
      ROOT,
      PLAN,
      ride,
      { seed: 0x11b1, level: 0.7 },
      PRESET,
    )
    const voiced = sung.voice.filter((p) => p.level > 0)

    expect(sung.voice[1].t).toBeCloseTo(VOICE_STEP, 12)
    expect(sung.voice[sung.voice.length - 1].t).toBeLessThanOrEqual(
      sung.length + 1e-9,
    )
    expect(voiced.every((p) => p.level === 0.7)).toBe(true)
    // The voice line has the wander, no grain.
    for (const point of voiced) {
      const at = ride(point.t - PLAN.countIn, PLAN.path)
      expect(Math.abs(point.cents - (at?.cents ?? 0))).toBeLessThanOrEqual(2.6)
    }
  })

  it("carries a vibrato on the path's clock, and none without one", () => {
    const vibrato = { hz: 5.2, cents: 8, rampSec: 0.4 }
    const plain = singGlideDemo(
      ROOT,
      PLAN,
      ride,
      { seed: 0x4e41, level: 0.7 },
      PRESET,
    )
    const sung = singGlideDemo(
      ROOT,
      PLAN,
      ride,
      { seed: 0x4e41, level: 0.7, vibrato },
      PRESET,
    )

    for (const i of [120, 150, 200, 260]) {
      const tau = sung.frames[i].t - PLAN.countIn
      const grown = Math.min(
        1,
        Math.max(0, (tau - WAVE.start) / vibrato.rampSec),
      )
      const swing =
        vibrato.cents * grown * Math.sin(2 * Math.PI * vibrato.hz * tau)
      expect(
        centsOver(sung.frames[i].f0) - centsOver(plain.frames[i].f0),
      ).toBeCloseTo(swing, 6)
    }
  })

  it('sings the same take for the same seed', () => {
    const a = singGlideDemo(
      ROOT,
      PLAN,
      ride,
      { seed: 0x11b1, level: 0.7 },
      PRESET,
    )
    const b = singGlideDemo(
      ROOT,
      PLAN,
      ride,
      { seed: 0x11b1, level: 0.7 },
      PRESET,
    )

    expect(b).toEqual(a)
  })
})
