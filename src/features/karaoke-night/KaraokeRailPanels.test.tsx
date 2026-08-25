// ============================================================
// Karaoke Night rail — the library must not reload per song
// ============================================================
//
// The regression: the part-count resource took the library's session-id ARRAY
// as its source. An array literal is a fresh reference every time the source
// re-runs, so Solid's !== check saw a change on every session-store tick and
// refetched a result identical to the one it already held. Staging a song
// ticks that store (hydration, orphan pruning), so every song load re-ran one
// IndexedDB query per library song — and because the counts were read through
// `partCounts()` inside a <Suspense>, the loading resource re-suspended the
// whole rail: library and upload card blank for seconds, then back.
//
// These tests pin both halves: a same-id store tick refetches nothing, and a
// genuinely new id set does not blank what is already on screen.

import { fireEvent, render, waitFor } from '@solidjs/testing-library'
import { createSignal, Suspense } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/** Hoisted so the vi.mock factories can close over it. */
const store = vi.hoisted(() => ({
  readSessions: () => [] as unknown[],
}))

const listStemTypes = vi.hoisted(() => vi.fn())

vi.mock('@/db/services/uvr-service', () => ({ listStemTypes }))
vi.mock('@/components/GroupDeleteConfirmDialog', () => ({
  GroupDeleteConfirmDialog: () => null,
}))
vi.mock('@/components/icons', () => ({
  DeviceSync: () => null,
  Trash2: () => null,
}))
vi.mock('@/features/stem-mixer/karaoke-playlist-runner', () => ({
  ensureSessionHydrated: vi.fn(),
}))
vi.mock('@/stores/karaoke-playlist-store', () => ({
  getPlaylistsReactive: () => [],
  initKaraokePlaylistStore: vi.fn(),
  isPlaylistActive: () => false,
  startPlaylist: vi.fn(),
}))
vi.mock('@/stores/notifications-store', () => ({ showNotification: vi.fn() }))
vi.mock('@/stores/uvr-store', () => ({
  completeUvrSession: vi.fn(),
  deleteGroupWithSessions: vi.fn(),
  getAllUvrSessionsReactive: () => store.readSessions(),
  getGroupsReactive: () => [],
  getUvrSession: vi.fn(),
  initGroupStore: vi.fn(),
  initSessionStore: vi.fn(),
  setErrorUvrSession: vi.fn(),
  setUvrProcessingMode: vi.fn(),
  startUvrSession: vi.fn(),
  // The rail reads the SHARED preference reactively rather than copying it
  // once at mount, so the mock is the accessor, not the getter it replaced.
  uvrProcessingMode: () => 'local',
}))
vi.mock('./demo-song', () => ({ isDemoSessionId: () => false }))
vi.mock('./funnel', () => ({ trackKaraoke: vi.fn() }))

// The real modal drags WebRTC signaling and the bundle machinery in; the
// scanned-code test only needs to see that the door OPENED.
const syncStore = vi.hoisted(() => ({ setSyncCodeToJoin: vi.fn() }))
vi.mock('@/stores/sync-store', () => syncStore)
// The dialog mounts at page scope (KaraokeNightApp → SyncHost); the
// rail only rings the bell, so the mock is the bell.
const syncUi = vi.hoisted(() => ({ openSyncModal: vi.fn() }))
vi.mock('@/stores/sync-ui-store', () => syncUi)
vi.mock('./karaoke-account', () => ({
  credits: () => [],
  refreshCredits: vi.fn(),
  signedIn: () => false,
}))

const { KaraokeRailPanels } = await import('./KaraokeRailPanels')

/** Minimum shape librarySongs() accepts: completed, with outputs. */
function session(sessionId: string, createdAt: number) {
  return {
    sessionId,
    status: 'completed',
    progress: 100,
    createdAt,
    processingMode: 'local',
    originalFile: { name: `${sessionId}.mp3`, size: 1, mimeType: 'audio/mpeg' },
    outputs: { vocal: 'blob:v', instrumental: 'blob:i' },
  }
}

const railProps = {
  onSing: vi.fn(),
  stageBusy: () => false,
  activeSessionId: () => null,
}

beforeEach(() => {
  listStemTypes.mockReset()
  listStemTypes.mockResolvedValue(['vocal', 'instrumental', 'drums'])
})

afterEach(() => {
  store.readSessions = () => []
})

describe('the library survives a song change', () => {
  it('does not re-query stems when the store ticks with the same songs', async () => {
    const [sessions, setSessions] = createSignal<unknown[]>([
      session('uvr-a', 3),
      session('uvr-b', 2),
    ])
    store.readSessions = sessions

    render(() => <KaraokeRailPanels {...railProps} />)
    await waitFor(() => expect(listStemTypes).toHaveBeenCalledTimes(2))

    // What staging a song does to the store: same songs, new array. Before the
    // fix this alone refetched every count and blanked the rail.
    setSessions([session('uvr-a', 3), session('uvr-b', 2)])
    await Promise.resolve()
    await Promise.resolve()

    expect(listStemTypes).toHaveBeenCalledTimes(2)
  })

  it('re-queries only when the set of songs actually changes', async () => {
    const [sessions, setSessions] = createSignal<unknown[]>([
      session('uvr-a', 3),
    ])
    store.readSessions = sessions

    render(() => <KaraokeRailPanels {...railProps} />)
    await waitFor(() => expect(listStemTypes).toHaveBeenCalledTimes(1))

    setSessions([session('uvr-a', 3), session('uvr-new', 4)])
    await waitFor(() => expect(listStemTypes).toHaveBeenCalledTimes(3))
  })

  it('keeps the songs on screen while a new set is counted', async () => {
    const [sessions, setSessions] = createSignal<unknown[]>([
      session('uvr-a', 3),
    ])
    store.readSessions = sessions

    // Rendered inside a <Suspense>, exactly as the page mounts it (lazy()).
    // That boundary is the whole problem: reading a loading resource under it
    // replaces the rail with the fallback, which is why the library vanished.
    const { container } = render(() => (
      <Suspense fallback={<div data-testid="rail-fallback" />}>
        <KaraokeRailPanels {...railProps} />
      </Suspense>
    ))
    // Wait for the FIRST count to settle. On a first load there is nothing to
    // show yet, so suspending there is correct — that is what the rail's new
    // fallback covers. The bug was suspending again afterwards.
    await waitFor(() =>
      expect(container.querySelectorAll('.kn-library-song').length).toBe(1),
    )
    const before = container.querySelectorAll('.kn-library-song').length

    // A count that never settles. Reading .latest must not suspend, so the
    // rows already on screen stay there instead of the rail going blank.
    listStemTypes.mockReturnValue(new Promise(() => {}))
    setSessions([session('uvr-a', 3), session('uvr-new', 4)])
    await Promise.resolve()
    await Promise.resolve()

    expect(container.querySelector('[data-testid="rail-fallback"]')).toBeNull()
    expect(
      container.querySelectorAll('.kn-library-song').length,
    ).toBeGreaterThanOrEqual(before)
  })
})

describe('the door to another device', () => {
  // The point of putting sync in Karaoke Night at all is the phone that has
  // nothing on it yet: it is the device that needs to RECEIVE. Gating the
  // door on already owning songs would hide it from exactly that case, so
  // this pins the placement, not just the presence.
  it('REQ-SKL-008: offers to send or receive even with an empty library', async () => {
    store.readSessions = () => []

    const { container } = render(() => <KaraokeRailPanels {...railProps} />)

    await waitFor(() =>
      expect(
        [...container.querySelectorAll('.kn-btn')].some((b) =>
          /Send or receive/.test(b.textContent ?? ''),
        ),
      ).toBe(true),
    )
    expect(container.querySelectorAll('.kn-library-song').length).toBe(0)
  })

  it('REQ-SKL-009: does not open the sync machinery until the door is pressed', async () => {
    syncUi.openSyncModal.mockClear()
    store.readSessions = () => [session('uvr-a', 3)]

    const { container } = render(() => <KaraokeRailPanels {...railProps} />)
    await waitFor(() => expect(listStemTypes).toHaveBeenCalled())

    // The dialog — and the WebRTC/bundle machinery behind it — sits at
    // page scope behind SyncHost's lazy(); painting the rail must not
    // ask for it, pressing the door is what does.
    expect(syncUi.openSyncModal).not.toHaveBeenCalled()
    const door = [...container.querySelectorAll('.kn-btn')].find((b) =>
      /Send or receive/.test(b.textContent ?? ''),
    )!
    fireEvent.click(door)
    expect(syncUi.openSyncModal).toHaveBeenCalledTimes(1)
  })

  it('REQ-SKL-011: a scanned link opens the door and hands over its code', async () => {
    // The PAGE catches and consumes #/sync:CODE (the rail does not mount
    // at all while collapsed) and hands the code down exactly once; the
    // rail's half of the contract is to take it, stash it for the modal
    // and open the door.
    const take = vi.fn(() => 'ABCD2345')
    syncUi.openSyncModal.mockClear()
    render(() => (
      <KaraokeRailPanels {...railProps} takeScannedSyncCode={take} />
    ))

    await waitFor(() => expect(syncUi.openSyncModal).toHaveBeenCalled())
    expect(take).toHaveBeenCalledTimes(1)
    expect(syncStore.setSyncCodeToJoin).toHaveBeenCalledWith('ABCD2345')
  })

  it('REQ-SKL-011: leaves the door shut when nothing was scanned', async () => {
    syncStore.setSyncCodeToJoin.mockClear()
    syncUi.openSyncModal.mockClear()
    render(() => (
      <KaraokeRailPanels {...railProps} takeScannedSyncCode={() => null} />
    ))

    // Give any stray dynamic import a beat to land before asserting.
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(syncUi.openSyncModal).not.toHaveBeenCalled()
    expect(syncStore.setSyncCodeToJoin).not.toHaveBeenCalled()
  })
})
