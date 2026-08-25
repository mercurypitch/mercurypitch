// ── SyncTransferChip ─────────────────────────────────────────────────
// Read-only presence: it reports what the hidden session is doing, and
// the only thing a press can do is bring the dialog back — a mis-tap in
// a corner must never be able to cost a transfer (REQ-SYNC-030).

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SyncTransfer } from '@/stores/sync-store'
import { SyncTransferChip } from '../sync/SyncTransferChip'

const state = vi.hoisted(() => ({
  transfers: [] as unknown[],
  queue: [] as string[],
  syncState: 'connected' as string,
  label: 'Kitchen TV' as string | null,
}))

vi.mock('@/stores/sync-store', () => ({
  isLiveTransfer: (t: SyncTransfer) =>
    t.status === 'packing' ||
    t.status === 'preparing' ||
    t.status === 'transferring',
  syncPeerLabel: () => state.label,
  syncQueue: () => state.queue,
  syncState: () => state.syncState,
  syncTransfers: () => state.transfers,
}))

const syncUi = vi.hoisted(() => ({ openSyncModal: vi.fn() }))
vi.mock('@/stores/sync-ui-store', () => syncUi)

vi.mock('../icons', () => ({
  DeviceSync: () => <span>icon</span>,
}))

function moving(overrides: Partial<SyncTransfer> = {}): SyncTransfer {
  return {
    fileHash: 'h1',
    title: 'Song A',
    direction: 'out',
    status: 'transferring',
    ratio: 0.47,
    bytes: 100,
    ...overrides,
  }
}

describe('SyncTransferChip', () => {
  beforeEach(() => {
    state.transfers = []
    state.queue = []
    state.syncState = 'connected'
    state.label = 'Kitchen TV'
    syncUi.openSyncModal.mockClear()
  })

  afterEach(cleanup)

  it('narrates the transfer in flight, with the queue behind it', () => {
    state.transfers = [moving()]
    state.queue = ['s2', 's3']
    render(() => <SyncTransferChip />)
    const chip = screen.getByTestId('sync-chip')
    expect(chip.textContent).toContain('Sending “Song A” — 47%')
    expect(chip.textContent).toContain('2 more queued')
  })

  it('says who it is connected to when nothing is moving', () => {
    render(() => <SyncTransferChip />)
    expect(screen.getByTestId('sync-chip').textContent).toContain(
      'Sync ready: Kitchen TV',
    )
  })

  it('a press reopens the dialog, and does nothing else', () => {
    state.transfers = [moving()]
    render(() => <SyncTransferChip />)
    fireEvent.click(screen.getByTestId('sync-chip'))
    expect(syncUi.openSyncModal).toHaveBeenCalledTimes(1)
  })
})
