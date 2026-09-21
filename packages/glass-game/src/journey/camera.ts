// Journey camera — a bounded isometric overview that keeps all three landmasses legible.

import type { Camera, Vector3 } from 'three'
import type { JourneyPoint } from '../content/museum-journey'

const OVERVIEW_TARGET: JourneyPoint = [0, 0.88, 0.18]
export const JOURNEY_DEFAULT_ORBIT = {
  yaw: -0.14,
  pitch: 0.45,
} as const
export const JOURNEY_MIN_INSPECTION_DISTANCE = 6.2

export interface JourneyCameraView {
  target: JourneyPoint
  distance: number
}

export interface JourneyStageProjection {
  x: number
  y: number
  visible: boolean
}

export function journeyCameraView(
  containerWidth: number,
  containerHeight: number,
  selectedFocus: JourneyPoint,
  inspectionZoom = 0,
): JourneyCameraView {
  const aspect = Math.max(0.33, containerWidth / Math.max(1, containerHeight))
  const portrait = containerWidth < 700 || aspect < 0.85
  const zoom = clampJourneyInspectionZoom(inspectionZoom)
  // A wide overview cannot remain legible inside a portrait viewport. Follow
  // its selected gallery; the ordinary gallery rail still reaches every island.
  const overviewFocusWeight = portrait ? 1 : 0.055
  const easedZoom = zoom * zoom * (3 - 2 * zoom)
  const focusWeight =
    overviewFocusWeight + (1 - overviewFocusWeight) * easedZoom
  const overviewDistance = portrait ? 22.4 : 18.8 * Math.max(1, 1.65 / aspect)
  return {
    target: [
      OVERVIEW_TARGET[0] +
        (selectedFocus[0] - OVERVIEW_TARGET[0]) * focusWeight,
      OVERVIEW_TARGET[1] +
        (selectedFocus[1] - OVERVIEW_TARGET[1]) * focusWeight,
      OVERVIEW_TARGET[2] +
        (selectedFocus[2] - OVERVIEW_TARGET[2]) * focusWeight,
    ],
    distance:
      overviewDistance *
      Math.pow(JOURNEY_MIN_INSPECTION_DISTANCE / overviewDistance, zoom),
  }
}

export function clampJourneyInspectionZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return 0
  return Math.max(0, Math.min(1, zoom))
}

export function clampJourneyOrbit(
  yaw: number,
  pitch: number,
  inspectionZoom = 0,
): { yaw: number; pitch: number } {
  const zoom = clampJourneyInspectionZoom(inspectionZoom)
  const minimumYaw = -0.34 + (-1.55 + 0.34) * zoom
  const maximumYaw = 0.08 + (1.27 - 0.08) * zoom
  const minimumPitch = 0.38 + (0.26 - 0.38) * zoom
  const maximumPitch = 0.58 + (0.9 - 0.58) * zoom
  return {
    yaw: Math.max(minimumYaw, Math.min(maximumYaw, yaw)),
    pitch: Math.max(minimumPitch, Math.min(maximumPitch, pitch)),
  }
}

export function projectJourneyStage(
  point: JourneyPoint,
  camera: Camera,
  width: number,
  height: number,
  scratch: Vector3,
): JourneyStageProjection {
  scratch.fromArray(point).project(camera)
  const visible =
    Number.isFinite(scratch.x) &&
    Number.isFinite(scratch.y) &&
    scratch.z >= -1 &&
    scratch.z <= 1 &&
    scratch.x >= -1 &&
    scratch.x <= 1 &&
    scratch.y >= -1 &&
    scratch.y <= 1
  return {
    x: (scratch.x * 0.5 + 0.5) * width,
    y: (-scratch.y * 0.5 + 0.5) * height,
    visible,
  }
}
