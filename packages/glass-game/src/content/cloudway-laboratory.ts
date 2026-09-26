// Crystal Promenade first slice — a bounded developer route proves accepted scroll and crackle art without loading the full source catalogue.

import type { BreakableDefinition, LevelDefinition, PlatformDefinition, SolidPropDefinition, } from '../contracts'
import { CLOUDWAY_LAB_PLATFORM_RENDER_IDS } from '../render/cloudway-laboratory-catalog'
import { EXHIBIT_PLINTH } from './solid-props'

const PEARL_WIDTH = 3.2
const PEARL_DEPTH = 0.72
const SCROLL_LOCAL_WIDTH = 0.757494056
const SCROLL_LOCAL_DEPTH = 2.205964088
const ROSE_WIDTH = 1.64
const ROSE_DEPTH = 1.64
const AMETHYST_WIDTH = 1.64
const AMETHYST_DEPTH = 1.1
const AMETHYST_HEIGHT = 0.25
const ARRIVAL_APPROACH_GAP = 0.55
const SCROLL_GAP = 0.7
const CRYSTAL_GAP = 0.5

// Unscaled pearl donors join only in two-row safe courts; real air separates
// every challenge so each court keeps a clear silhouette.
// Lateral offsets stage a short S bend, and forward gaps are measured between
// certified contact edges rather than decorative mesh bounds.
const ARRIVAL_X = -0.85
const ARRIVAL_COURT_Z = -10.8
const ARRIVAL_ENTRY_Z = ARRIVAL_COURT_Z - PEARL_DEPTH / 2
const ARRIVAL_Z = ARRIVAL_COURT_Z + PEARL_DEPTH / 2
const SCROLL_APPROACH_X = 0.15
const SCROLL_APPROACH_ENTRY_Z = ARRIVAL_Z + PEARL_DEPTH + ARRIVAL_APPROACH_GAP
const SCROLL_APPROACH_Z = SCROLL_APPROACH_ENTRY_Z + PEARL_DEPTH
const SCROLL_X = SCROLL_APPROACH_X
const SCROLL_Z =
  SCROLL_APPROACH_Z + PEARL_DEPTH / 2 + SCROLL_GAP + SCROLL_LOCAL_WIDTH / 2
const SCROLL_CATCH_X = SCROLL_X
const SCROLL_CATCH_Z =
  SCROLL_Z + SCROLL_LOCAL_WIDTH / 2 + SCROLL_GAP + PEARL_DEPTH / 2
const SCROLL_COURT_Z = SCROLL_CATCH_Z + PEARL_DEPTH
const ROSE_X = -0.25
const ROSE_Z = SCROLL_COURT_Z + PEARL_DEPTH / 2 + CRYSTAL_GAP + ROSE_DEPTH / 2
const AMETHYST_X = 0.25
const AMETHYST_Z = ROSE_Z + ROSE_DEPTH / 2 + CRYSTAL_GAP + AMETHYST_DEPTH / 2
const FINAL_CATCH_X = 0.85
const FINAL_CATCH_Z =
  AMETHYST_Z + AMETHYST_DEPTH / 2 + CRYSTAL_GAP + PEARL_DEPTH / 2
const FINAL_TERRACE_Z = FINAL_CATCH_Z + PEARL_DEPTH
// Keep the gate's original approach/crossing window attached to the final rest.
const EXIT_MIN_Z = FINAL_TERRACE_Z - 0.137494056
const EXIT_MAX_Z = FINAL_TERRACE_Z + 0.362505944

function deck(
  id: string,
  x: number,
  z: number,
  width: number,
  depth: number,
  top: number,
  thickness: number,
  extra: Partial<
    Pick<
      PlatformDefinition,
      'behavior' | 'renderId' | 'renderQuarterTurns' | 'surface'
    >
  > = {},
): PlatformDefinition {
  return {
    id,
    minX: x - width / 2,
    maxX: x + width / 2,
    minZ: z - depth / 2,
    maxZ: z + depth / 2,
    top,
    thickness,
    kind: 'deck',
    material: 'stone',
    ...extra,
  }
}

const PLATFORMS: readonly PlatformDefinition[] = [
  deck(
    'arrival-entry',
    ARRIVAL_X,
    ARRIVAL_ENTRY_Z,
    PEARL_WIDTH,
    PEARL_DEPTH,
    0,
    0.34,
    { renderId: CLOUDWAY_LAB_PLATFORM_RENDER_IDS.pearlRest },
  ),
  deck('arrival', ARRIVAL_X, ARRIVAL_Z, PEARL_WIDTH, PEARL_DEPTH, 0, 0.34, {
    renderId: CLOUDWAY_LAB_PLATFORM_RENDER_IDS.pearlRest,
  }),
  deck(
    'scroll-approach-entry',
    SCROLL_APPROACH_X,
    SCROLL_APPROACH_ENTRY_Z,
    PEARL_WIDTH,
    PEARL_DEPTH,
    0,
    0.34,
    { renderId: CLOUDWAY_LAB_PLATFORM_RENDER_IDS.pearlRest },
  ),
  deck(
    'scroll-approach',
    SCROLL_APPROACH_X,
    SCROLL_APPROACH_Z,
    PEARL_WIDTH,
    PEARL_DEPTH,
    0,
    0.34,
    { renderId: CLOUDWAY_LAB_PLATFORM_RENDER_IDS.pearlRest },
  ),
  deck(
    'scroll-deck',
    SCROLL_X,
    SCROLL_Z,
    SCROLL_LOCAL_DEPTH,
    SCROLL_LOCAL_WIDTH,
    0,
    0.1,
    {
      renderId: CLOUDWAY_LAB_PLATFORM_RENDER_IDS.scroll,
      renderQuarterTurns: 1,
      behavior: {
        kind: 'scroll',
        axis: 'z',
        minLengthRatio: 0.25,
        extendedSeconds: 4,
        retractedSeconds: 3,
        transitionSeconds: 1.5,
        initialState: 'extended',
      },
    },
  ),
  deck(
    'scroll-catch',
    SCROLL_CATCH_X,
    SCROLL_CATCH_Z,
    PEARL_WIDTH,
    PEARL_DEPTH,
    0,
    0.34,
    { renderId: CLOUDWAY_LAB_PLATFORM_RENDER_IDS.pearlRest },
  ),
  deck(
    'scroll-court',
    SCROLL_CATCH_X,
    SCROLL_COURT_Z,
    PEARL_WIDTH,
    PEARL_DEPTH,
    0,
    0.34,
    { renderId: CLOUDWAY_LAB_PLATFORM_RENDER_IDS.pearlRest },
  ),
  deck('rose-step', ROSE_X, ROSE_Z, ROSE_WIDTH, ROSE_DEPTH, 0, 0.24, {
    renderId: CLOUDWAY_LAB_PLATFORM_RENDER_IDS.roseCrackle,
    behavior: {
      kind: 'crackle',
      warningSeconds: 2,
      releaseSeconds: 1.15,
      resetSeconds: 2,
    },
  }),
  deck(
    'amethyst-step',
    AMETHYST_X,
    AMETHYST_Z,
    AMETHYST_WIDTH,
    AMETHYST_DEPTH,
    0,
    AMETHYST_HEIGHT,
    {
      renderId: CLOUDWAY_LAB_PLATFORM_RENDER_IDS.amethystCrackle,
      behavior: {
        kind: 'crackle',
        warningSeconds: 4,
        releaseSeconds: 1.15,
        resetSeconds: 2,
      },
    },
  ),
  deck(
    'final-catch',
    FINAL_CATCH_X,
    FINAL_CATCH_Z,
    PEARL_WIDTH,
    PEARL_DEPTH,
    0,
    0.34,
    { renderId: CLOUDWAY_LAB_PLATFORM_RENDER_IDS.pearlRest },
  ),
  deck(
    'final-terrace',
    FINAL_CATCH_X,
    FINAL_TERRACE_Z,
    PEARL_WIDTH,
    PEARL_DEPTH,
    0,
    0.34,
    { renderId: CLOUDWAY_LAB_PLATFORM_RENDER_IDS.pearlRest },
  ),
]

function holdTarget(
  id: string,
  label: string,
  x: number,
  z: number,
  anchorX: number,
  requiresCompleted: readonly string[],
): BreakableDefinition {
  return {
    id,
    label,
    variant: 'cloudway-lab-voice',
    optional: false,
    position: { x, y: 0, z },
    anchor: { x: anchorX, y: 0, z },
    requiresCompleted,
    challenge: {
      kind: 'hold',
      step: {
        target: 'comfortable',
        hold: {
          requiredSeconds: 1.2,
          toleranceCents: 150,
          confidenceFloor: 0.5,
          dropoutGraceSeconds: 0.15,
          decayPerSecond: 0.25,
          maximumSampleGapSeconds: 0.1,
          maximumSampleAgeMs: 150,
        },
      },
    },
  }
}

const BREAKABLES = [
  holdTarget('voice-home', 'The arrival camellia', -1.75, ARRIVAL_Z, -1.1, []),
  holdTarget(
    'voice-third',
    'The scroll-court urn',
    -0.75,
    SCROLL_COURT_Z,
    -0.2,
    ['voice-home'],
  ),
  holdTarget('voice-fifth', 'The promenade bell', -0.15, FINAL_CATCH_Z, 0.4, [
    'voice-third',
  ]),
] as const satisfies readonly BreakableDefinition[]

const SOLIDS: readonly SolidPropDefinition[] = BREAKABLES.map((target) => ({
  id: `plinth:${target.id}`,
  kind: 'prop',
  shape: 'cylinder',
  x: target.position.x,
  z: target.position.z,
  top: target.position.y + EXHIBIT_PLINTH.height,
  thickness: EXHIBIT_PLINTH.height,
  radiusTop: EXHIBIT_PLINTH.radiusTop,
  radiusBottom: EXHIBIT_PLINTH.radiusBottom,
}))

export const CLOUDWAY_CRYSTAL_PROMENADE_STUDY: LevelDefinition = {
  id: 'cloudway-crystal-promenade-first-slice',
  title: 'The Crystal Promenade',
  authored: {
    levelId: 'cloudway-crystal-promenade-first-slice',
    layoutId: 'crystal-promenade-first-slice',
    contentRevision: 2,
  },
  movement: {
    walkSpeed: 1.55,
    runSpeed: 2.6,
    runDelaySeconds: 0.6,
    runRampSeconds: 0.8,
  },
  guidance: {
    subtitle: 'The first Crystal Promenade crossing',
    openingNotice: 'Sing on the safe arrival before crossing the scroll.',
    completionTitle: 'The first promenade passage shines.',
    completionNext: 'Return while the remaining gallery art is prepared.',
  },
  spawn: {
    position: { x: -0.2, y: 0, z: ARRIVAL_ENTRY_Z },
    facingYaw: Math.PI,
    checkpointId: 'arrival-save',
  },
  checkpoints: [
    {
      id: 'arrival-save',
      position: { x: -0.2, y: 0, z: ARRIVAL_ENTRY_Z },
      radius: 0.65,
      facingYaw: Math.PI,
    },
    {
      id: 'scroll-save',
      position: { x: SCROLL_APPROACH_X, y: 0, z: SCROLL_APPROACH_Z },
      radius: 0.42,
      facingYaw: Math.PI,
      requiresCompleted: ['voice-home'],
    },
    {
      id: 'final-save',
      position: { x: FINAL_CATCH_X, y: 0, z: FINAL_CATCH_Z },
      radius: 0.36,
      facingYaw: Math.PI,
      requiresCompleted: ['voice-third'],
    },
  ],
  camera: {
    kind: 'route-sections',
    initialSectionId: 'arrival-court',
    landingDwellSeconds: 0.75,
    sections: [
      {
        id: 'arrival-court',
        platformIds: ['arrival-entry', 'arrival'],
        yaw: Math.atan2(
          -(SCROLL_APPROACH_X - ARRIVAL_X),
          -(SCROLL_APPROACH_ENTRY_Z - ARRIVAL_Z),
        ),
        targetOffset: { x: 0.3, y: 0, z: 0.7 },
      },
      {
        id: 'scroll-crossing',
        platformIds: [
          'scroll-approach-entry',
          'scroll-approach',
          'scroll-deck',
          'scroll-catch',
          'scroll-court',
        ],
        yaw: Math.PI,
        targetOffset: { x: 0, y: 0, z: 0.65 },
      },
      {
        id: 'crystal-duet',
        platformIds: [
          'rose-step',
          'amethyst-step',
          'final-catch',
          'final-terrace',
        ],
        yaw: Math.atan2(-(FINAL_CATCH_X - ROSE_X), -(FINAL_CATCH_Z - ROSE_Z)),
        targetOffset: { x: 0.25, y: 0, z: 0.65 },
      },
    ],
  },
  exit: {
    minX: 1.3,
    maxX: 2.2,
    minZ: EXIT_MIN_Z,
    maxZ: EXIT_MAX_Z,
    top: 0,
    requiresCompleted: ['voice-home', 'voice-third', 'voice-fifth'],
  },
  fallBelow: -3.5,
  intentionalGaps: [
    {
      id: 'arrival-approach',
      minX: Math.max(
        ARRIVAL_X - PEARL_WIDTH / 2,
        SCROLL_APPROACH_X - PEARL_WIDTH / 2,
      ),
      maxX: Math.min(
        ARRIVAL_X + PEARL_WIDTH / 2,
        SCROLL_APPROACH_X + PEARL_WIDTH / 2,
      ),
      minZ: ARRIVAL_Z + PEARL_DEPTH / 2,
      maxZ: SCROLL_APPROACH_ENTRY_Z - PEARL_DEPTH / 2,
      top: 0,
    },
    {
      id: 'scroll-entry',
      minX: Math.max(
        SCROLL_APPROACH_X - PEARL_WIDTH / 2,
        SCROLL_X - SCROLL_LOCAL_DEPTH / 2,
      ),
      maxX: Math.min(
        SCROLL_APPROACH_X + PEARL_WIDTH / 2,
        SCROLL_X + SCROLL_LOCAL_DEPTH / 2,
      ),
      minZ: SCROLL_APPROACH_Z + PEARL_DEPTH / 2,
      maxZ: SCROLL_Z - SCROLL_LOCAL_WIDTH / 2,
      top: 0,
    },
    {
      id: 'scroll-exit',
      minX: Math.max(
        SCROLL_X - SCROLL_LOCAL_DEPTH / 2,
        SCROLL_CATCH_X - PEARL_WIDTH / 2,
      ),
      maxX: Math.min(
        SCROLL_X + SCROLL_LOCAL_DEPTH / 2,
        SCROLL_CATCH_X + PEARL_WIDTH / 2,
      ),
      minZ: SCROLL_Z + SCROLL_LOCAL_WIDTH / 2,
      maxZ: SCROLL_CATCH_Z - PEARL_DEPTH / 2,
      top: 0,
    },
    {
      id: 'rose-entry',
      minX: Math.max(SCROLL_CATCH_X - PEARL_WIDTH / 2, ROSE_X - ROSE_WIDTH / 2),
      maxX: Math.min(SCROLL_CATCH_X + PEARL_WIDTH / 2, ROSE_X + ROSE_WIDTH / 2),
      minZ: SCROLL_COURT_Z + PEARL_DEPTH / 2,
      maxZ: ROSE_Z - ROSE_DEPTH / 2,
      top: 0,
    },
    {
      id: 'crystal-duet',
      minX: Math.max(ROSE_X - ROSE_WIDTH / 2, AMETHYST_X - AMETHYST_WIDTH / 2),
      maxX: Math.min(ROSE_X + ROSE_WIDTH / 2, AMETHYST_X + AMETHYST_WIDTH / 2),
      minZ: ROSE_Z + ROSE_DEPTH / 2,
      maxZ: AMETHYST_Z - AMETHYST_DEPTH / 2,
      top: 0,
    },
    {
      id: 'duet-exit',
      minX: Math.max(
        AMETHYST_X - AMETHYST_WIDTH / 2,
        FINAL_CATCH_X - PEARL_WIDTH / 2,
      ),
      maxX: Math.min(
        AMETHYST_X + AMETHYST_WIDTH / 2,
        FINAL_CATCH_X + PEARL_WIDTH / 2,
      ),
      minZ: AMETHYST_Z + AMETHYST_DEPTH / 2,
      maxZ: FINAL_CATCH_Z - PEARL_DEPTH / 2,
      top: 0,
    },
  ],
  platforms: PLATFORMS,
  breakables: BREAKABLES,
  solids: SOLIDS,
  presentation: {
    theme: 'cloudway',
    worldBounds: {
      minX: -5,
      maxX: 5,
      minY: -5,
      maxY: 5,
      minZ: -13,
      maxZ: 2,
    },
    lightBounds: {
      minX: -3,
      maxX: 3,
      minY: -1,
      maxY: 4,
      minZ: -11,
      maxZ: 1.5,
    },
    rooms: [],
    audioRegions: [
      {
        id: 'crystal-promenade-audio',
        bounds: {
          minX: -5,
          maxX: 5,
          minY: -5,
          maxY: 5,
          minZ: -13,
          maxZ: 2,
        },
        sceneId: 'garden',
      },
    ],
    visuals: [],
    assetRecipeIds: [
      CLOUDWAY_LAB_PLATFORM_RENDER_IDS.pearlRest,
      CLOUDWAY_LAB_PLATFORM_RENDER_IDS.scroll,
      CLOUDWAY_LAB_PLATFORM_RENDER_IDS.roseCrackle,
      CLOUDWAY_LAB_PLATFORM_RENDER_IDS.amethystCrackle,
      'cloudway-lab-voice',
    ],
  },
}

export const CLOUDWAY_CRYSTAL_PROMENADE_MEASUREMENTS = {
  crackle: {
    rose: { width: ROSE_WIDTH, depth: ROSE_DEPTH, height: 0.24 },
    amethyst: {
      width: AMETHYST_WIDTH,
      depth: AMETHYST_DEPTH,
      height: AMETHYST_HEIGHT,
    },
  },
  gaps: {
    arrivalApproach: ARRIVAL_APPROACH_GAP,
    scrollEntry: SCROLL_GAP,
    scrollExit: SCROLL_GAP,
    roseEntry: CRYSTAL_GAP,
    crystalDuet: CRYSTAL_GAP,
    duetExit: CRYSTAL_GAP,
  },
  platformCentres: {
    arrivalEntry: { x: ARRIVAL_X, z: ARRIVAL_ENTRY_Z },
    arrival: { x: ARRIVAL_X, z: ARRIVAL_Z },
    scrollApproachEntry: {
      x: SCROLL_APPROACH_X,
      z: SCROLL_APPROACH_ENTRY_Z,
    },
    scrollApproach: { x: SCROLL_APPROACH_X, z: SCROLL_APPROACH_Z },
    scroll: { x: SCROLL_X, z: SCROLL_Z },
    scrollCatch: { x: SCROLL_CATCH_X, z: SCROLL_CATCH_Z },
    scrollCourt: { x: SCROLL_CATCH_X, z: SCROLL_COURT_Z },
    rose: { x: ROSE_X, z: ROSE_Z },
    amethyst: { x: AMETHYST_X, z: AMETHYST_Z },
    finalCatch: { x: FINAL_CATCH_X, z: FINAL_CATCH_Z },
    finalTerrace: { x: FINAL_CATCH_X, z: FINAL_TERRACE_Z },
  },
  scroll: {
    localWidth: SCROLL_LOCAL_WIDTH,
    localDepth: SCROLL_LOCAL_DEPTH,
  },
} as const

export { CLOUDWAY_CRYSTAL_PROMENADE_FULL_STUDY } from './cloudway-laboratory-full-study'
