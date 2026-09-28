// ============================================================
// Developer console store — whether the floating console is switched on
// ============================================================
//
// The switch, kept apart from the log it shows (console-store.ts). The log is
// in every build: the global error handler feeds it and the crash card reads
// it. The switch exists only where the floating console does, which is the
// web and a native test build, and its key is how
// `scripts/assert-no-portable-console.mjs --store-binary` recognises the
// floating console in a store binary. Kept beside the log, it rode the error
// handler into that binary.
//
// Persisted, because "on every page" includes the pages that are their own
// document. Karaoke Night, the Mirror and each Night entry are separate
// documents; a plain signal would switch the console off the moment you walked
// through a door, which is exactly when a phone bug tends to show itself.
//
// Device-local despite the prefix: it is listed in `EXCLUDED_KEYS` in
// src/db/services/settings-service.ts, because the console is switched on to
// read what THIS device is saying and syncing it grew a debug panel on every
// other signed-in device.

import { DEVELOPER_CONSOLE_KEY } from '@/lib/developer-console'
import { createPersistedSignal } from '@/lib/storage'

export const [showConsoleLog, setShowConsoleLog] =
  createPersistedSignal<boolean>(DEVELOPER_CONSOLE_KEY, false)

export function toggleConsoleLog(): void {
  setShowConsoleLog((prev) => !prev)
}
