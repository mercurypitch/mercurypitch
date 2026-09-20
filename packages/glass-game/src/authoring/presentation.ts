// Authored presentation manifest — transformed room, port, audio and visual data without renderer imports.

import type { LevelPresentationDefinition } from '../contracts'
import type { AuthoredLevelSource } from './contracts'
import type { CompiledRoom } from './internal'
import { runtimeRoomId, sortedById } from './internal'
import { transformBounds3, transformPoint, transformYaw } from './transform'

export function compilePresentation(
  source: AuthoredLevelSource,
  rooms: ReadonlyMap<string, CompiledRoom>,
  usedRecipes: ReadonlySet<string>,
): LevelPresentationDefinition {
  const floorArt = [...rooms.values()].flatMap((room) => {
    const selection = room.placement.floorArt
    if (selection === undefined) return []
    return room.platforms.map((platform) => ({
      platformId: platform.id,
      recipeId: selection.recipeId,
      ...(selection.palette === undefined
        ? {}
        : { palette: selection.palette }),
    }))
  })
  const decorations = [...rooms.values()].flatMap((room) => {
    const roomId = runtimeRoomId(
      source,
      room.placement.id,
      'room',
      room.prefab.id,
    )
    return sortedById(room.prefab.decorations ?? []).map((decoration) => ({
      id: runtimeRoomId(source, room.placement.id, 'decoration', decoration.id),
      roomId,
      recipeId: decoration.recipeId,
      position: transformPoint(decoration.position, room.placement),
      yaw: transformYaw(decoration.yaw, room.placement.yawQuarterTurns),
      scale: decoration.scale ?? 1,
      coveredSolidIds: decoration.coversSolidIds?.flatMap((id) => {
        const runtimeId = room.solidIds.get(id)
        return runtimeId === undefined ? [] : [runtimeId]
      }),
    }))
  })
  return {
    worldBounds: { ...source.worldBounds },
    lightBounds: { ...source.lightBounds },
    rooms: [...rooms.values()].map((room) => ({
      id: runtimeRoomId(source, room.placement.id, 'room', room.prefab.id),
      bounds: transformBounds3(room.prefab.bounds, room.placement),
      cameraBounds:
        room.prefab.cameraBounds === undefined
          ? undefined
          : transformBounds3(room.prefab.cameraBounds, room.placement),
      ports: [...room.ports.values()].map(
        ({ sealSolidId: _, ...port }) => port,
      ),
    })),
    audioRegions: [...rooms.values()].flatMap((room) =>
      sortedById(room.prefab.audioRegions).map((region) => ({
        id: runtimeRoomId(source, room.placement.id, 'audio', region.id),
        bounds: transformBounds3(region.bounds, room.placement),
        sceneId: room.placement.audioSceneId ?? region.sceneId,
      })),
    ),
    visuals: [...rooms.values()].flatMap((room) =>
      sortedById(room.prefab.visuals).map((visual) => ({
        id: runtimeRoomId(source, room.placement.id, 'visual', visual.id),
        recipeId: visual.recipeId,
        position: transformPoint(visual.position, room.placement),
        yaw: transformYaw(visual.yaw, room.placement.yawQuarterTurns),
        coveredSolidIds: visual.coversSolidIds?.flatMap((id) => {
          const runtimeId = room.solidIds.get(id)
          return runtimeId === undefined ? [] : [runtimeId]
        }),
      })),
    ),
    ...(decorations.length === 0 ? {} : { decorations }),
    ...(floorArt.length === 0 ? {} : { floorArt }),
    assetRecipeIds: [...usedRecipes].sort(),
  }
}
