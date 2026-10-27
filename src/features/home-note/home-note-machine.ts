// ============================================================
// Home note's room states — a pure reducer
// ============================================================
//
//   intro     at rest: the harbour, Merc, the mic
//   starting  the microphone is opening, from the singer's tap
//   band      a round's intro plays; the mic is open, but not for the voice
//   sing      the singer's turn: the voice is heard against home
//   landed    the voice held home; the band resolves under it
//   missed    the turn ran out; Merc sings home over the band's chord
//   result    the run's numbers, Again and Done
//   blocked   the microphone would not open; Try again
//
// "Hear it again" goes from sing back to band, with a fresh turn after it
// (the level says how often). A run stopped part-way (the mic tapped, the
// app leaving) goes back to the intro and keeps nothing: an aborted run is
// not a result.

import type { CaptureFailure } from '@/components/room-kit/useExerciseCapture'
import type { HomeRound } from './home-note-round'

export type HomeNotePhase =
  | 'intro'
  | 'starting'
  | 'band'
  | 'sing'
  | 'landed'
  | 'missed'
  | 'result'
  | 'blocked'

/** What a round came to. */
export interface RoundOutcome {
  readonly round: HomeRound
  readonly landed: boolean
  /**
   * Where the voice sat on home when it landed, cents off it (folded to
   * its octave, as the engine reads it); null for a miss.
   */
  readonly cents: number | null
  /** From the start of the turn to the voice reaching home, s; null for a miss. */
  readonly seconds: number | null
  /** Any voice was heard in the turn. */
  readonly voiced: boolean
  /** The intro was heard again before the voice got there. */
  readonly heardAgain: boolean
}

export interface HomeNoteState {
  readonly phase: HomeNotePhase
  /**
   * The number of the room's last start: a mic that answers for an older
   * one is dropped (room-kit room-mic.ts).
   */
  readonly run: number
  /** Why the mic did not open; null unless blocked. */
  readonly block: CaptureFailure | null
  /** The rounds of this run, planned at its start. */
  readonly rounds: readonly HomeRound[]
  /** The round on screen: its index in `rounds`. */
  readonly current: number
  /** "Hear it again" used in this round. */
  readonly replays: number
  /** Every round finished in this run, oldest first. */
  readonly outcomes: readonly RoundOutcome[]
}

export type HomeNoteEvent =
  /** The tap: a new run on these rounds. */
  | { readonly type: 'start'; readonly rounds: readonly HomeRound[] }
  /** The mic would not open, for start `run`. */
  | {
      readonly type: 'blocked'
      readonly run: number
      readonly block: CaptureFailure
    }
  /** A round's intro begins: the first, or the next after a resolve. */
  | { readonly type: 'intro'; readonly index: number }
  /** The intro has ended at the speaker: the singer's turn. */
  | { readonly type: 'turn' }
  /** "Hear it again", in the singer's turn. */
  | { readonly type: 'hearAgain' }
  /** The turn's outcome: the voice landed home, or the turn ran out. */
  | { readonly type: 'outcome'; readonly outcome: RoundOutcome }
  /** The last resolve has played. */
  | { readonly type: 'finish' }
  /** The run is given up, or the room goes back to rest. */
  | { readonly type: 'stop' }

export const INITIAL_HOME_NOTE_STATE: HomeNoteState = {
  phase: 'intro',
  run: 0,
  block: null,
  rounds: [],
  current: 0,
  replays: 0,
  outcomes: [],
}

/** A run is on: its mic opening, an intro, a turn or a resolve. */
export function isRunPhase(phase: HomeNotePhase): boolean {
  return (
    phase === 'starting' ||
    phase === 'band' ||
    phase === 'sing' ||
    phase === 'landed' ||
    phase === 'missed'
  )
}

/** The round being played, or null outside a run. */
export function liveRound(state: HomeNoteState): HomeRound | null {
  return isRunPhase(state.phase) ? (state.rounds[state.current] ?? null) : null
}

/** A round's intro may begin: from the mic opening, or after a resolve. */
function introFrom(phase: HomeNotePhase): boolean {
  return phase === 'starting' || phase === 'landed' || phase === 'missed'
}

/** The round's intro begins, when the run is ready for it. */
function startIntro(state: HomeNoteState, index: number): HomeNoteState {
  if (!introFrom(state.phase) || index >= state.rounds.length) return state
  return { ...state, phase: 'band', current: index, replays: 0 }
}

/** The turn's outcome, taken once, and only in the turn. */
function takeOutcome(
  state: HomeNoteState,
  outcome: RoundOutcome,
): HomeNoteState {
  if (state.phase !== 'sing') return state
  return {
    ...state,
    phase: outcome.landed ? 'landed' : 'missed',
    outcomes: [...state.outcomes, outcome],
  }
}

export function homeNoteReducer(
  state: HomeNoteState,
  event: HomeNoteEvent,
): HomeNoteState {
  switch (event.type) {
    case 'start':
      return {
        ...INITIAL_HOME_NOTE_STATE,
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
        ...INITIAL_HOME_NOTE_STATE,
        run: state.run,
        rounds: state.rounds,
      }
  }
}
