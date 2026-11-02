// ============================================================
// The Harmony demo's script: two takes of one line, frame by frame
// ============================================================
//
// "How it works" for Harmony: Merc sings his line, then a voice sings the
// harmony back after him, twice, through the room's own engine.
//
//   take 1, not like this   the first note a third above his, then his own
//                           second note instead of the third over it, held
//                           and let go: that gold lamp stays dark, the turn
//                           ends on the silence after it, and Merc sings
//                           his note, then the third from it, the pair
//                           drawn as he does
//   take 2, like this       every note a third above his, each held: every
//                           gold lamp lights
//
// Singing the tune instead of the part is the first thing harmony asks a
// singer not to do, so it is the miss the demo shows.
//
// The line is sung at one level, Singer, whatever the singer picked: the
// level a first visit starts at, where Merc sings his line alone and the
// gold lamps show where the harmony goes. It is three notes up by step
// from the key's fifth, G A B under B C D in C, the harmony's middle note
// on the middle of the singer's window, sung taking turns, the way the
// room opens on.
//
// Nothing is played fast: the engine's clock (frame.t) and the screen's
// and the sound's are the same (the demo kit's ONE_CLOCK).
//
// Pure and seeded: the same note always gives the same frames, events and
// timings. The room plays these frames through its engine (the controller's
// scripted take, scripted-take.ts), so every tooltip is cued by a moment
// that really happened there, and the tests replay the same frames through
// tickSequence to prove what each tooltip says.

import type { DemoEvent as KitDemoEvent, DemoTakeId, DemoTakeShape, } from '@/components/demo-kit/demo-plan'
import { ONE_CLOCK } from '@/components/demo-kit/demo-plan'
import type { DemoSegment as Segment } from '@/components/demo-kit/demo-segments'
import { eventAt, segmentTracker, segmentVoice, } from '@/components/demo-kit/demo-segments'
import { FRAME_SECONDS, VOICE_STEP } from '@/components/demo-kit/demo-voice'
import type { PitchFrame } from '@/lib/pitch-f0-stream'
import type { PhraseNote, SequenceEvent } from '@/lib/sequence/sequence-engine'
import { callSeconds, createSequenceState, RESPONSE_GATE_SECONDS, tickSequence, } from '@/lib/sequence/sequence-engine'
import { SUNG_HIGH, SUNG_LOW } from '@/lib/sequence/sung-window'
import type { ExerciseLevel } from '@/stores/exercise-level'
import type { HarmonyLine } from '../harmony-line'
import { degreeMidi } from '../harmony-line'
import { harmonyPhrase, lineOutcome, mercLine, missedPair, } from '../harmony-phrase'
import type { HarmonyLevel } from '../harmony-rules'
import { HARMONY_LEVELS, SOUND_LEAD_SECONDS, VOICE_TAIL_SECONDS, } from '../harmony-rules'
import type { HarmonyDemoMark } from '../scripted-take'

export type { DemoTakeId, HarmonyDemoMark }

export type DemoEvent = KitDemoEvent<HarmonyDemoMark>

/** The level the demo sings at, whatever the singer's own. */
export const DEMO_LEVEL: ExerciseLevel = 'singer'

export const DEMO_RULES: HarmonyLevel = HARMONY_LEVELS[DEMO_LEVEL]

/** Merc's line, degrees of the key: up by step from its fifth (G A B in C). */
const DEMO_DEGREES = [4, 5, 6] as const
/** The harmony a third above: two degrees of the key over his. */
const THIRD = 2

/** The note take 1 misses: the second, sung on Merc's own note. */
export const MISSED_NOTE = 1

/** Merc's call starts this long after the take's clock reads zero, s. */
export const CALL_AT = 0.1

/** The vibrato both the frames and the synth carry on the takes. */
export const DEMO_VIBRATO = {
  hz: 5.5,
  /** Half the swing: the pitch moves this far either side. */
  cents: 10,
  /** Seconds after each onset for the vibrato to grow in. */
  rampSec: 0.3,
} as const

/** Both takes come in this long after the turn opens, s. */
const COMES_IN_AFTER = 0.05
/** The voice finds its first note over this long, s. */
const ONSET = 0.1
/** Each note of the harmony held this long: well past its landing, s. */
const NOTE_HOLD = 0.9
/** From one note to the next, s. */
const GLIDE = 0.12
/** Take 1 holds Merc's own note this long before letting go, s. */
const UNISON_HOLD = 1
/** Frames kept past the line's outcome. */
const TAIL = 0.1
/** The longest a take may run before its line must be decided, s. */
const LONGEST_TAKE = 30

/** A degree of the key over its tonic, in semitones. */
const over = (degree: number): number => degreeMidi(0, degree)

/**
 * The demo's line on the room's note: the harmony's middle note on it, the
 * harmony held to the band the room sings in.
 */
export function demoLine(note: number): HarmonyLine {
  const middle = over(DEMO_DEGREES[1] + THIRD)
  const lowest = over(DEMO_DEGREES[0] + THIRD)
  const highest = over(DEMO_DEGREES[DEMO_DEGREES.length - 1] + THIRD)
  const tonic = Math.min(
    SUNG_HIGH - highest,
    Math.max(SUNG_LOW - lowest, Math.round(note) - middle),
  )
  return {
    index: 0,
    tonic,
    merc: DEMO_DEGREES.map((degree) => degreeMidi(tonic, degree)),
    harmony: DEMO_DEGREES.map((degree) => degreeMidi(tonic, degree + THIRD)),
    below: false,
  }
}

/** Merc's call on the take's clock: his line alone, at Singer. */
export function demoCall(line: HarmonyLine): PhraseNote[] {
  return mercLine(line, DEMO_RULES).map((note) => ({
    ...note,
    at: CALL_AT + note.at,
  }))
}

/**
 * When the engine starts listening, take clock: his last note's end, its
 * tail through the speaker and the gate after it, as a run's call has it.
 */
export function responseStartOf(call: readonly PhraseNote[]): number {
  return (
    callSeconds({ notes: call }) + VOICE_TAIL_SECONDS + RESPONSE_GATE_SECONDS
  )
}

/**
 * Merc's answer after take 1's miss, on the take's clock: his note, then
 * the third from it, from as soon after the miss as a run's answer starts.
 */
export function demoAnswer(line: HarmonyLine, missAt: number): PhraseNote[] {
  return missedPair(line, MISSED_NOTE).map((note) => ({
    ...note,
    at: missAt + SOUND_LEAD_SECONDS + note.at,
  }))
}

/** A voice that finds its first note from a little under it. */
function onset(comesIn: number, cents: number): Segment[] {
  return [
    { kind: 'rest', until: comesIn },
    {
      kind: 'sing',
      until: comesIn + ONSET,
      cents: [cents - 30, cents],
      level: [0.5, 0.8],
    },
  ]
}

/** From `from` to `to` cents and held there `hold` s, ending at the returned time. */
function stepTo(
  segments: Segment[],
  start: number,
  from: number,
  to: number,
  hold: number,
): number {
  const lands = start + GLIDE
  segments.push(
    { kind: 'sing', until: lands, cents: [from, to], level: [0.8, 0.8] },
    { kind: 'sing', until: lands + hold, cents: [to, to], level: [0.8, 0.8] },
  )
  return lands + hold
}

/** Take 2: every note of the harmony, held, then let go. */
function harmonySegments(line: HarmonyLine, comesIn: number): Segment[] {
  const base = line.harmony[0]
  const cents = line.harmony.map((midi) => (midi - base) * 100)
  const segments = onset(comesIn, 0)
  let t = comesIn + ONSET
  segments.push({
    kind: 'sing',
    until: t + NOTE_HOLD,
    cents: [0, 0],
    level: [0.8, 0.8],
  })
  t += NOTE_HOLD
  for (let i = 1; i < cents.length; i++) {
    t = stepTo(segments, t, cents[i - 1], cents[i], NOTE_HOLD)
  }
  segments.push({ kind: 'rest', until: Number.POSITIVE_INFINITY })
  return segments
}

/** Take 1: the first note, then Merc's own second note, held, then let go. */
function unisonSegments(line: HarmonyLine, comesIn: number): Segment[] {
  const base = line.harmony[0]
  const his = (line.merc[MISSED_NOTE] - base) * 100
  const segments = onset(comesIn, 0)
  const leaves = comesIn + ONSET + NOTE_HOLD
  segments.push({
    kind: 'sing',
    until: leaves,
    cents: [0, 0],
    level: [0.8, 0.8],
  })
  stepTo(segments, leaves, 0, his, UNISON_HOLD)
  segments.push({ kind: 'rest', until: Number.POSITIVE_INFINITY })
  return segments
}

/** The engine's event as the demo names it. */
function markOf(event: SequenceEvent): HarmonyDemoMark {
  return event.type === 'phraseEnd'
    ? 'phraseEnd'
    : `${event.type}:${event.index}`
}

interface SungTake {
  readonly frames: readonly PitchFrame[]
  readonly events: readonly DemoEvent[]
  /** When the line was decided, take clock. */
  readonly outcomeAt: number
  readonly inHarmony: boolean
}

/** The line decided, take clock: in harmony or not. */
interface Decided {
  readonly at: number
  readonly inHarmony: boolean
}

/** What one frame set off, and the line if that frame decided it. */
interface Heard {
  readonly events: readonly DemoEvent[]
  readonly decided: Decided | null
}

/** The turn as the controller hears it: the voice heard, nothing else. */
const HEARD = { voiced: true, heardAgain: false } as const

/**
 * The room's ears on one take, exactly as the controller hears it: each
 * frame from the turn's start ticked through the sequence engine, its
 * events marked, the line decided once every note is, and nothing heard of
 * that frame after it.
 */
function roomEars(
  line: HarmonyLine,
  responseStart: number,
): (frame: PitchFrame) => Heard {
  const phrase = harmonyPhrase(line, DEMO_RULES)
  let engine = createSequenceState(responseStart)
  return (frame) => {
    const events: DemoEvent[] = []
    if (frame.t < responseStart) return { events, decided: null }
    engine = tickSequence(engine, frame, phrase, DEMO_RULES)
    for (const event of engine.events) {
      events.push({ type: markOf(event), at: frame.t })
    }
    const outcome = lineOutcome(engine, line, HEARD)
    if (outcome === null) return { events, decided: null }
    events.push({ type: 'outcome', at: frame.t })
    return { events, decided: { at: frame.t, inHarmony: outcome.inHarmony } }
  }
}

/**
 * A take sung through the room's ears in one pass, its frames running on
 * TAIL past the moment the line was decided.
 */
function singTake(
  line: HarmonyLine,
  segments: readonly Segment[],
  responseStart: number,
  seed: number,
): SungTake {
  const frameAt = segmentTracker(line.harmony[0], seed, DEMO_VIBRATO)
  const hear = roomEars(line, responseStart)
  const frames: PitchFrame[] = []
  const events: DemoEvent[] = [{ type: 'call', at: CALL_AT }]
  let decided: Decided | null = null
  for (let i = 0; ; i++) {
    const t = i * FRAME_SECONDS
    if (decided !== null && t > decided.at + TAIL + 1e-9) break
    if (t > LONGEST_TAKE) throw new Error('Harmony demo: a take never ends')
    const frame = frameAt(segments, t)
    frames.push(frame)
    if (decided !== null) continue
    const heard = hear(frame)
    events.push(...heard.events)
    decided = heard.decided
  }
  return {
    frames,
    events,
    outcomeAt: decided.at,
    inHarmony: decided.inHarmony,
  }
}

/** Where the voice stops for good: the last sung segment's end. */
function voiceEnds(segments: readonly Segment[]): number {
  let end = 0
  for (const segment of segments) {
    if (segment.kind === 'sing') end = segment.until
  }
  return end
}

/** One of the demo's takes on the line (the demo kit's shape, demo-plan.ts). */
export interface HarmonyDemoTake extends DemoTakeShape<HarmonyDemoMark> {
  readonly line: HarmonyLine
  /** Merc's call on the take's clock. */
  readonly call: readonly PhraseNote[]
  /** When the engine starts listening, take clock. */
  readonly responseStart: number
  /** Merc's pair after take 1's miss; none for take 2. */
  readonly answer: readonly PhraseNote[]
  /** The line sung in harmony: take 2's is, take 1's misses a note. */
  readonly inHarmony: boolean
  /** The rules it was sung under: DEMO_LEVEL's. */
  readonly rules: HarmonyLevel
}

const OFF_SEED = 0x4a20
const ON_SEED = 0x4a21

/** One of the demo's takes on the room's note. */
export function demoTake(id: DemoTakeId, note: number): HarmonyDemoTake {
  const line = demoLine(note)
  const call = demoCall(line)
  const responseStart = responseStartOf(call)
  const comesIn = responseStart + COMES_IN_AFTER
  const segments =
    id === 'off'
      ? unisonSegments(line, comesIn)
      : harmonySegments(line, comesIn)
  const seed = id === 'off' ? OFF_SEED : ON_SEED
  const sung = singTake(line, segments, responseStart, seed)
  const length = eventAt(sung.events, 'outcome', 'Harmony')
  // Merc's pair, and the voice's own end, may come after the outcome.
  const answer = sung.inHarmony ? [] : demoAnswer(line, sung.outcomeAt)
  const voiceLength = Math.max(length, voiceEnds(segments) + VOICE_STEP)
  return {
    id,
    line,
    call,
    responseStart,
    answer,
    inHarmony: sung.inHarmony,
    rules: DEMO_RULES,
    frames: sung.frames,
    events: sung.events,
    fast: [],
    ...ONE_CLOCK,
    voice: segmentVoice(segments, seed, voiceLength, ONE_CLOCK.engineAt),
    length,
  }
}
