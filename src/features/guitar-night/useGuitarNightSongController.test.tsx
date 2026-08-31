// Guitar Night song-route tests keep accepted backing selection stable during local saves.
// ============================================================

import { cleanup, render, waitFor } from '@solidjs/testing-library'
import type { Component } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { acquireLocalSaveNavigationLock } from '@/lib/local-save-navigation-lock'
import type { GuitarNightBackingLease, GuitarNightSongPort } from './song-port'
import { useGuitarNightSongController } from './useGuitarNightSongController'

function lease(sessionId: string): GuitarNightBackingLease {
  return {
    sessionId,
    title: sessionId,
    stems: [{ kind: 'instrumental', url: `blob:${sessionId}`, sizeBytes: 8 }],
    defaultMix: {
      kind: 'mixed-instrumental',
      audible: ['instrumental'],
      muted: [],
    },
    release: vi.fn(),
  }
}

describe('useGuitarNightSongController', () => {
  afterEach(() => {
    cleanup()
    window.history.replaceState(null, '', '/guitar-night')
  })

  it('returns to the accepted backing entry when Back moves during Keep', async () => {
    window.history.replaceState(null, '', '/guitar-night?song=score-kept')
    const openSession = vi.fn<GuitarNightSongPort['openSession']>(
      async (sessionId) => ({ ok: true, lease: lease(sessionId) }),
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
    await controller.stageSession('session-other')
    await controller.stageSession('session-kept')
    expect(controller.selectionState()).toMatchObject({
      kind: 'ready',
      lease: { sessionId: 'session-kept' },
    })

    const visited: string[] = []
    const recordPop = (): void => {
      visited.push(window.location.search)
    }
    window.addEventListener('popstate', recordPop)
    const releaseLock = acquireLocalSaveNavigationLock('guitar route test')

    try {
      window.history.back()
      await waitFor(() =>
        expect(visited).toEqual([
          '?song=score-kept&session=session-other',
          '?song=score-kept&session=session-kept',
        ]),
      )

      expect(controller.selectionState()).toMatchObject({
        kind: 'ready',
        lease: { sessionId: 'session-kept' },
      })
      expect(window.location.search).toBe(
        '?song=score-kept&session=session-kept',
      )
      expect(controller.routeSessionId()).toBe('session-kept')
      expect(openSession).toHaveBeenCalledTimes(2)
    } finally {
      releaseLock()
      window.removeEventListener('popstate', recordPop)
    }

    window.history.back()
    await waitFor(() =>
      expect(controller.selectionState()).toMatchObject({
        kind: 'ready',
        lease: { sessionId: 'session-other' },
      }),
    )
    expect(window.location.search).toBe(
      '?song=score-kept&session=session-other',
    )
    expect(openSession).toHaveBeenCalledTimes(3)
  })
})
