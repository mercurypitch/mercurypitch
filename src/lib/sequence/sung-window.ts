// ============================================================
// The notes a room asks a singer for: their window, held to the speaker
// ============================================================
//
// Leap's leaps and Harmony's harmonies sit in the singer's own window (the
// voiceprint's range, else the voice type's: echoWindow in phrase-fit.ts),
// held to what a phone's speaker carries well, as Home note's is. A window
// too narrow or unknown falls back to F3 to F4. Pure.

import { echoWindow } from './phrase-fit'

/** The notes a room may ask for, MIDI, inclusive. */
export interface NoteWindow {
  readonly low: number
  readonly high: number
}

/** The lowest and highest note a room asks a voice for: C3 and E5. */
export const SUNG_LOW = 48
export const SUNG_HIGH = 76
/** With nothing known of the singer: F3 to F4. */
const DEFAULT_WINDOW: NoteWindow = { low: 53, high: 65 }

/** The window a run draws from: the singer's, in the band the speaker carries. */
export function sungWindow(
  singer: { readonly low: number; readonly high: number } | null,
): NoteWindow {
  if (
    singer === null ||
    !Number.isFinite(singer.low) ||
    !Number.isFinite(singer.high) ||
    singer.high < singer.low
  ) {
    return DEFAULT_WINDOW
  }
  const low = Math.max(SUNG_LOW, Math.ceil(singer.low))
  const high = Math.min(SUNG_HIGH, Math.floor(singer.high))
  return high >= low ? { low, high } : DEFAULT_WINDOW
}

/**
 * A singer's window: their voiceprint's range, else their voice type's
 * (echoWindow), held to the band. Leap's rounds and Harmony's lines are
 * planned in it.
 */
export function singerWindow(
  singer: Parameters<typeof echoWindow>[0],
): NoteWindow {
  const window = echoWindow(singer)
  return sungWindow({ low: window.low, high: window.high })
}
