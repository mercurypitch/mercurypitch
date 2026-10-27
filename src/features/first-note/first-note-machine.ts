// ============================================================
// First note's room states — a pure reducer
// ============================================================
//
//   intro     at rest: the stage, Merc, the mic
//   starting  the microphone is opening, from the singer's tap
//   band      a song's lead-in plays; the mic is open, but not for the voice
//   sing      the singer's turn: their entry, then the note
//   landed    the voice held the note; the song carries on, its singer in
//   missed    the turn ran out; Merc sings the note, then the singer comes in
//   result    the run's numbers, Again and Done
//   blocked   the microphone would not open; Try again
//
// Inside the turn, the singer's entry is heard once: the first note their
// voice sat on (`entry`), kept for the round whatever they sing after it.
// It is what the levels that hide the line wait for, and what the result
// counts first. "Hear the band again" goes from sing back to band and keeps
// the entry, if there was one: the first try is the one that counts. A run
// stopped part-way goes back to the intro and keeps nothing: an aborted run
// is not a result.

import type { CaptureFailure } from '@/components/room-kit/useExerciseCapture'
import type { FirstNoteRound } from './first-note-songs'

export type FirstNotePhase =
  | 'intro'
  | 'starting'
  | 'band'
  | 'sing'
  | 'landed'
  | 'missed'
  | 'result'
  | 'blocked'

/** Where the singer came in: their first steady note against the entry's. */
export interface EntryHeard {
  /** Cents off the entry's note, folded to its nearest octave, signed. */
  readonly cents: number
  /** Inside the level's band: they came in on the note. */
  readonly onNote: boolean
}

/** What a round came to. */
export interface RoundOutcome {
  readonly round: FirstNoteRound
  /** Where the singer came in; null when no steady note was heard. */
  readonly entry: EntryHeard | null
  readonly landed: boolean
  /** From the start of the turn to the voice landing the note, s; null for a miss. */
  readonly seconds: number | null
  /** Any voice was heard in the turn. */
  readonly voiced: boolean
  /** The lead-in was heard again in this round. */
  readonly heardAgain: boolean
}

export interface FirstNoteState {
  readonly phase: FirstNotePhase
  /**
   * The number of the room's last start: a mic that answers for an older
   * one is dropped (room-kit room-mic.ts).
   */
  readonly run: number
  /** Why the mic did not open; null unless blocked. */
  readonly block: CaptureFailure | null
  /** The rounds of this run, planned at its start. */
  readonly rounds: readonly FirstNoteRound[]
  /** The round on screen: its index in `rounds`. */
  readonly current: number
  /** "Hear the band again" used in this round. */
  readonly replays: number
  /** The singer's entry in this round, once heard. */
  readonly entry: EntryHeard | null
  /** Every round finished in this run, oldest first. */
  readonly outcomes: readonly RoundOutcome[]
}

export type FirstNoteEvent =
  /** The tap: a new run on these rounds. */
  | { readonly type: 'start'; readonly rounds: readonly FirstNoteRound[] }
  /** The mic would not open, for start `run`. */
  | {
      readonly type: 'blocked'
      readonly run: number
      readonly block: CaptureFailure
    }
  /** A round's lead-in begins: the first, or the next after the line. */
  | { readonly type: 'intro'; readonly index: number }
  /** The band has stopped where the singer comes in: their turn. */
  | { readonly type: 'turn' }
  /** The singer's first steady note in the turn. */
  | { readonly type: 'entry'; readonly entry: EntryHeard }
  /** "Hear the band again", in the singer's turn. */
  | { readonly type: 'hearAgain' }
  /** The turn's outcome: the voice landed the note, or the turn ran out. */
  | { readonly type: 'outcome'; readonly outcome: RoundOutcome }
  /** The last line has played. */
  | { readonly type: 'finish' }
  /** The run is given up, or the room goes back to rest. */
  | { readonly type: 'stop' }

export const INITIAL_FIRST_NOTE_STATE: FirstNoteState = {
  phase: 'intro',
  run: 0,
  block: null,
  rounds: [],
  current: 0,
  replays: 0,
  entry: null,
  outcomes: [],
}

/** A run is on: its mic opening, a lead-in, a turn or a line. */
export function isRunPhase(phase: FirstNotePhase): boolean {
  return (
    phase === 'starting' ||
    phase === 'band' ||
    phase === 'sing' ||
    phase === 'landed' ||
    phase === 'missed'
  )
}

/** The round being played, or null outside a run. */
export function liveRound(state: FirstNoteState): FirstNoteRound | null {
  return isRunPhase(state.phase) ? (state.rounds[state.current] ?? null) : null
}

/** A round's lead-in may begin: from the mic opening, or after a line. */
function introFrom(phase: FirstNotePhase): boolean {
  return phase === 'starting' || phase === 'landed' || phase === 'missed'
}

/** The round's lead-in begins, when the run is ready for it. */
function startIntro(state: FirstNoteState, index: number): FirstNoteState {
  if (!introFrom(state.phase) || index >= state.rounds.length) return state
  return { ...state, phase: 'band', current: index, replays: 0, entry: null }
}

/** The entry, heard once a round, and only in the turn. */
function takeEntry(state: FirstNoteState, entry: EntryHeard): FirstNoteState {
  if (state.phase !== 'sing' || state.entry !== null) return state
  return { ...state, entry }
}

/** The turn's outcome, taken once, and only in the turn. */
function takeOutcome(
  state: FirstNoteState,
  outcome: RoundOutcome,
): FirstNoteState {
  if (state.phase !== 'sing') return state
  return {
    ...state,
    phase: outcome.landed ? 'landed' : 'missed',
    outcomes: [...state.outcomes, outcome],
  }
}

export function firstNoteReducer(
  state: FirstNoteState,
  event: FirstNoteEvent,
): FirstNoteState {
  switch (event.type) {
    case 'start':
      return {
        ...INITIAL_FIRST_NOTE_STATE,
        phase: 'starting',
        run: state.run + 1,
        rounds: event.rounds,
      }
    case 'blocked':
      return state.phase === 'starting' && event.run === state.run
        ? { ...state, phase: 'blocked', block: event.block }
        : state
    case 'intro':
      return startIntro(state, event.index)
    case 'turn':
      return state.phase === 'band' ? { ...state, phase: 'sing' } : state
    case 'entry':
      return takeEntry(state, event.entry)
    case 'hearAgain':
      return state.phase === 'sing'
        ? { ...state, phase: 'band', replays: state.replays + 1 }
        : state
    case 'outcome':
      return takeOutcome(state, event.outcome)
    case 'finish':
      return state.phase === 'landed' || state.phase === 'missed'
        ? { ...state, phase: 'result' }
        : state
    case 'stop':
      return {
        ...INITIAL_FIRST_NOTE_STATE,
        run: state.run,
        rounds: state.rounds,
      }
  }
}
