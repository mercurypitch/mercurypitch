// Conservatory kit — botanical gallery identities assembled from measured museum components.

import type { LevelAuthoringCatalog, RoomPrefab } from '../authoring/contracts'
import { GLASSWORKS_JOURNEY_GARDEN_ROOM, GLASSWORKS_JOURNEY_PORTRAIT_ROOM, } from './glassworks-journey-kit'
import { TWIN_GALLERIES_AUTHORING_CATALOG, TWIN_GALLERIES_COURT_ROOM, } from './twin-galleries-kit'

function botanicalRoom(
  id: string,
  base: RoomPrefab,
  painting: string,
): RoomPrefab {
  return {
    ...base,
    id,
    decorations: (base.decorations ?? []).map((item) =>
      item.recipeId.includes('painting')
        ? { ...item, recipeId: painting }
        : item,
    ),
    audioRegions: base.audioRegions.map((region) => ({
      ...region,
      sceneId: 'garden',
    })),
  }
}

export const CONSERVATORY_FOYER = botanicalRoom(
  'conservatory-foyer',
  GLASSWORKS_JOURNEY_GARDEN_ROOM,
  'garden-painting-v5',
)
export const CONSERVATORY_FERN_HOUSE = botanicalRoom(
  'conservatory-fern-house',
  GLASSWORKS_JOURNEY_GARDEN_ROOM,
  'listening-garden-painting-v7',
)
export const CONSERVATORY_LISTENING_COURT = botanicalRoom(
  'conservatory-listening-court',
  TWIN_GALLERIES_COURT_ROOM,
  'listening-garden-painting-v7',
)
export const CONSERVATORY_ORCHID_HOUSE = botanicalRoom(
  'conservatory-orchid-house',
  GLASSWORKS_JOURNEY_GARDEN_ROOM,
  'wave-keeper-painting-v7',
)
export const CONSERVATORY_WAVE_SALON = botanicalRoom(
  'conservatory-wave-salon',
  GLASSWORKS_JOURNEY_PORTRAIT_ROOM,
  'wave-keeper-painting-v7',
)

const ROOMS = [
  CONSERVATORY_FOYER,
  CONSERVATORY_FERN_HOUSE,
  CONSERVATORY_LISTENING_COURT,
  CONSERVATORY_ORCHID_HOUSE,
  CONSERVATORY_WAVE_SALON,
]

export const CONSERVATORY_AUTHORING_CATALOG: LevelAuthoringCatalog = {
  rooms: {
    ...TWIN_GALLERIES_AUTHORING_CATALOG.rooms,
    ...Object.fromEntries(ROOMS.map((room) => [room.id, room])),
  },
  exhibits: TWIN_GALLERIES_AUTHORING_CATALOG.exhibits,
  availableAssetRecipeIds: [
    ...TWIN_GALLERIES_AUTHORING_CATALOG.availableAssetRecipeIds,
    'listening-garden-painting-v7',
    'wave-keeper-painting-v7',
  ],
}
