// ============================================================
// Neck helpers — note names, fret markers, cell keys
// ============================================================
//
// Small pure helpers shared by the 3D-neck renderer. The neck itself is drawn
// by the renderer (a perspective plane), so there's no flat-panel drawer here.

import { NOTE_NAMES } from '@/lib/note-utils'

const SINGLE_MARKERS = [3, 5, 7, 9, 15, 17, 19, 21]
const DOUBLE_MARKERS = [12, 24]

export function isFretMarker(fret: number): boolean {
  return SINGLE_MARKERS.includes(fret) || DOUBLE_MARKERS.includes(fret)
}

export function isDoubleFretMarker(fret: number): boolean {
  return DOUBLE_MARKERS.includes(fret)
}

/** Note name (no octave) sounding at a given open-string MIDI + fret. */
export function cellNoteName(openMidi: number, fret: number): string {
  return NOTE_NAMES[(openMidi + fret) % 12]
}

/** Stable key for a (string, fret) cell. */
export function cellKey(stringIndex: number, fret: number): string {
  return `${stringIndex}:${fret}`
}
