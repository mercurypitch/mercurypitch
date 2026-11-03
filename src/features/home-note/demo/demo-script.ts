// ============================================================
// The Home note demo's script: Merc's two takes, frame by frame
// ============================================================
//
// "How it works" for Home note: the band plays its intro, then the voice
// sings the note it calls home, twice, through the room's own engine.
//
//   take 1, not like this   the fifth under home, the note the last chord
//                           leans on, held and let go: the lamp stays
//                           dark, the turn ends on the silence after it,
//                           and Merc sings home over home's chord
//   take 2, like this       home itself, scooped into and held in the band
//                           of light: the lamp lights, and home's chord
//                           plays under the voice
//
// Merc sings at one level, Singer, whatever the singer picked: the level a
// first visit starts at, where the band plays I IV V and stops on the chord
// that pulls home, and no one sings home first. The key is the middle of
// the singer's window, so home sits where the voice sings.
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
import type { Phrase, PhraseNote, SequenceEvent, } from '@/lib/sequence/sequence-engine'
import { createSequenceState, RESPONSE_GATE_SECONDS, tickSequence, } from '@/lib/sequence/sequence-engine'
import type { ExerciseLevel } from '@/stores/exercise-level'
import { ANSWER_DELAY, BAND_TAIL_SECONDS } from '../home-note-band'
import type { HomeRound } from '../home-note-round'
import { AUDIBLE_HIGH, AUDIBLE_LOW } from '../home-note-round'
import type { HomeNoteLevel } from '../home-note-rules'
import { CHORD_SECONDS, HOME_NOTE_LEVELS, MERC_HOME_SECONDS, SOUND_LEAD_SECONDS, } from '../home-note-rules'
import type { HomeNoteDemoMark } from '../scripted-take'

export type { DemoTakeId, HomeNoteDemoMark }

export type DemoEvent = KitDemoEvent<HomeNoteDemoMark>

/** The level Merc sings at, whatever the singer's own. */
export const DEMO_LEVEL: ExerciseLevel = 'singer'

export const DEMO_RULES: HomeNoteLevel = HOME_NOTE_LEVELS[DEMO_LEVEL]

/** The band's first chord, this long after the take's clock reads zero, s. */
export const INTRO_AT = 0.1

/** The vibrato both the frames and the synth carry on the takes. */
export const DEMO_VIBRATO = {
  hz: 5.5,
  /** Half the swing: the pitch moves this far either side. */
  cents: 10,
  /** Seconds after each onset for the vibrato to grow in. */
  rampSec: 0.3,
} as const

/**
 * Take 1's note, cents off home: the fifth under it, the root of the
 * chord the intro stops on. Folded to home's octave it is still a fourth
 * away, well out of the band.
 */
export const FIFTH_CENTS = -500

/** Both takes come in this long after the turn opens, s. */
const COMES_IN_AFTER = 0.05
/** The scoop into the note, s. */
const SCOOP_SECONDS = 0.12
/** Take 1 holds the fifth this long before letting go, s. */
const FIFTH_HOLD = 1.9
/** Take 2 holds home this long: well past its landing, s. */
const HOME_HOLD = 1.3
/** Frames kept past the round's outcome. */
const TAIL = 0.1
/** The longest a take may run before its round must be decided, s. */
const LONGEST_TAKE = 30

/** The demo's key on the room's note: home on it, where a phone carries it. */
export function demoRound(note: number): HomeRound {
  const home = Math.min(AUDIBLE_HIGH, Math.max(AUDIBLE_LOW, Math.round(note)))
  return { index: 0, home }
}

/** The intro's chords end, take clock: the last chord's close, its tail too. */
export function introEnd(rules: HomeNoteLevel = DEMO_RULES): number {
  return INTRO_AT + rules.intro.length * CHORD_SECONDS + BAND_TAIL_SECONDS
}

/**
 * When the engine starts listening, take clock: the intro's end, its tail
 * through the speaker and the gate after it, as a run's round has it.
 */
export function responseStartOf(rules: HomeNoteLevel = DEMO_RULES): number {
  return introEnd(rules) + RESPONSE_GATE_SECONDS
}

/** Home's chord at the outcome, take clock: as soon after it as a run's. */
export function resolveAtOf(outcomeAt: number): number {
  return outcomeAt + SOUND_LEAD_SECONDS
}

/** Merc singing home over home's chord, after a miss, take clock. */
export function demoAnswer(round: HomeRound, outcomeAt: number): PhraseNote[] {
  return [
    {
      midi: round.home,
      at: resolveAtOf(outcomeAt) + ANSWER_DELAY,
      seconds: MERC_HOME_SECONDS,
    },
  ]
}

/** The round as the engine hears it: home, one note (the controller's). */
export function homePhrase(round: HomeRound): Phrase {
  return { notes: [{ midi: round.home, at: 0, seconds: MERC_HOME_SECONDS }] }
}

/** A note `cents` off home, scooped into from under it, held `hold` s and let go. */
function sungLine(comesIn: number, cents: number, hold: number): Segment[] {
  const settled = comesIn + SCOOP_SECONDS
  return [
    { kind: 'rest', until: comesIn },
    {
      kind: 'sing',
      until: settled,
      cents: [cents - 50, cents],
      level: [0.5, 0.8],
    },
    {
      kind: 'sing',
      until: settled + hold,
      cents: [cents, cents],
      level: [0.8, 0.8],
    },
    { kind: 'rest', until: Number.POSITIVE_INFINITY },
  ]
}

/** The engine's event as the demo names it. */
function markOf(event: SequenceEvent): HomeNoteDemoMark {
  return event.type === 'phraseEnd'
    ? 'phraseEnd'
    : `${event.type}:${event.index}`
}

interface SungTake {
  readonly frames: readonly PitchFrame[]
  readonly events: readonly DemoEvent[]
  /** When the round was decided: its landing or its miss, take clock. */
  readonly outcomeAt: number
  readonly landed: boolean
}

/** The round decided, take clock: landed or missed. */
interface Decided {
  readonly at: number
  readonly landed: boolean
}

/** What one frame set off, and the round if that frame decided it. */
interface Heard {
  readonly events: readonly DemoEvent[]
  readonly decided: Decided | null
}

/**
 * The room's ears on one take, exactly as the controller hears it: each
 * frame from the turn's start ticked through the sequence engine, the
 * round decided on home's event, and nothing heard of that frame after
 * it.
 */
function roomEars(
  round: HomeRound,
  responseStart: number,
): (frame: PitchFrame) => Heard {
  const phrase = homePhrase(round)
  let engine = createSequenceState(responseStart)
  return (frame) => {
    const events: DemoEvent[] = []
    if (frame.t < responseStart) return { events, decided: null }
    engine = tickSequence(engine, frame, phrase, DEMO_RULES)
    for (const event of engine.events) {
      events.push({ type: markOf(event), at: frame.t })
      if (event.type === 'phraseEnd') continue
      const outcome = engine.outcomes[event.index]
      if (outcome !== undefined) {
        events.push({ type: 'outcome', at: frame.t })
        return { events, decided: { at: frame.t, landed: outcome.landed } }
      }
    }
    return { events, decided: null }
  }
}

/**
 * A take sung through the room's ears in one pass, its frames running on
 * TAIL past the moment the round was decided.
 */
function singTake(
  round: HomeRound,
  segments: readonly Segment[],
  responseStart: number,
  seed: number,
): SungTake {
  const frameAt = segmentTracker(round.home, seed, DEMO_VIBRATO)
  const hear = roomEars(round, responseStart)
  const frames: PitchFrame[] = []
  const events: DemoEvent[] = [
    { type: 'band', at: INTRO_AT },
    { type: 'turn', at: responseStart },
  ]
  let decided: Decided | null = null
  for (let i = 0; ; i++) {
    const t = i * FRAME_SECONDS
    if (decided !== null && t > decided.at + TAIL + 1e-9) break
    if (t > LONGEST_TAKE) throw new Error('Home note demo: a take never ends')
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

/** One of Merc's takes on the key (the demo kit's shape, demo-plan.ts). */
export interface HomeNoteDemoTake extends DemoTakeShape<HomeNoteDemoMark> {
  readonly round: HomeRound
  /** The band's first chord, take clock. */
  readonly introAt: number
  /** When the engine starts listening, take clock. */
  readonly responseStart: number
  /** Home's chord at the outcome, take clock. */
  readonly resolveAt: number
  /** Merc singing home after take 1's miss; none for take 2. */
  readonly answer: readonly PhraseNote[]
  /** Home was found: take 2's is, take 1's is not. */
  readonly landed: boolean
  /** The rules it was sung under: DEMO_LEVEL's. */
  readonly rules: HomeNoteLevel
}

const OFF_SEED = 0x40e0
const ON_SEED = 0x40e1

/** One of Merc's takes on the room's note. */
export function demoTake(id: DemoTakeId, note: number): HomeNoteDemoTake {
  const round = demoRound(note)
  const responseStart = responseStartOf()
  const comesIn = responseStart + COMES_IN_AFTER
  const segments =
    id === 'off'
      ? sungLine(comesIn, FIFTH_CENTS, FIFTH_HOLD)
      : sungLine(comesIn, 0, HOME_HOLD)
  const seed = id === 'off' ? OFF_SEED : ON_SEED
  const sung = singTake(round, segments, responseStart, seed)
  const length = eventAt(sung.events, 'outcome', 'Home note')
  // Merc's answer, and the voice's own end, may come after the outcome.
  const answer = sung.landed ? [] : demoAnswer(round, sung.outcomeAt)
  const voiceLength = Math.max(length, voiceEnds(segments) + VOICE_STEP)
  return {
    id,
    round,
    introAt: INTRO_AT,
    responseStart,
    resolveAt: resolveAtOf(sung.outcomeAt),
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
