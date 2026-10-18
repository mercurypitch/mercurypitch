// ============================================================
// The low-volume hint's rule: when a premium room says to turn it up
// ============================================================
//
// A room whose notes play at a volume nobody can hear looks broken. The
// phone tells the app its volume (AudioOutput, @irchiinnuss/mobile-runtime),
// on entry and on every change, and this decides from those readings whether
// RoomVolumeHint shows. Pure, so the rule is tested without a phone.
//
// WHERE THE LINE IS. A quarter of the way up or less: the bottom four of an
// iPhone's sixteen volume steps (as widely reported: Apple does not document
// them) and the bottom three of stock Android's fifteen media steps (a maker
// that sets more keeps the same quarter). Neither system publishes its
// volume curve, so this is a chosen line, not a
// measured loudness: low enough that a singer who set a moderate level on
// purpose is left alone, high enough to catch a phone turned all the way
// down and nudged up a step or two. In headphones and Bluetooth only zero
// counts: a quarter is often a comfortable level in the ear.
//
// WHEN IT GOES. The moment the volume rises, even while it is still low:
// the singer is already doing what the hint asks. It comes back only when
// the volume falls into the bottom quarter again, or on a new route that is
// low at the same volume (headphones out, the speaker on).
//
// WHEN IT SAYS ZERO. Only from a reading taken at its word (`volumeKnown`):
// one that follows the volume keys, or an iPhone's two readings agreeing.
// An iPhone's own session can read 0 while the room plays out loud (build
// 880, and iOS 18 on), and the hint said "The volume is at zero" over a
// room the singer could hear. From that reading alone it asks for the
// volume to go up and claims no number.

import type { NativeAudioOutputReading, NativeAudioRoute, } from '@/stores/native-shell-store'

/** At or under this, on the speaker, the hint shows. 0 to 1. */
export const LOW_VOLUME_AT = 0.25

/** Routes in the ear, where only silence is too quiet. */
const IN_EAR: readonly NativeAudioRoute[] = ['headphones', 'bluetooth']

/** Room for a volume read back as 0.25000001. */
const EPSILON = 1e-6

export interface VolumeHint {
  readonly shown: boolean
  /** All the way down, by a reading taken at its word: the hint says so. */
  readonly silent: boolean
  /** The last reading's volume, route and standing; null before the first. */
  readonly volume: number | null
  readonly route: NativeAudioRoute | null
  readonly known: NativeAudioOutputReading['volumeKnown'] | null
}

/** A room just opened: nothing read yet, nothing shown. */
export const VOLUME_HINT_START: VolumeHint = {
  shown: false,
  silent: false,
  volume: null,
  route: null,
  known: null,
}

/** Is this volume too low to hear the room by, on this route? */
export function isLowVolume(reading: NativeAudioOutputReading): boolean {
  const limit = IN_EAR.includes(reading.route) ? 0 : LOW_VOLUME_AT
  return reading.volume <= limit + EPSILON
}

/** The hint after one more reading from the phone. */
export function nextVolumeHint(
  hint: VolumeHint,
  reading: NativeAudioOutputReading,
): VolumeHint {
  const low = isLowVolume(reading)
  let shown: boolean
  if (hint.volume === null || reading.route !== hint.route) {
    shown = low
  } else if (reading.volume > hint.volume) {
    shown = false
  } else if (reading.volume < hint.volume) {
    shown = low
  } else {
    shown = hint.shown && low
  }
  return {
    shown,
    silent: reading.volume <= EPSILON && reading.volumeKnown !== 'session',
    volume: reading.volume,
    route: reading.route,
    known: reading.volumeKnown,
  }
}
