// ============================================================
// First note: reading one take from the frames the mic has given (pure)
// ============================================================
//
// The web's first light (src/features/onboarding/beats/BeatFirstLight.tsx)
// on the native capture's terms: the room kit hands over every frame since
// the take's window opened, and this says where the take stands. Pure and
// stateless, so a test feeds it frames and the screen asks it once a frame.
//
//   floor    the first FLOOR_SEC: the room's own noise, learned before any
//            of it is judged as a voice (REQ-NFL-031)
//   waiting  no voice yet; `nudge` once NUDGE_SEC have gone by
//   taking   a voiced onset was found (REQ-NFL-032) and the take runs
//            TAKE_SEC from it
//   done     the take is over: the note, named only from a settled reading
//            (settledNote, REQ-NFL-033), or null when there was none
//
// The bar the onset must clear is the web's: the loudest thing in the room
// while it settled, times FLOOR_HEADROOM, never under ONSET_RMS and never
// over LOUD_RMS (a singer already holding a note as the mic opened teaches
// the floor their own voice).

import type { SettledNote } from '@/features/onboarding/settled-note'
import { MIN_VOICED_FRAMES, settledNote, } from '@/features/onboarding/settled-note'
import type { PitchFrame } from '@/lib/pitch-f0-stream'
import { CONF_MIN } from '@/lib/pitch-measurements/f0'

/** How long the room is listened to before anything in it is judged, s. */
export const FLOOR_SEC = 0.6
/** The onset must clear the room's own noise by this much. */
export const FLOOR_HEADROOM = 3.5
/** The bar's lowest, as an RMS level. */
export const ONSET_RMS = 0.01
/** The bar's highest, whatever the room measured. */
export const LOUD_RMS = 0.03
/** Frames in a row above the bar that make an onset. */
export const ONSET_FRAMES = 4
/** The take, from its onset, s. Enough for a settled reading, short enough not to be a chore. */
export const TAKE_SEC = 3
/**
 * The longest a take stays open, s. The pitch stream reads once a screen
 * frame: three seconds is a hundred and eighty frames at sixty a second,
 * but a screen drawing four a second has too few to name a note by then,
 * so the take stays open until it holds enough voice, up to this long.
 */
export const TAKE_MAX_SEC = 6
/** No voice for this long, and the singer gets a plainer ask, s. */
export const NUDGE_SEC = 9

export type TakeReading =
  | { readonly kind: 'floor' }
  | { readonly kind: 'waiting'; readonly nudge: boolean }
  | {
      readonly kind: 'taking'
      readonly onset: number
      /** How much of the take is in, 0..1. */
      readonly progress: number
    }
  | { readonly kind: 'done'; readonly note: SettledNote | null }

/** The bar the room's own noise sets for an onset, as an RMS level. */
export function onsetBar(floor: number): number {
  return Math.min(Math.max(ONSET_RMS, floor * FLOOR_HEADROOM), LOUD_RMS)
}

/** Where a take stands, from every frame since its window opened (oldest first). */
export function readTake(frames: readonly PitchFrame[]): TakeReading {
  const newest = frames.length === 0 ? 0 : frames[frames.length - 1].t
  if (newest < FLOOR_SEC) return { kind: 'floor' }

  let floor = 0
  let i = 0
  for (; i < frames.length && frames[i].t < FLOOR_SEC; i++) {
    floor = Math.max(floor, frames[i].rms)
  }
  const bar = onsetBar(floor)

  let above = 0
  let onset = -1
  for (; i < frames.length; i++) {
    above = frames[i].rms > bar ? above + 1 : 0
    if (above >= ONSET_FRAMES) {
      onset = frames[i - ONSET_FRAMES + 1].t
      break
    }
  }
  if (onset < 0) return { kind: 'waiting', nudge: newest >= NUDGE_SEC }

  const end = onset + TAKE_SEC
  if (newest < end) {
    return { kind: 'taking', onset, progress: (newest - onset) / TAKE_SEC }
  }
  const take = frames.filter((frame) => frame.t >= onset && frame.t <= end)
  if (heardIn(take) >= MIN_VOICED_FRAMES) {
    return { kind: 'done', note: settledNote(take) }
  }
  // Too few frames to judge: a slow screen, or no voice in the sound.
  const longer = frames.filter((frame) => frame.t >= onset)
  if (heardIn(longer) < MIN_VOICED_FRAMES && newest < onset + TAKE_MAX_SEC) {
    return { kind: 'taking', onset, progress: 1 }
  }
  return { kind: 'done', note: settledNote(longer) }
}

/** The frames a settled reading can stand on: voiced, and sure of it. */
function heardIn(frames: readonly PitchFrame[]): number {
  return frames.filter((frame) => frame.f0 > 0 && frame.conf >= CONF_MIN).length
}
