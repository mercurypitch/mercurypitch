// Foundation room kit — one enclosed gallery, held-note exhibits and shared measured plinths.

import type { ExhibitPrefab, LevelAuthoringCatalog, RoomPrefab, } from '../authoring/contracts'
import type { SolidPropDefinition } from '../contracts'
import { EXHIBIT_PLINTH } from './solid-props'

const WALL_TOP = 1.55
const PORT_HALF_WIDTH = 0.7
const WALL_INNER = 2.88
const WALL_OUTER = 3.05

function wall(
  id: string,
  minX: number,
  maxX: number,
  minZ: number,
  maxZ: number,
): SolidPropDefinition {
  return {
    id,
    kind: 'prop',
    shape: 'box',
    minX,
    maxX,
    minZ,
    maxZ,
    top: WALL_TOP,
    thickness: WALL_TOP,
    presentation: { role: 'wall', material: 'stone' },
  }
}

const ROOM_SOLIDS: readonly SolidPropDefinition[] = [
  wall(
    'north-west-wall',
    -WALL_OUTER,
    -PORT_HALF_WIDTH,
    WALL_INNER,
    WALL_OUTER,
  ),
  wall('north-east-wall', PORT_HALF_WIDTH, WALL_OUTER, WALL_INNER, WALL_OUTER),
  wall('north-seal', -PORT_HALF_WIDTH, PORT_HALF_WIDTH, WALL_INNER, WALL_OUTER),
  wall(
    'south-west-wall',
    -WALL_OUTER,
    -PORT_HALF_WIDTH,
    -WALL_OUTER,
    -WALL_INNER,
  ),
  wall(
    'south-east-wall',
    PORT_HALF_WIDTH,
    WALL_OUTER,
    -WALL_OUTER,
    -WALL_INNER,
  ),
  wall(
    'south-seal',
    -PORT_HALF_WIDTH,
    PORT_HALF_WIDTH,
    -WALL_OUTER,
    -WALL_INNER,
  ),
  wall(
    'east-south-wall',
    WALL_INNER,
    WALL_OUTER,
    -WALL_OUTER,
    -PORT_HALF_WIDTH,
  ),
  wall('east-north-wall', WALL_INNER, WALL_OUTER, PORT_HALF_WIDTH, WALL_OUTER),
  wall('east-seal', WALL_INNER, WALL_OUTER, -PORT_HALF_WIDTH, PORT_HALF_WIDTH),
  wall(
    'west-south-wall',
    -WALL_OUTER,
    -WALL_INNER,
    -WALL_OUTER,
    -PORT_HALF_WIDTH,
  ),
  wall(
    'west-north-wall',
    -WALL_OUTER,
    -WALL_INNER,
    PORT_HALF_WIDTH,
    WALL_OUTER,
  ),
  wall(
    'west-seal',
    -WALL_OUTER,
    -WALL_INNER,
    -PORT_HALF_WIDTH,
    PORT_HALF_WIDTH,
  ),
]

export const FOUNDATION_GALLERY_ROOM: RoomPrefab = {
  id: 'foundation-gallery',
  bounds: {
    minX: -WALL_OUTER,
    maxX: WALL_OUTER,
    minY: -0.25,
    maxY: WALL_TOP,
    minZ: -WALL_OUTER,
    maxZ: WALL_OUTER,
  },
  cameraBounds: {
    minX: -3.3,
    maxX: 3.3,
    minY: 0,
    maxY: 3.2,
    minZ: -3.3,
    maxZ: 3.3,
  },
  platforms: [
    {
      id: 'floor',
      minX: -3,
      maxX: 3,
      minZ: -3,
      maxZ: 3,
      top: 0,
      thickness: 0.25,
      kind: 'deck',
      material: 'stone',
      renderId: 'deck',
      presentation: { role: 'floor', material: 'stone' },
    },
  ],
  solids: ROOM_SOLIDS,
  checkpoints: [
    {
      id: 'entry',
      position: { x: 0, y: 0, z: -2 },
      facingYaw: Math.PI,
      radius: 0.42,
    },
    {
      id: 'center',
      position: { x: 0, y: 0, z: -0.65 },
      facingYaw: Math.PI,
      radius: 0.42,
    },
  ],
  ports: [
    {
      id: 'north',
      position: { x: 0, y: 0, z: 3 },
      facingYaw: Math.PI,
      width: PORT_HALF_WIDTH * 2,
      height: WALL_TOP,
      sealSolidId: 'north-seal',
    },
    {
      id: 'south',
      position: { x: 0, y: 0, z: -3 },
      facingYaw: 0,
      width: PORT_HALF_WIDTH * 2,
      height: WALL_TOP,
      sealSolidId: 'south-seal',
    },
    {
      id: 'east',
      position: { x: 3, y: 0, z: 0 },
      facingYaw: -Math.PI / 2,
      width: PORT_HALF_WIDTH * 2,
      height: WALL_TOP,
      sealSolidId: 'east-seal',
    },
    {
      id: 'west',
      position: { x: -3, y: 0, z: 0 },
      facingYaw: Math.PI / 2,
      width: PORT_HALF_WIDTH * 2,
      height: WALL_TOP,
      sealSolidId: 'west-seal',
    },
  ],
  exhibitMounts: [
    {
      id: 'center-display',
      position: { x: 0, y: 0, z: 1.3 },
      anchor: { x: 0, y: 0, z: 0.45 },
      facingYaw: Math.PI,
      platformId: 'floor',
    },
    {
      id: 'left-display',
      position: { x: -1.25, y: 0, z: 1.2 },
      anchor: { x: -1.25, y: 0, z: 0.25 },
      facingYaw: Math.PI,
      platformId: 'floor',
    },
    {
      id: 'right-display',
      position: { x: 1.25, y: 0, z: 1.2 },
      anchor: { x: 1.25, y: 0, z: 0.25 },
      facingYaw: Math.PI,
      platformId: 'floor',
    },
  ],
  exits: [
    {
      id: 'north-exit',
      minX: -0.55,
      maxX: 0.55,
      minZ: 2.1,
      maxZ: 2.65,
      top: 0,
    },
  ],
  visuals: [],
  audioRegions: [
    {
      id: 'gallery-room',
      bounds: {
        minX: -2.85,
        maxX: 2.85,
        minY: 0,
        maxY: 2.8,
        minZ: -2.85,
        maxZ: 2.85,
      },
      sceneId: 'gallery',
    },
  ],
}

function exhibit(id: string, variant: string): ExhibitPrefab {
  return {
    id,
    variant,
    plinth: {
      ...EXHIBIT_PLINTH,
      height: EXHIBIT_PLINTH.height,
      presentation: { role: 'plinth', material: 'stone' },
    },
  }
}

export const FOUNDATION_GOBLET = exhibit('foundation-goblet', 'goblet')
export const FOUNDATION_DECANTER = exhibit('foundation-decanter', 'decanter')

export const FOUNDATION_AUTHORING_CATALOG: LevelAuthoringCatalog = {
  rooms: { [FOUNDATION_GALLERY_ROOM.id]: FOUNDATION_GALLERY_ROOM },
  exhibits: {
    [FOUNDATION_GOBLET.id]: FOUNDATION_GOBLET,
    [FOUNDATION_DECANTER.id]: FOUNDATION_DECANTER,
  },
  availableAssetRecipeIds: ['deck', 'goblet', 'decanter'],
}
