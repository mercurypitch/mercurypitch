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
//                           sits 65 cents flat on the second, then moves on
//                           to the third and lands it: the second note
//                           misses as he does
//   take 2, like this       he waits for the call to end and lands all
//                           three; the phrase joins the sky and the result
//                           shows
//
// Both takes sing back at the call's pace: each note about as long as
// Merc sang it, the moves between them unhurried. Nothing is played fast.
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
// One clock. The demo kit can play a stretch of a take fast (Long note's
// does); Echo's takes play at their own speed from start to end, so the
// engine's clock (frame.t) and the screen's and the sound's are the same.
// A flat note on its own misses only at its 4 s deadline, so take 1 lets
// it miss the way a singer's does when they move on: the engine misses a
// pending note the moment the voice lands the one after it.

import type { DemoEvent as KitDemoEvent, DemoTakeId, DemoTakeShape, DemoVoicePoint, } from '@/components/demo-kit/demo-plan'
import { midiToFrequency } from '@/lib/frequency-to-note'
import { seeded } from '@/lib/mirror/demo-frames'
import type { PitchFrame } from '@/lib/pitch-f0-stream'
import type { EchoPhrase, Motif } from '@/lib/sequence/phrase-bank'
import { echoPhrase } from '@/lib/sequence/phrase-bank'
import type { EchoLevelId, EchoLevelPreset, SequenceEvent, } from '@/lib/sequence/sequence-engine'
import { createSequenceState, ECHO_LEVELS, RESPONSE_GATE_SECONDS, tickSequence, } from '@/lib/sequence/sequence-engine'
import type { CallNote } from '../early-singing'
import { NO_EARLY, pitchOf, watchEarly } from '../early-singing'
import type { EchoDemoMark } from '../scripted-take'

export type { DemoTakeId, DemoVoicePoint, EchoDemoMark }

export type DemoEvent = KitDemoEvent<EchoDemoMark>

/** The level Merc sings at, whatever the singer's own. */
export const DEMO_LEVEL: EchoLevelId = 'learning'

export const DEMO_RULES: EchoLevelPreset = ECHO_LEVELS[DEMO_LEVEL]

/** The phrase: up a third, down a step (the design's 1-3-2). */
export const DEMO_MOTIF: Motif = [1, 3, 2]

/** Merc's call starts this long after the take's clock reads zero, s. */
export const CALL_AT = 0.1

/**
 * After take 2's phrase ends, the room shows its constellation this long
 * before the result (echo-controller-contract.ts, DEMO_PHRASE_SHOW_MS).
 */
export const RESULT_AFTER = 2

/** The vibrato both the frames and the synth carry on Merc's echo. */
export const DEMO_VIBRATO = {
  hz: 5.5,
  /** Half the swing: the pitch moves this far either side. */
  cents: 10,
  /** Seconds after each onset for the vibrato to grow in. */
  rampSec: 0.3,
} as const

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

/**
 * Each note sung back is as long as Merc sang it in the call, onset to
 * onset: the echo copies his pace.
 */
export const ECHO_NOTE_SECONDS = DEMO_RULES.noteSeconds
/** A move from one note to the next, centred on the beat between them, s. */
export const ECHO_GLIDE_SECONDS = 0.2
/** Take 1 holds its flat note this many of Merc's notes before moving on. */
export const FLAT_NOTES = 1.5

/**
 * Take 1 comes in this long before the end of Merc's call, s: long enough
 * over his last note for the room's early rule (EARLY_SECONDS) to hear it.
 */
const EARLY_BY = 0.45
/** Both takes' first note ends this long after the response opens, s. */
const ON_TIME_AFTER = 0.05

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

/** Sung from the segment before to `until`, `from` eased to `to` cents. */
const sing = (until: number, from: number, to: number = from): Segment => ({
  kind: 'sing',
  until,
  cents: [from, to],
  level: [0.8, 0.8],
})

const REST_ON: Segment = { kind: 'rest', until: Number.POSITIVE_INFINITY }

/**
 * A line of held notes, `cents` above the root: the first comes in at
 * `from` out of silence (from `attack` cents off it) and ends at
 * `firstEnds`; each note after it lasts `lengths[i]` of Merc's notes.
 * Each move is a glide centred on the beat between two notes, and the
 * last note stops dead at its end (the synth gives it its release).
 */
function heldLine(
  from: number,
  attack: number,
  firstEnds: number,
  cents: readonly number[],
  lengths: readonly number[],
): Segment[] {
  const half = ECHO_GLIDE_SECONDS / 2
  const segments: Segment[] = [
    { kind: 'rest', until: from },
    {
      kind: 'sing',
      until: from + 0.1,
      cents: [cents[0] + attack, cents[0]],
      level: [0.5, 0.8],
    },
  ]
  let beat = firstEnds
  cents.forEach((note, i) => {
    const next = cents[i + 1]
    if (next === undefined) {
      segments.push(sing(beat, note), REST_ON)
      return
    }
    segments.push(sing(beat - half, note), sing(beat + half, note, next))
    beat += lengths[i] * ECHO_NOTE_SECONDS
  })
  return segments
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
  /** The script as it was sung. */
  readonly segments: readonly Segment[]
  /** Frames to the end of the phrase and TAIL past it. */
  readonly frames: readonly PitchFrame[]
  readonly events: readonly DemoEvent[]
}

/**
 * The room's ears on one take, exactly as useEchoController hears it:
 * each frame watched for singing over the call, then ticked through the
 * sequence engine. Returns what each frame set off, in that order.
 */
function roomEars(call: DemoCall): (frame: PitchFrame) => DemoEvent[] {
  let state = createSequenceState(call.end + RESPONSE_GATE_SECONDS)
  let early = NO_EARLY
  let previous: PitchFrame | null = null
  return (frame) => {
    const heard: DemoEvent[] = []
    const wasEarly = early.fired
    early = watchEarly(early, frame, previous, pitchOf(frame), call.notes)
    if (early.fired && !wasEarly) heard.push({ type: 'early', at: frame.t })
    previous = frame
    state = tickSequence(state, frame, call.phrase, DEMO_RULES)
    for (const event of state.events) {
      heard.push({ type: markOf(event), at: frame.t })
    }
    return heard
  }
}

/** A take sung through the room's ears in one pass. */
function singTake(
  segments: readonly Segment[],
  call: DemoCall,
  seed: number,
): SungTake {
  const frameAt = trackerFor(call.phrase.root, seed)
  const hear = roomEars(call)
  const frames: PitchFrame[] = []
  const events: DemoEvent[] = [{ type: 'call', at: CALL_AT }]
  let end: number | null = null
  for (let i = 0; ; i++) {
    const t = i * FRAME_SECONDS
    if (end !== null && t > end + TAIL + 1e-9) break
    if (t > LONGEST_TAKE) throw new Error('Echo demo: a take never ends')
    const frame = frameAt(segments, t)
    frames.push(frame)
    if (end !== null) continue
    for (const event of hear(frame)) {
      events.push(event)
      if (event.type === 'phraseEnd') end = frame.t
    }
  }
  return { segments, frames, events }
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
  length: number,
): DemoVoicePoint[] {
  const wander = wanderFor(seed)
  const points: DemoVoicePoint[] = []
  const count = Math.ceil(length / VOICE_STEP)
  for (let i = 0; i <= count; i++) {
    const t = i * VOICE_STEP
    const sung = sample(segments, t)
    const voiced = sung.onset !== null && sung.level > 0
    points.push({
      t,
      cents: voiced ? sung.cents + wander(t) : 0,
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

/** The two clocks of the demo kit, here one and the same. */
const ONE_CLOCK = {
  engineAt: (wall: number): number => wall,
  wallAt: (engine: number): number => engine,
} as const

function buildTake(
  id: DemoTakeId,
  call: DemoCall,
  sung: SungTake,
  seed: number,
): EchoDemoTake {
  const length = eventAt(sung.events, 'phraseEnd')
  // The voice runs to its own end, which may come after the phrase's.
  const voiceLength = Math.max(length, voiceEnds(sung.segments) + VOICE_STEP)
  return {
    id,
    root: call.phrase.root,
    phrase: call.phrase,
    call: call.notes,
    callEnd: call.end,
    rules: DEMO_RULES,
    frames: sung.frames,
    events: sung.events,
    fast: [],
    ...ONE_CLOCK,
    voice: voiceFor(sung.segments, seed, voiceLength),
    length,
  }
}

const OFF_SEED = 0xec40
const ON_SEED = 0xec41

/** The phrase's notes above the root, cents. */
const centsOf = (call: DemoCall): number[] =>
  call.phrase.notes.map((note) => (note.midi - call.phrase.root) * 100)

/** Where both takes' first note ends: the response's first beat. */
const firstEnds = (call: DemoCall): number =>
  call.end + RESPONSE_GATE_SECONDS + ON_TIME_AFTER + ECHO_NOTE_SECONDS

/**
 * Take 1: in over Merc's last note on the root, held into the response
 * (the first note lands), on to the second note 65 cents flat and held
 * there, then on to the third, which lands: the second misses as it does
 * (skipped), and the phrase ends.
 */
function offTake(root: number): EchoDemoTake {
  const call = demoCall(root)
  const [first, second, third] = centsOf(call)
  const script = heldLine(
    call.end - EARLY_BY,
    -40,
    firstEnds(call),
    [first, second + FLAT_CENTS, third],
    [FLAT_NOTES, 1],
  )
  return buildTake('off', call, singTake(script, call, OFF_SEED), OFF_SEED)
}

/**
 * Take 2: in once the call has ended, and every note held as long as Merc
 * held it, each landing on the way.
 */
function onTake(root: number): EchoDemoTake {
  const call = demoCall(root)
  const comesIn = call.end + RESPONSE_GATE_SECONDS + ON_TIME_AFTER
  const script = heldLine(comesIn, -30, firstEnds(call), centsOf(call), [1, 1])
  const sung = singTake(script, call, ON_SEED)
  const end = eventAt(sung.events, 'phraseEnd')
  const events = [
    ...sung.events,
    { type: 'result' as const, at: end + RESULT_AFTER },
  ]
  return buildTake('on', call, { ...sung, events }, ON_SEED)
}

/** One of Merc's takes on a root. */
export function demoTake(id: DemoTakeId, root: number): EchoDemoTake {
  return id === 'off' ? offTake(root) : onTake(root)
}
