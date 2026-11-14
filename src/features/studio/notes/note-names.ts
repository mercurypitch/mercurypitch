// ============================================================
// Studio note names — a pitch as the note editor names it: C4, F♯3
// ============================================================
//
// Written here rather than taken from lib/note-utils. That module is a chunk
// of its own that the rooms load before their first paint, and two of its
// exports used by the editor for the first time grew it for all of them
// (Piano Night and Karaoke Night by 49 bytes each). The editor loads later,
// and its names can come with it.

/** The twelve names, a sharp written as a sharp sign, as a singer reads it. */
const NAMES = [
  'C',
  'C♯',
  'D',
  'D♯',
  'E',
  'F',
  'F♯',
  'G',
  'G♯',
  'A',
  'A♯',
  'B',
] as const

/** Pitch `pitch` with its octave, middle C as C4: "F♯3". */
export function studioNoteName(pitch: number): string {
  return `${NAMES[((pitch % 12) + 12) % 12]}${Math.floor(pitch / 12) - 1}`
}
