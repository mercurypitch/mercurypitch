// Free-form session integration exercises shared controllers with real device storage and inert audio boundaries.
import { Blob as NodeBlob } from 'node:buffer'
import { createRoot, createSignal } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import 'fake-indexeddb/auto'
import * as database from '@/db'
import { closeLocalDatabase, getLocalDatabase } from '@/db/local-database'
import { createGuitarRecordingStore } from '@/db/services/guitar-recording-service'
import type { GuitarRoomBand, GuitarRoomBandStartOptions, } from '@/features/guitar/backing/guitar-room-band'
import type { GuitarSessionAudioGraph } from '@/features/guitar/backing/guitar-session-audio-graph'
import { createGuitarSessionAudioGraph } from '@/features/guitar/backing/guitar-session-audio-graph'
import { keepInstrumentNightTake } from '@/lib/domain/performance-take'
import { DEFAULT_GUITAR_ELECTRIC_AMP_PARAMETERS } from '@/lib/guitar/guitar-electric-amp'
import type { GuitarMidiInputPortLike } from '@/lib/guitar/guitar-midi-input'
import type { GuitarScoreTakeSummary } from '@/lib/guitar/guitar-score-history'
import { DEFAULT_GUITAR_TUNING } from '@/lib/guitar/instrument-tuning'
import { createRecordingScore } from '@/lib/guitar/recording-score'
import type { GuitarRecording } from '@/lib/guitar/recording-types'
import { useGuitarFreeFormSession } from './useGuitarFreeFormSession'
import { useGuitarListeningController } from './useGuitarListeningController'
import { useGuitarNightTakeCapture } from './useGuitarNightTakeCapture'
import { useGuitarRecordingController } from './useGuitarRecordingController'
import { useGuitarRecordingPlayback } from './useGuitarRecordingPlayback'
import { useGuitarRecordingStage } from './useGuitarRecordingStage'

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((yes) => {
    resolve = yes
  })
  return { promise, resolve }
}

describe('free-form session integration', () => {
  let db: ReturnType<typeof getLocalDatabase>
  let store: ReturnType<typeof createGuitarRecordingStore>
  const disposers: (() => void)[] = []

  beforeEach(() => {
    vi.stubGlobal('Blob', NodeBlob)
    localStorage.clear()
    db = getLocalDatabase()
    store = createGuitarRecordingStore(db)
  })
  afterEach(async () => {
    disposers.splice(0).forEach((dispose) => dispose())
    await db.destroy()
    closeLocalDatabase()
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  async function seed(id = 'idea') {
    const row: GuitarRecording = {
      id,
      version: 1,
      detectorVersion: 'test',
      title: `Melody ${id}`,
      createdAt: '2026-09-08T10:00:00Z',
      updatedAt: '2026-09-08T10:00:00Z',
      state: 'capturing',
      sampleRate: 48000,
      inputChannel: 0,
      inputKind: 'interface',
      frames: 0,
      chunks: 0,
      audioStartFrame: null,
      clockAnomalies: 0,
      interruption: null,
      amp: null,
      backing: null,
      takeId: null,
      scoreId: null,
    }
    await store.begin(row)
    await store.checkpoint({
      id: `${id}:0`,
      recordingId: id,
      sequence: 0,
      kind: 'audio',
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      firstFrame: 0,
      frames: 48000,
      pcm: new ArrayBuffer(96000),
      pitches: [],
      attacks: [],
      notes: [],
      peak: 0.2,
    })
    await store.finish(
      id,
      {
        frames: 48000,
        clockAnomalies: 0,
        interruption: null,
        notes: [
          {
            id: `${id}:n1`,
            midi: 64,
            startFrame: 1200,
            endFrame: 12000,
            clarity: 0.9,
            onset: 'attack',
          },
          {
            id: `${id}:n2`,
            midi: 65,
            startFrame: 24000,
            endFrame: 36000,
            clarity: 0.9,
            onset: 'attack',
          },
        ],
      },
      480000,
    )
    return store.load(id)
  }

  function harness(
    recordingStore = store,
    audioGraph: GuitarSessionAudioGraph | null = null,
    createPracticeCapture?: () => ReturnType<typeof useGuitarNightTakeCapture>,
    createPracticeBand?: () => GuitarRoomBand,
  ) {
    return createRoot((dispose) => {
      disposers.push(dispose)
      const [enabled, setEnabled] = createSignal(true)
      const [blocked, setBlocked] = createSignal(false)
      const activateInput = vi.fn(async () => audioGraph !== null)
      const activateReplay = vi.fn(async () => null)
      const activatePractice = vi.fn<
        () => Promise<GuitarSessionAudioGraph | null>
      >(async () => null)
      const startInput = vi.fn(async () => false)
      const missingSource = vi.fn()
      const listening = useGuitarListeningController({
        activateAudio: activateInput,
        getAudioGraph: () => audioGraph,
      })
      const recorder = useGuitarRecordingController({
        listening,
        startListening: startInput,
        amp: () => DEFAULT_GUITAR_ELECTRIC_AMP_PARAMETERS,
        tuning: () => DEFAULT_GUITAR_TUNING,
        backing: () => null,
        playing: () => false,
        blocked,
        clearLoop: () => undefined,
      })
      const playback = useGuitarRecordingPlayback({
        draft: recorder.draft,
        score: recorder.previewScore,
        currentAmp: () => DEFAULT_GUITAR_ELECTRIC_AMP_PARAMETERS,
        blocked,
        activate: activateReplay,
        beforePlay: () => undefined,
      })
      const recordingStage = useGuitarRecordingStage(
        recorder,
        () => DEFAULT_GUITAR_TUNING,
        playback,
      )
      const session = useGuitarFreeFormSession({
        enabled,
        blocked,
        listening,
        recorder,
        playback,
        recordingStage,
        tuning: () => DEFAULT_GUITAR_TUNING,
        amp: () => DEFAULT_GUITAR_ELECTRIC_AMP_PARAMETERS,
        activateGraph: activatePractice,
        onMissingSource: missingSource,
        recordingStore,
        ...(createPracticeCapture === undefined
          ? {}
          : { createPracticeCapture }),
        ...(createPracticeBand === undefined ? {} : { createPracticeBand }),
      })
      return {
        session,
        recordingStage,
        recorder,
        playback,
        listening,
        setEnabled,
        setBlocked,
        dispose,
        activateInput,
        activateReplay,
        activatePractice,
        startInput,
        missingSource,
      }
    })
  }

  async function pausedAdmission() {
    const entered = deferred()
    const release = deferred()
    const draft = await seed()
    const delayedStore = {
      ...store,
      load: async (id: string) => {
        const current = await store.load(id)
        entered.resolve()
        await release.promise
        return current
      },
    }
    const h = harness(delayedStore)
    h.recorder.setDraft(draft)
    const pending = h.session.modes.select('practice')
    await entered.promise
    return { ...h, pending, release }
  }

  it('enters empty Live without input, recorder, output, or durable data', async () => {
    const h = harness()
    expect(h.session.modes.mode()).toBe('live')
    expect(h.session.stage.historyKind?.()).toBe('live')
    expect(h.session.stage.notes()).toEqual([])
    expect(h.session.live.active()).toBe(false)
    expect(h.recorder.state()).toBe('idle')
    expect(h.listening.status()).toBe('off')
    await h.session.modes.select('live')
    await h.session.play()
    expect(h.missingSource).toHaveBeenCalledOnce()
    expect(h.startInput).not.toHaveBeenCalled()
    expect(h.activateInput).not.toHaveBeenCalled()
    expect(h.activateReplay).not.toHaveBeenCalled()
    expect(h.activatePractice).not.toHaveBeenCalled()
    expect(await store.list()).toEqual([])
    expect(await store.scores()).toEqual([])
    expect(await db.getRepository('voiceTakes').count()).toBe(0)
  })

  it('parks Replay in Live and returns with selection, notes, tone and position untouched', async () => {
    const draft = await seed()
    const h = harness()
    await h.session.recover(draft.recording.id, false)
    h.playback.setSource('notes')
    h.playback.setTone('clean')
    h.session.seek(0.6)
    const score = createRecordingScore(
      draft.recording,
      draft.notes,
      DEFAULT_GUITAR_TUNING,
    )
    h.recorder.setPreviewScore(score)
    h.session.seek(0.6)
    const stage = h.session.stage
    expect(h.session.modes.mode()).toBe('replay')
    expect(await h.session.modes.select('live')).toBe(true)
    expect(h.session.stage).toBe(stage)
    expect(h.session.stage.historyKind?.()).toBe('live')
    expect(h.recorder.draft()?.recording.id).toBe('idea')
    expect(h.recorder.previewScore()).toBe(score)
    expect(await h.session.modes.select('replay')).toBe(true)
    expect(h.session.stage).toBe(stage)
    expect(h.session.position()).toBeCloseTo(0.6)
    expect(h.playback.source()).toBe('notes')
    expect(h.playback.tone()).toBe('clean')
    expect(h.session.playing()).toBe(false)
    expect(h.activateReplay).not.toHaveBeenCalled()
    expect(h.activatePractice).not.toHaveBeenCalled()
    expect(h.startInput).not.toHaveBeenCalled()
    expect((await store.load('idea')).recording.state).toBe('draft')
    expect(await store.scores()).toEqual([])
  })

  it('Practice accepts one exact immutable score and reuses it across mode toggles without starting audio', async () => {
    const draft = await seed()
    const h = harness()
    h.recorder.setDraft(draft)
    expect(await h.session.modes.select('practice')).toBe(true)
    const accepted = (await store.load('idea')).acceptedScore!
    expect(h.recorder.previewScore()).toEqual(accepted)
    expect(h.session.reference()?.songId).toBe(accepted.id)
    expect(
      h.session.stage
        .notes()
        .map((note) => [note.midi, note.startBeat, note.duration]),
    ).toEqual(
      accepted.notes.map((note) => [
        note.midi,
        note.startBeat,
        note.endBeat - note.startBeat,
      ]),
    )
    expect(h.session.practice.liveScore.display()).toBeNull()
    expect(h.session.results.currentScoreSummary()).toBeNull()
    expect(await h.session.modes.select('live')).toBe(true)
    expect(await h.session.modes.select('practice')).toBe(true)
    expect(await store.scores()).toEqual([accepted])
    expect(await db.getRepository('voiceTakes').count()).toBe(1)
    expect(h.activatePractice).not.toHaveBeenCalled()
    expect(h.activateReplay).not.toHaveBeenCalled()
    expect(h.startInput).not.toHaveBeenCalled()
    expect(h.session.pending()).toBe(false)
  })

  it('routes explicit Play to Replay or Practice without acquiring input in either mode', async () => {
    const draft = await seed()
    const h = harness()
    h.recorder.setDraft(draft)
    await h.session.modes.select('live')
    await h.session.play()
    expect(h.session.modes.mode()).toBe('replay')
    expect(h.activateReplay).toHaveBeenCalledOnce()
    expect(await h.session.modes.select('practice')).toBe(true)
    await h.session.play()
    expect(h.session.notice()).toContain('Turn on Listening')
    expect(h.activatePractice).not.toHaveBeenCalled()
    expect(h.activateReplay).toHaveBeenCalledOnce()
    expect(h.startInput).not.toHaveBeenCalled()
    expect(h.activateInput).not.toHaveBeenCalled()
  })

  it('refuses problematic corrections without excluding evidence or keeping a partial target', async () => {
    const draft = await seed()
    const h = harness()
    h.recorder.setDraft(draft)
    const score = createRecordingScore(
      draft.recording,
      draft.notes,
      DEFAULT_GUITAR_TUNING,
    )
    score.notes[0].string = null
    h.recorder.setPreviewScore(score)
    expect(await h.session.modes.select('practice')).toBe(false)
    expect(h.session.modes.mode()).toBe('replay')
    expect(h.recorder.reviewOpen()).toBe(true)
    expect(h.session.notice()).toBeTruthy()
    expect(h.session.reference()).toBeNull()
    expect(h.recorder.previewScore()).toBe(score)
    expect((await store.load('idea')).notes).toEqual(draft.notes)
    expect((await store.load('idea')).recording.state).toBe('draft')
    expect(await store.scores()).toEqual([])
  })

  it.each([
    'live',
    'pause',
    'stop',
    'toggle',
    'disabled',
    'blocked',
    'disposed',
  ] as const)(
    'does not install a delayed Practice revision after %s cancels admission',
    async (action) => {
      const h = await pausedAdmission()
      if (action === 'live') await h.session.modes.select('live')
      if (action === 'pause') h.session.pause()
      if (action === 'stop') h.session.stop()
      if (action === 'toggle') h.session.toggle()
      if (action === 'disabled') h.setEnabled(false)
      if (action === 'blocked') h.setBlocked(true)
      if (action === 'disposed') h.dispose()
      h.release.resolve()
      expect(await h.pending).toBe(false)
      expect(h.recorder.previewScore()).toBeNull()
      expect(h.session.reference()).toBeNull()
      expect(h.session.modes.mode()).not.toBe('practice')
      expect(h.activateReplay).not.toHaveBeenCalled()
      expect(h.activatePractice).not.toHaveBeenCalled()
      // The explicitly requested Keep can finish atomically; cancellation
      // must not delete it or install its UI into a different current intent.
      expect(await store.scores()).toHaveLength(1)
    },
  )

  it('does not install another melody when the selected source changes during admission', async () => {
    const h = await pausedAdmission()
    const second = await seed('other')
    await h.session.recover(second.recording.id, false)
    h.release.resolve()
    expect(await h.pending).toBe(false)
    expect(h.recorder.draft()?.recording.id).toBe('other')
    expect(h.recorder.previewScore()).toBeNull()
    expect(h.session.reference()).toBeNull()
    expect(h.session.modes.mode()).toBe('replay')
    expect(h.activateReplay).not.toHaveBeenCalled()
  })

  it('does not open audio, change modes or record behind the score results dialog', async () => {
    const draft = await seed()
    const h = harness()
    h.recorder.setDraft(draft)
    await h.session.modes.select('practice')
    await h.session.openScore()
    expect(h.session.scoreOpen()).toBe(true)
    expect(await h.session.modes.select('live')).toBe(false)
    await h.session.recorder.start()
    await h.session.play()
    expect(h.startInput).not.toHaveBeenCalled()
    expect(h.activateReplay).not.toHaveBeenCalled()
    expect(h.activatePractice).not.toHaveBeenCalled()
    expect(h.session.modes.mode()).toBe('practice')
    h.session.setScoreOpen(false)
    expect(await h.session.modes.select('live')).toBe(true)
  })

  it('locks transport immediately while results are waiting for Practice to park', async () => {
    const draft = await seed()
    const h = harness()
    h.recorder.setDraft(draft)
    await h.session.modes.select('practice')
    const opening = h.session.openScore()
    await h.session.play()
    expect(await h.session.modes.select('live')).toBe(false)
    await opening
    expect(h.session.scoreOpen()).toBe(true)
    expect(h.session.practice.notice()).toBeNull()
    expect(h.session.modes.mode()).toBe('practice')
  })

  it('restarts Replay at zero without requesting Listening', async () => {
    const draft = await seed()
    const h = harness()
    h.recorder.setDraft(draft)
    h.session.seek(0.6)
    await h.session.restart()
    expect(h.session.position()).toBe(0)
    expect(h.activateReplay).toHaveBeenCalledOnce()
    expect(h.startInput).not.toHaveBeenCalled()
    expect(h.activateInput).not.toHaveBeenCalled()
  })

  it('parks Practice at zero before its explicit restart tries to play', async () => {
    const draft = await seed()
    const h = harness()
    h.recorder.setDraft(draft)
    await h.session.modes.select('practice')
    await h.session.practice.seekBeat(1)
    expect(h.session.practice.room.playheadBeat()).toBe(1)
    await h.session.restart()
    expect(h.session.practice.room.playheadBeat()).toBe(0)
    expect(h.session.practice.notice()).toContain('Turn on Listening')
    expect(h.activateReplay).not.toHaveBeenCalled()
    expect(h.startInput).not.toHaveBeenCalled()
  })

  it('does not restart an old Practice mode after switching to Live during its seek', async () => {
    const draft = await seed()
    const h = harness()
    h.recorder.setDraft(draft)
    await h.session.modes.select('practice')
    await h.session.practice.seekBeat(1)
    const restart = h.session.restart()
    expect(await h.session.modes.select('live')).toBe(true)
    await restart
    expect(h.session.modes.mode()).toBe('live')
    expect(h.session.practice.notice()).toBeNull()
    expect(h.activateReplay).not.toHaveBeenCalled()
    expect(h.activatePractice).not.toHaveBeenCalled()
  })

  it('accepts changed Review notes even while already in Practice, but ordinary same-tab clicks remain inert', async () => {
    const draft = await seed()
    const h = harness()
    h.recorder.setDraft(draft)
    await h.session.modes.select('practice')
    const original = h.recorder.previewScore()!
    const oldReference = h.session.reference()
    const changed = { ...original, title: 'Corrected phrase' }
    h.recorder.setPreviewScore(changed)
    expect(await h.session.modes.select('practice')).toBe(true)
    expect(h.session.reference()).toBe(oldReference)
    expect(await store.scores()).toHaveLength(1)

    await h.session.reviewPractice(changed)

    expect(h.session.modes.mode()).toBe('practice')
    expect(h.session.reference()).not.toBe(oldReference)
    expect(h.session.reference()?.title).toBe(
      'Corrected phrase · recorded melody',
    )
    expect(h.session.reference()?.songId).toBe(h.recorder.previewScore()?.id)
    expect(h.recorder.previewScore()?.revision).toBe(2)
    expect(await store.scores()).toHaveLength(2)
    expect(h.activateReplay).not.toHaveBeenCalled()
    expect(h.activatePractice).not.toHaveBeenCalled()
  })

  it('preserves the existing Practice reference when a refreshed review is canceled during Keep', async () => {
    const draft = await seed()
    const entered = deferred()
    const release = deferred()
    let delaying = false
    const h = harness({
      ...store,
      load: async (id: string) => {
        const loaded = await store.load(id)
        if (delaying) {
          entered.resolve()
          await release.promise
        }
        return loaded
      },
    })
    h.recorder.setDraft(draft)
    await h.session.modes.select('practice')
    const original = h.recorder.previewScore()!
    const oldReference = h.session.reference()
    const changed = { ...original, title: 'New phrase' }
    delaying = true
    const refreshing = h.session.reviewPractice(changed)
    await entered.promise
    h.session.pause()
    release.resolve()
    await refreshing
    expect(h.session.modes.mode()).toBe('practice')
    expect(h.session.reference()).toBe(oldReference)
    expect(h.recorder.previewScore()).toBe(changed)
    expect(h.session.stage.title()).toBe(oldReference?.title)
    expect(h.session.pending()).toBe(false)
    expect(h.activatePractice).not.toHaveBeenCalled()
  })

  it('hides Live ink without losing MIDI history, stopping Listening or changing Replay notes', async () => {
    const port: GuitarMidiInputPortLike = {
      id: 'guitar-midi',
      name: 'Guitar MIDI',
      state: 'connected',
      onmidimessage: null,
    }
    vi.stubGlobal('navigator', {
      ...navigator,
      requestMIDIAccess: async () => ({
        inputs: new Map([[port.id, port]]),
        onstatechange: null,
      }),
    })
    const context = new AudioContext()
    const graph = createGuitarSessionAudioGraph(context)
    const h = harness(store, graph)
    await h.listening.selectInputProfile('midi')
    expect(await h.listening.start()).toBe(true)
    Object.assign(context, { currentTime: 1 })
    port.onmidimessage?.({
      data: [0x90, 64, 100],
      timeStamp: performance.now(),
    })
    expect(h.session.stage.notes()).toHaveLength(1)
    h.recordingStage.setShowLiveNotes(false)
    expect(h.session.stage.notes()).toEqual([])
    port.onmidimessage?.({
      data: [0x90, 67, 100],
      timeStamp: performance.now(),
    })
    expect(h.session.live.source.notes()).toHaveLength(2)
    expect(h.session.stage.notes()).toEqual([])
    expect(h.listening.status()).toBe('listening')
    h.recordingStage.setShowLiveNotes(true)
    expect(h.session.stage.notes()).toHaveLength(2)
    h.recordingStage.setShowLiveNotes(false)
    const draft = await seed()
    h.recorder.setDraft(draft)
    expect(h.session.modes.mode()).toBe('replay')
    expect(h.session.stage.notes()).toHaveLength(2)
    expect(h.listening.status()).toBe('listening')
    expect(h.recorder.state()).toBe('idle')
    expect(h.startInput).not.toHaveBeenCalled()
    expect(await store.scores()).toEqual([])
    h.dispose()
    graph.dispose()
  })

  it('does not let a late Stop rewind a newer same-source transport intent', async () => {
    const draft = await seed()
    const h = harness()
    h.recorder.setDraft(draft)
    await h.session.modes.select('practice')
    await h.session.practice.seekBeat(1)
    const stopping = h.session.stop()
    h.session.modes.cancel()
    await stopping
    expect(h.session.practice.room.playheadBeat()).toBe(1)
  })

  it('freezes melody switching and removal while the real Practice Keep write is pending, not merely while a gallery is open', async () => {
    const draft = await seed()
    await seed('other')
    const entered = deferred()
    const release = deferred()
    const clock = { currentTime: 0 }
    vi.spyOn(database, 'getDb').mockResolvedValue(db)
    const h = harness(store, null, () =>
      useGuitarNightTakeCapture({
        getStream: () => ({}) as MediaStream,
        getAudioContext: () => clock as AudioContext,
        createRecorder: () => ({
          start: () => true,
          pause: async () => true,
          resume: async () => true,
          stop: async () => new Blob(['practice'], { type: 'audio/webm' }),
          discard: () => undefined,
          dispose: () => undefined,
        }),
        inspectTake: async () => ({
          durationMs: 1000,
          peaks: new Float32Array([0.3, 0.6]),
        }),
        saveTake: async (input) => {
          entered.resolve()
          await release.promise
          return keepInstrumentNightTake(input)
        },
        visibilityTarget: null,
      }),
    )
    h.recorder.setDraft(draft)
    await h.session.modes.select('practice')
    const reference = h.session.reference()!
    const summary: GuitarScoreTakeSummary = {
      schemaVersion: 1,
      savedAt: Date.now(),
      status: 'completed',
      pieceLabel: reference.title,
      trackLabel: reference.trackName,
      range: { startBeat: 0, endBeat: 2 },
      inputKind: 'interface',
      basis: 'cumulative',
      score: 100,
      grade: 'A',
      counts: {
        targetCount: 2,
        judgedTargets: 2,
        hitTargets: 2,
        missedTargets: 0,
        skippedTargets: 0,
      },
      bestStreak: 2,
      evidence: { status: 'complete', detectedGapCount: 0 },
      recentOutcomes: [],
    }
    const capture = h.session.practice.capture
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    expect(
      capture.begin(
        {
          id: 'scored-practice',
          reference,
          range: { start: 0, end: 2 },
          tempoBpm: 120,
          scoreTempoBpm: 120,
          countInBeats: 0,
          sampleRate: 48000,
          startedAtSeconds: 0,
          completedAtSeconds: 1,
          beatToSeconds: (beat) => beat / 2,
        },
        'interface',
      ),
    ).toBe(true)
    await vi.advanceTimersByTimeAsync(0)
    clock.currentTime = 1
    capture.attachCompletedSummary('scored-practice', summary)
    capture.finish('scored-practice')
    await vi.advanceTimersByTimeAsync(0)
    expect(capture.state()).toBe('ready')
    vi.useRealTimers()
    const keeping = capture.keep()
    await entered.promise
    expect(capture.state()).toBe('saving')

    await h.session.recover('other', false)
    await expect(h.session.remove('idea')).rejects.toThrow('Finish keeping')
    await expect(h.session.remove('other')).rejects.toThrow('Finish keeping')
    expect(h.recorder.draft()?.recording.id).toBe('idea')
    expect((await store.list()).map((row) => row.id).sort()).toEqual([
      'idea',
      'other',
    ])
    expect(capture.state()).toBe('saving')
    release.resolve()
    expect(await keeping).toBe(true)
    expect(capture.state()).toBe('saved')
    expect(await db.getRepository('voiceTakes').count()).toBe(2)

    // Opening the gallery blocks transports, not source picking itself.
    h.setBlocked(true)
    await h.session.recover('other', false)
    expect(h.recorder.draft()?.recording.id).toBe('other')
    await h.session.remove('idea')
    expect((await store.list()).map((row) => row.id)).toEqual(['other'])
  })

  it.each(['completed-while-settling', 'repeat', 'cancel'] as const)(
    'guards Play again for a real partial result: %s',
    async (action) => {
      const draft = await seed()
      const port: GuitarMidiInputPortLike = {
        id: 'guitar-midi',
        name: 'Guitar MIDI',
        state: 'connected',
        onmidimessage: null,
      }
      vi.stubGlobal('navigator', {
        ...navigator,
        requestMIDIAccess: async () => ({
          inputs: new Map([[port.id, port]]),
          onstatechange: null,
        }),
      })
      const context = new AudioContext()
      Object.assign(context, { currentTime: 10 })
      const graph = createGuitarSessionAudioGraph(context)
      let schedule: GuitarRoomBandStartOptions | null = null
      const startBand = vi.fn(async (request: GuitarRoomBandStartOptions) => {
        schedule = request
        return {
          expectedHitTimesMs: [],
          exerciseStartedAtSeconds: context.currentTime + 0.06,
          completedAtSeconds:
            context.currentTime +
            0.06 +
            (((request.durationBeats ?? 2) - (request.startBeat ?? 0)) * 60) /
              request.tempoBpm,
        }
      })
      const band: GuitarRoomBand = {
        start: startBand,
        activate: async () => graph,
        getAudioGraph: () => graph,
        setMasterLevel: () => undefined,
        setElectricAmpParameters: () => undefined,
        setMelodyChannelLevel: () => undefined,
        setPercussionTrackAudible: () => undefined,
        stop: () => undefined,
        dispose: async () => undefined,
      }
      const h = harness(store, graph, undefined, () => band)
      h.recorder.setDraft(draft)
      await h.session.modes.select('practice')
      h.session.practice.room.setHearScore(false)
      h.session.practice.room.setHearClick(false)
      await h.session.practice.setCountIn(0)
      await h.listening.selectInputProfile('midi')
      expect(await h.listening.start()).toBe(true)
      vi.useFakeTimers({
        toFake: [
          'setTimeout',
          'clearTimeout',
          'setInterval',
          'clearInterval',
          'requestAnimationFrame',
          'cancelAnimationFrame',
        ],
      })
      await h.session.play()
      const boundary = h.session.practice.liveScore.boundary()
      expect(
        boundary,
        h.session.notice() ??
          h.session.practice.room.error() ??
          'Practice boundary',
      ).not.toBeNull()
      ;(schedule as GuitarRoomBandStartOptions | null)?.onExerciseStart?.(
        boundary!.range.start,
        boundary!.startedAtSeconds,
      )
      Object.assign(context, {
        currentTime: boundary!.startedAtSeconds + 0.025,
      })
      await vi.advanceTimersByTimeAsync(120)
      port.onmidimessage?.({
        data: [0x90, 64, 100],
        timeStamp: performance.now(),
      })
      Object.assign(context, { currentTime: boundary!.startedAtSeconds + 0.3 })
      await vi.advanceTimersByTimeAsync(250)
      const opening = h.session.openScore()
      await vi.advanceTimersByTimeAsync(250)
      await opening
      expect(h.session.results.currentScoreSummary()?.status).toBe('partial')
      const previousReplay = h.session.results.scoreReplay()!
      expect(previousReplay).not.toBeNull()
      expect(h.session.scoreOpen()).toBe(true)
      if (action === 'repeat') expect(await h.listening.start()).toBe(true)
      const repeating = h.session.playAgain()
      if (action === 'cancel') h.session.pause()
      await repeating
      const nextBoundary = h.session.practice.liveScore.boundary()
      expect(h.session.scoreOpen()).toBe(false)
      if (action === 'repeat') {
        expect(startBand).toHaveBeenCalledTimes(2)
        expect(nextBoundary?.id).not.toBe(boundary?.id)
        expect(nextBoundary?.reference).toEqual(boundary?.reference)
        expect(nextBoundary?.range).toEqual(previousReplay.range)
      } else {
        expect(startBand).toHaveBeenCalledOnce()
        expect(nextBoundary?.id).toBe(boundary?.id)
        expect(h.session.results.currentScoreSummary()?.status).toBe(
          'completed',
        )
        expect(h.session.results.scoreReplay()).not.toBe(previousReplay)
        if (action === 'cancel') expect(h.session.practice.notice()).toBeNull()
        else expect(h.session.practice.notice()).toContain('Turn on Listening')
      }
      h.dispose()
      graph.dispose()
      vi.useRealTimers()
    },
  )
})
