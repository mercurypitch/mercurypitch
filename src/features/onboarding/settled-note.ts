// ============================================================
// First Light — naming the one note (pure)
// ============================================================
//
// Beat 2 asks for a single held note and says it back: "That's a G3."
// Getting this wrong is worse than not doing it — the whole beat is a
// claim that we can hear you, so a confident wrong answer costs more
// than a graceful "we didn't catch that".
//
// Reuses the Mirror's `preprocess`, which drops unvoiced and
// low-confidence frames and median-filters what's left, so a stray
// octave flicker at the onset can't name the note.
//
// The reading is the take's middle value, and with an even count the
// lower of the two middle values, never their mean. A take split evenly
// between two notes (the voice moved on, or a slow screen's take closed
// on exactly MIN_VOICED_FRAMES, which is even) has an A4 and a C5 in the
// middle, and their mean is a note nobody sang. The lower middle value is
// always a frame the voice gave, and an odd count reads as before. The
// note held longest was the other choice; it splits a wide vibrato three
// ways around its centre, where the middle value stays on the note heard.

import type { F0Frame } from '@/lib/mirror/metrics'
import { centsToMidi, preprocess } from '@/lib/mirror/metrics'
import { midiToNoteNameOctave } from '@/lib/note-utils'
import { midiFloatToFreq } from '@/lib/pitch-pipeline/log-pitch'

export interface SettledNote {
  midi: number
  /** e.g. 'G3' */
  note: string
  /** The Hz of the frame the note is named from. */
  hz: number
  /** How much voiced material backed the reading, in seconds. */
  voicedSeconds: number
}

/**
 * Enough voiced frames to trust a median. Below this we say we didn't
 * catch it rather than name a note off two frames of a cough.
 */
export const MIN_VOICED_FRAMES = 12

/** Ignore the attack — singers slide into a note before settling. */
export const ONSET_TRIM_SEC = 0.35

/**
 * Name the note held across a take, or null when there wasn't enough
 * voiced material to be sure.
 */
export function settledNote(frames: readonly F0Frame[]): SettledNote | null {
  const voiced = preprocess(frames)
  if (voiced.length === 0) return null

  const start = voiced[0].t + ONSET_TRIM_SEC
  const kept = voiced.filter((f) => f.t >= start)
  // If trimming the onset leaves too little, the take was mostly attack —
  // fall back to everything voiced rather than inventing a reading.
  const usable = kept.length >= MIN_VOICED_FRAMES ? kept : voiced
  if (usable.length < MIN_VOICED_FRAMES) return null

  const cents = lowerMiddle(usable.map((f) => f.cents))
  const midi = centsToMidi(cents)
  // From the same frame as the note, so the number shown is the note named.
  const hz = midiFloatToFreq(cents / 100)

  const span = usable[usable.length - 1].t - usable[0].t

  return {
    midi,
    note: midiToNoteNameOctave(midi),
    hz: Math.round(hz * 10) / 10,
    voicedSeconds: Math.round(span * 100) / 100,
  }
}

/** The middle value; for an even count, the lower of the two. */
function lowerMiddle(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor((sorted.length - 1) / 2)]
}
