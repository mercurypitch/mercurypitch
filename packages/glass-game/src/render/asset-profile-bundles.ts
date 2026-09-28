// Asset profile bundles — choose reviewed desktop/mobile bytes without changing authored logical IDs.

import { FROST_GOLD_ARCH_BUNDLE_IDS } from '../content/frost-gold-arch-profile'
import { PEARL_QUARTER_TURN_BUNDLE_IDS } from '../content/pearl-quarter-turn-profile'
import { CLOUDWAY_LAB_BUNDLE_IDS } from './cloudway-laboratory-catalog'
import type { GlassAssetQualityProfile } from './render-quality'

const PROFILE_BUNDLES: Readonly<
  Record<string, Readonly<Record<GlassAssetQualityProfile, string>>>
> = {
  [PEARL_QUARTER_TURN_BUNDLE_IDS.logical]: {
    full: PEARL_QUARTER_TURN_BUNDLE_IDS.desktop,
    mobile: PEARL_QUARTER_TURN_BUNDLE_IDS.mobile,
  },
  [CLOUDWAY_LAB_BUNDLE_IDS.roseHexCrumble]: {
    full: CLOUDWAY_LAB_BUNDLE_IDS.roseHexCrumbleDesktop,
    mobile: CLOUDWAY_LAB_BUNDLE_IDS.roseHexCrumbleMobile,
  },
  [FROST_GOLD_ARCH_BUNDLE_IDS.logical]: {
    full: FROST_GOLD_ARCH_BUNDLE_IDS.desktop,
    mobile: FROST_GOLD_ARCH_BUNDLE_IDS.mobile,
  },
}

export function resolveAssetProfileBundle(
  logicalId: string,
  profile: GlassAssetQualityProfile,
): string {
  return PROFILE_BUNDLES[logicalId]?.[profile] ?? logicalId
}
