// Terrace layout — shared stair footprints keep planting and ponds out of architectural approaches.

import type { MuseumJourneyStage } from '../content/museum-journey'

export interface JourneyStairway {
  width: number
  frontZ: number
}
export const JOURNEY_STAIRWAYS: Record<
  MuseumJourneyStage['kind'],
  JourneyStairway
> = {
  pavilion: { width: 1.55, frontZ: 1.32 },
  garden: { width: 1.15, frontZ: 0.92 },
  rotunda: { width: 1.78, frontZ: 1.5 },
  twins: { width: 2.25, frontZ: 1.45 },
  conservatory: { width: 2.05, frontZ: 1.68 },
}
export const JOURNEY_TERRACE_SURFACE_OFFSET = 0.035
export const JOURNEY_STAIR_COUNT = 6
export const JOURNEY_STAIR_RUN = 0.16
export const JOURNEY_STAIR_DEPTH = 0.25

export function clearsJourneyStairway(
  stage: MuseumJourneyStage,
  point: { x: number; z: number },
  radius: number,
): boolean {
  const stair = JOURNEY_STAIRWAYS[stage.kind]
  const dx = point.x - stage.architecturePosition[0],
    dz = point.z - stage.architecturePosition[2]
  const sine = Math.sin(stage.yaw),
    cosine = Math.cos(stage.yaw)
  const x = (cosine * dx - sine * dz) / stage.scale
  const z = (sine * dx + cosine * dz) / stage.scale
  const padding = radius / stage.scale + 0.035
  const front = stair.frontZ + JOURNEY_STAIR_DEPTH * 0.5
  const back =
    stair.frontZ -
    (JOURNEY_STAIR_COUNT - 1) * JOURNEY_STAIR_RUN -
    JOURNEY_STAIR_DEPTH * 0.5
  return (
    Math.abs(x) >= stair.width * 0.5 + padding ||
    z < back - padding ||
    z > front + padding
  )
}
