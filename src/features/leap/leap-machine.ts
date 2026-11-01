// ============================================================
// Leap's room states — a pure reducer
// ============================================================
//
//   intro     at rest: the cliffs, Merc on his ledge, the mic
//   starting  the microphone is opening, from the singer's tap
//   call      Merc names the leap and sings his note (both, at Learning);
//             the mic is open, but not for the voice
//   sing      the singer's turn: Merc's note, then the leap to the target
//   landed    the voice held the target; the lantern lights
//   missed    the turn ran out; Merc sings both notes
//   result    the run's numbers and its leaps, Again and Done
//   blocked   the microphone would not open; Try again
//
// "Hear Merc again" goes from sing back to call, with a fresh turn after it
// (the level says how often). A run stopped part-way (the mic tapped, the
// app leaving) goes back to the intro and keeps nothing: an aborted run is
// not a result.

import type { CaptureFailure } from '@/components/room-kit/useExerciseCapture'
import type { LeapRound } from './leap-round'

export type LeapPhase =
  | 'intro'
  | 'starting'
  | 'call'
  | 'sing'
  | 'landed'
  | 'missed'
  | 'result'
  | 'blocked'

/** What a round came to. */
export interface RoundOutcome {
  readonly round: LeapRound
  readonly landed: boolean
  /** Where the voice sat on the target when it landed, cents; null for a miss. */
  readonly cents: number | null
  /**
   * From Merc's note to the target, s: from the voice landing his note (or
   * the turn's start, when it went straight to the target) to its reaching
   * the target's band. Null for a miss.
   */
  readonly seconds: number | null
  /** The voice sang Merc's note before the leap. */
  readonly matched: boolean
  /** Any voice was heard in the turn. */
  readonly voiced: boolean
  /**
   * For a miss: the voice's steady note nearest the target sat under it
   * (true), over it (false), or never sat still (null).
   */
  readonly short: boolean | null
  /** Merc was heard again before the voice got there. */
  readonly heardAgain: boolean
}

export interface LeapState {
  readonly phase: LeapPhase
  /**
   * The number of the room's last start: a mic that answers for an older
   * one is dropped (room-kit room-mic.ts).
   */
  readonly run: number
  /** Why the mic did not open; null unless blocked. */
  readonly block: CaptureFailure | null
  /** The rounds of this run, planned at its start. */
  readonly rounds: readonly LeapRound[]
  /** The round on screen: its index in `rounds`. */
  readonly current: number
  /** "Hear Merc again" used in this round. */
  readonly replays: number
  /** Every round finished in this run, oldest first. */
  readonly outcomes: readonly RoundOutcome[]
}

export type LeapEvent =
  /** The tap: a new run on these rounds. */
  | { readonly type: 'start'; readonly rounds: readonly LeapRound[] }
  /** The mic would not open, for start `run`. */
  | {
      readonly type: 'blocked'
      readonly run: number
      readonly block: CaptureFailure
    }
  /** A round's call begins: the first, or the next after the last ended. */
  | { readonly type: 'call'; readonly index: number }
  /** Merc's call has ended at the speaker: the singer's turn. */
  | { readonly type: 'turn' }
  /** "Hear Merc again", in the singer's turn. */
  | { readonly type: 'hearAgain' }
  /** The turn's outcome: the leap landed, or the turn ran out. */
  | { readonly type: 'outcome'; readonly outcome: RoundOutcome }
  /** The last round is over. */
  | { readonly type: 'finish' }
  /** The run is given up, or the room goes back to rest. */
  | { readonly type: 'stop' }

export const INITIAL_LEAP_STATE: LeapState = {
  phase: 'intro',
  run: 0,
  block: null,
  rounds: [],
  current: 0,
  replays: 0,
  outcomes: [],
}

/** A run is on: its mic opening, a call, a turn, a landing or a miss. */
export function isRunPhase(phase: LeapPhase): boolean {
  return (
    phase === 'starting' ||
    phase === 'call' ||
    phase === 'sing' ||
    phase === 'landed' ||
    phase === 'missed'
  )
}

/** The round being played, or null outside a run. */
export function liveRound(state: LeapState): LeapRound | null {
  return isRunPhase(state.phase) ? (state.rounds[state.current] ?? null) : null
}

/** A round's call may begin: from the mic opening, or after a round. */
function callFrom(phase: LeapPhase): boolean {
  return phase === 'starting' || phase === 'landed' || phase === 'missed'
}

/** The round's call begins, when the run is ready for it. */
function startCall(state: LeapState, index: number): LeapState {
  if (!callFrom(state.phase) || index >= state.rounds.length) return state
  return { ...state, phase: 'call', current: index, replays: 0 }
}

/** The turn's outcome, taken once, and only in the turn. */
function takeOutcome(state: LeapState, outcome: RoundOutcome): LeapState {
  if (state.phase !== 'sing') return state
  return {
    ...state,
    phase: outcome.landed ? 'landed' : 'missed',
    outcomes: [...state.outcomes, outcome],
  }
}

export function leapReducer(state: LeapState, event: LeapEvent): LeapState {
  switch (event.type) {
    case 'start':
      return {
        ...INITIAL_LEAP_STATE,
        phase: 'starting',
        run: state.run + 1,
        rounds: event.rounds,
      }
    case 'blocked':
      return state.phase === 'starting' && event.run === state.run
        ? { ...state, phase: 'blocked', block: event.block }
        : state
    case 'call':
      return startCall(state, event.index)
    case 'turn':
      return state.phase === 'call' ? { ...state, phase: 'sing' } : state
    case 'hearAgain':
      return state.phase === 'sing'
        ? { ...state, phase: 'call', replays: state.replays + 1 }
        : state
    case 'outcome':
      return takeOutcome(state, event.outcome)
    case 'finish':
      return state.phase === 'landed' || state.phase === 'missed'
        ? { ...state, phase: 'result' }
        : state
    case 'stop':
      return { ...INITIAL_LEAP_STATE, run: state.run, rounds: state.rounds }
  }
}
