// ============================================================
// Settle note — the singer's own note, caught while they sing it (pure)
// ============================================================
//
// With no voiceprint and no note held before, Merc asks for any easy note
// and takes the one the singer settles on. The same reading as First
// Light's naming of a note (Mirror preprocessing, the attack ignored, the
// median), but live: it answers as soon as the end of the current run has
// sat still long enough, and only when every frame of that stretch agrees
// with its median, so a slide into the note is never named.

import type { F0Frame } from '@/lib/mirror/metrics'
import { centsToMidi, median, preprocess } from '@/lib/mirror/metrics'

/** The start of a run is the attack: singers slide into a note. */
export const SETTLE_ONSET_TRIM_SEC = 0.25
/** How long the note sits still before it is named. */
export const SETTLE_SECONDS = 0.6
/** How far any frame of that stretch may stray from its median. */
export const SETTLE_SPREAD_CENTS = 40
/** A longer silence than this starts a new run. */
const RUN_GAP_SEC = 0.15
/** Fewer frames than this are not enough to trust a median. */
const MIN_FRAMES = 12

/**
 * The note the singer has settled on, as a fractional MIDI value, or null
 * while they have not held one still for SETTLE_SECONDS.
 */
export function settleLiveNote(frames: readonly F0Frame[]): number | null {
  const voiced = preprocess(frames)
  if (voiced.length < MIN_FRAMES) return null

  // Back to the start of the latest unbroken run.
  let first = voiced.length - 1
  while (first > 0 && voiced[first].t - voiced[first - 1].t <= RUN_GAP_SEC) {
    first -= 1
  }
  const lastT = voiced[voiced.length - 1].t
  if (lastT - voiced[first].t < SETTLE_ONSET_TRIM_SEC + SETTLE_SECONDS) {
    return null
  }

  const from = lastT - SETTLE_SECONDS
  const stretch: number[] = []
  for (let i = first; i < voiced.length; i++) {
    if (voiced[i].t >= from) stretch.push(voiced[i].cents)
  }
  if (stretch.length < MIN_FRAMES) return null

  const middle = median(stretch)
  for (const cents of stretch) {
    if (Math.abs(cents - middle) > SETTLE_SPREAD_CENTS) return null
  }
  return centsToMidi(middle)
}
