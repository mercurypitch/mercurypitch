// ============================================================
// A room's unlocks: badges and achievements, shown at the result
// ============================================================
//
// A badge earned in a premium room used to raise a toast, and on a phone the
// toasts stack at the bottom, which in a room is where its controls are; one
// take could raise two (owner, 17 Oct 2026). A room claims its unlocks
// instead, for as long as it is on screen, and shows them in one chip under
// its result (UnlockChip.tsx). No toast and no pill is raised for them.
//
//   - One that arrives while the result is up goes straight onto the chip.
//   - One that arrives at any other time (during a take, in practice: a
//     grant pass that started before "Again") waits for the next result.
//   - Starting a take clears the chip: its unlocks have been seen.
//   - Leaving the room releases the claim. What was held and never shown is
//     announced as an ordinary notice, which the native shell draws as its
//     top pill, and a grant pass still in flight lands there too.

import type { Accessor } from 'solid-js'
import { createEffect, createSignal, on, onCleanup, untrack } from 'solid-js'
import type { ClaimedUnlock, UnlockItem } from '@/stores/notifications-store'
import { announceUnclaimed, claimUnlocks, unlockShown, } from '@/stores/notifications-store'

export interface RoomUnlocks {
  /** What the chip shows now, in the order it was earned. */
  readonly items: Accessor<readonly UnlockItem[]>
}

/**
 * Claim the room's unlocks for the life of the calling owner.
 *
 * `atResult` is true while the room shows a take's own result: a demo's
 * result is not one.
 */
export function createRoomUnlocks(atResult: Accessor<boolean>): RoomUnlocks {
  const [items, setItems] = createSignal<readonly UnlockItem[]>([])
  let held: ClaimedUnlock[] = []

  const release = claimUnlocks((claimed) => {
    if (untrack(atResult)) {
      setItems((list) => [...list, claimed.unlock])
      unlockShown()
    } else {
      held.push(claimed)
    }
  })

  createEffect(
    on(atResult, (now) => {
      if (!now) {
        setItems([])
        return
      }
      if (held.length === 0) return
      const arrived = held
      held = []
      setItems((list) => [...list, ...arrived.map((c) => c.unlock)])
      unlockShown()
    }),
  )

  onCleanup(() => {
    release()
    const unseen = held
    held = []
    for (const claimed of unseen) announceUnclaimed(claimed)
  })

  return { items }
}
