// Living Glass trial — one reviewed crystal platform and one singing Rosebud in a contained development route.

import type { BreakableDefinition, HoldDefinition, LevelDefinition, SolidPropDefinition, } from '../contracts'
import { LIVING_CRYSTAL_PLATFORM_ID, LIVING_CRYSTAL_STAGING_ID, livingCrystalStudy, } from './living-crystal-study'
import { RESONANCE_ROSEBUD_VARIANT_ID } from './resonance-rosebud-profile'
import { EXHIBIT_PLINTH } from './solid-props'

export const LIVING_GLASS_LEVEL_ID = 'living-glass'
export const LIVING_GLASS_LAYOUT_ID = 'living-glass-trial-v1'
export const LIVING_GLASS_CHECKPOINT_ID = 'living-glass-rosebud'
export const LIVING_GLASS_ROSEBUD_ID = 'living-glass/rosebud'

export const LIVING_GLASS_ROSEBUD_POSITION = {
  x: 0,
  y: 0,
  z: 3.75,
} as const

export const LIVING_GLASS_ROSEBUD_ANCHOR = {
  x: 0,
  y: 0,
  z: 2.8,
} as const

export const LIVING_GLASS_HOLD: HoldDefinition = {
  requiredSeconds: 2.4,
  toleranceCents: 150,
  confidenceFloor: 0.5,
  dropoutGraceSeconds: 0.15,
  decayPerSecond: 0.25,
  maximumSampleGapSeconds: 0.1,
  maximumSampleAgeMs: 150,
}

const ROSEBUD_MOUNT_ID = 'plinth:living-glass/rosebud'

const ROSEBUD: BreakableDefinition = {
  id: LIVING_GLASS_ROSEBUD_ID,
  label: 'Rosebud Resonance',
  position: LIVING_GLASS_ROSEBUD_POSITION,
  anchor: LIVING_GLASS_ROSEBUD_ANCHOR,
  mount: {
    kind: 'plinth',
    solidId: ROSEBUD_MOUNT_ID,
    height: EXHIBIT_PLINTH.height,
    radiusTop: EXHIBIT_PLINTH.radiusTop,
    radiusBottom: EXHIBIT_PLINTH.radiusBottom,
    facingYaw: Math.PI,
    presentation: { role: 'plinth', material: 'stone' },
  },
  variant: RESONANCE_ROSEBUD_VARIANT_ID,
  optional: false,
  requiresCompleted: [],
  challenge: {
    kind: 'hold',
    step: { target: 'comfortable', hold: LIVING_GLASS_HOLD },
  },
}

const ROSEBUD_PLINTH: SolidPropDefinition = {
  id: ROSEBUD_MOUNT_ID,
  kind: 'prop',
  shape: 'cylinder',
  platformId: LIVING_CRYSTAL_STAGING_ID,
  x: LIVING_GLASS_ROSEBUD_POSITION.x,
  z: LIVING_GLASS_ROSEBUD_POSITION.z,
  top: EXHIBIT_PLINTH.height,
  thickness: EXHIBIT_PLINTH.height,
  radiusTop: EXHIBIT_PLINTH.radiusTop,
  radiusBottom: EXHIBIT_PLINTH.radiusBottom,
  presentation: { role: 'plinth', material: 'stone' },
}

const BASE = livingCrystalStudy()

export const LIVING_GLASS_TRIAL = {
  ...BASE,
  id: LIVING_GLASS_LEVEL_ID,
  title: 'Living Glass',
  authored: {
    levelId: LIVING_GLASS_LEVEL_ID,
    layoutId: LIVING_GLASS_LAYOUT_ID,
    contentRevision: 1,
  },
  guidance: {
    subtitle: 'A pearl current and a singing Rosebud',
    openingNotice: 'Cross the crystal, then sing beside the Rosebud.',
    encounterSuccessNotices: [
      {
        encounterId: LIVING_GLASS_ROSEBUD_ID,
        notice: 'The Rosebud released its note.',
      },
    ],
    completionTitle: 'The current answered.',
    completionNext: 'This contained trial is complete.',
  },
  presentation: {
    ...BASE.presentation!,
    livingCrystalInteriors: [
      {
        platformId: LIVING_CRYSTAL_PLATFORM_ID,
        variant: 'pearl-roots',
        effect: 'pearl-current',
        responseExhibitId: LIVING_GLASS_ROSEBUD_ID,
        seed: 20_260_929,
        quality: 'balanced',
        fullness: 0.9824,
        intensity: 1,
        speed: 0.65,
      },
    ],
  },
  solids: [ROSEBUD_PLINTH],
  checkpoints: [
    ...BASE.checkpoints,
    {
      id: LIVING_GLASS_CHECKPOINT_ID,
      position: LIVING_GLASS_ROSEBUD_ANCHOR,
      radius: 0.5,
      facingYaw: Math.PI,
    },
  ],
  breakables: [ROSEBUD],
  exit: {
    ...BASE.exit,
    requiresCompleted: [LIVING_GLASS_ROSEBUD_ID],
  },
} as const satisfies LevelDefinition
