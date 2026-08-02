// ============================================================
// Listening Room Settings — reactive bridge from UI state to the active rack
// ============================================================

import type { Accessor } from 'solid-js'
import { createEffect } from 'solid-js'
import type { FxRack, FxSettings } from '@/lib/voice-fx-rack'

/** Keep subscribing even before a playback rack exists. */
export function bindListeningRoomSettings(
  settings: Accessor<FxSettings>,
  rack: () => Pick<FxRack, 'setSettings'> | null,
): void {
  createEffect(() => {
    const current = settings()
    rack()?.setSettings(current)
  })
}
