// ============================================================
// The Leap demo's script: Merc's two takes, frame by frame
// ============================================================
//
// "How it works" for Leap: Merc sings his note, then sings the leap back
// himself, twice, through the room's own engine.
//
//   take 1, not like this   his note sung back, then a leap that falls
//                           short, 70 cents under the target, held there
//                           and let go: the lantern stays dark, the turn
//                           ends on the silence after it, and Merc sings
//                           both notes, his line drawn as he does
//   take 2, like this       his note sung back, then the leap into the
//                           band of light, held: the lantern lights
//
// Merc sings at one level, Singer, whatever the singer picked: the level a
// first visit starts at, where he sings his note alone and the singer
// finds the second by ear. The leap is a fifth up, the one that opens
// Twinkle, Twinkle, its middle on the middle of the singer's window.
//
// Both takes hold his note a little longer than he sang it, so the
// tooltip that says what comes next can be read before the leap. Nothing
// is played fast: the engine's clock (frame.t) and the screen's and the
// sound's are the same (the demo kit's ONE_CLOCK).
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
import { createSequenceState, RESPONSE_GATE_SECONDS, tickSequence, } from '@/lib/sequence/sequence-engine'
import type { ExerciseLevel } from '@/stores/exercise-level'
import { leapOutcome, leapPhrase, mercNotes } from '../leap-phrase'
import type { LeapRound } from '../leap-round'
import { AUDIBLE_HIGH, AUDIBLE_LOW } from '../leap-round'
import type { LeapKind, LeapLevel } from '../leap-rules'
import { LEAP_LEVELS, SOUND_LEAD_SECONDS, VOICE_TAIL_SECONDS, } from '../leap-rules'
import type { LeapDemoMark } from '../scripted-take'

export type { DemoTakeId, LeapDemoMark }

export type DemoEvent = KitDemoEvent<LeapDemoMark>

/** The level Merc sings at, whatever the singer's own. */
export const DEMO_LEVEL: ExerciseLevel = 'singer'

export const DEMO_RULES: LeapLevel = LEAP_LEVELS[DEMO_LEVEL]

/** The leap: a fifth up, Twinkle, Twinkle's. */
export const DEMO_LEAP: LeapKind = { size: 7, up: true }

/** Merc's call starts this long after the take's clock reads zero, s. */
export const CALL_AT = 0.1

/** The vibrato both the frames and the synth carry on Merc's takes. */
export const DEMO_VIBRATO = {
  hz: 5.5,
  /** Half the swing: the pitch moves this far either side. */
  cents: 10,
  /** Seconds after each onset for the vibrato to grow in. */
  rampSec: 0.3,
} as const

/** How far under the target take 1's leap falls, cents: well out of the band. */
export const SHORT_CENTS = -70

/** Both takes come in this long after the turn opens, s. */
const COMES_IN_AFTER = 0.05
/** His note, sung back, held this long, s. */
const FROM_SECONDS = 1.7
/** The leap itself: the glide from his note to the far ledge, s. */
const LEAP_SECONDS = 0.2
/** Take 1 holds its short note this long before letting go, s. */
const SHORT_HOLD = 1.1
/** Take 2 holds the target this long: well past its landing, s. */
const TARGET_HOLD = 1
/** Frames kept past the leap's outcome. */
const TAIL = 0.1
/** The longest a take may run before its leap must be decided, s. */
const LONGEST_TAKE = 30

/** The demo's leap on the room's note: its middle on the note. */
export function demoRound(note: number): LeapRound {
  const from = Math.min(
    AUDIBLE_HIGH - DEMO_LEAP.size,
    Math.max(AUDIBLE_LOW, Math.round(note) - 3),
  )
  return { index: 0, kind: DEMO_LEAP, from, to: from + DEMO_LEAP.size }
}

/** Merc's call on the take's clock: his note alone, at Singer. */
export function demoCall(round: LeapRound): PhraseNote[] {
  return mercNotes(round, DEMO_RULES.mercSingsBoth).map((note) => ({
    ...note,
    at: CALL_AT + note.at,
  }))
}

/**
 * When the engine starts listening, take clock: his last note's end, its
 * tail through the speaker and the gate after it, as a run's call has it.
 */
export function responseStartOf(call: readonly PhraseNote[]): number {
  const end = Math.max(...call.map((note) => note.at + note.seconds))
  return end + VOICE_TAIL_SECONDS + RESPONSE_GATE_SECONDS
}

/**
 * Merc's answer after a miss, on the take's clock: both notes, from as
 * soon after the miss as a run's answer starts.
 */
export function demoAnswer(round: LeapRound, missAt: number): PhraseNote[] {
  return mercNotes(round, true).map((note) => ({
    ...note,
    at: missAt + SOUND_LEAD_SECONDS + note.at,
  }))
}

/**
 * His note sung back from `comesIn`, then the leap to `cents` over it,
 * held `hold` s and let go (the synth gives it its release).
 */
function leapLine(comesIn: number, cents: number, hold: number): Segment[] {
  const leaves = comesIn + FROM_SECONDS
  const lands = leaves + LEAP_SECONDS
  return [
    { kind: 'rest', until: comesIn },
    { kind: 'sing', until: comesIn + 0.1, cents: [-30, 0], level: [0.5, 0.8] },
    { kind: 'sing', until: leaves, cents: [0, 0], level: [0.8, 0.8] },
    { kind: 'sing', until: lands, cents: [0, cents], level: [0.8, 0.8] },
    {
      kind: 'sing',
      until: lands + hold,
      cents: [cents, cents],
      level: [0.8, 0.8],
    },
    { kind: 'rest', until: Number.POSITIVE_INFINITY },
  ]
}

/** The engine's event as the demo names it. */
function markOf(event: SequenceEvent): LeapDemoMark {
  return event.type === 'phraseEnd'
    ? 'phraseEnd'
    : `${event.type}:${event.index}`
}

interface SungTake {
  readonly frames: readonly PitchFrame[]
  readonly events: readonly DemoEvent[]
  /** When the leap was decided: its landing or its miss, take clock. */
  readonly outcomeAt: number
  readonly landed: boolean
}

/** The leap decided, take clock: landed or missed. */
interface Decided {
  readonly at: number
  readonly landed: boolean
}

/** What one frame set off, and the leap if that frame decided it. */
interface Heard {
  readonly events: readonly DemoEvent[]
  readonly decided: Decided | null
}

/** The turn as the controller hears it: the voice heard, nothing else. */
const HEARD = { voiced: true, heardAgain: false } as const

/**
 * The room's ears on one take, exactly as the controller hears it: each
 * frame from the turn's start ticked through the sequence engine, the leap
 * decided on its target's event (or the turn's end), and nothing heard of
 * that frame after it.
 */
function roomEars(
  round: LeapRound,
  responseStart: number,
): (frame: PitchFrame) => Heard {
  const phrase = leapPhrase(round)
  let engine = createSequenceState(responseStart)
  return (frame) => {
    const events: DemoEvent[] = []
    if (frame.t < responseStart) return { events, decided: null }
    engine = tickSequence(engine, frame, phrase, DEMO_RULES)
    for (const event of engine.events) {
      events.push({ type: markOf(event), at: frame.t })
      const target = event.type === 'phraseEnd' || event.index === 1
      const outcome = target ? leapOutcome(engine, round, HEARD) : null
      if (outcome !== null) {
        events.push({ type: 'outcome', at: frame.t })
        return { events, decided: { at: frame.t, landed: outcome.landed } }
      }
    }
    return { events, decided: null }
  }
}

/**
 * A take sung through the room's ears in one pass, its frames running on
 * TAIL past the moment the leap was decided.
 */
function singTake(
  round: LeapRound,
  segments: readonly Segment[],
  responseStart: number,
  seed: number,
): SungTake {
  const frameAt = segmentTracker(round.from, seed, DEMO_VIBRATO)
  const hear = roomEars(round, responseStart)
  const frames: PitchFrame[] = []
  const events: DemoEvent[] = [{ type: 'call', at: CALL_AT }]
  let decided: Decided | null = null
  for (let i = 0; ; i++) {
    const t = i * FRAME_SECONDS
    if (decided !== null && t > decided.at + TAIL + 1e-9) break
    if (t > LONGEST_TAKE) throw new Error('Leap demo: a take never ends')
    const frame = frameAt(segments, t)
    frames.push(frame)
    if (decided !== null) continue
    const heard = hear(frame)
    events.push(...heard.events)
    decided = heard.decided
  }
  return { frames, events, outcomeAt: decided.at, landed: decided.landed }
}

/** Where the voice stops for good: the last sung segment's end. */
function voiceEnds(segments: readonly Segment[]): number {
  let end = 0
  for (const segment of segments) {
    if (segment.kind === 'sing') end = segment.until
  }
  return end
}

/** One of Merc's takes on the leap (the demo kit's shape, demo-plan.ts). */
export interface LeapDemoTake extends DemoTakeShape<LeapDemoMark> {
  readonly round: LeapRound
  /** Merc's call on the take's clock. */
  readonly call: readonly PhraseNote[]
  /** When the engine starts listening, take clock. */
  readonly responseStart: number
  /** Merc's answer after take 1's miss; none for take 2. */
  readonly answer: readonly PhraseNote[]
  /** The leap landed: take 2's does, take 1's misses. */
  readonly landed: boolean
  /** The rules it was sung under: DEMO_LEVEL's. */
  readonly rules: LeapLevel
}

const OFF_SEED = 0x1ea0
const ON_SEED = 0x1ea1

/** One of Merc's takes on the room's note. */
export function demoTake(id: DemoTakeId, note: number): LeapDemoTake {
  const round = demoRound(note)
  const call = demoCall(round)
  const responseStart = responseStartOf(call)
  const comesIn = responseStart + COMES_IN_AFTER
  const leap = DEMO_LEAP.size * 100
  const segments =
    id === 'off'
      ? leapLine(comesIn, leap + SHORT_CENTS, SHORT_HOLD)
      : leapLine(comesIn, leap, TARGET_HOLD)
  const seed = id === 'off' ? OFF_SEED : ON_SEED
  const sung = singTake(round, segments, responseStart, seed)
  const length = eventAt(sung.events, 'outcome', 'Leap')
  // Merc's answer, and the voice's own end, may come after the outcome.
  const answer = sung.landed ? [] : demoAnswer(round, sung.outcomeAt)
  const voiceLength = Math.max(length, voiceEnds(segments) + VOICE_STEP)
  return {
    id,
    round,
    call,
    responseStart,
    answer,
    landed: sung.landed,
    rules: DEMO_RULES,
    frames: sung.frames,
    events: sung.events,
    fast: [],
    ...ONE_CLOCK,
    voice: segmentVoice(segments, seed, voiceLength, ONE_CLOCK.engineAt),
    length,
  }
}
