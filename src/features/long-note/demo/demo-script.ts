// ============================================================
// The Long note demo's script — Merc's two takes, frame by frame
// ============================================================
//
// "How it works" for Long note: Merc sings the note twice through the
// room's own engine. Take 1 drifts sharp and stops for a breath (not like
// this); take 2 holds the line until the lantern is full (like this).
//
// Pure and seeded: the same note always gives the same frames, events and
// timings. The room plays these frames through its hold engine
// (useLongNoteController's scripted take), so every tooltip is cued by an
// engine event that really fired, and the tests replay the same frames
// through tickHold to prove what each tooltip says.
//
// Two clocks. A take's frames are dated on the ENGINE clock, the one
// tickHold runs on (frame.t). The screen and the sound run on the WALL
// clock. They agree except in take 2's fast-forward, where four engine
// seconds pass in each wall second; the voice keeps sounding at its own
// speed through it.

import { midiToFrequency } from '@/lib/frequency-to-note'
import type { HoldEventType } from '@/lib/hold/hold-engine'
import { createHoldState, HOLD_PRESETS, holdTickFromFrame, tickHold, } from '@/lib/hold/hold-engine'
import { seeded } from '@/lib/mirror/demo-frames'
import type { PitchFrame } from '@/lib/pitch-f0-stream'

export type DemoTakeId = 'off' | 'on'

/** One moment of the sung line, for the voice synth (wall clock). */
export interface DemoVoicePoint {
  /** Seconds since the take started. */
  readonly t: number
  /** Off the note, cents; vibrato comes on top (DEMO_VIBRATO). */
  readonly cents: number
  /** Loudness 0..1; 0 is silence. */
  readonly level: number
}

export interface DemoEvent {
  readonly type: HoldEventType
  /** Engine seconds. */
  readonly at: number
}

export interface DemoTake {
  readonly id: DemoTakeId
  readonly frames: readonly PitchFrame[]
  /** The engine's events for these frames, in order. */
  readonly events: readonly DemoEvent[]
  /** Take 2's fast-forward, engine seconds; null for take 1. */
  readonly fast: { readonly from: number; readonly to: number } | null
  /** Engine seconds at a wall time since the take started. */
  engineAt: (wall: number) => number
  /** Wall seconds since the take started at an engine time. */
  wallAt: (engine: number) => number
  /** The voice to synthesise, wall clock, every VOICE_STEP seconds. */
  readonly voice: readonly DemoVoicePoint[]
  /** Wall seconds from the take's start to the end of its note. */
  readonly length: number
}

/** The vibrato both the frames and the synth carry. */
export const DEMO_VIBRATO = {
  hz: 5.5,
  /** Half the swing: the pitch moves this far either side. */
  cents: 14,
  /** Seconds after each onset for the vibrato to grow in. */
  rampSec: 0.35,
} as const

/** Engine seconds per wall second in take 2's fast-forward. */
export const DEMO_FAST_RATE = 4

const FRAME_SECONDS = 1 / 60
const VOICE_STEP = 0.025
const CONF = 0.92
const SILENT_RMS = 0.001
/** Pitch-tracker grain on the frames, cents (not in the synth). */
const JITTER_CENTS = 1.2
/** Take 2 starts its fast-forward this long after the lock. */
const FAST_AFTER_LOCK = 1.8
/** Take 2 lets go of the note this long after the lantern fills. */
const RELEASE_AFTER_GOAL = 0.6
/** Frames kept past the end of the note. */
const TAIL = 0.1

type Segment =
  | { readonly kind: 'rest'; readonly until: number }
  | {
      readonly kind: 'sing'
      readonly until: number
      /** Off the note, from and to, eased between. */
      readonly cents: readonly [number, number]
      readonly level: readonly [number, number]
    }

/**
 * Take 1, not like this: a breath, a scoop up onto the note, two seconds on
 * the line, then a slow drift sharp (+55 cents, well outside the band) that
 * stays there, and a breath in the middle of the note that ends it.
 */
const OFF_SEGMENTS: readonly Segment[] = [
  { kind: 'rest', until: 0.45 },
  { kind: 'sing', until: 0.62, cents: [-35, 0], level: [0.55, 0.8] },
  { kind: 'sing', until: 2.3, cents: [0, 0], level: [0.8, 0.82] },
  { kind: 'sing', until: 2.8, cents: [0, 55], level: [0.82, 0.86] },
  { kind: 'sing', until: 4.0, cents: [55, 55], level: [0.86, 0.78] },
  { kind: 'rest', until: Number.POSITIVE_INFINITY },
]

/** Take 2, like this: a breath, a small scoop, then the line, held. */
function onSegments(releaseAt: number): readonly Segment[] {
  return [
    { kind: 'rest', until: 0.45 },
    { kind: 'sing', until: 0.6, cents: [-25, 0], level: [0.5, 0.8] },
    { kind: 'sing', until: releaseAt, cents: [0, 0], level: [0.8, 0.8] },
    { kind: 'rest', until: Number.POSITIVE_INFINITY },
  ]
}

const smooth = (k: number): number => k * k * (3 - 2 * k)

/** When the last run of singing ends, engine seconds. */
function lastSung(segments: readonly Segment[]): number {
  return segments.reduce(
    (last, segment) =>
      segment.kind === 'sing' ? Math.max(last, segment.until) : last,
    0,
  )
}

interface Sung {
  /** Off the note, cents, before wander and vibrato. */
  cents: number
  level: number
  /** When this run of singing began; null in a rest. */
  onset: number | null
}

/** The script at one engine time. */
function sample(segments: readonly Segment[], t: number): Sung {
  let from = 0
  let onset: number | null = null
  for (const segment of segments) {
    if (segment.kind === 'rest') onset = null
    else onset ??= from
    if (t < segment.until) {
      if (segment.kind === 'rest') return { cents: 0, level: 0, onset: null }
      const k = smooth(Math.min(1, (t - from) / (segment.until - from)))
      return {
        cents: segment.cents[0] + (segment.cents[1] - segment.cents[0]) * k,
        level: segment.level[0] + (segment.level[1] - segment.level[0]) * k,
        onset,
      }
    }
    from = segment.until
  }
  return { cents: 0, level: 0, onset: null }
}

/** A slow, seeded wander of a few cents: a voice is never a sine. */
function wanderFor(seed: number): (t: number) => number {
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
export function demoVibratoCents(t: number, onset: number): number {
  const grown = Math.min(1, Math.max(0, (t - onset) / DEMO_VIBRATO.rampSec))
  return (
    DEMO_VIBRATO.cents * grown * Math.sin(2 * Math.PI * DEMO_VIBRATO.hz * t)
  )
}

/** Merc's 0..1 loudness as an RMS level (the inverse of levelFromRms). */
export function rmsForLevel(level: number): number {
  return Math.pow(10, (level * 40 - 50) / 20)
}

function framesFor(
  segments: readonly Segment[],
  note: number,
  seed: number,
  until: number,
): PitchFrame[] {
  const wander = wanderFor(seed)
  const grain = seeded(seed + 7)
  const frames: PitchFrame[] = []
  const count = Math.ceil(until / FRAME_SECONDS)
  for (let i = 0; i <= count; i++) {
    const t = i * FRAME_SECONDS
    const sung = sample(segments, t)
    if (sung.onset === null || sung.level <= 0) {
      frames.push({ t, f0: 0, conf: 0, rms: SILENT_RMS })
      continue
    }
    const jitter = (grain() - 0.5 + (grain() - 0.5)) * JITTER_CENTS
    const cents =
      sung.cents + wander(t) + demoVibratoCents(t, sung.onset) + jitter
    frames.push({
      t,
      f0: midiToFrequency(note + cents / 100),
      conf: CONF,
      rms: rmsForLevel(sung.level),
    })
  }
  return frames
}

/** The engine's events for a take, with their engine times. */
export function replayDemoTake(
  frames: readonly PitchFrame[],
  note: number,
): DemoEvent[] {
  let state = createHoldState()
  let previous: PitchFrame | null = null
  const events: DemoEvent[] = []
  for (const frame of frames) {
    state = tickHold(
      state,
      holdTickFromFrame(frame, previous, note),
      HOLD_PRESETS.exercise,
    )
    for (const type of state.events) events.push({ type, at: state.clock })
    previous = frame
  }
  return events
}

/** The wall clock against the engine's, with one fast stretch or none. */
function clocks(fast: DemoTake['fast']): Pick<DemoTake, 'engineAt' | 'wallAt'> {
  if (fast === null) return { engineAt: (w) => w, wallAt: (e) => e }
  const span = (fast.to - fast.from) / DEMO_FAST_RATE
  return {
    engineAt: (w) => {
      if (w <= fast.from) return w
      if (w <= fast.from + span) {
        return fast.from + (w - fast.from) * DEMO_FAST_RATE
      }
      return fast.to + (w - fast.from - span)
    },
    wallAt: (e) => {
      if (e <= fast.from) return e
      if (e <= fast.to) return fast.from + (e - fast.from) / DEMO_FAST_RATE
      return fast.from + span + (e - fast.to)
    },
  }
}

function eventAt(events: readonly DemoEvent[], type: HoldEventType): number {
  const event = events.find((e) => e.type === type)
  if (event === undefined) {
    throw new Error(`Long note demo: the script never reaches '${type}'`)
  }
  return event.at
}

function voiceFor(
  segments: readonly Segment[],
  seed: number,
  clock: Pick<DemoTake, 'engineAt'>,
  length: number,
): DemoVoicePoint[] {
  const wander = wanderFor(seed)
  const points: DemoVoicePoint[] = []
  const count = Math.ceil(length / VOICE_STEP)
  for (let i = 0; i <= count; i++) {
    const w = i * VOICE_STEP
    const e = clock.engineAt(w)
    const sung = sample(segments, e)
    const voiced = sung.onset !== null && sung.level > 0
    points.push({
      t: w,
      cents: voiced ? sung.cents + wander(e) : 0,
      level: voiced ? sung.level : 0,
    })
  }
  return points
}

function buildTake(
  id: DemoTakeId,
  segments: readonly Segment[],
  note: number,
  seed: number,
  fast: DemoTake['fast'],
): DemoTake {
  // Past the last sung moment by more than the engine needs to end the
  // note; trimmed to the end of the note below.
  const draft = framesFor(segments, note, seed, lastSung(segments) + 1)
  const draftEvents = replayDemoTake(draft, note)
  const end = eventAt(draftEvents, 'end')
  const frames = draft.filter((frame) => frame.t <= end + TAIL + 1e-9)
  const clock = clocks(fast)
  const length = clock.wallAt(end)
  return {
    id,
    frames,
    events: replayDemoTake(frames, note),
    fast,
    ...clock,
    voice: voiceFor(segments, seed, clock, length),
    length,
  }
}

const OFF_SEED = 0x10ce
const ON_SEED = 0x1a77

/** Take 1: off the line, then a breath that ends the note. */
function offTake(note: number): DemoTake {
  return buildTake('off', OFF_SEGMENTS, note, OFF_SEED, null)
}

/** Take 2: on the line until the lantern is full, the middle at 4x. */
function onTake(note: number): DemoTake {
  // Where the lock and the goal fall decides the release and the fast
  // stretch, and neither depends on the release.
  const probe = framesFor(onSegments(30), note, ON_SEED, 16)
  const events = replayDemoTake(probe, note)
  const lock = eventAt(events, 'lock')
  const goal = eventAt(events, 'goal')
  return buildTake('on', onSegments(goal + RELEASE_AFTER_GOAL), note, ON_SEED, {
    from: lock + FAST_AFTER_LOCK,
    to: goal,
  })
}

/** One of Merc's two takes on a note. */
export function demoTake(id: DemoTakeId, note: number): DemoTake {
  return id === 'off' ? offTake(note) : onTake(note)
}
