// ============================================================
// Whether this device has seen the Long note demo
// ============================================================
//
// Set when the demo reaches its end card, is skipped or is turned down on
// its play card; never when the singer leaves halfway, so it plays again
// next time. A device fact, not a preference: the `mp_` prefix keeps it
// out of the settings sync (settings-service.ts syncs `pitchperfect_`).

import { createPersistedSignal } from '@/lib/storage'

const [seen, setSeen] = createPersistedSignal<boolean>(
  'mp_long_note_demo_seen',
  false,
  { validator: (value): value is boolean => typeof value === 'boolean' },
)

export function longNoteDemoSeen(): boolean {
  return seen()
}

export function markLongNoteDemoSeen(): void {
  if (!seen()) setSeen(true)
}
