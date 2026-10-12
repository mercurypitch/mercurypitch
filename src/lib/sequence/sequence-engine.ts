// ============================================================
// Sequence engine — a phrase sung back note by note: each lands or misses
// ============================================================
//
// Echo's engine, and later Note runner's and the onboarding's sung line.
// Merc sings a phrase; the singer sings it back; each note lands or misses.
// A pure tick on a state object, as the hold engine's: the room feeds it
// every captured frame and reads the stars, Merc's cues and the result
// straight off the returned state, with the events this tick fired (so
// haptics, Merc and the demo's cues react exactly once).
//
// Each note is one hold-engine state (src/lib/hold/), fed by
// holdTickFromFrame against that note's MIDI, so a note is heard exactly as
// Long note hears one: the reading held to a semitone (hold-reading.ts),
// the band judged on a short smoothed centre. A note lands on the hold
// engine's lock, in band for the level's land time, and a fresh hold state
// listens for the next one. A voice sliding past a note never lands it: a
// quick slide crosses a 50 cent band in about 100 ms, and a landing needs
// 200 to 300 ms.
//
// Rules that are easy to undo by accident:
//
// - Frames before `responseStart` never count, not even as the voice
//   starting. The room sets it to the end of Merc's call plus
//   RESPONSE_GATE_SECONDS: his voice from the speaker reaches the mic.
// - Free mode (Echo) gives each note a deadline from the moment it became
//   the one to sing: the response start for the first, then the last
//   note's landing or miss. Once the voice has started, 1.4 s of silence
//   ends the echo and the notes left miss; a response that never starts
//   ends by its deadlines, one after another.
// - Timed mode gives each note a window on the response's clock instead,
//   so a miss never holds up the notes after it. A rest in a timed line
//   may be longer than 1.4 s, so silence ends nothing there.
// - The octave fold (the easiest level) reads the voice against the
//   nearest octave of the note before the hold clamps it to a semitone, so
//   an echo an octave down lands. Two adjacent notes must then never be an
//   octave apart (phrase-bank.ts keeps them apart).
// - A landing's onset is where the voice reached the band, read on the
//   readings themselves: the smoothed centre lags a jump from the last
//   note by up to 150 ms, and the first note, sung out of silence, has no
//   such lag, so the smoothed start would put every later note late
//   against it and break the rhythm judge (sequence-metrics.ts).
// - The hold never ends a note on its own (no end time, no goal): the
//   sequence decides when a note is over.

import type { HoldPreset, HoldState } from '@/lib/hold/hold-engine'
import { createHoldState, HOLD_PRESETS, holdTickFromFrame, tickHold, } from '@/lib/hold/hold-engine'
import type { PitchPoint } from '@/lib/hold/hold-reading'
import { heldCents, offTarget, startsRun } from '@/lib/hold/hold-reading'
import type { PitchFrame } from '@/lib/pitch-f0-stream'
import { foldCents, median } from '@/lib/pitch-measurements'
import type { SteadyNote } from './steady-note'
import { closestSteadyNote } from './steady-note'

// ---- Phrases -------------------------------------------------------------

/** One note of a phrase, with Merc's timing for it. */
export interface PhraseNote {
  /** The note, MIDI. */
  readonly midi: number
  /**
   * Merc's onset, seconds from the start of his call. In timed mode the
   * clock is the response's: seconds from `responseStart`.
   */
  readonly at: number
  /** How long Merc holds it, seconds. */
  readonly seconds: number
}

export interface Phrase {
  readonly notes: readonly PhraseNote[]
}

/** The call's length: the end of Merc's last note, seconds. */
export function callSeconds(phrase: Phrase): number {
  let end = 0
  for (const note of phrase.notes) end = Math.max(end, note.at + note.seconds)
  return end
}

/**
 * How long after the end of Merc's call the response starts: the tail of
 * his voice through the speaker, which the mic hears.
 */
export const RESPONSE_GATE_SECONDS = 0.2

// ---- Presets -------------------------------------------------------------

export type SequenceTiming =
  /**
   * The singer's own pace (Echo). A note misses `deadlineMs` after it
   * became the one to sing; once the voice has started, `endSilenceMs`
   * without it ends the echo and the notes left miss.
   */
  | {
      readonly mode: 'free'
      readonly deadlineMs: number
      readonly endSilenceMs: number
    }
  /**
   * On a clock (Note runner, the onboarding's sung line): a note listens
   * from `earlyMs` before its onset to `lateMs` after its end, its times
   * counted from `responseStart`, and misses when that window closes.
   */
  | {
      readonly mode: 'timed'
      readonly earlyMs: number
      readonly lateMs: number
    }

export interface SequencePreset {
  /** Half-width of the band around each note, cents. */
  readonly tolCents: number
  /** In band this long, continuously, lands a note. */
  readonly landMs: number
  /** Read the voice against the nearest octave of each note. */
  readonly octaveFold: boolean
  readonly timing: SequenceTiming
}

/** Echo at one level: the engine's preset and the room's rules around it. */
export interface EchoLevelPreset extends SequencePreset {
  readonly notesPerPhrase: number
  /** Merc's note length in the call, seconds. */
  readonly noteSeconds: number
  /** "Hear it again": at any time, once per phrase, or not offered. */
  readonly hearAgain: 'anyTime' | 'oncePerPhrase' | 'never'
  /**
   * Each landed onset within this many ms of where Merc's spacing puts it
   * (sequence-metrics.ts), scored apart; null where rhythm is not judged.
   */
  readonly rhythmToleranceMs: number | null
}

/** Echo's silence rule: this long without the voice, once started, ends it. */
const ECHO_END_SILENCE_MS = 1400

/**
 * Echo at each level, which is the Settings accuracy tier
 * (src/stores/exercise-level.ts; owner, 12 Oct 2026). The design's table
 * (DESIGN-echo.md §3, Beginner, Singer and Pro there). Keyed by the tier
 * ids, as the Long note lantern's levels are, so a tier with no Echo level
 * fails to compile where the level is looked up.
 */
export const ECHO_LEVELS = {
  learning: {
    notesPerPhrase: 3,
    noteSeconds: 0.9,
    tolCents: 50,
    landMs: 300,
    timing: {
      mode: 'free',
      deadlineMs: 4000,
      endSilenceMs: ECHO_END_SILENCE_MS,
    },
    octaveFold: true,
    hearAgain: 'anyTime',
    rhythmToleranceMs: null,
  },
  singer: {
    notesPerPhrase: 4,
    noteSeconds: 0.65,
    tolCents: 35,
    landMs: 250,
    timing: {
      mode: 'free',
      deadlineMs: 3000,
      endSilenceMs: ECHO_END_SILENCE_MS,
    },
    octaveFold: false,
    hearAgain: 'oncePerPhrase',
    rhythmToleranceMs: null,
  },
  professional: {
    notesPerPhrase: 5,
    noteSeconds: 0.45,
    tolCents: 25,
    landMs: 200,
    timing: {
      mode: 'free',
      deadlineMs: 2500,
      endSilenceMs: ECHO_END_SILENCE_MS,
    },
    octaveFold: false,
    hearAgain: 'never',
    rhythmToleranceMs: 120,
  },
} satisfies Record<string, EchoLevelPreset>

export type EchoLevelId = keyof typeof ECHO_LEVELS

// ---- State ---------------------------------------------------------------

export interface LandedNote {
  readonly index: number
  readonly landed: true
  /**
   * Where the note sat: the median of the readings of the in-band run that
   * landed it, cents off the note as the hold reads them (held to a
   * semitone, folded to the nearest octave at the levels that fold).
   */
  readonly cents: number
  /** Where the voice reached the band for the run that landed, seconds. */
  readonly onset: number
  /** The frame it landed on: its star lights. */
  readonly landedAt: number
  /** From the moment it became the one to sing to its landing, ms. */
  readonly timeToLandMs: number
}

export type MissCause =
  /** Free mode: no landing by its deadline. */
  | 'deadline'
  /** Timed mode: its window closed. */
  | 'window'
  /** Free mode: the voice stopped, and the echo ended with it. */
  | 'silence'

export interface MissedNote {
  readonly index: number
  readonly landed: false
  readonly missedAt: number
  readonly cause: MissCause
  /** Any voice heard while it was the one to sing. */
  readonly voiced: boolean
  /**
   * The steady note sung meanwhile nearest it (steady-note.ts), for Merc
   * to name; null when the voice never sat still.
   */
  readonly closest: SteadyNote | null
}

export type NoteOutcome = LandedNote | MissedNote

export type SequenceEvent =
  | { readonly type: 'land'; readonly index: number }
  | { readonly type: 'miss'; readonly index: number }
  | { readonly type: 'phraseEnd' }

export interface SequenceState {
  /** Frames before this, frame clock, never count. */
  readonly responseStart: number
  /** The note listened for; the phrase's length once every note is out. */
  readonly current: number
  /** Every note out so far, in order: index i is note i. */
  readonly outcomes: readonly NoteOutcome[]
  /** The current note's hold state; null until it hears its first frame. */
  readonly hold: HoldState | null
  /**
   * When the current note became the one to sing: the response start,
   * then the last note's landing or miss.
   */
  readonly since: number
  /** The current note's first frame came on a voice already sounding. */
  readonly heldOver: boolean
  /** The current note's voiced readings, cents off it as sung. */
  readonly heard: readonly PitchPoint[]
  /** The current in-band run's readings, as the hold reads them. */
  readonly bandRun: readonly number[]
  /** The frame the current in-band run began on; null out of band. */
  readonly bandFrom: number | null
  /** The response's last voiced frame; null until the voice starts. */
  readonly lastVoicedAt: number | null
  /** The last frame taken, at or after `responseStart`. */
  readonly previous: PitchFrame | null
  /** Every note has landed or missed. */
  readonly ended: boolean
  /** What happened on this tick, in order. Empty on most ticks. */
  readonly events: readonly SequenceEvent[]
}

export function createSequenceState(responseStart: number): SequenceState {
  return {
    responseStart,
    current: 0,
    outcomes: [],
    hold: null,
    since: responseStart,
    heldOver: false,
    heard: [],
    bandRun: [],
    bandFrom: null,
    lastVoicedAt: null,
    previous: null,
    ended: false,
    events: [],
  }
}

// ---- The tick ------------------------------------------------------------

/** Float sums of frame times drift; thresholds compare with this slack. */
const EPS = 1e-6

/** Voiced by the hold's own rule (f0 > 0, confidence at least CONF_MIN). */
const isVoiced = (frame: PitchFrame): boolean => offTarget(frame, 0) !== null

const holdPresets = new WeakMap<SequencePreset, HoldPreset>()

/** The hold engine's preset for one note at this level. */
function holdPresetFor(preset: SequencePreset): HoldPreset {
  let hold = holdPresets.get(preset)
  if (hold === undefined) {
    hold = {
      ...HOLD_PRESETS.exercise,
      tolCents: preset.tolCents,
      lockMs: preset.landMs,
      // The sequence ends notes and phrases itself; the hold never does.
      endMs: Number.POSITIVE_INFINITY,
      goalSeconds: Number.POSITIVE_INFINITY,
    }
    holdPresets.set(preset, hold)
  }
  return hold
}

/** When the current note starts to listen: at once, or at its window. */
function opensAt(
  state: SequenceState,
  phrase: Phrase,
  preset: SequencePreset,
): number {
  const timing = preset.timing
  if (timing.mode === 'free') return state.since
  const note = phrase.notes[state.current]
  const open = state.responseStart + note.at - timing.earlyMs / 1000
  return Math.max(state.since, open)
}

/** When the current note misses: its deadline, or its window's close. */
function deadlineOf(
  state: SequenceState,
  phrase: Phrase,
  preset: SequencePreset,
): number {
  const timing = preset.timing
  if (timing.mode === 'free') return state.since + timing.deadlineMs / 1000
  const note = phrase.notes[state.current]
  const close =
    state.responseStart + note.at + note.seconds + timing.lateMs / 1000
  return Math.max(state.since, close)
}

/** When the voice's silence ends the echo; never before it has started. */
function silenceEndsAt(state: SequenceState, preset: SequencePreset): number {
  const timing = preset.timing
  if (timing.mode !== 'free' || state.lastVoicedAt === null) {
    return Number.POSITIVE_INFINITY
  }
  return state.lastVoicedAt + timing.endSilenceMs / 1000
}

/** The current note is out; the next one is the one to sing from `at`. */
function advance(
  state: SequenceState,
  outcome: NoteOutcome,
  at: number,
): SequenceState {
  const event: SequenceEvent = {
    type: outcome.landed ? 'land' : 'miss',
    index: outcome.index,
  }
  return {
    ...state,
    current: state.current + 1,
    outcomes: [...state.outcomes, outcome],
    hold: null,
    since: at,
    heldOver: false,
    heard: [],
    bandRun: [],
    bandFrom: null,
    events: [...state.events, event],
  }
}

function miss(
  state: SequenceState,
  at: number,
  cause: MissCause,
  phrase: Phrase,
  preset: SequencePreset,
): SequenceState {
  const note = phrase.notes[state.current]
  const closest = closestSteadyNote(state.heard, {
    targetMidi: note.midi,
    tolCents: preset.tolCents,
    landMs: preset.landMs,
    octaveFold: preset.octaveFold,
    heldOver: state.heldOver,
    centreTauSec: holdPresetFor(preset).centreTauSec,
  })
  return advance(
    state,
    {
      index: state.current,
      landed: false,
      missedAt: at,
      cause,
      voiced: state.heard.length > 0,
      closest,
    },
    at,
  )
}

/**
 * Every note whose deadline has passed by `t` misses, in turn, each
 * opening the next note's time from its own deadline. A deadline at or
 * after the silence that ends the echo is the silence's to settle.
 */
function missPastDeadlines(
  state: SequenceState,
  t: number,
  phrase: Phrase,
  preset: SequencePreset,
): SequenceState {
  const silenceAt = silenceEndsAt(state, preset)
  const cause: MissCause = preset.timing.mode === 'free' ? 'deadline' : 'window'
  let next = state
  while (next.current < phrase.notes.length) {
    const deadline = deadlineOf(next, phrase, preset)
    if (deadline > t + EPS || deadline >= silenceAt - EPS) break
    next = miss(next, deadline, cause, phrase, preset)
  }
  return next
}

/** Once the voice has been gone long enough, every note left misses. */
function endOnSilence(
  state: SequenceState,
  t: number,
  phrase: Phrase,
  preset: SequencePreset,
): SequenceState {
  const at = silenceEndsAt(state, preset)
  if (t < at - EPS) return state
  let next = state
  while (next.current < phrase.notes.length) {
    next = miss(next, at, 'silence', phrase, preset)
  }
  return next
}

/** A sung reading as the level judges it: against the nearest octave of the note where it folds. */
function judged(cents: number, preset: SequencePreset): number {
  return preset.octaveFold ? foldCents(cents) : cents
}

/** A reading, as the hold reads it, inside the band. */
function inBand(cents: number, preset: SequencePreset): boolean {
  return Math.abs(heldCents(judged(cents, preset))) <= preset.tolCents + EPS
}

/** Whether the voice was already sounding when this note's hold state began. */
function heldOverFrom(
  state: SequenceState,
  fresh: boolean,
  sung: number | null,
): boolean {
  if (!fresh) return state.heldOver
  return sung !== null && state.previous !== null && isVoiced(state.previous)
}

/**
 * Where the voice reached the band for the run that landed: from the
 * frame the smoothed centre entered it, back over the readings that were
 * already inside it, on the same voiced run.
 */
function onsetOf(state: SequenceState, preset: SequencePreset): number {
  const heard = state.heard
  let k = heard.length - 1
  while (k > 0 && heard[k].t > (state.bandFrom ?? heard[k].t) + EPS) k -= 1
  while (
    k > 0 &&
    inBand(heard[k - 1].cents, preset) &&
    !startsRun(heard[k - 1], heard[k])
  ) {
    k -= 1
  }
  return heard[k].t
}

function land(
  state: SequenceState,
  t: number,
  phrase: Phrase,
  preset: SequencePreset,
): SequenceState {
  const outcome: LandedNote = {
    index: state.current,
    landed: true,
    cents: median(state.bandRun),
    onset: onsetOf(state, preset),
    landedAt: t,
    timeToLandMs: Math.round((t - opensAt(state, phrase, preset)) * 1000),
  }
  return advance(state, outcome, t)
}

/** The frame, heard by the current note's hold state, once it listens. */
function listen(
  state: SequenceState,
  frame: PitchFrame,
  phrase: Phrase,
  preset: SequencePreset,
): SequenceState {
  const note = phrase.notes[state.current]
  if (note === undefined) return state
  if (frame.t < opensAt(state, phrase, preset) - EPS) return state
  const fresh = state.hold === null
  const tick = holdTickFromFrame(
    frame,
    fresh ? null : state.previous,
    note.midi,
  )
  const sung = tick.offCents
  const reading = sung === null ? null : judged(sung, preset)
  const hold = tickHold(
    state.hold ?? createHoldState(),
    { ...tick, offCents: reading },
    holdPresetFor(preset),
  )
  const banded = hold.inBand && reading !== null
  const next: SequenceState = {
    ...state,
    hold,
    heldOver: heldOverFrom(state, fresh, sung),
    heard:
      sung === null
        ? state.heard
        : [...state.heard, { t: frame.t, cents: sung }],
    bandRun: banded ? [...state.bandRun, heldCents(reading)] : [],
    bandFrom: banded ? (state.bandFrom ?? frame.t) : null,
  }
  return hold.events.includes('lock')
    ? land(next, frame.t, phrase, preset)
    : next
}

/**
 * One captured frame. Frames must come in time order; `phrase` and
 * `preset` must be the same on every tick of one state.
 */
export function tickSequence(
  state: SequenceState,
  frame: PitchFrame,
  phrase: Phrase,
  preset: SequencePreset,
): SequenceState {
  if (state.ended || frame.t < state.responseStart - EPS) {
    return state.events.length === 0 ? state : { ...state, events: [] }
  }
  let next: SequenceState = { ...state, events: [] }
  next = missPastDeadlines(next, frame.t, phrase, preset)
  next = endOnSilence(next, frame.t, phrase, preset)
  next = listen(next, frame, phrase, preset)
  next = {
    ...next,
    previous: frame,
    lastVoicedAt: isVoiced(frame) ? frame.t : next.lastVoicedAt,
  }
  if (next.current < phrase.notes.length) return next
  return {
    ...next,
    ended: true,
    events: [...next.events, { type: 'phraseEnd' }],
  }
}
