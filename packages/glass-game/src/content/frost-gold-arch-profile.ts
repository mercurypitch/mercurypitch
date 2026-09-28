// Frost Gold Arch contact — measured pane bands and grounded posts preserve the curved opening without a false box.

import type { CloudwayBarrierBoxProfile, CloudwayBarrierProfile, } from '../authoring/cloudway-course-profiles.ts'

export const FROST_GOLD_ARCH_BUNDLE_IDS = {
  logical: 'cloudway-lab-frost-gold-arch-v1',
  desktop: 'cloudway-lab-frost-gold-arch-desktop-v1',
  mobile: 'cloudway-lab-frost-gold-arch-mobile-v1',
} as const

export const FROST_GOLD_ARCH_NODES = {
  root: 'Cloudway_FrostGoldArchBreakwallA_V1',
  intact: 'frost_arch_intact',
  shardPrefix: 'frost_arch_shard_',
  frame: 'frost_arch_frame',
} as const

export const FROST_GOLD_ARCH_PANE = {
  width: 2.1285,
  shoulderHeight: 1.7096342782974243,
  archRise: 0.99,
  height: 2.6996342782974243,
  depth: 0.07,
} as const

export const FROST_GOLD_ARCH_FRAME = {
  depth: 0.7205088034272193,
  posts: [
    {
      id: 'left-post',
      centerX: -1.3173790016174316,
      width: 0.5056449098587037,
    },
    {
      id: 'right-post',
      centerX: 1.316765908241272,
      width: 0.5056449098587037,
    },
  ],
} as const

const CROWN_RIGHT_EDGE = [
  { x: 1.06425, y: 1.709634 },
  { x: 1.059125, y: 1.806671 },
  { x: 1.043801, y: 1.902774 },
  { x: 1.018424, y: 1.997016 },
  { x: 0.983239, y: 2.088491 },
  { x: 0.938585, y: 2.176317 },
  { x: 0.884892, y: 2.259649 },
  { x: 0.822676, y: 2.337684 },
  { x: 0.752538, y: 2.40967 },
  { x: 0.675153, y: 2.474915 },
  { x: 0.591266, y: 2.532789 },
  { x: 0.501684, y: 2.582736 },
  { x: 0.407271, y: 2.624275 },
  { x: 0.308935, y: 2.657005 },
  { x: 0.207625, y: 2.680612 },
  { x: 0.104315, y: 2.694867 },
  { x: 0, y: 2.699634 },
] as const

const gateFallback = {
  replacedByBundle: FROST_GOLD_ARCH_BUNDLE_IDS.logical,
  replacedByNode: FROST_GOLD_ARCH_NODES.intact,
} as const

const lowerPane: CloudwayBarrierBoxProfile = {
  id: 'pane-lower',
  bottomCenter: { x: 0, y: 0, z: 0 },
  width: FROST_GOLD_ARCH_PANE.width,
  height: FROST_GOLD_ARCH_PANE.shoulderHeight,
  depth: FROST_GOLD_ARCH_PANE.depth,
  presentation: { role: 'gate', material: 'glass' },
  fallback: gateFallback,
}

const crownBands: readonly CloudwayBarrierBoxProfile[] = CROWN_RIGHT_EDGE.slice(
  0,
  -2,
).map((bottom, index) => {
  const top = CROWN_RIGHT_EDGE[index + 1]!
  return {
    id: `pane-crown-${String(index + 1).padStart(2, '0')}`,
    bottomCenter: { x: 0, y: bottom.y, z: 0 },
    // The narrower upper edge keeps every band inside the measured arch.
    width: top.x * 2,
    height: top.y - bottom.y,
    depth: FROST_GOLD_ARCH_PANE.depth,
    presentation: { role: 'gate', material: 'glass' },
    fallback: gateFallback,
  }
})

export const FROST_GOLD_ARCH_PROFILE: CloudwayBarrierProfile = {
  id: 'frost-gold-arch-breakwall-a',
  variant: 'frost-gold-arch-breakwall-a',
  gateParts: [lowerPane, ...crownBands],
  // The ornate crown begins above the maximum authored jump/head envelope.
  // Only its measured grounded posts can contact normal movement.
  frameSides: FROST_GOLD_ARCH_FRAME.posts.map((post) => ({
    id: post.id,
    bottomCenter: { x: post.centerX, y: 0, z: 0 },
    width: post.width,
    height: FROST_GOLD_ARCH_PANE.shoulderHeight,
    depth: FROST_GOLD_ARCH_FRAME.depth,
    presentation: { role: 'wall', material: 'stone' },
    fallback: {
      replacedByBundle: FROST_GOLD_ARCH_BUNDLE_IDS.logical,
      replacedByNode: FROST_GOLD_ARCH_NODES.frame,
    },
  })),
}
