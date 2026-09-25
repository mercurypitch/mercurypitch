// Journey bridge path — one centreline for treads, rails, trail inlays and planting clearance.

import { QuadraticBezierCurve3, Vector3 } from 'three'
import type { MuseumJourneyBridge } from '../content/museum-journey'

export interface JourneyBridgePath {
  curve: QuadraticBezierCurve3
  steps: number
  surfaceHeight(t: number): number
  point(t: number, offset?: number): Vector3
}

/** Endpoints describe terrace walking surfaces, with level landings at both ends. */
export function createJourneyBridgePath(
  bridge: MuseumJourneyBridge,
): JourneyBridgePath {
  const from = new Vector3().fromArray(bridge.from)
  const to = new Vector3().fromArray(bridge.to)
  const delta = to.clone().sub(from)
  const side = new Vector3(-delta.z, 0, delta.x).normalize()
  const middle = from.clone().lerp(to, 0.5).addScaledVector(side, bridge.curve)
  const curve = new QuadraticBezierCurve3(from, middle, to)
  const steps =
    bridge.kind === 'promenade'
      ? 1
      : Math.max(
          3,
          Math.ceil(curve.getLength() / 0.28),
          Math.ceil(Math.abs(delta.y) / 0.07) + 1,
        )
  const surfaceHeight = (t: number): number => {
    if (steps === 1) return from.y + delta.y * t
    const index = Math.min(steps - 1, Math.floor(Math.max(0, t) * steps))
    return from.y + (delta.y * index) / (steps - 1)
  }
  return {
    curve,
    steps,
    surfaceHeight,
    point(t, offset = 0) {
      const point = curve.getPoint(t)
      const tangent = curve.getTangent(t)
      point.addScaledVector(
        new Vector3(-tangent.z, 0, tangent.x).normalize(),
        offset,
      )
      point.y = surfaceHeight(t)
      return point
    },
  }
}
