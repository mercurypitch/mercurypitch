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

import type { F0Frame } from '@/lib/mirror/metrics'
import { centsToMidi, median, preprocess } from '@/lib/mirror/metrics'
import { midiToNoteNameOctave } from '@/lib/note-utils'

export interface SettledNote {
  midi: number
  /** e.g. 'G3' */
  note: string
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

  const centsValues = usable.map((f) => f.cents)
  const midi = Math.round(centsToMidi(median(centsValues)))

  // Hz from the raw frames that survived preprocessing, so the number
  // shown matches the note named.
  const hzValues = frames
    .filter((f) => f.f0 > 0)
    .map((f) => f.f0)
    .sort((a, b) => a - b)
  const hz = hzValues.length > 0 ? median(hzValues) : 0

  const span = usable[usable.length - 1].t - usable[0].t

  return {
    midi,
    note: midiToNoteNameOctave(midi),
    hz: Math.round(hz * 10) / 10,
    voicedSeconds: Math.round(span * 100) / 100,
  }
}
