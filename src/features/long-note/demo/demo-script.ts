// ============================================================
// The Long note demo's script — Merc's two takes, frame by frame
// ============================================================
//
// "How it works" for Long note: Merc sings the note twice through the
// room's own engine. Take 1 drifts sharp and stops for a breath (not like
// this); take 2 holds the line to the goal, where the lantern is half full
// and Merc steps out of the glass, then holds it steady to the brim (like
// this).
//
// Merc sings at one level, Singer, whatever level the singer picked: the
// band he sings in is the room's +-30 cents, and his light vibrato (+-14
// cents) fills the top to the brim there.
//
// Pure and seeded: the same note always gives the same frames, events and
// timings. The room plays these frames through its hold engine
// (useLongNoteController's scripted take), so every tooltip is cued by an
// engine event that really fired, and the tests replay the same frames
// through tickHold to prove what each tooltip says.
//
// Two clocks. A take's frames are dated on the ENGINE clock, the one
// tickHold runs on (frame.t). The screen and the sound run on the WALL
// clock. They agree except in take 2's two fast-forwards (up to the goal,
// and from just after it to the brim), where four engine seconds pass in
// each wall second; the voice keeps sounding at its own speed through
// them, and so do Merc's hop and cheers.

import type { ExerciseLevel } from '@/lib/exercise-level'
import { midiToFrequency } from '@/lib/frequency-to-note'
import type { HoldEventType, HoldPreset } from '@/lib/hold/hold-engine'
import { createHoldState, holdTickFromFrame, LANTERN_LEVELS, tickHold, } from '@/lib/hold/hold-engine'
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

/** A stretch of a take played at DEMO_FAST_RATE, engine seconds. */
export interface FastStretch {
  readonly from: number
  readonly to: number
}

export interface DemoTake {
  readonly id: DemoTakeId
  /** The rules it was sung under: DEMO_LEVEL's lantern. */
  readonly preset: HoldPreset
  readonly frames: readonly PitchFrame[]
  /** The engine's events for these frames, in order. */
  readonly events: readonly DemoEvent[]
  /** Take 2's fast-forwards, in order; none for take 1. */
  readonly fast: readonly FastStretch[]
  /** Engine seconds at a wall time since the take started. */
  engineAt: (wall: number) => number
  /** Wall seconds since the take started at an engine time. */
  wallAt: (engine: number) => number
  /** The voice to synthesise, wall clock, every VOICE_STEP seconds. */
  readonly voice: readonly DemoVoicePoint[]
  /** Wall seconds from the take's start to the end of its note. */
  readonly length: number
}

/** The level Merc sings at, whatever the singer's own. */
export const DEMO_LEVEL: ExerciseLevel = 'singer'

const DEMO_PRESET = LANTERN_LEVELS[DEMO_LEVEL]

/** The vibrato both the frames and the synth carry. */
export const DEMO_VIBRATO = {
  hz: 5.5,
  /** Half the swing: the pitch moves this far either side. */
  cents: 14,
  /** Seconds after each onset for the vibrato to grow in. */
  rampSec: 0.35,
} as const

/** Engine seconds per wall second in take 2's fast-forwards. */
export const DEMO_FAST_RATE = 4

const FRAME_SECONDS = 1 / 60
const VOICE_STEP = 0.025
const CONF = 0.92
const SILENT_RMS = 0.001
/** Pitch-tracker grain on the frames, cents (not in the synth). */
const JITTER_CENTS = 1.2
/** Take 2 starts its first fast-forward this long after the lock. */
const FAST_AFTER_LOCK = 1.8
/**
 * Past the goal, take 2 plays this long at its own speed while Merc hops
 * out of the glass (his hop and cheer keep the wall clock through the
 * second fast-forward that follows).
 */
const STEP_OUT_SECONDS = 0.8
/**
 * Take 2 lets go of the note this long after the brim, so the result
 * follows the full lantern straight away.
 */
const RELEASE_AFTER_BRIM = 0.35
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

/**
 * A take's voice as the pitch tracker hears it: the frame at engine time
 * t of the script `segments`, on the take's own seeded wander and grain.
 * Called once a frame, in order: the grain is a sequence.
 */
function trackerFor(
  note: number,
  seed: number,
): (segments: readonly Segment[], t: number) => PitchFrame {
  const wander = wanderFor(seed)
  const grain = seeded(seed + 7)
  return (segments, t) => {
    const sung = sample(segments, t)
    if (sung.onset === null || sung.level <= 0) {
      return { t, f0: 0, conf: 0, rms: SILENT_RMS }
    }
    const jitter = (grain() - 0.5 + (grain() - 0.5)) * JITTER_CENTS
    const cents =
      sung.cents + wander(t) + demoVibratoCents(t, sung.onset) + jitter
    return {
      t,
      f0: midiToFrequency(note + cents / 100),
      conf: CONF,
      rms: rmsForLevel(sung.level),
    }
  }
}

/** The longest a take may run before its note must have ended. */
const LONGEST_TAKE = 60

interface SungTake {
  /** The script as it was sung, its release included. */
  readonly segments: readonly Segment[]
  /** Frames to the end of the note and TAIL past it. */
  readonly frames: readonly PitchFrame[]
  readonly events: readonly DemoEvent[]
}

/**
 * A take sung through the room's engine, its preset's steady stretch to
 * the brim included, in one pass. `rewrite` may change the script when an
 * event fires (take 2 lets go after the brim); the frames before the
 * change are the same either way, so the engine's events stand.
 */
function singTake(
  segments: readonly Segment[],
  note: number,
  seed: number,
  rewrite: (event: DemoEvent) => readonly Segment[] | null = () => null,
): SungTake {
  const frameAt = trackerFor(note, seed)
  let script = segments
  let state = createHoldState()
  let previous: PitchFrame | null = null
  const frames: PitchFrame[] = []
  const events: DemoEvent[] = []
  let end: number | null = null
  for (let i = 0; ; i++) {
    const t = i * FRAME_SECONDS
    if (end !== null && t > end + TAIL + 1e-9) break
    if (t > LONGEST_TAKE) throw new Error('Long note demo: a take never ends')
    const frame = frameAt(script, t)
    frames.push(frame)
    if (end !== null) continue
    state = tickHold(
      state,
      holdTickFromFrame(frame, previous, note),
      DEMO_PRESET,
    )
    previous = frame
    for (const type of state.events) {
      const event = { type, at: state.clock }
      events.push(event)
      if (type === 'end') end = state.clock
      script = rewrite(event) ?? script
    }
  }
  return { segments: script, frames, events }
}

/** The wall seconds a fast stretch saves, played through. */
const saves = (stretch: FastStretch): number =>
  (stretch.to - stretch.from) * (1 - 1 / DEMO_FAST_RATE)

/** The wall clock against the engine's, through the fast stretches. */
function clocks(
  fast: readonly FastStretch[],
): Pick<DemoTake, 'engineAt' | 'wallAt'> {
  return {
    engineAt: (w) => {
      let saved = 0
      for (const stretch of fast) {
        const starts = stretch.from - saved
        if (w <= starts) break
        const ends = starts + (stretch.to - stretch.from) / DEMO_FAST_RATE
        if (w <= ends) return stretch.from + (w - starts) * DEMO_FAST_RATE
        saved += saves(stretch)
      }
      return w + saved
    },
    wallAt: (e) => {
      let saved = 0
      for (const stretch of fast) {
        if (e <= stretch.from) break
        if (e < stretch.to) {
          return stretch.from - saved + (e - stretch.from) / DEMO_FAST_RATE
        }
        saved += saves(stretch)
      }
      return e - saved
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
  sung: SungTake,
  seed: number,
  fast: DemoTake['fast'],
): DemoTake {
  const clock = clocks(fast)
  const length = clock.wallAt(eventAt(sung.events, 'end'))
  return {
    id,
    preset: DEMO_PRESET,
    frames: sung.frames,
    events: sung.events,
    fast,
    ...clock,
    voice: voiceFor(sung.segments, seed, clock, length),
    length,
  }
}

const OFF_SEED = 0x10ce
const ON_SEED = 0x1a77

/** Take 1: off the line, then a breath that ends the note. */
function offTake(note: number): DemoTake {
  return buildTake('off', singTake(OFF_SEGMENTS, note, OFF_SEED), OFF_SEED, [])
}

/**
 * Take 2: on the line to the goal (half full), a second at its own speed
 * while Merc steps out, then steady to the brim; both long stretches at 4x.
 */
function onTake(note: number): DemoTake {
  // Held until the brim, then let go: the lock, the goal and the brim fall
  // where the engine puts them, and none depends on the release.
  const sung = singTake(
    onSegments(Number.POSITIVE_INFINITY),
    note,
    ON_SEED,
    (event) =>
      event.type === 'brim' ? onSegments(event.at + RELEASE_AFTER_BRIM) : null,
  )
  const lock = eventAt(sung.events, 'lock')
  const goal = eventAt(sung.events, 'goal')
  const brim = eventAt(sung.events, 'brim')
  return buildTake('on', sung, ON_SEED, [
    { from: lock + FAST_AFTER_LOCK, to: goal },
    { from: goal + STEP_OUT_SECONDS, to: brim },
  ])
}

/** One of Merc's two takes on a note. */
export function demoTake(id: DemoTakeId, note: number): DemoTake {
  return id === 'off' ? offTake(note) : onTake(note)
}
