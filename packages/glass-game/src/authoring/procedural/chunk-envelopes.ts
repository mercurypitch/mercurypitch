// Procedural envelopes — certified contact geometry and measured intact art bounds.

import { CLOUDWAY_LABORATORY_COURSE_PROFILES } from '../../content/cloudway-laboratory-profiles.ts'
import type { Vec3 } from '../../contracts.ts'
import { compilePlatform } from '../compile-cloudway-platforms.ts'
import type { AssembledPlatform } from './chunk-stitcher.ts'
import type { ChunkJoin, ChunkPlatform } from './contracts.ts'

type EnvelopePlatform = Omit<AssembledPlatform, 'crystalInterior'>

export interface PlatformEnvelope {
  minX: number
  maxX: number
  minY: number
  maxY: number
  minZ: number
  maxZ: number
}

// Intact GLB meshes, excluding shards/contact helpers, after the actual runtime fit.
// Rounded OUT to 0.1 mm. Pearl uses certified support fit (3.2/3.32, 0.72/0.78).
// Scroll includes the extended rollers; frost/raft are runtime-v2, hex mobile-v3.
// This is a conservative visual envelope, not a replacement collision profile.
export const PROCEDURAL_VISUAL_ENVELOPES: Readonly<
  Record<string, PlatformEnvelope>
> = {
  'pearl-rest': {
    minX: -1.6868,
    maxX: 1.6868,
    minY: -0.3904,
    maxY: 0.0233,
    minZ: -0.4442,
    maxZ: 0.4442,
  },
  'frost-lily': {
    minX: -0.9037,
    maxX: 0.9037,
    minY: -0.3537,
    maxY: 0.0353,
    minZ: -1.2001,
    maxZ: 1.2001,
  },
  'aurora-glide': {
    minX: -1.35,
    maxX: 1.35,
    minY: -0.3029,
    maxY: 0.0098,
    minZ: -0.7812,
    maxZ: 0.7812,
  },
  'rose-crackle': {
    minX: -0.8525,
    maxX: 0.8525,
    minY: -0.2541,
    maxY: 0.019,
    minZ: -0.8535,
    maxZ: 0.8535,
  },
  'amethyst-crackle': {
    minX: -0.8501,
    maxX: 0.8501,
    minY: -0.2676,
    maxY: 0.019,
    minZ: -0.5891,
    maxZ: 0.5891,
  },
  'rose-hex-crumble': {
    minX: -1.0443,
    maxX: 1.043,
    minY: -0.4798,
    maxY: 0.0089,
    minZ: -0.9223,
    maxZ: 0.9214,
  },
  'gilt-scroll': {
    minX: -1.3476,
    maxX: 1.3453,
    minY: -0.1804,
    maxY: 0.0809,
    minZ: -1.2,
    maxZ: 1.2,
  },
}

export function compileAssembledPlatform(platform: EnvelopePlatform) {
  const { id, profileId, center, quarterTurns, behavior } = platform
  return compilePlatform(
    {
      id,
      profileId,
      center,
      quarterTurns,
      ...(behavior === undefined ? {} : { behavior }),
    },
    CLOUDWAY_LABORATORY_COURSE_PROFILES,
    `platforms.${id}`,
  )
}

export function platformContactEnvelope(
  platform: EnvelopePlatform,
): PlatformEnvelope {
  const p = compileAssembledPlatform(platform).definition
  return {
    minX: p.minX,
    maxX: p.maxX,
    minZ: p.minZ,
    maxZ: p.maxZ,
    minY: p.top - p.thickness,
    maxY: p.top,
  }
}

export function platformVisualEnvelope(
  platform: EnvelopePlatform,
): PlatformEnvelope {
  const local = PROCEDURAL_VISUAL_ENVELOPES[platform.profileId]
  if (local === undefined)
    throw new Error(`Unknown visual profile: ${platform.profileId}`)
  const q = ((platform.quarterTurns % 4) + 4) % 4
  const corners = [
    [local.minX, local.minZ],
    [local.maxX, local.minZ],
    [local.minX, local.maxZ],
    [local.maxX, local.maxZ],
  ].map(([x, z]) =>
    q === 0 ? [x, z] : q === 1 ? [z, -x] : q === 2 ? [-x, -z] : [-z, x],
  )
  return {
    minX: platform.center.x + Math.min(...corners.map((p) => p[0])),
    maxX: platform.center.x + Math.max(...corners.map((p) => p[0])),
    minY: platform.center.y + local.minY,
    maxY: platform.center.y + local.maxY,
    minZ: platform.center.z + Math.min(...corners.map((p) => p[1])),
    maxZ: platform.center.z + Math.max(...corners.map((p) => p[1])),
  }
}

export function sweepEnvelope(
  box: PlatformEnvelope,
  translation?: Vec3,
): PlatformEnvelope {
  if (translation === undefined) return box
  return {
    minX: box.minX + Math.min(0, translation.x),
    maxX: box.maxX + Math.max(0, translation.x),
    minY: box.minY + Math.min(0, translation.y),
    maxY: box.maxY + Math.max(0, translation.y),
    minZ: box.minZ + Math.min(0, translation.z),
    maxZ: box.maxZ + Math.max(0, translation.z),
  }
}

export function envelopesIntersect(
  a: PlatformEnvelope,
  b: PlatformEnvelope,
): boolean {
  return (
    Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX) > 0.001 &&
    Math.min(a.maxY, b.maxY) - Math.max(a.minY, b.minY) > 0.001 &&
    Math.min(a.maxZ, b.maxZ) - Math.max(a.minZ, b.minZ) > 0.001
  )
}

export function isPearlButtSeam(
  a: EnvelopePlatform,
  b: EnvelopePlatform,
): boolean {
  if (
    a.profileId !== 'pearl-rest' ||
    b.profileId !== 'pearl-rest' ||
    a.behavior !== undefined ||
    b.behavior !== undefined ||
    a.quarterTurns !== b.quarterTurns ||
    Math.abs(a.center.y - b.center.y) > 0.0001
  )
    return false
  const aa = platformContactEnvelope(a),
    bb = platformContactEnvelope(b)
  const sameX =
    Math.abs(aa.minX - bb.minX) < 0.0001 && Math.abs(aa.maxX - bb.maxX) < 0.0001
  const sameZ =
    Math.abs(aa.minZ - bb.minZ) < 0.0001 && Math.abs(aa.maxZ - bb.maxZ) < 0.0001
  return (
    (sameX &&
      Math.abs(Math.abs(a.center.z - b.center.z) - (aa.maxZ - aa.minZ)) <
        0.0001) ||
    (sameZ &&
      Math.abs(Math.abs(a.center.x - b.center.x) - (aa.maxX - aa.minX)) <
        0.0001)
  )
}

/** Factories explicitly opt their matching coplanar court tiles into decorative seam reporting. */
export function declarePearlButtJoins(
  platforms: readonly ChunkPlatform[],
): readonly ChunkJoin[] {
  const joins: ChunkJoin[] = []
  for (let i = 0; i < platforms.length; i++)
    for (let j = i + 1; j < platforms.length; j++) {
      const a = platforms[i],
        b = platforms[j]
      if (
        isPearlButtSeam(
          { ...a, id: a.localId, quarterTurns: a.quarterTurns ?? 0 },
          { ...b, id: b.localId, quarterTurns: b.quarterTurns ?? 0 },
        )
      )
        joins.push({
          platformALocalId: a.localId,
          platformBLocalId: b.localId,
          kind: 'pearl-butt-seam',
        })
    }
  return joins
}
