// ============================================================
// Room mic: a premium room's microphone, opened for one start
// ============================================================
//
// Echo, Long note and the glide rooms (Lip roll, Ng slides) open their
// microphone the same way. The singer's tap starts the room: its machine
// goes to `starting` and numbers the start. The mic opens inside that tap,
// since iOS unlocks audio and the mic only from a gesture
// (useExerciseCapture.ts). The opening has up to three steps, each after
// the one before, and a step after the first is taken only while the
// start still stands: the screen alive, the room still `starting`, and
// this start its last. A singer who left the room, or the app, while a
// step ran opens nothing more.
//
//   tone   a note first (Long note's, once it has one): iOS changes the
//          audio session as the mic opens, and the note should not be
//          clipped by it. The note also ends before the take opens, so the
//          mic never hears it as the singer's own.
//   mic    the microphone itself
//   clock  the audio clock, for a room that plays on it (Echo's call, the
//          glide rooms' tones). A clock that will not start fails the
//          start, as a mic that will not open does.
//
// Then the room hears how it went: `onOpen`, or `onFail` with the reason
// (a CaptureError's, else 'unavailable'). An answer for a start that no
// longer stands is dropped: a browser's permission prompt does not block
// the page, so by the time it is answered the singer may have stopped,
// started again or played the demo. If the page went away while the mic
// opened, the room hears that too, once it has opened (`onHidden`).
//
// The steps are `then`s on one another, with no await between. When an
// answer lands among the room's other promises is part of how a start
// races a stop, the screen's end and the next start, so it stays where the
// rooms' own chains had it.

import type { Accessor } from 'solid-js'
import { untrack } from 'solid-js'
import type { CaptureFailure, ExerciseCapture } from './useExerciseCapture'
import { CaptureError } from './useExerciseCapture'

/** What a room's machine says about its starts. */
export interface RoomStartState {
  /** `starting` while a start opens its mic. */
  readonly phase: string
  /** The number of the room's last start. */
  readonly run: number
}

/** One start's mic: the room's capture and state, and what it does next. */
export interface RoomMicStart {
  /** The room's capture (useExerciseCapture.ts). */
  readonly capture: Pick<ExerciseCapture, 'acquire' | 'audio' | 'playTone'>
  /** False once the screen has gone (room-life.ts). */
  readonly alive: () => boolean
  /** The room's state, read untracked: its phase and its last start. */
  readonly state: Accessor<RoomStartState>
  /** A note played before the mic opens. Null or left out: no note. */
  readonly tone?: number | null
  /** The audio clock too, once the mic is open: the room plays on it. */
  readonly clock?: boolean
  /**
   * The mic is open for start `run`. `clock` is the running audio clock
   * when the room asked for it, else null.
   */
  readonly onOpen: (run: number, clock: AudioContext | null) => void
  /** The mic, or the clock, would not open for start `run`. */
  readonly onFail: (run: number, block: CaptureFailure) => void
  /** The page went away while the mic opened: called after `onOpen`. */
  readonly onHidden?: () => void
}

/** Why a start's mic did not open: a CaptureError's reason, else 'unavailable'. */
function captureFailure(error: unknown): CaptureFailure {
  return error instanceof CaptureError ? error.failure : 'unavailable'
}

/**
 * Opens the mic for the room's start now in `starting`. Call it inside the
 * singer's tap: its first step runs before it returns.
 */
export function openRoomMic(start: RoomMicStart): void {
  const { capture } = start
  const { run } = untrack(start.state)
  const stands = (): boolean =>
    start.alive() &&
    untrack(start.state).phase === 'starting' &&
    untrack(start.state).run === run
  const answer = answers(start, run, stands)
  // The note first, then the mic while the start stands; with no note, the
  // mic inside the tap.
  const tone = start.tone ?? null
  const mic: Promise<void> =
    tone === null
      ? capture.acquire()
      : capture
          .playTone(tone)
          .then(() => (stands() ? capture.acquire() : undefined))
  if (start.clock !== true) {
    void mic.then(answer.open, answer.refused)
    return
  }
  // A take the app's leaving dropped meanwhile unlocks nothing.
  void mic
    .then(() => (stands() ? capture.audio() : null))
    .then(answer.clocked, answer.refused)
}

/** What one start does with each answer, while the start stands. */
function answers(start: RoomMicStart, run: number, stands: () => boolean) {
  const open = (clock: AudioContext | null): void => {
    start.onOpen(run, clock)
    // The page went away while the microphone opened.
    if (start.onHidden !== undefined && document.visibilityState === 'hidden') {
      start.onHidden()
    }
  }
  return {
    /** The mic is open, for a room that asked for no clock. */
    open: (): void => {
      if (stands()) open(null)
    },
    /** The mic is open and the clock answered: running, or null. */
    clocked: (clock: AudioContext | null): void => {
      if (!stands()) return
      if (clock === null) start.onFail(run, 'unavailable')
      else open(clock)
    },
    /** A step refused: the note, the mic or the clock. */
    refused: (error: unknown): void => {
      if (stands()) start.onFail(run, captureFailure(error))
    },
  }
}
