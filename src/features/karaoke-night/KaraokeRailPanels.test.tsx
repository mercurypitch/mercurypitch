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

import { render, waitFor } from '@solidjs/testing-library'
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
vi.mock('@/components/icons', () => ({ Trash2: () => null }))
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
  getUvrProcessingMode: () => 'local',
  getUvrSession: vi.fn(),
  initGroupStore: vi.fn(),
  initSessionStore: vi.fn(),
  setErrorUvrSession: vi.fn(),
  setUvrProcessingMode: vi.fn(),
  startUvrSession: vi.fn(),
}))
vi.mock('./demo-song', () => ({ isDemoSessionId: () => false }))
vi.mock('./funnel', () => ({ trackKaraoke: vi.fn() }))
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
