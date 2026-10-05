// Song runner blocker contacts — shared quadratic sweeps through boxes or bounded convex vaults.

import { runnerQuadraticRoots } from './continuous-lateral.ts'
import type { CompiledRunnerBlocker, CompiledRunnerCourse, RunnerBlockerCollisionProfile, RunnerBlockerConvexCollisionProfile, } from './contracts.ts'

const EPSILON = 1e-9

export interface RunnerBlockerMotionPiece {
  readonly duration: number
  readonly x: number
  readonly vx: number
  readonly ax: number
  readonly z: number
  readonly vz: number
  readonly y: number
  readonly vy: number
  readonly ay: number
}

interface Point {
  z: number
  y: number
}
interface Plane {
  z: number
  y: number
  minimum: number
}
interface Constraint {
  position: number
  velocity: number
  acceleration: number
  minimum: number
}
interface ExpandedProfile {
  minX: number
  maxX: number
  planes: readonly Plane[]
}

function turn(a: Point, b: Point, c: Point): number {
  return (b.z - a.z) * (c.y - a.y) - (b.y - a.y) * (c.z - a.z)
}

function convexHull(points: readonly Point[]): Point[] {
  const sorted = [...points].sort((a, b) => a.z - b.z || a.y - b.y)
  const lower: Point[] = []
  const upper: Point[] = []
  for (const point of sorted) {
    while (
      lower.length >= 2 &&
      turn(lower.at(-2)!, lower.at(-1)!, point) <= EPSILON
    )
      lower.pop()
    lower.push(point)
  }
  for (const point of sorted.reverse()) {
    while (
      upper.length >= 2 &&
      turn(upper.at(-2)!, upper.at(-1)!, point) <= EPSILON
    )
      upper.pop()
    upper.push(point)
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)]
}

function validVertices(
  vertices: RunnerBlockerConvexCollisionProfile['vertices'],
): boolean {
  if (!Array.isArray(vertices) || vertices.length < 3 || vertices.length > 16)
    return false
  const points = vertices.map(({ zFraction: z, yFraction: y }) => ({ z, y }))
  if (
    points.some(
      ({ z, y }) =>
        !Number.isFinite(z) ||
        !Number.isFinite(y) ||
        z < -0.5 ||
        z > 0.5 ||
        y < 0 ||
        y > 1,
    )
  )
    return false
  const turns = points.map((p, index) =>
    turn(
      p,
      points[(index + 1) % points.length]!,
      points[(index + 2) % points.length]!,
    ),
  )
  return (
    (turns.every((value) => value > EPSILON) ||
      turns.every((value) => value < -EPSILON)) &&
    points.every((point, index) =>
      points.every(
        (other) =>
          Math.sign(turns[0]!) *
            turn(point, points[(index + 1) % points.length]!, other) >=
          -EPSILON,
      ),
    ) &&
    convexHull(points).length === points.length
  )
}

/** Exact union bounds, convex roofs and contiguous bands keep work and empty space bounded. */
export function runnerValidBlockerCollisionProfile(
  profile: RunnerBlockerCollisionProfile,
): boolean {
  let vertices: RunnerBlockerConvexCollisionProfile['vertices']
  if (profile.kind === 'convex-yz') {
    if (!validVertices(profile.vertices)) return false
    vertices = profile.vertices
  } else if (profile.kind === 'convex-yz-bands') {
    if (
      !Array.isArray(profile.bands) ||
      profile.bands.length < 1 ||
      profile.bands.length > 8
    )
      return false
    for (const [index, band] of profile.bands.entries()) {
      if (
        !Number.isFinite(band.minXFraction) ||
        !Number.isFinite(band.maxXFraction) ||
        band.minXFraction < -0.5 ||
        band.maxXFraction > 0.5 ||
        band.minXFraction >= band.maxXFraction ||
        (index === 0
          ? band.minXFraction !== -0.5
          : Math.abs(
              band.minXFraction - profile.bands[index - 1]!.maxXFraction,
            ) > EPSILON) ||
        !validVertices(band.vertices)
      )
        return false
    }
    if (profile.bands.at(-1)!.maxXFraction !== 0.5) return false
    vertices = profile.bands.flatMap((band) => band.vertices)
  } else return false
  return (
    Math.min(...vertices.map((p) => p.zFraction)) === -0.5 &&
    Math.max(...vertices.map((p) => p.zFraction)) === 0.5 &&
    Math.min(...vertices.map((p) => p.yFraction)) === 0 &&
    Math.max(...vertices.map((p) => p.yFraction)) === 1
  )
}

const expandedProfiles = new WeakMap<
  CompiledRunnerBlocker,
  { radius: number; height: number; profiles: readonly ExpandedProfile[] }
>()

function polygonPlanes(
  blocker: CompiledRunnerBlocker,
  vertices: RunnerBlockerConvexCollisionProfile['vertices'],
  radius: number,
  height: number,
): readonly Plane[] {
  const center =
    (blocker.minCourseDistanceMeters + blocker.maxCourseDistanceMeters) / 2
  const depth =
    blocker.maxCourseDistanceMeters - blocker.minCourseDistanceMeters
  const rise = blocker.maxY - blocker.minY
  // Minkowski expansion by the existing body's Z/Y rectangle preserves sloped
  // roof corners, unlike expanding each plane or the enclosing AABB alone.
  const points = vertices.flatMap((vertex) =>
    [-radius, radius].flatMap((zOffset) =>
      [-height, 0].map((yOffset) => ({
        z: center + vertex.zFraction * depth + zOffset,
        y: blocker.minY + vertex.yFraction * rise + yOffset,
      })),
    ),
  )
  const polygon = convexHull(points)
  const planes = polygon.map((point, index) => {
    const next = polygon[(index + 1) % polygon.length]!
    const z = -(next.y - point.y)
    const y = next.z - point.z
    const length = Math.hypot(z, y)
    return {
      z: z / length,
      y: y / length,
      minimum: (z * point.z + y * point.y) / length,
    }
  })
  return planes
}

function profilesFor(
  course: CompiledRunnerCourse,
  blocker: CompiledRunnerBlocker,
): readonly ExpandedProfile[] {
  const radius = course.movement.bodyRadius
  const height = course.movement.bodyHeight
  const cached = expandedProfiles.get(blocker)
  if (cached?.radius === radius && cached.height === height)
    return cached.profiles
  const shape = blocker.collisionProfile!
  const center = (blocker.minLateralX + blocker.maxLateralX) / 2
  const width = blocker.maxLateralX - blocker.minLateralX
  const bands =
    shape.kind === 'convex-yz'
      ? [{ minXFraction: -0.5, maxXFraction: 0.5, vertices: shape.vertices }]
      : shape.bands
  const profiles = bands.map((band) => ({
    minX: center + band.minXFraction * width - radius,
    maxX: center + band.maxXFraction * width + radius,
    planes: polygonPlanes(blocker, band.vertices, radius, height),
  }))
  expandedProfiles.set(blocker, { radius, height, profiles })
  return profiles
}

function axisConstraints(
  position: number,
  velocity: number,
  acceleration: number,
  min: number,
  max: number,
): Constraint[] {
  return [
    { position, velocity, acceleration, minimum: min },
    {
      position: -position,
      velocity: -velocity,
      acceleration: -acceleration,
      minimum: -max,
    },
  ]
}

function intersectsConstraints(
  piece: RunnerBlockerMotionPiece,
  constraints: readonly Constraint[],
): boolean {
  const boundaries = [0, piece.duration]
  for (const constraint of constraints)
    boundaries.push(
      ...runnerQuadraticRoots(
        constraint.acceleration / 2,
        constraint.velocity,
        constraint.position - constraint.minimum,
      ).filter((t) => t > 0 && t < piece.duration),
    )
  boundaries.sort((a, b) => a - b)
  const within = (t: number) =>
    constraints.every(
      (constraint) =>
        constraint.position +
          constraint.velocity * t +
          (constraint.acceleration * t * t) / 2 >=
        constraint.minimum - EPSILON,
    )
  return boundaries.some(
    (t, i) => within(t) || (i > 0 && within((t + boundaries[i - 1]!) / 2)),
  )
}

export function runnerBodyHitsBlocker(
  course: CompiledRunnerCourse,
  blocker: CompiledRunnerBlocker,
  piece: RunnerBlockerMotionPiece,
): boolean {
  const radius = course.movement.bodyRadius
  if (
    piece.z > blocker.maxCourseDistanceMeters + radius + EPSILON ||
    piece.z + piece.vz * piece.duration <
      blocker.minCourseDistanceMeters - radius - EPSILON
  )
    return false
  if (blocker.collisionProfile === undefined)
    return intersectsConstraints(piece, [
      ...axisConstraints(
        piece.x,
        piece.vx,
        piece.ax,
        blocker.minLateralX - radius,
        blocker.maxLateralX + radius,
      ),
      ...axisConstraints(
        piece.z,
        piece.vz,
        0,
        blocker.minCourseDistanceMeters - radius,
        blocker.maxCourseDistanceMeters + radius,
      ),
      ...axisConstraints(
        piece.y,
        piece.vy,
        piece.ay,
        blocker.minY - course.movement.bodyHeight,
        blocker.maxY,
      ),
    ])
  return profilesFor(course, blocker).some((profile) =>
    intersectsConstraints(piece, [
      ...axisConstraints(
        piece.x,
        piece.vx,
        piece.ax,
        profile.minX,
        profile.maxX,
      ),
      ...profile.planes.map((plane) => ({
        position: plane.z * piece.z + plane.y * piece.y,
        velocity: plane.z * piece.vz + plane.y * piece.vy,
        acceleration: plane.y * piece.ay,
        minimum: plane.minimum,
      })),
    ]),
  )
}
