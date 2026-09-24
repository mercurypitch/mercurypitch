// Cloudway scene theme — pearl sky and pale distance fog distinguish the open route from enclosed galleries.

import type { LevelDefinition } from '../contracts'

export const CLOUDWAY_SKY_ASSET_ID = 'floating-museum-cloudscape-v3'
export const CLOUDWAY_FOG_COLOR = 0xe3e7ef
// At the 4m authored camera these distances keep the next two route centres
// readable, while the third is already resolving into the painted cloudscape.
// The 5m fade also preserves that cue at the 6.5m maximum exploration boom.
export const CLOUDWAY_FOG_NEAR = 9
export const CLOUDWAY_FOG_FAR = 14

export function isCloudwayLevel(level: LevelDefinition): boolean {
  return level.presentation?.theme === 'cloudway'
}
