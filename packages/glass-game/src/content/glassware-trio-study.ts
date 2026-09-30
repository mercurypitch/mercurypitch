// Glassware trio study — three separately judged exhibits on a shared, collision-backed viewing terrace.

import type { BreakableDefinition, LevelDefinition, SolidPropDefinition, } from '../contracts'
import { LIVING_CRYSTAL_STAGING_ID, livingCrystalStudy, } from './living-crystal-study'
import { LIVING_GLASS_HOLD } from './living-glass-trial'

export const GLASSWARE_TRIO_LEVEL_ID = 'glassware-trio-study-v1'

export const GLASSWARE_TRIO_EXHIBITS = [
  {
    id: 'sunlit-diadem',
    label: 'Sunlit Diadem',
    variant: 'g01-sunlit-diadem',
    x: -6.5,
  },
  {
    id: 'tidal-wave',
    label: 'Tidal Wave Carafe',
    variant: 'g14-tidal-wave-carafe',
    x: 0,
  },
  {
    id: 'aurora-lotus',
    label: 'Aurora Lotus Bowl',
    variant: 'g22-aurora-lotus-bowl',
    x: 6.5,
  },
] as const

const PLINTH = { height: 0.3, radiusTop: 0.38, radiusBottom: 0.42 } as const

const breakables: readonly BreakableDefinition[] = GLASSWARE_TRIO_EXHIBITS.map(
  (exhibit) => ({
    id: `glassware-trio/${exhibit.id}`,
    label: exhibit.label,
    variant: exhibit.variant,
    position: { x: exhibit.x, y: 0, z: 3.9 },
    anchor: { x: exhibit.x, y: 0, z: 2.7 },
    mount: {
      kind: 'plinth',
      solidId: `plinth:glassware-trio/${exhibit.id}`,
      ...PLINTH,
      facingYaw: Math.PI,
      presentation: { role: 'plinth', material: 'stone' },
    },
    optional: false,
    requiresCompleted: [],
    challenge: {
      kind: 'hold',
      step: { target: 'comfortable', hold: LIVING_GLASS_HOLD },
    },
  }),
)

const solids: readonly SolidPropDefinition[] = breakables.map((exhibit) => ({
  id: exhibit.mount!.solidId,
  kind: 'prop',
  shape: 'cylinder',
  platformId: LIVING_CRYSTAL_STAGING_ID,
  x: exhibit.position.x,
  z: exhibit.position.z,
  top: PLINTH.height,
  thickness: PLINTH.height,
  radiusTop: PLINTH.radiusTop,
  radiusBottom: PLINTH.radiusBottom,
  presentation: { role: 'plinth', material: 'stone' },
}))

const base = livingCrystalStudy()

export const GLASSWARE_TRIO_STUDY: LevelDefinition = {
  ...base,
  id: GLASSWARE_TRIO_LEVEL_ID,
  title: 'Three notes in glass',
  authored: {
    levelId: GLASSWARE_TRIO_LEVEL_ID,
    layoutId: 'glassware-trio-terrace-v1',
    contentRevision: 1,
  },
  guidance: {
    subtitle: 'Diadem, tide and lotus',
    openingNotice: 'Cross the crystal. Choose a glass and give it your note.',
    completionTitle: 'Three beautiful little messes.',
    completionNext: 'Each shape has a different way to let go.',
  },
  // Leave room for the side-on challenge camera without another glass in its lens.
  platforms: base.platforms.map((platform) =>
    platform.id === LIVING_CRYSTAL_STAGING_ID
      ? { ...platform, minX: -9, maxX: 9 }
      : platform,
  ),
  presentation: {
    ...base.presentation!,
    worldBounds: { ...base.presentation!.worldBounds, minX: -12, maxX: 12 },
    lightBounds: { ...base.presentation!.lightBounds, minX: -10, maxX: 10 },
  },
  solids,
  breakables,
  checkpoints: [
    ...base.checkpoints,
    ...breakables.map((exhibit) => ({
      id: `${exhibit.id}-view`,
      position: exhibit.anchor,
      radius: 0.5,
      facingYaw: Math.PI,
    })),
  ],
  exit: {
    ...base.exit,
    requiresCompleted: breakables.map((exhibit) => exhibit.id),
  },
}
