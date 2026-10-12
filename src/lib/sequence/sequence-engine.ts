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
// - Free mode also listens one note ahead, never more. While a note is
//   pending, the voice landing the next one misses it (skipped) and lands
//   the next on the same frame, so the stars lit are the notes sung right:
//   a wrong note neither holds up the notes after it nor gets lit by a
//   later note of its pitch (1-3-5-3 with a wrong 3: the last 3 would
//   light the first).
// - One voiced run lands one note. The run that landed a note never counts
//   toward a later one while it stays on that note: until a gap starts a
//   new run, or its smoothed centre leaves that note's band, so vibrato on
//   a held note never lets go. The note ahead hears it as silence, or a 3
//   held into the 5's turn in 1-3-5-3 would land the last 3; so does the
//   current note once a note between has missed by its deadline, or a 5
//   held through the #4's deadline in 5-#4-5 would land the last 5. The
//   note straight after the one it landed is never that note's pitch
//   (phrase-bank.ts) and hears the run as it hears any voice, so a legato
//   landing keeps its timing.
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
  /** Free mode: the voice landed the note after it first. */
  | 'skipped'

export interface MissedNote {
  readonly index: number
  readonly landed: false
  readonly missedAt: number
  readonly cause: MissCause
  /**
   * Any voice heard while it was the one to sing, a held run
   * (SequenceState.heldRun) included; for a skipped note, before the note
   * after it began.
   */
  readonly voiced: boolean
  /**
   * The steady note sung meanwhile nearest it (steady-note.ts), for Merc
   * to name; null when the voice never sat still. For a skipped note,
   * only what was sung before the note after it began. A held run is no
   * try at it and never counts.
   */
  readonly closest: SteadyNote | null
}

export type NoteOutcome = LandedNote | MissedNote

export type SequenceEvent =
  | { readonly type: 'land'; readonly index: number }
  | { readonly type: 'miss'; readonly index: number }
  | { readonly type: 'phraseEnd' }

/** What one note's hold state has heard of the voice. */
export interface NoteListener {
  /** Its hold state; null until it hears its first frame. */
  readonly hold: HoldState | null
  /** The voiced readings that counted toward it, cents off it as sung. */
  readonly heard: readonly PitchPoint[]
  /** The current in-band run's readings, as the hold reads them. */
  readonly bandRun: readonly number[]
  /** The frame the current in-band run began on; null out of band. */
  readonly bandFrom: number | null
  /** Its first voiced frame, counted or not; null until the voice sounds. */
  readonly voicedFrom: number | null
}

/**
 * The voiced run that landed a note, while it may still be that note held
 * over: the note's index and MIDI, the run's smoothed centre against it
 * (as the hold smooths one), and the run's last voiced frame.
 */
export interface HeldRun {
  readonly index: number
  readonly midi: number
  readonly centre: number
  readonly lastVoicedAt: number
}

export interface SequenceState {
  /** Frames before this, frame clock, never count. */
  readonly responseStart: number
  /** The note listened for; the phrase's length once every note is out. */
  readonly current: number
  /** Every note out so far, in order: index i is note i. */
  readonly outcomes: readonly NoteOutcome[]
  /** What the current note has heard. */
  readonly listener: NoteListener
  /**
   * Free mode: what the note after the current one has heard, one note
   * ahead. Null until it hears its first frame, in timed mode, and on the
   * last note.
   */
  readonly ahead: NoteListener | null
  /**
   * Free mode: the run that landed the last note to land, while it stays
   * on that note. It counts toward no later note but the one straight
   * after. Null once a gap or a move off the note lets go of it.
   */
  readonly heldRun: HeldRun | null
  /**
   * When the current note became the one to sing: the response start,
   * then the last note's landing or miss.
   */
  readonly since: number
  /** The current note's first frame came on a voice already sounding. */
  readonly heldOver: boolean
  /** The response's last voiced frame; null until the voice starts. */
  readonly lastVoicedAt: number | null
  /** The last frame taken, at or after `responseStart`. */
  readonly previous: PitchFrame | null
  /** Every note has landed or missed. */
  readonly ended: boolean
  /** What happened on this tick, in order. Empty on most ticks. */
  readonly events: readonly SequenceEvent[]
}

/** A listener that has heard nothing yet. */
const UNHEARD: NoteListener = {
  hold: null,
  heard: [],
  bandRun: [],
  bandFrom: null,
  voicedFrom: null,
}

export function createSequenceState(responseStart: number): SequenceState {
  return {
    responseStart,
    current: 0,
    outcomes: [],
    listener: UNHEARD,
    ahead: null,
    heldRun: null,
    since: responseStart,
    heldOver: false,
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

/**
 * The current note is out; the next one is the one to sing from `at`.
 * `heldRun` is the run that landed it (free mode); after a miss, the run
 * held before.
 */
function advance(
  state: SequenceState,
  outcome: NoteOutcome,
  at: number,
  heldRun: HeldRun | null,
): SequenceState {
  const event: SequenceEvent = {
    type: outcome.landed ? 'land' : 'miss',
    index: outcome.index,
  }
  return {
    ...state,
    current: state.current + 1,
    outcomes: [...state.outcomes, outcome],
    listener: UNHEARD,
    ahead: null,
    heldRun,
    since: at,
    heldOver: false,
    events: [...state.events, event],
  }
}

/**
 * The current note as missed at `at`, judged on what its listener heard
 * before `until`: all of it, but for a skipped note.
 */
function missedNote(
  state: SequenceState,
  at: number,
  cause: MissCause,
  until: number,
  phrase: Phrase,
  preset: SequencePreset,
): MissedNote {
  const note = phrase.notes[state.current]
  const { heard, voicedFrom } = state.listener
  return {
    index: state.current,
    landed: false,
    missedAt: at,
    cause,
    voiced: voicedFrom !== null && voicedFrom < until - EPS,
    closest: closestSteadyNote(
      heard.filter((point) => point.t < until - EPS),
      {
        targetMidi: note.midi,
        tolCents: preset.tolCents,
        landMs: preset.landMs,
        octaveFold: preset.octaveFold,
        heldOver: state.heldOver,
        centreTauSec: holdPresetFor(preset).centreTauSec,
      },
    ),
  }
}

/** The current note misses; the run held before stays held. */
function miss(
  state: SequenceState,
  at: number,
  cause: MissCause,
  phrase: Phrase,
  preset: SequencePreset,
): SequenceState {
  const until = Number.POSITIVE_INFINITY
  const missed = missedNote(state, at, cause, until, phrase, preset)
  return advance(state, missed, at, state.heldRun)
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

/**
 * The held run is heard as silence by the current note too: a note after
 * the one it landed has missed, so the current note may be that note's
 * pitch again (5-#4-5). The note straight after never is.
 */
function holdsBack(run: HeldRun | null, current: number): boolean {
  return run !== null && run.index < current - 1
}

/**
 * Whether the voice was already sounding when the current note's hold
 * state began, from the state before its first frame. Never when a held
 * run was held back from it: what it heard came after the run let go.
 */
function heldOverFrom(state: SequenceState, frame: PitchFrame): boolean {
  if (state.listener.hold !== null) return state.heldOver
  if (holdsBack(state.heldRun, state.current)) return false
  return isVoiced(frame) && state.previous !== null && isVoiced(state.previous)
}

/**
 * Where the voice reached the band for the run that landed: from the
 * frame the smoothed centre entered it, back over the readings that were
 * already inside it, on the same voiced run.
 */
function onsetOf(listener: NoteListener, preset: SequencePreset): number {
  const heard = listener.heard
  let k = heard.length - 1
  while (k > 0 && heard[k].t > (listener.bandFrom ?? heard[k].t) + EPS) k -= 1
  while (
    k > 0 &&
    inBand(heard[k - 1].cents, preset) &&
    !startsRun(heard[k - 1], heard[k])
  ) {
    k -= 1
  }
  return heard[k].t
}

/** A listener's landing on `t`, as note `index`, timed from `from`. */
function landedNote(
  index: number,
  listener: NoteListener,
  t: number,
  from: number,
  preset: SequencePreset,
): LandedNote {
  return {
    index,
    landed: true,
    cents: median(listener.bandRun),
    onset: onsetOf(listener, preset),
    landedAt: t,
    timeToLandMs: Math.round((t - from) * 1000),
  }
}

/**
 * Free mode: the run that landed note `index` (`midi`) on `t`, as its
 * listener left it.
 */
function heldRunOf(
  listener: NoteListener,
  index: number,
  midi: number,
  t: number,
  preset: SequencePreset,
): HeldRun | null {
  if (preset.timing.mode !== 'free') return null
  const centre = listener.hold?.needleCents ?? 0
  return { index, midi, centre, lastVoicedAt: t }
}

function land(
  state: SequenceState,
  t: number,
  phrase: Phrase,
  preset: SequencePreset,
): SequenceState {
  const note = phrase.notes[state.current]
  const outcome = landedNote(
    state.current,
    state.listener,
    t,
    opensAt(state, phrase, preset),
    preset,
  )
  return advance(
    state,
    outcome,
    t,
    heldRunOf(state.listener, state.current, note.midi, t, preset),
  )
}

/**
 * The note ahead landed first: the current note misses, skipped, judged
 * on what was sung before the note ahead began; then the note ahead
 * lands, on the same frame. Its time to land runs from when the current
 * note became the one to sing, which is when it began to listen.
 */
function skip(
  state: SequenceState,
  ahead: NoteListener,
  t: number,
  phrase: Phrase,
  preset: SequencePreset,
): SequenceState {
  const index = state.current + 1
  const landed = landedNote(index, ahead, t, state.since, preset)
  const skipped = advance(
    state,
    missedNote(state, t, 'skipped', landed.onset, phrase, preset),
    t,
    null,
  )
  const midi = phrase.notes[index].midi
  return advance(skipped, landed, t, heldRunOf(ahead, index, midi, t, preset))
}

/**
 * One frame for a note's listener: its hold state ticked against `midi`,
 * with the reading kept when voiced. A frame that does not count is heard
 * as silence.
 */
function hear(
  listener: NoteListener,
  frame: PitchFrame,
  previous: PitchFrame | null,
  midi: number,
  preset: SequencePreset,
  counts: boolean,
): NoteListener {
  const tick = holdTickFromFrame(
    frame,
    listener.hold === null ? null : previous,
    midi,
  )
  const sung = counts ? tick.offCents : null
  const reading = sung === null ? null : judged(sung, preset)
  const hold = tickHold(
    listener.hold ?? createHoldState(),
    { ...tick, offCents: reading },
    holdPresetFor(preset),
  )
  const banded = hold.inBand && reading !== null
  return {
    hold,
    heard:
      sung === null
        ? listener.heard
        : [...listener.heard, { t: frame.t, cents: sung }],
    bandRun: banded ? [...listener.bandRun, heldCents(reading)] : [],
    bandFrom: banded ? (listener.bandFrom ?? frame.t) : null,
    voicedFrom:
      listener.voicedFrom ?? (tick.offCents === null ? null : frame.t),
  }
}

/** The listener's hold state locked on this frame: its note lands. */
const locked = (listener: NoteListener): boolean =>
  listener.hold?.events.includes('lock') ?? false

/**
 * The held run after this frame. It lets go (null) once a gap starts a
 * new voiced run, or once its smoothed centre, smoothed as the hold
 * smooths one, leaves the band of the note it landed. An unvoiced frame
 * inside the run keeps it, and so does vibrato around the note.
 */
function followHeldRun(
  run: HeldRun,
  frame: PitchFrame,
  previous: PitchFrame | null,
  preset: SequencePreset,
): HeldRun | null {
  const sung = offTarget(frame, run.midi)
  if (sung === null) return run
  const point = { t: frame.t, cents: sung }
  if (startsRun({ t: run.lastVoicedAt, cents: run.centre }, point)) return null
  const dt = previous === null ? 0 : frame.t - previous.t
  const tau = holdPresetFor(preset).centreTauSec
  const alpha = tau > 0 ? 1 - Math.exp(-dt / tau) : 1
  const centre =
    run.centre + alpha * (heldCents(judged(sung, preset)) - run.centre)
  if (Math.abs(centre) > preset.tolCents + EPS) return null
  return { ...run, centre, lastVoicedAt: frame.t }
}

/**
 * Free mode: the frame for the note after the current one, which lands
 * first when the current note was sung wrong. Never further ahead; and
 * the run that landed the last note to land, while it is held, is heard
 * there as silence.
 */
function lookAhead(
  state: SequenceState,
  frame: PitchFrame,
  phrase: Phrase,
  preset: SequencePreset,
): SequenceState {
  const next = phrase.notes[state.current + 1]
  if (preset.timing.mode !== 'free' || next === undefined) return state
  const ahead = hear(
    state.ahead ?? UNHEARD,
    frame,
    state.previous,
    next.midi,
    preset,
    state.heldRun === null,
  )
  const listened: SequenceState = { ...state, ahead }
  return locked(ahead)
    ? skip(listened, ahead, frame.t, phrase, preset)
    : listened
}

/**
 * The frame, once the current note listens: the held run followed with
 * it, then heard by the current note's hold state (as silence while the
 * held run is held back from it), then by the note ahead's.
 */
function listen(
  state: SequenceState,
  frame: PitchFrame,
  phrase: Phrase,
  preset: SequencePreset,
): SequenceState {
  const note = phrase.notes[state.current]
  if (note === undefined) return state
  if (frame.t < opensAt(state, phrase, preset) - EPS) return state
  const heldRun =
    state.heldRun === null
      ? null
      : followHeldRun(state.heldRun, frame, state.previous, preset)
  const listener = hear(
    state.listener,
    frame,
    state.previous,
    note.midi,
    preset,
    !holdsBack(heldRun, state.current),
  )
  const next: SequenceState = {
    ...state,
    listener,
    heldRun,
    heldOver: heldOverFrom(state, frame),
  }
  return locked(listener)
    ? land(next, frame.t, phrase, preset)
    : lookAhead(next, frame, phrase, preset)
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
