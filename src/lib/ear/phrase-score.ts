// ============================================================
// phrase-score — a sung (or played) phrase judged note by note.
//
// The sing mode of Echo and Span: the player sings the phrase back
// on the count-in grid, and each expected note owns a window on
// that grid. The median pitch of the confident, voiced frames in a
// window — its first third dropped, since the scoop into a note is
// production noise — names the note sung; it counts when it lies
// within `maxCents` of the target, octave-folded the way Home
// listens. A note is judged in its own window only: no tracker
// follows the melody, no alignment is guessed. Silence in a window
// is a miss, not a crash.
//
// Pure. Nothing here opens a microphone.
// ============================================================

import type { F0Frame } from '@/lib/pitch-measurements'
import { degreeSemitone } from './phrase'

export interface NoteWindow {
  /** Seconds from the task's start. */
  startS: number
  endS: number
}

export interface ScoredNote {
  degree: number
  window: NoteWindow
  /** Median MIDI (fractional) of the voiced frames; null when unvoiced. */
  sungMidi: number | null
  /** Signed cents from the target, octave-folded; null when unvoiced. */
  centsOff: number | null
  met: boolean
}

export interface PhraseScore {
  notes: ScoredNote[]
  correct: boolean
  /** 0-based index of the first note not met, or null. */
  firstMiss: number | null
  /** Notes with enough voicing to be judged at all. */
  voicedNotes: number
}

export interface ScoreOptions {
  minConf?: number
  /** Voiced frames a window needs before it is judged. */
  minFrames?: number
  maxCents?: number
}

const DEFAULTS: Required<ScoreOptions> = {
  minConf: 0.5,
  minFrames: 4,
  maxCents: 60,
}

/** Where each note sits on the grid the phrase was played on. */
export function noteWindows(
  count: number,
  noteMs: number,
  gapMs: number,
  leadMs = 0,
): NoteWindow[] {
  const windows: NoteWindow[] = []
  for (let i = 0; i < count; i++) {
    // Millisecond precision: the grid is in ms, and 0.2 + 0.4 in binary
    // is not 0.6.
    const startS = Math.round(leadMs + i * (noteMs + gapMs)) / 1000
    const endS = Math.round(leadMs + i * (noteMs + gapMs) + noteMs) / 1000
    windows.push({ startS, endS })
  }
  return windows
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2
}

function freqToMidi(freq: number): number {
  return 69 + 12 * Math.log2(freq / 440)
}

/** Signed semitones from `midi` to the nearest octave of `target`. */
function foldedSemitones(midi: number, target: number): number {
  let d = ((midi - target) % 12) + 0
  if (d > 6) d -= 12
  if (d < -6) d += 12
  return d
}

export function scorePhrase(
  frames: readonly F0Frame[],
  rootMidi: number,
  degrees: readonly number[],
  windows: readonly NoteWindow[],
  options?: ScoreOptions,
): PhraseScore {
  const opts = { ...DEFAULTS, ...options }
  const notes: ScoredNote[] = degrees.map((degree, i) => {
    const window = windows[i] ?? { startS: 0, endS: 0 }
    const settledFrom = window.startS + (window.endS - window.startS) * 0.3
    const voiced = frames.filter(
      (frame) =>
        frame.t >= settledFrom &&
        frame.t <= window.endS &&
        frame.f0 > 0 &&
        frame.conf >= opts.minConf,
    )
    if (voiced.length < opts.minFrames) {
      return { degree, window, sungMidi: null, centsOff: null, met: false }
    }
    const sungMidi = median(voiced.map((frame) => freqToMidi(frame.f0)))
    const target = rootMidi + degreeSemitone(degree)
    const centsOff = Math.round(foldedSemitones(sungMidi, target) * 100)
    return {
      degree,
      window,
      sungMidi,
      centsOff,
      met: Math.abs(centsOff) <= opts.maxCents,
    }
  })
  const firstMissIndex = notes.findIndex((note) => !note.met)
  return {
    notes,
    correct: firstMissIndex === -1,
    firstMiss: firstMissIndex === -1 ? null : firstMissIndex,
    voicedNotes: notes.filter((note) => note.sungMidi !== null).length,
  }
}
