// Archive rendering layout — authored room descriptors define local display ownership and curtain groups.

import type { BufferGeometry, Mesh } from 'three'
import { ARCHIVE_HUSH_LEVEL_ID, ARCHIVE_HUSH_ROOMS, } from '../content/archive-hush-room'
import type { LevelDefinition } from '../contracts'
import type { MaterialLibrary } from './material-library'

export interface ArchiveChamberDefinition {
  id: string
  sceneRoomId: string
  centerZ: number
  hush: boolean
  vesselIds: readonly string[]
  curtainVesselIds: readonly string[]
  noteVesselIds: readonly string[]
}

export interface ArchiveShelfResources {
  materials: MaterialLibrary
  geometry: Map<Mesh, BufferGeometry>
}

export function archiveChambers(
  level: LevelDefinition,
): ArchiveChamberDefinition[] {
  const hush = level.id === ARCHIVE_HUSH_LEVEL_ID
  const authored = hush
    ? ARCHIVE_HUSH_ROOMS
    : [
        {
          id: 'diadem',
          centerZ: 0,
          vesselIds: [] as readonly string[],
          curtainVesselIds: [] as readonly string[],
        },
      ]
  return authored.flatMap((room) => {
    const scene = level.presentation?.rooms?.find(
      ({ bounds }) => bounds.minZ < room.centerZ && bounds.maxZ > room.centerZ,
    )
    if (scene === undefined) return []
    return [
      {
        ...room,
        sceneRoomId: scene.id,
        hush,
        noteVesselIds: hush
          ? room.vesselIds
          : level.breakables.map(({ id }) => id),
      },
    ]
  })
}
