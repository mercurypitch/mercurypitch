// Flat-course collision — swept stable body against authored solid platform boxes.

import type { PlatformDefinition, Vec3 } from '../contracts'

export interface BodyShape {
  radius: number
  height: number
}
export interface CollisionResult {
  position: Vec3
  blockedX: boolean
  blockedZ: boolean
  ceiling: boolean
  support: PlatformDefinition | null
}

/** Replace this adapter for slopes/moving platforms; content and voice rules do not change. */
export interface CourseCollider {
  move(
    position: Vec3,
    displacement: Vec3,
    platforms: readonly PlatformDefinition[],
    shape: BodyShape,
  ): CollisionResult
}

const EPSILON = 1e-7

function overlap(
  aMin: number,
  aMax: number,
  bMin: number,
  bMax: number,
): boolean {
  return aMax > bMin + EPSILON && aMin < bMax - EPSILON
}

function footprint(
  position: Vec3,
  shape: BodyShape,
  p: PlatformDefinition,
): boolean {
  return (
    overlap(
      position.x - shape.radius,
      position.x + shape.radius,
      p.minX,
      p.maxX,
    ) &&
    overlap(
      position.z - shape.radius,
      position.z + shape.radius,
      p.minZ,
      p.maxZ,
    )
  )
}

function supportsFeet(position: Vec3, p: PlatformDefinition): boolean {
  // Supporting the outer body would bridge gaps narrower than its diameter.
  // Use the foot centre for floors; the full body still collides with solid sides.
  return (
    position.x >= p.minX &&
    position.x <= p.maxX &&
    position.z >= p.minZ &&
    position.z <= p.maxZ
  )
}

export function containsBody(
  position: Vec3,
  shape: BodyShape,
  p: PlatformDefinition,
): boolean {
  return (
    Math.abs(position.y - p.top) < 0.02 &&
    position.x - shape.radius >= p.minX &&
    position.x + shape.radius <= p.maxX &&
    position.z - shape.radius >= p.minZ &&
    position.z + shape.radius <= p.maxZ
  )
}

export const FLAT_COURSE_COLLIDER: CourseCollider = {
  move(position, displacement, platforms, shape) {
    const next = { ...position }
    const result: CollisionResult = {
      position: next,
      blockedX: false,
      blockedZ: false,
      ceiling: false,
      support: null,
    }

    // Axis sweeps form a conservative box around the round actor. They cannot tunnel
    // through thin side walls, and normal walking across coplanar deck seams is free.
    for (const axis of ['x', 'z'] as const) {
      const movement = displacement[axis]
      const other = axis === 'x' ? 'z' : 'x'
      let end = next[axis] + movement
      for (const p of platforms) {
        if (!overlap(next.y, next.y + shape.height, p.top - p.thickness, p.top))
          continue
        const low = axis === 'x' ? p.minX : p.minZ
        const high = axis === 'x' ? p.maxX : p.maxZ
        const otherLow = other === 'x' ? p.minX : p.minZ
        const otherHigh = other === 'x' ? p.maxX : p.maxZ
        if (
          !overlap(
            next[other] - shape.radius,
            next[other] + shape.radius,
            otherLow,
            otherHigh,
          )
        )
          continue
        if (
          movement > 0 &&
          next[axis] + shape.radius <= low + EPSILON &&
          end + shape.radius > low
        )
          end = Math.min(end, low - shape.radius)
        if (
          movement < 0 &&
          next[axis] - shape.radius >= high - EPSILON &&
          end - shape.radius < high
        )
          end = Math.max(end, high + shape.radius)
      }
      if (Math.abs(end - next[axis] - movement) > EPSILON) {
        if (axis === 'x') result.blockedX = true
        else result.blockedZ = true
      }
      next[axis] = end
    }

    next.y += displacement.y
    for (const p of platforms) {
      if (!footprint(next, shape, p)) continue
      if (
        displacement.y <= 0 &&
        supportsFeet(next, p) &&
        position.y >= p.top - EPSILON &&
        next.y <= p.top
      ) {
        if (result.support === null || p.top > result.support.top) {
          next.y = p.top
          result.support = p
        }
      } else if (displacement.y > 0) {
        const bottom = p.top - p.thickness
        if (
          position.y + shape.height <= bottom + EPSILON &&
          next.y + shape.height >= bottom
        ) {
          next.y = bottom - shape.height
          result.ceiling = true
        }
      }
    }
    return result
  },
}
