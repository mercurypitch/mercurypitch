// ============================================================
// A room shown: each moment the shell puts a room on screen
// ============================================================
//
// For what must know where a room's sound goes as the room appears: the
// output check (src/stores/output-check.ts), which reads it again with a
// fresh context. A room is on screen when its tab is current with nothing
// pushed over it (the room on screen at launch, a tab picked, the way back
// from Settings or the Developer screen), or when a premium room's door
// opens (room-visit.ts: those rooms are pushed screens of their own).
//
// The owner's cold start (mp-v0.8.57): Karaoke stayed silent on AirPlay
// until a trip to the Developer screen and back, so the way back from a
// pushed screen is one of the moments, not only a change of tab.

import type { Accessor } from 'solid-js'
import { createEffect, createRoot, on, onCleanup } from 'solid-js'
import type { RoomVisitStep } from './room-visit'
import { onRoomVisit } from './room-visit'
import { currentTab, pushed } from './run-shell-store'

export interface RoomShownOptions {
  /** Test seam: the shell's current tab otherwise. */
  readonly tab?: Accessor<string>
  /** Test seam: the screen pushed over the tab, or null; the shell's otherwise. */
  readonly pushed?: Accessor<string | null>
  /** Test seam: the premium rooms' visits otherwise. */
  readonly visits?: (listener: (step: RoomVisitStep) => void) => () => void
}

/**
 * Hear each room the shell shows, the one on screen now first. Returns the
 * stop.
 */
export function onRoomShown(
  handler: () => void,
  options: RoomShownOptions = {},
): () => void {
  const tab = options.tab ?? currentTab
  const over = options.pushed ?? pushed
  const visits = options.visits ?? onRoomVisit
  return createRoot((dispose) => {
    // The tab's room, or null while a screen is pushed over it.
    const shown = (): string | null => (over() === null ? tab() : null)
    createEffect(
      on(shown, (room) => {
        if (room !== null) handler()
      }),
    )
    onCleanup(
      visits((step) => {
        if (step.moment === 'enter') handler()
      }),
    )
    return dispose
  })
}
