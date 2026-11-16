// ============================================================
// Sing It in Time's test takes: a voice singing written notes when told
// ============================================================
//
// The drill's tests sing synthetic takes into the judge and the run, as the
// lessons' tests do for their reader (kit/read-in-time.test.ts): each sung
// note a stretch of voiced frames, a frame a sixtieth of a second, as the
// base exercise's frame loop records them. Silence is no frames at all, as
// the base keeps none. A seeded generator stands in for Math.random.

import type { F0Frame } from '@/lib/mirror/metrics'

/** A repeatable stand-in for Math.random (mulberry32). */
export function seeded(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** One stretch of voice: a MIDI note, from and to on the frames' clock, so many cents off. */
export interface Sung {
  readonly midi: number
  readonly from: number
  readonly to: number
  readonly cents?: number
}

/** A frame's hop: the base's frame loop, at 60 a second. */
export const HOP = 1 / 60

const hz = (s: Sung): number =>
  440 * 2 ** ((s.midi + (s.cents ?? 0) / 100 - 69) / 12)

/** The frames of `sung`, in time order, every hop from each stretch's start to its end. */
export function framesOf(sung: readonly Sung[]): F0Frame[] {
  const frames: F0Frame[] = []
  for (const s of sung) {
    const f0 = hz(s)
    for (let t = s.from; t < s.to - 1e-9; t += HOP)
      frames.push({ t: Math.round(t * 1e6) / 1e6, f0, conf: 0.9 })
  }
  return frames.sort((a, b) => a.t - b.t)
}

/**
 * A slower page's take: it looks every `hop` from `from` to `to`, and each
 * look in a sung stretch is a frame of voice; the rest are the looks that
 * heard none, as the drill's controller notes them.
 */
export function pageOf(
  sung: readonly Sung[],
  o: { readonly from: number; readonly to: number; readonly hop: number },
): { frames: F0Frame[]; silent: number[] } {
  const frames: F0Frame[] = []
  const silent: number[] = []
  for (let k = 0; o.from + k * o.hop < o.to; k++) {
    const t = Math.round((o.from + k * o.hop) * 1e6) / 1e6
    const s = sung.find((x) => t >= x.from - 1e-9 && t < x.to - 1e-9)
    if (s === undefined) silent.push(t)
    else frames.push({ t, f0: hz(s), conf: 0.9 })
  }
  return { frames, silent }
}

/** A written note, as the judge reads it: its MIDI note, first beat and length in beats. */
export interface Written {
  readonly midi: number
  readonly beat: number
  readonly beats: number
}

/**
 * Each written note sung on its beats at `bpm` from `bar1`, moved by
 * `late` seconds, each held to just before the next note starts, as a
 * legato singer holds them.
 */
export function singAll(
  notes: readonly Written[],
  o: { readonly bpm: number; readonly bar1: number; readonly late?: number },
): Sung[] {
  const spb = 60 / o.bpm
  return notes.map((n) => ({
    midi: n.midi,
    from: o.bar1 + (o.late ?? 0) + n.beat * spb,
    to: o.bar1 + (o.late ?? 0) + (n.beat + n.beats) * spb - 0.02,
  }))
}
