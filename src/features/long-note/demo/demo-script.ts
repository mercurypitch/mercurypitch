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

import type { DemoEvent as KitDemoEvent, DemoTakeId, DemoTakeShape, DemoVoicePoint, FastStretch, } from '@/components/demo-kit/demo-plan'
import type { DemoSegment as Segment } from '@/components/demo-kit/demo-segments'
import { eventAt, segmentTracker, segmentVoice, } from '@/components/demo-kit/demo-segments'
import { FRAME_SECONDS } from '@/components/demo-kit/demo-voice'
import type { HoldEventType, HoldPreset } from '@/lib/hold/hold-engine'
import { createHoldState, holdTickFromFrame, LANTERN_LEVELS, tickHold, } from '@/lib/hold/hold-engine'
import type { PitchFrame } from '@/lib/pitch-f0-stream'
import type { ExerciseLevel } from '@/stores/exercise-level'

export type { DemoTakeId, DemoVoicePoint, FastStretch }

// Merc's loudness as the tracker hears it (the demo kit's voice).
export { rmsForLevel } from '@/components/demo-kit/demo-voice'

export type DemoEvent = KitDemoEvent<HoldEventType>

/**
 * One of Merc's takes (the demo kit's shape, demo-plan.ts): take 2's
 * fast-forwards play at DEMO_FAST_RATE, take 1 has none.
 */
export interface DemoTake extends DemoTakeShape<HoldEventType> {
  /** The rules it was sung under: DEMO_LEVEL's lantern. */
  readonly preset: HoldPreset
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
  const frameAt = segmentTracker(note, seed, DEMO_VIBRATO)
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

function buildTake(
  id: DemoTakeId,
  sung: SungTake,
  seed: number,
  fast: DemoTake['fast'],
): DemoTake {
  const clock = clocks(fast)
  const length = clock.wallAt(eventAt(sung.events, 'end', 'Long note'))
  return {
    id,
    preset: DEMO_PRESET,
    frames: sung.frames,
    events: sung.events,
    fast,
    ...clock,
    voice: segmentVoice(sung.segments, seed, length, clock.engineAt),
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
  const lock = eventAt(sung.events, 'lock', 'Long note')
  const goal = eventAt(sung.events, 'goal', 'Long note')
  const brim = eventAt(sung.events, 'brim', 'Long note')
  return buildTake('on', sung, ON_SEED, [
    { from: lock + FAST_AFTER_LOCK, to: goal },
    { from: goal + STEP_OUT_SECONDS, to: brim },
  ])
}

/** One of Merc's two takes on a note. */
export function demoTake(id: DemoTakeId, note: number): DemoTake {
  return id === 'off' ? offTake(note) : onTake(note)
}
