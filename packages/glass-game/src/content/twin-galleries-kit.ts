// Twin Galleries kit — register-themed galleries and a windowed listening bridge assembled from the museum kit.

import type { LevelAuthoringCatalog, RoomDecorationDefinition, RoomPrefab, RoomVisualDefinition, } from '../authoring/contracts'
import type { SolidPropDefinition } from '../contracts'
import { ENCLOSED_CORRIDOR_HALF_LENGTH, ENCLOSED_CORRIDOR_HALF_WIDTH, ENCLOSED_CORRIDOR_SCREEN_CENTER, ENCLOSED_CORRIDOR_WINDOW_CENTER, ENCLOSED_ENTRY_ROOM, ENCLOSED_TERRACE_PANORAMA_ROOM, } from './enclosed-museum-kit'
import type { MuseumWallBay } from './enclosed-wall-kit'
import { MUSEUM_WALL_TOP, MUSEUM_WINDOW_DEPTH, museumPortSeal, museumScreenBay, museumWindowBay, } from './enclosed-wall-kit'
import { GLASSWORKS_JOURNEY_AMPHORA, GLASSWORKS_JOURNEY_ARCHIVE_ROOM, GLASSWORKS_JOURNEY_AUTHORING_CATALOG, GLASSWORKS_JOURNEY_GARDEN_ROOM, GLASSWORKS_JOURNEY_PORTRAIT_ROOM, GLASSWORKS_JOURNEY_TERRACE_ROOM, } from './glassworks-journey-kit'
import { MUSEUM_FRAMED_ART_INWARD_OFFSET } from './museum-room-dressings'

const CAMERA_CORRIDOR_HALF_WIDTH = 1.4201082198143005
const CAMERA_CORRIDOR_HALF_LENGTH = 3.9248093779563904
const FLOOR_THICKNESS = 0.25
const COURT_HARP_POSITION = { x: 2.95, y: 0, z: -0.2 } as const
const COURT_HARP_BASE = {
  id: 'resonance-harp-base',
  kind: 'prop',
  shape: 'box',
  minX: 2.6,
  maxX: 3.3,
  minZ: -0.85,
  maxZ: 0.45,
  top: 0.24,
  thickness: 0.24,
  platformId: 'floor',
  presentation: { role: 'plinth', material: 'stone' },
} as const satisfies SolidPropDefinition

function flattenBays(bays: readonly MuseumWallBay[]): {
  solids: SolidPropDefinition[]
  visuals: RoomVisualDefinition[]
} {
  return {
    solids: bays.flatMap((bay) => [...bay.solids]),
    visuals: bays.map((bay) => bay.visual),
  }
}

function replacePainting(
  room: RoomPrefab,
  recipeId: string,
  id: string,
  replacementRecipeId: string,
): readonly RoomDecorationDefinition[] {
  let renamed = false
  return (room.decorations ?? []).map((decoration) => {
    if (renamed || decoration.recipeId !== recipeId) return decoration
    renamed = true
    return { ...decoration, id, recipeId: replacementRecipeId }
  })
}

export const TWIN_GALLERIES_WARM_ROOM: RoomPrefab = {
  ...GLASSWORKS_JOURNEY_GARDEN_ROOM,
  id: 'twin-galleries-warm',
  decorations: replacePainting(
    GLASSWORKS_JOURNEY_GARDEN_ROOM,
    'garden-painting-v5',
    'low-note-study',
    'low-note-painting-v6',
  ),
}

export const TWIN_GALLERIES_COOL_ROOM: RoomPrefab = {
  ...GLASSWORKS_JOURNEY_ARCHIVE_ROOM,
  id: 'twin-galleries-cool',
  decorations: replacePainting(
    GLASSWORKS_JOURNEY_ARCHIVE_ROOM,
    'archive-painting-v5',
    'high-note-study',
    'high-note-painting-v6',
  ),
}

export const TWIN_GALLERIES_COURT_ROOM: RoomPrefab = {
  ...GLASSWORKS_JOURNEY_ARCHIVE_ROOM,
  id: 'twin-galleries-court',
  solids: [...GLASSWORKS_JOURNEY_ARCHIVE_ROOM.solids, COURT_HARP_BASE],
  decorations: [
    {
      id: 'interval-study',
      recipeId: 'interval-painting-v6',
      position: {
        x:
          GLASSWORKS_JOURNEY_ARCHIVE_ROOM.bounds.minX +
          MUSEUM_WINDOW_DEPTH / 2 +
          MUSEUM_FRAMED_ART_INWARD_OFFSET,
        y: 1.9,
        z: 0,
      },
      yaw: Math.PI / 2,
    },
    {
      id: 'resonance-harp',
      recipeId: 'twin-tone-harp-v6',
      position: COURT_HARP_POSITION,
      yaw: -Math.PI / 2,
      coversSolidIds: [COURT_HARP_BASE.id],
    },
  ],
}

export const TWIN_GALLERIES_PORTRAIT_ROOM: RoomPrefab = {
  ...GLASSWORKS_JOURNEY_PORTRAIT_ROOM,
  id: 'twin-galleries-portrait',
}

export const TWIN_GALLERIES_PANORAMA_ROOM: RoomPrefab = {
  ...GLASSWORKS_JOURNEY_TERRACE_ROOM,
  id: 'twin-galleries-panorama',
}

export const TWIN_GALLERIES_PANORAMA_CAMERA_ROOM: RoomPrefab = {
  ...ENCLOSED_TERRACE_PANORAMA_ROOM,
  id: 'twin-galleries-panorama-camera',
}

export const TWIN_GALLERIES_OPALINE_ECHO = {
  ...GLASSWORKS_JOURNEY_AMPHORA,
  id: 'twin-galleries-opaline-echo',
  variant: 'opaline-v6',
}

export const TWIN_GALLERIES_AMBER_URN = {
  ...GLASSWORKS_JOURNEY_AMPHORA,
  id: 'twin-galleries-amber-urn',
  variant: 'amber-v6',
}

export const TWIN_GALLERIES_CELADON_DECANTER = {
  ...GLASSWORKS_JOURNEY_AMPHORA,
  id: 'twin-galleries-celadon-decanter',
  variant: 'celadon-lark-decanter-fracture-v4',
}

const listeningBridgeBays = flattenBays([
  museumScreenBay({
    id: 'west-south-screen',
    axis: 'z',
    x: -ENCLOSED_CORRIDOR_HALF_WIDTH,
    z: ENCLOSED_CORRIDOR_SCREEN_CENTER,
    yaw: Math.PI / 2,
    platformId: 'floor',
  }),
  museumScreenBay({
    id: 'east-south-screen',
    axis: 'z',
    x: ENCLOSED_CORRIDOR_HALF_WIDTH,
    z: ENCLOSED_CORRIDOR_SCREEN_CENTER,
    yaw: -Math.PI / 2,
    platformId: 'floor',
  }),
  museumWindowBay({
    id: 'west-north-window',
    axis: 'z',
    x: -ENCLOSED_CORRIDOR_HALF_WIDTH,
    z: ENCLOSED_CORRIDOR_WINDOW_CENTER,
    yaw: Math.PI / 2,
    platformId: 'floor',
  }),
  museumWindowBay({
    id: 'east-north-window',
    axis: 'z',
    x: ENCLOSED_CORRIDOR_HALF_WIDTH,
    z: ENCLOSED_CORRIDOR_WINDOW_CENTER,
    yaw: -Math.PI / 2,
    platformId: 'floor',
  }),
])

/** A level bridge in the route sense: windowed, continuous and never a jump. */
export const TWIN_GALLERIES_LISTENING_BRIDGE_ROOM: RoomPrefab = {
  id: 'twin-galleries-listening-bridge',
  bounds: {
    minX: -ENCLOSED_CORRIDOR_HALF_WIDTH - MUSEUM_WINDOW_DEPTH / 2,
    maxX: ENCLOSED_CORRIDOR_HALF_WIDTH + MUSEUM_WINDOW_DEPTH / 2,
    minY: -FLOOR_THICKNESS,
    maxY: MUSEUM_WALL_TOP,
    minZ: -ENCLOSED_CORRIDOR_HALF_LENGTH,
    maxZ: ENCLOSED_CORRIDOR_HALF_LENGTH,
  },
  cameraBounds: {
    minX: -CAMERA_CORRIDOR_HALF_WIDTH,
    maxX: CAMERA_CORRIDOR_HALF_WIDTH,
    minY: 0,
    maxY: 3.44,
    minZ: -CAMERA_CORRIDOR_HALF_LENGTH,
    maxZ: CAMERA_CORRIDOR_HALF_LENGTH,
  },
  platforms: ENCLOSED_ENTRY_ROOM.platforms.map((platform) => ({
    ...platform,
    kind: 'bridge',
    presentation: { role: 'bridge', material: 'stone' },
  })),
  solids: [
    ...listeningBridgeBays.solids,
    museumPortSeal('south-seal', {
      axis: 'x',
      x: 0,
      z: -ENCLOSED_CORRIDOR_HALF_LENGTH,
      platformId: 'floor',
    }),
    museumPortSeal('north-seal', {
      axis: 'x',
      x: 0,
      z: ENCLOSED_CORRIDOR_HALF_LENGTH,
      platformId: 'floor',
    }),
  ],
  checkpoints: [],
  ports: ENCLOSED_ENTRY_ROOM.ports,
  exhibitMounts: [],
  exits: [],
  visuals: listeningBridgeBays.visuals,
  audioRegions: ENCLOSED_ENTRY_ROOM.audioRegions,
}

/** Exact source seams for V6 exhibits integrated into the Twin Galleries. */
export const TWIN_GALLERIES_V6_HANDOFF = {
  exhibits: {},
  integratedExhibits: {
    'lower-urn': {
      currentPrefabId: TWIN_GALLERIES_AMBER_URN.id,
      assetRecipeId: TWIN_GALLERIES_AMBER_URN.variant,
      source:
        'art/glass-adventure/v6-level2/exports/amber-cadence-urn-fracture-v2.glb',
    },
    'court-echo': {
      currentPrefabId: TWIN_GALLERIES_OPALINE_ECHO.id,
      assetRecipeId: TWIN_GALLERIES_OPALINE_ECHO.variant,
      source:
        'art/glass-adventure/v6-level2/exports/opaline-echo-amphora-fracture-v2.glb',
    },
    'upper-decanter': {
      currentPrefabId: TWIN_GALLERIES_CELADON_DECANTER.id,
      assetRecipeId: TWIN_GALLERIES_CELADON_DECANTER.variant,
      source:
        'art/glass-adventure/v6-level2/celadon-production-v4/exports/celadon-lark-decanter-fracture-v4.glb',
    },
  },
} as const

export const TWIN_GALLERIES_AUTHORING_CATALOG: LevelAuthoringCatalog = {
  rooms: {
    ...GLASSWORKS_JOURNEY_AUTHORING_CATALOG.rooms,
    [TWIN_GALLERIES_WARM_ROOM.id]: TWIN_GALLERIES_WARM_ROOM,
    [TWIN_GALLERIES_COOL_ROOM.id]: TWIN_GALLERIES_COOL_ROOM,
    [TWIN_GALLERIES_COURT_ROOM.id]: TWIN_GALLERIES_COURT_ROOM,
    [TWIN_GALLERIES_PORTRAIT_ROOM.id]: TWIN_GALLERIES_PORTRAIT_ROOM,
    [TWIN_GALLERIES_LISTENING_BRIDGE_ROOM.id]:
      TWIN_GALLERIES_LISTENING_BRIDGE_ROOM,
    [TWIN_GALLERIES_PANORAMA_ROOM.id]: TWIN_GALLERIES_PANORAMA_ROOM,
    [TWIN_GALLERIES_PANORAMA_CAMERA_ROOM.id]:
      TWIN_GALLERIES_PANORAMA_CAMERA_ROOM,
  },
  exhibits: {
    ...GLASSWORKS_JOURNEY_AUTHORING_CATALOG.exhibits,
    'twin-galleries-portrait-exhibit': {
      ...GLASSWORKS_JOURNEY_AUTHORING_CATALOG.exhibits[
        'glassworks-journey-portrait'
      ]!,
      id: 'twin-galleries-portrait-exhibit',
      variant: 'portrait-interval',
    },
    [TWIN_GALLERIES_OPALINE_ECHO.id]: TWIN_GALLERIES_OPALINE_ECHO,
    [TWIN_GALLERIES_AMBER_URN.id]: TWIN_GALLERIES_AMBER_URN,
    [TWIN_GALLERIES_CELADON_DECANTER.id]: TWIN_GALLERIES_CELADON_DECANTER,
  },
  availableAssetRecipeIds: [
    ...GLASSWORKS_JOURNEY_AUTHORING_CATALOG.availableAssetRecipeIds,
    'low-note-painting-v6',
    'high-note-painting-v6',
    'interval-painting-v6',
    'twin-tone-harp-v6',
    'opaline-v6',
    'amber-v6',
    'celadon-lark-decanter-fracture-v4',
    'portrait-interval',
  ],
}
