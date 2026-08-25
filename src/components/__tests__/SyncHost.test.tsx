// ── SyncHost ─────────────────────────────────────────────────────────
// The always-mounted host: dialog when open, chip when a live session
// is hidden, nothing otherwise — REQ-SYNC-030's UI half. The lazy()
// boundary in the host is also what keeps the WebRTC/bundle machinery
// out of both entries' first paint, so "mounts nothing" is not only
// about pixels.

import { cleanup, render, screen } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { closeSyncModal, openSyncModal, setSyncSessionLive, takeSyncModalSessionId, } from '@/stores/sync-ui-store'
import { SyncHost } from '../sync/SyncHost'

vi.mock('@/components/sync/SyncDevicesModal', () => ({
  SyncDevicesModal: (props: { initialSessionId?: string }) => (
    <div data-testid="modal" data-initial={props.initialSessionId ?? ''} />
  ),
}))
vi.mock('@/components/sync/SyncTransferChip', () => ({
  SyncTransferChip: () => <div data-testid="chip" />,
}))

describe('SyncHost', () => {
  beforeEach(() => {
    // Module-level signals survive between tests; start every one from
    // "no dialog, no session, no pending song".
    closeSyncModal()
    setSyncSessionLive(false)
    takeSyncModalSessionId()
  })

  afterEach(cleanup)

  it('mounts nothing while there is no session and no dialog', () => {
    render(() => <SyncHost />)
    expect(screen.queryByTestId('modal')).toBeNull()
    expect(screen.queryByTestId('chip')).toBeNull()
  })

  it('shows the dialog on openSyncModal, with the song it was asked for', async () => {
    render(() => <SyncHost />)
    openSyncModal('song-9')
    const modal = await screen.findByTestId('modal')
    expect(modal.getAttribute('data-initial')).toBe('song-9')
  })

  it('hands the song over exactly once', async () => {
    render(() => <SyncHost />)
    openSyncModal('song-9')
    await screen.findByTestId('modal')

    closeSyncModal()
    openSyncModal()

    const modal = await screen.findByTestId('modal')
    expect(modal.getAttribute('data-initial')).toBe('')
  })

  it('REQ-SYNC-030: the chip appears when a live session is hidden', async () => {
    render(() => <SyncHost />)
    setSyncSessionLive(true)
    expect(await screen.findByTestId('chip')).toBeInTheDocument()

    // Reopening swaps the chip for the dialog — never both at once.
    openSyncModal()
    await screen.findByTestId('modal')
    expect(screen.queryByTestId('chip')).toBeNull()
  })
})
