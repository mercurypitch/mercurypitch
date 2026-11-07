// Studio track hues — one colour per lane, the hue of the instrument's family, so a vocal reads as a vocal everywhere.
import type { InstrumentHue } from '@/lib/studio/instruments/glyph-catalog'
import { instrumentFamily } from '@/lib/studio/instruments/glyph-catalog'
import { studioLaneInstrument } from '@/lib/studio/instruments/resolve'
import type { StudioTrack } from '@/lib/studio/model/types'

export type StudioTrackHue = InstrumentHue

// Lanes nothing describes (an uploaded file no name rule reads) take turns
// through the six lane hues, so neighbours differ.
const ROTATION: readonly StudioTrackHue[] = [
  'teal',
  'amber',
  'violet',
  'rose',
  'green',
  'orange',
]

export function studioTrackHue(
  track: Pick<StudioTrack, 'role' | 'name' | 'instrument'>,
  index: number,
): StudioTrackHue {
  const lane = studioLaneInstrument(track)
  return lane.from === 'unknown'
    ? ROTATION[index % ROTATION.length]
    : instrumentFamily(lane.family).hue
}

/** The CSS colour for a hue; the Studio stylesheet defines it per theme. */
export function studioTrackColor(hue: StudioTrackHue): string {
  return `var(--studio-hue-${hue})`
}
