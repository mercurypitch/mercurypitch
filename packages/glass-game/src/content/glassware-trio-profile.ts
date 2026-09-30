// Glassware trio profiles — stable Meshy exhibit identities and independently authored fracture contracts.

export const GLASSWARE_TRIO_SOURCE_HEIGHT = 0.45

export const GLASSWARE_TRIO_PROFILES = {
  'g01-sunlit-diadem': {
    code: 'G01',
    bundle: 'g01-sunlit-diadem',
    intactNode: 'Glassware_G01_Intact',
    fragmentsNode: 'Glassware_G01_Fractured',
    shardPrefix: 'Glassware_G01_Shard_',
    shardCount: 33,
    displayHeight: 0.84,
    materials: {
      glass: 'Glassware_G01_Glass',
      gold: 'Glassware_G01_Gold',
      interior: 'Glassware_G01_Interior',
    },
  },
  'g14-tidal-wave-carafe': {
    code: 'G14',
    bundle: 'g14-tidal-wave-carafe',
    intactNode: 'Glassware_G14_Intact',
    fragmentsNode: 'Glassware_G14_Fractured',
    shardPrefix: 'Glassware_G14_Shard_',
    shardCount: 21,
    displayHeight: 0.8,
    materials: {
      glass: 'Glassware_G14_Glass',
      gold: 'Glassware_G14_Gold',
      interior: 'Glassware_G14_Interior',
    },
  },
  'g22-aurora-lotus-bowl': {
    code: 'G22',
    bundle: 'g22-aurora-lotus-bowl',
    intactNode: 'Glassware_G22_Intact',
    fragmentsNode: 'Glassware_G22_Fractured',
    shardPrefix: 'Glassware_G22_Shard_',
    shardCount: 20,
    displayHeight: 0.48,
    materials: {
      glass: 'Glassware_G22_Glass',
      gold: 'Glassware_G22_Gold',
      interior: 'Glassware_G22_Interior',
    },
  },
} as const

export type GlasswareTrioVariant = keyof typeof GLASSWARE_TRIO_PROFILES
