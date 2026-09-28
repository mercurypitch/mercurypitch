// Rose Hex Crumble contact — the exact donor silhouette is a convex floor, never its empty AABB corners.

import type { CloudwayPlatformProfile } from '../authoring/cloudway-course-profiles.ts'
import type { PointXZ } from '../contracts.ts'
import { CLOUDWAY_LAB_PLATFORM_RENDER_IDS } from '../render/cloudway-laboratory-catalog.ts'

export const ROSE_HEX_CRUMBLE_SUPPORT_POLYGON = [
  { x: -0.9845005, z: 0 },
  { x: -0.4922505, z: 0.869 },
  { x: 0.4922505, z: 0.869 },
  { x: 0.9845005, z: 0 },
  { x: 0.4922505, z: -0.869 },
  { x: -0.4922505, z: -0.869 },
] as const satisfies readonly PointXZ[]

export const ROSE_HEX_CRUMBLE_CONTACT = {
  width: 1.969001,
  depth: 1.738,
  thickness: 0.47975290078992844,
} as const

export const ROSE_HEX_CRUMBLE_PROFILE: CloudwayPlatformProfile = {
  id: 'rose-hex-crumble',
  ...ROSE_HEX_CRUMBLE_CONTACT,
  top: 0,
  renderId: CLOUDWAY_LAB_PLATFORM_RENDER_IDS.roseHexCrumble,
  supportPolygon: ROSE_HEX_CRUMBLE_SUPPORT_POLYGON,
  behaviorKind: 'crackle',
}
