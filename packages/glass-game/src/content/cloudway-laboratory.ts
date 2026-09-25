// Crystal Promenade first slice — a bounded developer route proves the accepted scroll while crackle art remains explicit fallback.

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
const PLATFORM_GAP = 0.25

// Four unscaled pearl donors make the start court. Their 0.72 m rows touch
// exactly, and the last row touches the scroll approach at z = -8.5.
const ARRIVAL_ROW_Z = [-11.02, -10.3, -9.58, -8.86] as const
const ARRIVAL_Z = ARRIVAL_ROW_Z[1]
const SCROLL_APPROACH_Z = -8.14
// The scroll seams touch the pearl rests so the controller can walk onto the
// dynamic support. Only the dynamic retraction and crackle jumps make gaps.
const SCROLL_Z = SCROLL_APPROACH_Z + PEARL_DEPTH / 2 + SCROLL_LOCAL_WIDTH / 2
const SCROLL_CATCH_Z = SCROLL_Z + SCROLL_LOCAL_WIDTH / 2 + PEARL_DEPTH / 2
const ROSE_Z = SCROLL_CATCH_Z + PEARL_DEPTH / 2 + ROSE_DEPTH / 2 + PLATFORM_GAP
const AMETHYST_Z = ROSE_Z + ROSE_DEPTH / 2 + PLATFORM_GAP + AMETHYST_DEPTH / 2
const FINAL_CATCH_Z =
  AMETHYST_Z + AMETHYST_DEPTH / 2 + PEARL_DEPTH / 2 + PLATFORM_GAP
// Keep the gate's original approach/crossing window attached to the final rest.
const EXIT_MIN_Z = FINAL_CATCH_Z - 0.137494056
const EXIT_MAX_Z = FINAL_CATCH_Z + 0.362505944

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
    0,
    ARRIVAL_ROW_Z[0],
    PEARL_WIDTH,
    PEARL_DEPTH,
    0,
    0.34,
    { renderId: CLOUDWAY_LAB_PLATFORM_RENDER_IDS.pearlRest },
  ),
  deck('arrival', 0, ARRIVAL_ROW_Z[1], PEARL_WIDTH, PEARL_DEPTH, 0, 0.34, {
    renderId: CLOUDWAY_LAB_PLATFORM_RENDER_IDS.pearlRest,
  }),
  deck(
    'arrival-court',
    0,
    ARRIVAL_ROW_Z[2],
    PEARL_WIDTH,
    PEARL_DEPTH,
    0,
    0.34,
    { renderId: CLOUDWAY_LAB_PLATFORM_RENDER_IDS.pearlRest },
  ),
  deck(
    'arrival-threshold',
    0,
    ARRIVAL_ROW_Z[3],
    PEARL_WIDTH,
    PEARL_DEPTH,
    0,
    0.34,
    { renderId: CLOUDWAY_LAB_PLATFORM_RENDER_IDS.pearlRest },
  ),
  deck(
    'scroll-approach',
    0,
    SCROLL_APPROACH_Z,
    PEARL_WIDTH,
    PEARL_DEPTH,
    0,
    0.34,
    { renderId: CLOUDWAY_LAB_PLATFORM_RENDER_IDS.pearlRest },
  ),
  deck(
    'scroll-deck',
    0,
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
  deck('scroll-catch', 0, SCROLL_CATCH_Z, PEARL_WIDTH, PEARL_DEPTH, 0, 0.34, {
    renderId: CLOUDWAY_LAB_PLATFORM_RENDER_IDS.pearlRest,
  }),
  deck('rose-step', 0, ROSE_Z, ROSE_WIDTH, ROSE_DEPTH, 0, 0.24, {
    renderId: CLOUDWAY_LAB_PLATFORM_RENDER_IDS.rosePending,
    behavior: {
      kind: 'crackle',
      warningSeconds: 2,
      releaseSeconds: 1.15,
      resetSeconds: 2,
    },
  }),
  deck(
    'amethyst-step',
    0,
    AMETHYST_Z,
    AMETHYST_WIDTH,
    AMETHYST_DEPTH,
    0,
    AMETHYST_HEIGHT,
    {
      renderId: CLOUDWAY_LAB_PLATFORM_RENDER_IDS.amethystPending,
      behavior: {
        kind: 'crackle',
        warningSeconds: 4,
        releaseSeconds: 1.15,
        resetSeconds: 2,
      },
    },
  ),
  deck('final-catch', 0, FINAL_CATCH_Z, PEARL_WIDTH, PEARL_DEPTH, 0, 0.34, {
    renderId: CLOUDWAY_LAB_PLATFORM_RENDER_IDS.pearlRest,
  }),
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
  holdTarget('voice-home', 'The arrival camellia', -1.1, ARRIVAL_Z, -0.45, []),
  holdTarget(
    'voice-third',
    'The scroll-court urn',
    -1.15,
    SCROLL_CATCH_Z,
    -0.45,
    ['voice-home'],
  ),
  holdTarget('voice-fifth', 'The promenade bell', -1.15, FINAL_CATCH_Z, -0.45, [
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
    contentRevision: 1,
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
    position: { x: 0, y: 0, z: -10.9 },
    facingYaw: Math.PI,
    checkpointId: 'arrival-save',
  },
  checkpoints: [
    {
      id: 'arrival-save',
      position: { x: 0, y: 0, z: -10.9 },
      radius: 0.65,
      facingYaw: Math.PI,
    },
    {
      id: 'scroll-save',
      position: { x: 0, y: 0, z: SCROLL_APPROACH_Z },
      radius: 0.42,
      facingYaw: Math.PI,
      requiresCompleted: ['voice-home'],
    },
    {
      id: 'final-save',
      position: { x: 0, y: 0, z: FINAL_CATCH_Z },
      radius: 0.36,
      facingYaw: Math.PI,
      requiresCompleted: ['voice-third'],
    },
  ],
  exit: {
    minX: 0.45,
    maxX: 1.35,
    minZ: EXIT_MIN_Z,
    maxZ: EXIT_MAX_Z,
    top: 0,
    requiresCompleted: ['voice-home', 'voice-third', 'voice-fifth'],
  },
  fallBelow: -3.5,
  intentionalGaps: [
    {
      id: 'rose-entry',
      minX: -ROSE_WIDTH / 2,
      maxX: ROSE_WIDTH / 2,
      minZ: SCROLL_CATCH_Z + PEARL_DEPTH / 2,
      maxZ: ROSE_Z - ROSE_DEPTH / 2,
      top: 0,
    },
    {
      id: 'crystal-duet',
      minX: -Math.min(ROSE_WIDTH, AMETHYST_WIDTH) / 2,
      maxX: Math.min(ROSE_WIDTH, AMETHYST_WIDTH) / 2,
      minZ: ROSE_Z + ROSE_DEPTH / 2,
      maxZ: AMETHYST_Z - AMETHYST_DEPTH / 2,
      top: 0,
    },
    {
      id: 'duet-exit',
      minX: -AMETHYST_WIDTH / 2,
      maxX: AMETHYST_WIDTH / 2,
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
      maxZ: 1,
    },
    lightBounds: {
      minX: -3,
      maxX: 3,
      minY: -1,
      maxY: 4,
      minZ: -11,
      maxZ: -1,
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
          maxZ: 1,
        },
        sceneId: 'garden',
      },
    ],
    visuals: [],
    assetRecipeIds: [
      CLOUDWAY_LAB_PLATFORM_RENDER_IDS.pearlRest,
      CLOUDWAY_LAB_PLATFORM_RENDER_IDS.scroll,
      CLOUDWAY_LAB_PLATFORM_RENDER_IDS.rosePending,
      CLOUDWAY_LAB_PLATFORM_RENDER_IDS.amethystPending,
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
  gap: PLATFORM_GAP,
  platformCentres: {
    arrival: ARRIVAL_Z,
    arrivalRows: ARRIVAL_ROW_Z,
    scrollApproach: SCROLL_APPROACH_Z,
    scroll: SCROLL_Z,
    scrollCatch: SCROLL_CATCH_Z,
    rose: ROSE_Z,
    amethyst: AMETHYST_Z,
    finalCatch: FINAL_CATCH_Z,
  },
  scroll: {
    localWidth: SCROLL_LOCAL_WIDTH,
    localDepth: SCROLL_LOCAL_DEPTH,
  },
} as const

export { CLOUDWAY_CRYSTAL_PROMENADE_FULL_STUDY } from './cloudway-laboratory-full-study'
