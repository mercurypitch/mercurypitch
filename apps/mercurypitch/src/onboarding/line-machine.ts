// ============================================================
// The sung line's machine: Merc's call, the singer's turn, a score (pure)
// ============================================================
//
//   ready     waiting for the tap: Merc asks, the line is on screen
//   starting  the singer tapped: the mic opens inside that tap. Each start
//             is numbered, so the answer to an old one is dropped
//             (room-kit room-mic.ts)
//   call      the mic is open and Merc sings the line once. Nothing is
//             scored: a singer who sings along with him is welcome to
//   turn      the singer's: two beats counted in, then the line, scored by
//             the Karaoke engine (line-score.ts)
//   done      scored: "8 of 10 notes on pitch" and Merc's word on it. The
//             mic is shut; Once more sings it again, Continue goes on
//   missed    no voice at all in the singer's turn: the mic is shut, and a
//             tap tries again
//   blocked   the mic would not open: why, and the way back
//
// A stop (the mic tapped while it listens, the page or the app going, the
// mic dying) goes back to ready, and the next tap starts with Merc's call.

import type { CaptureFailure } from '@/components/room-kit/useExerciseCapture'
import type { LineScore } from './line-score'

export type LinePhase =
  | 'ready'
  | 'starting'
  | 'call'
  | 'turn'
  | 'done'
  | 'missed'
  | 'blocked'

export interface LineState {
  readonly phase: LinePhase
  /** The number of the last start; room-mic.ts reads it with the phase. */
  readonly run: number
  /** Why the mic did not open, in `blocked`. */
  readonly block: CaptureFailure | null
  /** The score, once the singer's turn is over. */
  readonly score: LineScore | null
}

export type LineEvent =
  | { readonly type: 'start' }
  | { readonly type: 'mic-ready'; readonly run: number }
  | {
      readonly type: 'mic-failed'
      readonly run: number
      readonly block: CaptureFailure
    }
  /** Merc's call is over: the singer's turn. */
  | { readonly type: 'turn' }
  /** The singer's turn is over, and this is its score. */
  | { readonly type: 'scored'; readonly score: LineScore }
  /** The singer's turn is over, and no voice was heard in it. */
  | { readonly type: 'unheard' }
  | { readonly type: 'stop' }

export const LINE_START: LineState = {
  phase: 'ready',
  run: 0,
  block: null,
  score: null,
}

/** The mic is open, or opening: a call or a turn is under way. */
export function lineListening(phase: LinePhase): boolean {
  return phase === 'starting' || phase === 'call' || phase === 'turn'
}

export function lineReducer(state: LineState, event: LineEvent): LineState {
  switch (event.type) {
    case 'start':
      if (lineListening(state.phase)) return state
      return { phase: 'starting', run: state.run + 1, block: null, score: null }
    case 'mic-ready':
      if (state.phase !== 'starting' || event.run !== state.run) return state
      return { ...state, phase: 'call' }
    case 'mic-failed':
      if (state.phase !== 'starting' || event.run !== state.run) return state
      return { ...state, phase: 'blocked', block: event.block }
    case 'turn':
      if (state.phase !== 'call') return state
      return { ...state, phase: 'turn' }
    case 'scored':
      if (state.phase !== 'turn') return state
      return { ...state, phase: 'done', score: event.score }
    case 'unheard':
      if (state.phase !== 'turn') return state
      return { ...state, phase: 'missed' }
    case 'stop':
      if (!lineListening(state.phase)) return state
      return { ...state, phase: 'ready' }
  }
}

/** Which of Merc's lines the line shows (onboarding-copy.ts). */
export type LineSays = 'ask' | 'turn' | 'verdict' | 'unheard'

/** Merc's line for where the line stands. Blocked has none: the mic's notice speaks. */
export function lineSays(state: LineState): LineSays | null {
  switch (state.phase) {
    case 'ready':
    case 'starting':
    case 'call':
      return 'ask'
    case 'turn':
      return 'turn'
    case 'done':
      return 'verdict'
    case 'missed':
      return 'unheard'
    case 'blocked':
      return null
  }
}
