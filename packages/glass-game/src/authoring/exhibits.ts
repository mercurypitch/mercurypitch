// Exhibit compilation — bind reusable held-note vessels and one shared plinth proxy to room mounts.

import type { BreakableDefinition, SolidPropDefinition } from '../contracts'
import type { AuthoredLevelSource, ExhibitPlacement, LevelAuthoringCatalog, LevelAuthoringDiagnostic, } from './contracts'
import type { CompiledRoom } from './internal'
import { diagnostic, mapEncounterRefs, runtimeRoomId } from './internal'

export function compileExhibits(
  source: AuthoredLevelSource,
  placements: readonly ExhibitPlacement[],
  catalog: LevelAuthoringCatalog,
  rooms: ReadonlyMap<string, CompiledRoom>,
  runtimeEncounterIds: ReadonlyMap<string, string>,
  diagnostics: LevelAuthoringDiagnostic[],
): { breakables: BreakableDefinition[]; plinths: SolidPropDefinition[] } {
  const breakables: BreakableDefinition[] = []
  const plinths: SolidPropDefinition[] = []
  const occupiedMounts = new Map<string, string>()
  for (const placement of placements) {
    const room = rooms.get(placement.roomId)
    if (room === undefined) {
      diagnostic(
        diagnostics,
        'missing-reference',
        `exhibits.${placement.id}.roomId`,
        `Unknown room instance "${placement.roomId}".`,
      )
      continue
    }
    const mount = room.mounts.get(placement.mountId)
    if (mount === undefined) {
      diagnostic(
        diagnostics,
        'missing-reference',
        `exhibits.${placement.id}.mountId`,
        `Room "${placement.roomId}" has no exhibit mount "${placement.mountId}".`,
      )
      continue
    }
    const mountRef = `${placement.roomId}.${placement.mountId}`
    const occupant = occupiedMounts.get(mountRef)
    if (occupant !== undefined) {
      diagnostic(
        diagnostics,
        'duplicate-mount',
        `exhibits.${placement.id}.mountId`,
        `Exhibit mount "${mountRef}" is already occupied by "${occupant}".`,
      )
      continue
    }
    occupiedMounts.set(mountRef, placement.id)
    const prefab = catalog.exhibits[placement.prefabId]
    if (prefab === undefined) continue
    const id = runtimeEncounterIds.get(placement.id)!
    const plinthId = runtimeRoomId(
      source,
      placement.roomId,
      'solid',
      `plinth-${placement.id}`,
    )
    breakables.push({
      id,
      label: placement.label,
      position: { ...mount.position },
      anchor: { ...mount.anchor },
      mount: {
        kind: 'plinth',
        solidId: plinthId,
        height: prefab.plinth.height,
        radiusTop: prefab.plinth.radiusTop,
        radiusBottom: prefab.plinth.radiusBottom,
        facingYaw: mount.facingYaw,
        presentation: { ...prefab.plinth.presentation },
      },
      variant: prefab.variant,
      optional: placement.optional,
      requiresCompleted: mapEncounterRefs(
        placement.requiresCompleted,
        runtimeEncounterIds,
        `exhibits.${placement.id}.requiresCompleted`,
        diagnostics,
      ),
      hold: { ...prefab.hold },
    })
    plinths.push({
      id: plinthId,
      kind: 'prop',
      shape: 'cylinder',
      x: mount.position.x,
      z: mount.position.z,
      top: mount.position.y + prefab.plinth.height,
      thickness: prefab.plinth.height,
      radiusTop: prefab.plinth.radiusTop,
      radiusBottom: prefab.plinth.radiusBottom,
      platformId: mount.platformId,
      presentation: { ...prefab.plinth.presentation },
    })
  }
  return { breakables, plinths }
}
