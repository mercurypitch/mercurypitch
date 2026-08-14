// ── SyncDevicesModal ─────────────────────────────────────────────────
// The send list, mounted with a song in it.
//
// Written after the two-device spec found what nothing in this suite
// could: `tooBigForPeer` was declared BELOW the memos that call it, and
// `createMemo` runs its body immediately, so the modal threw the instant
// there was a song to filter — and never on an empty library, because
// `[].filter(fits)` does not call `fits`.
//
// That is the shape to guard: this file mounts the send list with songs
// present, which is the only state in which the ordering can bite.
//
// Requirements: docs/specs/device-sync-transfers.ears.md (REQ-SYNC-018..023).

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { UvrSession } from '@/stores/uvr-store'
import { SyncDevicesModal } from '../sync/SyncDevicesModal'

const sync = vi.hoisted(() => {
  return {
    enqueueSongs: vi.fn(),
    sendSongToPeer: vi.fn(() => Promise.resolve()),
    startSyncReceive: vi.fn(() => Promise.resolve()),
    startSyncSend: vi.fn(() => Promise.resolve()),
    stopQueue: vi.fn(),
    stopSync: vi.fn(),
    takeSyncCodeToJoin: vi.fn(() => null),
    estimatePackedBytes: vi.fn(() => 5 * 1024 * 1024),
  }
})

const state = vi.hoisted(() => ({
  sessions: [] as unknown[],
  groups: [] as unknown[],
  peerRoom: null as { freeBytes: number; quota: number } | null,
  syncState: 'connected' as string,
}))

vi.mock('@/stores/sync-store', () => ({
  ...sync,
  syncBusy: () => false,
  syncError: () => null,
  syncOwnRoom: () => null,
  syncPeerLabel: () => 'The other one',
  syncPeerRoom: () => state.peerRoom,
  syncQueue: () => [],
  syncRoomId: () => 'ABCD1234',
  syncState: () => state.syncState,
  syncTransfers: () => [],
}))

vi.mock('@/stores/uvr-store', () => ({
  getAllUvrSessionsReactive: () => state.sessions,
}))

vi.mock('@/stores/app-store', () => ({
  getGroupsReactive: () => state.groups,
}))

vi.mock('@/lib/jam/signaling', () => ({ jamSignalingIsMocked: () => false }))

vi.mock('@/components/QrCode', () => ({
  QrCode: () => <span>QR</span>,
}))

vi.mock('../icons', () => ({
  DeviceSync: () => <span>DeviceSync</span>,
}))

function song(overrides: Partial<UvrSession> = {}): UvrSession {
  return {
    sessionId: 'session-1',
    status: 'completed',
    progress: 100,
    fileHash: 'hash-1',
    createdAt: 1,
    originalFile: { name: 'A Song.wav', size: 10, mimeType: 'audio/wav' },
    outputs: { vocal: 'blob:v', instrumental: 'blob:i' },
    stemMeta: { vocal: { size: 10 }, instrumental: { size: 10 } },
    ...overrides,
  } as UvrSession
}

/** Get to the send list, which is where the songs are. */
function openSendList(): void {
  render(() => <SyncDevicesModal onClose={() => {}} />)
  fireEvent.click(screen.getByTestId('sync-choose-send'))
}

describe('SyncDevicesModal send list', () => {
  beforeEach(() => {
    state.sessions = []
    state.groups = []
    state.peerRoom = { freeBytes: 500 * 1024 * 1024, quota: 1024 * 1024 * 1024 }
    state.syncState = 'connected'
    vi.clearAllMocks()
    sync.takeSyncCodeToJoin.mockReturnValue(null)
    sync.estimatePackedBytes.mockReturnValue(5 * 1024 * 1024)
  })

  afterEach(cleanup)

  it('mounts with songs to send', () => {
    // The regression: every memo in this component runs the moment it is
    // created, so one that reaches a helper declared further down the file
    // hits its temporal dead zone as soon as a song makes it call one.
    state.sessions = [song(), song({ sessionId: 'session-2', fileHash: 'h2' })]
    openSendList()
    expect(screen.getAllByTestId('sync-song-row')).toHaveLength(2)
  })

  it('mounts with no songs at all', () => {
    openSendList()
    expect(screen.queryAllByTestId('sync-song-row')).toHaveLength(0)
  })

  it('offers only songs that carry a content hash', () => {
    // No hash means the far device cannot recognise the song, so dedupe
    // has nothing to compare and the bundle has no identity to claim.
    state.sessions = [song(), song({ sessionId: 'session-2', fileHash: '' })]
    openSendList()
    expect(screen.getAllByTestId('sync-song-row')).toHaveLength(1)
  })

  it('sinks a song the far device has no room for, and takes its checkbox away', () => {
    state.peerRoom = { freeBytes: 1024, quota: 1024 * 1024 }
    state.sessions = [song()]
    openSendList()
    const row = screen.getByTestId('sync-song-row')
    expect(row.querySelector('input[type="checkbox"]')).toBeNull()
  })

  // REQ-SYNC-022: per song is not enough — a device with room for two of
  // six accepts two and then refuses four, one error at a time, each
  // arriving after minutes of packing. The sum is checked once, up front.
  it('refuses a selection that will not fit, before anything packs', () => {
    state.peerRoom = { freeBytes: 12 * 1024 * 1024, quota: 1024 * 1024 * 1024 }
    sync.estimatePackedBytes.mockReturnValue(8 * 1024 * 1024)
    state.sessions = [
      song(),
      song({ sessionId: 'session-2', fileHash: 'h2', createdAt: 2 }),
    ]
    openSendList()
    // Each song fits on its own (8 MB < 12 MB), so both keep a checkbox…
    for (const row of screen.getAllByTestId('sync-song-row')) {
      fireEvent.click(row.querySelector('input[type="checkbox"]')!)
    }
    // …and together they do not (16 MB > 12 MB).
    const footer = screen.getByTestId('sync-send-picked')
    expect(footer).toBeDisabled()
    expect(screen.getByText(/more than .* has room for/i)).toBeTruthy()
    expect(sync.enqueueSongs).not.toHaveBeenCalled()
  })

  // REQ-SYNC-023: a group IS the playlist — filter to one, Select all,
  // send it. No new concept and nothing new to store.
  it('filters the list to one group, and back', () => {
    state.groups = [{ id: 'g1', name: 'Duets' }]
    state.sessions = [
      song({ groupId: 'g1' }),
      song({ sessionId: 'session-2', fileHash: 'h2', createdAt: 2 }),
    ]
    openSendList()
    expect(screen.getAllByTestId('sync-song-row')).toHaveLength(2)

    fireEvent.click(screen.getByRole('button', { name: 'Duets' }))
    const filtered = screen.getAllByTestId('sync-song-row')
    expect(filtered).toHaveLength(1)
    expect(filtered[0]?.getAttribute('data-session-id')).toBe('session-1')

    // Choosing the same group again is "show me everything" — a filter
    // with no visible off switch strands the other songs.
    fireEvent.click(screen.getByRole('button', { name: 'Duets' }))
    expect(screen.getAllByTestId('sync-song-row')).toHaveLength(2)
  })

  it('queues the ticked songs rather than sending each one itself', () => {
    state.sessions = [
      song(),
      song({ sessionId: 'session-2', fileHash: 'h2', createdAt: 2 }),
    ]
    openSendList()
    // The row boxes, not every checkbox on screen — "Select all" is one
    // too, and clicking it as well would tick both songs and then untick
    // them, leaving a selection of nothing and no footer to press.
    for (const row of screen.getAllByTestId('sync-song-row')) {
      fireEvent.click(row.querySelector('input[type="checkbox"]')!)
    }
    fireEvent.click(screen.getByTestId('sync-send-picked'))
    expect(sync.enqueueSongs).toHaveBeenCalledTimes(1)
    expect(sync.sendSongToPeer).not.toHaveBeenCalled()
    expect(sync.enqueueSongs.mock.calls[0]?.[0]).toHaveLength(2)
  })
})
