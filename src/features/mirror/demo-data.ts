// ============================================================
// Voice Mirror — dev-only synthetic results (no mic required).
//
// Generates realistic F0 frame streams (glides, hold, matches) and
// runs them through the SAME pure metrics as a real session, so the
// results screen — card, chips, reveal — can be rendered and
// screenshotted deterministically. Reached via /mirror?demo=<profile>
// and only ever imported behind an `import.meta.env.DEV` guard, so it
// is tree-shaken out of the production bundle.
// ============================================================

import { midiToFrequency } from '@/lib/frequency-to-note'
import type { F0Frame, MirrorResult } from '@/lib/mirror/metrics'
import { computeMirrorResult } from '@/lib/mirror/metrics'

const HOP = 0.016 // ~60 fps, matching the real rAF stream

/** A deterministic PRNG so every screenshot of a profile is identical. */
function seeded(seed: number): () => number {
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
function glide(
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
function hold(midi: number, durSec: number, rand: () => number): F0Frame[] {
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
function matchTake(
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

export interface DemoProfile {
  lowMidi: number
  highMidi: number
  /** Held note for the steadiness task. */
  holdMidi: number
}

// One profile per voice type AND one per legend, ranges chosen so
// voiceTypeHint() lands on the intended type and the range seed
// (lowMidi*3 + highMidi, mod the type's legend count — see singer-match.ts)
// picks that exact legend. `/mirror#<key>` (dev) jumps straight to the
// revealed result — handy for eyeballing every caricature end-to-end.
export const DEMO_PROFILES: Record<string, DemoProfile> = {
  // Voice-type keys.
  bass: { lowMidi: 40, highMidi: 60, holdMidi: 48 }, // Johnny Cash
  baritone: { lowMidi: 41, highMidi: 73, holdMidi: 57 }, // Elvis (matches spec shot)
  tenor: { lowMidi: 48, highMidi: 74, holdMidi: 60 }, // Freddie Mercury
  alto: { lowMidi: 53, highMidi: 79, holdMidi: 65 }, // Amy Winehouse
  mezzo: { lowMidi: 57, highMidi: 83, holdMidi: 69 }, // Adele
  soprano: { lowMidi: 60, highMidi: 86, holdMidi: 72 }, // Mariah Carey
  // Legend keys (seed mod walks each type's options).
  cash: { lowMidi: 40, highMidi: 60, holdMidi: 48 }, // 180 % 2 = 0
  barry: { lowMidi: 40, highMidi: 61, holdMidi: 50 }, // 181 % 2 = 1
  elvis: { lowMidi: 41, highMidi: 73, holdMidi: 57 }, // 196 % 4 = 0
  sinatra: { lowMidi: 42, highMidi: 71, holdMidi: 56 }, // 197 % 4 = 1
  kurt: { lowMidi: 42, highMidi: 72, holdMidi: 55 }, // 198 % 4 = 2
  bowie: { lowMidi: 42, highMidi: 73, holdMidi: 57 }, // 199 % 4 = 3
  freddie: { lowMidi: 48, highMidi: 74, holdMidi: 60 }, // 218 % 2 = 0
  bruce: { lowMidi: 48, highMidi: 75, holdMidi: 61 }, // 219 % 2 = 1
  amy: { lowMidi: 53, highMidi: 79, holdMidi: 65 }, // 238 % 2 = 0
  cher: { lowMidi: 53, highMidi: 80, holdMidi: 66 }, // 239 % 2 = 1
  adele: { lowMidi: 57, highMidi: 83, holdMidi: 69 }, // 254 % 2 = 0
  whitney: { lowMidi: 57, highMidi: 84, holdMidi: 70 }, // 255 % 2 = 1
  mariah: { lowMidi: 60, highMidi: 86, holdMidi: 72 }, // 266 % 2 = 0
  celine: { lowMidi: 60, highMidi: 87, holdMidi: 73 }, // 267 % 2 = 1
}

/** Build a full MirrorResult + raw glides from a profile, via the real metrics. */
export function buildDemoResult(profile: DemoProfile): {
  result: MirrorResult
  glides: F0Frame[][]
} {
  const rand = seeded(profile.lowMidi * 131 + profile.highMidi)
  const glides = [
    glide(profile.lowMidi, profile.highMidi, 8, rand),
    glide(profile.highMidi, profile.lowMidi, 8, rand),
  ]
  const holdFrames = hold(profile.holdMidi, 6, rand)

  // Five match targets across the comfortable middle, with a mix of outcomes
  // (two clean, three scooped/off) so Accuracy reads like a real ~50 baseline.
  const span = profile.highMidi - profile.lowMidi
  const targets = [0.3, 0.45, 0.55, 0.65, 0.5].map((p, i) =>
    Math.round(profile.lowMidi + span * (0.25 + 0.5 * ((i + p) % 1))),
  )
  const outcomes: Array<{ err: number; scoop: number }> = [
    { err: 8, scoop: 0.18 },
    { err: 55, scoop: 0.9 },
    { err: 10, scoop: 0.25 },
    { err: 90, scoop: 1.3 },
    { err: 40, scoop: 0.6 },
  ]
  const matches = targets.map((targetMidi, i) => ({
    targetMidi,
    frames: matchTake(targetMidi, outcomes[i].err, outcomes[i].scoop, rand),
  }))

  return {
    result: computeMirrorResult({ glides, hold: holdFrames, matches }),
    glides,
  }
}
