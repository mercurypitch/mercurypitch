// Chunk stitcher — transforms and connects modular chunks along cardinal directions into world space.

import type { Vec3 } from '../../contracts.ts'
import type {
  CardinalDirection,
  ChunkExitBounds,
  ProceduralChunk,
} from './contracts.ts'

export interface AssembledPlatform {
  readonly id: string
  readonly profileId: string
  readonly center: Vec3
  readonly quarterTurns: number
  readonly behavior?: unknown
  readonly crystalInterior?: {
    preset: string
    seed: number
  }
}

export interface AssembledGap {
  readonly id: string
  readonly platformAId: string
  readonly platformBId: string
  readonly minimumClearanceMeters: number
  readonly axis: 'x' | 'z'
}

export interface AssembledEncounter {
  readonly id: string
  readonly role: 'note' | 'gate' | 'finale' | 'optional-discovery'
  readonly label: string
  readonly variant: string
  readonly position: Vec3
  readonly anchor: Vec3
  readonly noteAnchorId?: string
  readonly discoveryCoinIds?: readonly string[]
  readonly requiresCompleted: readonly string[]
  readonly presentationBarrier?: {
    profileId: string
    facingYaw: number
  }
}

export interface AssembledCheckpoint {
  readonly id: string
  readonly position: Vec3
  readonly facingYaw: number
  readonly radius: number
  readonly requiresCompleted?: readonly string[]
}

export interface AssembledCameraSection {
  readonly id: string
  readonly platformIds: readonly string[]
  readonly lookFromPlatformId: string
  readonly lookToPlatformId: string
}

export interface AssembledCourseData {
  readonly platforms: readonly AssembledPlatform[]
  readonly gaps: readonly AssembledGap[]
  readonly encounters: readonly AssembledEncounter[]
  readonly checkpoints: readonly AssembledCheckpoint[]
  readonly cameraSections: readonly AssembledCameraSection[]
  readonly bounds: {
    minX: number
    maxX: number
    minY: number
    maxY: number
    minZ: number
    maxZ: number
  }
  readonly exitPosition: Vec3
  readonly exitBounds?: ChunkExitBounds
  readonly finalHeading: CardinalDirection
}

const PROFILE_DIMENSIONS: Readonly<
  Record<string, { readonly width: number; readonly depth: number }>
> = {
  'pearl-rest': { width: 3.2, depth: 0.72 },
  'frost-lily': { width: 1.65, depth: 2.2 },
  'rose-hex-crumble': { width: 1.969, depth: 1.738 },
  'rose-crackle': { width: 1.64, depth: 1.64 },
  'amethyst-crackle': { width: 1.64, depth: 1.1 },
  'gilt-scroll': { width: 2.206, depth: 2.206 },
  'aurora-glide': { width: 2.55, depth: 1.4 },
}

export function hasAssembledPlatformOverlap(
  platforms: readonly AssembledPlatform[],
): boolean {
  const boxes = platforms.map((p) => {
    const dims = PROFILE_DIMENSIONS[p.profileId] ?? { width: 3.2, depth: 0.72 }
    const rotated = Math.abs(p.quarterTurns) % 2 === 1
    const halfX = (rotated ? dims.depth : dims.width) / 2
    const halfZ = (rotated ? dims.width : dims.depth) / 2
    const behavior = p.behavior as
      | { kind?: string; translation?: Vec3 }
      | undefined
    const tx = behavior?.kind === 'glide' ? (behavior.translation?.x ?? 0) : 0
    const tz = behavior?.kind === 'glide' ? (behavior.translation?.z ?? 0) : 0
    return {
      minX: p.center.x - halfX + Math.min(0, tx),
      maxX: p.center.x + halfX + Math.max(0, tx),
      minZ: p.center.z - halfZ + Math.min(0, tz),
      maxZ: p.center.z + halfZ + Math.max(0, tz),
    }
  })

  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i]!
      const b = boxes[j]!
      const xOverlap = Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX)
      const zOverlap = Math.min(a.maxZ, b.maxZ) - Math.max(a.minZ, b.minZ)
      if (xOverlap > 0.01 && zOverlap > 0.01) {
        return true
      }
    }
  }
  return false
}

function rotatePoint(local: Vec3, heading: CardinalDirection): Vec3 {
  switch (heading) {
    case 'north':
      return { x: local.x, y: local.y, z: local.z }
    case 'east':
      return { x: local.z, y: local.y, z: -local.x }
    case 'south':
      return { x: -local.x, y: local.y, z: -local.z }
    case 'west':
      return { x: -local.z, y: local.y, z: local.x }
  }
}

function headingToQuarterTurns(heading: CardinalDirection): number {
  switch (heading) {
    case 'north':
      return 0
    case 'east':
      return 1
    case 'south':
      return 2
    case 'west':
      return 3
  }
}

function headingToYaw(heading: CardinalDirection): number {
  switch (heading) {
    case 'north':
      return 0
    case 'east':
      return Math.PI / 2
    case 'south':
      return Math.PI
    case 'west':
      return (3 * Math.PI) / 2
  }
}

const CARDINALS: readonly CardinalDirection[] = [
  'north',
  'east',
  'south',
  'west',
]

export function turnHeading(
  current: CardinalDirection,
  turn: CardinalDirection,
): CardinalDirection {
  const currentIdx = CARDINALS.indexOf(current)
  const turnIdx = CARDINALS.indexOf(turn)
  return CARDINALS[(currentIdx + turnIdx) % 4]!
}

export function stitchChunks(
  chunks: readonly ProceduralChunk[],
): AssembledCourseData {
  const assembledPlatforms: AssembledPlatform[] = []
  const assembledGaps: AssembledGap[] = []
  const assembledEncounters: AssembledEncounter[] = []
  const assembledCheckpoints: AssembledCheckpoint[] = []
  const assembledCameraSections: AssembledCameraSection[] = []

  let currentHeading: CardinalDirection = 'north'
  let currentOrigin: Vec3 = { x: 0, y: 0, z: 0 }
  let assembledExitBounds: ChunkExitBounds | undefined = undefined
  let lastExitPlatformId: string | null = null
  let lastCompletedEncounterId: string | null = null

  let minX = 0
  let maxX = 0
  let minY = 0
  let maxY = 0
  let minZ = 0
  let maxZ = 0

  for (let cIdx = 0; cIdx < chunks.length; cIdx++) {
    const chunk = chunks[cIdx]!
    const chunkPrefix = `proc-c${cIdx + 1}`
    const quarterTurnOffset = headingToQuarterTurns(currentHeading)
    const baseYaw = headingToYaw(currentHeading)
    const chunkEntryEncounterId = lastCompletedEncounterId

    // Map of local platform IDs to global platform IDs
    const idMap = new Map<string, string>()

    for (const p of chunk.platforms) {
      const globalId = `${chunkPrefix}-${p.localId}`
      idMap.set(p.localId, globalId)

      const rotatedCenter = rotatePoint(p.center, currentHeading)
      const worldCenter: Vec3 = {
        x: Number((currentOrigin.x + rotatedCenter.x).toFixed(3)),
        y: Number((currentOrigin.y + rotatedCenter.y).toFixed(3)),
        z: Number((currentOrigin.z + rotatedCenter.z).toFixed(3)),
      }

      minX = Math.min(minX, worldCenter.x - 2.5)
      maxX = Math.max(maxX, worldCenter.x + 2.5)
      minY = Math.min(minY, worldCenter.y)
      maxY = Math.max(maxY, worldCenter.y)
      minZ = Math.min(minZ, worldCenter.z - 2.5)
      maxZ = Math.max(maxZ, worldCenter.z + 2.5)

      let behavior: unknown = undefined
      if (p.behavior) {
        if (p.behavior.kind === 'glide' && p.behavior.translation) {
          const rotatedTranslation = rotatePoint(
            p.behavior.translation,
            currentHeading,
          )
          behavior = {
            kind: 'glide',
            translation: {
              x: Number(rotatedTranslation.x.toFixed(3)),
              y: Number(rotatedTranslation.y.toFixed(3)),
              z: Number(rotatedTranslation.z.toFixed(3)),
            },
            travelSeconds: p.behavior.travelSeconds ?? 3.2,
            dwellSeconds: p.behavior.dwellSeconds ?? 1.2,
          }
          minY = Math.min(minY, worldCenter.y + rotatedTranslation.y)
          maxY = Math.max(maxY, worldCenter.y + rotatedTranslation.y)
        } else {
          behavior = { ...p.behavior }
        }
      }

      assembledPlatforms.push({
        id: globalId,
        profileId: p.profileId,
        center: worldCenter,
        quarterTurns: ((p.quarterTurns ?? 0) + quarterTurnOffset) % 4,
        behavior,
        crystalInterior: p.crystalInterior
          ? {
              preset: p.crystalInterior.preset,
              seed: p.crystalInterior.seed ?? 20261006 + cIdx,
            }
          : undefined,
      })
    }

    // Inter-chunk gap connecting last platform of previous chunk to first platform of this chunk
    if (lastExitPlatformId !== null && chunk.platforms.length > 0) {
      const firstPlatformGlobalId = idMap.get(chunk.platforms[0]!.localId)!
      assembledGaps.push({
        id: `proc-intergap-${cIdx}`,
        platformAId: lastExitPlatformId,
        platformBId: firstPlatformGlobalId,
        minimumClearanceMeters: 0.55,
        axis:
          currentHeading === 'east' || currentHeading === 'west' ? 'x' : 'z',
      })
    }

    // Internal chunk gaps
    for (const g of chunk.gaps) {
      const platA = idMap.get(g.platformALocalId)!
      const platB = idMap.get(g.platformBLocalId)!
      assembledGaps.push({
        id: `${chunkPrefix}-${g.localId}`,
        platformAId: platA,
        platformBId: platB,
        minimumClearanceMeters: g.minimumClearanceMeters,
        axis:
          currentHeading === 'east' || currentHeading === 'west'
            ? g.axis === 'z'
              ? 'x'
              : 'z'
            : g.axis,
      })
    }

    // Checkpoints (require the station completed prior to entering this chunk)
    if (chunk.checkpoints) {
      for (const cp of chunk.checkpoints) {
        const rotatedPos = rotatePoint(cp.position, currentHeading)
        assembledCheckpoints.push({
          id: `${chunkPrefix}-${cp.localId}`,
          position: {
            x: Number((currentOrigin.x + rotatedPos.x).toFixed(3)),
            y: Number((currentOrigin.y + rotatedPos.y).toFixed(3)),
            z: Number((currentOrigin.z + rotatedPos.z).toFixed(3)),
          },
          facingYaw: cp.facingYaw + baseYaw,
          radius: cp.radius,
          ...(chunkEntryEncounterId !== null
            ? { requiresCompleted: [chunkEntryEncounterId] }
            : {}),
        })
      }
    }

    // Encounters
    if (chunk.encounters) {
      for (const e of chunk.encounters) {
        const encounterId = `${chunkPrefix}-${e.localId}`
        const rotatedPos = rotatePoint(e.position, currentHeading)
        const rotatedAnchor = rotatePoint(e.anchor, currentHeading)

        const worldPos: Vec3 = {
          x: Number((currentOrigin.x + rotatedPos.x).toFixed(3)),
          y: Number((currentOrigin.y + rotatedPos.y).toFixed(3)),
          z: Number((currentOrigin.z + rotatedPos.z).toFixed(3)),
        }
        const worldAnchor: Vec3 = {
          x: Number((currentOrigin.x + rotatedAnchor.x).toFixed(3)),
          y: Number((currentOrigin.y + rotatedAnchor.y).toFixed(3)),
          z: Number((currentOrigin.z + rotatedAnchor.z).toFixed(3)),
        }

        const isOptional = e.role === 'optional-discovery'
        const prerequisiteId = isOptional
          ? chunkEntryEncounterId
          : lastCompletedEncounterId
        const requiresCompleted: string[] =
          prerequisiteId !== null ? [prerequisiteId] : []

        assembledEncounters.push({
          id: encounterId,
          role: e.role,
          label: e.label,
          variant: e.variant,
          position: worldPos,
          anchor: worldAnchor,
          noteAnchorId: e.noteAnchorId,
          discoveryCoinIds: e.discoveryCoinIds,
          requiresCompleted,
          presentationBarrier: e.presentationBarrier
            ? {
                profileId: e.presentationBarrier.profileId,
                facingYaw: e.presentationBarrier.facingYaw + baseYaw,
              }
            : undefined,
        })

        if (!isOptional) {
          lastCompletedEncounterId = encounterId
        }
      }
    }

    // Camera sections (assign all platforms in the chunk and align look vector with chunk traversal)
    if (chunk.platforms.length > 0) {
      const chunkPlatformIds = chunk.platforms.map(
        (p) => idMap.get(p.localId)!,
      )
      const cs = chunk.cameraSection
      const rawFrom = cs
        ? idMap.get(cs.lookFromPlatformLocalId)!
        : chunkPlatformIds[0]!
      const rawTo = cs
        ? idMap.get(cs.lookToPlatformLocalId)!
        : chunkPlatformIds[chunkPlatformIds.length - 1]!
      const lookFromPlatformId =
        rawFrom === rawTo && lastExitPlatformId !== null
          ? lastExitPlatformId
          : rawFrom
      assembledCameraSections.push({
        id: `${chunkPrefix}-${cs?.localId ?? 'cam'}`,
        platformIds: chunkPlatformIds,
        lookFromPlatformId,
        lookToPlatformId: rawTo,
      })
    }

    // Transform chunk exit bounds if defined
    if (chunk.localExit) {
      const corners = [
        { x: chunk.localExit.minX, y: 0, z: chunk.localExit.minZ },
        { x: chunk.localExit.maxX, y: 0, z: chunk.localExit.minZ },
        { x: chunk.localExit.maxX, y: 0, z: chunk.localExit.maxZ },
        { x: chunk.localExit.minX, y: 0, z: chunk.localExit.maxZ },
      ]
      const rotatedCorners = corners.map((c) => {
        const rot = rotatePoint(c, currentHeading)
        return {
          x: currentOrigin.x + rot.x,
          z: currentOrigin.z + rot.z,
        }
      })
      const cMinX = Math.min(...rotatedCorners.map((c) => c.x))
      const cMaxX = Math.max(...rotatedCorners.map((c) => c.x))
      const cMinZ = Math.min(...rotatedCorners.map((c) => c.z))
      const cMaxZ = Math.max(...rotatedCorners.map((c) => c.z))
      assembledExitBounds = {
        minX: Number(cMinX.toFixed(3)),
        maxX: Number(cMaxX.toFixed(3)),
        minZ: Number(cMinZ.toFixed(3)),
        maxZ: Number(cMaxZ.toFixed(3)),
        top: Number((currentOrigin.y + chunk.localExit.top).toFixed(3)),
      }
    }

    // Update origin for next chunk
    if (chunk.platforms.length > 0) {
      lastExitPlatformId = idMap.get(
        chunk.platforms[chunk.platforms.length - 1]!.localId,
      )!
    }

    const rotatedExitPos = rotatePoint(
      chunk.exitSocket.position,
      currentHeading,
    )
    currentOrigin = {
      x: Number((currentOrigin.x + rotatedExitPos.x).toFixed(3)),
      y: Number((currentOrigin.y + rotatedExitPos.y).toFixed(3)),
      z: Number((currentOrigin.z + rotatedExitPos.z).toFixed(3)),
    }

    // Update heading for next chunk: relative turn from chunk's exitSocket.facing
    currentHeading = turnHeading(currentHeading, chunk.exitSocket.facing)
  }

  return {
    platforms: assembledPlatforms,
    gaps: assembledGaps,
    encounters: assembledEncounters,
    checkpoints: assembledCheckpoints,
    cameraSections: assembledCameraSections,
    bounds: {
      minX: Math.floor(minX - 3),
      maxX: Math.ceil(maxX + 3),
      minY: Math.floor(minY - 5),
      maxY: Math.ceil(maxY + 8),
      minZ: Math.floor(minZ - 3),
      maxZ: Math.ceil(maxZ + 3),
    },
    exitPosition: currentOrigin,
    exitBounds: assembledExitBounds,
    finalHeading: currentHeading,
  }
}
