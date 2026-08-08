// Reference-controller tests keep the score axis independent from the backing axis.
// ============================================================

import { cleanup, render, waitFor } from '@solidjs/testing-library'
import type { Component } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { GuitarNightReferencePort } from './reference-port'
import { openGuitarNightReference } from './reference-port'
import { useGuitarNightReferenceController } from './useGuitarNightReferenceController'

const VELVET_RIFF = {
  id: 'gsong-velvet',
  name: 'Velvet Riff',
  bpm: 96,
  scoreTrackId: 'track-lead',
  importedAt: Date.UTC(2026, 7, 1),
  tracks: [
    {
      id: 'track-lead',
      name: 'Lead guitar',
      noteCount: 1,
      notes: [{ midi: 64, startBeat: 0, duration: 1 }],
    },
    {
      id: 'track-rhythm',
      name: 'Rhythm guitar',
      noteCount: 2,
      notes: [
        { midi: 40, startBeat: 0, duration: 2 },
        { midi: 45, startBeat: 2, duration: 2 },
      ],
    },
  ],
}

function fakePort(overrides: Partial<GuitarNightReferencePort> = {}) {
  const rememberTrack = vi.fn()
  const port: GuitarNightReferencePort = {
    listReferences: () => [
      {
        songId: VELVET_RIFF.id,
        title: VELVET_RIFF.name,
        trackCount: 2,
        importedAt: VELVET_RIFF.importedAt,
      },
    ],
    openReference: (songId, trackId) =>
      songId === VELVET_RIFF.id
        ? openGuitarNightReference(VELVET_RIFF, trackId)
        : { ok: false, code: 'not-found' },
    rememberTrack,
    importReference: vi.fn(async () => ({
      songId: VELVET_RIFF.id,
      title: VELVET_RIFF.name,
      trackCount: 2,
      importedAt: VELVET_RIFF.importedAt,
    })),
    ...overrides,
  }
  return { port, rememberTrack }
}

function mount(port: GuitarNightReferencePort) {
  let controller!: ReturnType<typeof useGuitarNightReferenceController>
  const Harness: Component = () => {
    controller = useGuitarNightReferenceController({
      loadReferencePort: async () => port,
    })
    return null
  }
  render(() => <Harness />)
  return controller
}

describe('useGuitarNightReferenceController', () => {
  afterEach(() => {
    cleanup()
    window.history.replaceState(null, '', '/guitar-night')
  })

  it('attaches a saved score and routes it on the score axis alone', async () => {
    window.history.replaceState(null, '', '/guitar-night?session=session-room')
    const { port, rememberTrack } = fakePort()
    const controller = mount(port)

    await controller.attach(VELVET_RIFF.id)

    expect(controller.reference()?.title).toBe('Velvet Riff')
    expect(controller.reference()?.tempoBpm).toBe(96)
    expect(rememberTrack).toHaveBeenCalledWith(VELVET_RIFF.id, 'track-lead')
    // The backing selection survives untouched next to the new score.
    expect(window.location.search).toBe(
      '?session=session-room&song=gsong-velvet',
    )
  })

  it('switches the visible part without adding history or re-routing', async () => {
    const { port, rememberTrack } = fakePort()
    const controller = mount(port)
    await controller.attach(VELVET_RIFF.id)
    const afterAttach = window.history.length

    await controller.selectTrack('track-rhythm')

    expect(controller.reference()?.trackId).toBe('track-rhythm')
    expect(controller.reference()?.notes).toHaveLength(2)
    expect(rememberTrack).toHaveBeenLastCalledWith(
      VELVET_RIFF.id,
      'track-rhythm',
    )
    expect(window.history.length).toBe(afterAttach)
    expect(window.location.search).toBe('?song=gsong-velvet')
  })

  it('removing the score clears only its own parameter', async () => {
    window.history.replaceState(null, '', '/guitar-night?session=session-room')
    const { port } = fakePort()
    const controller = mount(port)
    await controller.attach(VELVET_RIFF.id)

    controller.detach()

    expect(controller.reference()).toBeNull()
    expect(window.location.search).toBe('?session=session-room')
  })

  it('reports a missing score visibly instead of attaching a different one', async () => {
    const { port } = fakePort()
    const controller = mount(port)

    await controller.attach('gsong-gone')

    expect(controller.reference()).toBeNull()
    expect(controller.state()).toEqual({
      kind: 'unavailable',
      songId: 'gsong-gone',
      reason: 'not-found',
    })
  })

  it('restores the score named in the URL on open', async () => {
    window.history.replaceState(null, '', '/guitar-night?song=gsong-velvet')
    const { port } = fakePort()
    const controller = mount(port)

    await waitFor(() =>
      expect(controller.reference()?.songId).toBe('gsong-velvet'),
    )
  })

  it('surfaces an unreadable file without attaching anything', async () => {
    const { port } = fakePort({
      importReference: vi.fn(async () => {
        throw new Error('This file has no playable tracks to follow.')
      }),
    })
    const controller = mount(port)

    await controller.importFile(new File(['x'], 'broken.mid'))

    expect(controller.importStatus()).toBe(
      'This file has no playable tracks to follow.',
    )
    expect(controller.reference()).toBeNull()
  })

  it('attaches an imported file as soon as it is saved', async () => {
    const { port } = fakePort()
    const controller = mount(port)

    await controller.importFile(new File(['x'], 'velvet.gp5'))

    expect(controller.importStatus()).toBeNull()
    expect(controller.reference()?.songId).toBe('gsong-velvet')
  })
})
