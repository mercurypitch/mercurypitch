// ============================================================
// The range's slides: reading each one from the mic's frames (pure)
// ============================================================
//
// S7b beat 4: the singer slides down as low as feels easy, then up as high
// as feels easy, and the two slides together are the range. Each slide is
// one window of the room kit's capture, read here once a screen frame:
//
//   floor    the first FLOOR_SEC: the room's own noise (first-note.ts)
//   waiting  no voice yet; `nudge` once NUDGE_SEC have gone by
//   sliding  a voiced onset was found (first-note.ts voiceOnset)
//   done     the slide is over: SLIDE_REST_SEC of quiet after at least
//            SLIDE_MIN_SEC of voice (the singer got there and stopped), or
//            SLIDE_MAX_SEC from the onset, whichever comes first
//
// The range itself is the Voice Mirror's (computeRange): every semitone the
// voice dwelt on for 150 ms across both slides, with the octave guard. The
// web's onboarding and the range test read it the same way. A range under
// MIN_RANGE_SEMITONES is a held note, not a slide, and is asked for again.

import type { RangeResult } from '@/lib/mirror/metrics'
import { computeRange } from '@/lib/mirror/metrics'
import type { PitchFrame } from '@/lib/pitch-f0-stream'
import { CONF_MIN } from '@/lib/pitch-measurements/f0'
import { FLOOR_SEC, NUDGE_SEC, voiceOnset } from './first-note'
import { AUDIBLE_RMS } from './note-lane'

/** The longest a slide runs from its onset, s (the web's glide is 8). */
export const SLIDE_MAX_SEC = 8
/** Voice a slide needs before quiet can end it, s. */
export const SLIDE_MIN_SEC = 1.5
/** Quiet after the voice that ends a slide, s. Longer than a breath taken mid-slide. */
export const SLIDE_REST_SEC = 0.9
/** The narrowest range that counts as one: a fourth. Under it, a held note. */
export const MIN_RANGE_SEMITONES = 5

export type SlideReading =
  | { readonly kind: 'floor' }
  | { readonly kind: 'waiting'; readonly nudge: boolean }
  | { readonly kind: 'sliding'; readonly onset: number }
  | {
      readonly kind: 'done'
      /** The slide: its frames from the onset to its end. */
      readonly frames: readonly PitchFrame[]
    }

/** A frame with a voice in it: pitched, sure of it, and loud enough. */
export function heardFrame(frame: PitchFrame): boolean {
  return frame.f0 > 0 && frame.conf >= CONF_MIN && frame.rms >= AUDIBLE_RMS
}

/** Where a slide stands, from every frame since its window opened (oldest first). */
export function readSlide(frames: readonly PitchFrame[]): SlideReading {
  const newest = frames.length === 0 ? 0 : frames[frames.length - 1].t
  if (newest < FLOOR_SEC) return { kind: 'floor' }

  const onset = voiceOnset(frames)
  if (onset === null) return { kind: 'waiting', nudge: newest >= NUDGE_SEC }

  let lastHeard = onset
  for (let i = frames.length - 1; i >= 0 && frames[i].t >= onset; i--) {
    if (heardFrame(frames[i])) {
      lastHeard = frames[i].t
      break
    }
  }
  const atMost = newest - onset >= SLIDE_MAX_SEC
  const stopped =
    lastHeard - onset >= SLIDE_MIN_SEC && newest - lastHeard >= SLIDE_REST_SEC
  if (!atMost && !stopped) return { kind: 'sliding', onset }

  const end = Math.min(newest, onset + SLIDE_MAX_SEC)
  return {
    kind: 'done',
    frames: frames.filter((frame) => frame.t >= onset && frame.t <= end),
  }
}

/** The frames a slide in progress has given so far, from its onset. */
export function slideSoFar(
  frames: readonly PitchFrame[],
  onset: number,
): PitchFrame[] {
  return frames.filter((frame) => frame.t >= onset)
}

export type RangeOutcome =
  | { readonly kind: 'range'; readonly range: RangeResult }
  | { readonly kind: 'narrow'; readonly range: RangeResult }
  | { readonly kind: 'unheard' }

/** What the two slides measured: a range, a held note, or nothing to read. */
export function readRange(
  slides: readonly (readonly PitchFrame[])[],
): RangeOutcome {
  const range = computeRange(slides.map((slide) => [...slide]))
  if (range === null) return { kind: 'unheard' }
  if (range.semitones < MIN_RANGE_SEMITONES) return { kind: 'narrow', range }
  return { kind: 'range', range }
}
