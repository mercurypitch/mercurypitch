// Flat-course collision — swept stable body against floor boxes and round solid props.

import type { CourseSolid, IntentionalGapDefinition, PlatformDefinition, SolidPropDefinition, Vec3, } from '../contracts'

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

export interface MovingPlatformCollision {
  id: string
  previous: PlatformDefinition
  current: PlatformDefinition
  displacement: Vec3
}

export interface MovingPlatformPushResult {
  position: Vec3
  crushed: boolean
}

/** Replace this adapter for slopes/moving platforms; content and voice rules do not change. */
export interface CourseCollider {
  move(
    position: Vec3,
    displacement: Vec3,
    platforms: readonly CourseSolid[],
    shape: BodyShape,
    intentionalGaps?: readonly IntentionalGapDefinition[],
  ): CollisionResult
}

const EPSILON = 1e-7

export function intentionalGapDefinitionError(
  gap: IntentionalGapDefinition,
): string | undefined {
  if (
    ![gap.minX, gap.maxX, gap.minZ, gap.maxZ, gap.top].every(Number.isFinite) ||
    gap.minX >= gap.maxX ||
    gap.minZ >= gap.maxZ
  )
    return 'bounds and top must be finite, with ordered horizontal bounds'
  return undefined
}

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

/** Finds exact standing support without granting body-width support over a gap. */
export function findSupport(
  position: Vec3,
  shape: BodyShape,
  solids: readonly CourseSolid[],
): CourseSolid | null {
  let support: CourseSolid | null = null
  for (const solid of solids) {
    if (
      Math.abs(position.y - solid.top) > 0.02 ||
      !footprint(position, shape, solid, false) ||
      !supportsFeet(position, solid)
    )
      continue
    if (support === null || solid.top > support.top) support = solid
  }
  return support
}

function segmentIntersectsGap(
  from: Vec3,
  to: Vec3,
  gap: IntentionalGapDefinition,
): boolean {
  let first = 0
  let last = 1
  for (const axis of ['x', 'z'] as const) {
    const start = from[axis]
    const delta = to[axis] - start
    const minimum = axis === 'x' ? gap.minX : gap.minZ
    const maximum = axis === 'x' ? gap.maxX : gap.maxZ
    if (Math.abs(delta) <= EPSILON) {
      if (start <= minimum + EPSILON || start >= maximum - EPSILON) return false
      continue
    }
    const enter = (minimum + EPSILON - start) / delta
    const leave = (maximum - EPSILON - start) / delta
    first = Math.max(first, Math.min(enter, leave))
    last = Math.min(last, Math.max(enter, leave))
    if (first > last) return false
  }
  return last >= 0 && first <= 1
}

function crossesIntentionalGap(
  from: Vec3,
  to: Vec3,
  top: number,
  gaps: readonly IntentionalGapDefinition[],
): boolean {
  // A real jump may land beyond the marked void. This guard only blocks the
  // fixed-step ground contact that could otherwise skip a narrow authored gap.
  if (from.y > top + 0.02) return false
  return gaps.some(
    (gap) =>
      Math.abs(gap.top - top) <= 0.02 && segmentIntersectsGap(from, to, gap),
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

function platformSweptOverlap(
  position: Vec3,
  shape: BodyShape,
  motion: MovingPlatformCollision,
  axis: 'x' | 'z',
): boolean {
  const other = axis === 'x' ? 'z' : 'x'
  const otherMinimum = Math.min(
    other === 'x' ? motion.previous.minX : motion.previous.minZ,
    other === 'x' ? motion.current.minX : motion.current.minZ,
  )
  const otherMaximum = Math.max(
    other === 'x' ? motion.previous.maxX : motion.previous.maxZ,
    other === 'x' ? motion.current.maxX : motion.current.maxZ,
  )
  const bottom = Math.min(
    motion.previous.top - motion.previous.thickness,
    motion.current.top - motion.current.thickness,
  )
  const top = Math.max(motion.previous.top, motion.current.top)
  return (
    overlap(
      position[other] - shape.radius,
      position[other] + shape.radius,
      otherMinimum,
      otherMaximum,
    ) && overlap(position.y, position.y + shape.height, bottom, top)
  )
}

/** Resolves authored platform translation against a non-riding body before input. */
export function resolveMovingPlatformPushes(
  position: Vec3,
  shape: BodyShape,
  motions: readonly MovingPlatformCollision[],
  solids: readonly CourseSolid[],
  collider: CourseCollider,
  ignoredPlatformId: string | null,
  intentionalGaps: readonly IntentionalGapDefinition[] = [],
): MovingPlatformPushResult {
  let next = { ...position }
  let crushed = false
  for (const motion of motions) {
    if (motion.id === ignoredPlatformId) continue
    for (const axis of ['x', 'z'] as const) {
      const delta = motion.displacement[axis]
      if (Math.abs(delta) <= EPSILON) continue
      if (!platformSweptOverlap(next, shape, motion, axis)) continue
      const previousLeading =
        delta > 0
          ? motion.previous[axis === 'x' ? 'maxX' : 'maxZ'] + shape.radius
          : motion.previous[axis === 'x' ? 'minX' : 'minZ'] - shape.radius
      const currentLeading =
        delta > 0
          ? motion.current[axis === 'x' ? 'maxX' : 'maxZ'] + shape.radius
          : motion.current[axis === 'x' ? 'minX' : 'minZ'] - shape.radius
      const crossed =
        delta > 0
          ? next[axis] >= previousLeading - EPSILON &&
            next[axis] < currentLeading
          : next[axis] <= previousLeading + EPSILON &&
            next[axis] > currentLeading
      if (!crossed) continue
      const push = { x: 0, y: 0, z: 0 }
      push[axis] = currentLeading - next[axis]
      const before = next
      const result = collider.move(
        next,
        push,
        solids.filter((solid) => solid.id !== motion.id),
        shape,
        intentionalGaps,
      )
      next = result.position
      if (Math.abs(next[axis] - before[axis] - push[axis]) > EPSILON)
        crushed = true
    }

    const deltaY = motion.displacement.y
    if (Math.abs(deltaY) <= EPSILON) continue
    const inFootprint = footprint(next, shape, motion.current, deltaY < 0)
    if (!inFootprint) continue
    let pushY = 0
    if (
      deltaY > 0 &&
      next.y >= motion.previous.top - EPSILON &&
      next.y < motion.current.top
    )
      pushY = motion.current.top - next.y
    else {
      const previousBottom = motion.previous.top - motion.previous.thickness
      const currentBottom = motion.current.top - motion.current.thickness
      const head = next.y + shape.height
      if (
        deltaY < 0 &&
        head <= previousBottom + EPSILON &&
        head > currentBottom
      )
        pushY = currentBottom - head
    }
    if (pushY !== 0) {
      const beforeY = next.y
      const result = collider.move(
        next,
        { x: 0, y: pushY, z: 0 },
        solids.filter((solid) => solid.id !== motion.id),
        shape,
        intentionalGaps,
      )
      next = result.position
      if (Math.abs(next.y - beforeY - pushY) > EPSILON) crushed = true
    }
  }
  return { position: next, crushed }
}

export const FLAT_COURSE_COLLIDER: CourseCollider = {
  move(position, displacement, platforms, shape, intentionalGaps = []) {
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
        next.y <= p.top &&
        !crossesIntentionalGap(position, next, p.top, intentionalGaps)
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
