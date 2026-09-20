// Glassworks Journey kit — reusable two-port galleries and an exhibit-ready panorama terrace.

import type { ExhibitPrefab, LevelAuthoringCatalog, RoomAudioRegionDefinition, RoomPrefab, RoomVisualDefinition, } from '../authoring/contracts'
import type { CheckpointDefinition, HoldDefinition, PlatformDefinition, SolidPresentation, SolidPropDefinition, } from '../contracts'
import { ENCLOSED_CHAMBER_BAY_CENTER, ENCLOSED_CHAMBER_HALF, ENCLOSED_MUSEUM_AUTHORING_CATALOG, ENCLOSED_TERRACE_ROOM, } from './enclosed-museum-kit'
import type { MuseumWallBay } from './enclosed-wall-kit'
import { MUSEUM_SCREEN_WIDTH, MUSEUM_WALL_TOP, MUSEUM_WINDOW_DEPTH, museumPortSeal, museumScreenBay, museumWindowBay, } from './enclosed-wall-kit'
import { EXHIBIT_PLINTH } from './solid-props'

const FLOOR_THICKNESS = 0.25
const CAMERA_INSET = 0.1808
const CAMERA_TOP = 3.44

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

const galleryBays = flattenBays([
  museumWindowBay({
    id: 'south-west-window',
    axis: 'x',
    x: -ENCLOSED_CHAMBER_BAY_CENTER,
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
  museumScreenBay(
    {
      id: 'north-gate',
      axis: 'x',
      x: 0,
      z: ENCLOSED_CHAMBER_HALF,
      yaw: Math.PI,
      platformId: 'floor',
    },
    GATE_PRESENTATION,
  ),
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
  museumScreenBay({
    id: 'east-center',
    axis: 'z',
    x: ENCLOSED_CHAMBER_HALF,
    z: 0,
    yaw: -Math.PI / 2,
    platformId: 'floor',
  }),
  museumWindowBay({
    id: 'east-north-window',
    axis: 'z',
    x: ENCLOSED_CHAMBER_HALF,
    z: ENCLOSED_CHAMBER_BAY_CENTER,
    yaw: -Math.PI / 2,
    platformId: 'floor',
  }),
])

const galleryEntryCheckpoint: CheckpointDefinition = {
  id: 'entry',
  position: { x: 0, y: 0, z: -2.8 },
  facingYaw: Math.PI,
  radius: 0.42,
}

const galleryAudio: RoomAudioRegionDefinition = {
  id: 'gallery',
  bounds: {
    minX: -ENCLOSED_CHAMBER_HALF,
    maxX: ENCLOSED_CHAMBER_HALF,
    minY: 0,
    maxY: MUSEUM_WALL_TOP,
    minZ: -ENCLOSED_CHAMBER_HALF,
    maxZ: ENCLOSED_CHAMBER_HALF,
  },
  sceneId: 'gallery',
}

export const GLASSWORKS_JOURNEY_GALLERY_ROOM: RoomPrefab = {
  id: 'glassworks-journey-gallery',
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
    ...galleryBays.solids,
    museumPortSeal('south-seal', {
      axis: 'x',
      x: 0,
      z: -ENCLOSED_CHAMBER_HALF,
      platformId: 'floor',
    }),
    museumPortSeal('north-seal', {
      axis: 'x',
      x: 0,
      z: ENCLOSED_CHAMBER_HALF,
      platformId: 'floor',
    }),
  ],
  checkpoints: [galleryEntryCheckpoint],
  ports: [
    {
      id: 'south',
      position: { x: 0, y: 0, z: -ENCLOSED_CHAMBER_HALF },
      facingYaw: 0,
      width: MUSEUM_SCREEN_WIDTH,
      height: MUSEUM_WALL_TOP,
      sealSolidId: 'south-seal',
    },
    {
      id: 'north',
      position: { x: 0, y: 0, z: ENCLOSED_CHAMBER_HALF },
      facingYaw: Math.PI,
      width: MUSEUM_SCREEN_WIDTH,
      height: MUSEUM_WALL_TOP,
      sealSolidId: 'north-seal',
    },
  ],
  exhibitMounts: [
    {
      id: 'required-display',
      position: { x: 0, y: 0, z: 0.8 },
      anchor: { x: 0, y: 0, z: -0.05 },
      facingYaw: Math.PI,
      platformId: 'floor',
    },
    {
      id: 'west-display',
      position: { x: -2.65, y: 0, z: 1.8 },
      anchor: { x: -1.8, y: 0, z: 1.15 },
      facingYaw: Math.PI,
      platformId: 'floor',
    },
    {
      id: 'east-display',
      position: { x: 2.65, y: 0, z: 1.8 },
      anchor: { x: 1.8, y: 0, z: 1.15 },
      facingYaw: Math.PI,
      platformId: 'floor',
    },
  ],
  exits: [],
  visuals: galleryBays.visuals,
  audioRegions: [galleryAudio],
}

export const GLASSWORKS_JOURNEY_TERRACE_ROOM: RoomPrefab = {
  ...ENCLOSED_TERRACE_ROOM,
  id: 'glassworks-journey-terrace',
  checkpoints: [
    {
      id: 'panorama',
      position: { x: 0, y: 0, z: 2.1 },
      facingYaw: Math.PI,
      radius: 0.42,
    },
  ],
  exhibitMounts: [
    {
      id: 'west-overlook',
      position: { x: -2.4, y: 0, z: 3.35 },
      anchor: { x: -1.55, y: 0, z: 2.55 },
      facingYaw: Math.PI,
      platformId: 'balcony-floor',
    },
    {
      id: 'east-overlook',
      position: { x: 2.4, y: 0, z: 3.35 },
      anchor: { x: 1.55, y: 0, z: 2.55 },
      facingYaw: Math.PI,
      platformId: 'balcony-floor',
    },
  ],
}

export const GLASSWORKS_JOURNEY_FLUTED = exhibit(
  'glassworks-journey-fluted',
  'fluted',
)
export const GLASSWORKS_JOURNEY_PORTRAIT = exhibit(
  'glassworks-journey-portrait',
  'portrait',
)
export const GLASSWORKS_JOURNEY_AMPHORA = exhibit(
  'glassworks-journey-amphora',
  'amphora',
)

export const GLASSWORKS_JOURNEY_AUTHORING_CATALOG: LevelAuthoringCatalog = {
  rooms: {
    ...ENCLOSED_MUSEUM_AUTHORING_CATALOG.rooms,
    [GLASSWORKS_JOURNEY_GALLERY_ROOM.id]: GLASSWORKS_JOURNEY_GALLERY_ROOM,
    [GLASSWORKS_JOURNEY_TERRACE_ROOM.id]: GLASSWORKS_JOURNEY_TERRACE_ROOM,
  },
  exhibits: {
    ...ENCLOSED_MUSEUM_AUTHORING_CATALOG.exhibits,
    [GLASSWORKS_JOURNEY_FLUTED.id]: GLASSWORKS_JOURNEY_FLUTED,
    [GLASSWORKS_JOURNEY_PORTRAIT.id]: GLASSWORKS_JOURNEY_PORTRAIT,
    [GLASSWORKS_JOURNEY_AMPHORA.id]: GLASSWORKS_JOURNEY_AMPHORA,
  },
  availableAssetRecipeIds: [
    ...ENCLOSED_MUSEUM_AUTHORING_CATALOG.availableAssetRecipeIds,
    'fluted',
    'portrait',
    'amphora',
  ],
}
