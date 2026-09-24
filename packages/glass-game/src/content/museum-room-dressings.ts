// Museum room dressings — reusable wall art and honest planter collision proxies.

import type { RoomDecorationDefinition } from '../authoring/contracts'
import type { SolidPropDefinition } from '../contracts'

export const MUSEUM_ROOM_DECORATION_RECIPE_IDS = [
  'crystal-planter-v5',
  'garden-painting-v5',
  'archive-painting-v5',
  'portrait-painting-v5',
  'gallery-mirror-v5',
] as const

const PLANTER_RADIUS_TOP = 0.29
const PLANTER_RADIUS_BOTTOM = 0.17
const PLANTER_BOWL_HEIGHT = 0.48

const MUSEUM_SCREEN_PANEL_INWARD_POSITION = -0.0783090591430664
const GALLERY_FRAME_REAR_INWARD_POSITION = -0.03839010372757912
const FRAME_WALL_EMBED = 0.002

// Seat the frame rear 2mm into the deepest part of the screen bay's measured,
// slightly uneven central marble surface.
export const MUSEUM_FRAMED_ART_INWARD_OFFSET =
  MUSEUM_SCREEN_PANEL_INWARD_POSITION -
  FRAME_WALL_EMBED -
  GALLERY_FRAME_REAR_INWARD_POSITION

export interface MuseumPlanterDressing {
  solid: SolidPropDefinition
  decoration: RoomDecorationDefinition
}

/** The solid covers only the marble bowl; crystal fronds remain nonblocking. */
export function crystalPlanter(
  id: string,
  x: number,
  z: number,
  platformId: string,
): MuseumPlanterDressing {
  const solidId = `${id}-bowl`
  return {
    solid: {
      id: solidId,
      kind: 'prop',
      shape: 'cylinder',
      x,
      z,
      radiusTop: PLANTER_RADIUS_TOP,
      radiusBottom: PLANTER_RADIUS_BOTTOM,
      top: PLANTER_BOWL_HEIGHT,
      thickness: PLANTER_BOWL_HEIGHT,
      platformId,
      presentation: { role: 'plinth', material: 'stone' },
    },
    decoration: {
      id,
      recipeId: 'crystal-planter-v5',
      position: { x, y: 0, z },
      yaw: 0,
      coversSolidIds: [solidId],
    },
  }
}

export function framedRoomArt(
  id: string,
  recipeId:
    | 'garden-painting-v5'
    | 'archive-painting-v5'
    | 'portrait-painting-v5'
    | 'gallery-mirror-v5',
  position: RoomDecorationDefinition['position'],
  yaw: number,
): RoomDecorationDefinition {
  return { id, recipeId, position, yaw }
}
