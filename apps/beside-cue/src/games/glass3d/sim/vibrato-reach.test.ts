// Can a person who is not a singer actually break the glass?
// ============================================================
//
// The verb only works if the ear recognises the wave a real player
// makes. The 2D band was fitted to a trained vibrato and, measured here,
// rejected a first-time waver outright: the bar parked at `holdCap` and
// the game said nothing, which reads as "I am too weak" rather than "I
// am doing the wrong thing". That is the bug this file exists to keep
// fixed.
//
// The singers are synthetic and deterministic, and they are put through
// the same two distortions the real signal survives before the detector
// sees it: the engine's 5-point median (latestSmoothed, f0-frames.ts)
// and Stage3D's habit of polling one f0 frame at the simulation rate.
//
// It cuts both ways. A steady note must NOT read as a wave, or the
// mechanic collapses into "make any noise for long enough".

import { describe, expect, it } from 'vitest'
import { createVibratoDetector } from '@/games/glass/vibrato'
import { WORLD3D_CONFIG } from '../world3d-config'
import { createResonance, stepResonance } from './resonance3d'

/** MEDIAN_WINDOW in packages/pitch-engine/src/f0-frames.ts. */
const MEDIAN_WINDOW = 5
const SIM_HZ = 1 / WORLD3D_CONFIG.loop.stepSeconds

const makeSmoother = (): ((v: number) => number) => {
  const ring: number[] = []
  return (v) => {
    ring.push(v)
    if (ring.length > MEDIAN_WINDOW) ring.shift()
    const sorted = [...ring].sort((a, b) => a - b)
    return sorted[Math.floor(sorted.length / 2)]
  }
}

/** Seeded, so a failure is the same failure tomorrow. */
const rng = (seed: number): (() => number) => {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

interface Voice {
  rateHz: number
  /** Half peak-to-peak, cents. 0 is a steady note. */
  depthCents: number
  /** Per-frame detector noise, cents. SwiftF0 on a sung vowel is a few. */
  jitterCents: number
  /** Frames per second the f0 stream delivers. */
  frameHz: number
}

const VOICE: Voice = {
  rateHz: 5.5,
  depthCents: 40,
  jitterCents: 5,
  frameHz: 60,
}

const record = (v: Voice, seconds: number, seed = 7): number[] => {
  const rand = rng(seed)
  const smooth = makeSmoother()
  const out: number[] = []
  const n = Math.round(seconds * v.frameHz)
  for (let i = 0; i < n; i++) {
    const t = i / v.frameHz
    const gauss = (rand() + rand() + rand() + rand() + rand() + rand() - 3) / 3
    const cents =
      v.depthCents * Math.sin(2 * Math.PI * v.rateHz * t) +
      v.jitterCents * gauss
    out.push(smooth(69 + cents / 100))
  }
  return out
}

/** Sing at the glass for `seconds` and report whether it broke. */
const singAt = (
  v: Voice,
  seconds = 8,
  seed = 7,
): { broke: boolean; res: number } => {
  const frames = record(v, seconds, seed)
  const vib = createVibratoDetector(WORLD3D_CONFIG.vibrato)
  const ring = createResonance(69)
  const dt = WORLD3D_CONFIG.loop.stepSeconds
  const steps = Math.round(seconds * SIM_HZ)
  for (let i = 0; i < steps; i++) {
    const now = i * dt
    const midi =
      frames[Math.min(frames.length - 1, Math.floor(now * v.frameHz))]
    const wave = vib.feed(now * 1000, midi)
    stepResonance(
      ring,
      { midi, vibrato: wave.active, vibratoStrength: wave.strength },
      dt,
      WORLD3D_CONFIG.ring,
    )
  }
  return { broke: ring.res >= 1, res: ring.res }
}

describe('a first-time waver can break the glass', () => {
  // The slow, deliberate wobble of someone told to "let it waver" and
  // trying it for the first time. This is the case that shipped broken.
  it.each([2.5, 3, 4, 5.5, 7, 9])('at %s Hz', (rateHz) => {
    expect(singAt({ ...VOICE, rateHz }).broke).toBe(true)
  })

  // Timid, and enthusiastic. Both are a wave; neither used to count.
  it.each([20, 40, 90, 180])('at +-%s cents', (depthCents) => {
    expect(singAt({ ...VOICE, depthCents }).broke).toBe(true)
  })

  // Past the pitch band the wave stops being the note, and the sim is
  // right to let it decay. Pinned so nobody "fixes" the depth cap by
  // raising it above what tolerance can honour.
  it('swinging wider than the pitch band does not break it', () => {
    const band =
      (WORLD3D_CONFIG.ring.tolSemis + WORLD3D_CONFIG.ring.pumpTolBonus) * 100
    expect(WORLD3D_CONFIG.vibrato.maxDepthCents).toBeCloseTo(band, 6)
    expect(singAt({ ...VOICE, depthCents: band + 60 }).broke).toBe(false)
  })

  // A phone whose f0 stream is not keeping up. iOS reportedly runs slow.
  it.each([60, 45, 24])('with the f0 stream at %s Hz', (frameHz) => {
    expect(singAt({ ...VOICE, frameHz }).broke).toBe(true)
  })
})

describe('a steady note still will not break it', () => {
  // The whole mechanic rests on this: holding stops at holdCap, and no
  // amount of jitter, drift or endurance gets past it.
  it.each([0, 3, 6, 10])('held with %s cents of jitter', (jitterCents) => {
    const { broke, res } = singAt({ ...VOICE, depthCents: 0, jitterCents }, 20)
    expect(broke).toBe(false)
    expect(res).toBeCloseTo(WORLD3D_CONFIG.ring.holdCap, 2)
  })

  // Nor does a wobble far too slow to be a wave -- an unsteady hold.
  it('wobbling below the band is not a wave', () => {
    expect(singAt({ ...VOICE, rateHz: 1.0 }, 20).broke).toBe(false)
  })
})
