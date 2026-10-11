// ============================================================
// First Light — the sound lane: one sound at a time
// ============================================================
//
// Every sound the onboarding makes goes through one lane: the task demos'
// guide cues, the hold step's reference note and the five match notes.
// Starting a sound stops whatever was playing, so two can never overlap,
// and `busy` says when anything is sounding, which is what keeps "Hear a
// note" disabled until the note before it has finished.
//
// Owner testing on an iPhone, 11 Oct 2026: a note played on arrival at the
// hold step, and tapping "Hear a note" played a different note on top of
// it. Each sound used to be started by whoever wanted it, with nothing
// between them.
//
// A sound may report its own end (`done`); the lane also clears itself on
// a timer of the sound's length, because a demo cue's handle can only be
// stopped, and a suspended context never ends anything.
//
// Whichever way the lane lets go of a sound, it stops it. On a frozen
// clock (iOS 'interrupted' or 'suspended') a sound whose time has run out
// on the wall clock has not played yet: it plays when the clock resumes.
// Letting go without stopping it left two notes to start together on
// resume, or a stale note ringing into a take that `stop` could no longer
// reach (review of PR 977). Stopping a sound that has really ended is a
// no-op.

import type { Accessor } from 'solid-js'
import { createSignal } from 'solid-js'

/** Margin past a sound's length before the lane calls it finished: the
 *  release tail of the tones it carries, so `busy` never clears while the
 *  last of a note is still audible. */
const TAIL_MS = 200

/** A playing sound, as the lane needs it. */
export interface LaneSound {
  /** Fade out and stop now. Safe to call more than once. */
  stop: () => void
  /** Resolves when the sound has finished by itself, when it can say so. */
  done?: Promise<void>
}

export interface SoundLane {
  /**
   * Stop whatever is playing, then start this sound. `seconds` is its
   * length, the fallback for a sound that cannot report its end. The
   * promise resolves when the sound ends or is stopped, and at once when
   * nothing could start (no audio context, say).
   */
  play: (start: () => LaneSound | null, seconds: number) => Promise<void>
  /** Stop the sound that is playing, if any. */
  stop: () => void
  /** True while a sound is playing. */
  busy: Accessor<boolean>
}

interface Playing {
  sound: LaneSound
  timer: ReturnType<typeof setTimeout>
  settle: () => void
}

export function createSoundLane(): SoundLane {
  const [busy, setBusy] = createSignal(false)
  let playing: Playing | null = null

  /** Let go of the current sound, and stop it: a sound the lane no longer
   *  holds must not be able to sound later. */
  const release = (current: Playing): void => {
    if (playing !== current) return
    playing = null
    clearTimeout(current.timer)
    try {
      current.sound.stop()
    } catch {
      // A sound whose context has already closed is silent anyway.
    }
    setBusy(false)
    current.settle()
  }

  const stop = (): void => {
    if (playing !== null) release(playing)
  }

  const play = (
    start: () => LaneSound | null,
    seconds: number,
  ): Promise<void> => {
    stop()
    const sound = start()
    if (sound === null) return Promise.resolve()
    return new Promise<void>((settle) => {
      const current: Playing = {
        sound,
        timer: setTimeout(
          () => release(current),
          Math.max(0, seconds) * 1000 + TAIL_MS,
        ),
        settle,
      }
      playing = current
      setBusy(true)
      void sound.done?.then(() => release(current))
    })
  }

  return { play, stop, busy }
}
