// Quarter-turn art study — one tiered modular donor on exact two-box support with exposed start and finish docks.

import type { LevelDefinition, PlatformDefinition } from '../contracts'
import { PEARL_QUARTER_TURN_DOCK_RENDER_ID, PEARL_QUARTER_TURN_RENDER_ID, PEARL_QUARTER_TURN_SUPPORT, } from './pearl-quarter-turn-profile'

export const QUARTER_TURN_ART_STUDY_SAVE_ID =
  'cloudway-quarter-turn-art-study-v1'
export const QUARTER_TURN_PLATFORM_ID = 'quarter-turn-a'
export const QUARTER_TURN_Z_ARM_ID = 'quarter-turn-a/z-arm'
export const QUARTER_TURN_START_ID = 'quarter-turn-a/start-dock'
export const QUARTER_TURN_FINISH_ID = 'quarter-turn-a/finish-dock'

const TOP = 0
const DOCK_SIZE = 1.6

function bounds(box: (typeof PEARL_QUARTER_TURN_SUPPORT.boxes)[number]) {
  return {
    minX: box.centre[0] - box.size[0] / 2,
    maxX: box.centre[0] + box.size[0] / 2,
    minZ: box.centre[2] - box.size[2] / 2,
    maxZ: box.centre[2] + box.size[2] / 2,
  }
}

const xArm = bounds(PEARL_QUARTER_TURN_SUPPORT.boxes[0])
const zArm = bounds(PEARL_QUARTER_TURN_SUPPORT.boxes[1])
const xDock = PEARL_QUARTER_TURN_SUPPORT.docks[0].position
const zDock = PEARL_QUARTER_TURN_SUPPORT.docks[1].position

export const QUARTER_TURN_ART_STUDY_PLATFORMS: readonly PlatformDefinition[] = [
  {
    id: QUARTER_TURN_START_ID,
    minX: zDock[0] - DOCK_SIZE / 2,
    maxX: zDock[0] + DOCK_SIZE / 2,
    minZ: zDock[2] - DOCK_SIZE,
    maxZ: zDock[2],
    top: TOP,
    thickness: PEARL_QUARTER_TURN_SUPPORT.thickness,
    kind: 'deck',
    material: 'stone',
    renderId: PEARL_QUARTER_TURN_DOCK_RENDER_ID,
  },
  {
    id: QUARTER_TURN_PLATFORM_ID,
    ...xArm,
    top: TOP,
    thickness: PEARL_QUARTER_TURN_SUPPORT.thickness,
    kind: 'deck',
    material: 'stone',
    renderId: PEARL_QUARTER_TURN_RENDER_ID,
    renderQuarterTurns: 0,
  },
  {
    id: QUARTER_TURN_Z_ARM_ID,
    parentPlatformId: QUARTER_TURN_PLATFORM_ID,
    ...zArm,
    top: TOP,
    thickness: PEARL_QUARTER_TURN_SUPPORT.thickness,
    kind: 'deck',
    material: 'stone',
    renderId: PEARL_QUARTER_TURN_RENDER_ID,
    renderQuarterTurns: 0,
  },
  {
    id: QUARTER_TURN_FINISH_ID,
    minX: xDock[0],
    maxX: xDock[0] + DOCK_SIZE,
    minZ: xDock[2] - DOCK_SIZE / 2,
    maxZ: xDock[2] + DOCK_SIZE / 2,
    top: TOP,
    thickness: PEARL_QUARTER_TURN_SUPPORT.thickness,
    kind: 'deck',
    material: 'stone',
    renderId: PEARL_QUARTER_TURN_DOCK_RENDER_ID,
  },
]

export const CLOUDWAY_QUARTER_TURN_ART_STUDY: LevelDefinition = {
  id: QUARTER_TURN_ART_STUDY_SAVE_ID,
  title: 'The Pearl Turn',
  authored: {
    levelId: QUARTER_TURN_ART_STUDY_SAVE_ID,
    layoutId: 'quarter-turn-art-study-v1',
    contentRevision: 1,
  },
  guidance: {
    subtitle: 'A modular path study',
    openingNotice: 'Follow the pearl path around the measured turn.',
    completionTitle: 'The pearl turn is complete.',
    completionNext: 'This route is an isolated art and footing study.',
  },
  movement: {
    walkSpeed: 1.55,
    runSpeed: 2.7,
    runDelaySeconds: 0.6,
    runRampSeconds: 0.8,
  },
  camera: {
    kind: 'route-sections',
    initialSectionId: 'pearl-turn',
    sections: [
      {
        id: 'pearl-turn',
        platformIds: [
          QUARTER_TURN_START_ID,
          QUARTER_TURN_PLATFORM_ID,
          QUARTER_TURN_FINISH_ID,
        ],
        yaw: Math.PI * 0.82,
        targetOffset: { x: -0.2, y: 0.42, z: 0.2 },
      },
    ],
  },
  presentation: {
    theme: 'cloudway',
    worldBounds: {
      minX: -4.2,
      maxX: 4.7,
      minY: -2,
      maxY: 6,
      minZ: -4.2,
      maxZ: 4.2,
    },
    lightBounds: {
      minX: -3.2,
      maxX: 3.8,
      minY: -0.5,
      maxY: 4.5,
      minZ: -3.4,
      maxZ: 3.2,
    },
    rooms: [],
    audioRegions: [],
    visuals: [],
    assetRecipeIds: [],
  },
  spawn: {
    position: { x: zDock[0], y: TOP, z: zDock[2] - DOCK_SIZE * 0.58 },
    facingYaw: Math.PI,
    checkpointId: 'quarter-turn-start',
  },
  platforms: QUARTER_TURN_ART_STUDY_PLATFORMS,
  intentionalGaps: [
    {
      id: 'quarter-turn-a-inner-quadrant',
      minX: zArm.maxX,
      maxX: xArm.maxX,
      minZ: zArm.minZ,
      maxZ: xArm.minZ,
      top: TOP,
    },
  ],
  checkpoints: [
    {
      id: 'quarter-turn-start',
      position: {
        x: zDock[0],
        y: TOP,
        z: zDock[2] - DOCK_SIZE * 0.58,
      },
      radius: 0.5,
      facingYaw: Math.PI,
    },
  ],
  breakables: [],
  exit: {
    minX: xDock[0] + DOCK_SIZE * 0.68,
    maxX: xDock[0] + DOCK_SIZE * 0.94,
    minZ: xDock[2] - 0.42,
    maxZ: xDock[2] + 0.42,
    top: TOP,
    requiresCompleted: [],
  },
  fallBelow: -1.6,
}
