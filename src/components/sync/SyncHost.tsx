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

import type { Component, JSX } from 'solid-js'
import { ErrorBoundary, lazy, Show, Suspense } from 'solid-js'
import { closeSyncModal, syncModalOpen, syncSessionLive, takeSyncModalSessionId, } from '@/stores/sync-ui-store'

const SyncDevicesModal = lazy(async () =>
  import('@/components/sync/SyncDevicesModal').then((m) => ({
    default: m.SyncDevicesModal,
  })),
)
const SyncTransferChip = lazy(async () =>
  import('@/components/sync/SyncTransferChip').then((m) => ({
    default: m.SyncTransferChip,
  })),
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

/**
 * A dialog that cannot load must not take the session with it.
 *
 * Solid caches a rejected lazy() import for the life of the page, and
 * the failure is realistic here: the user is walking between devices,
 * and a deploy may have rotated the chunk hashes under them. Unbounded,
 * the rejection reaches the app-wide boundary and replaces the whole app
 * — killing the very transfer the chip exists to protect — and on
 * Karaoke Night, which has no boundary at all, it leaves `syncModalOpen`
 * stuck true: no dialog, no chip (it hides while the dialog is "open"),
 * no way to stop the session short of a reload. Closing the modal state
 * puts the chip back and leaves the transfer running.
 */
const SyncBoundary: Component<{ children: JSX.Element }> = (props) => (
  <ErrorBoundary
    fallback={() => {
      closeSyncModal()
      return null
    }}
  >
    {props.children}
  </ErrorBoundary>
)

export const SyncHost: Component = () => (
  <>
    <Show when={syncModalOpen()}>
      <SyncBoundary>
        <SyncModalMount />
      </SyncBoundary>
    </Show>
    {/* Only when hidden AND something is alive — the chip is the
        session's presence in the corner, not decoration beside the
        dialog. */}
    <Show when={syncSessionLive() && !syncModalOpen()}>
      <SyncBoundary>
        <Suspense fallback={null}>
          <SyncTransferChip />
        </Suspense>
      </SyncBoundary>
    </Show>
  </>
)
