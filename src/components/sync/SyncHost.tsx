// ── SyncHost ─────────────────────────────────────────────────────────
// The one place the sync dialog and its corner chip mount — in the app
// shell and on the standalone Karaoke Night page, both of which stay up
// across everything the user does. Hosting the dialog inside a tab
// panel is what made "navigate away" mean "abort the transfer": the
// panel unmounted and took the session down with it (REQ-SYNC-030).
//
// A leaf like sync-ui, and for the same reason: both entries execute
// this at first paint, so the WebRTC/bundle machinery behind the dialog
// and the chip stays behind lazy() until a session actually exists.

import type { Component } from 'solid-js'
import { lazy, Show, Suspense } from 'solid-js'
import { closeSyncModal, syncModalOpen, syncSessionLive, takeSyncModalSessionId, } from '@/stores/sync-ui'

const SyncDevicesModal = lazy(
  async () => import('@/components/sync/SyncDevicesModal'),
)
const SyncTransferChip = lazy(
  async () => import('@/components/sync/SyncTransferChip'),
)

// Component body runs once per mount, i.e. once per open — the right
// place for the one-shot take. Behind a props getter it would hand the
// modal null on its second read.
const SyncModalMount: Component = () => {
  const sessionId = takeSyncModalSessionId() ?? undefined
  return (
    <Suspense fallback={null}>
      <SyncDevicesModal initialSessionId={sessionId} onClose={closeSyncModal} />
    </Suspense>
  )
}

export const SyncHost: Component = () => (
  <>
    <Show when={syncModalOpen()}>
      <SyncModalMount />
    </Show>
    {/* Only when hidden AND something is alive — the chip is the
        session's presence in the corner, not decoration beside the
        dialog. */}
    <Show when={syncSessionLive() && !syncModalOpen()}>
      <Suspense fallback={null}>
        <SyncTransferChip />
      </Suspense>
    </Show>
  </>
)

export default SyncHost
