// ============================================================
// UvrPanel — which song the mixer ends up on when taps overlap
// ============================================================
//
// Two songs tapped in the rail in quick succession, and the slower one's
// hydration lands last. The mixer must be on the song that was tapped last,
// not on whichever pull from IndexedDB happened to finish last — that is the
// "playback is one song behind" report.
//
// The second test is the other half of the same guard: standing an open down
// is only ever the newer *song choice's* business. A Back press or a
// cancelled play-along must not, because the deep-link effect commits the id
// to its dedupe memo before awaiting. An open abandoned by anything else
// would leave that memo naming a session that was never shown, and since the
// route signal does not change when the same row is tapped again, the row
// went dead for the rest of the session.

import { cleanup, fireEvent, render, screen, waitFor, } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { UvrSession } from '@/stores/app-store'

/** Hydration held open per session id, so the order of landing is ours. */
const hydration = vi.hoisted(() => {
  const pending = new Map<string, (session: unknown) => void>()
  return {
    pending,
    settle: (sessionId: string, session: unknown): void => {
      const resolve = pending.get(sessionId)
      pending.delete(sessionId)
      resolve?.(session)
    },
  }
})

vi.mock('@/features/stem-mixer/karaoke-playlist-runner', () => ({
  ensureSessionHydrated: (session: { sessionId: string }) =>
    new Promise((resolve) => {
      hydration.pending.set(session.sessionId, resolve)
    }),
  useKaraokePlaylistRunner: () => undefined,
}))

const store = vi.hoisted(() => ({
  sessions: new Map<string, unknown>(),
}))

vi.mock('@/stores/app-store', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    isSessionStoreReady: () => true,
    getUvrSession: (id: string) => store.sessions.get(id),
    getAllUvrSessions: () => [...store.sessions.values()],
    getAllUvrSessionsReactive: () => [...store.sessions.values()],
    saveAllUvrSessions: () => undefined,
    setCurrentUvrSession: () => undefined,
    currentUvrSession: () => null,
  }
})

// The mixer is the observation point: which session id it mounted with is
// exactly the question. Everything else in the barrel stays real.
const mounted = vi.hoisted(() => ({
  sessionIds: [] as string[],
  back: null as null | (() => void),
}))
vi.mock('../index', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    StemMixer: (props: { sessionId: string; onBack?: () => void }) => {
      // The stub is the observation point, so it records at mount on
      // purpose; the panel remounts it per song, which is the thing under
      // test. Reading the props here is deliberate, not a missed scope.
      // eslint-disable-next-line solid/reactivity
      mounted.sessionIds.push(props.sessionId)
      // eslint-disable-next-line solid/reactivity
      mounted.back = () => props.onBack?.()
      return (
        <div data-testid="stem-mixer" data-session-id={props.sessionId}>
          mixer
        </div>
      )
    },
  }
})

function session(sessionId: string): UvrSession {
  return {
    sessionId,
    status: 'completed',
    fileName: `${sessionId}.mp3`,
    createdAt: 1,
    mode: 'separate',
    progress: 100,
    outputs: {
      vocal: `blob:${sessionId}-vocal`,
      instrumental: `blob:${sessionId}-instrumental`,
    },
  } as unknown as UvrSession
}

import { UvrPanel } from '../UvrPanel'

beforeEach(() => {
  hydration.pending.clear()
  store.sessions.clear()
  mounted.sessionIds = []
  mounted.back = null
  store.sessions.set('song-a', session('song-a'))
  store.sessions.set('song-b', session('song-b'))
})

afterEach(() => {
  cleanup()
})

describe('UvrPanel song selection', () => {
  it('lands on the song tapped last, not the hydration that finished last', async () => {
    const [sessionId, setSessionId] = createSignal<string | undefined>('song-a')
    render(() => (
      <UvrPanel
        initialView="mixer"
        initialSessionId={sessionId()}
        onPracticeStart={vi.fn()}
        onExport={vi.fn()}
        onClose={vi.fn()}
      />
    ))

    await waitFor(() => expect(hydration.pending.has('song-a')).toBe(true))
    setSessionId('song-b')
    await waitFor(() => expect(hydration.pending.has('song-b')).toBe(true))

    // B first, then the slower A: the order that used to leave the mixer a
    // song behind.
    hydration.settle('song-b', session('song-b'))
    await waitFor(() => expect(mounted.sessionIds.length).toBeGreaterThan(0))
    hydration.settle('song-a', session('song-a'))

    await waitFor(() =>
      expect(
        screen.getByTestId('stem-mixer').getAttribute('data-session-id'),
      ).toBe('song-b'),
    )
    expect(mounted.sessionIds.at(-1)).toBe('song-b')
  })

  it('opens a row on its results, even after a mixer deep-link', async () => {
    // `initialView` latches at 'mixer': it is written only by a hash
    // dispatch, and in-app navigation rewrites the URL through replaceState,
    // which fires no hashchange. So one mixer deep-link used to turn every
    // later "View Results" on a row into another mixer for the rest of the
    // session, and the results page became unreachable from the list.
    const [sessionId] = createSignal<string | undefined>('song-a')
    render(() => (
      <UvrPanel
        initialView="mixer"
        initialSessionId={sessionId()}
        onPracticeStart={vi.fn()}
        onExport={vi.fn()}
        onClose={vi.fn()}
      />
    ))

    await waitFor(() => expect(hydration.pending.has('song-a')).toBe(true))
    hydration.settle('song-a', session('song-a'))
    await waitFor(() => expect(screen.getByTestId('stem-mixer')).toBeTruthy())

    // Leave the mixer and go back to the library, where the rows live.
    mounted.back?.()
    fireEvent.click(screen.getByRole('button', { name: 'Upload' }))

    const view = await screen.findAllByRole('button', { name: /View Results/ })
    fireEvent.click(view[0] as HTMLElement)

    await waitFor(() => expect(hydration.pending.size).toBeGreaterThan(0))
    const opened = [...hydration.pending.keys()][0] as string
    hydration.settle(opened, session(opened))
    // Let the open finish before looking, or this passes on the gap.
    await waitFor(() => expect(hydration.pending.size).toBe(0))

    // Results, not another mixer.
    expect(screen.queryByTestId('stem-mixer')).toBeNull()
  })

  it('is stood down by a newer song choice, and by nothing else', async () => {
    const [sessionId, setSessionId] = createSignal<string | undefined>('song-a')
    render(() => (
      <UvrPanel
        initialView="mixer"
        initialSessionId={sessionId()}
        onPracticeStart={vi.fn()}
        onExport={vi.fn()}
        onClose={vi.fn()}
      />
    ))

    await waitFor(() => expect(hydration.pending.has('song-a')).toBe(true))
    hydration.settle('song-a', session('song-a'))
    await waitFor(() => expect(mounted.back).not.toBeNull())

    setSessionId('song-b')
    await waitFor(() => expect(hydration.pending.has('song-b')).toBe(true))

    // Leaving the mixer cancels a pending play-along preparation, which
    // shares the selection counter. It must not also discard the song the
    // rail was asked for: the deep-link memo already names song-b, and the
    // route signal will not change if that row is tapped again.
    mounted.back?.()
    hydration.settle('song-b', session('song-b'))

    await waitFor(() =>
      expect(
        screen.getByTestId('stem-mixer').getAttribute('data-session-id'),
      ).toBe('song-b'),
    )
  })
})
