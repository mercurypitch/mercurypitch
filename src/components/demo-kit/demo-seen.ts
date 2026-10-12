// ============================================================
// Whether this device has seen a room's demo
// ============================================================
//
// Set when the demo reaches its end card, is skipped or is turned down on
// its play card; never when the singer leaves halfway, so it plays again
// next time. A device fact, not a preference: keys take the `mp_` prefix,
// which keeps them out of the settings sync (settings-service.ts syncs
// `pitchperfect_`).

import { createPersistedSignal } from '@/lib/storage'

export interface DemoSeen {
  seen: () => boolean
  mark: () => void
}

/** One room's flag, stored under `key`. Call it once, at module level. */
export function createDemoSeen(key: string): DemoSeen {
  const [seen, setSeen] = createPersistedSignal<boolean>(key, false, {
    validator: (value): value is boolean => typeof value === 'boolean',
  })
  return {
    seen: () => seen(),
    mark: () => {
      if (!seen()) setSeen(true)
    },
  }
}
