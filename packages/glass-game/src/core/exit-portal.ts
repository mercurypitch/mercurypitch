// Exit portal geometry — one authored aperture drives both swept completion and presentation.

import type { LevelDefinition, Vec3 } from '../contracts'

export const EXIT_PORTAL_HEIGHT = 1.5

const CROSSING_EPSILON = 1e-8
const BLOCKING_EPSILON = 1e-6

export interface ExitPortalGeometry {
  center: Vec3
  normalAxis: 'x' | 'z'
  lateralAxis: 'x' | 'z'
  yaw: number
  width: number
  height: number
  depth: number
  minLateral: number
  maxLateral: number
  bottom: number
  top: number
}

export function deriveExitPortalGeometry(
  exit: LevelDefinition['exit'],
): ExitPortalGeometry {
  const spanX = exit.maxX - exit.minX
  const spanZ = exit.maxZ - exit.minZ
  const normalAxis = spanX >= spanZ ? 'z' : 'x'
  const lateralAxis = normalAxis === 'z' ? 'x' : 'z'
  const minLateral = normalAxis === 'z' ? exit.minX : exit.minZ
  const maxLateral = normalAxis === 'z' ? exit.maxX : exit.maxZ

  return {
    center: {
      x: (exit.minX + exit.maxX) / 2,
      y: exit.top + EXIT_PORTAL_HEIGHT / 2,
      z: (exit.minZ + exit.maxZ) / 2,
    },
    normalAxis,
    lateralAxis,
    yaw: normalAxis === 'z' ? 0 : Math.PI / 2,
    width: maxLateral - minLateral,
    height: EXIT_PORTAL_HEIGHT,
    depth: normalAxis === 'z' ? spanZ : spanX,
    minLateral,
    maxLateral,
    bottom: exit.top,
    top: exit.top + EXIT_PORTAL_HEIGHT,
  }
}

/** True only when a moving player's feet segment enters and crosses the veil. */
export function crossesExitPortal(
  previousFeet: Vec3,
  currentFeet: Vec3,
  portal: ExitPortalGeometry,
  body: { height: number; radius: number },
): boolean {
  const previousNormal =
    previousFeet[portal.normalAxis] - portal.center[portal.normalAxis]
  const currentNormal =
    currentFeet[portal.normalAxis] - portal.center[portal.normalAxis]
  const normalDelta = currentNormal - previousNormal

  if (
    Math.abs(normalDelta) <= CROSSING_EPSILON ||
    Math.abs(previousNormal) <= CROSSING_EPSILON ||
    (previousNormal > 0 && currentNormal > 0) ||
    (previousNormal < 0 && currentNormal < 0)
  )
    return false

  const crossingTime = -previousNormal / normalDelta
  if (crossingTime < 0 || crossingTime > 1) return false

  const lateral =
    previousFeet[portal.lateralAxis] +
    (currentFeet[portal.lateralAxis] - previousFeet[portal.lateralAxis]) *
      crossingTime
  if (
    lateral <= portal.minLateral + body.radius + CROSSING_EPSILON ||
    lateral >= portal.maxLateral - body.radius - CROSSING_EPSILON
  )
    return false

  const feetY = previousFeet.y + (currentFeet.y - previousFeet.y) * crossingTime
  const bodyTop = feetY + body.height
  return (
    feetY < portal.top - CROSSING_EPSILON &&
    bodyTop > portal.bottom + CROSSING_EPSILON
  )
}

/**
 * Resolves a sealed-portal crossing on the side where it began. Players that
 * load on either side remain untouched until they actually cross the plane.
 */
export function blockExitPortalCrossing(
  previousFeet: Vec3,
  currentFeet: Vec3,
  portal: ExitPortalGeometry,
  body: { height: number; radius: number },
): Vec3 | null {
  const previousNormal =
    previousFeet[portal.normalAxis] - portal.center[portal.normalAxis]
  if (Math.abs(previousNormal) <= CROSSING_EPSILON) return null
  const approachSide = previousNormal < 0 ? -1 : 1
  const currentNormal =
    currentFeet[portal.normalAxis] - portal.center[portal.normalAxis]
  const normalDelta = currentNormal - previousNormal
  if (
    normalDelta * approachSide >= -CROSSING_EPSILON ||
    currentNormal * approachSide >= body.radius + BLOCKING_EPSILON
  )
    return null

  const barrierNormal = approachSide * body.radius
  const crossingTime = Math.max(
    0,
    Math.min(1, (barrierNormal - previousNormal) / normalDelta),
  )
  const lateral =
    previousFeet[portal.lateralAxis] +
    (currentFeet[portal.lateralAxis] - previousFeet[portal.lateralAxis]) *
      crossingTime
  if (
    lateral <= portal.minLateral - body.radius + CROSSING_EPSILON ||
    lateral >= portal.maxLateral + body.radius - CROSSING_EPSILON
  )
    return null
  const feetY = previousFeet.y + (currentFeet.y - previousFeet.y) * crossingTime
  if (
    feetY >= portal.top - CROSSING_EPSILON ||
    feetY + body.height <= portal.bottom + CROSSING_EPSILON
  )
    return null

  return {
    ...currentFeet,
    [portal.normalAxis]:
      portal.center[portal.normalAxis] +
      approachSide * (body.radius + BLOCKING_EPSILON),
  }
}
