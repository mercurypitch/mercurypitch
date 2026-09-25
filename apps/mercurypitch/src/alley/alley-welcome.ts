// ============================================================
// The welcome flag: has this install opened a door yet?
// ============================================================
//
// The first run IS the alley with its headline (owner decision 10); there is
// no separate welcome screen. The flag says whether the headline is due, and
// it flips on the first door OPENED, not on arrival — a singer who looks at
// the alley and leaves has not been welcomed into anything, and sees it again.
//
// BUILT ON FIRST READ, not at import, like the Sing room's flags
// (`src/features/sing-room/sing-room-settings.ts`): a persisted signal made at
// module scope would read storage before the native storage port has
// hydrated, and would be one more thing every importer pays for.
//
// Only the Developer screen resets it ("Replay the welcome").

import type { Signal } from 'solid-js'
import { createPersistedSignal } from '@/lib/storage'

export const WELCOME_SEEN_KEY = 'pitchperfect_native_welcome_seen'

let flag: Signal<boolean> | undefined

const resolve = (): Signal<boolean> => {
  flag ??= createPersistedSignal<boolean>(WELCOME_SEEN_KEY, false, {
    validator: (value): value is boolean => typeof value === 'boolean',
  })
  return flag
}

/** True once any door has been opened on this install. */
export function welcomeSeen(): boolean {
  return resolve()[0]()
}

/** The first door open. Idempotent. */
export function markWelcomeSeen(): void {
  if (resolve()[0]()) return
  resolve()[1](true)
}

/** "Replay the welcome": the headline is due again. */
export function resetWelcome(): void {
  resolve()[1](false)
}

/** Whether the flag has been built. Tests only: it must not be at import. */
export function welcomeFlagBuilt(): boolean {
  return flag !== undefined
}
