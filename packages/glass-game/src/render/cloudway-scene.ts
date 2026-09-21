// Cloudway scene theme — pearl sky and pale distance fog distinguish the open route from enclosed galleries.

import type { LevelDefinition } from '../contracts'

export const CLOUDWAY_SKY_ASSET_ID = 'floating-museum-cloudscape-v3'
export const CLOUDWAY_FOG_COLOR = 0xd7e5ed
export const CLOUDWAY_FOG_DENSITY = 0.0065

export function isCloudwayLevel(level: LevelDefinition): boolean {
  return level.presentation?.theme === 'cloudway'
}
