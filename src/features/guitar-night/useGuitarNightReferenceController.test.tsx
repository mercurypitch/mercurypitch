// Reference-controller tests keep the score axis independent from the backing axis.
// ============================================================

import { cleanup, render, waitFor } from '@solidjs/testing-library'
import type { Component } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { GuitarNightReferencePort, GuitarNightTranscriptionPort, } from './reference-port'
import { openGuitarNightReference, suggestReferenceInstrument, } from './reference-port'
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
    {
      id: 'track-bass',
      name: 'Bass',
      noteCount: 2,
      // Below a guitar's low E, so this part only reads on bass rows.
      notes: [
        { midi: 28, startBeat: 0, duration: 1, stringIndex: 3, fret: 0 },
        { midi: 33, startBeat: 1, duration: 1, stringIndex: 2, fret: 0 },
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
    openReference: (songId, trackId, tuning) =>
      songId === VELVET_RIFF.id
        ? openGuitarNightReference(VELVET_RIFF, trackId, tuning)
        : { ok: false, code: 'not-found' },
    suggestInstrument: (songId, trackId) =>
      songId === VELVET_RIFF.id
        ? suggestReferenceInstrument(VELVET_RIFF, trackId)
        : null,
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

function mountWithTranscription(
  port: GuitarNightReferencePort,
  transcribeStem: GuitarNightTranscriptionPort['transcribeStem'],
) {
  return mountWithTranscriptionLoader(port, async () => ({ transcribeStem }))
}

function mountWithTranscriptionLoader(
  port: GuitarNightReferencePort,
  loadTranscriptionPort: () => Promise<GuitarNightTranscriptionPort>,
) {
  let controller!: ReturnType<typeof useGuitarNightReferenceController>
  const Harness: Component = () => {
    controller = useGuitarNightReferenceController({
      loadReferencePort: async () => port,
      loadTranscriptionPort,
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

  it('follows a measured stem without claiming the score axis', async () => {
    window.history.replaceState(null, '', '/guitar-night?session=session-room')
    const { port } = fakePort()
    const controller = mountWithTranscription(port, async () => ({
      coverage: 0.74,
      analysedSeconds: 90,
      notes: [
        {
          midi: 28,
          noteName: 'E1',
          startSeconds: 0.25,
          durationSeconds: 0.5,
          confidence: 0.8,
        },
      ],
    }))

    await controller.followStem({
      sessionId: 'session-room',
      stemKind: 'bass',
      stemLabel: 'Bass',
      stemUrl: 'blob:bass',
    })

    expect(controller.reference()?.kind).toBe('measured')
    expect(controller.reference()?.coverage).toBe(0.74)
    expect(controller.transcribeProgress()).toBeNull()
    // A measured reference is derived from this recording, so it owns no
    // saved id and must not appear on the score axis.
    expect(window.location.search).toBe('?session=session-room')
  })

  it('says a silent stem produced nothing instead of showing an empty guide', async () => {
    const { port } = fakePort()
    const controller = mountWithTranscription(port, async () => ({
      coverage: 0,
      analysedSeconds: 90,
      notes: [],
    }))

    await controller.followStem({
      sessionId: 'session-room',
      stemKind: 'bass',
      stemLabel: 'Bass',
      stemUrl: 'blob:bass',
    })

    expect(controller.reference()).toBeNull()
    expect(controller.importStatus()).toBe(
      'No clear notes could be read from the bass stem, so the stage stays in free play.',
    )
  })

  it('names a bass part on bass rows instead of guitar strings', async () => {
    const { port } = fakePort()
    const controller = mount(port)
    await controller.attach(VELVET_RIFF.id)
    expect(controller.instrument()).toBe('guitar')

    await controller.selectTrack('track-bass')

    expect(controller.instrument()).toBe('bass')
    expect(controller.stringCount()).toBe(4)
    expect(controller.tuning().labels).toEqual(['G', 'D', 'A', 'E'])
    // Authored bass fingering now describes the rows on screen, so it is kept.
    expect(controller.reference()?.notes[0].stringIndex).toBe(3)
    expect(controller.reference()?.outOfRangeNotes).toBe(0)
  })

  it('adopts an authored tuning and capo until the player changes the setup', async () => {
    const sourceTuning = {
      instrument: 'guitar' as const,
      stringCount: 6,
      openMidi: [64, 59, 55, 50, 45, 38],
      labels: ['e', 'B', 'G', 'D', 'A', 'D'],
      name: 'Drop D',
      capo: 2,
    }
    const openReference = vi.fn((_songId, trackId, tuning) =>
      openGuitarNightReference(VELVET_RIFF, trackId, tuning),
    )
    const { port } = fakePort({
      openReference,
      suggestInstrument: () => ({
        trackId: 'track-lead',
        instrument: 'guitar',
        sourceTuning,
      }),
    })
    const controller = mount(port)

    await controller.attach(VELVET_RIFF.id, 'track-lead')

    expect(controller.tuning()).toBe(sourceTuning)
    expect(openReference).toHaveBeenLastCalledWith(
      VELVET_RIFF.id,
      'track-lead',
      sourceTuning,
    )

    controller.setStringCount(7)
    await waitFor(() => expect(controller.stringCount()).toBe(7))

    expect(controller.tuning()).toMatchObject({
      instrument: 'guitar',
      stringCount: 7,
    })
    expect(controller.tuning().capo).toBeUndefined()
    expect(controller.tuning().name).toBeUndefined()
  })

  it('keeps a deliberate instrument choice while that part stays attached', async () => {
    const { port } = fakePort()
    const controller = mount(port)
    await controller.attach(VELVET_RIFF.id, 'track-bass')
    expect(controller.instrument()).toBe('bass')

    controller.setInstrument('guitar')
    await waitFor(() => expect(controller.instrument()).toBe('guitar'))

    expect(controller.stringCount()).toBe(6)
    // The same part, re-opened: a guitar cannot reach either bass note.
    await waitFor(() => expect(controller.reference()?.outOfRangeNotes).toBe(2))
    expect(controller.reference()?.trackId).toBe('track-bass')
  })

  it('re-places the notes when the string count changes', async () => {
    const { port } = fakePort()
    const controller = mount(port)
    await controller.attach(VELVET_RIFF.id, 'track-bass')

    controller.setStringCount(5)

    await waitFor(() =>
      expect(controller.tuning().labels).toEqual(['G', 'D', 'A', 'E', 'B']),
    )
    expect(controller.reference()?.tuning.stringCount).toBe(5)
    expect(controller.reference()?.outOfRangeNotes).toBe(0)
  })

  it('measures a bass stem onto bass rows at the pitch it was heard', async () => {
    const { port } = fakePort()
    const controller = mountWithTranscription(port, async () => ({
      coverage: 0.74,
      analysedSeconds: 90,
      notes: [
        {
          midi: 28,
          noteName: 'E1',
          startSeconds: 0.25,
          durationSeconds: 0.5,
          confidence: 0.8,
        },
      ],
    }))

    await controller.followStem({
      sessionId: 'session-room',
      stemKind: 'bass',
      stemLabel: 'Bass',
      stemUrl: 'blob:bass',
    })

    expect(controller.instrument()).toBe('bass')
    expect(controller.reference()?.notes[0].midi).toBe(28)
    expect(controller.reference()?.liftedOctaves).toBe(false)

    // Re-placing onto a guitar must not re-read the audio.
    controller.setInstrument('guitar')
    await waitFor(() => expect(controller.reference()?.notes[0].midi).toBe(40))
    expect(controller.reference()?.kind).toBe('measured')
  })

  it('attaching an authored score stops an in-flight measurement', async () => {
    const { port } = fakePort()
    const observed: { signal?: AbortSignal } = {}
    const controller = mountWithTranscription(port, async (_url, options) => {
      observed.signal = options.signal
      await new Promise((resolve) => setTimeout(resolve, 30))
      return { coverage: 1, analysedSeconds: 1, notes: [] }
    })

    const pending = controller.followStem({
      sessionId: 'session-room',
      stemKind: 'bass',
      stemLabel: 'Bass',
      stemUrl: 'blob:bass',
    })
    await Promise.resolve()
    await controller.attach(VELVET_RIFF.id)
    await pending

    expect(observed.signal?.aborted).toBe(true)
    expect(controller.reference()?.kind).toBe('authored')
  })

  it('ignores a stale note-reader load failure after another score attaches', async () => {
    const { port } = fakePort()
    const loading = Promise.withResolvers<GuitarNightTranscriptionPort>()
    const controller = mountWithTranscriptionLoader(port, () => loading.promise)

    const pending = controller.followStem({
      sessionId: 'session-room',
      stemKind: 'bass',
      stemLabel: 'Bass',
      stemUrl: 'blob:bass',
    })
    await Promise.resolve()
    await controller.attach(VELVET_RIFF.id)
    loading.reject(new Error('The old note reader failed.'))
    await pending

    expect(controller.reference()?.kind).toBe('authored')
    expect(controller.importStatus()).toBeNull()
  })

  it('does not let a cancelled run clear the next run progress', async () => {
    const { port } = fakePort()
    const first = Promise.withResolvers<{
      coverage: number
      analysedSeconds: number
      notes: []
    }>()
    const second = Promise.withResolvers<{
      coverage: number
      analysedSeconds: number
      notes: []
    }>()
    const transcribeStem = vi
      .fn()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise)
    const controller = mountWithTranscription(port, transcribeStem)
    const input = {
      sessionId: 'session-room',
      stemKind: 'bass' as const,
      stemLabel: 'Bass',
      stemUrl: 'blob:bass',
    }

    const firstRun = controller.followStem(input)
    await waitFor(() => expect(transcribeStem).toHaveBeenCalledTimes(1))
    controller.cancelFollowStem()
    const secondRun = controller.followStem(input)
    await waitFor(() => expect(transcribeStem).toHaveBeenCalledTimes(2))

    first.resolve({ coverage: 0, analysedSeconds: 1, notes: [] })
    await firstRun

    expect(controller.transcribeProgress()).toBe(0)

    second.resolve({ coverage: 0, analysedSeconds: 1, notes: [] })
    await secondRun
    expect(controller.transcribeProgress()).toBeNull()
  })
})
