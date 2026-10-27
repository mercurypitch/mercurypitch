// Studio track hues — one colour per lane, chosen by musical role so a vocal reads as a vocal everywhere.
import type { StudioTrack } from '@/lib/studio/model/types'
import type { TrackRole } from '@/lib/studio-fx/role-chains'

export type StudioTrackHue =
  | 'rose'
  | 'amber'
  | 'teal'
  | 'violet'
  | 'green'
  | 'orange'

const ROLE_HUES: Partial<Record<TrackRole, StudioTrackHue>> = {
  voice: 'rose',
  'backing-vocals': 'rose',
  'acoustic-guitar': 'amber',
  'electric-guitar': 'orange',
  bass: 'orange',
  piano: 'teal',
  keys: 'teal',
  drums: 'violet',
  backing: 'green',
}

// Tracks without a known role (uploaded files) take turns so neighbours differ.
const ROTATION: readonly StudioTrackHue[] = [
  'teal',
  'amber',
  'violet',
  'rose',
  'green',
  'orange',
]

export function studioTrackHue(
  track: Pick<StudioTrack, 'role'>,
  index: number,
): StudioTrackHue {
  return ROLE_HUES[track.role] ?? ROTATION[index % ROTATION.length]
}

/** The CSS colour for a hue; the Studio stylesheet defines it per theme. */
export function studioTrackColor(hue: StudioTrackHue): string {
  return `var(--studio-hue-${hue})`
}
