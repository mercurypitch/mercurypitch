// ── SyncTransferChip ─────────────────────────────────────────────────
// Read-only presence: it reports what the hidden session is doing, and
// the only thing a press can do is bring the dialog back — a mis-tap in
// a corner must never be able to cost a transfer (REQ-SYNC-030).
//
// Everything it says comes from the summary sync-store mirrors into
// sync-ui (REQ-SYNC-036), so these run against the REAL signal and the
// REAL wording: this file and the Karaoke Night rail's are the two
// halves of one vocabulary, and a mocked label would let them drift.

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as SyncUi from '@/stores/sync-ui-store'
import type { SyncSessionSummary } from '@/stores/sync-ui-store'
import { setSyncSummary } from '@/stores/sync-ui-store'
import { SyncTransferChip } from '../sync/SyncTransferChip'

const ui = vi.hoisted(() => ({ openSyncModal: vi.fn() }))
vi.mock('@/stores/sync-ui-store', async (importOriginal) => {
  const actual = await importOriginal<typeof SyncUi>()
  return { ...actual, openSyncModal: ui.openSyncModal }
})

vi.mock('../icons', () => ({
  DeviceSync: () => <span>icon</span>,
}))

function summary(
  overrides: Partial<SyncSessionSummary> = {},
): SyncSessionSummary {
  return {
    connected: true,
    peerLabel: 'Kitchen TV',
    transfer: null,
    queued: 0,
    ...overrides,
  }
}

describe('SyncTransferChip', () => {
  beforeEach(() => {
    setSyncSummary(null)
    ui.openSyncModal.mockClear()
  })

  afterEach(cleanup)

  it('narrates the transfer in flight, with the queue behind it', () => {
    setSyncSummary(
      summary({
        transfer: { title: 'Song A', activity: 'sending', pct: 47 },
        queued: 2,
      }),
    )
    render(() => <SyncTransferChip />)
    const chip = screen.getByTestId('sync-chip')
    expect(chip.textContent).toContain('Sending “Song A” — 47%')
    expect(chip.textContent).toContain('2 more queued')
  })

  it('says who it is connected to when nothing is moving', () => {
    setSyncSummary(summary())
    render(() => <SyncTransferChip />)
    expect(screen.getByTestId('sync-chip').textContent).toContain(
      'Sync ready: Kitchen TV',
    )
  })

  it('a press reopens the dialog, and does nothing else', () => {
    setSyncSummary(
      summary({ transfer: { title: 'Song A', activity: 'sending', pct: 47 } }),
    )
    render(() => <SyncTransferChip />)
    fireEvent.click(screen.getByTestId('sync-chip'))
    expect(ui.openSyncModal).toHaveBeenCalledTimes(1)
  })

  it('follows the session without being remounted', async () => {
    setSyncSummary(summary())
    render(() => <SyncTransferChip />)
    expect(screen.getByTestId('sync-chip').textContent).toContain('Sync ready')

    setSyncSummary(
      summary({
        transfer: { title: 'Song A', activity: 'receiving', pct: 12 },
      }),
    )
    expect(screen.getByTestId('sync-chip').textContent).toContain(
      'Receiving “Song A” — 12%',
    )
  })

  it('still draws a bar for a transfer that has moved nothing yet', () => {
    setSyncSummary(
      summary({ transfer: { title: 'Song A', activity: 'sending', pct: 0 } }),
    )
    render(() => <SyncTransferChip />)
    // 0 is a percentage, not an absence. Gating the bar on truthiness
    // makes it appear only once the first chunk has landed.
    const chip = screen.getByTestId('sync-chip')
    expect(chip.querySelector('span[style*="width"]')).not.toBeNull()
  })

  it('gives `preparing` no bar, because it has no number', () => {
    setSyncSummary(
      summary({
        transfer: { title: 'Song A', activity: 'preparing', pct: null },
      }),
    )
    render(() => <SyncTransferChip />)
    const chip = screen.getByTestId('sync-chip')
    expect(chip.textContent).toContain('Preparing “Song A”')
    expect(chip.textContent).not.toContain('%')
    expect(chip.querySelector('span[style*="width"]')).toBeNull()
  })
})
