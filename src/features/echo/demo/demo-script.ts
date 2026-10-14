// ============================================================
// The Echo demo's script: Merc's two takes, frame by frame
// ============================================================
//
// "How it works" for Echo (DESIGN-echo.md 4): Merc sings the phrase 1-3-2
// on the room's root, then sings it back himself, twice, through the
// room's own engine.
//
//   take 1, not like this   he comes in over his own last note (the room
//                           ignores it and says so), lands the first note,
//                           sits 65 cents flat on the second until its
//                           deadline, then slides straight past the third
//                           and stops: the silence ends the phrase
//   take 2, like this       he waits for the call to end and lands all
//                           three; the phrase joins the sky and the result
//                           shows
//
// Merc sings at one level, Beginner (the `learning` tier), whatever the
// singer picked: the level a first visit starts at, with Merc's slowest
// call (0.9 s a note), so the phrase is easy to hear and follow. Free
// timing, Echo's own: each note has its 4 s deadline, and 1.4 s of silence
// ends the echo.
//
// Pure and seeded: the same root always gives the same frames, events and
// timings. The room plays these frames through its sequence engine
// (useEchoController's scripted take), so every tooltip is cued by a
// moment that really happened there, and the tests replay the same frames
// through tickSequence to prove what each tooltip says.
//
// Two clocks. A take's frames are dated on the ENGINE clock, the one
// tickSequence runs on (frame.t). The screen and the sound run on the WALL
// clock. They agree except in take 1's one fast-forward, the wait on the
// flat note for its deadline, where four engine seconds pass in each wall
// second.

import type { DemoEvent as KitDemoEvent, DemoTakeId, DemoTakeShape, DemoVoicePoint, FastStretch, } from '@/components/demo-kit/demo-plan'
import { stretchClocks } from '@/components/demo-kit/demo-plan'
import { midiToFrequency } from '@/lib/frequency-to-note'
import { offTarget } from '@/lib/hold/hold-reading'
import { seeded } from '@/lib/mirror/demo-frames'
import type { PitchFrame } from '@/lib/pitch-f0-stream'
import type { EchoPhrase, Motif } from '@/lib/sequence/phrase-bank'
import { echoPhrase } from '@/lib/sequence/phrase-bank'
import type { EchoLevelId, EchoLevelPreset, SequenceEvent, } from '@/lib/sequence/sequence-engine'
import { createSequenceState, ECHO_LEVELS, RESPONSE_GATE_SECONDS, tickSequence, } from '@/lib/sequence/sequence-engine'
import type { CallNote } from '../early-singing'
import { NO_EARLY, watchEarly } from '../early-singing'
import type { EchoDemoMark } from '../scripted-take'

export type { DemoTakeId, DemoVoicePoint, EchoDemoMark, FastStretch }

export type DemoEvent = KitDemoEvent<EchoDemoMark>

/** The level Merc sings at, whatever the singer's own. */
export const DEMO_LEVEL: EchoLevelId = 'learning'

export const DEMO_RULES: EchoLevelPreset = ECHO_LEVELS[DEMO_LEVEL]

/** The phrase: up a third, down a step (the design's 1-3-2). */
export const DEMO_MOTIF: Motif = [1, 3, 2]

/** Merc's call starts this long after the take's clock reads zero, s. */
export const CALL_AT = 0.1

/**
 * After a phrase ends, the room shows its constellation this long before
 * the next call or the result (useEchoController's PHRASE_SHOW_MS).
 */
export const RESULT_AFTER = 1.2

/** The vibrato both the frames and the synth carry on Merc's echo. */
export const DEMO_VIBRATO = {
  hz: 5.5,
  /** Half the swing: the pitch moves this far either side. */
  cents: 10,
  /** Seconds after each onset for the vibrato to grow in. */
  rampSec: 0.3,
} as const

/** Engine seconds per wall second in take 1's fast-forward. */
export const DEMO_FAST_RATE = 4

/** How flat take 1's second note sits, cents: well outside the band. */
export const FLAT_CENTS = -65

const FRAME_SECONDS = 1 / 60
const VOICE_STEP = 0.025
const CONF = 0.92
const SILENT_RMS = 0.001
/** Pitch-tracker grain on the frames, cents (not in the synth). */
const JITTER_CENTS = 1.2
/** Frames kept past the end of the phrase. */
const TAIL = 0.1
/** The longest a take may run before its phrase must have ended, s. */
const LONGEST_TAKE = 30

/** Take 1 comes in this long before the end of Merc's call, s. */
const EARLY_BY = 0.62
/** Take 2 comes in this long after the response opens, s. */
const ON_TIME_AFTER = 0.05
/** Take 1 is heard flat this long before its fast-forward, s. */
const FLAT_HEARD = 0.6
/** Its fast-forward ends this long before the flat note's deadline, s. */
const SLOW_BEFORE_MISS = 0.3
/** After the flat note misses it is held this long, then slid off, s. */
const HOLD_AFTER_MISS = 0.3
const SLIDE_SECONDS = 0.3
/** Take 2 holds each landed note this long before it moves on, s. */
const HOLD_AFTER_LAND = 0.1
const GLIDE_SECONDS = 0.12
/** Take 2 lets go of its last note this long after it lands, s. */
const RELEASE_AFTER_LAST = 0.3

type Segment =
  | { readonly kind: 'rest'; readonly until: number }
  | {
      readonly kind: 'sing'
      readonly until: number
      /** Above the root, from and to, eased between. */
      readonly cents: readonly [number, number]
      readonly level: readonly [number, number]
    }

const smooth = (k: number): number => k * k * (3 - 2 * k)

interface Sung {
  /** Above the root, cents, before wander and vibrato. */
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
      const span = segment.until - from
      const k = Number.isFinite(span)
        ? smooth(Math.min(1, (t - from) / span))
        : 0
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

/**
 * The script cut at `at` (its open last segment ends there) and carried
 * on with `more`, each segment's end absolute.
 */
function then(
  segments: readonly Segment[],
  at: number,
  more: readonly Segment[],
): Segment[] {
  const kept = segments.slice(0, -1)
  const last = segments[segments.length - 1]
  return [...kept, { ...last, until: at }, ...more]
}

/** Held on `cents` from here on. */
const hold = (cents: number): Segment => ({
  kind: 'sing',
  until: Number.POSITIVE_INFINITY,
  cents: [cents, cents],
  level: [0.8, 0.8],
})

const glide = (until: number, from: number, to: number): Segment => ({
  kind: 'sing',
  until,
  cents: [from, to],
  level: [0.8, 0.8],
})

const REST_ON: Segment = { kind: 'rest', until: Number.POSITIVE_INFINITY }

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
function rmsForLevel(level: number): number {
  return Math.pow(10, (level * 40 - 50) / 20)
}

/**
 * A take's voice as the pitch tracker hears it: the frame at engine time
 * t, on the take's own seeded wander and grain. Called once a frame, in
 * order: the grain is a sequence.
 */
function trackerFor(
  root: number,
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
      f0: midiToFrequency(root + cents / 100),
      conf: CONF,
      rms: rmsForLevel(sung.level),
    }
  }
}

/** A frame's pitch, fractional MIDI, or null when it is not voiced. */
function pitchOf(frame: PitchFrame): number | null {
  const cents = offTarget(frame, 0)
  return cents === null ? null : cents / 100
}

/** The engine's event as the demo names it. */
function markOf(event: SequenceEvent): EchoDemoMark {
  return event.type === 'phraseEnd'
    ? 'phraseEnd'
    : `${event.type}:${event.index}`
}

/** The phrase on the take's clock: Merc's notes from CALL_AT. */
export interface DemoCall {
  readonly phrase: EchoPhrase
  readonly notes: readonly CallNote[]
  /** The end of his last note, take clock. */
  readonly end: number
}

/** Merc's call on `root`, as both takes sing it. */
export function demoCall(root: number): DemoCall {
  const phrase = echoPhrase(DEMO_MOTIF, 'major', root, DEMO_RULES.noteSeconds)
  const notes = phrase.notes.map((note) => ({
    from: CALL_AT + note.at,
    to: CALL_AT + note.at + note.seconds,
    midi: note.midi,
  }))
  const end = Math.max(...notes.map((note) => note.to))
  return { phrase, notes, end }
}

interface SungTake {
  /** The script as it was sung, every change included. */
  readonly segments: readonly Segment[]
  /** Frames to the end of the phrase and TAIL past it. */
  readonly frames: readonly PitchFrame[]
  readonly events: readonly DemoEvent[]
}

/**
 * A take sung through the room's engine and its early rule, in one pass,
 * exactly as useEchoController hears it: every frame watched for singing
 * over the call, then ticked through the sequence engine. `rewrite` may
 * change the script when an event fires; the frames before the change are
 * the same either way, so the events before it stand.
 */
function singTake(
  segments: readonly Segment[],
  call: DemoCall,
  seed: number,
  rewrite: (event: DemoEvent) => readonly Segment[] | null,
): SungTake {
  const frameAt = trackerFor(call.phrase.root, seed)
  let script = segments
  let state = createSequenceState(call.end + RESPONSE_GATE_SECONDS)
  let early = NO_EARLY
  let previous: PitchFrame | null = null
  const frames: PitchFrame[] = []
  const events: DemoEvent[] = [{ type: 'call', at: CALL_AT }]
  const happen = (event: DemoEvent): void => {
    events.push(event)
    script = rewrite(event) ?? script
  }
  let end: number | null = null
  for (let i = 0; ; i++) {
    const t = i * FRAME_SECONDS
    if (end !== null && t > end + TAIL + 1e-9) break
    if (t > LONGEST_TAKE) throw new Error('Echo demo: a take never ends')
    const frame = frameAt(script, t)
    frames.push(frame)
    if (end !== null) continue
    const wasEarly = early.fired
    early = watchEarly(early, frame, previous, pitchOf(frame), call.notes)
    if (early.fired && !wasEarly) happen({ type: 'early', at: frame.t })
    previous = frame
    state = tickSequence(state, frame, call.phrase, DEMO_RULES)
    for (const event of state.events) {
      happen({ type: markOf(event), at: frame.t })
      if (event.type === 'phraseEnd') end = frame.t
    }
  }
  return { segments: script, frames, events }
}

function eventAt(events: readonly DemoEvent[], type: EchoDemoMark): number {
  const event = events.find((e) => e.type === type)
  if (event === undefined) {
    throw new Error(`Echo demo: the script never reaches '${type}'`)
  }
  return event.at
}

/** Where the voice stops for good: the last sung segment's end. */
function voiceEnds(segments: readonly Segment[]): number {
  let end = 0
  for (const segment of segments) {
    if (segment.kind === 'sing') end = segment.until
  }
  return end
}

function voiceFor(
  segments: readonly Segment[],
  seed: number,
  engineAt: (wall: number) => number,
  length: number,
): DemoVoicePoint[] {
  const wander = wanderFor(seed)
  const points: DemoVoicePoint[] = []
  const count = Math.ceil(length / VOICE_STEP)
  for (let i = 0; i <= count; i++) {
    const w = i * VOICE_STEP
    const e = engineAt(w)
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

/** One of Merc's takes on the root (the demo kit's shape, demo-plan.ts). */
export interface EchoDemoTake extends DemoTakeShape<EchoDemoMark> {
  /** The root, MIDI: the phrase's first note. */
  readonly root: number
  readonly phrase: EchoPhrase
  /** Merc's notes on the take's clock. */
  readonly call: readonly CallNote[]
  /** The end of his last note, take clock. */
  readonly callEnd: number
  /** The rules it was sung under: DEMO_LEVEL's. */
  readonly rules: EchoLevelPreset
}

function buildTake(
  id: DemoTakeId,
  call: DemoCall,
  sung: SungTake,
  seed: number,
  fast: readonly FastStretch[],
): EchoDemoTake {
  const clock = stretchClocks(fast, DEMO_FAST_RATE)
  const length = clock.wallAt(eventAt(sung.events, 'phraseEnd'))
  // The voice runs to its own end, which may come after the phrase's.
  const voiceLength = Math.max(
    length,
    clock.wallAt(voiceEnds(sung.segments)) + VOICE_STEP,
  )
  return {
    id,
    root: call.phrase.root,
    phrase: call.phrase,
    call: call.notes,
    callEnd: call.end,
    rules: DEMO_RULES,
    frames: sung.frames,
    events: sung.events,
    fast,
    ...clock,
    voice: voiceFor(sung.segments, seed, clock.engineAt, voiceLength),
    length,
  }
}

const OFF_SEED = 0xec40
const ON_SEED = 0xec41

/**
 * Take 1: in over Merc's last note on the root, held into the response
 * (the first note lands), up to the second note 65 cents flat and held
 * there to its deadline, then a slide straight down past the third note
 * and silence, which ends the phrase.
 */
function offTake(root: number): EchoDemoTake {
  const call = demoCall(root)
  const flat = 400 + FLAT_CENTS
  const comesIn = call.end - EARLY_BY
  let script: Segment[] = [
    { kind: 'rest', until: comesIn },
    { kind: 'sing', until: comesIn + 0.1, cents: [-40, 0], level: [0.5, 0.8] },
    hold(0),
  ]
  let flatFrom = 0
  const sung = singTake(script, call, OFF_SEED, (event) => {
    if (event.type === 'land:0') {
      const leave = event.at + HOLD_AFTER_LAND
      flatFrom = leave + GLIDE_SECONDS
      script = then(script, leave, [glide(flatFrom, 0, flat), hold(flat)])
      return script
    }
    if (event.type === 'miss:1') {
      const slide = event.at + HOLD_AFTER_MISS
      script = then(script, slide, [
        {
          kind: 'sing',
          until: slide + SLIDE_SECONDS,
          cents: [flat, 20],
          level: [0.8, 0.6],
        },
        REST_ON,
      ])
      return script
    }
    return null
  })
  const missAt = eventAt(sung.events, 'miss:1')
  return buildTake('off', call, sung, OFF_SEED, [
    { from: flatFrom + FLAT_HEARD, to: missAt - SLOW_BEFORE_MISS },
  ])
}

/**
 * Take 2: in after the call, each note landed and held a moment, glided
 * to the next, and the last one let go once it lands.
 */
function onTake(root: number): EchoDemoTake {
  const call = demoCall(root)
  const [, second, third] = call.phrase.notes.map(
    (note) => (note.midi - root) * 100,
  )
  const comesIn = call.end + RESPONSE_GATE_SECONDS + ON_TIME_AFTER
  let script: Segment[] = [
    { kind: 'rest', until: comesIn },
    { kind: 'sing', until: comesIn + 0.1, cents: [-30, 0], level: [0.5, 0.8] },
    hold(0),
  ]
  const next = (at: number, from: number, to: number): Segment[] => {
    const leave = at + HOLD_AFTER_LAND
    script = then(script, leave, [
      glide(leave + GLIDE_SECONDS, from, to),
      hold(to),
    ])
    return script
  }
  const sung = singTake(script, call, ON_SEED, (event) => {
    if (event.type === 'land:0') return next(event.at, 0, second)
    if (event.type === 'land:1') return next(event.at, second, third)
    if (event.type === 'land:2') {
      script = then(script, event.at + RELEASE_AFTER_LAST, [REST_ON])
      return script
    }
    return null
  })
  const end = eventAt(sung.events, 'phraseEnd')
  const events = [
    ...sung.events,
    { type: 'result' as const, at: end + RESULT_AFTER },
  ]
  return buildTake('on', call, { ...sung, events }, ON_SEED, [])
}

/** One of Merc's two takes on a root. */
export function demoTake(id: DemoTakeId, root: number): EchoDemoTake {
  return id === 'off' ? offTake(root) : onTake(root)
}
