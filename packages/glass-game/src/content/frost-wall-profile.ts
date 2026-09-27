// Frost wall contact — measured pane and permanent frame share one floor-centred authoring datum.

import type { CloudwayBarrierProfile } from '../authoring/cloudway-course-profiles'

export const FROST_WALL_BUNDLE = 'cloudway-lab-frosted-scroll-wall-v1'
export const FROST_WALL_PANE = {
  width: 1.72,
  height: 2.69,
  depth: 0.055,
} as const
/** Frame feet and pane share the court datum; the opening has no raised sill. */
export const FROST_WALL_MOUNT_HEIGHT = 0

// Structural frame contact excludes the decorative 9mm round gold edging.
// Its floor trim straddles Y=0 and must never become a raised collision sill.
export const FROSTED_SCROLL_WALL_PROFILE: CloudwayBarrierProfile = {
  id: 'frosted-scroll-wall',
  variant: 'frosted-scroll-wall',
  gate: {
    id: 'pane',
    bottomCenter: { x: 0, y: 0, z: 0 },
    ...FROST_WALL_PANE,
    presentation: { role: 'gate', material: 'glass' },
    fallback: {
      replacedByBundle: FROST_WALL_BUNDLE,
      replacedByNode: 'frost_wall_intact',
    },
  },
  frameSides: [
    ...([-1, 1] as const).map((side) => ({
      id: side < 0 ? 'left-post' : 'right-post',
      bottomCenter: {
        x: side * 1.1078282375,
        y: -FROST_WALL_MOUNT_HEIGHT,
        z: 0,
      },
      width: 0.495656475,
      height: 2.44,
      depth: 0.491436869,
      presentation: { role: 'wall' as const, material: 'stone' as const },
      fallback: {
        replacedByBundle: FROST_WALL_BUNDLE,
        replacedByNode: 'frost_wall_frame',
      },
    })),
    {
      id: 'lintel',
      bottomCenter: { x: 0, y: 2.44, z: 0 },
      width: 1.72,
      height: 0.560000067,
      depth: 0.491436869,
      presentation: { role: 'wall', material: 'stone' },
      fallback: {
        replacedByBundle: FROST_WALL_BUNDLE,
        replacedByNode: 'frost_wall_frame',
      },
    },
  ],
}
