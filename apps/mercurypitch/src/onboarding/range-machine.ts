// ============================================================
// The range's machine: two slides, then a range or another go (pure)
// ============================================================
//
//   ready     waiting for a tap: the range reached from Keep's "Find your
//             range first", or after a stop. Merc already says the first
//             slide, so the tap starts what he asked for
//   starting  the singer tapped (or Find my range): the mic opens inside
//             that tap. Each start is numbered, so the answer to an old one
//             is dropped (room-kit room-mic.ts)
//   down      the mic is open and the first slide is read (range-take.ts)
//   up        the second slide, in a window of its own
//   done      the range is measured: the two pins lock
//   missed    no range in the two slides (`unheard`), or one note held
//             (`narrow`): the mic is shut, a tap slides again
//   blocked   the mic would not open: Merc says why, and the way back;
//             still off after a retry, he says so (`blocks`)
//
// A stop (the mic tapped while it listens, the page or the app going, the
// mic dying, a minute of quiet) goes back to ready, and the slides start
// again from the first (REQ-NFL-046).

import type { CaptureFailure } from '@/components/room-kit/useExerciseCapture'
import type { RangeResult } from '@/lib/mirror/metrics'
import type { RangeOutcome, SlideReading } from './range-take'

export type RangePhase =
  | 'ready'
  | 'starting'
  | 'down'
  | 'up'
  | 'done'
  | 'missed'
  | 'blocked'

export type RangeMiss = 'unheard' | 'narrow'

export interface RangeState {
  readonly phase: RangePhase
  /** The number of the last start; room-mic.ts reads it with the phase. */
  readonly run: number
  /** Why the mic did not open, in `blocked`. */
  readonly block: CaptureFailure | null
  /** The range, once measured. */
  readonly range: RangeResult | null
  /** Why the last two slides gave no range, in `missed`. */
  readonly miss: RangeMiss | null
  /** Opens refused or failed in a row since the mic last opened. */
  readonly blocks: number
}

export type RangeEvent =
  | { readonly type: 'start' }
  | { readonly type: 'mic-ready'; readonly run: number }
  | {
      readonly type: 'mic-failed'
      readonly run: number
      readonly block: CaptureFailure
    }
  /** The first slide is over. */
  | { readonly type: 'slid' }
  /** The second is over, and this is what the two measured. */
  | { readonly type: 'measured'; readonly outcome: RangeOutcome }
  | { readonly type: 'stop' }

export const RANGE_START: RangeState = {
  phase: 'ready',
  run: 0,
  block: null,
  range: null,
  miss: null,
  blocks: 0,
}

const listening = (phase: RangePhase): boolean =>
  phase === 'starting' || phase === 'down' || phase === 'up'

export function rangeReducer(state: RangeState, event: RangeEvent): RangeState {
  switch (event.type) {
    case 'start':
      if (
        state.phase !== 'ready' &&
        state.phase !== 'missed' &&
        state.phase !== 'blocked'
      ) {
        return state
      }
      return {
        phase: 'starting',
        run: state.run + 1,
        block: null,
        range: null,
        miss: null,
        blocks: state.blocks,
      }
    case 'mic-ready':
      if (state.phase !== 'starting' || event.run !== state.run) return state
      return { ...state, phase: 'down', blocks: 0 }
    case 'mic-failed':
      if (state.phase !== 'starting' || event.run !== state.run) return state
      return {
        ...state,
        phase: 'blocked',
        block: event.block,
        blocks: state.blocks + 1,
      }
    case 'slid':
      if (state.phase !== 'down') return state
      return { ...state, phase: 'up' }
    case 'measured':
      if (state.phase !== 'up') return state
      return event.outcome.kind === 'range'
        ? { ...state, phase: 'done', range: event.outcome.range }
        : { ...state, phase: 'missed', miss: event.outcome.kind }
    case 'stop':
      if (!listening(state.phase)) return state
      return { ...state, phase: 'ready' }
  }
}

/** Which of Merc's lines the range shows (onboarding-copy.ts). */
export type RangeLine =
  | 'slide-down'
  | 'slide-up'
  | 'slide-down-nudge'
  | 'slide-up-nudge'
  | 'range'
  | RangeMiss
  /** The mic would not open, and still not after a retry. */
  | 'blocked'
  | 'still-blocked'

/**
 * Merc's line for where the range stands. Blocked: he says why himself,
 * over the mic's notice and its ways back (room-kit MicBlocked).
 */
export function rangeLine(
  state: RangeState,
  reading: SlideReading | null,
): RangeLine | null {
  const nudge = reading?.kind === 'waiting' && reading.nudge
  switch (state.phase) {
    case 'ready':
    case 'starting':
      return 'slide-down'
    case 'down':
      return nudge ? 'slide-down-nudge' : 'slide-down'
    case 'up':
      return nudge ? 'slide-up-nudge' : 'slide-up'
    case 'done':
      return 'range'
    case 'missed':
      return state.miss
    case 'blocked':
      return state.blocks > 1 ? 'still-blocked' : 'blocked'
  }
}
