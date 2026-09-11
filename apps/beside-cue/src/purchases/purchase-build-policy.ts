// ============================================================
// Purchase build policy — Beside Cue's identity, the shared rules
// ============================================================
//
// The rules moved to @irchiinnuss/purchase-kit when Mercury Pitch started
// shipping the same way. What stays here is the only part that was ever
// Beside-Cue-specific: what this app calls itself, and the names of its two
// build switches. Those names must NOT be shared -- one app's distribution
// variable deciding another app's build is the exact failure the extraction
// was meant to make impossible.

import { assertPurchaseBuildSafe as assertSafe } from '@irchiinnuss/purchase-kit'

const POLICY = {
  appName: 'Beside Cue',
  distributionEnv: 'VITE_BESIDE_CUE_DISTRIBUTION',
  platformEnv: 'VITE_BESIDE_CUE_NATIVE_PLATFORM',
} as const

export function assertPurchaseBuildSafe(
  env: Readonly<Record<string, string | undefined>>,
  releaseTag: boolean,
): void {
  assertSafe(POLICY, env, releaseTag)
}
