// ============================================================
// Whether this device has seen the Echo demo
// ============================================================
//
// The demo kit's flag (demo-kit/demo-seen.ts) under Echo's own key, built
// on first read, as Echo's stores are, so importing this module touches
// no storage.

import type { DemoSeen } from '@/components/demo-kit/demo-seen'
import { createDemoSeen } from '@/components/demo-kit/demo-seen'

export const ECHO_DEMO_SEEN_KEY = 'mp_echo_demo_seen'

let flag: DemoSeen | undefined
const seenFlag = (): DemoSeen => (flag ??= createDemoSeen(ECHO_DEMO_SEEN_KEY))

export function echoDemoSeen(): boolean {
  return seenFlag().seen()
}

export function markEchoDemoSeen(): void {
  seenFlag().mark()
}
