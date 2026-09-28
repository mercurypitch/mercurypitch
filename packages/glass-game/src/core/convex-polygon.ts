// Convex horizontal contact helpers — exact support and swept body contact for non-rectangular floors.

import type { BoundsXZ, PointXZ } from '../contracts'

const EPSILON = 1e-9

function cross(a: PointXZ, b: PointXZ, point: PointXZ): number {
  return (b.x - a.x) * (point.z - a.z) - (b.z - a.z) * (point.x - a.x)
}

function signedArea(points: readonly PointXZ[]): number {
  let twiceArea = 0
  for (let index = 0; index < points.length; index++) {
    const current = points[index]!
    const next = points[(index + 1) % points.length]!
    twiceArea += current.x * next.z - next.x * current.z
  }
  return twiceArea / 2
}

/** Returns a stable counter-clockwise copy after validating a strict convex outline. */
export function normalizeConvexPolygon(
  points: readonly PointXZ[],
): readonly PointXZ[] {
  const error = convexPolygonError(points)
  if (error !== undefined) throw new Error(error)
  return signedArea(points) > 0
    ? points.map((point) => ({ ...point }))
    : [...points].reverse().map((point) => ({ ...point }))
}

export function convexPolygonError(
  points: readonly PointXZ[],
): string | undefined {
  if (points.length < 3 || points.length > 16)
    return 'support polygon must contain between 3 and 16 points'
  if (
    !points.every(
      (point) => Number.isFinite(point.x) && Number.isFinite(point.z),
    )
  )
    return 'support polygon points must be finite'
  if (Math.abs(signedArea(points)) <= EPSILON)
    return 'support polygon must enclose a non-zero area'
  const winding = Math.sign(signedArea(points))
  let turn = 0
  for (let index = 0; index < points.length; index++) {
    const a = points[index]!
    const b = points[(index + 1) % points.length]!
    const c = points[(index + 2) % points.length]!
    const edgeLength = Math.hypot(b.x - a.x, b.z - a.z)
    if (edgeLength <= EPSILON)
      return 'support polygon must not contain duplicate adjacent points'
    const value = cross(a, b, c)
    if (Math.abs(value) <= EPSILON)
      return 'support polygon must be strictly convex without collinear edges'
    const direction = Math.sign(value)
    if (turn !== 0 && direction !== turn)
      return 'support polygon must be convex and ordered around its boundary'
    turn = direction
    for (let otherIndex = 0; otherIndex < points.length; otherIndex++) {
      if (otherIndex === index || otherIndex === (index + 1) % points.length)
        continue
      if (cross(a, b, points[otherIndex]!) * winding <= EPSILON)
        return 'support polygon must be convex and ordered around its boundary'
    }
  }
  return undefined
}

export function polygonBounds(points: readonly PointXZ[]): BoundsXZ {
  return {
    minX: Math.min(...points.map((point) => point.x)),
    maxX: Math.max(...points.map((point) => point.x)),
    minZ: Math.min(...points.map((point) => point.z)),
    maxZ: Math.max(...points.map((point) => point.z)),
  }
}

export function pointInConvexPolygon(
  point: PointXZ,
  points: readonly PointXZ[],
): boolean {
  const winding = Math.sign(signedArea(points))
  for (let index = 0; index < points.length; index++) {
    const value = cross(
      points[index]!,
      points[(index + 1) % points.length]!,
      point,
    )
    if (value * winding < -EPSILON) return false
  }
  return true
}

interface ClosestBoundaryPoint {
  point: PointXZ
  distance: number
  edgeIndex: number
}

function closestBoundaryPoint(
  point: PointXZ,
  points: readonly PointXZ[],
): ClosestBoundaryPoint {
  let closest: ClosestBoundaryPoint | undefined
  for (let index = 0; index < points.length; index++) {
    const start = points[index]!
    const end = points[(index + 1) % points.length]!
    const dx = end.x - start.x
    const dz = end.z - start.z
    const denominator = dx * dx + dz * dz
    const projection = Math.max(
      0,
      Math.min(
        1,
        ((point.x - start.x) * dx + (point.z - start.z) * dz) / denominator,
      ),
    )
    const candidate = {
      x: start.x + dx * projection,
      z: start.z + dz * projection,
    }
    const distance = Math.hypot(point.x - candidate.x, point.z - candidate.z)
    if (closest === undefined || distance < closest.distance)
      closest = { point: candidate, distance, edgeIndex: index }
  }
  return closest!
}

export function circleOverlapsConvexPolygon(
  center: PointXZ,
  radius: number,
  points: readonly PointXZ[],
): boolean {
  return (
    pointInConvexPolygon(center, points) ||
    closestBoundaryPoint(center, points).distance < radius - EPSILON
  )
}

export function circleInsideConvexPolygon(
  center: PointXZ,
  radius: number,
  points: readonly PointXZ[],
): boolean {
  const winding = Math.sign(signedArea(points))
  for (let index = 0; index < points.length; index++) {
    const start = points[index]!
    const end = points[(index + 1) % points.length]!
    const edgeLength = Math.hypot(end.x - start.x, end.z - start.z)
    if ((cross(start, end, center) * winding) / edgeLength < radius - EPSILON)
      return false
  }
  return true
}

/** Pushes an overlapping circle to the nearest physical boundary. */
export function separateCircleFromConvexPolygon(
  center: PointXZ,
  radius: number,
  points: readonly PointXZ[],
): PointXZ | undefined {
  const inside = pointInConvexPolygon(center, points)
  const closest = closestBoundaryPoint(center, points)
  if (!inside && closest.distance >= radius - EPSILON) return undefined
  let directionX = center.x - closest.point.x
  let directionZ = center.z - closest.point.z
  let distance = Math.hypot(directionX, directionZ)
  if (inside || distance <= EPSILON) {
    const start = points[closest.edgeIndex]!
    const end = points[(closest.edgeIndex + 1) % points.length]!
    const winding = Math.sign(signedArea(points))
    directionX = winding * (end.z - start.z)
    directionZ = winding * (start.x - end.x)
    distance = Math.hypot(directionX, directionZ)
  }
  return {
    x: closest.point.x + (directionX / distance) * radius,
    z: closest.point.z + (directionZ / distance) * radius,
  }
}

function vertexEntryTime(
  from: PointXZ,
  velocity: PointXZ,
  vertex: PointXZ,
  radius: number,
): number | undefined {
  const offsetX = from.x - vertex.x
  const offsetZ = from.z - vertex.z
  const a = velocity.x * velocity.x + velocity.z * velocity.z
  const b = 2 * (offsetX * velocity.x + offsetZ * velocity.z)
  const c = offsetX * offsetX + offsetZ * offsetZ - radius * radius
  const discriminant = b * b - 4 * a * c
  if (a <= EPSILON || discriminant < 0) return undefined
  const time = (-b - Math.sqrt(discriminant)) / (2 * a)
  if (time < -EPSILON || time > 1 + EPSILON) return undefined
  const clamped = Math.max(0, Math.min(1, time))
  const contactX = offsetX + velocity.x * clamped
  const contactZ = offsetZ + velocity.z * clamped
  if (contactX * velocity.x + contactZ * velocity.z >= -EPSILON)
    return undefined
  return clamped
}

/** Earliest entry of a moving circle into a convex prism's horizontal footprint. */
export function sweepCircleIntoConvexPolygon(
  from: PointXZ,
  to: PointXZ,
  radius: number,
  points: readonly PointXZ[],
): number | undefined {
  if (circleOverlapsConvexPolygon(from, radius, points)) return undefined
  const velocity = { x: to.x - from.x, z: to.z - from.z }
  let first = Number.POSITIVE_INFINITY
  const winding = Math.sign(signedArea(points))
  for (let index = 0; index < points.length; index++) {
    const start = points[index]!
    const end = points[(index + 1) % points.length]!
    const edgeX = end.x - start.x
    const edgeZ = end.z - start.z
    const edgeLength = Math.hypot(edgeX, edgeZ)
    const distanceAtStart = (cross(start, end, from) * winding) / edgeLength
    const distanceDelta =
      ((edgeX * velocity.z - edgeZ * velocity.x) * winding) / edgeLength
    if (distanceDelta > EPSILON) {
      const time = (-radius - distanceAtStart) / distanceDelta
      if (time >= -EPSILON && time <= 1 + EPSILON) {
        const clamped = Math.max(0, Math.min(1, time))
        const centerX = from.x + velocity.x * clamped
        const centerZ = from.z + velocity.z * clamped
        const projection =
          ((centerX - start.x) * edgeX + (centerZ - start.z) * edgeZ) /
          (edgeLength * edgeLength)
        if (projection >= -EPSILON && projection <= 1 + EPSILON)
          first = Math.min(first, clamped)
      }
    }
    const vertexTime = vertexEntryTime(from, velocity, start, radius)
    if (vertexTime !== undefined) first = Math.min(first, vertexTime)
  }
  return Number.isFinite(first) ? first : undefined
}
