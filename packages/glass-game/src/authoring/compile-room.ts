// Room compilation — apply one supported transform to every local gameplay and presentation datum.

import type { PlatformDefinition, SolidPropDefinition } from '../contracts'
import type { AuthoredLevelSource, LevelAuthoringDiagnostic, RoomPlacement, RoomPrefab, } from './contracts'
import type { CompiledRoom } from './internal'
import { mapActivation, mapEncounterRefs, runtimeRoomId, sortedById, } from './internal'
import { transformBoundsXZ, transformPoint, transformYaw } from './transform'

function transformPlatform(
  source: AuthoredLevelSource,
  placement: RoomPlacement,
  platform: PlatformDefinition,
  checkpointIds: ReadonlyMap<string, string>,
  runtimeEncounterIds: ReadonlyMap<string, string>,
  diagnostics: LevelAuthoringDiagnostic[],
): PlatformDefinition {
  const behavior =
    platform.behavior?.kind === 'glide'
      ? {
          ...platform.behavior,
          translation: transformPoint(platform.behavior.translation, {
            translate: { x: 0, y: 0, z: 0 },
            yawQuarterTurns: placement.yawQuarterTurns,
          }),
        }
      : platform.behavior
  return {
    ...platform,
    ...transformBoundsXZ(platform, placement),
    id: runtimeRoomId(source, placement.id, 'platform', platform.id),
    top: platform.top + placement.translate.y,
    activation: mapActivation(
      platform.activation,
      runtimeEncounterIds,
      `rooms.${placement.id}.platforms.${platform.id}.activation`,
      diagnostics,
    ),
    unlockAfter:
      platform.unlockAfter === undefined
        ? undefined
        : mapEncounterRefs(
            [platform.unlockAfter],
            runtimeEncounterIds,
            `rooms.${placement.id}.platforms.${platform.id}.unlockAfter`,
            diagnostics,
          )?.[0],
    catchCheckpointId:
      platform.catchCheckpointId === undefined
        ? undefined
        : checkpointIds.get(platform.catchCheckpointId),
    behavior,
  }
}

function transformSolid(
  source: AuthoredLevelSource,
  placement: RoomPlacement,
  solid: SolidPropDefinition,
  platformIds: ReadonlyMap<string, string>,
  runtimeEncounterIds: ReadonlyMap<string, string>,
  diagnostics: LevelAuthoringDiagnostic[],
): SolidPropDefinition {
  const shared = {
    id: runtimeRoomId(source, placement.id, 'solid', solid.id),
    top: solid.top + placement.translate.y,
    platformId:
      solid.platformId === undefined
        ? undefined
        : platformIds.get(solid.platformId),
    activation: mapActivation(
      solid.activation,
      runtimeEncounterIds,
      `rooms.${placement.id}.solids.${solid.id}.activation`,
      diagnostics,
    ),
  }
  if (solid.shape === 'box')
    return {
      ...solid,
      ...shared,
      ...transformBoundsXZ(solid, placement),
      shape: 'box',
    }
  const centre = transformPoint({ x: solid.x, y: 0, z: solid.z }, placement)
  return {
    ...solid,
    ...shared,
    shape: 'cylinder',
    x: centre.x,
    z: centre.z,
  }
}

export function compileRoom(
  source: AuthoredLevelSource,
  placement: RoomPlacement,
  prefab: RoomPrefab,
  runtimeEncounterIds: ReadonlyMap<string, string>,
  diagnostics: LevelAuthoringDiagnostic[],
): CompiledRoom {
  const platformIds = new Map(
    prefab.platforms.map((item) => [
      item.id,
      runtimeRoomId(source, placement.id, 'platform', item.id),
    ]),
  )
  const solidIds = new Map(
    prefab.solids.map((item) => [
      item.id,
      runtimeRoomId(source, placement.id, 'solid', item.id),
    ]),
  )
  const checkpointIds = new Map(
    prefab.checkpoints.map((item) => [
      item.id,
      runtimeRoomId(source, placement.id, 'checkpoint', item.id),
    ]),
  )
  const checkpoints = sortedById(prefab.checkpoints).map((checkpoint) => {
    const requiresCompleted = [
      ...new Set([
        ...(checkpoint.requiresCompleted ?? []),
        ...(placement.checkpointRequiresCompleted?.[checkpoint.id] ?? []),
      ]),
    ]
    return {
      ...checkpoint,
      id: checkpointIds.get(checkpoint.id)!,
      position: transformPoint(checkpoint.position, placement),
      facingYaw: transformYaw(checkpoint.facingYaw, placement.yawQuarterTurns),
      requiresCompleted: mapEncounterRefs(
        requiresCompleted.length === 0 ? undefined : requiresCompleted,
        runtimeEncounterIds,
        `rooms.${placement.id}.checkpoints.${checkpoint.id}.requiresCompleted`,
        diagnostics,
      ),
    }
  })
  const checkpointsByLocal = new Map(
    prefab.checkpoints.map((checkpoint) => [
      checkpoint.id,
      checkpoints.find(
        (compiled) => compiled.id === checkpointIds.get(checkpoint.id),
      )!,
    ]),
  )
  return {
    placement,
    prefab,
    platformIds,
    solidIds,
    platforms: sortedById(prefab.platforms).map((platform) =>
      transformPlatform(
        source,
        placement,
        platform,
        checkpointIds,
        runtimeEncounterIds,
        diagnostics,
      ),
    ),
    solids: sortedById(prefab.solids).map((solid) =>
      transformSolid(
        source,
        placement,
        solid,
        platformIds,
        runtimeEncounterIds,
        diagnostics,
      ),
    ),
    checkpoints,
    checkpointsByLocal,
    ports: new Map(
      sortedById(prefab.ports).map((port) => [
        port.id,
        {
          id: runtimeRoomId(source, placement.id, 'port', port.id),
          position: transformPoint(port.position, placement),
          facingYaw: transformYaw(port.facingYaw, placement.yawQuarterTurns),
          width: port.width,
          height: port.height,
          sealSolidId: solidIds.get(port.sealSolidId) ?? '',
        },
      ]),
    ),
    mounts: new Map(
      sortedById(prefab.exhibitMounts).map((mount) => [
        mount.id,
        {
          ...mount,
          position: transformPoint(mount.position, placement),
          anchor: transformPoint(mount.anchor, placement),
          facingYaw: transformYaw(mount.facingYaw, placement.yawQuarterTurns),
          platformId: platformIds.get(mount.platformId) ?? '',
        },
      ]),
    ),
    exits: new Map(
      sortedById(prefab.exits).map((exit) => [
        exit.id,
        {
          ...exit,
          ...transformBoundsXZ(exit, placement),
          top: exit.top + placement.translate.y,
        },
      ]),
    ),
  }
}
