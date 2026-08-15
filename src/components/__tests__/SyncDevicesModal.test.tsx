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
import type { SyncTransfer } from '@/stores/sync-store'
import type { UvrSession } from '@/stores/uvr-store'
import { SyncDevicesModal } from '../sync/SyncDevicesModal'

const sync = vi.hoisted(() => {
  return {
    clearFinishedTransfers: vi.fn(),
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
  transfers: [] as SyncTransfer[],
  role: null as 'send' | 'receive' | null,
}))

vi.mock('@/stores/sync-store', () => ({
  ...sync,
  syncBusy: () => false,
  syncError: () => null,
  syncOwnRoom: () => null,
  syncPeerLabel: () => 'The other one',
  syncPeerRoom: () => state.peerRoom,
  syncQueue: () => [],
  syncRole: () => state.role,
  syncRoomId: () => 'ABCD1234',
  syncState: () => state.syncState,
  syncTransfers: () => state.transfers,
}))

// NO app-store mock, deliberately: the modal must not import the app
// shell at all. It is lazy-loaded by the standalone Karaoke Night page,
// and an app-store edge drags the app entry chunk in — which RENDERS
// the whole app under that page the moment the sync door opens. If the
// import ever comes back, the real app-store loads here and this suite
// fails loudly instead of masking it. See the boundary test below.
vi.mock('@/stores/uvr-store', () => ({
  getAllUvrSessionsReactive: () => state.sessions,
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
    state.transfers = []
    state.role = null
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

  it('REQ-SYNC-025: offers Clear finished only when something has finished', () => {
    state.transfers = [
      {
        fileHash: 'h1',
        title: 'Still moving',
        direction: 'out',
        status: 'transferring',
        ratio: 0.4,
        bytes: 100,
      },
    ]
    openSendList()
    // A list of only live rows has nothing to sweep; a Clear button here
    // would either do nothing or hide real work.
    expect(screen.queryByTestId('sync-clear-transfers')).toBeNull()

    state.transfers = [
      ...state.transfers,
      {
        fileHash: 'h2',
        title: 'Done one',
        direction: 'out',
        status: 'done',
        ratio: 1,
        bytes: 100,
      },
    ]
    cleanup()
    openSendList()
    fireEvent.click(screen.getByTestId('sync-clear-transfers'))
    expect(sync.clearFinishedTransfers).toHaveBeenCalledTimes(1)
  })

  it('never reaches for the app shell', async () => {
    // The modal is lazy-loaded by the standalone Karaoke Night page, so
    // nothing in its import closure may reach the app ENTRY chunk —
    // executing the entry renders the entire app under the karaoke stage
    // the moment the sync door opens (found on a real phone, 2026-08-14).
    // This guards the imports a modal could plausibly grow: the app
    // shell's own stores, in any spelling (alias or relative, either
    // quote). It is a source-level tripwire, not proof — the chunk graph
    // itself decides, so a suspicious new modal import deserves a build
    // and a look at what the modal chunk pulls in.
    const [fs, path] = await Promise.all([
      import('node:fs/promises'),
      import('node:path'),
    ])
    const source = await fs.readFile(
      path.join(process.cwd(), 'src/components/sync/SyncDevicesModal.tsx'),
      'utf8',
    )
    expect(source).not.toMatch(
      /from\s+['"][^'"]*stores\/(?:app-store|ui-store)['"]/,
    )
  })
})

describe('closing, and what it must not do', () => {
  beforeEach(() => {
    state.sessions = []
    state.groups = []
    state.peerRoom = null
    state.syncState = 'connected'
    state.transfers = []
    state.role = null
    vi.clearAllMocks()
    sync.takeSyncCodeToJoin.mockReturnValue(null)
  })

  afterEach(cleanup)

  // REQ-SYNC-031: before this, a stray tap on the backdrop ended the
  // session and aborted whatever was in flight.
  it('REQ-SYNC-031: a click on the backdrop neither closes nor disconnects', () => {
    const onClose = vi.fn()
    render(() => <SyncDevicesModal onClose={onClose} />)
    fireEvent.click(screen.getByTestId('sync-modal').parentElement!)
    expect(onClose).not.toHaveBeenCalled()
    expect(sync.stopSync).not.toHaveBeenCalled()
  })

  it('REQ-SYNC-030: the X hides the dialog without ending the session', () => {
    const onClose = vi.fn()
    render(() => <SyncDevicesModal onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(sync.stopSync).not.toHaveBeenCalled()
  })

  it('Escape behaves exactly like the X', () => {
    const onClose = vi.fn()
    render(() => <SyncDevicesModal onClose={onClose} />)
    fireEvent.keyDown(screen.getByTestId('sync-modal'), { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(sync.stopSync).not.toHaveBeenCalled()
  })

  it('Disconnect is the deliberate way out, and only it ends the session', () => {
    render(() => <SyncDevicesModal onClose={() => {}} />)
    fireEvent.click(screen.getByTestId('sync-disconnect'))
    expect(sync.stopSync).toHaveBeenCalledTimes(1)
  })

  it('reopens onto the send list the sender was closed on', () => {
    state.role = 'send'
    state.sessions = [song()]
    render(() => <SyncDevicesModal onClose={() => {}} />)
    // No chooser press: the list is simply there again.
    expect(screen.getAllByTestId('sync-song-row')).toHaveLength(1)
  })

  it('reopening as the receiver does not open a second room', () => {
    state.role = 'receive'
    render(() => <SyncDevicesModal onClose={() => {}} />)
    expect(sync.startSyncReceive).not.toHaveBeenCalled()
  })

  it('says mid-transfer that closing stops nothing', () => {
    state.transfers = [
      {
        fileHash: 'h1',
        title: 'Moving',
        direction: 'out',
        status: 'transferring',
        ratio: 0.5,
        bytes: 10,
      },
    ]
    render(() => <SyncDevicesModal onClose={() => {}} />)
    expect(screen.getByText(/Closing this window stops nothing/i)).toBeTruthy()
  })
})
