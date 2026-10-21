// Dark Archive rendering — room-local installations share one spotlight and preserve corridor exploration.

import type { Group, Object3D } from 'three'
import { SpotLight } from 'three'
import type { LevelDefinition } from '../contracts'
import { createArchiveChamber } from './archive-chamber'
import type { ArchiveShelfResources } from './archive-layout'
import { archiveChambers } from './archive-layout'
import type { GlassRendererPresentation } from './glass-renderer-contracts'
import { createMaterialLibrary } from './material-library'

export const ARCHIVE_SHELF_BUNDLE = 'vessels'
const ARCHIVE_LEVELS = new Set([
  'glassworks-unbroken-archive/archive-awakening',
  'glassworks-unbroken-archive/archive-hush',
])

export function isDarkArchive(level: Pick<LevelDefinition, 'id'>): boolean {
  return ARCHIVE_LEVELS.has(level.id)
}

/** Rooms remain dark; connecting corridors and the final threshold regain the gallery light. */
export function archiveLightWeight(
  playerZ: number,
  centers: readonly number[] = [0],
): number {
  const distance = Math.min(
    ...centers.map((center) => Math.abs(playerZ - center)),
  )
  return Math.min(1, Math.max(0, (6.2 - distance) / 1.8))
}

export function createArchiveRoom(level: LevelDefinition, museumRoot: Group) {
  if (!isDarkArchive(level)) return undefined
  const definitions = archiveChambers(level)
  const shelfResources: ArchiveShelfResources = {
    materials: createMaterialLibrary(),
    geometry: new Map(),
  }
  const chambers = definitions.flatMap((definition) => {
    const chamber = createArchiveChamber(
      level,
      museumRoot,
      definition,
      shelfResources,
    )
    return chamber === undefined ? [] : [{ definition, chamber }]
  })
  if (chambers.length === 0) {
    shelfResources.materials.dispose()
    return undefined
  }
  const centers = chambers.map(({ definition }) => definition.centerZ)
  const light = new SpotLight(0xffdeb1, 18, 8, 0.95, 0.75, 1.5)
  light.name = 'archive-display-light'
  light.position.set(0, 3.5, -0.15)
  light.target.position.set(0, 0.3, 0.8)
  let disposed = false
  return {
    root: chambers[0]!.chamber.root,
    roots: chambers.map(({ chamber }) => chamber.root),
    light,
    lightWeight: (z: number) => archiveLightWeight(z, centers),
    finishInstallation() {
      chambers.forEach(({ chamber }) => chamber.finishInstallation())
    },
    installBundle(source: Object3D, bundle: string) {
      chambers.forEach(({ chamber }) => chamber.installBundle(source, bundle))
    },
    update(
      presentation: GlassRendererPresentation | undefined,
      dt: number,
      playerZ = level.spawn.position.z,
    ) {
      const nearest = centers.reduce(
        (best, center) =>
          Math.abs(playerZ - center) < Math.abs(playerZ - best) ? center : best,
        centers[0]!,
      )
      light.intensity = 18 * archiveLightWeight(playerZ, centers)
      light.position.z = nearest - 0.15
      light.target.position.z = nearest + 0.8
      chambers.forEach(({ definition, chamber }) => {
        chamber.update(
          presentation,
          dt,
          presentation?.archiveHush?.completedRoomIds?.includes(
            definition.id,
          ) ?? false,
        )
      })
    },
    dispose() {
      if (disposed) return
      disposed = true
      chambers.forEach(({ chamber }) => chamber.dispose())
      shelfResources.materials.dispose()
      shelfResources.geometry.forEach((geometry) => geometry.dispose())
      shelfResources.geometry.clear()
      light.removeFromParent()
      light.target.removeFromParent()
    },
  }
}
