// ============================================================
// Community entry — the shell's way into Community, and its account watch
// ============================================================
//
// NativeShell hands More's Community row `pushCommunity` and installs the
// store's account watch through `installCommunity`. Each reach into the
// store is behind NATIVE_COMMUNITY, so a store build folds this module down
// to a push the stack refuses (run-shell-store.ts) and a watch that does
// nothing, and drops the store whole (its module is free of side effects
// in the native config).

import { NATIVE_COMMUNITY } from '@/lib/native-build'
import { pushScreen } from '../run-shell-store'
import { forgetCommunityResult, installCommunityWatch } from './community-store'

/**
 * More's Community row. Pushed afresh, Community opens at its title, not at
 * the row of a result opened on an earlier visit.
 */
export function pushCommunity(): void {
  if (NATIVE_COMMUNITY) forgetCommunityResult()
  pushScreen('community')
}

/**
 * Let what was kept for an account go when it signs out or the phone
 * changes hands (community-store.ts). Returns the teardown.
 */
export function installCommunity(): () => void {
  return NATIVE_COMMUNITY ? installCommunityWatch() : () => undefined
}
