// Guitar Night song-controller tests protect stale-load rejection and route-owned lease cleanup.
// ============================================================

import { cleanup, render, waitFor } from '@solidjs/testing-library'
import type { Component } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { GuitarNightBackingLease, GuitarNightOpenBackingResult, GuitarNightSongPort, } from '@/features/guitar-night/song-port'
import { useGuitarNightSongController } from '@/features/guitar-night/useGuitarNightSongController'

function deferred<T>(): {
  promise: Promise<T>
  resolve(value: T): void
} {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((settle) => {
    resolve = settle
  })
  return { promise, resolve }
}

function backingLease(
  sessionId: string,
  release: () => void,
): GuitarNightBackingLease {
  return {
    sessionId,
    title: sessionId,
    stems: [],
    defaultMix: {
      kind: 'mixed-instrumental',
      audible: [],
      muted: [],
    },
    release,
  }
}

describe('useGuitarNightSongController', () => {
  afterEach(() => {
    cleanup()
    window.history.replaceState(null, '', '/guitar-night')
  })

  it('keeps the newer selection and releases a late stale lease', async () => {
    const sessionA = deferred<GuitarNightOpenBackingResult>()
    const sessionB = deferred<GuitarNightOpenBackingResult>()
    const releaseA = vi.fn()
    const releaseB = vi.fn()
    const openSession = vi.fn((sessionId: string) =>
      sessionId === 'session-a' ? sessionA.promise : sessionB.promise,
    )
    const port: GuitarNightSongPort = {
      initialize: vi.fn(async () => undefined),
      completedSongs: () => [],
      openSession,
    }

    let controller!: ReturnType<typeof useGuitarNightSongController>
    const Harness: Component = () => {
      controller = useGuitarNightSongController({
        loadSongPort: async () => port,
      })
      return null
    }
    render(() => <Harness />)

    const openingA = controller.stageSession('session-a', 'none')
    await waitFor(() => expect(openSession).toHaveBeenCalledTimes(1))
    const openingB = controller.stageSession('session-b', 'none')
    await waitFor(() => expect(openSession).toHaveBeenCalledTimes(2))

    sessionB.resolve({
      ok: true,
      lease: backingLease('session-b', releaseB),
    })
    await openingB
    sessionA.resolve({
      ok: true,
      lease: backingLease('session-a', releaseA),
    })
    await openingA

    expect(controller.selectionState()).toMatchObject({
      kind: 'ready',
      lease: { sessionId: 'session-b' },
    })
    expect(releaseA).toHaveBeenCalledTimes(1)
    expect(releaseB).not.toHaveBeenCalled()

    cleanup()
    expect(releaseB).toHaveBeenCalledTimes(1)
  })

  it('follows a deep-linked session without changing history', async () => {
    window.history.replaceState(
      null,
      '',
      '/guitar-night?song=score-4&session=session-a',
    )
    const release = vi.fn()
    const port: GuitarNightSongPort = {
      initialize: vi.fn(async () => undefined),
      completedSongs: () => [],
      openSession: vi.fn(
        async (): Promise<GuitarNightOpenBackingResult> => ({
          ok: true,
          lease: backingLease('session-a', release),
        }),
      ),
    }
    const pushState = vi.spyOn(window.history, 'pushState')

    let controller!: ReturnType<typeof useGuitarNightSongController>
    const Harness: Component = () => {
      controller = useGuitarNightSongController({
        loadSongPort: async () => port,
      })
      return null
    }
    render(() => <Harness />)

    await waitFor(() =>
      expect(controller.selectionState()).toMatchObject({
        kind: 'ready',
        lease: { sessionId: 'session-a' },
      }),
    )
    expect(window.location.search).toBe('?song=score-4&session=session-a')
    expect(pushState).not.toHaveBeenCalled()
    pushState.mockRestore()
  })

  it('follows popstate changes, preserves score state, and releases each prior lease', async () => {
    window.history.replaceState(
      null,
      '',
      '/guitar-night?song=score-4&session=session-a',
    )
    const releases: Array<ReturnType<typeof vi.fn>> = []
    const openSession = vi.fn(async (sessionId: string) => {
      const release = vi.fn()
      releases.push(release)
      return {
        ok: true as const,
        lease: backingLease(sessionId, release),
      }
    })
    const port: GuitarNightSongPort = {
      initialize: vi.fn(async () => undefined),
      completedSongs: () => [],
      openSession,
    }

    let controller!: ReturnType<typeof useGuitarNightSongController>
    const Harness: Component = () => {
      controller = useGuitarNightSongController({
        loadSongPort: async () => port,
      })
      return null
    }
    render(() => <Harness />)
    await waitFor(() =>
      expect(controller.selectionState()).toMatchObject({
        kind: 'ready',
        lease: { sessionId: 'session-a' },
      }),
    )

    await controller.stageSession('session-b', 'push')
    expect(releases[0]).toHaveBeenCalledTimes(1)

    window.history.replaceState(
      null,
      '',
      '/guitar-night?song=score-4&session=session-a',
    )
    window.dispatchEvent(new PopStateEvent('popstate'))
    await waitFor(() => {
      expect(openSession).toHaveBeenCalledTimes(3)
      expect(controller.selectionState()).toMatchObject({
        kind: 'ready',
        lease: { sessionId: 'session-a' },
      })
    })
    expect(releases[1]).toHaveBeenCalledTimes(1)

    window.history.replaceState(null, '', '/guitar-night?song=score-4')
    window.dispatchEvent(new PopStateEvent('popstate'))
    await waitFor(() =>
      expect(controller.selectionState()).toEqual({ kind: 'idle' }),
    )
    expect(releases[2]).toHaveBeenCalledTimes(1)
    expect(window.location.search).toBe('?song=score-4')
  })

  it('turns a synchronous port-loader failure into a retryable library error', async () => {
    let controller!: ReturnType<typeof useGuitarNightSongController>
    const Harness: Component = () => {
      controller = useGuitarNightSongController({
        loadSongPort: () => {
          throw new Error('loader unavailable')
        },
      })
      return null
    }
    render(() => <Harness />)

    controller.initialize()
    await waitFor(() => expect(controller.libraryState()).toBe('error'))
  })

  it('force restages the routed session and swaps its lease (band upgrade path)', async () => {
    const releases: Array<ReturnType<typeof vi.fn>> = []
    const openSession = vi.fn(async (sessionId: string) => {
      const release = vi.fn()
      releases.push(release)
      return { ok: true as const, lease: backingLease(sessionId, release) }
    })
    const port: GuitarNightSongPort = {
      initialize: vi.fn(async () => undefined),
      completedSongs: () => [],
      openSession,
    }
    let controller!: ReturnType<typeof useGuitarNightSongController>
    const Harness: Component = () => {
      controller = useGuitarNightSongController({
        loadSongPort: async () => port,
      })
      return null
    }
    render(() => <Harness />)

    await controller.stageSession('session-a', 'none')
    expect(openSession).toHaveBeenCalledTimes(1)

    // Without force, restaging the ready session is a no-op.
    await controller.stageSession('session-a', 'none')
    expect(openSession).toHaveBeenCalledTimes(1)

    // With force (the full-band upgrade), the same id must reopen: the old
    // two-stem lease is released and the fresh lease becomes the selection.
    await controller.stageSession('session-a', 'none', { force: true })
    expect(openSession).toHaveBeenCalledTimes(2)
    expect(releases[0]).toHaveBeenCalledTimes(1)
    expect(releases[1]).not.toHaveBeenCalled()
    expect(controller.selectionState()).toMatchObject({
      kind: 'ready',
      lease: { sessionId: 'session-a' },
    })
  })

  it('re-staging the routed session never grows history', async () => {
    const port: GuitarNightSongPort = {
      initialize: vi.fn(async () => undefined),
      completedSongs: () => [],
      openSession: vi.fn(
        async (): Promise<GuitarNightOpenBackingResult> => ({
          ok: false,
          code: 'missing-local-audio',
        }),
      ),
    }
    const pushState = vi.spyOn(window.history, 'pushState')
    let controller!: ReturnType<typeof useGuitarNightSongController>
    const Harness: Component = () => {
      controller = useGuitarNightSongController({
        loadSongPort: async () => port,
      })
      return null
    }
    render(() => <Harness />)

    await controller.stageSession('session-a', 'push')
    expect(controller.selectionState()).toMatchObject({
      kind: 'unavailable',
      sessionId: 'session-a',
    })
    // Clicking the unavailable song again retries it but replaces the URL
    // instead of pushing a duplicate entry.
    await controller.stageSession('session-a', 'push')
    await controller.stageSession('session-a', 'push')
    expect(pushState).toHaveBeenCalledTimes(1)
    pushState.mockRestore()
  })

  it('refreshes a mutable prepared-song catalog after separation completes', async () => {
    let catalog: ReturnType<GuitarNightSongPort['completedSongs']> = []
    const initialize = vi.fn(async () => undefined)
    const port: GuitarNightSongPort = {
      initialize,
      completedSongs: () => catalog,
      openSession: vi.fn(
        async (): Promise<GuitarNightOpenBackingResult> => ({
          ok: false,
          code: 'not-found',
        }),
      ),
    }
    let controller!: ReturnType<typeof useGuitarNightSongController>
    const Harness: Component = () => {
      controller = useGuitarNightSongController({
        loadSongPort: async () => port,
      })
      return null
    }
    render(() => <Harness />)

    controller.initialize()
    await waitFor(() => expect(controller.libraryState()).toBe('ready'))
    expect(controller.songs()).toEqual([])

    catalog = [
      {
        sessionId: 'session-new',
        title: 'New Song.wav',
        createdAt: Date.UTC(2026, 7, 6),
      },
    ]

    await expect(controller.refreshLibrary()).resolves.toBe(true)
    expect(controller.songs()).toEqual(catalog)
    expect(initialize).toHaveBeenCalledTimes(2)
  })
})
