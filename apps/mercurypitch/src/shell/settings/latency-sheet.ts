// ============================================================
// The latency sheet's open state, and what Back does to it
// ============================================================
//
// Module-level for the same reason as the sign-in sheet's: the Microphone
// screen opens it, and Back (shell-navigation.ts) has to close it before it
// pops the screen underneath. Closing it unmounts the wizard, which ends a
// run in flight and hands the microphone back.

import { createSignal } from 'solid-js'

const [latencySheetOpen, setLatencySheetOpen] = createSignal(false)

/** Whether the latency sheet is up. */
export { latencySheetOpen }

export function openLatencySheet(): void {
  setLatencySheetOpen(true)
}

export function closeLatencySheet(): void {
  setLatencySheetOpen(false)
}

/** Tests: closed. */
export function resetLatencySheet(): void {
  setLatencySheetOpen(false)
}
