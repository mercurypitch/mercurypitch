// ── Sync UI state ────────────────────────────────────────────────────
// Whether the sync dialog is showing, and whether a session is alive
// behind it — and nothing else.
//
// A leaf on purpose: the app shell, the standalone Karaoke Night page,
// UvrPanel and the karaoke rail all import this statically to open the
// dialog, and none of them may pay for the WebRTC/bundle machinery at
// first paint. That machinery (sync-store) imports THIS module — never
// the other way round — and speaks through the setters below.

import { createSignal } from 'solid-js'

const [syncModalOpen, setSyncModalOpen] = createSignal(false)
/** Mirrored by sync-store: true while a session exists (any state but idle). */
const [syncSessionLive, setSyncSessionLive] = createSignal(false)

/** A song id handed to openSyncModal, waiting for the modal to mount. */
let pendingSessionId: string | null = null

/**
 * What sync-store wants to hear about the dialog: hidden (decide whether
 * the session behind it lives on) and shown (stop any idle countdown).
 * Registered when sync-store loads; until then there is no session, so
 * there is nothing to decide.
 */
interface SyncUiLifecycle {
  onForeground(): void
  onBackground(): void
}
let lifecycle: SyncUiLifecycle | null = null

export function registerSyncUiLifecycle(hooks: SyncUiLifecycle): void {
  lifecycle = hooks
}

/** Show the sync dialog, optionally straight onto sending one song. */
export function openSyncModal(sessionId?: string): void {
  pendingSessionId = sessionId ?? null
  setSyncModalOpen(true)
  lifecycle?.onForeground()
}

/**
 * Hide the sync dialog. What happens to the session behind it is
 * sync-store's call (registerSyncUiLifecycle): a connected pair stays
 * ready behind the corner chip, a half-opened one is torn down.
 */
export function closeSyncModal(): void {
  setSyncModalOpen(false)
  lifecycle?.onBackground()
}

/** One-shot: the song openSyncModal was asked to send, then nothing. */
export function takeSyncModalSessionId(): string | null {
  const id = pendingSessionId
  pendingSessionId = null
  return id
}

export { setSyncSessionLive, syncModalOpen, syncSessionLive }
