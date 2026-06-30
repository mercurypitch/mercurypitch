// ============================================================
// Hysteresis note on/off state machine (Schmitt-trigger style).
//
// Turns a smoothed fractional-MIDI stream into discrete note onsets/offsets.
// A new note is adopted only when the pitch crosses well past the semitone
// boundary (capture deadband), stays there for `debounceFrames`, and the
// current note has lasted at least `minHoldSec`. This is what stops a vibrato
// wobble or a one-frame glitch from fragmenting one held note into several.
// Note boundaries are stamped in beats; timing thresholds use real seconds.
// ============================================================

import type { CompletedNote, OpenNote } from './types'

export interface NoteUpdate {
  /** A note whose boundary was committed on this frame, or null. */
  completed: CompletedNote | null
  /** The note currently being held, or null. */
  open: OpenNote | null
}

export interface NoteStateMachineOptions {
  /**
   * Capture radius (semitones) around a note center: the pitch must be within
   * this of an integer note to "reach" it. Smaller => wider deadband / more
   * hysteresis. Default 0.4 (so you must cross ~60 cents past a boundary).
   */
  enterTolerance?: number
  /** Consecutive in-range frames a new note must hold before adoption. Default 3. */
  debounceFrames?: number
  /** Minimum time (s) the current note must last before switching away. Default 0.1. */
  minHoldSec?: number
  /** Consecutive unvoiced frames before the current note is closed. Default 8. */
  offsetFrames?: number
  /** Notes shorter than this (s) are discarded as garbage. Default 0.07. */
  minNoteDurationSec?: number
}

export interface NoteStateMachine {
  update(midi: number | null, timeSec: number, beat: number): NoteUpdate
  /** Close any open note at the given beat (on stop); ignores min-duration. */
  flush(endBeat: number): CompletedNote | null
  reset(): void
}

export function createNoteStateMachine(
  opts: NoteStateMachineOptions = {},
): NoteStateMachine {
  const enterTolerance = opts.enterTolerance ?? 0.4
  const debounceFrames = Math.max(1, Math.floor(opts.debounceFrames ?? 3))
  const minHoldSec = opts.minHoldSec ?? 0.1
  const offsetFrames = Math.max(1, Math.floor(opts.offsetFrames ?? 8))
  const minNoteDurationSec = opts.minNoteDurationSec ?? 0.07

  let currentMidi: number | null = null
  let noteStartBeat = 0
  let noteStartTime = 0

  let candidateMidi: number | null = null
  let candidateFrames = 0
  let candidateStartBeat = 0
  let candidateStartTime = 0

  let silenceFrames = 0
  let lastVoicedBeat = 0
  let lastVoicedTime = 0

  function open(): OpenNote | null {
    return currentMidi === null
      ? null
      : { midi: currentMidi, startBeat: noteStartBeat }
  }

  function resetCandidate(): void {
    candidateMidi = null
    candidateFrames = 0
  }

  function makeNote(
    midi: number,
    startBeat: number,
    endBeat: number,
    startTime: number,
    endTime: number,
  ): CompletedNote | null {
    if (endBeat <= startBeat) return null
    if (endTime - startTime < minNoteDurationSec) return null
    return { midi, startBeat, endBeat }
  }

  function advanceCandidate(
    target: number,
    beat: number,
    timeSec: number,
  ): void {
    if (candidateMidi === target) {
      candidateFrames++
    } else {
      candidateMidi = target
      candidateFrames = 1
      candidateStartBeat = beat
      candidateStartTime = timeSec
    }
  }

  return {
    update(midi, timeSec, beat): NoteUpdate {
      if (midi === null) {
        resetCandidate()
        silenceFrames++
        if (currentMidi !== null && silenceFrames >= offsetFrames) {
          const completed = makeNote(
            currentMidi,
            noteStartBeat,
            lastVoicedBeat,
            noteStartTime,
            lastVoicedTime,
          )
          currentMidi = null
          return { completed, open: null }
        }
        return { completed: null, open: open() }
      }

      // Voiced frame.
      silenceFrames = 0
      lastVoicedBeat = beat
      lastVoicedTime = timeSec

      const target = Math.round(midi)
      const withinCapture = Math.abs(midi - target) <= enterTolerance

      if (!withinCapture) {
        // In the deadband between two notes — hold current, no new candidate.
        resetCandidate()
        return { completed: null, open: open() }
      }

      if (currentMidi === null) {
        // No active note: build a candidate until it is stable enough to open.
        advanceCandidate(target, beat, timeSec)
        if (candidateFrames >= debounceFrames) {
          currentMidi = target
          noteStartBeat = candidateStartBeat
          noteStartTime = candidateStartTime
          resetCandidate()
          return { completed: null, open: open() }
        }
        return { completed: null, open: null }
      }

      if (target === currentMidi) {
        // Solidly on the current note.
        resetCandidate()
        return { completed: null, open: open() }
      }

      // A different note is in capture range — a potential switch.
      advanceCandidate(target, beat, timeSec)
      const heldLongEnough = timeSec - noteStartTime >= minHoldSec
      if (candidateFrames >= debounceFrames && heldLongEnough) {
        const completed = makeNote(
          currentMidi,
          noteStartBeat,
          candidateStartBeat,
          noteStartTime,
          candidateStartTime,
        )
        currentMidi = target
        noteStartBeat = candidateStartBeat
        noteStartTime = candidateStartTime
        resetCandidate()
        return { completed, open: open() }
      }
      return { completed: null, open: open() }
    },

    flush(endBeat): CompletedNote | null {
      if (currentMidi === null) return null
      const note =
        endBeat > noteStartBeat
          ? { midi: currentMidi, startBeat: noteStartBeat, endBeat }
          : null
      currentMidi = null
      resetCandidate()
      return note
    },

    reset(): void {
      currentMidi = null
      noteStartBeat = 0
      noteStartTime = 0
      resetCandidate()
      silenceFrames = 0
      lastVoicedBeat = 0
      lastVoicedTime = 0
    },
  }
}
