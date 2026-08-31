// Shared song-controller tests protect lazy Drum staging and same-session lease replacement.
// ============================================================

import { cleanup, render, waitFor } from '@solidjs/testing-library'
import type { Component } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PlayAlongBackingLease, PlayAlongBackingSource, PlayAlongSongPort, PlayAlongSongSourcePort, } from './song-port'
import { usePlayAlongSongController } from './useSongController'

function lease(
  sessionId: string,
  release = vi.fn(),
): PlayAlongBackingLease<'drums'> {
  return {
    sessionId,
    title: sessionId,
    stems: [
      { kind: 'drums', url: `blob:${sessionId}:drums`, sizeBytes: 8 },
      { kind: 'bass', url: `blob:${sessionId}:bass`, sizeBytes: 8 },
    ],
    defaultMix: {
      kind: 'parts',
      audible: ['drums', 'bass'],
      muted: [],
    },
    release,
  }
}

describe('usePlayAlongSongController', () => {
  afterEach(() => cleanup())

  it('stays lazy, then force-restages the same session and releases its lease', async () => {
    const firstRelease = vi.fn()
    const secondRelease = vi.fn()
    const openSession = vi
      .fn<PlayAlongSongPort<'drums'>['openSession']>()
      .mockResolvedValueOnce({ ok: true, lease: lease('groove', firstRelease) })
      .mockResolvedValueOnce({
        ok: true,
        lease: lease('groove', secondRelease),
      })
    const port: PlayAlongSongPort<'drums'> = {
      initialize: vi.fn(async () => undefined),
      completedSongs: () => [],
      openSession,
    }
    const loadSongPort = vi.fn(async () => port)
    let controller!: ReturnType<typeof usePlayAlongSongController<'drums'>>
    const Harness: Component = () => {
      controller = usePlayAlongSongController({ loadSongPort })
      return null
    }
    render(() => <Harness />)

    expect(loadSongPort).not.toHaveBeenCalled()
    await controller.stageSession('groove')
    expect(loadSongPort).toHaveBeenCalledOnce()
    expect(openSession).toHaveBeenCalledOnce()

    await controller.stageSession('groove')
    expect(openSession).toHaveBeenCalledOnce()
    await controller.stageSession('groove', 'replace', { force: true })

    expect(firstRelease).toHaveBeenCalledOnce()
    expect(openSession).toHaveBeenCalledTimes(2)
    expect(controller.selectionState()).toMatchObject({
      kind: 'ready',
      lease: { sessionId: 'groove' },
    })

    cleanup()
    await waitFor(() => expect(secondRelease).toHaveBeenCalledOnce())
  })

  it('stages a metadata-only source without crossing its explicit load boundary', async () => {
    const release = vi.fn()
    const load = vi.fn<PlayAlongBackingSource<'drums'>['load']>()
    const source: PlayAlongBackingSource<'drums'> = {
      sessionId: 'source-groove',
      title: 'Source Groove',
      stemKinds: ['vocal', 'instrumental'],
      plannedMix: {
        kind: 'mixed-instrumental',
        audible: ['vocal', 'instrumental'],
        muted: [],
      },
      durationSeconds: 128,
      source: 'device',
      load,
      release,
    }
    const port: PlayAlongSongSourcePort<'drums'> = {
      initialize: vi.fn(async () => undefined),
      completedSongs: () => [],
      openSession: vi.fn(async () => ({ ok: true as const, lease: source })),
    }
    let controller!: ReturnType<
      typeof usePlayAlongSongController<
        'drums',
        PlayAlongBackingSource<'drums'>
      >
    >
    const Harness: Component = () => {
      controller = usePlayAlongSongController<
        'drums',
        PlayAlongBackingSource<'drums'>
      >({ loadSongPort: async () => port })
      return null
    }
    render(() => <Harness />)

    await controller.stageSession('source-groove')

    expect(controller.selectionState()).toEqual({
      kind: 'ready',
      lease: source,
    })
    expect(load).not.toHaveBeenCalled()
    cleanup()
    await waitFor(() => expect(release).toHaveBeenCalledOnce())
  })

  it('clears route truth and releases the lease when an audio consumer fails to stand down', async () => {
    const release = vi.fn(() => {
      throw new Error('lease cleanup failed')
    })
    const onBackingWillRelease = vi.fn(() => {
      throw new Error('audio consumer failed')
    })
    const port: PlayAlongSongPort<'drums'> = {
      initialize: vi.fn(async () => undefined),
      completedSongs: () => [],
      openSession: vi.fn(async () => ({
        ok: true as const,
        lease: lease('fragile-groove', release),
      })),
    }
    let controller!: ReturnType<typeof usePlayAlongSongController<'drums'>>
    const Harness: Component = () => {
      controller = usePlayAlongSongController({
        loadSongPort: async () => port,
        onBackingWillRelease,
      })
      return null
    }
    render(() => <Harness />)
    await controller.stageSession('fragile-groove')

    expect(() => controller.clearSession('none')).not.toThrow()
    expect(onBackingWillRelease).toHaveBeenCalledOnce()
    expect(release).toHaveBeenCalledOnce()
    expect(controller.routeSessionId()).toBeNull()
    expect(controller.selectionState()).toEqual({ kind: 'idle' })
  })
})
