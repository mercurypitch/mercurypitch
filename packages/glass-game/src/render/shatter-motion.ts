// Shatter motion — deterministic profile-driven launches for authored shards and bounded micro debris.

import type { Box3 } from 'three'
import { Vector3 } from 'three'
import type { BreakableRenderRecipe } from './catalog'

export type ShatterProfile = NonNullable<
  BreakableRenderRecipe['shatterProfile']
>

export interface ShatterParticlePlan {
  delay: number
  origin: Vector3
  rotation: Vector3
  scale: Vector3
  shape: 0 | 1 | 2
  spin: Vector3
  velocity: Vector3
}

export interface ShatterMicroPlan {
  chips: readonly ShatterParticlePlan[]
  glints: readonly ShatterParticlePlan[]
  profile: ShatterProfile
}

export interface ShatterShardMotion {
  delay: number
  spin: Vector3
  velocity: Vector3
}

export const SHATTER_MICRO_COUNTS: Readonly<
  Record<ShatterProfile, { chips: number; glints: number }>
> = {
  crown: { chips: 39, glints: 8 },
  radial: { chips: 45, glints: 9 },
  sheet: { chips: 48, glints: 10 },
  'ice-wall': { chips: 72, glints: 14 },
}

interface ShatterBounds {
  centerX: number
  centerY: number
  centerZ: number
  depth: number
  height: number
  maxY: number
  maxZ: number
  minY: number
  span: number
  speed: number
  width: number
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value))
}

function finiteSpan(minimum: number, maximum: number): number {
  const span = maximum - minimum
  return Number.isFinite(span) && span > 0 ? span : 0.1
}

function shatterBounds(bounds: Box3): ShatterBounds {
  const width = finiteSpan(bounds.min.x, bounds.max.x)
  const height = finiteSpan(bounds.min.y, bounds.max.y)
  const depth = finiteSpan(bounds.min.z, bounds.max.z)
  const span = Math.max(width, height, depth)
  const centerX = Number.isFinite(bounds.min.x + bounds.max.x)
    ? (bounds.min.x + bounds.max.x) / 2
    : 0
  const centerY = Number.isFinite(bounds.min.y + bounds.max.y)
    ? (bounds.min.y + bounds.max.y) / 2
    : height / 2
  const centerZ = Number.isFinite(bounds.min.z + bounds.max.z)
    ? (bounds.min.z + bounds.max.z) / 2
    : 0
  return {
    centerX,
    centerY,
    centerZ,
    depth,
    height,
    maxY: Number.isFinite(bounds.max.y) ? bounds.max.y : height,
    maxZ: Number.isFinite(bounds.max.z) ? bounds.max.z : depth / 2,
    minY: Number.isFinite(bounds.min.y) ? bounds.min.y : 0,
    span,
    speed: clamp(span * 0.9, 0.55, 2.8),
    width,
  }
}

function hashString(value: string): number {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

function randomSource(key: string): () => number {
  let state = hashString(key)
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296
  }
}

function signed(random: () => number): number {
  return random() * 2 - 1
}

function radialDirection(
  x: number,
  z: number,
  metrics: ShatterBounds,
  random: () => number,
): { x: number; z: number } {
  let dx = (x - metrics.centerX) / Math.max(metrics.width / 2, 0.01)
  let dz = (z - metrics.centerZ) / Math.max(metrics.depth / 2, 0.01)
  const length = Math.hypot(dx, dz)
  if (length < 0.04) {
    const angle = random() * Math.PI * 2
    dx = Math.cos(angle)
    dz = Math.sin(angle)
  } else {
    dx /= length
    dz /= length
  }
  return { x: dx, z: dz }
}

export function fallbackShatterProfile(
  shape: BreakableRenderRecipe['fallbackShape'],
): ShatterProfile {
  if (shape === 'goblet') return 'crown'
  if (shape === 'slab') return 'sheet'
  return 'radial'
}

export function planShatterShardMotion(
  targetId: string,
  profile: ShatterProfile,
  bounds: Box3,
  centre: Vector3,
  index: number,
): ShatterShardMotion {
  const metrics = shatterBounds(bounds)
  const random = randomSource(`${targetId}:${profile}:shard:${index}`)
  const radial = radialDirection(centre.x, centre.z, metrics, random)
  const normalizedX = clamp(
    (centre.x - metrics.centerX) / Math.max(metrics.width / 2, 0.01),
    -1,
    1,
  )
  const normalizedY = clamp(
    (centre.y - metrics.centerY) / Math.max(metrics.height / 2, 0.01),
    -1,
    1,
  )
  const velocity = new Vector3()
  if (profile === 'crown') {
    const outward = metrics.speed * (0.48 + random() * 0.42)
    velocity.set(
      radial.x * outward,
      metrics.speed * (1.3 + random() * 0.58),
      radial.z * outward,
    )
  } else if (profile === 'radial') {
    const outward = metrics.speed * (0.92 + random() * 0.58)
    velocity.set(
      radial.x * outward,
      metrics.speed * (0.55 + random() * 0.56),
      radial.z * outward,
    )
  } else {
    const wall = profile === 'ice-wall'
    velocity.set(
      metrics.speed *
        (normalizedX * (wall ? 0.72 : 0.46) + signed(random) * 0.24),
      metrics.speed *
        ((wall ? 0.2 : 0.48) +
          normalizedY * (wall ? 0.26 : 0.18) +
          random() * 0.36),
      metrics.speed * ((wall ? 0.88 : 1.08) + random() * 0.62),
    )
  }
  const spinStrength = profile === 'ice-wall' ? 3.8 : 3.1
  return {
    delay:
      random() *
      (profile === 'ice-wall' ? 0.12 : profile === 'sheet' ? 0.1 : 0.075),
    spin: new Vector3(
      signed(random) * spinStrength,
      signed(random) * spinStrength,
      signed(random) * spinStrength,
    ),
    velocity,
  }
}

function particleScale(
  profile: ShatterProfile,
  shape: ShatterParticlePlan['shape'],
  metrics: ShatterBounds,
  random: () => number,
): Vector3 {
  const profileScale = profile === 'ice-wall' ? 0.033 : 0.027
  const base = clamp(metrics.span * profileScale, 0.012, 0.14)
  const variance = 0.68 + random() * 0.78
  if (shape === 0)
    return new Vector3(
      base * variance,
      base * (0.72 + random() * 0.7),
      base * (0.42 + random() * 0.42),
    )
  if (shape === 1)
    return new Vector3(
      base * (0.46 + random() * 0.65),
      base * (0.9 + random() * 0.95),
      base * (0.35 + random() * 0.42),
    )
  return new Vector3(
    base * (0.38 + random() * 0.45),
    base * (1.25 + random() * 1.15),
    base * (0.3 + random() * 0.34),
  )
}

function planChip(
  targetId: string,
  profile: ShatterProfile,
  bounds: Box3,
  index: number,
  count: number,
): ShatterParticlePlan {
  const metrics = shatterBounds(bounds)
  const random = randomSource(`${targetId}:${profile}:chip:${index}`)
  const shape = ((index + Math.floor(random() * 3)) % 3) as 0 | 1 | 2
  const origin = new Vector3()
  const velocity = new Vector3()
  if (profile === 'crown') {
    const angle = Math.PI * 2 * ((index + random() * 0.72) / Math.max(1, count))
    const edge = 0.27 + random() * 0.2
    origin.set(
      metrics.centerX + Math.cos(angle) * metrics.width * edge,
      metrics.minY + metrics.height * (0.56 + random() * 0.4),
      metrics.centerZ + Math.sin(angle) * metrics.depth * edge,
    )
    velocity.set(
      Math.cos(angle) * metrics.speed * (0.55 + random() * 0.62),
      metrics.speed * (1.38 + random() * 0.78),
      Math.sin(angle) * metrics.speed * (0.55 + random() * 0.62),
    )
  } else if (profile === 'radial') {
    const angle = index * 2.3999632297 + random() * 0.5
    const edge = 0.15 + random() * 0.3
    origin.set(
      metrics.centerX + Math.cos(angle) * metrics.width * edge,
      metrics.minY + metrics.height * (0.12 + random() * 0.82),
      metrics.centerZ + Math.sin(angle) * metrics.depth * edge,
    )
    const outward = metrics.speed * (0.95 + random() * 0.75)
    velocity.set(
      Math.cos(angle) * outward,
      metrics.speed * (0.48 + random() * 0.72),
      Math.sin(angle) * outward,
    )
  } else {
    const wall = profile === 'ice-wall'
    const columns = wall ? 9 : 8
    const rows = Math.ceil(count / columns)
    const column = index % columns
    const row = Math.floor(index / columns)
    const horizontal = (column + 0.18 + random() * 0.64) / columns
    const vertical = (row + 0.16 + random() * 0.68) / rows
    const normalizedX = horizontal * 2 - 1
    const normalizedY = vertical * 2 - 1
    origin.set(
      metrics.centerX + normalizedX * metrics.width * 0.47,
      metrics.minY + vertical * metrics.height,
      metrics.maxZ + metrics.depth * 0.03,
    )
    velocity.set(
      metrics.speed *
        (normalizedX * (wall ? 0.78 : 0.5) + signed(random) * 0.28),
      metrics.speed *
        ((wall ? 0.14 : 0.42) +
          normalizedY * (wall ? 0.28 : 0.18) +
          random() * 0.52),
      metrics.speed * ((wall ? 0.86 : 1.06) + random() * 0.74),
    )
  }
  return {
    delay:
      random() *
      (profile === 'ice-wall' ? 0.18 : profile === 'sheet' ? 0.14 : 0.11),
    origin,
    rotation: new Vector3(
      random() * Math.PI,
      random() * Math.PI,
      random() * Math.PI,
    ),
    scale: particleScale(profile, shape, metrics, random),
    shape,
    spin: new Vector3(
      signed(random) * (3.2 + random() * 4.2),
      signed(random) * (3.2 + random() * 4.2),
      signed(random) * (3.2 + random() * 4.2),
    ),
    velocity,
  }
}

export function planShatterMicroBurst(
  targetId: string,
  profile: ShatterProfile,
  bounds: Box3,
): ShatterMicroPlan {
  const counts = SHATTER_MICRO_COUNTS[profile]
  const chips = Array.from({ length: counts.chips }, (_, index) =>
    planChip(targetId, profile, bounds, index, counts.chips),
  )
  const metrics = shatterBounds(bounds)
  const glints = Array.from({ length: counts.glints }, (_, index) => {
    const source =
      chips[
        Math.min(
          chips.length - 1,
          Math.floor(((index + 0.5) / counts.glints) * chips.length),
        )
      ]
    const random = randomSource(`${targetId}:${profile}:glint:${index}`)
    const size = clamp(metrics.span * (0.007 + random() * 0.006), 0.005, 0.045)
    return {
      delay: source.delay + random() * 0.09,
      origin: source.origin.clone(),
      rotation: new Vector3(
        random() * Math.PI,
        random() * Math.PI,
        random() * Math.PI,
      ),
      scale: new Vector3(size, size * (1.2 + random()), size),
      shape: 0 as const,
      spin: source.spin.clone().multiplyScalar(1.35),
      velocity: source.velocity.clone().multiplyScalar(1.08 + random() * 0.2),
    }
  })
  return { chips, glints, profile }
}
