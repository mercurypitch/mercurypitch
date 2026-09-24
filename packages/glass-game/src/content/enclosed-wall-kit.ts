// Enclosed museum wall kit — measured V4 bays paired with exact collision and fallback proxies.

import type { RoomVisualDefinition } from '../authoring/contracts'
import type { SolidPresentation, SolidPropDefinition } from '../contracts'

export const MUSEUM_WINDOW_WIDTH = 2.9062023162841797
export const MUSEUM_WINDOW_DEPTH = 0.36156150698661804
export const MUSEUM_SCREEN_WIDTH = 3.201816439628601
export const MUSEUM_SCREEN_DEPTH = 0.2066943645477295
export const MUSEUM_WALL_TOP = 3.5999999046325684
export const MUSEUM_SEAM_OVERLAP = 0.06
export const MUSEUM_WINDOW_APERTURE_HALF_WIDTH = 0.6538955211639405
export const MUSEUM_WINDOW_SILL_TOP = 0.9539999747276307
export const MUSEUM_WINDOW_LINTEL_BOTTOM = 3.0239999198913576

export type MuseumWallAxis = 'x' | 'z'

export interface MuseumWallBayPlacement {
  id: string
  axis: MuseumWallAxis
  x: number
  z: number
  yaw: number
  platformId?: string
}

export interface MuseumWallBay {
  solids: readonly SolidPropDefinition[]
  visual: RoomVisualDefinition
}

const STONE_WALL: SolidPresentation = {
  role: 'wall',
  material: 'stone',
}

function wallBox(
  id: string,
  placement: Pick<MuseumWallBayPlacement, 'axis' | 'x' | 'z' | 'platformId'>,
  tangentMin: number,
  tangentMax: number,
  depth: number,
  top: number,
  thickness: number,
  presentation: SolidPresentation,
): SolidPropDefinition {
  const normalHalf = depth / 2
  return {
    id,
    kind: 'prop',
    shape: 'box',
    ...(placement.axis === 'x'
      ? {
          minX: placement.x + tangentMin,
          maxX: placement.x + tangentMax,
          minZ: placement.z - normalHalf,
          maxZ: placement.z + normalHalf,
        }
      : {
          minX: placement.x - normalHalf,
          maxX: placement.x + normalHalf,
          minZ: placement.z + tangentMin,
          maxZ: placement.z + tangentMax,
        }),
    top,
    thickness,
    platformId: placement.platformId,
    presentation,
  }
}

export function museumWindowBay(
  placement: MuseumWallBayPlacement,
): MuseumWallBay {
  const half = MUSEUM_WINDOW_WIDTH / 2
  const leftId = `${placement.id}-left-jamb`
  const rightId = `${placement.id}-right-jamb`
  const sillId = `${placement.id}-sill`
  const lintelId = `${placement.id}-lintel`
  const solids = [
    wallBox(
      leftId,
      placement,
      -half,
      -MUSEUM_WINDOW_APERTURE_HALF_WIDTH,
      MUSEUM_WINDOW_DEPTH,
      MUSEUM_WALL_TOP,
      MUSEUM_WALL_TOP,
      STONE_WALL,
    ),
    wallBox(
      rightId,
      placement,
      MUSEUM_WINDOW_APERTURE_HALF_WIDTH,
      half,
      MUSEUM_WINDOW_DEPTH,
      MUSEUM_WALL_TOP,
      MUSEUM_WALL_TOP,
      STONE_WALL,
    ),
    wallBox(
      sillId,
      placement,
      -MUSEUM_WINDOW_APERTURE_HALF_WIDTH,
      MUSEUM_WINDOW_APERTURE_HALF_WIDTH,
      MUSEUM_WINDOW_DEPTH,
      MUSEUM_WINDOW_SILL_TOP,
      MUSEUM_WINDOW_SILL_TOP,
      STONE_WALL,
    ),
    wallBox(
      lintelId,
      placement,
      -MUSEUM_WINDOW_APERTURE_HALF_WIDTH,
      MUSEUM_WINDOW_APERTURE_HALF_WIDTH,
      MUSEUM_WINDOW_DEPTH,
      MUSEUM_WALL_TOP,
      MUSEUM_WALL_TOP - MUSEUM_WINDOW_LINTEL_BOTTOM,
      STONE_WALL,
    ),
  ]
  return {
    solids,
    visual: {
      id: placement.id,
      recipeId: 'museum-window-v4',
      position: { x: placement.x, y: 0, z: placement.z },
      yaw: placement.yaw,
      coversSolidIds: [leftId, rightId, sillId, lintelId],
    },
  }
}

export function museumScreenBay(
  placement: MuseumWallBayPlacement,
  presentation: SolidPresentation = STONE_WALL,
): MuseumWallBay {
  const bodyId = `${placement.id}-body`
  return {
    solids: [
      wallBox(
        bodyId,
        placement,
        -MUSEUM_SCREEN_WIDTH / 2,
        MUSEUM_SCREEN_WIDTH / 2,
        MUSEUM_SCREEN_DEPTH,
        MUSEUM_WALL_TOP,
        MUSEUM_WALL_TOP,
        presentation,
      ),
    ],
    visual: {
      id: placement.id,
      recipeId: 'museum-screen-v4',
      position: { x: placement.x, y: 0, z: placement.z },
      yaw: placement.yaw,
      coversSolidIds: [bodyId],
    },
  }
}

export function museumStoneWall(
  id: string,
  placement: Omit<MuseumWallBayPlacement, 'id' | 'yaw'>,
  width: number,
  depth: number,
): SolidPropDefinition {
  return wallBox(
    id,
    placement,
    -width / 2,
    width / 2,
    depth,
    MUSEUM_WALL_TOP,
    MUSEUM_WALL_TOP,
    STONE_WALL,
  )
}

export function museumPortSeal(
  id: string,
  placement: Omit<MuseumWallBayPlacement, 'id' | 'yaw'>,
): SolidPropDefinition {
  return museumStoneWall(
    id,
    placement,
    MUSEUM_SCREEN_WIDTH,
    MUSEUM_SEAM_OVERLAP,
  )
}
