// Foundation proof routes — the same two-room kit compiled straight and around one quarter turn.

import { composeLevel } from '../authoring/compose-level'
import type { AuthoredLevelSource } from '../authoring/contracts'
import { FOUNDATION_AUTHORING_CATALOG } from './foundation-room-kit'

const COMMON = {
  levelId: 'glass-foundation',
  contentRevision: 1,
  fallBelow: -1.4,
  spawnCheckpoint: 'arrival.entry',
  exit: {
    zone: 'gallery.north-exit',
    requiresCompleted: ['gallery-decanter'],
  },
  exhibits: [
    {
      id: 'arrival-goblet',
      roomId: 'arrival',
      prefabId: 'foundation-goblet',
      label: 'Threshold goblet',
      optional: false,
    },
    {
      id: 'gallery-decanter',
      roomId: 'gallery',
      prefabId: 'foundation-decanter',
      label: 'Gallery decanter',
      optional: false,
      requiresCompleted: ['arrival-goblet'],
    },
    {
      id: 'gallery-optional',
      roomId: 'gallery',
      prefabId: 'foundation-goblet',
      label: 'Side gallery goblet',
      optional: true,
      requiresCompleted: ['arrival-goblet'],
    },
  ],
} as const

export const FOUNDATION_STRAIGHT_SOURCE: AuthoredLevelSource = {
  ...COMMON,
  layoutId: 'straight',
  title: 'Foundation Gallery: Straight',
  rooms: [
    {
      id: 'arrival',
      prefabId: 'foundation-gallery',
      translate: { x: 0, y: 0, z: 0 },
      yawQuarterTurns: 0,
      audioSceneId: 'museum',
    },
    {
      id: 'gallery',
      prefabId: 'foundation-gallery',
      translate: { x: 0, y: 0, z: 6 },
      yawQuarterTurns: 0,
      audioSceneId: 'gallery',
    },
  ],
  exhibits: [
    { ...COMMON.exhibits[0], mountId: 'center-display' },
    { ...COMMON.exhibits[1], mountId: 'right-display' },
    { ...COMMON.exhibits[2], mountId: 'left-display' },
  ],
  connections: [
    {
      from: 'arrival.north',
      to: 'gallery.south',
      gate: {
        id: 'arrival-gate',
        opensAfter: 'arrival-goblet',
        material: 'brass',
      },
    },
  ],
  worldBounds: {
    minX: -4,
    maxX: 4,
    minY: -1.5,
    maxY: 4,
    minZ: -4,
    maxZ: 10,
  },
  lightBounds: {
    minX: -3.5,
    maxX: 3.5,
    minY: 0,
    maxY: 5,
    minZ: -3.5,
    maxZ: 9.5,
  },
}

export const FOUNDATION_QUARTER_TURN_SOURCE: AuthoredLevelSource = {
  ...COMMON,
  layoutId: 'quarter-turn',
  title: 'Foundation Gallery: Quarter Turn',
  rooms: [
    {
      id: 'arrival',
      prefabId: 'foundation-gallery',
      translate: { x: 0, y: 0, z: 0 },
      yawQuarterTurns: 0,
      audioSceneId: 'museum',
    },
    {
      id: 'gallery',
      prefabId: 'foundation-gallery',
      translate: { x: 6, y: 0, z: 0 },
      yawQuarterTurns: 1,
      audioSceneId: 'gallery',
    },
  ],
  exhibits: [
    { ...COMMON.exhibits[0], mountId: 'left-display' },
    { ...COMMON.exhibits[1], mountId: 'center-display' },
    { ...COMMON.exhibits[2], mountId: 'right-display' },
  ],
  connections: [
    {
      from: 'arrival.east',
      to: 'gallery.south',
      gate: {
        id: 'arrival-gate',
        opensAfter: 'arrival-goblet',
        material: 'brass',
      },
    },
  ],
  worldBounds: {
    minX: -4,
    maxX: 10,
    minY: -1.5,
    maxY: 4,
    minZ: -4,
    maxZ: 4,
  },
  lightBounds: {
    minX: -3.5,
    maxX: 9.5,
    minY: 0,
    maxY: 5,
    minZ: -3.5,
    maxZ: 3.5,
  },
}

export const GLASS_FOUNDATION_STRAIGHT = composeLevel(
  FOUNDATION_STRAIGHT_SOURCE,
  FOUNDATION_AUTHORING_CATALOG,
)

export const GLASS_FOUNDATION_QUARTER_TURN = composeLevel(
  FOUNDATION_QUARTER_TURN_SOURCE,
  FOUNDATION_AUTHORING_CATALOG,
)

export const GLASS_FOUNDATION_PROOF_LEVELS = [
  GLASS_FOUNDATION_STRAIGHT,
  GLASS_FOUNDATION_QUARTER_TURN,
] as const
