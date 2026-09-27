// Pearl quarter-turn profile — stable IDs and measured contact data shared by authored levels and presentation.

export const PEARL_QUARTER_TURN_RENDER_ID = 'cloudway-pearl-teal-quarter-turn-a'
export const PEARL_QUARTER_TURN_DOCK_RENDER_ID =
  'cloudway-quarter-turn-art-study-dock'

export const PEARL_QUARTER_TURN_BUNDLE_IDS = {
  logical: 'cloudway-lab-pearl-quarter-turn-a-v1',
  desktop: 'cloudway-lab-pearl-quarter-turn-a-desktop-v1',
  mobile: 'cloudway-lab-pearl-quarter-turn-a-mobile-v1',
} as const

export const PEARL_QUARTER_TURN_NODES = {
  root: 'Cloudway_PearlTealQuarterTurnA_V1',
  visual: 'Cloudway_PearlTealQuarterTurnA_Visual',
  supportAnchor: 'QuarterTurnA_SupportAnchor',
  xArm: 'QuarterTurnA_Collider_XArm',
  zArm: 'QuarterTurnA_Collider_YArm',
  xPositiveDock: 'QuarterTurnA_Dock_XPositive',
  zNegativeDock: 'QuarterTurnA_Dock_YPositive',
} as const

export const PEARL_QUARTER_TURN_SUPPORT = {
  topY: 0.085,
  thickness: 0.18,
  sourceArmWidth: 0.52,
  playableArmWidth: 0.832,
  horizontalScale: 1.6,
  anchor: [0, -0.11060000211000443, 0] as const,
  boxes: [
    {
      node: PEARL_QUARTER_TURN_NODES.xArm,
      centre: [-0.0029232, -0.005, 1.0738816] as const,
      size: [2.9481544, 0.18, 0.832] as const,
    },
    {
      node: PEARL_QUARTER_TURN_NODES.zArm,
      centre: [-1.0610004, -0.005, -0.00010615] as const,
      size: [0.832, 0.18, 2.9799755] as const,
    },
  ],
  docks: [
    {
      node: PEARL_QUARTER_TURN_NODES.xPositiveDock,
      position: [1.471154, 0.085, 1.0738816] as const,
      outwardAxis: '+X' as const,
    },
    {
      node: PEARL_QUARTER_TURN_NODES.zNegativeDock,
      position: [-1.0610004, 0.085, -1.4900939] as const,
      outwardAxis: '-Z' as const,
    },
  ],
} as const

export const PEARL_QUARTER_TURN_TIER_TRIANGLES = {
  desktop: 68_000,
  mobile: 31_996,
} as const
