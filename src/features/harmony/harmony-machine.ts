// ============================================================
// Harmony's room states — a pure reducer
// ============================================================
//
//   intro     at rest: the lake, Merc on the jetty, the two lines of lamps
//   starting  the microphone is opening, from the singer's tap
//   call      Merc sings his line (and the harmony, at Learning); the mic
//             is open, but not for the voice
//   sing      taking turns: the singer sings the harmony on their own
//   together  in headphones: Merc sings his line again, the singer with him
//   landed    every note of the line in harmony; its lamps lit
//   missed    a note missed; Merc sings his note and the third from it
//   result    the run's numbers and its lines, Again and Done
//   blocked   the microphone would not open; Try again
//
// "Hear Merc again" goes from sing back to call, with a fresh turn after it
// (the level says how often). A run's way (turns or together) is fixed at
// its start. A run stopped part-way (the mic tapped, the app leaving) goes
// back to the intro and keeps nothing: an aborted run is not a result.

import type { CaptureFailure } from '@/components/room-kit/useExerciseCapture'
import type { HarmonyLine } from './harmony-line'
import type { HarmonyWay } from './harmony-rules'

export type HarmonyPhase =
  | 'intro'
  | 'starting'
  | 'call'
  | 'sing'
  | 'together'
  | 'landed'
  | 'missed'
  | 'result'
  | 'blocked'

/** What a line came to. */
export interface LineOutcome {
  readonly line: HarmonyLine
  /** Each harmony note in order: landed or not. */
  readonly notes: readonly boolean[]
  /** Every note landed: the line was sung in harmony. */
  readonly inHarmony: boolean
  /** The first note that missed, or null. */
  readonly firstMiss: number | null
  /**
   * For the first miss: the voice's steady note nearest it sat under it
   * (true), over it (false), or never sat still (null).
   */
  readonly short: boolean | null
  /** Any voice was heard in the turn. */
  readonly voiced: boolean
  /** Merc was heard again before the line was decided. */
  readonly heardAgain: boolean
}

export interface HarmonyState {
  readonly phase: HarmonyPhase
  /**
   * The number of the room's last start: a mic that answers for an older
   * one is dropped (room-kit room-mic.ts).
   */
  readonly run: number
  /** Why the mic did not open; null unless blocked. */
  readonly block: CaptureFailure | null
  /** The run's way: after Merc, or with him. */
  readonly way: HarmonyWay
  /** The lines of this run, planned at its start. */
  readonly lines: readonly HarmonyLine[]
  /** The line on screen: its index in `lines`. */
  readonly current: number
  /** "Hear Merc again" used in this line. */
  readonly replays: number
  /** Every line finished in this run, oldest first. */
  readonly outcomes: readonly LineOutcome[]
}

export type HarmonyEvent =
  /** The tap: a new run on these lines, sung this way. */
  | {
      readonly type: 'start'
      readonly lines: readonly HarmonyLine[]
      readonly way: HarmonyWay
    }
  /** The mic did not open, for start `run`. */
  | {
      readonly type: 'blocked'
      readonly run: number
      readonly block: CaptureFailure
    }
  /** A line's call begins: the first, or the next after the last ended. */
  | { readonly type: 'call'; readonly index: number }
  /** Merc's call has ended at the speaker: the singer's turn, or together. */
  | { readonly type: 'turn' }
  /** "Hear Merc again", in the singer's turn. */
  | { readonly type: 'hearAgain' }
  /** The line's outcome: in harmony, or a note missed. */
  | { readonly type: 'outcome'; readonly outcome: LineOutcome }
  /** The last line is over. */
  | { readonly type: 'finish' }
  /** The run is given up, or the room goes back to rest. */
  | { readonly type: 'stop' }

export const INITIAL_HARMONY_STATE: HarmonyState = {
  phase: 'intro',
  run: 0,
  block: null,
  way: 'turns',
  lines: [],
  current: 0,
  replays: 0,
  outcomes: [],
}

/** A run is on: its mic opening, a call, a turn, a landing or a miss. */
export function isRunPhase(phase: HarmonyPhase): boolean {
  return (
    phase === 'starting' ||
    phase === 'call' ||
    phase === 'sing' ||
    phase === 'together' ||
    phase === 'landed' ||
    phase === 'missed'
  )
}

/** The singer is singing: on their own, or with Merc. */
export function isSinging(phase: HarmonyPhase): boolean {
  return phase === 'sing' || phase === 'together'
}

/** The line being sung, or null outside a run. */
export function liveLine(state: HarmonyState): HarmonyLine | null {
  return isRunPhase(state.phase) ? (state.lines[state.current] ?? null) : null
}

/** A line's call may begin: from the mic opening, or after a line. */
function callFrom(phase: HarmonyPhase): boolean {
  return phase === 'starting' || phase === 'landed' || phase === 'missed'
}

function startCall(state: HarmonyState, index: number): HarmonyState {
  if (!callFrom(state.phase) || index >= state.lines.length) return state
  return { ...state, phase: 'call', current: index, replays: 0 }
}

/** The turn's outcome, taken once, and only while the singer sings. */
function takeOutcome(state: HarmonyState, outcome: LineOutcome): HarmonyState {
  if (!isSinging(state.phase)) return state
  return {
    ...state,
    phase: outcome.inHarmony ? 'landed' : 'missed',
    outcomes: [...state.outcomes, outcome],
  }
}

export function harmonyReducer(
  state: HarmonyState,
  event: HarmonyEvent,
): HarmonyState {
  switch (event.type) {
    case 'start':
      return {
        ...INITIAL_HARMONY_STATE,
        phase: 'starting',
        run: state.run + 1,
        way: event.way,
        lines: event.lines,
      }
    case 'blocked':
      return state.phase === 'starting' && event.run === state.run
        ? { ...state, phase: 'blocked', block: event.block }
        : state
    case 'call':
      return startCall(state, event.index)
    case 'turn':
      return state.phase === 'call'
        ? { ...state, phase: state.way === 'together' ? 'together' : 'sing' }
        : state
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
      return {
        ...INITIAL_HARMONY_STATE,
        run: state.run,
        way: state.way,
        lines: state.lines,
      }
  }
}
