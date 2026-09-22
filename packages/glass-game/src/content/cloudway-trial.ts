// Cloudway Glass Ribbon — one optional, forgiving route through frost, glide and crackle platforms.

import type { BreakableDefinition, ChallengeDefinition, CheckpointDefinition, HoldDefinition, LevelDefinition, PlatformDefinition, } from '../contracts'

const PLATFORM_TOP = 0
const PLATFORM_THICKNESS = 0.28

export const CLOUDWAY_PLATFORM_IDS = {
  arrival: 'cloudway-arrival',
  frostOne: 'cloudway-frost-one',
  frostTwo: 'cloudway-frost-two',
  frostCatch: 'cloudway-frost-catch',
  glideDockWest: 'cloudway-glide-dock-west',
  glideRaft: 'cloudway-glide-raft',
  glideDockEast: 'cloudway-glide-dock-east',
  crackleOne: 'cloudway-crackle-one',
  crackleRecovery: 'cloudway-crackle-recovery',
  crackleTwo: 'cloudway-crackle-two',
  finale: 'cloudway-finale',
} as const

export const CLOUDWAY_ENCOUNTER_IDS = {
  arrival: 'cloudway-arrival-goblet',
  crossing: 'cloudway-crossing-vase',
  finale: 'cloudway-finale-portrait',
} as const

const COMFORTABLE_HOLD: HoldDefinition = {
  requiredSeconds: 1.2,
  toleranceCents: 150,
  confidenceFloor: 0.5,
  dropoutGraceSeconds: 0.15,
  decayPerSecond: 0.25,
  maximumSampleGapSeconds: 0.1,
  maximumSampleAgeMs: 150,
}

const COMFORTABLE_CHALLENGE: ChallengeDefinition = {
  kind: 'hold',
  step: { target: 'comfortable', hold: COMFORTABLE_HOLD },
}

function platform(
  id: string,
  bounds: readonly [number, number, number, number],
  renderId: string,
  extra: Partial<PlatformDefinition> = {},
): PlatformDefinition {
  return {
    id,
    minX: bounds[0],
    maxX: bounds[1],
    minZ: bounds[2],
    maxZ: bounds[3],
    top: PLATFORM_TOP,
    thickness: PLATFORM_THICKNESS,
    kind: 'deck',
    material: 'stone',
    renderId,
    ...extra,
  }
}

function checkpoint(id: string, x: number, z: number): CheckpointDefinition {
  return {
    id,
    position: { x, y: PLATFORM_TOP, z },
    radius: 0.72,
    facingYaw: Math.PI,
  }
}

function exhibit(
  id: string,
  label: string,
  variant: string,
  position: { x: number; z: number },
  anchor: { x: number; z: number },
  requiresCompleted: readonly string[] = [],
): BreakableDefinition {
  return {
    id,
    label,
    variant,
    optional: false,
    position: { ...position, y: PLATFORM_TOP },
    anchor: { ...anchor, y: PLATFORM_TOP },
    requiresCompleted,
    challenge: COMFORTABLE_CHALLENGE,
  }
}

/**
 * Stable route hints for deterministic simulation and browser traversals.
 * The recommended direction is north along +Z; each jump begins from a wide,
 * static approach except the explicitly named glide raft.
 */
export const CLOUDWAY_GLASS_RIBBON_ROUTE = {
  recommendedTravelDirection: { x: 0, z: 1 },
  waypoints: [
    { platformId: CLOUDWAY_PLATFORM_IDS.arrival, x: 0, z: 2.8 },
    { platformId: CLOUDWAY_PLATFORM_IDS.frostOne, x: 0, z: 4.75 },
    { platformId: CLOUDWAY_PLATFORM_IDS.frostTwo, x: 0.65, z: 7.05 },
    { platformId: CLOUDWAY_PLATFORM_IDS.frostCatch, x: 0.7, z: 9.5 },
    { platformId: CLOUDWAY_PLATFORM_IDS.glideDockWest, x: 0.7, z: 12.35 },
    { platformId: CLOUDWAY_PLATFORM_IDS.glideRaft, x: 0.7, z: 14.4 },
    { platformId: CLOUDWAY_PLATFORM_IDS.glideDockEast, x: 0.7, z: 18.45 },
    { platformId: CLOUDWAY_PLATFORM_IDS.crackleOne, x: 0.8, z: 21.8 },
    { platformId: CLOUDWAY_PLATFORM_IDS.crackleRecovery, x: 0.8, z: 24.3 },
    { platformId: CLOUDWAY_PLATFORM_IDS.crackleTwo, x: 1, z: 27.15 },
    { platformId: CLOUDWAY_PLATFORM_IDS.finale, x: 1, z: 29.5 },
  ],
} as const

export const CLOUDWAY_GLASS_RIBBON: LevelDefinition = {
  id: 'cloudway-glass-ribbon',
  title: 'The Glass Ribbon',
  authored: {
    levelId: 'cloudway-glass-ribbon',
    layoutId: 'glass-ribbon',
    contentRevision: 1,
  },
  movement: {
    walkSpeed: 1.55,
    runSpeed: 2.6,
    runDelaySeconds: 0.6,
    runRampSeconds: 0.8,
  },
  guidance: {
    subtitle: 'A gentle road across pearl clouds',
    tutorial: {
      id: 'cloudway-first-crossing',
      version: 1,
      pages: [
        {
          title: 'Follow the gold ribbon.',
          body: 'Move and jump as usual. The broad marble landings are safe places to stop. Frost carries your momentum a little farther, with a wide landing beyond it.',
          aside:
            'There are no lives to lose. A missed jump returns Merc to the last safe landing.',
        },
        {
          title: 'Watch before you cross.',
          body: 'The opaline raft pauses at each dock. A crackle tile glows before it releases, and each one has solid marble immediately beyond it.',
          aside:
            'Singing happens only on still marble. Listen, rest and use your comfortable note whenever you are ready.',
        },
      ],
    },
    openingNotice: 'Sing to the goblet to begin.',
    encounterSuccessNotices: [
      {
        encounterId: CLOUDWAY_ENCOUNTER_IDS.arrival,
        notice: 'Time to cross the frost.',
      },
      {
        encounterId: CLOUDWAY_ENCOUNTER_IDS.crossing,
        notice: 'Cross the glowing tiles.',
      },
      {
        encounterId: CLOUDWAY_ENCOUNTER_IDS.finale,
        notice: 'Step through the gold light.',
      },
    ],
    completionTitle: 'The Glass Ribbon shines from shore to shore.',
    completionNext: 'Return to First Light Island whenever you are ready.',
  },
  spawn: {
    position: { x: 0, y: PLATFORM_TOP, z: 0.8 },
    facingYaw: Math.PI,
    checkpointId: 'cloudway-checkpoint-arrival',
  },
  platforms: [
    platform(
      CLOUDWAY_PLATFORM_IDS.arrival,
      [-1.7, 1.7, 0, 3.4],
      'cloudway-marble',
    ),
    platform(
      CLOUDWAY_PLATFORM_IDS.frostOne,
      [-1.2, 1.2, 3.9, 5.65],
      'cloudway-frost',
      {
        surface: {
          kind: 'frost',
          controlMultiplier: 0.62,
          brakingMultiplier: 0.38,
          maximumSpeed: 2.45,
        },
      },
    ),
    platform(
      CLOUDWAY_PLATFORM_IDS.frostTwo,
      [-0.55, 1.85, 6.2, 7.95],
      'cloudway-frost',
      {
        surface: {
          kind: 'frost',
          controlMultiplier: 0.62,
          brakingMultiplier: 0.38,
          maximumSpeed: 2.45,
        },
      },
    ),
    platform(
      CLOUDWAY_PLATFORM_IDS.frostCatch,
      [-1, 2.4, 8.5, 11.4],
      'cloudway-marble',
    ),
    platform(
      CLOUDWAY_PLATFORM_IDS.glideDockWest,
      [-0.7, 2.1, 11.4, 13],
      'cloudway-marble',
    ),
    platform(
      CLOUDWAY_PLATFORM_IDS.glideRaft,
      [-0.2, 1.6, 13.6, 15.2],
      'cloudway-glide',
      {
        behavior: {
          kind: 'glide',
          translation: { x: 0, y: 0, z: 1.9 },
          travelSeconds: 2.6,
          dwellSeconds: 1.35,
        },
      },
    ),
    platform(
      CLOUDWAY_PLATFORM_IDS.glideDockEast,
      [-0.65, 2.15, 17.65, 20.45],
      'cloudway-marble',
    ),
    platform(
      CLOUDWAY_PLATFORM_IDS.crackleOne,
      [-0.1, 1.7, 21, 22.65],
      'cloudway-crackle',
      {
        behavior: {
          kind: 'crackle',
          warningSeconds: 2.4,
          releaseSeconds: 1.15,
          resetSeconds: 2,
        },
      },
    ),
    platform(
      CLOUDWAY_PLATFORM_IDS.crackleRecovery,
      [-0.7, 2.3, 23.2, 25.8],
      'cloudway-marble',
    ),
    platform(
      CLOUDWAY_PLATFORM_IDS.crackleTwo,
      [0.1, 1.9, 26.35, 28],
      'cloudway-crackle',
      {
        behavior: {
          kind: 'crackle',
          warningSeconds: 2.4,
          releaseSeconds: 1.15,
          resetSeconds: 2,
        },
      },
    ),
    platform(
      CLOUDWAY_PLATFORM_IDS.finale,
      [-1, 3, 28.55, 33],
      'cloudway-marble',
    ),
  ],
  intentionalGaps: [
    {
      id: 'cloudway-gap-arrival-frost-one',
      minX: -1.2,
      maxX: 1.2,
      minZ: 3.4,
      maxZ: 3.9,
      top: PLATFORM_TOP,
    },
    {
      id: 'cloudway-gap-frost-one-two',
      minX: -0.55,
      maxX: 1.2,
      minZ: 5.65,
      maxZ: 6.2,
      top: PLATFORM_TOP,
    },
    {
      id: 'cloudway-gap-frost-two-catch',
      minX: -0.55,
      maxX: 1.85,
      minZ: 7.95,
      maxZ: 8.5,
      top: PLATFORM_TOP,
    },
    {
      id: 'cloudway-gap-dock-west-raft',
      minX: -0.2,
      maxX: 1.6,
      minZ: 13,
      maxZ: 13.6,
      top: PLATFORM_TOP,
    },
    {
      id: 'cloudway-gap-raft-dock-east',
      minX: -0.2,
      maxX: 1.6,
      minZ: 17.1,
      maxZ: 17.65,
      top: PLATFORM_TOP,
    },
    {
      id: 'cloudway-gap-dock-east-crackle-one',
      minX: -0.1,
      maxX: 1.7,
      minZ: 20.45,
      maxZ: 21,
      top: PLATFORM_TOP,
    },
    {
      id: 'cloudway-gap-crackle-one-recovery',
      minX: -0.1,
      maxX: 1.7,
      minZ: 22.65,
      maxZ: 23.2,
      top: PLATFORM_TOP,
    },
    {
      id: 'cloudway-gap-recovery-crackle-two',
      minX: 0.1,
      maxX: 1.9,
      minZ: 25.8,
      maxZ: 26.35,
      top: PLATFORM_TOP,
    },
    {
      id: 'cloudway-gap-crackle-two-finale',
      minX: 0.1,
      maxX: 1.9,
      minZ: 28,
      maxZ: 28.55,
      top: PLATFORM_TOP,
    },
  ],
  // Static marble landings are movement recovery anchors. Singing order stays
  // enforced by the encounters and exit, independently of fall recovery.
  checkpoints: [
    checkpoint('cloudway-checkpoint-arrival', 0, 0.8),
    checkpoint('cloudway-checkpoint-frost-catch', 0.7, 9.5),
    checkpoint('cloudway-checkpoint-glide-east', 0.7, 18.45),
    checkpoint('cloudway-checkpoint-crackle-recovery', 0.8, 24.3),
    checkpoint('cloudway-checkpoint-finale', 1, 29.5),
  ],
  breakables: [
    exhibit(
      CLOUDWAY_ENCOUNTER_IDS.arrival,
      'The ribbon goblet',
      'goblet',
      { x: 1.05, z: 1.75 },
      { x: 0.3, z: 1.75 },
    ),
    exhibit(
      CLOUDWAY_ENCOUNTER_IDS.crossing,
      'The opaline crossing vase',
      'vase',
      { x: 1.45, z: 18.55 },
      { x: 0.7, z: 18.55 },
      [CLOUDWAY_ENCOUNTER_IDS.arrival],
    ),
    exhibit(
      CLOUDWAY_ENCOUNTER_IDS.finale,
      'The cloudway portrait',
      'portrait',
      { x: 1, z: 31.15 },
      { x: 1, z: 30.4 },
      [CLOUDWAY_ENCOUNTER_IDS.crossing],
    ),
  ],
  exit: {
    minX: 0.4,
    maxX: 1.6,
    minZ: 31.95,
    maxZ: 32.15,
    top: PLATFORM_TOP,
    requiresCompleted: [
      CLOUDWAY_ENCOUNTER_IDS.arrival,
      CLOUDWAY_ENCOUNTER_IDS.crossing,
      CLOUDWAY_ENCOUNTER_IDS.finale,
    ],
  },
  fallBelow: -3.5,
  presentation: {
    theme: 'cloudway',
    worldBounds: {
      minX: -8,
      maxX: 8,
      minY: -5,
      maxY: 6,
      minZ: -4,
      maxZ: 36,
    },
    lightBounds: {
      minX: -3,
      maxX: 4,
      minY: -1,
      maxY: 5,
      minZ: 0,
      maxZ: 32.5,
    },
    rooms: [],
    audioRegions: [
      {
        id: 'cloudway-audio-route',
        bounds: {
          minX: -8,
          maxX: 8,
          minY: -5,
          maxY: 6,
          minZ: -4,
          maxZ: 36,
        },
        sceneId: 'garden',
      },
    ],
    visuals: [],
    assetRecipeIds: [
      'cloudway-marble',
      'cloudway-frost',
      'cloudway-glide',
      'cloudway-crackle',
      'goblet',
      'vase',
      'portrait',
    ],
  },
}
