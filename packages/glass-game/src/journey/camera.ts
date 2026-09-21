// Journey camera — a bounded isometric overview that keeps all three landmasses legible.

import type { Camera, Vector3 } from 'three'
import type { JourneyPoint } from '../content/museum-journey'

const OVERVIEW_TARGET: JourneyPoint = [0, 0.88, 0.18]

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
): JourneyCameraView {
  const aspect = Math.max(0.33, containerWidth / Math.max(1, containerHeight))
  const portrait = containerWidth < 700 || aspect < 0.85
  // A wide overview cannot remain legible inside a portrait viewport. Follow
  // its selected gallery; the ordinary gallery rail still reaches every island.
  const focusWeight = portrait ? 1 : 0.055
  return {
    target: [
      OVERVIEW_TARGET[0] +
        (selectedFocus[0] - OVERVIEW_TARGET[0]) * focusWeight,
      OVERVIEW_TARGET[1] +
        (selectedFocus[1] - OVERVIEW_TARGET[1]) * focusWeight,
      OVERVIEW_TARGET[2] +
        (selectedFocus[2] - OVERVIEW_TARGET[2]) * focusWeight,
    ],
    distance: portrait ? 22.4 : 18.8 * Math.max(1, 1.65 / aspect),
  }
}

export function clampJourneyOrbit(
  yaw: number,
  pitch: number,
): { yaw: number; pitch: number } {
  return {
    yaw: Math.max(-0.34, Math.min(0.08, yaw)),
    pitch: Math.max(0.38, Math.min(0.58, pitch)),
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
