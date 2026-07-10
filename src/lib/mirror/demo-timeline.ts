// ============================================================
// Voice Mirror — onboarding demo timelines.
//
// A timeline is the deterministic "script" of one looping task demo:
// the gold guide path the user should follow, the blue synthetic
// "voice" trail that follows it (from demo-frames, seeded so every
// loop is identical), and named segments (listen/ready/sing/rest)
// that the canvas and captions key off. Pure data — the drawing
// lives in src/features/mirror/TaskDemo.tsx.
// ============================================================

import { glide, hold, matchTake, seeded } from './demo-frames'
import type { F0Frame } from './metrics'
import { hzToCents } from './metrics'

export type DemoKind = 'glide-up' | 'glide-down' | 'hold' | 'match'

export interface DemoSegment {
  kind: 'listen' | 'ready' | 'sing' | 'rest'
  start: number
  end: number
}

export interface DemoTimeline {
  /** Full loop length in seconds, including a short rest beat. */
  durationSec: number
  /** The blue "you" trail; frame times are loop-absolute seconds. */
  voice: F0Frame[]
  /** The gold target path; jitter-free, loop-absolute times. */
  guide: F0Frame[]
  /** Ordered, gap-free segments covering [0, durationSec). */
  segments: DemoSegment[]
  /** Precomputed vertical scale (MIDI-cents) with drawing headroom. */
  centsMin: number
  centsMax: number
}

export interface DemoState {
  /** Time within the loop, [0, durationSec). */
  t: number
  segment: DemoSegment
  /** Number of voice frames sung so far (prefix length into `voice`). */
  voiceIndex: number
  /** The most recent voice frame, or null before the first one. */
  headFrame: F0Frame | null
  /** 0..1 progress through the loop. */
  progress: number
}

// Demos teach the *shape* of each task, not a range, so they sit in a
// fixed neutral register around D3–D4.
const GLIDE_LOW = 50
const GLIDE_HIGH = 62
const HOLD_MIDI = 56
const MATCH_MIDI = 57
/** Trail fade-out beat so the loop restart never pops. */
const REST_SEC = 0.7

/** Zero-jitter rand: (0.5 - 0.5) + (0.5 - 0.5) = 0 noise per frame. */
const smooth = () => 0.5

// Seeds are arbitrary but fixed — one per kind so trails differ slightly.
const SEEDS: Record<DemoKind, number> = {
  'glide-up': 11,
  'glide-down': 23,
  hold: 37,
  match: 53,
}

/** Deterministic per-kind PRNG (fresh instance per build call). */
function randFor(kind: DemoKind): () => number {
  return seeded(SEEDS[kind])
}

function shiftFrames(frames: F0Frame[], offsetSec: number): F0Frame[] {
  return frames.map((f) => ({ ...f, t: f.t + offsetSec }))
}

function centsBounds(
  frames: F0Frame[],
  padCents: number,
): { min: number; max: number } {
  let min = Infinity
  let max = -Infinity
  for (const f of frames) {
    if (f.f0 <= 0) continue
    const c = hzToCents(f.f0)
    if (c < min) min = c
    if (c > max) max = c
  }
  return { min: min - padCents, max: max + padCents }
}

function buildGlide(kind: 'glide-up' | 'glide-down'): DemoTimeline {
  const singSec = 3.8
  const from = kind === 'glide-up' ? GLIDE_LOW : GLIDE_HIGH
  const to = kind === 'glide-up' ? GLIDE_HIGH : GLIDE_LOW
  const voice = glide(from, to, singSec, randFor(kind))
  const guide = glide(from, to, singSec, smooth)
  const durationSec = singSec + REST_SEC
  const { min, max } = centsBounds(guide, 120)
  return {
    durationSec,
    voice,
    guide,
    segments: [
      { kind: 'sing', start: 0, end: singSec },
      { kind: 'rest', start: singSec, end: durationSec },
    ],
    centsMin: min,
    centsMax: max,
  }
}

function buildHold(): DemoTimeline {
  const singSec = 3.3
  const voice = hold(HOLD_MIDI, singSec, randFor('hold'))
  // A perfectly flat guide line: a "glide" from the note to itself.
  const guide = glide(HOLD_MIDI, HOLD_MIDI, singSec, smooth)
  const durationSec = singSec + REST_SEC
  const { min, max } = centsBounds(guide, 260)
  return {
    durationSec,
    voice,
    guide,
    segments: [
      { kind: 'sing', start: 0, end: singSec },
      { kind: 'rest', start: singSec, end: durationSec },
    ],
    centsMin: min,
    centsMax: max,
  }
}

function buildMatch(): DemoTimeline {
  const listenEnd = 1.6
  const readyEnd = 2.4
  // matchTake emits a fixed 2.6 s take that scoops in from 300 c below
  // and lands 8 c off — a clean, encouraging example.
  const take = matchTake(MATCH_MIDI, 8, 0.5, randFor('match'))
  const singSec = take[take.length - 1].t
  const singEnd = readyEnd + singSec
  const durationSec = singEnd + REST_SEC
  const voice = shiftFrames(take, readyEnd)
  const guide = glide(MATCH_MIDI, MATCH_MIDI, durationSec, smooth)
  const { min, max } = centsBounds(voice, 140)
  return {
    durationSec,
    voice,
    guide,
    segments: [
      { kind: 'listen', start: 0, end: listenEnd },
      { kind: 'ready', start: listenEnd, end: readyEnd },
      { kind: 'sing', start: readyEnd, end: singEnd },
      { kind: 'rest', start: singEnd, end: durationSec },
    ],
    centsMin: min,
    centsMax: max,
  }
}

const cache = new Map<DemoKind, DemoTimeline>()

/** Build (or reuse — timelines are immutable) the demo script for a task. */
export function buildDemoTimeline(kind: DemoKind): DemoTimeline {
  const hit = cache.get(kind)
  if (hit) return hit
  const built =
    kind === 'hold'
      ? buildHold()
      : kind === 'match'
        ? buildMatch()
        : buildGlide(kind)
  cache.set(kind, built)
  return built
}

/** Resolve the loop state at wall-clock second `tSec` (wraps forever). */
export function demoStateAt(tl: DemoTimeline, tSec: number): DemoState {
  const d = tl.durationSec
  // Single conditional wrap — a double modulo drifts floats at exact
  // segment boundaries (1.6 % d re-wrapped lands at 1.5999…).
  let t = tSec % d
  if (t < 0) t += d
  const segment =
    tl.segments.find((s) => t >= s.start && t < s.end) ??
    tl.segments[tl.segments.length - 1]
  // Binary search: count of voice frames with frame.t <= t.
  let lo = 0
  let hi = tl.voice.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (tl.voice[mid].t <= t) lo = mid + 1
    else hi = mid
  }
  return {
    t,
    segment,
    voiceIndex: lo,
    headFrame: lo > 0 ? tl.voice[lo - 1] : null,
    progress: t / d,
  }
}
