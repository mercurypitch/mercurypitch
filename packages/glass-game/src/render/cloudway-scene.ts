// Cloudway scene theme — pearl sky and pale distance fog distinguish the open route from enclosed galleries.

import type { LevelDefinition } from '../contracts'

export const CLOUDWAY_SKY_ASSET_ID = 'floating-museum-cloudscape-v3'
export const CLOUDWAY_FOG_COLOR = 0xe3e7ef
// Reveal the next landing and its warning; let the far bank emerge on approach.
export const CLOUDWAY_FOG_NEAR = 16
export const CLOUDWAY_FOG_FAR = 31

export function isCloudwayLevel(level: LevelDefinition): boolean {
  return level.presentation?.theme === 'cloudway'
}
