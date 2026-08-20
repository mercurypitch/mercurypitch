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
    readSource: (songId) => (songId === VELVET_RIFF.id ? VELVET_RIFF : null),
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

  it('keeps the newest file import in charge when an older parser finishes late', async () => {
    const first = Promise.withResolvers<{
      songId: string
      title: string
      trackCount: number
      importedAt: number
    }>()
    const second = Promise.withResolvers<{
      songId: string
      title: string
      trackCount: number
      importedAt: number
    }>()
    const openReference = vi.fn((_songId, trackId, tuning) =>
      openGuitarNightReference(VELVET_RIFF, trackId, tuning),
    )
    const importReference = vi
      .fn<GuitarNightReferencePort['importReference']>()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise)
    const { port } = fakePort({
      openReference,
      importReference,
    })
    const controller = mount(port)

    const olderImport = controller.importFile(new File(['x'], 'older.gp5'))
    await waitFor(() =>
      expect(controller.importPendingFileName()).toBe('older.gp5'),
    )
    await waitFor(() => expect(importReference).toHaveBeenCalledTimes(1))
    const newerImport = controller.importFile(new File(['x'], 'newer.mid'))
    expect(controller.importPendingFileName()).toBe('newer.mid')
    await waitFor(() => expect(importReference).toHaveBeenCalledTimes(2))

    second.resolve({
      songId: VELVET_RIFF.id,
      title: VELVET_RIFF.name,
      trackCount: 2,
      importedAt: VELVET_RIFF.importedAt,
    })
    await newerImport
    expect(controller.reference()?.songId).toBe(VELVET_RIFF.id)
    expect(controller.importPendingFileName()).toBeNull()

    first.resolve({
      songId: VELVET_RIFF.id,
      title: VELVET_RIFF.name,
      trackCount: 2,
      importedAt: VELVET_RIFF.importedAt,
    })
    await olderImport
    expect(openReference).toHaveBeenCalledTimes(1)
  })

  it('keeps a newer stem transcription in charge when an older import finishes late', async () => {
    const importResult = Promise.withResolvers<{
      songId: string
      title: string
      trackCount: number
      importedAt: number
    }>()
    const openReference = vi.fn((_songId, trackId, tuning) =>
      openGuitarNightReference(VELVET_RIFF, trackId, tuning),
    )
    const { port } = fakePort({
      openReference,
      importReference: vi.fn(() => importResult.promise),
    })
    const controller = mountWithTranscription(port, async () => ({
      coverage: 0.82,
      analysedSeconds: 4,
      notes: [
        {
          midi: 28,
          noteName: 'E1',
          startSeconds: 0,
          durationSeconds: 0.5,
          confidence: 0.9,
        },
      ],
    }))

    const olderImport = controller.importFile(new File(['x'], 'older.gp5'))
    await waitFor(() =>
      expect(controller.importPendingFileName()).toBe('older.gp5'),
    )
    await controller.followStem({
      sessionId: 'session-room',
      stemKind: 'bass',
      stemLabel: 'Bass',
      stemUrl: 'blob:bass',
    })
    expect(controller.reference()?.kind).toBe('measured')

    importResult.resolve({
      songId: VELVET_RIFF.id,
      title: VELVET_RIFF.name,
      trackCount: 2,
      importedAt: VELVET_RIFF.importedAt,
    })
    await olderImport

    expect(controller.reference()?.kind).toBe('measured')
    expect(openReference).not.toHaveBeenCalled()
    expect(controller.importPendingFileName()).toBeNull()
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

  it('names the stem it is reading, so two offers cannot share one progress', async () => {
    // With only bass on offer, `transcribeProgress` alone was enough to drive
    // the surface. Guitar is offered alongside it now, and a lone progress
    // number would make both buttons claim to be running.
    // Declared with a body rather than as `| null`: control-flow analysis does
    // not see the executor's assignment, so a nullable would narrow to `null`
    // and refuse the call below.
    let release: () => void = () => undefined
    const held = new Promise<void>((resolve) => {
      release = resolve
    })
    const { port } = fakePort()
    const controller = mountWithTranscription(port, async () => {
      await held
      return {
        coverage: 0.6,
        analysedSeconds: 30,
        notes: [
          {
            midi: 52,
            noteName: 'E3',
            startSeconds: 0,
            durationSeconds: 0.5,
            confidence: 0.8,
          },
        ],
      }
    })

    expect(controller.transcribingStem()).toBeNull()
    const running = controller.followStem({
      sessionId: 'session-room',
      stemKind: 'guitar',
      stemLabel: 'Guitar',
      stemUrl: 'blob:guitar',
    })
    await waitFor(() =>
      expect(controller.transcribingStem()).toEqual({
        sessionId: 'session-room',
        stemKind: 'guitar',
      }),
    )

    release()
    await running
    expect(controller.transcribingStem()).toBeNull()
  })

  it('forgets the stem it was reading when the reading is cancelled', async () => {
    const { port } = fakePort()
    const controller = mountWithTranscription(
      port,
      () => new Promise(() => undefined),
    )

    void controller.followStem({
      sessionId: 'session-room',
      stemKind: 'guitar',
      stemLabel: 'Guitar',
      stemUrl: 'blob:guitar',
    })
    await waitFor(() =>
      expect(controller.transcribingStem()?.stemKind).toBe('guitar'),
    )

    controller.cancelFollowStem()
    expect(controller.transcribingStem()).toBeNull()
    expect(controller.transcribeProgress()).toBeNull()
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

  it('keeps a deliberate tuner preset and re-places the visible score', async () => {
    const { port } = fakePort()
    const controller = mount(port)
    await controller.attach(VELVET_RIFF.id, 'track-rhythm')

    controller.setTuning({
      instrument: 'guitar',
      stringCount: 6,
      openMidi: [64, 59, 55, 50, 45, 38],
      labels: ['e', 'B', 'G', 'D', 'A', 'D'],
      name: 'Drop D',
    })

    await waitFor(() => expect(controller.tuning().name).toBe('Drop D'))
    expect(controller.tuning().openMidi).toEqual([64, 59, 55, 50, 45, 38])
    expect(controller.reference()?.tuning.name).toBe('Drop D')
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

  describe('the sheet', () => {
    it('stacks every part of the attached score in its written order', async () => {
      const { port } = fakePort()
      const controller = mount(port)

      await controller.attach(VELVET_RIFF.id, 'track-rhythm')

      expect(controller.sheetLanes().map((lane) => lane.trackId)).toEqual([
        'track-lead',
        'track-rhythm',
        'track-bass',
      ])
      expect(controller.sheetVisibleTrackIds()).toEqual([
        'track-lead',
        'track-rhythm',
        'track-bass',
      ])
    })

    it('takes its bar lines from the score that carried them', async () => {
      const inThree = {
        ...VELVET_RIFF,
        timeSignatures: [{ beat: 0, numerator: 3, denominator: 4 }],
      }
      const { port } = fakePort({ readSource: () => inThree })
      const controller = mount(port)

      await controller.attach(VELVET_RIFF.id, 'track-rhythm')

      expect(controller.sheetTimeSignatures()).toEqual([
        { beat: 0, numerator: 3, denominator: 4 },
      ])
    })

    it('has no bar lines to offer for a score that carried none', async () => {
      const { port } = fakePort()
      const controller = mount(port)

      await controller.attach(VELVET_RIFF.id, 'track-rhythm')

      expect(controller.sheetTimeSignatures()).toBeUndefined()
    })

    it('has nothing to draw before a score is attached', () => {
      const { port } = fakePort()
      const controller = mount(port)
      expect(controller.sheetLanes()).toEqual([])
      expect(controller.sheetVisibleTrackIds()).toEqual([])
    })

    it('takes a part off the sheet, and puts it back', async () => {
      const { port } = fakePort()
      const controller = mount(port)
      await controller.attach(VELVET_RIFF.id)

      controller.toggleSheetTrack('track-bass')
      expect(controller.sheetLanes().map((lane) => lane.trackId)).toEqual([
        'track-lead',
        'track-rhythm',
      ])
      expect(controller.sheetVisibleTrackIds()).not.toContain('track-bass')

      controller.toggleSheetTrack('track-bass')
      expect(controller.sheetVisibleTrackIds()).toContain('track-bass')
    })

    it('will not take the scored part off the sheet', async () => {
      const { port } = fakePort()
      const controller = mount(port)
      await controller.attach(VELVET_RIFF.id)

      controller.toggleSheetTrack('track-lead')
      expect(controller.sheetLanes().map((lane) => lane.trackId)).toContain(
        'track-lead',
      )
    })

    it('keeps a hidden part hidden when the scored part changes', async () => {
      const { port } = fakePort()
      const controller = mount(port)
      await controller.attach(VELVET_RIFF.id)
      controller.toggleSheetTrack('track-bass')

      await controller.selectTrack('track-rhythm')

      expect(controller.sheetLanes().map((lane) => lane.trackId)).toEqual([
        'track-lead',
        'track-rhythm',
      ])
    })

    it('shows a part again once the reader is scored on it', async () => {
      const { port } = fakePort()
      const controller = mount(port)
      await controller.attach(VELVET_RIFF.id)
      controller.toggleSheetTrack('track-bass')

      await controller.selectTrack('track-bass')

      expect(controller.sheetLanes().map((lane) => lane.trackId)).toContain(
        'track-bass',
      )
    })

    it('draws each part on the neck its own notes need', async () => {
      const { port } = fakePort()
      const controller = mount(port)
      await controller.attach(VELVET_RIFF.id)

      const bass = controller
        .sheetLanes()
        .find((lane) => lane.trackId === 'track-bass')
      expect(bass?.instrument).toBe('bass')
      expect(bass?.tuning.stringCount).toBe(4)
    })

    it('reads a stem line as a sheet of one part, on its own clock', async () => {
      const { port } = fakePort()
      const controller = mountWithTranscription(port, async () => ({
        notes: [
          {
            midi: 45,
            noteName: 'A2',
            startSeconds: 0,
            durationSeconds: 0.5,
            confidence: 0.9,
          },
        ],
        coverage: 0.8,
        analysedSeconds: 1,
      }))

      await controller.followStem({
        sessionId: 'session-1',
        stemKind: 'bass',
        stemLabel: 'Bass',
        stemUrl: 'blob:stem',
      })

      const lanes = controller.sheetLanes()
      expect(lanes).toHaveLength(1)
      expect(lanes[0]?.kind).toBe('measured')
      expect(controller.sheetVisibleTrackIds()).toEqual(['bass'])
    })
  })

  describe('the rest of the band', () => {
    it('plays every part but the one being scored', async () => {
      const { port } = fakePort()
      const controller = mount(port)
      await controller.attach(VELVET_RIFF.id, 'track-lead')

      expect(controller.backingPartList().map((part) => part.trackId)).toEqual([
        'track-rhythm',
        'track-bass',
      ])
      expect(controller.audibleBackingTrackIds()).toEqual([
        'track-rhythm',
        'track-bass',
      ])
      expect(controller.backingMelodyNotes().length).toBeGreaterThan(0)
      expect(
        controller.backingMelodyNotes().every((note) => note.midi !== 64),
      ).toBe(true)
    })

    it('hands the scored part to the player when a band can cover it', async () => {
      const { port } = fakePort()
      const controller = mount(port)
      await controller.attach(VELVET_RIFF.id, 'track-lead')
      expect(controller.scoredPartDefaultsAudible()).toBe(false)
    })

    it('mutes a part, and brings it back', async () => {
      const { port } = fakePort()
      const controller = mount(port)
      await controller.attach(VELVET_RIFF.id, 'track-lead')
      const before = controller.backingMelodyNotes().length

      controller.toggleBackingTrack('track-bass')
      expect(controller.audibleBackingTrackIds()).toEqual(['track-rhythm'])
      expect(controller.backingMelodyNotes().length).toBeLessThan(before)

      controller.toggleBackingTrack('track-bass')
      expect(controller.audibleBackingTrackIds()).toContain('track-bass')
      expect(controller.backingMelodyNotes()).toHaveLength(before)
    })

    it('will not mute the scored part from here', async () => {
      const { port } = fakePort()
      const controller = mount(port)
      await controller.attach(VELVET_RIFF.id, 'track-lead')

      controller.toggleBackingTrack('track-lead')
      expect(controller.audibleBackingTrackIds()).toEqual([
        'track-rhythm',
        'track-bass',
      ])
    })

    it('rebuilds the band when the scored part changes', async () => {
      const { port } = fakePort()
      const controller = mount(port)
      await controller.attach(VELVET_RIFF.id, 'track-lead')
      await controller.selectTrack('track-bass')

      expect(controller.backingPartList().map((part) => part.trackId)).toEqual([
        'track-lead',
        'track-rhythm',
      ])
    })

    it('has no band before a score is attached', () => {
      const { port } = fakePort()
      const controller = mount(port)
      expect(controller.backingPartList()).toEqual([])
      expect(controller.backingMelodyNotes()).toEqual([])
      expect(controller.scoredPartDefaultsAudible()).toBe(true)
    })
  })

  describe('the part in the corner', () => {
    it('offers the first other part before any swap', async () => {
      const { port } = fakePort()
      const controller = mount(port)
      await controller.attach(VELVET_RIFF.id, 'track-lead')
      expect(controller.secondaryLane()?.trackId).toBe('track-rhythm')
    })

    it('offers the way back to the part just left', async () => {
      const { port } = fakePort()
      const controller = mount(port)
      await controller.attach(VELVET_RIFF.id, 'track-lead')

      await controller.selectTrack('track-bass')
      expect(controller.secondaryLane()?.trackId).toBe('track-lead')

      // Tapping it again is the swap back.
      await controller.selectTrack('track-lead')
      expect(controller.secondaryLane()?.trackId).toBe('track-bass')
    })

    it('has no corner part for a file with one part', async () => {
      const single = {
        ...VELVET_RIFF,
        tracks: [VELVET_RIFF.tracks[0]!],
      }
      const { port } = fakePort({
        openReference: (_songId, trackId, tuning) =>
          openGuitarNightReference(single, trackId, tuning),
        suggestInstrument: (_songId, trackId) =>
          suggestReferenceInstrument(single, trackId),
        readSource: () => single,
      })
      const controller = mount(port)
      await controller.attach(VELVET_RIFF.id)
      expect(controller.secondaryLane()).toBeNull()
    })

    it('has no corner part before a score is attached', () => {
      const { port } = fakePort()
      const controller = mount(port)
      expect(controller.secondaryLane()).toBeNull()
    })

    it('leaves the corner alone when a part is hidden from the sheet', async () => {
      const { port } = fakePort()
      const controller = mount(port)
      await controller.attach(VELVET_RIFF.id, 'track-lead')
      controller.toggleSheetTrack('track-rhythm')
      // Hidden on the page means hidden in the corner too: the corner draws
      // what the sheet draws.
      expect(controller.secondaryLane()?.trackId).toBe('track-bass')
    })
  })

  describe('reading a written score on the recording', () => {
    const RECORDED = {
      id: 'gsong-recorded',
      name: 'Recorded Riff',
      bpm: 60,
      scoreTrackId: 'track-bass',
      importedAt: Date.UTC(2026, 7, 2),
      tracks: [
        {
          id: 'track-bass',
          name: 'Bass',
          instrumentName: 'Electric Bass',
          noteCount: 30,
          notes: Array.from({ length: 30 }, (_, index) => ({
            midi: 40 + (index % 5),
            startBeat: index,
            duration: 1,
          })),
        },
      ],
    }

    /** The same line, heard a second and a half into the recording. */
    const heardIt = async () => ({
      coverage: 0.8,
      analysedSeconds: 32,
      notes: Array.from({ length: 30 }, (_, index) => ({
        midi: 40 + (index % 5),
        noteName: 'E1',
        startSeconds: index + 1.5,
        durationSeconds: 0.5,
        confidence: 0.9,
      })),
    })

    const recordedPort = (): GuitarNightReferencePort => {
      const { port } = fakePort({
        listReferences: () => [
          {
            songId: RECORDED.id,
            title: RECORDED.name,
            trackCount: 1,
            importedAt: RECORDED.importedAt,
          },
        ],
        readSource: (songId) => (songId === RECORDED.id ? RECORDED : null),
      })
      return port
    }

    const measure = async (controller: ReturnType<typeof mount>) => {
      await controller.followStem({
        sessionId: 'session-recorded',
        stemKind: 'bass',
        stemLabel: 'Bass',
        stemUrl: 'blob:bass',
      })
    }

    it('offers nothing to hang until a stem has been measured', () => {
      const controller = mountWithTranscription(recordedPort(), heardIt)
      expect(controller.alignableScores()).toEqual([])
    })

    it('offers the library once there is a recording to read on', async () => {
      const controller = mountWithTranscription(recordedPort(), heardIt)
      await measure(controller)
      await waitFor(() =>
        expect(
          controller.alignableScores().map((entry) => entry.songId),
        ).toEqual([RECORDED.id]),
      )
    })

    it('puts the written part where the recording plays it', async () => {
      const controller = mountWithTranscription(recordedPort(), heardIt)
      await measure(controller)
      await controller.readScoreOnRecording(RECORDED.id)

      const reference = controller.reference()
      expect(reference?.kind).toBe('measured')
      expect(reference?.title).toBe('Recorded Riff on this bass')
      // Written beat zero is heard a second and a half in, and that is where
      // it now sits. Held on the score's own clock it would sit at zero.
      expect(reference?.notes[0].startBeat).toBeCloseTo(1.5, 1)
      expect(controller.alignStatus()).toBeNull()
      expect(controller.readingOnRecording()).toMatchObject({
        songId: RECORDED.id,
        trackId: 'track-bass',
      })
    })

    it('says so rather than guessing when the score is of another song', async () => {
      const controller = mountWithTranscription(recordedPort(), async () => ({
        coverage: 0.8,
        analysedSeconds: 32,
        notes: Array.from({ length: 30 }, (_, index) => ({
          midi: 70 + (index % 3),
          noteName: 'A#4',
          startSeconds: index * 0.37 + 0.11,
          durationSeconds: 0.2,
          confidence: 0.9,
        })),
      }))
      await measure(controller)
      await controller.readScoreOnRecording(RECORDED.id)

      expect(controller.alignStatus()).toContain('Too little')
      expect(controller.readingOnRecording()).toBeNull()
      expect(controller.reference()?.title).toContain('transcribed')
    })

    it('says so when the score has left the library', async () => {
      const controller = mountWithTranscription(recordedPort(), heardIt)
      await measure(controller)
      await controller.readScoreOnRecording('gsong-gone')
      expect(controller.alignStatus()).toContain('no longer in the library')
    })

    it('asks for a measurement before it will hang anything', async () => {
      const controller = mountWithTranscription(recordedPort(), heardIt)
      await controller.readScoreOnRecording(RECORDED.id)
      expect(controller.alignStatus()).toContain('Measure a stem first')
    })

    it('goes back to the line the transcriber heard', async () => {
      const controller = mountWithTranscription(recordedPort(), heardIt)
      await measure(controller)
      await controller.readScoreOnRecording(RECORDED.id)
      controller.stopReadingOnRecording()

      expect(controller.readingOnRecording()).toBeNull()
      expect(controller.reference()?.title).toContain('transcribed')
    })

    it('has nothing to go back to before anything was measured', () => {
      const controller = mountWithTranscription(recordedPort(), heardIt)
      controller.stopReadingOnRecording()
      expect(controller.reference()).toBeNull()
    })

    it('keeps the written part when the instrument changes', async () => {
      const transcribe = vi.fn(heardIt)
      const controller = mountWithTranscription(recordedPort(), transcribe)
      await measure(controller)
      await controller.readScoreOnRecording(RECORDED.id)

      controller.setStringCount(6)
      expect(controller.reference()?.title).toBe('Recorded Riff on this bass')
      // Changing neck must never re-read the audio.
      expect(transcribe).toHaveBeenCalledTimes(1)
    })

    it('forgets the written part when the reference is cleared', async () => {
      const controller = mountWithTranscription(recordedPort(), heardIt)
      await measure(controller)
      await controller.readScoreOnRecording(RECORDED.id)
      controller.detach()

      expect(controller.readingOnRecording()).toBeNull()
      expect(controller.alignableScores()).toEqual([])
    })
  })

  describe('placing a written part by hand', () => {
    const BY_HAND = {
      id: 'gsong-hand',
      name: 'Hand Riff',
      bpm: 60,
      scoreTrackId: 'track-bass',
      importedAt: Date.UTC(2026, 7, 3),
      tracks: [
        {
          id: 'track-bass',
          name: 'Bass',
          instrumentName: 'Electric Bass',
          noteCount: 41,
          // Forty seconds of written music at 60 BPM.
          notes: Array.from({ length: 41 }, (_, index) => ({
            midi: 40 + (index % 5),
            startBeat: index,
            duration: 1,
          })),
        },
      ],
    }

    /** A recording nothing could be measured from: the stem is silent. */
    const heardNothing = async () => ({
      coverage: 0.1,
      analysedSeconds: 44,
      notes: [
        {
          midi: 40,
          noteName: 'E1',
          startSeconds: 2,
          durationSeconds: 0.5,
          confidence: 0.9,
        },
      ],
    })

    const handPort = (): GuitarNightReferencePort => {
      const { port } = fakePort({
        listReferences: () => [
          {
            songId: BY_HAND.id,
            title: BY_HAND.name,
            trackCount: 1,
            importedAt: BY_HAND.importedAt,
          },
        ],
        readSource: (songId) => (songId === BY_HAND.id ? BY_HAND : null),
        openReference: (songId, trackId, tuning) =>
          songId === BY_HAND.id
            ? openGuitarNightReference(BY_HAND, trackId, tuning)
            : { ok: false, code: 'not-found' },
        suggestInstrument: (songId, trackId) =>
          songId === BY_HAND.id
            ? suggestReferenceInstrument(BY_HAND, trackId)
            : null,
      })
      return port
    }

    const measure = async (controller: ReturnType<typeof mount>) => {
      await controller.followStem({
        sessionId: 'session-hand',
        stemKind: 'bass',
        stemLabel: 'Bass',
        stemUrl: 'blob:bass',
      })
    }

    it('claims a part without moving anything until it is told where', async () => {
      const controller = mountWithTranscription(handPort(), heardNothing)
      await measure(controller)
      await controller.placeScoreByHand(BY_HAND.id)

      expect(controller.handPlacement()).toEqual({
        songId: BY_HAND.id,
        trackId: 'track-bass',
        trackName: 'Bass',
        marks: {},
      })
      // Nobody has said where it goes, so nothing has been placed.
      expect(controller.readingOnRecording()).toBeNull()
      expect(controller.reference()?.title).toContain('transcribed')
    })

    it('shifts the part the moment its first note is marked', async () => {
      const controller = mountWithTranscription(handPort(), heardNothing)
      await measure(controller)
      await controller.placeScoreByHand(BY_HAND.id)
      controller.markScoreOnRecording('first', 3)

      const reading = controller.readingOnRecording()
      expect(reading?.placedBy).toBe('hand')
      // A hand placement carries no measured share at all, rather than a zero.
      expect(reading).not.toHaveProperty('matchedFraction')
      expect(controller.reference()?.notes[0].startBeat).toBeCloseTo(3, 6)
    })

    it('fixes the rate too once both ends are marked', async () => {
      const controller = mountWithTranscription(handPort(), heardNothing)
      await measure(controller)
      await controller.placeScoreByHand(BY_HAND.id)
      controller.markScoreOnRecording('first', 2)
      // Forty written seconds take forty-four in this recording.
      controller.markScoreOnRecording('last', 46)

      const notes = controller.reference()?.notes ?? []
      expect(notes[0].startBeat).toBeCloseTo(2, 6)
      expect(notes[notes.length - 1].startBeat).toBeCloseTo(46, 6)
      expect(controller.readingOnRecording()?.driftSeconds).toBeCloseTo(4, 6)
    })

    it('ignores a mark before a part has been claimed', async () => {
      const controller = mountWithTranscription(handPort(), heardNothing)
      await measure(controller)
      controller.markScoreOnRecording('first', 3)
      expect(controller.readingOnRecording()).toBeNull()
    })

    it('says so when the part has nothing to place', async () => {
      const empty = {
        ...BY_HAND,
        tracks: [{ ...BY_HAND.tracks[0], notes: [] }],
      }
      const { port } = fakePort({ readSource: () => empty })
      const controller = mountWithTranscription(port, heardNothing)
      await measure(controller)
      await controller.placeScoreByHand(BY_HAND.id)

      expect(controller.alignStatus()).toContain('no notes to place')
      expect(controller.handPlacement()).toBeNull()
    })

    it('says so when the score has left the library', async () => {
      const controller = mountWithTranscription(handPort(), heardNothing)
      await measure(controller)
      await controller.placeScoreByHand('gsong-gone')
      expect(controller.alignStatus()).toContain('no longer in the library')
    })

    it('forgets the marks and the tab they placed', async () => {
      const controller = mountWithTranscription(handPort(), heardNothing)
      await measure(controller)
      await controller.placeScoreByHand(BY_HAND.id)
      controller.markScoreOnRecording('first', 3)
      controller.clearHandPlacement()

      expect(controller.handPlacement()?.marks).toEqual({})
      expect(controller.readingOnRecording()).toBeNull()
      expect(controller.reference()?.title).toContain('transcribed')
    })

    it('has nothing to forget before a part was claimed', async () => {
      const controller = mountWithTranscription(handPort(), heardNothing)
      await measure(controller)
      controller.clearHandPlacement()
      expect(controller.handPlacement()).toBeNull()
    })

    it('slides a placed part along the recording', async () => {
      const controller = mountWithTranscription(handPort(), heardNothing)
      await measure(controller)
      await controller.placeScoreByHand(BY_HAND.id)
      controller.markScoreOnRecording('first', 3)
      controller.nudgeScoreOnRecording(0.5)

      expect(controller.reference()?.notes[0].startBeat).toBeCloseTo(3.5, 6)
    })

    it('keeps a measured drift through a nudge, and owns the result', async () => {
      const controller = mountWithTranscription(handPort(), heardNothing)
      await measure(controller)
      await controller.placeScoreByHand(BY_HAND.id)
      controller.markScoreOnRecording('first', 2)
      controller.markScoreOnRecording('last', 46)
      const driftBefore = controller.readingOnRecording()?.driftSeconds
      controller.nudgeScoreOnRecording(-0.3)

      expect(controller.readingOnRecording()?.driftSeconds).toBeCloseTo(
        driftBefore as number,
        6,
      )
      expect(controller.readingOnRecording()?.placedBy).toBe('hand')
      expect(controller.reference()?.notes[0].startBeat).toBeCloseTo(1.7, 6)
    })

    it('has nothing to nudge before a part is placed', async () => {
      const controller = mountWithTranscription(handPort(), heardNothing)
      await measure(controller)
      controller.nudgeScoreOnRecording(0.5)
      expect(controller.readingOnRecording()).toBeNull()
    })

    it('puts an attached tab back on its own clock when the marks are cleared', async () => {
      // No stem was ever measured here: the reader hung an attached tab by
      // hand, so "back" means the tab as written, not a transcription.
      const controller = mount(handPort())
      await controller.attach(BY_HAND.id, 'track-bass')
      await controller.placeScoreByHand(BY_HAND.id, 'track-bass')
      controller.markScoreOnRecording('first', 3)
      expect(controller.reference()?.kind).toBe('measured')

      controller.clearHandPlacement()
      await waitFor(() => expect(controller.reference()?.kind).toBe('authored'))
      expect(controller.readingOnRecording()).toBeNull()
    })

    it('forgets a measurement once a written score is attached instead', async () => {
      const controller = mountWithTranscription(handPort(), heardNothing)
      await measure(controller)
      await waitFor(() => expect(controller.alignableScores()).not.toEqual([]))
      await controller.attach(BY_HAND.id, 'track-bass')
      expect(controller.alignableScores()).toEqual([])
    })

    it('forgets a hand placement when the reference is detached', async () => {
      const controller = mountWithTranscription(handPort(), heardNothing)
      await measure(controller)
      await controller.placeScoreByHand(BY_HAND.id)
      controller.detach()
      expect(controller.handPlacement()).toBeNull()
    })
  })
})
