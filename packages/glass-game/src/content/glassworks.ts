// Glassworks — the floating museum's first course, authored entirely as data.

import type { BreakableDefinition, CheckpointDefinition, HoldDefinition, LevelDefinition, PlatformDefinition, } from '../contracts'
import { glassworksSolidProps } from './solid-props'

const HOLD: HoldDefinition = {
  requiredSeconds: 1.2,
  toleranceCents: 150,
  confidenceFloor: 0.5,
  dropoutGraceSeconds: 0.15,
  decayPerSecond: 0.25,
  maximumSampleGapSeconds: 0.1,
  maximumSampleAgeMs: 150,
}

const GOBLET = 'glassworks.first-goblet'
const VASE = 'glassworks.rounded-vase'
const HERO = 'glassworks.hero-display'

function platform(
  id: string,
  bounds: [number, number, number, number],
  top = 0.15,
  extra: Partial<PlatformDefinition> = {},
): PlatformDefinition {
  return {
    id,
    minX: bounds[0],
    maxX: bounds[1],
    minZ: bounds[2],
    maxZ: bounds[3],
    top,
    thickness: 0.2,
    kind: 'deck',
    material: 'stone',
    ...extra,
  }
}

function checkpoint(
  id: string,
  x: number,
  y: number,
  z: number,
  facingYaw: number,
  requiresCompleted: string[] = [],
): CheckpointDefinition {
  return {
    id,
    position: { x, y, z },
    facingYaw,
    radius: 0.43,
    requiresCompleted,
  }
}

function ornament(
  id: string,
  label: string,
  variant: string,
  x: number,
): BreakableDefinition {
  return {
    id,
    label,
    variant,
    optional: true,
    position: { x, y: 0.15, z: 5.15 },
    anchor: { x, y: 0.15, z: 4.4 },
    requiresCompleted: [VASE],
    hold: { ...HOLD },
  }
}

const COURSE: LevelDefinition = {
  id: 'glassworks',
  title: 'Glassworks',
  spawn: { position: { x: 1.2, y: 0, z: 1.2 }, facingYaw: Math.PI },
  fallBelow: -1.4,
  platforms: [
    platform('arrival', [0, 2.4, 0, 2.7], 0),
    platform('goblet-deck', [0, 2.4, 2.7, 5.1], 0),
    platform('arch-bridge', [0.6, 1.8, 5.1, 7], 0, {
      kind: 'bridge',
      material: 'brass',
      unlockAfter: GOBLET,
    }),
    platform('overlook', [0.6, 11, 7, 8.2], 0),
    platform('terrace-one', [8.6, 11, 5.55, 6.75]),
    platform('terrace-two', [8.6, 11, 4, 5.55]),
    platform('vase-deck', [8.6, 11, 1.4, 4]),
    platform('hero-bridge', [7, 8.6, 1.8, 3], 0.15, {
      kind: 'bridge',
      material: 'brass',
      unlockAfter: VASE,
    }),
    platform('hero-deck', [4, 7, 0, 3]),
    platform('loop-west', [4, 5.2, 3, 4.2]),
    platform('loop-east', [5.8, 7, 3, 4.2]),
    platform('panorama', [4, 7, 4.2, 5.4]),
    platform('catch-arrival', [0, 2.4, 2, 3.1], -0.75, {
      kind: 'catch',
      catchCheckpointId: 'jump-arrival',
    }),
    platform('catch-first-terrace', [8.6, 11, 6.3, 7.2], -0.75, {
      kind: 'catch',
      catchCheckpointId: 'jump-overlook',
    }),
    platform('catch-second-terrace', [8.6, 11, 4.8, 5.75], -0.75, {
      kind: 'catch',
      catchCheckpointId: 'jump-terrace',
    }),
  ],
  checkpoints: [
    checkpoint('arrival', 1.2, 0, 1.2, Math.PI),
    checkpoint('jump-arrival', 1.2, 0, 1.8, Math.PI),
    checkpoint('goblet', 1.2, 0, 3.15, Math.PI),
    checkpoint('jump-overlook', 9.8, 0, 7.6, 0, [GOBLET]),
    checkpoint('jump-terrace', 9.8, 0.15, 6.15, 0, [GOBLET]),
    checkpoint('vase', 9.8, 0.15, 3.65, 0, [GOBLET]),
    checkpoint('hero', 6.35, 0.15, 2.4, Math.PI / 2, [VASE]),
  ],
  breakables: [
    {
      id: GOBLET,
      label: 'The first goblet',
      position: { x: 1.2, y: 0, z: 4.55 },
      anchor: { x: 1.2, y: 0, z: 3.65 },
      variant: 'goblet',
      optional: false,
      hold: { ...HOLD },
    },
    {
      id: VASE,
      label: 'Cut-crystal decanter',
      position: { x: 10.35, y: 0.15, z: 2.7 },
      anchor: { x: 9.45, y: 0.15, z: 2.7 },
      variant: 'decanter',
      optional: false,
      requiresCompleted: [GOBLET],
      hold: { ...HOLD },
    },
    {
      id: HERO,
      label: 'The glass portrait',
      position: { x: 5.5, y: 0.15, z: 0.9 },
      anchor: { x: 5.5, y: 0.15, z: 1.8 },
      variant: 'portrait',
      optional: false,
      requiresCompleted: [VASE],
      hold: { ...HOLD },
    },
    ornament('glassworks.panorama-goblet', 'Aurora coupe', 'coupe', 4.5),
    ornament('glassworks.panorama-vase', 'The moon amphora', 'amphora', 5.5),
    ornament(
      'glassworks.panorama-fluted',
      'The fluted treasure',
      'fluted',
      6.5,
    ),
  ],
  exit: {
    minX: 4.9,
    maxX: 6.1,
    minZ: 0.2,
    maxZ: 0.5,
    top: 0.15,
    requiresCompleted: [GOBLET, VASE, HERO],
  },
}

export const GLASSWORKS: LevelDefinition = {
  ...COURSE,
  solids: glassworksSolidProps(COURSE),
}
