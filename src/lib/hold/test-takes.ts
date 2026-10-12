// ============================================================
// Test takes — sung notes as a pitch tracker reports them, for tests
// ============================================================
//
// A real held note is never a flat line. Each take here is a seeded mix of
// what a voice and a tracker add to one: a vibrato whose rate and depth
// breathe a little, a slow wander (low-passed noise, the voice's own
// unsteadiness), frame-to-frame tracker jitter, a drift across the take,
// and a scoop up to the note at its start. 60 frames a second, as the
// app's pitch stream and the other synthetic tracks (glass/test-frames).

import { FPS, midiToF0 } from '@/lib/glass/test-frames'
import type { PitchFrame } from '@/lib/pitch-f0-stream'

export interface TakeShape {
  seconds: number
  /** A vibrato's rate (Hz) and depth (the sine's amplitude, cents). */
  vibratoHz?: number
  vibratoCents?: number
  /** The slow wander's spread (SD, cents) and how slow it is (s). */
  wanderCents?: number
  wanderSeconds?: number
  /** The tracker's frame-to-frame jitter (SD, cents). */
  jitterCents?: number
  /** Where the pitch has drifted to by the end, cents (linear). */
  driftCents?: number
  /** A scoop up from this many cents below, over `scoopSeconds`. */
  scoopCents?: number
  scoopSeconds?: number
  /** Where the voice sits, cents from the target. */
  offsetCents?: number
  seed?: number
}

/** mulberry32: a small seeded generator, so a take is the same every run. */
function random(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** A standard normal draw (Box-Muller). */
function gaussian(next: () => number): () => number {
  return () =>
    Math.sqrt(-2 * Math.log(1 - next())) * Math.cos(2 * Math.PI * next())
}

/**
 * A first-order low-pass of white noise (an AR(1) process) with the given
 * spread and time constant, one value per frame.
 */
function wander(
  frames: number,
  sd: number,
  seconds: number,
  draw: () => number,
): number[] {
  const a = Math.exp(-1 / (seconds * FPS))
  const kick = sd * Math.sqrt(1 - a * a)
  const out: number[] = []
  let x = sd * draw()
  for (let i = 0; i < frames; i++) {
    x = a * x + kick * draw()
    out.push(x)
  }
  return out
}

/** A take's cents from the target, frame by frame. */
export function takeCents(shape: TakeShape): number[] {
  const frames = Math.round(shape.seconds * FPS)
  const draw = gaussian(random(shape.seed ?? 1))
  const slow = wander(
    frames,
    shape.wanderCents ?? 0,
    shape.wanderSeconds ?? 0.3,
    draw,
  )
  // The vibrato's rate and depth drift a little, as a voice's do.
  const rateWander = wander(frames, 0.25, 1.5, draw)
  const depthWander = wander(frames, 0.12, 1.5, draw)
  const scoop = shape.scoopSeconds ?? 0.5
  let phase = 0
  const out: number[] = []
  for (let i = 0; i < frames; i++) {
    const t = i / FPS
    let cents = (shape.offsetCents ?? 0) + slow[i]
    cents += ((shape.driftCents ?? 0) * t) / shape.seconds
    if (shape.vibratoCents !== undefined && shape.vibratoHz !== undefined) {
      phase += (2 * Math.PI * (shape.vibratoHz + rateWander[i])) / FPS
      cents += shape.vibratoCents * (1 + depthWander[i]) * Math.sin(phase)
    }
    if (shape.scoopCents !== undefined && t < scoop) {
      const left = 1 - t / scoop
      cents -= shape.scoopCents * left * left
    }
    cents += (shape.jitterCents ?? 0) * draw()
    out.push(cents)
  }
  return out
}

/** A take on `targetMidi` as the pitch stream delivers it. */
export function realisticTake(
  targetMidi: number,
  shape: TakeShape,
  startT = 0,
): PitchFrame[] {
  return takeCents(shape).map((cents, i) => ({
    t: startT + i / FPS,
    f0: midiToF0(targetMidi + cents / 100),
    conf: 0.9,
    rms: 0.6,
  }))
}

/**
 * A shake: irregular, with no one rate, as a voice shakes when it tires.
 * A sum of 24 sines at seeded rates between `loHz` and `hiHz`, scaled to a
 * spread of `sdCents` (RMS), with 1.4 cents of tracker grain, frame by
 * frame. The PR 973 review's fast shake is 8-12 Hz.
 */
export function shakeCents(
  seconds: number,
  sdCents: number,
  loHz: number,
  hiHz: number,
  seed = 1,
): number[] {
  const next = random(seed)
  const parts = Array.from({ length: 24 }, () => ({
    hz: loHz + next() * (hiHz - loHz),
    phase: next() * 2 * Math.PI,
  }))
  const amp = sdCents * Math.sqrt(2 / parts.length)
  return Array.from({ length: Math.round(seconds * FPS) }, (_, i) => {
    const t = i / FPS
    let cents = (next() - 0.5) * 4.8
    for (const part of parts) {
      cents += amp * Math.sin(2 * Math.PI * part.hz * t + part.phase)
    }
    return cents
  })
}
