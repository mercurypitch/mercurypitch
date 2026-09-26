// Crystal Promenade full simulation study — preserve the 27-piece mechanical design while the first playable integrates separately.
// The visual catalogue is not bound. This unregistered development level keeps
// the complete traversal study reviewable while accepted Blender assets arrive.
// Relative melody notes remain in the design spec until range-aware exemplars are approved.

import type { BreakableDefinition, LevelDefinition, PlatformDefinition, SolidPropDefinition, } from '../contracts'
import { DEFAULT_EXHIBIT_MOUNT_HEIGHT, EXHIBIT_PLINTH, PORTRAIT_EXHIBIT_ENVELOPE, } from './solid-props'

function deck(
  id: string,
  x: number,
  z: number,
  width: number,
  depth: number,
  top: number,
  extra: Partial<Pick<PlatformDefinition, 'behavior' | 'surface'>> = {},
): PlatformDefinition {
  return {
    id,
    minX: x - width / 2,
    maxX: x + width / 2,
    minZ: z - depth / 2,
    maxZ: z + depth / 2,
    top,
    thickness: 0.28,
    kind: 'deck',
    material: 'stone',
    ...extra,
  }
}

const PLATFORMS: readonly PlatformDefinition[] = [
  deck('arrival', -4, -20, 4, 4, 0),
  deck('frost-bend', -5, -16.8, 2.4, 1.9, 0, {
    surface: {
      kind: 'frost',
      controlMultiplier: 0.62,
      brakingMultiplier: 0.38,
      maximumSpeed: 2.45,
    },
  }),
  deck('emerald-turn', -6, -13.9, 3, 3, 0),
  deck('opal-passage', -6, -10.6, 1.8, 2.2, 0),
  deck('scroll-approach', -5, -7.4, 4, 3.4, 0),
  deck('scroll-deck', -0.8, -7.4, 3, 1.8, 0, {
    behavior: {
      kind: 'scroll',
      axis: 'x',
      minLengthRatio: 0.25,
      extendedSeconds: 4,
      retractedSeconds: 3,
      transitionSeconds: 1.5,
      initialState: 'extended',
    },
  }),
  deck('scroll-catch', 3.4, -7.4, 4, 3.4, 0),
  deck('rose-step', 4.1, -4.2, 2.4, 1.9, 0, {
    behavior: {
      kind: 'crackle',
      warningSeconds: 2,
      releaseSeconds: 1.15,
      resetSeconds: 2,
    },
  }),
  deck('amethyst-step', 4.7, -1.8, 2.4, 1.9, 0, {
    behavior: {
      kind: 'crackle',
      warningSeconds: 4,
      releaseSeconds: 1.15,
      resetSeconds: 2,
    },
  }),
  deck('garden-centre', 4, 1.6, 2.4, 4.4, 0),
  deck('garden-west', 2.2, 1.6, 1.2, 2.4, 0),
  deck('garden-east', 5.8, 1.6, 1.2, 2.4, 0),
  deck('aurora-raft', 4, 5.8, 2.6, 2.4, 0, {
    behavior: {
      kind: 'glide',
      translation: { x: 0, y: 0, z: 1.8 },
      travelSeconds: 4,
      dwellSeconds: 1.5,
    },
  }),
  deck('terrace-dock', 4, 11, 4, 3, 0),
  deck('stair-one', 3, 13.5, 3, 1.8, 0.16),
  deck('stair-two', 2.5, 15.3, 3, 1.8, 0.32),
  deck('stair-three', 2, 17.1, 3, 1.8, 0.48),
  deck('final-salon', 1, 20.2, 4, 4.4, 0.48),
]

const BREAKABLES = [
  {
    id: 'voice-home',
    label: 'The arrival camellia',
    variant: 'goblet',
    optional: false,
    position: {
      x: -4.8,
      y: 0,
      z: -18.7,
    },
    anchor: {
      x: -4.8,
      y: 0,
      z: -19.6,
    },
    requiresCompleted: [],
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
  },
  {
    id: 'voice-third',
    label: 'The garden urn',
    variant: 'vase',
    optional: false,
    position: {
      x: 4,
      y: 0,
      z: 1.3,
    },
    anchor: {
      x: 4,
      y: 0,
      z: 0.4,
    },
    requiresCompleted: ['voice-home'],
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
  },
  {
    id: 'voice-fifth',
    label: 'The promenade portrait',
    variant: 'portrait',
    optional: false,
    position: {
      x: 0.3,
      y: 0.48,
      z: 21.2,
    },
    anchor: {
      x: 0.3,
      y: 0.48,
      z: 20.3,
    },
    requiresCompleted: ['voice-third'],
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
  },
] as const satisfies readonly BreakableDefinition[]

const SOLIDS: SolidPropDefinition[] = BREAKABLES.flatMap((target) => {
  const plinth: SolidPropDefinition = {
    id: `plinth:${target.id}`,
    kind: 'prop',
    shape: 'cylinder',
    x: target.position.x,
    z: target.position.z,
    top: target.position.y + EXHIBIT_PLINTH.height,
    thickness: EXHIBIT_PLINTH.height,
    radiusTop: EXHIBIT_PLINTH.radiusTop,
    radiusBottom: EXHIBIT_PLINTH.radiusBottom,
  }
  if (target.variant !== 'portrait') return [plinth]
  return [
    plinth,
    {
      id: `intact:${target.id}`,
      kind: 'prop',
      shape: 'box',
      minX: target.position.x - PORTRAIT_EXHIBIT_ENVELOPE.width / 2,
      maxX: target.position.x + PORTRAIT_EXHIBIT_ENVELOPE.width / 2,
      minZ: target.position.z - PORTRAIT_EXHIBIT_ENVELOPE.depth / 2,
      maxZ: target.position.z + PORTRAIT_EXHIBIT_ENVELOPE.depth / 2,
      top:
        target.position.y +
        DEFAULT_EXHIBIT_MOUNT_HEIGHT +
        PORTRAIT_EXHIBIT_ENVELOPE.height,
      thickness: PORTRAIT_EXHIBIT_ENVELOPE.height,
      activation: { noneCompleted: [target.id] },
    },
  ]
})

export const CLOUDWAY_CRYSTAL_PROMENADE_FULL_STUDY: LevelDefinition = {
  id: 'cloudway-crystal-promenade-full-study',
  title: 'The Crystal Promenade',
  authored: {
    levelId: 'cloudway-crystal-promenade-full-study',
    layoutId: 'crystal-promenade-full-study',
    contentRevision: 1,
  },
  movement: {
    walkSpeed: 1.55,
    runSpeed: 2.6,
    runDelaySeconds: 0.6,
    runRampSeconds: 0.8,
  },
  guidance: {
    subtitle: 'A crystal crossing study',
    openingNotice: 'Sing on the safe marble landing.',
    completionTitle: 'The promenade shines.',
    completionNext: 'Return to the museum.',
  },
  spawn: {
    position: {
      x: -4,
      y: 0,
      z: -21,
    },
    facingYaw: 3.141592653589793,
    checkpointId: 'arrival-save',
  },
  checkpoints: [
    {
      id: 'arrival-save',
      position: {
        x: -4,
        y: 0,
        z: -21,
      },
      radius: 0.72,
      facingYaw: 3.141592653589793,
    },
    {
      id: 'scroll-save',
      position: {
        x: -5,
        y: 0,
        z: -7.7,
      },
      radius: 0.72,
      facingYaw: 3.141592653589793,
    },
    {
      id: 'garden-save',
      position: {
        x: 4,
        y: 0,
        z: 2.6,
      },
      radius: 0.72,
      facingYaw: 3.141592653589793,
    },
    {
      id: 'final-save',
      position: {
        x: 1,
        y: 0.48,
        z: 19,
      },
      radius: 0.72,
      facingYaw: 3.141592653589793,
    },
  ],
  exit: {
    minX: 0.5,
    maxX: 1.5,
    minZ: 21.3,
    maxZ: 21.5,
    top: 0.48,
    requiresCompleted: ['voice-home', 'voice-third', 'voice-fifth'],
  },
  fallBelow: -3.5,
  intentionalGaps: [
    {
      id: 'frost-entry',
      minX: -6.2,
      maxX: -3.8,
      minZ: -18,
      maxZ: -17.75,
      top: 0,
    },
    {
      id: 'frost-exit',
      minX: -6.2,
      maxX: -4.5,
      minZ: -15.85,
      maxZ: -15.4,
      top: 0,
    },
    {
      id: 'opal-entry',
      minX: -6.9,
      maxX: -5.1,
      minZ: -12.4,
      maxZ: -11.7,
      top: 0,
    },
    { id: 'opal-exit', minX: -6.9, maxX: -5.1, minZ: -9.5, maxZ: -9.1, top: 0 },
    {
      id: 'scroll-entry',
      minX: -3,
      maxX: -2.3,
      minZ: -8.3,
      maxZ: -6.5,
      top: 0,
    },
    { id: 'scroll-exit', minX: 0.7, maxX: 1.4, minZ: -8.3, maxZ: -6.5, top: 0 },
    { id: 'rose-entry', minX: 2.9, maxX: 5.3, minZ: -5.7, maxZ: -5.15, top: 0 },
    {
      id: 'crystal-duet',
      minX: 3.5,
      maxX: 5.3,
      minZ: -3.25,
      maxZ: -2.75,
      top: 0,
    },
    {
      id: 'garden-entry',
      minX: 3.5,
      maxX: 5.2,
      minZ: -0.85,
      maxZ: -0.6,
      top: 0,
    },
    { id: 'raft-entry', minX: 2.8, maxX: 5.2, minZ: 3.8, maxZ: 4.6, top: 0 },
    { id: 'raft-exit', minX: 2.7, maxX: 5.3, minZ: 8.8, maxZ: 9.5, top: 0 },
  ],
  platforms: PLATFORMS,
  breakables: BREAKABLES,
  solids: SOLIDS,
}
