// ============================================================
// The First note demo's script: Merc's two takes, frame by frame
// ============================================================
//
// "How it works" for First note: a song's band plays up to where its
// singer comes in, and the voice comes in, twice, through the room's own
// engine and its own ear for the entry.
//
//   take 1, not like this   a step under the singer's first note, held and
//                           let go: the entry comes in low, the line stays
//                           unlit, the turn ends on the silence after it,
//                           and Merc sings the note
//   take 2, like this       the singer's first note itself, scooped into
//                           and held in the band of light: the entry comes
//                           in on the note, and the line lands
//
// The song is Josephine (Josh Woodward, CC BY 4.0), its first entry: the
// band's eight seconds of lead-in ship as a clip (demo-band-josephine.mp3),
// cut from the example's own band at the entry's `from` to its `at`, so the
// demo plays it on the room's audio clock, offline on a first visit, as the
// takes' frames and the countdown run on the same clock. Merc sings at one
// level, Singer, whatever the singer picked: the level a first visit starts
// at, where the line shows only once the singer has come in.
//
// Nothing is played fast: the engine's clock (frame.t) and the screen's
// and the sound's are the same (the demo kit's ONE_CLOCK).
//
// Pure and seeded: the same frames, events and timings every time. The
// room plays these frames through its engine (the controller's scripted
// take, scripted-take.ts), so every tooltip is cued by a moment that really
// happened there, and the tests replay the same frames to prove what each
// tooltip says.

import type { DemoEvent as KitDemoEvent, DemoTakeId, DemoTakeShape, } from '@/components/demo-kit/demo-plan'
import { ONE_CLOCK } from '@/components/demo-kit/demo-plan'
import type { DemoSegment as Segment } from '@/components/demo-kit/demo-segments'
import { eventAt, segmentTracker, segmentVoice, } from '@/components/demo-kit/demo-segments'
import { FRAME_SECONDS, VOICE_STEP } from '@/components/demo-kit/demo-voice'
import type { PitchPoint } from '@/lib/hold/hold-reading'
import { offTarget } from '@/lib/hold/hold-reading'
import type { PitchFrame } from '@/lib/pitch-f0-stream'
import type { PhraseNote, SequenceEvent } from '@/lib/sequence/sequence-engine'
import { createSequenceState, RESPONSE_GATE_SECONDS, tickSequence, } from '@/lib/sequence/sequence-engine'
import type { ExerciseLevel } from '@/stores/exercise-level'
import { entryHeardIn, entryPhrase } from '../first-note-ears'
import type { EntryHeard } from '../first-note-machine'
import type { FirstNoteLevel } from '../first-note-rules'
import { FIRST_NOTE_LEVELS, MERC_NOTE_SECONDS } from '../first-note-rules'
import type { FirstNoteEntry, FirstNoteRound, FirstNoteSong, } from '../first-note-songs'
import { entryPitch, FIRST_NOTE_SONGS, LINE_SHARES } from '../first-note-songs'
import type { FirstNoteDemoMark } from '../scripted-take'

export type { DemoTakeId, FirstNoteDemoMark }

export type DemoEvent = KitDemoEvent<FirstNoteDemoMark>

/** The level Merc sings at, whatever the singer's own. */
export const DEMO_LEVEL: ExerciseLevel = 'singer'

export const DEMO_RULES: FirstNoteLevel = FIRST_NOTE_LEVELS[DEMO_LEVEL]

/** The demo's song: the example its clip is cut from. */
export const DEMO_SLUG = 'josephine'

/** The band's lead-in starts this long after the take's clock reads zero, s. */
export const INTRO_AT = 0.1

/** The vibrato both the frames and the synth carry on the takes. */
export const DEMO_VIBRATO = {
  hz: 5.5,
  /** Half the swing: the pitch moves this far either side. */
  cents: 10,
  /** Seconds after each onset for the vibrato to grow in. */
  rampSec: 0.3,
} as const

/** Take 1's note, cents off the singer's first note: a whole step under it. */
export const STEP_UNDER_CENTS = -200

/** Merc comes in this long after the round is decided, as a run's does, s. */
const ANSWER_AFTER = 0.1
/** Both takes come in this long after the turn opens, s. */
const COMES_IN_AFTER = 0.05
/** The scoop into the note, s. */
const SCOOP_SECONDS = 0.12
/** Take 1 holds its note this long before letting go, s. */
const STEP_HOLD = 1.9
/** Take 2 holds the note this long: well past its landing, s. */
const NOTE_HOLD = 1.3
/** Frames kept past the round's outcome. */
const TAIL = 0.1
/** The longest a take may run before its round must be decided, s. */
const LONGEST_TAKE = 40

function demoSong(): FirstNoteSong {
  const song = FIRST_NOTE_SONGS.find((s) => s.slug === DEMO_SLUG)
  if (song === undefined) throw new Error('First note demo: no Josephine')
  return song
}

/** The demo's entry: the song's first, the one its clip leads in to. */
export function demoEntry(): FirstNoteEntry {
  const entry = demoSong().entries[0]
  if (entry === undefined) throw new Error('First note demo: no entry')
  return entry
}

/** The demo's one round: the song's first entry, its line low on the stage. */
export function demoRound(): FirstNoteRound {
  return {
    index: 0,
    song: demoSong(),
    entry: demoEntry(),
    lineShare: LINE_SHARES.low,
  }
}

/** The band's lead-in, s: the clip, from the entry's `from` to its `at`. */
export function leadInSeconds(entry: FirstNoteEntry = demoEntry()): number {
  return entry.at - entry.from
}

/** The band stops where the singer comes in: the turn, take clock. */
export function turnAtOf(entry: FirstNoteEntry = demoEntry()): number {
  return INTRO_AT + leadInSeconds(entry)
}

/**
 * When the engine starts listening, take clock: the turn, and the gate
 * after it for the band's tail through the speaker, as a run's turn has it.
 */
export function responseStartOf(entry: FirstNoteEntry = demoEntry()): number {
  return turnAtOf(entry) + RESPONSE_GATE_SECONDS
}

/** Merc singing the note after a miss, take clock, as a run's comes. */
export function demoAnswer(
  round: FirstNoteRound,
  outcomeAt: number,
): PhraseNote[] {
  return [
    {
      midi: entryPitch(round.entry),
      at: outcomeAt + ANSWER_AFTER,
      seconds: MERC_NOTE_SECONDS,
    },
  ]
}

/** A note `cents` off the singer's, scooped into from under it, held `hold` s and let go. */
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
function markOf(event: SequenceEvent): FirstNoteDemoMark {
  return event.type === 'phraseEnd'
    ? 'phraseEnd'
    : `${event.type}:${event.index}`
}

interface SungTake {
  readonly frames: readonly PitchFrame[]
  readonly events: readonly DemoEvent[]
  /** The entry as the room heard it; null for none. */
  readonly entry: EntryHeard | null
  /** When the round was decided: its landing or its miss, take clock. */
  readonly outcomeAt: number
  readonly landed: boolean
}

/** What the room's ears have heard of one take so far. */
interface Ears {
  heard: PitchPoint[]
  entry: EntryHeard | null
  decided: { at: number; landed: boolean } | null
}

/**
 * The room's ears on one take, exactly as the controller hears it: each
 * frame from the turn's start read against the note, the entry taken once
 * (first-note-ears.ts), then ticked through the sequence engine, the round
 * decided on its note's event, and nothing heard of that frame after it.
 */
function roomEars(
  round: FirstNoteRound,
  responseStart: number,
): { ears: Ears; hear: (frame: PitchFrame) => DemoEvent[] } {
  const phrase = entryPhrase(round)
  const target = entryPitch(round.entry)
  const ears: Ears = { heard: [], entry: null, decided: null }
  let engine = createSequenceState(responseStart)
  const hear = (frame: PitchFrame): DemoEvent[] => {
    const events: DemoEvent[] = []
    if (frame.t < responseStart) return events
    const off = offTarget(frame, target)
    if (off !== null) ears.heard.push({ t: frame.t, cents: off })
    if (ears.entry === null) {
      ears.entry = entryHeardIn(ears.heard, round, DEMO_RULES)
      if (ears.entry !== null) events.push({ type: 'entry', at: frame.t })
    }
    engine = tickSequence(engine, frame, phrase, DEMO_RULES)
    for (const event of engine.events) {
      events.push({ type: markOf(event), at: frame.t })
      if (event.type === 'phraseEnd') continue
      const outcome = engine.outcomes[event.index]
      if (outcome !== undefined) {
        events.push({ type: 'outcome', at: frame.t })
        ears.decided = { at: frame.t, landed: outcome.landed }
        return events
      }
    }
    return events
  }
  return { ears, hear }
}

/**
 * A take sung through the room's ears in one pass, its frames running on
 * TAIL past the moment the round was decided.
 */
function singTake(
  round: FirstNoteRound,
  segments: readonly Segment[],
  seed: number,
): SungTake {
  const responseStart = responseStartOf(round.entry)
  const frameAt = segmentTracker(entryPitch(round.entry), seed, DEMO_VIBRATO)
  const { ears, hear } = roomEars(round, responseStart)
  const frames: PitchFrame[] = []
  const events: DemoEvent[] = [
    { type: 'band', at: INTRO_AT },
    { type: 'turn', at: turnAtOf(round.entry) },
  ]
  for (let i = 0; ; i++) {
    const t = i * FRAME_SECONDS
    const decided = ears.decided
    if (decided !== null && t > decided.at + TAIL + 1e-9) break
    if (t > LONGEST_TAKE) throw new Error('First note demo: a take never ends')
    const frame = frameAt(segments, t)
    frames.push(frame)
    if (decided === null) events.push(...hear(frame))
  }
  const decided = ears.decided
  if (decided === null) throw new Error('First note demo: undecided take')
  return {
    frames,
    events,
    entry: ears.entry,
    outcomeAt: decided.at,
    landed: decided.landed,
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

/** One of Merc's takes on the entry (the demo kit's shape, demo-plan.ts). */
export interface FirstNoteDemoTake extends DemoTakeShape<FirstNoteDemoMark> {
  readonly round: FirstNoteRound
  /** The band's lead-in starts, take clock. */
  readonly introAt: number
  /** The band stops where the singer comes in, take clock. */
  readonly turnAt: number
  /** When the engine starts listening, take clock. */
  readonly responseStart: number
  /** The entry as the room heard it. */
  readonly entry: EntryHeard | null
  /** Merc singing the note after take 1's miss; none for take 2. */
  readonly answer: readonly PhraseNote[]
  /** The line landed: take 2's does, take 1's does not. */
  readonly landed: boolean
  /** The rules it was sung under: DEMO_LEVEL's. */
  readonly rules: FirstNoteLevel
}

const OFF_SEED = 0xf1e0
const ON_SEED = 0xf1e1

/** One of Merc's takes on the demo's entry. */
export function demoTake(id: DemoTakeId): FirstNoteDemoTake {
  const round = demoRound()
  const responseStart = responseStartOf(round.entry)
  const comesIn = responseStart + COMES_IN_AFTER
  const segments =
    id === 'off'
      ? sungLine(comesIn, STEP_UNDER_CENTS, STEP_HOLD)
      : sungLine(comesIn, 0, NOTE_HOLD)
  const seed = id === 'off' ? OFF_SEED : ON_SEED
  const sung = singTake(round, segments, seed)
  const length = eventAt(sung.events, 'outcome', 'First note')
  // Merc's answer, and the voice's own end, may come after the outcome.
  const answer = sung.landed ? [] : demoAnswer(round, sung.outcomeAt)
  const voiceLength = Math.max(length, voiceEnds(segments) + VOICE_STEP)
  return {
    id,
    round,
    introAt: INTRO_AT,
    turnAt: turnAtOf(round.entry),
    responseStart,
    entry: sung.entry,
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
