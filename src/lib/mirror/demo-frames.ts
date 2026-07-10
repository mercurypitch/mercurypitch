// ============================================================
// Voice Mirror — synthetic F0 frame generators.
//
// Produces realistic pitch-frame streams (glides, held notes, match
// takes) without a microphone. Shared by the dev-only demo results
// (src/features/mirror/demo-data.ts) and the production onboarding
// demo animations, so it must stay dependency-light and pure.
// ============================================================

import { midiToFrequency } from '@/lib/frequency-to-note'
import type { F0Frame } from './metrics'

export const HOP = 0.016 // ~60 fps, matching the real rAF stream

/** A deterministic PRNG so every render of a demo is identical. */
export function seeded(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 2 ** 32
  }
}

interface FrameOpts {
  /** Cents of gaussian-ish jitter added per frame. */
  jitterCents?: number
  conf?: number
  rand: () => number
}

function frameAt(t: number, midi: number, opts: FrameOpts): F0Frame {
  const jitter = opts.jitterCents ?? 8
  const noise = (opts.rand() - 0.5 + (opts.rand() - 0.5)) * jitter
  return {
    t,
    f0: midiToFrequency(midi + noise / 100),
    conf: opts.conf ?? 0.85,
  }
}

/** A siren glide sweeping low→high (or high→low), lingering at the extremes. */
export function glide(
  fromMidi: number,
  toMidi: number,
  durSec: number,
  rand: () => number,
): F0Frame[] {
  const frames: F0Frame[] = []
  const n = Math.round(durSec / HOP)
  for (let i = 0; i < n; i++) {
    const p = i / (n - 1)
    // Ease in/out so the voice dwells slightly longer at the turning points,
    // which is how a real siren behaves — and guarantees the extreme
    // semitones clear the 150 ms dwell gate.
    const eased = p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2
    frames.push(
      frameAt(i * HOP, fromMidi + (toMidi - fromMidi) * eased, { rand }),
    )
  }
  return frames
}

/** A held note with a little drift and a gentle 5.5 Hz vibrato. */
export function hold(
  midi: number,
  durSec: number,
  rand: () => number,
): F0Frame[] {
  const frames: F0Frame[] = []
  const n = Math.round(durSec / HOP)
  for (let i = 0; i < n; i++) {
    const t = i * HOP
    const drift = -4 * t // ~4 cents/sec flat
    const vibrato = 22 * Math.sin(2 * Math.PI * 5.5 * t)
    frames.push(
      frameAt(t, midi + (drift + vibrato) / 100, { rand, jitterCents: 10 }),
    )
  }
  return frames
}

/** A match take that lands `errorCents` from `targetMidi` after a scoop. */
export function matchTake(
  targetMidi: number,
  errorCents: number,
  scoopSec: number,
  rand: () => number,
): F0Frame[] {
  const frames: F0Frame[] = []
  const durSec = 2.6
  const n = Math.round(durSec / HOP)
  for (let i = 0; i < n; i++) {
    const t = i * HOP
    // Scoop up from ~3 semitones below into the target, then settle on the
    // (slightly off) landing pitch.
    const scoopProgress = Math.min(1, t / scoopSec)
    const startOffset = -300
    const landing = errorCents
    const cents = startOffset + (landing - startOffset) * scoopProgress
    frames.push(frameAt(t, targetMidi + cents / 100, { rand, jitterCents: 9 }))
  }
  return frames
}
