// ============================================================
// Whether this device has seen the Long note demo
// ============================================================
//
// The demo kit's flag (demo-kit/demo-seen.ts) under Long note's own key.

import { createDemoSeen } from '@/components/demo-kit/demo-seen'

const flag = createDemoSeen('mp_long_note_demo_seen')

export function longNoteDemoSeen(): boolean {
  return flag.seen()
}

export function markLongNoteDemoSeen(): void {
  flag.mark()
}
