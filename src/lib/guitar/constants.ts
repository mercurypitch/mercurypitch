// ============================================================
// Guitar Constants — shared across all guitar practice modules
// ============================================================

/** MIDI numbers for the 6 open strings (high e to low E). */
export const OPEN_MIDI: readonly number[] = [64, 59, 55, 50, 45, 40]

/** String labels from high e to low E. */
export const STRING_LABELS: readonly string[] = ['e', 'B', 'G', 'D', 'A', 'E']

/** Maximum fret position on the practice fretboard. */
export const MAX_FRET = 15

/** Standard fret marker positions (dot inlays). */
export const FRET_MARKERS: readonly number[] = [3, 5, 7, 9, 12, 15]

/** Fret position that gets a double-dot marker. */
export const DOUBLE_FRET_MARKER = 12
