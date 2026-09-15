// Flat-course collision — swept stable body against floor boxes and round solid props.

import type { CourseSolid, PlatformDefinition, SolidPropDefinition, Vec3, } from '../contracts'

export interface BodyShape {
  radius: number
  height: number
}
export interface CollisionResult {
  position: Vec3
  blockedX: boolean
  blockedZ: boolean
  ceiling: boolean
  support: CourseSolid | null
}

/** Replace this adapter for slopes/moving platforms; content and voice rules do not change. */
export interface CourseCollider {
  move(
    position: Vec3,
    displacement: Vec3,
    platforms: readonly CourseSolid[],
    shape: BodyShape,
  ): CollisionResult
}

const EPSILON = 1e-7

type RoundSolid = Extract<SolidPropDefinition, { shape: 'cylinder' }>
const isRound = (solid: CourseSolid): solid is RoundSolid =>
  solid.kind === 'prop' && solid.shape === 'cylinder'

function sideRadius(p: RoundSolid, feet: number, height: number): number {
  const bottom = p.top - p.thickness
  const radius = (y: number) => {
    const t = Math.max(0, Math.min(1, (y - bottom) / p.thickness))
    return p.radiusBottom + (p.radiusTop - p.radiusBottom) * t
  }
  return Math.max(radius(feet), radius(feet + height))
}

function overlap(
  aMin: number,
  aMax: number,
  bMin: number,
  bMax: number,
): boolean {
  return aMax > bMin + EPSILON && aMin < bMax - EPSILON
}

/** An edge step can begin the next sweep inside a prop's expanded side bounds. */
function recoverPropOverlap(
  next: Vec3,
  previous: Vec3,
  shape: BodyShape,
  solid: CourseSolid,
): void {
  if (
    solid.kind !== 'prop' ||
    !overlap(
      next.y,
      next.y + shape.height,
      solid.top - solid.thickness,
      solid.top,
    )
  )
    return
  if (isRound(solid)) {
    const radius = sideRadius(solid, next.y, shape.height) + shape.radius
    const dx = next.x - solid.x,
      dz = next.z - solid.z
    const distance = Math.hypot(dx, dz)
    if (distance >= radius - EPSILON) return
    const directionX = distance > EPSILON ? dx : previous.x - solid.x
    const directionZ = distance > EPSILON ? dz : previous.z - solid.z
    const length = Math.hypot(directionX, directionZ)
    next.x = solid.x + (length > EPSILON ? directionX / length : 1) * radius
    next.z = solid.z + (length > EPSILON ? directionZ / length : 0) * radius
    return
  }
  const minX = solid.minX - shape.radius,
    maxX = solid.maxX + shape.radius
  const minZ = solid.minZ - shape.radius,
    maxZ = solid.maxZ + shape.radius
  if (
    next.x <= minX + EPSILON ||
    next.x >= maxX - EPSILON ||
    next.z <= minZ + EPSILON ||
    next.z >= maxZ - EPSILON
  )
    return
  const contacts = [
    { axis: 'x', value: minX, distance: next.x - minX },
    { axis: 'x', value: maxX, distance: maxX - next.x },
    { axis: 'z', value: minZ, distance: next.z - minZ },
    { axis: 'z', value: maxZ, distance: maxZ - next.z },
  ] as const
  let nearest = contacts[0] as (typeof contacts)[number]
  for (const contact of contacts)
    if (contact.distance < nearest.distance) nearest = contact
  next[nearest.axis] = nearest.value
}

function footprint(
  position: Vec3,
  shape: BodyShape,
  p: CourseSolid,
  underside: boolean,
): boolean {
  if (isRound(p))
    return (
      Math.hypot(position.x - p.x, position.z - p.z) <
      (underside ? p.radiusBottom : p.radiusTop) + shape.radius - EPSILON
    )
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

function supportsFeet(position: Vec3, p: CourseSolid): boolean {
  // Supporting the outer body would bridge gaps narrower than its diameter.
  // Use the foot centre for floors; the full body still collides with solid sides.
  if (isRound(p))
    return Math.hypot(position.x - p.x, position.z - p.z) <= p.radiusTop
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
        let low: number
        let high: number
        if (isRound(p)) {
          // Sweep the circular body against the actual tapered side profile.
          // The separate top test uses feet, so square corners never support Merc.
          const radius = sideRadius(p, next.y, shape.height) + shape.radius
          const distance = next[other] - p[other]
          if (Math.abs(distance) >= radius) continue
          const extent = Math.sqrt(radius * radius - distance * distance)
          low = p[axis] - extent + shape.radius
          high = p[axis] + extent - shape.radius
        } else {
          low = axis === 'x' ? p.minX : p.minZ
          high = axis === 'x' ? p.maxX : p.maxZ
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
        }
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
      if (!footprint(next, shape, p, displacement.y > 0)) continue
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
    // Keep established floor-gap foot-centre semantics. Only props recover side
    // overlap after leaving a rim; this also handles a taper widening during descent.
    for (const p of platforms) {
      const beforeX = next.x,
        beforeZ = next.z
      recoverPropOverlap(next, position, shape, p)
      if ((next.x - beforeX) * displacement.x < -EPSILON) result.blockedX = true
      if ((next.z - beforeZ) * displacement.z < -EPSILON) result.blockedZ = true
    }
    if (result.support && !supportsFeet(next, result.support))
      result.support = null
    return result
  },
}
