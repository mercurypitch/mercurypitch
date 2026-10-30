// Studio song test fixture — songs of role lanes, shaped like the three profiling fixtures, for Auto's tests.
import { NEUTRAL_MACROS } from '@/lib/studio-fx/mix-macros'
import type { TrackRole } from '@/lib/studio-fx/role-chains'
import { createStudioTrack } from '../model/defaults'
import type { StudioSongShape } from './song-load'

/**
 * This desktop's voice chain benchmark: a Ryzen 9 5900X in headless
 * Chromium 148, in microseconds per 128 frames (161.9 to 180.3 over the
 * runs of 30 Oct 2026; this is the run the cost table came from).
 */
export const THIS_DESKTOP_US = 167.7

/** The profiling fixtures' lanes, by role: 4, 12 and 24 of them. */
export const SMALL_SONG: readonly TrackRole[] = [
  'voice',
  'acoustic-guitar',
  'bass',
  'drums',
]
export const MEDIUM_SONG: readonly TrackRole[] = [
  'voice',
  'voice',
  'backing-vocals',
  'backing-vocals',
  'acoustic-guitar',
  'acoustic-guitar',
  'electric-guitar',
  'bass',
  'piano',
  'keys',
  'drums',
  'backing',
]
export const LARGE_SONG: readonly TrackRole[] = [
  ...(['voice', 'backing-vocals', 'acoustic-guitar'] as const).flatMap(
    (role) => [role, role, role],
  ),
  ...(['electric-guitar', 'bass', 'piano'] as const).flatMap((role) => [
    role,
    role,
    role,
  ]),
  ...(['keys', 'drums', 'backing'] as const).flatMap((role) => [role, role]),
]

/** A song with a clip on every lane, the lanes at `muted` muted. */
export function roleSong(
  roles: readonly TrackRole[],
  muted: readonly number[] = [],
): StudioSongShape {
  const tracks = roles.map((role, order) => ({
    ...createStudioTrack({ id: `lane-${order}`, name: role, order, role }),
    mute: muted.includes(order),
  }))
  return {
    tracks,
    clips: tracks.map((track) => ({ trackId: track.id })),
    mix: { macros: NEUTRAL_MACROS },
  }
}
