// Journey landmarks — one surface contract for markers, Merc and projected labels.

import type { JourneyPoint, MuseumJourneyStage, } from '../content/museum-journey'

export const JOURNEY_MEDALLION_FACE_Y = 0.153
export const JOURNEY_MEDALLION_SURFACE_Y = 0.16
export const JOURNEY_MEDALLION_CLEARANCE_Y = 0.17

export function journeyMarkerPoint(
  stage: MuseumJourneyStage,
  height = JOURNEY_MEDALLION_SURFACE_Y,
): JourneyPoint {
  return [stage.position[0], stage.position[1] + height, stage.position[2]]
}
