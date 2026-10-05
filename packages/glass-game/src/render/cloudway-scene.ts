// Cloudway scene theme — pearl sky and pale distance fog distinguish the open route from enclosed galleries.

import { CLOUDWAY_FOG_DEFAULTS } from '../content/cloudway-visibility'
import type { LevelDefinition, LevelFogDefinition } from '../contracts'

export const CLOUDWAY_SKY_ASSET_ID = 'floating-museum-cloudscape-v3'
export const CLOUDWAY_FOG_COLOR = 0xe3e7ef
// At the 4m authored camera these distances keep the next two route centres
// readable, while the third is already resolving into the painted cloudscape.
// The 5m fade also preserves that cue at the 6.5m maximum exploration boom.
export const CLOUDWAY_FOG_NEAR = CLOUDWAY_FOG_DEFAULTS.nearMeters
export const CLOUDWAY_FOG_FAR = CLOUDWAY_FOG_DEFAULTS.farMeters

export function isCloudwayLevel(level: LevelDefinition): boolean {
  return level.presentation?.theme === 'cloudway'
}

/** One level policy drives both the radial cloud fade and conservative selection. */
export function resolveCloudwayFog(
  level: LevelDefinition,
): Readonly<LevelFogDefinition> {
  return isCloudwayLevel(level)
    ? (level.presentation?.fog ?? CLOUDWAY_FOG_DEFAULTS)
    : CLOUDWAY_FOG_DEFAULTS
}
