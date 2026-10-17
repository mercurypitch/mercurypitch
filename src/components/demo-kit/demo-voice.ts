// ============================================================
// The demo's voice: Merc's takes as the room's pitch tracker hears them
// ============================================================
//
// Each room's demo script (Echo's, Long note's, Lip roll's and Ng slides'
// demo-script.ts) says what Merc sings in each take. This is how every
// room hears it: frames at the tracker's rate, carrying what a voice has
// and a sine does not (a slow seeded wander, the room's vibrato, the
// tracker's own grain), and the voice line the demo's sound sings
// (demo-sound.ts), which has the wander but not the grain.
//
// Pure and seeded: a seed always gives the same wander and the same grain.
// The grain is a sequence, drawn once per voiced frame, in order.

import { midiToFrequency } from '@/lib/frequency-to-note'
import { seeded } from '@/lib/mirror/demo-frames'
import type { PitchFrame } from '@/lib/pitch-f0-stream'

/** The tracker's frames: one every 1/60 s. */
export const FRAME_SECONDS = 1 / 60
/** The voice line's step, s. */
export const VOICE_STEP = 0.025
/** How sure the tracker is of Merc's voice. */
const CONF = 0.92
/** A frame with no voice in it is this loud. */
const SILENT_RMS = 0.001
/** Pitch-tracker grain on the frames, cents (not in the synth). */
const JITTER_CENTS = 1.2

/** A voice's vibrato: the frames carry it, and the synth (demo-sound.ts). */
export interface DemoVibrato {
  readonly hz: number
  /** Half the swing: the pitch moves this far either side. */
  readonly cents: number
  /** Seconds after each onset for the vibrato to grow in. */
  readonly rampSec: number
}

/** A slow, seeded wander of a few cents: a voice is never a sine. */
export function wanderFor(seed: number): (t: number) => number {
  const rand = seeded(seed)
  const parts = [1.3, 0.8, 0.5].map((amp) => ({
    amp,
    hz: 0.25 + rand() * 0.55,
    phase: rand() * Math.PI * 2,
  }))
  return (t) =>
    parts.reduce(
      (sum, p) => sum + p.amp * Math.sin(2 * Math.PI * p.hz * t + p.phase),
      0,
    )
}

/** The vibrato's swing at time t of a run that began at `onset`. */
export function vibratoCents(
  vibrato: DemoVibrato,
  t: number,
  onset: number,
): number {
  const grown = Math.min(1, Math.max(0, (t - onset) / vibrato.rampSec))
  return vibrato.cents * grown * Math.sin(2 * Math.PI * vibrato.hz * t)
}

/** Merc's 0..1 loudness as an RMS level (the inverse of levelFromRms). */
export function rmsForLevel(level: number): number {
  return Math.pow(10, (level * 40 - 50) / 20)
}

/**
 * The tracker's grain on a take's frames, cents: seeded apart from the
 * take's wander, and drawn once per voiced frame, in order.
 */
export function grainFor(seed: number): () => number {
  const grain = seeded(seed + 7)
  return () => (grain() - 0.5 + (grain() - 0.5)) * JITTER_CENTS
}

/** A frame of Merc's voice: `cents` off `note`, at loudness `level`. */
export function voicedFrame(
  t: number,
  note: number,
  cents: number,
  level: number,
): PitchFrame {
  return {
    t,
    f0: midiToFrequency(note + cents / 100),
    conf: CONF,
    rms: rmsForLevel(level),
  }
}

/** A frame with no voice in it. */
export function silentFrame(t: number): PitchFrame {
  return { t, f0: 0, conf: 0, rms: SILENT_RMS }
}
