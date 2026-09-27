// ============================================================
// The old Karaoke tab as the native app's studio (plan S8 §11)
// ============================================================
//
// In the native app the Karaoke tab is the room, and this panel is the
// studio a singer reaches from the room's Options ("Manage songs"). What it
// must not carry there: a header row that scrolls sideways, on-device
// separation, CPU and GPU, the credits pill, links that navigate the WebView
// out of the app's one document (audit K4), the group tabs that scroll
// sideways (K5), and a second zen stage: a song chosen to sing goes back to
// the room. The web keeps all of it; UvrPanel.test.tsx pins the web.

import { cleanup, fireEvent, render, screen, waitFor, } from '@solidjs/testing-library'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi, } from 'vitest'
import type * as NativeBuild from '@/lib/native-build'
import type { UvrSession } from '@/stores/app-store'
import type { UvrStudioControls, UvrStudioHosting } from '../uvr-studio-hosting'

vi.mock('@/lib/native-build', async (importOriginal) => ({
  ...(await importOriginal<typeof NativeBuild>()),
  IS_NATIVE_BUILD: true,
}))

const viewport = vi.hoisted(() => ({ narrow: false }))
vi.mock('@/lib/use-viewport', async (importOriginal) => {
  const actual = (await importOriginal()) as object
  return { ...actual, isNarrow: () => viewport.narrow }
})
vi.mock('@/lib/device-tier', async (importOriginal) => {
  const actual = (await importOriginal()) as object
  return { ...actual, isTvDevice: () => false }
})
vi.mock('@/stores/sync-store', () => ({ syncCodeToJoin: () => null }))
vi.mock('@/stores/sync-ui-store', () => ({
  openSyncModal: vi.fn(),
  syncModalOpen: () => false,
}))

/** The playlist runner's song callback, so a test can play a playlist. */
const runner = vi.hoisted(() => ({
  onSong: null as null | ((session: unknown) => void),
}))
vi.mock('@/features/stem-mixer/karaoke-playlist-runner', () => ({
  ensureSessionHydrated: async (session: unknown) => Promise.resolve(session),
  useKaraokePlaylistRunner: (onSong: (session: unknown) => void) => {
    runner.onSong = onSong
  },
}))

const playlists = vi.hoisted(() => ({ stop: vi.fn() }))
vi.mock('@/stores/karaoke-playlist-store', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  stopPlaylist: playlists.stop,
}))

const store = vi.hoisted(() => ({
  sessions: new Map<string, unknown>(),
  groups: [] as { id: string; name: string; sessionIds: string[] }[],
  /** The song the results page is about. */
  current: null as unknown,
}))
vi.mock('@/stores/app-store', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    isSessionStoreReady: () => true,
    getUvrSession: (id: string) => store.sessions.get(id),
    getAllUvrSessions: () => [...store.sessions.values()],
    getAllUvrSessionsReactive: () => [...store.sessions.values()],
    getGroupsReactive: () => store.groups,
    saveAllUvrSessions: () => undefined,
    setCurrentUvrSession: () => undefined,
    currentUvrSession: () => store.current,
  }
})

/** A mounted mixer would be a second zen stage: the thing that must not be. */
const mixers = vi.hoisted(() => ({ mounted: [] as string[] }))
vi.mock('../index', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    StemMixer: (props: { sessionId: string }) => {
      // The stub records at mount on purpose: a mount is the observation.
      // eslint-disable-next-line solid/reactivity
      mixers.mounted.push(props.sessionId)
      return <div data-testid="stem-mixer" />
    },
  }
})

beforeAll(() => {
  class MockWorker {
    onmessage: ((e: MessageEvent) => void) | null = null
    onerror: ((e: ErrorEvent) => void) | null = null
    postMessage = vi.fn()
    terminate = vi.fn()
    addEventListener = vi.fn()
    removeEventListener = vi.fn()
    dispatchEvent = vi.fn()
  }
  vi.stubGlobal('Worker', MockWorker)
})

function song(sessionId: string, groupId?: string): UvrSession {
  return {
    sessionId,
    status: 'completed',
    createdAt: sessionId === 'song-a' ? 2 : 1,
    mode: 'separate',
    progress: 100,
    groupId,
    originalFile: {
      name: `${sessionId}.mp3`,
      size: 1024,
      mimeType: 'audio/mpeg',
    },
    outputs: {
      vocal: `blob:${sessionId}-vocal`,
      instrumental: `blob:${sessionId}-instrumental`,
    },
  } as unknown as UvrSession
}

import { UvrPanel } from '../UvrPanel'

beforeEach(() => {
  viewport.narrow = false
  runner.onSong = null
  playlists.stop.mockClear()
  mixers.mounted = []
  store.sessions.clear()
  store.groups = [{ id: 'g1', name: 'Duets', sessionIds: ['song-a'] }]
  store.sessions.set('song-a', song('song-a', 'g1'))
  store.sessions.set('song-b', song('song-b'))
  store.current = null
  localStorage.clear()
})

afterEach(() => {
  cleanup()
})

function openStudio(
  onSing = vi.fn(),
  onViewChange = vi.fn(),
): {
  container: HTMLElement
  onSing: typeof onSing
  onViewChange: typeof onViewChange
  controls: () => UvrStudioControls
} {
  let attached: UvrStudioControls | null = null
  const studio: UvrStudioHosting = {
    onSing,
    attach: (controls) => {
      attached = controls
    },
  }
  const view = render(() => (
    <UvrPanel
      initialView="upload"
      studio={studio}
      onViewChange={onViewChange}
    />
  ))
  return {
    container: view.container,
    onSing,
    onViewChange,
    controls: () => {
      if (attached === null) throw new Error('the panel attached nothing')
      return attached
    },
  }
}

describe('the studio around the panel', () => {
  for (const narrow of [false, true]) {
    it(`gets no header row from the panel, which the studio draws (${narrow ? 'upright' : 'on its side'})`, () => {
      viewport.narrow = narrow
      const { container } = openStudio()

      expect(container.querySelector('.panel-header')).toBeNull()
      expect(screen.queryByTestId('uvr-tab-sing')).toBeNull()
      expect(screen.queryByTestId('uvr-tab-upload')).toBeNull()
      expect(screen.queryByTestId('uvr-mobile-options')).toBeNull()
    })
  }

  it('is handed the view, and a way to change it', () => {
    const { controls, onViewChange } = openStudio()
    expect(controls().view()).toBe('upload')

    controls().showView('shazam-listen')

    expect(controls().view()).toBe('shazam-listen')
    expect(onViewChange).toHaveBeenLastCalledWith('shazam-listen')
  })

  it('is handed the guide', () => {
    const { controls } = openStudio()

    controls().openGuide()

    expect(screen.getByText('Vocal Separation Guide')).toBeTruthy()
  })

  it('finds nothing that separates on the phone, costs credits or leaves the app', () => {
    viewport.narrow = true
    const { container } = openStudio()

    for (const id of [
      'uvr-mode-server',
      'uvr-device-cpu',
      'uvr-device-gpu',
      'uvr-stems-two',
      'uvr-stems-band',
      'uvr-server-cost-hint',
      'uvr-stage-lead',
    ]) {
      expect(screen.queryByTestId(id), id).toBeNull()
    }
    expect(screen.queryByRole('radio', { name: 'Browser' })).toBeNull()
    expect(document.body.textContent).not.toContain('Karaoke Night')
    expect(
      container.ownerDocument.querySelectorAll('a[href*="karaoke-night"]'),
    ).toHaveLength(0)
  })
})

describe('the studio library', () => {
  it('imports nothing: no upload box, no queue, no ZIP import or export', () => {
    const { container } = openStudio()

    expect(container.querySelectorAll('input[type="file"]')).toHaveLength(0)
    expect(screen.queryByText('Upload Audio')).toBeNull()
    expect(
      screen.queryByTitle('Choose stems and export all sessions to a ZIP file'),
    ).toBeNull()
    expect(
      screen.queryByTitle(
        'Import sessions from ZIP files (multi-select supported)',
      ),
    ).toBeNull()
  })

  it('keeps every song on this phone: no sync, no share link, no download or export', () => {
    // Everything the web's card menu can offer: a hashed song separated in
    // the browser, with its original kept.
    store.sessions.set('song-a', {
      ...song('song-a', 'g1'),
      fileHash: 'hash-a',
      processingMode: 'local',
    } as UvrSession)
    openStudio()

    expect(
      screen.queryByRole('button', {
        name: 'Sync songs with another of your devices',
      }),
    ).toBeNull()
    // One row is left on each song, so each menu is that one button.
    expect(
      screen
        .getAllByTestId('session-more')
        .map((button) => button.getAttribute('aria-label')),
    ).toEqual(['Delete this song', 'Delete this song'])
  })

  it('leaves the groups to the studio: no row of tabs', () => {
    const { container } = openStudio()

    expect(screen.queryByTestId('group-tab-all')).toBeNull()
    expect(container.querySelector('.uvr-groups-inline')).toBeNull()
    // The list itself is still the panel's, filtered by the chosen group.
    expect(
      container.querySelectorAll('.history-list-inline .uvr-session-result'),
    ).toHaveLength(2)
  })

  it('hands a song chosen to sing back to the room', async () => {
    const { onSing } = openStudio()

    fireEvent.click(screen.getAllByTitle('Select Vocal for Mix')[0] as Element)
    fireEvent.click(screen.getByRole('button', { name: /Mix/ }))

    await waitFor(() => expect(onSing).toHaveBeenCalledWith('song-a'))
    expect(mixers.mounted).toEqual([])
  })

  it('hands the song on its results page back to the room when it is played', async () => {
    store.current = store.sessions.get('song-a')
    const onSing = vi.fn()
    const { container } = render(() => (
      <UvrPanel
        initialView="results"
        studio={{ onSing, attach: () => undefined }}
      />
    ))

    const play = container.querySelector<HTMLButtonElement>(
      '.rv-full-mix-card .rv-stem-btn-play',
    )
    expect(play).not.toBeNull()
    fireEvent.click(play as HTMLButtonElement)

    await waitFor(() => expect(onSing).toHaveBeenCalledWith('song-a'))
    expect(mixers.mounted).toEqual([])
  })

  it('hands a mix of the stems chosen on its results page back to the room', async () => {
    store.current = store.sessions.get('song-a')
    const onSing = vi.fn()
    const { container } = render(() => (
      <UvrPanel
        initialView="results"
        studio={{ onSing, attach: () => undefined }}
      />
    ))

    const selects = container.querySelectorAll<HTMLElement>('.rv-stem-select')
    expect(selects.length).toBeGreaterThanOrEqual(2)
    fireEvent.click(selects[0] as HTMLElement)
    fireEvent.click(selects[1] as HTMLElement)
    fireEvent.click(screen.getByRole('button', { name: /Mix these stems/ }))

    await waitFor(() => expect(onSing).toHaveBeenCalledWith('song-a'))
    expect(mixers.mounted).toEqual([])
  })

  it("hands a playlist's song back to the room, and leaves the playlist", () => {
    const { onSing } = openStudio()

    runner.onSong?.(song('song-b'))

    expect(onSing).toHaveBeenCalledWith('song-b')
    expect(playlists.stop).toHaveBeenCalled()
    expect(mixers.mounted).toEqual([])
  })
})
