// ============================================================
// The first note's machine: one start, one take, one named note (pure)
// ============================================================
//
//   hello     Merc says hello and asks for a note; the demo line plays,
//             silent, and nothing is captured (REQ-NFL-020)
//   starting  the singer tapped: the mic opens inside that tap. Each start
//             is numbered, so the answer to an old one is dropped
//             (room-kit room-mic.ts)
//   listen    the mic is open and the take is read once a frame
//             (first-note.ts). A take with no settled note listens again
//             by itself, up to MAX_AUTO_TAKES (REQ-NFL-035)
//   heard     the note is named
//   missed    no settled note twice: the mic is shut, a tap tries again
//   blocked   the mic would not open: Merc says why, and the way back. A
//             retry that changes nothing (`blocks` past one) has him say it
//             is still off, and where to turn it on
//
// A stop (the mic tapped while it listens, the page or the app going, the
// mic dying under it) goes back to hello, the beat it was on: a singer can
// start again from there (REQ-NFL-037, REQ-NFL-046).

import type { CaptureFailure } from '@/components/room-kit/useExerciseCapture'
import type { SettledNote } from '@/features/onboarding/settled-note'
import type { TakeReading } from './first-note'

export type NotePhase =
  | 'hello'
  | 'starting'
  | 'listen'
  | 'heard'
  | 'missed'
  | 'blocked'

export interface NoteState {
  readonly phase: NotePhase
  /** The number of the last start; room-mic.ts reads it with the phase. */
  readonly run: number
  /** Why the mic did not open, in `blocked`. */
  readonly block: CaptureFailure | null
  /** The note, once heard. */
  readonly note: SettledNote | null
  /** Takes since the last tap that ended with no settled note. */
  readonly misses: number
  /** Opens refused or failed in a row since the mic last opened. */
  readonly blocks: number
}

export type NoteEvent =
  | { readonly type: 'start' }
  | { readonly type: 'mic-ready'; readonly run: number }
  | {
      readonly type: 'mic-failed'
      readonly run: number
      readonly block: CaptureFailure
    }
  | { readonly type: 'heard'; readonly note: SettledNote }
  | { readonly type: 'missed' }
  | { readonly type: 'stop' }

/** Takes a tap is good for before the singer is asked to tap again. */
export const MAX_AUTO_TAKES = 2

export const FIRST_NOTE_START: NoteState = {
  phase: 'hello',
  run: 0,
  block: null,
  note: null,
  misses: 0,
  blocks: 0,
}

export function firstNoteReducer(
  state: NoteState,
  event: NoteEvent,
): NoteState {
  switch (event.type) {
    case 'start':
      if (
        state.phase !== 'hello' &&
        state.phase !== 'missed' &&
        state.phase !== 'blocked'
      ) {
        return state
      }
      return {
        ...state,
        phase: 'starting',
        run: state.run + 1,
        block: null,
        misses: 0,
      }
    case 'mic-ready':
      if (state.phase !== 'starting' || event.run !== state.run) return state
      return { ...state, phase: 'listen', blocks: 0 }
    case 'mic-failed':
      if (state.phase !== 'starting' || event.run !== state.run) return state
      return {
        ...state,
        phase: 'blocked',
        block: event.block,
        blocks: state.blocks + 1,
      }
    case 'heard':
      if (state.phase !== 'listen') return state
      return { ...state, phase: 'heard', note: event.note }
    case 'missed': {
      if (state.phase !== 'listen') return state
      const misses = state.misses + 1
      return misses < MAX_AUTO_TAKES
        ? { ...state, misses }
        : { ...state, phase: 'missed', misses }
    }
    case 'stop':
      if (state.phase !== 'starting' && state.phase !== 'listen') return state
      return { ...state, phase: 'hello', misses: 0 }
  }
}

/** Which of Merc's lines the beat shows (onboarding-copy.ts). */
export type NoteLine =
  | 'hello'
  | 'ask'
  | 'hold'
  | 'nudge'
  | 'wandered'
  | 'missed'
  | 'heard'
  /** The mic would not open: why, in his words (micBlockedLine). */
  | 'blocked'
  /** And a retry changed nothing. */
  | 'still-blocked'

/**
 * Merc's line for where the beat stands. `greeted`: his hello has had its
 * moment, and the ask takes its place. Blocked: Merc says why himself,
 * over the mic's notice and its ways back (room-kit MicBlocked).
 */
export function firstNoteLine(
  state: NoteState,
  reading: TakeReading | null,
  greeted: boolean,
): NoteLine | null {
  switch (state.phase) {
    case 'hello':
      return greeted ? 'ask' : 'hello'
    case 'starting':
      return 'ask'
    case 'listen':
      if (reading?.kind === 'taking') return 'hold'
      if (reading?.kind === 'waiting' && reading.nudge) return 'nudge'
      return state.misses > 0 ? 'wandered' : 'ask'
    case 'heard':
      return 'heard'
    case 'missed':
      return 'missed'
    case 'blocked':
      return state.blocks > 1 ? 'still-blocked' : 'blocked'
  }
}
