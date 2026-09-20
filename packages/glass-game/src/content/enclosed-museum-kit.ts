// Enclosed museum kit — five playable room prefabs and one camera-only panorama volume.

import type { ExhibitPrefab, LevelAuthoringCatalog, RoomAudioRegionDefinition, RoomPrefab, RoomVisualDefinition, } from '../authoring/contracts'
import type { CheckpointDefinition, HoldDefinition, MuseumAudioSceneId, PlatformDefinition, SolidPresentation, SolidPropDefinition, } from '../contracts'
import type { MuseumWallBay } from './enclosed-wall-kit'
import { MUSEUM_SCREEN_DEPTH, MUSEUM_SCREEN_WIDTH, MUSEUM_SEAM_OVERLAP, MUSEUM_WALL_TOP, MUSEUM_WINDOW_DEPTH, MUSEUM_WINDOW_WIDTH, museumPortSeal, museumScreenBay, museumStoneWall, museumWindowBay, } from './enclosed-wall-kit'
import { EXHIBIT_PLINTH } from './solid-props'

export const ENCLOSED_CHAMBER_HALF = 4.447110536098481
export const ENCLOSED_CHAMBER_BAY_CENTER = 2.9940093779563903
export const ENCLOSED_CORRIDOR_HALF_LENGTH = 3.0240093779563906
export const ENCLOSED_CORRIDOR_HALF_WIDTH = 1.6009082198143005
export const ENCLOSED_CORRIDOR_SCREEN_CENTER = -1.42310115814209
export const ENCLOSED_CORRIDOR_WINDOW_CENTER = 1.5709082198143007

export const ENCLOSED_TERRACE_HALF_WIDTH = 4.2
export const ENCLOSED_TERRACE_BALCONY_START =
  MUSEUM_WINDOW_WIDTH / 2 - MUSEUM_SEAM_OVERLAP
export const ENCLOSED_TERRACE_NORTH = 6
export const ENCLOSED_TERRACE_CAMERA_NORTH = 2.1901648044586164
export const ENCLOSED_PANORAMA_CAMERA_SOUTH = 1.470164804458617
export const ENCLOSED_PANORAMA_CAMERA_NORTH = 7

const CAMERA_INSET = 0.1808
const CAMERA_CORRIDOR_HALF_WIDTH = 1.4201082198143005
const CAMERA_CORRIDOR_HALF_LENGTH = 3.9248093779563904
const CAMERA_TOP = 3.44
const FLOOR_THICKNESS = 0.25

const HOLD: HoldDefinition = {
  requiredSeconds: 1.2,
  toleranceCents: 150,
  confidenceFloor: 0.5,
  dropoutGraceSeconds: 0.15,
  decayPerSecond: 0.25,
  maximumSampleGapSeconds: 0.1,
  maximumSampleAgeMs: 150,
}

const GATE_PRESENTATION: SolidPresentation = {
  role: 'gate',
  material: 'brass',
}

function deck(
  id: string,
  minX: number,
  maxX: number,
  minZ: number,
  maxZ: number,
): PlatformDefinition {
  return {
    id,
    minX,
    maxX,
    minZ,
    maxZ,
    top: 0,
    thickness: FLOOR_THICKNESS,
    kind: 'deck',
    material: 'stone',
    renderId: 'deck',
    presentation: { role: 'floor', material: 'stone' },
  }
}

function audioRegion(
  id: string,
  sceneId: MuseumAudioSceneId,
  minX: number,
  maxX: number,
  minZ: number,
  maxZ: number,
  maxY = MUSEUM_WALL_TOP,
): RoomAudioRegionDefinition {
  return {
    id,
    bounds: { minX, maxX, minY: 0, maxY, minZ, maxZ },
    sceneId,
  }
}

function flattenBays(bays: readonly MuseumWallBay[]): {
  solids: SolidPropDefinition[]
  visuals: RoomVisualDefinition[]
} {
  return {
    solids: bays.flatMap((bay) => [...bay.solids]),
    visuals: bays.map((bay) => bay.visual),
  }
}

function exhibit(id: string, variant: string): ExhibitPrefab {
  return {
    id,
    variant,
    hold: { ...HOLD },
    plinth: {
      ...EXHIBIT_PLINTH,
      presentation: { role: 'plinth', material: 'stone' },
    },
  }
}

const chamberBays = flattenBays([
  museumWindowBay({
    id: 'south-west-window',
    axis: 'x',
    x: -ENCLOSED_CHAMBER_BAY_CENTER,
    z: -ENCLOSED_CHAMBER_HALF,
    yaw: 0,
    platformId: 'floor',
  }),
  museumScreenBay({
    id: 'south-center',
    axis: 'x',
    x: 0,
    z: -ENCLOSED_CHAMBER_HALF,
    yaw: 0,
    platformId: 'floor',
  }),
  museumWindowBay({
    id: 'south-east-window',
    axis: 'x',
    x: ENCLOSED_CHAMBER_BAY_CENTER,
    z: -ENCLOSED_CHAMBER_HALF,
    yaw: 0,
    platformId: 'floor',
  }),
  museumWindowBay({
    id: 'north-west-window',
    axis: 'x',
    x: -ENCLOSED_CHAMBER_BAY_CENTER,
    z: ENCLOSED_CHAMBER_HALF,
    yaw: Math.PI,
    platformId: 'floor',
  }),
  museumScreenBay({
    id: 'north-center',
    axis: 'x',
    x: 0,
    z: ENCLOSED_CHAMBER_HALF,
    yaw: Math.PI,
    platformId: 'floor',
  }),
  museumWindowBay({
    id: 'north-east-window',
    axis: 'x',
    x: ENCLOSED_CHAMBER_BAY_CENTER,
    z: ENCLOSED_CHAMBER_HALF,
    yaw: Math.PI,
    platformId: 'floor',
  }),
  museumWindowBay({
    id: 'west-south-window',
    axis: 'z',
    x: -ENCLOSED_CHAMBER_HALF,
    z: -ENCLOSED_CHAMBER_BAY_CENTER,
    yaw: Math.PI / 2,
    platformId: 'floor',
  }),
  museumScreenBay({
    id: 'west-center',
    axis: 'z',
    x: -ENCLOSED_CHAMBER_HALF,
    z: 0,
    yaw: Math.PI / 2,
    platformId: 'floor',
  }),
  museumWindowBay({
    id: 'west-north-window',
    axis: 'z',
    x: -ENCLOSED_CHAMBER_HALF,
    z: ENCLOSED_CHAMBER_BAY_CENTER,
    yaw: Math.PI / 2,
    platformId: 'floor',
  }),
  museumWindowBay({
    id: 'east-south-window',
    axis: 'z',
    x: ENCLOSED_CHAMBER_HALF,
    z: -ENCLOSED_CHAMBER_BAY_CENTER,
    yaw: -Math.PI / 2,
    platformId: 'floor',
  }),
  museumScreenBay(
    {
      id: 'east-center',
      axis: 'z',
      x: ENCLOSED_CHAMBER_HALF,
      z: 0,
      yaw: -Math.PI / 2,
      platformId: 'floor',
    },
    GATE_PRESENTATION,
  ),
  museumWindowBay({
    id: 'east-north-window',
    axis: 'z',
    x: ENCLOSED_CHAMBER_HALF,
    z: ENCLOSED_CHAMBER_BAY_CENTER,
    yaw: -Math.PI / 2,
    platformId: 'floor',
  }),
])

const arrivalCheckpoint: CheckpointDefinition = {
  id: 'arrival',
  position: { x: 0, y: 0, z: -2.8 },
  facingYaw: Math.PI,
  radius: 0.42,
}

export const ENCLOSED_CHAMBER_ROOM: RoomPrefab = {
  id: 'enclosed-chamber',
  bounds: {
    minX: -ENCLOSED_CHAMBER_HALF - MUSEUM_WINDOW_DEPTH / 2,
    maxX: ENCLOSED_CHAMBER_HALF + MUSEUM_WINDOW_DEPTH / 2,
    minY: -FLOOR_THICKNESS,
    maxY: MUSEUM_WALL_TOP,
    minZ: -ENCLOSED_CHAMBER_HALF - MUSEUM_WINDOW_DEPTH / 2,
    maxZ: ENCLOSED_CHAMBER_HALF + MUSEUM_WINDOW_DEPTH / 2,
  },
  cameraBounds: {
    minX: -ENCLOSED_CHAMBER_HALF + CAMERA_INSET,
    maxX: ENCLOSED_CHAMBER_HALF - CAMERA_INSET,
    minY: 0,
    maxY: CAMERA_TOP,
    minZ: -ENCLOSED_CHAMBER_HALF + CAMERA_INSET,
    maxZ: ENCLOSED_CHAMBER_HALF - CAMERA_INSET,
  },
  platforms: [
    deck(
      'floor',
      -ENCLOSED_CHAMBER_HALF,
      ENCLOSED_CHAMBER_HALF,
      -ENCLOSED_CHAMBER_HALF,
      ENCLOSED_CHAMBER_HALF,
    ),
  ],
  solids: [
    ...chamberBays.solids,
    museumPortSeal('east-seal', {
      axis: 'z',
      x: ENCLOSED_CHAMBER_HALF,
      z: 0,
      platformId: 'floor',
    }),
  ],
  checkpoints: [arrivalCheckpoint],
  ports: [
    {
      id: 'east',
      position: { x: ENCLOSED_CHAMBER_HALF, y: 0, z: 0 },
      facingYaw: -Math.PI / 2,
      width: MUSEUM_SCREEN_WIDTH,
      height: MUSEUM_WALL_TOP,
      sealSolidId: 'east-seal',
    },
  ],
  exhibitMounts: [
    {
      id: 'threshold-display',
      position: { x: 0, y: 0, z: 0.8 },
      anchor: { x: 0, y: 0, z: -0.05 },
      facingYaw: Math.PI,
      platformId: 'floor',
    },
    {
      id: 'window-display',
      position: { x: -2.65, y: 0, z: 1.8 },
      anchor: { x: -1.8, y: 0, z: 1.15 },
      facingYaw: Math.PI,
      platformId: 'floor',
    },
  ],
  exits: [],
  visuals: chamberBays.visuals,
  audioRegions: [
    audioRegion(
      'chamber',
      'museum',
      -ENCLOSED_CHAMBER_HALF,
      ENCLOSED_CHAMBER_HALF,
      -ENCLOSED_CHAMBER_HALF,
      ENCLOSED_CHAMBER_HALF,
    ),
  ],
}

const entryBays = flattenBays([
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
])

export const ENCLOSED_ENTRY_ROOM: RoomPrefab = {
  id: 'enclosed-entry',
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
    maxY: CAMERA_TOP,
    minZ: -CAMERA_CORRIDOR_HALF_LENGTH,
    maxZ: CAMERA_CORRIDOR_HALF_LENGTH,
  },
  platforms: [
    deck(
      'floor',
      -ENCLOSED_CORRIDOR_HALF_WIDTH,
      ENCLOSED_CORRIDOR_HALF_WIDTH,
      -ENCLOSED_CORRIDOR_HALF_LENGTH,
      ENCLOSED_CORRIDOR_HALF_LENGTH,
    ),
  ],
  solids: [
    ...entryBays.solids,
    museumStoneWall(
      'west-north-filler',
      {
        axis: 'z',
        x: -ENCLOSED_CORRIDOR_HALF_WIDTH,
        z: ENCLOSED_CORRIDOR_WINDOW_CENTER,
        platformId: 'floor',
      },
      MUSEUM_WINDOW_WIDTH,
      MUSEUM_WINDOW_DEPTH,
    ),
    museumStoneWall(
      'east-north-filler',
      {
        axis: 'z',
        x: ENCLOSED_CORRIDOR_HALF_WIDTH,
        z: ENCLOSED_CORRIDOR_WINDOW_CENTER,
        platformId: 'floor',
      },
      MUSEUM_WINDOW_WIDTH,
      MUSEUM_WINDOW_DEPTH,
    ),
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
  ports: [
    {
      id: 'south',
      position: { x: 0, y: 0, z: -ENCLOSED_CORRIDOR_HALF_LENGTH },
      facingYaw: 0,
      width: MUSEUM_SCREEN_WIDTH,
      height: MUSEUM_WALL_TOP,
      sealSolidId: 'south-seal',
    },
    {
      id: 'north',
      position: { x: 0, y: 0, z: ENCLOSED_CORRIDOR_HALF_LENGTH },
      facingYaw: Math.PI,
      width: MUSEUM_SCREEN_WIDTH,
      height: MUSEUM_WALL_TOP,
      sealSolidId: 'north-seal',
    },
  ],
  exhibitMounts: [],
  exits: [],
  visuals: entryBays.visuals,
  audioRegions: [
    audioRegion(
      'entry',
      'gallery',
      -ENCLOSED_CORRIDOR_HALF_WIDTH,
      ENCLOSED_CORRIDOR_HALF_WIDTH,
      -ENCLOSED_CORRIDOR_HALF_LENGTH,
      ENCLOSED_CORRIDOR_HALF_LENGTH,
    ),
  ],
}

export const ENCLOSED_CORNER_ROOM: RoomPrefab = {
  id: 'enclosed-corner',
  bounds: {
    minX: -ENCLOSED_CORRIDOR_HALF_WIDTH,
    maxX: ENCLOSED_CORRIDOR_HALF_WIDTH + MUSEUM_SCREEN_DEPTH / 2,
    minY: -FLOOR_THICKNESS,
    maxY: MUSEUM_WALL_TOP,
    minZ: -ENCLOSED_CORRIDOR_HALF_WIDTH - MUSEUM_SCREEN_DEPTH / 2,
    maxZ: ENCLOSED_CORRIDOR_HALF_WIDTH,
  },
  cameraBounds: {
    minX: -CAMERA_CORRIDOR_HALF_WIDTH,
    maxX: CAMERA_CORRIDOR_HALF_WIDTH,
    minY: 0,
    maxY: CAMERA_TOP,
    minZ: -CAMERA_CORRIDOR_HALF_WIDTH,
    maxZ: CAMERA_CORRIDOR_HALF_WIDTH,
  },
  platforms: [
    deck(
      'floor',
      -ENCLOSED_CORRIDOR_HALF_WIDTH,
      ENCLOSED_CORRIDOR_HALF_WIDTH,
      -ENCLOSED_CORRIDOR_HALF_WIDTH,
      ENCLOSED_CORRIDOR_HALF_WIDTH,
    ),
  ],
  solids: [
    museumStoneWall(
      'east-wall',
      {
        axis: 'z',
        x: ENCLOSED_CORRIDOR_HALF_WIDTH,
        z: 0,
        platformId: 'floor',
      },
      MUSEUM_SCREEN_WIDTH,
      MUSEUM_SCREEN_DEPTH,
    ),
    museumStoneWall(
      'south-wall',
      {
        axis: 'x',
        x: 0,
        z: -ENCLOSED_CORRIDOR_HALF_WIDTH,
        platformId: 'floor',
      },
      MUSEUM_SCREEN_WIDTH,
      MUSEUM_SCREEN_DEPTH,
    ),
    museumPortSeal('west-seal', {
      axis: 'z',
      x: -ENCLOSED_CORRIDOR_HALF_WIDTH,
      z: 0,
      platformId: 'floor',
    }),
    museumPortSeal('north-seal', {
      axis: 'x',
      x: 0,
      z: ENCLOSED_CORRIDOR_HALF_WIDTH,
      platformId: 'floor',
    }),
  ],
  checkpoints: [],
  ports: [
    {
      id: 'west',
      position: { x: -ENCLOSED_CORRIDOR_HALF_WIDTH, y: 0, z: 0 },
      facingYaw: Math.PI / 2,
      width: MUSEUM_SCREEN_WIDTH,
      height: MUSEUM_WALL_TOP,
      sealSolidId: 'west-seal',
    },
    {
      id: 'north',
      position: { x: 0, y: 0, z: ENCLOSED_CORRIDOR_HALF_WIDTH },
      facingYaw: Math.PI,
      width: MUSEUM_SCREEN_WIDTH,
      height: MUSEUM_WALL_TOP,
      sealSolidId: 'north-seal',
    },
  ],
  exhibitMounts: [],
  exits: [],
  visuals: [],
  audioRegions: [
    audioRegion(
      'corner',
      'gallery',
      -ENCLOSED_CORRIDOR_HALF_WIDTH,
      ENCLOSED_CORRIDOR_HALF_WIDTH,
      -ENCLOSED_CORRIDOR_HALF_WIDTH,
      ENCLOSED_CORRIDOR_HALF_WIDTH,
    ),
  ],
}

const revealBays = flattenBays([
  museumScreenBay({
    id: 'west-south-screen',
    axis: 'z',
    x: -ENCLOSED_CORRIDOR_HALF_WIDTH,
    z: ENCLOSED_CORRIDOR_SCREEN_CENTER,
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
  museumScreenBay(
    {
      id: 'north-gate',
      axis: 'x',
      x: 0,
      z: ENCLOSED_CORRIDOR_HALF_LENGTH,
      yaw: Math.PI,
      platformId: 'floor',
    },
    GATE_PRESENTATION,
  ),
])

const revealCheckpoint: CheckpointDefinition = {
  id: 'entry',
  position: { x: 0, y: 0, z: -2 },
  facingYaw: Math.PI,
  radius: 0.42,
  requiresCompleted: ['threshold-goblet'],
}

export const ENCLOSED_REVEAL_ROOM: RoomPrefab = {
  id: 'enclosed-reveal',
  bounds: {
    minX: -ENCLOSED_CORRIDOR_HALF_WIDTH - MUSEUM_WINDOW_DEPTH / 2,
    maxX: ENCLOSED_CORRIDOR_HALF_WIDTH + MUSEUM_WINDOW_DEPTH / 2,
    minY: -FLOOR_THICKNESS,
    maxY: MUSEUM_WALL_TOP,
    minZ: -ENCLOSED_CORRIDOR_HALF_LENGTH,
    maxZ: ENCLOSED_CORRIDOR_HALF_LENGTH + MUSEUM_SCREEN_DEPTH / 2,
  },
  cameraBounds: {
    minX: -CAMERA_CORRIDOR_HALF_WIDTH,
    maxX: CAMERA_CORRIDOR_HALF_WIDTH,
    minY: 0,
    maxY: CAMERA_TOP,
    minZ: -CAMERA_CORRIDOR_HALF_LENGTH,
    maxZ: CAMERA_CORRIDOR_HALF_LENGTH,
  },
  platforms: [
    deck(
      'floor',
      -ENCLOSED_CORRIDOR_HALF_WIDTH,
      ENCLOSED_CORRIDOR_HALF_WIDTH,
      -ENCLOSED_CORRIDOR_HALF_LENGTH,
      ENCLOSED_CORRIDOR_HALF_LENGTH,
    ),
  ],
  solids: [
    ...revealBays.solids,
    museumStoneWall(
      'west-north-filler',
      {
        axis: 'z',
        x: -ENCLOSED_CORRIDOR_HALF_WIDTH,
        z: ENCLOSED_CORRIDOR_WINDOW_CENTER,
        platformId: 'floor',
      },
      MUSEUM_WINDOW_WIDTH,
      MUSEUM_WINDOW_DEPTH,
    ),
    museumStoneWall(
      'east-south-filler',
      {
        axis: 'z',
        x: ENCLOSED_CORRIDOR_HALF_WIDTH,
        z: ENCLOSED_CORRIDOR_SCREEN_CENTER,
        platformId: 'floor',
      },
      MUSEUM_SCREEN_WIDTH,
      MUSEUM_SCREEN_DEPTH,
    ),
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
  checkpoints: [revealCheckpoint],
  ports: [
    {
      id: 'south',
      position: { x: 0, y: 0, z: -ENCLOSED_CORRIDOR_HALF_LENGTH },
      facingYaw: 0,
      width: MUSEUM_SCREEN_WIDTH,
      height: MUSEUM_WALL_TOP,
      sealSolidId: 'south-seal',
    },
    {
      id: 'north',
      position: { x: 0, y: 0, z: ENCLOSED_CORRIDOR_HALF_LENGTH },
      facingYaw: Math.PI,
      width: MUSEUM_SCREEN_WIDTH,
      height: MUSEUM_WALL_TOP,
      sealSolidId: 'north-seal',
    },
  ],
  exhibitMounts: [
    {
      id: 'reveal-display',
      position: { x: 0.72, y: 0, z: 1.55 },
      anchor: { x: 0, y: 0, z: 0.8 },
      facingYaw: Math.PI,
      platformId: 'floor',
    },
  ],
  exits: [],
  visuals: revealBays.visuals,
  audioRegions: [
    audioRegion(
      'reveal',
      'gallery',
      -ENCLOSED_CORRIDOR_HALF_WIDTH,
      ENCLOSED_CORRIDOR_HALF_WIDTH,
      -ENCLOSED_CORRIDOR_HALF_LENGTH,
      ENCLOSED_CORRIDOR_HALF_LENGTH,
    ),
  ],
}

const terraceBays = flattenBays([
  museumWindowBay({
    id: 'west-window',
    axis: 'z',
    x: -ENCLOSED_CORRIDOR_HALF_WIDTH,
    z: 0,
    yaw: Math.PI / 2,
    platformId: 'neck-floor',
  }),
  museumWindowBay({
    id: 'east-window',
    axis: 'z',
    x: ENCLOSED_CORRIDOR_HALF_WIDTH,
    z: 0,
    yaw: -Math.PI / 2,
    platformId: 'neck-floor',
  }),
])

export const ENCLOSED_TERRACE_ROOM: RoomPrefab = {
  id: 'enclosed-terrace',
  bounds: {
    minX: -ENCLOSED_TERRACE_HALF_WIDTH,
    maxX: ENCLOSED_TERRACE_HALF_WIDTH,
    minY: -FLOOR_THICKNESS,
    maxY: MUSEUM_WALL_TOP,
    minZ: -ENCLOSED_CORRIDOR_HALF_WIDTH,
    maxZ: ENCLOSED_TERRACE_NORTH,
  },
  cameraBounds: {
    minX: -CAMERA_CORRIDOR_HALF_WIDTH,
    maxX: CAMERA_CORRIDOR_HALF_WIDTH,
    minY: 0,
    maxY: CAMERA_TOP,
    minZ: -CAMERA_CORRIDOR_HALF_WIDTH,
    maxZ: ENCLOSED_TERRACE_CAMERA_NORTH,
  },
  platforms: [
    deck(
      'neck-floor',
      -ENCLOSED_CORRIDOR_HALF_WIDTH,
      ENCLOSED_CORRIDOR_HALF_WIDTH,
      -ENCLOSED_CORRIDOR_HALF_WIDTH,
      MUSEUM_WINDOW_WIDTH / 2,
    ),
    deck(
      'balcony-floor',
      -ENCLOSED_TERRACE_HALF_WIDTH,
      ENCLOSED_TERRACE_HALF_WIDTH,
      ENCLOSED_TERRACE_BALCONY_START,
      ENCLOSED_TERRACE_NORTH,
    ),
  ],
  solids: [
    ...terraceBays.solids,
    museumPortSeal('south-seal', {
      axis: 'x',
      x: 0,
      z: -ENCLOSED_CORRIDOR_HALF_WIDTH,
      platformId: 'neck-floor',
    }),
  ],
  checkpoints: [],
  ports: [
    {
      id: 'south',
      position: { x: 0, y: 0, z: -ENCLOSED_CORRIDOR_HALF_WIDTH },
      facingYaw: 0,
      width: MUSEUM_SCREEN_WIDTH,
      height: MUSEUM_WALL_TOP,
      sealSolidId: 'south-seal',
    },
  ],
  exhibitMounts: [],
  exits: [
    {
      id: 'exit',
      minX: -0.65,
      maxX: 0.65,
      minZ: 3.3,
      maxZ: 3.7,
      top: 0,
    },
  ],
  visuals: terraceBays.visuals,
  audioRegions: [
    audioRegion(
      'terrace',
      'garden',
      -ENCLOSED_TERRACE_HALF_WIDTH,
      ENCLOSED_TERRACE_HALF_WIDTH,
      -ENCLOSED_CORRIDOR_HALF_WIDTH,
      ENCLOSED_TERRACE_NORTH,
      6,
    ),
  ],
}

export const ENCLOSED_TERRACE_PANORAMA_ROOM: RoomPrefab = {
  id: 'enclosed-terrace-panorama',
  bounds: {
    minX: -7,
    maxX: 7,
    minY: 0,
    maxY: 10,
    minZ: ENCLOSED_PANORAMA_CAMERA_SOUTH,
    maxZ: ENCLOSED_PANORAMA_CAMERA_NORTH,
  },
  cameraBounds: {
    minX: -7,
    maxX: 7,
    minY: 0,
    maxY: 10,
    minZ: ENCLOSED_PANORAMA_CAMERA_SOUTH,
    maxZ: ENCLOSED_PANORAMA_CAMERA_NORTH,
  },
  platforms: [],
  solids: [],
  checkpoints: [],
  ports: [],
  exhibitMounts: [],
  exits: [],
  visuals: [],
  audioRegions: [],
}

export const ENCLOSED_THRESHOLD_GOBLET = exhibit(
  'enclosed-threshold-goblet',
  'goblet',
)
export const ENCLOSED_WINDOW_COUPE = exhibit('enclosed-window-coupe', 'coupe')
export const ENCLOSED_PASSAGE_DECANTER = exhibit(
  'enclosed-passage-decanter',
  'decanter',
)

export const ENCLOSED_MUSEUM_AUTHORING_CATALOG: LevelAuthoringCatalog = {
  rooms: {
    [ENCLOSED_CHAMBER_ROOM.id]: ENCLOSED_CHAMBER_ROOM,
    [ENCLOSED_ENTRY_ROOM.id]: ENCLOSED_ENTRY_ROOM,
    [ENCLOSED_CORNER_ROOM.id]: ENCLOSED_CORNER_ROOM,
    [ENCLOSED_REVEAL_ROOM.id]: ENCLOSED_REVEAL_ROOM,
    [ENCLOSED_TERRACE_ROOM.id]: ENCLOSED_TERRACE_ROOM,
    [ENCLOSED_TERRACE_PANORAMA_ROOM.id]: ENCLOSED_TERRACE_PANORAMA_ROOM,
  },
  exhibits: {
    [ENCLOSED_THRESHOLD_GOBLET.id]: ENCLOSED_THRESHOLD_GOBLET,
    [ENCLOSED_WINDOW_COUPE.id]: ENCLOSED_WINDOW_COUPE,
    [ENCLOSED_PASSAGE_DECANTER.id]: ENCLOSED_PASSAGE_DECANTER,
  },
  availableAssetRecipeIds: [
    'deck',
    'goblet',
    'coupe',
    'decanter',
    'museum-window-v4',
    'museum-screen-v4',
  ],
}
