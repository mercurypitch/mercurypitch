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

  it('restores the accepted backing route when history moves during Keep', async () => {
    window.history.replaceState(
      null,
      '',
      '/guitar-night?session=session-kept&song=score-kept',
    )
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
    await waitFor(() =>
      expect(controller.selectionState()).toMatchObject({
        kind: 'ready',
        lease: { sessionId: 'session-kept' },
      }),
    )

    const releaseLock = acquireLocalSaveNavigationLock('guitar route test')
    try {
      window.history.replaceState(
        null,
        '',
        '/guitar-night?session=session-other&song=score-other',
      )
      window.dispatchEvent(new PopStateEvent('popstate'))

      expect(window.location.search).toBe(
        '?session=session-kept&song=score-other',
      )
      expect(controller.routeSessionId()).toBe('session-kept')
      expect(openSession).toHaveBeenCalledTimes(1)
    } finally {
      releaseLock()
    }
  })
})
