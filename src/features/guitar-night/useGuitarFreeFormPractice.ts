// Free-form Practice borrows the session input/output and composes the Rehearse scoring engine.
// ============================================================

import type { Accessor } from 'solid-js'
import { createEffect, createMemo, createSignal, onCleanup, untrack, } from 'solid-js'
import type { GuitarRoomBand } from '@/features/guitar/backing/guitar-room-band'
import { createGuitarRoomBand } from '@/features/guitar/backing/guitar-room-band'
import type { GuitarSessionAudioGraph } from '@/features/guitar/backing/guitar-session-audio-graph'
import type { GuitarPerformanceStageSource } from '@/features/guitar/runtime/guitar-performance-contract'
import type { GuitarElectricAmpParameters } from '@/lib/guitar/guitar-electric-amp'
import type { LoopSpan } from '@/lib/guitar/loop-span'
import { useLocalSaveNavigationLock } from '@/lib/local-save-navigation-lock'
import type { GuitarNightReference } from './reference-port'
import { scoreLiveRange } from './score-live-range'
import { buildScoreNoteStartIndex } from './score-note-index'
import type { GuitarListeningController } from './useGuitarListeningController'
import { useGuitarNightLiveScoreController } from './useGuitarNightLiveScoreController'
import { useGuitarNightLoopController } from './useGuitarNightLoopController'
import { scoreDurationBeats, useGuitarNightScoreRoomController, } from './useGuitarNightScoreRoomController'
import { useGuitarNightTakeCapture } from './useGuitarNightTakeCapture'

interface GuitarFreeFormPracticeOptions {
  reference: Accessor<GuitarNightReference | null>
  enabled: Accessor<boolean>
  blocked: Accessor<boolean>
  listening: Pick<
    GuitarListeningController,
    | 'recordableStream'
    | 'recordableAudioContext'
    | 'status'
    | 'inputProfile'
    | 'take'
    | 'health'
    | 'stop'
    | 'armTakeAt'
    | 'completeTakeAt'
    | 'completeTakeNow'
    | 'settleTake'
    | 'liveInputRoute'
  >
  amp: Accessor<GuitarElectricAmpParameters>
  activateGraph(): Promise<GuitarSessionAudioGraph | null>
  /** Offer explicit input setup; never acquire input or queue a delayed Play. */
  onListeningRequired?(): void
  /** Scheduler boundary injection; scoring and take capture remain shared. */
  createBand?(): GuitarRoomBand
  /** Capture boundary injection; the shared Keep state machine remains intact. */
  createCapture?(): ReturnType<typeof useGuitarNightTakeCapture>
}

export function useGuitarFreeFormPractice(
  options: GuitarFreeFormPracticeOptions,
) {
  const [notice, setNotice] = createSignal<string | null>(null)
  const [pending, setPending] = createSignal(false)
  const [settling, setSettling] = createSignal(false)
  const [configuring, setConfiguring] = createSignal(false)
  const [resetting, setResetting] = createSignal(false)
  const [consentOpen, setConsentOpen] = createSignal(false)
  type StartRequest = {
    range: LoopSpan
    reference: GuitarNightReference
    operation: number
    route: number | null
    inputKind: ReturnType<GuitarListeningController['inputProfile']>
  }
  let consent: StartRequest | null = null
  let generation = 0
  let disposed = false
  let practiceTakeId: string | null = null
  let admission: Promise<void> | null = null
  let drain: Promise<void> | null = null
  let finishAfterDrain = false
  let configuration: Promise<void> | null = null
  let configurationGeneration = 0
  type ConfigurationKey =
    | 'seek'
    | 'A'
    | 'B'
    | 'tempo'
    | 'count-in'
    | 'clear-loop'
  // At most one intent per control, regardless of the number of drag events.
  const changes = new Map<ConfigurationKey, () => void>()
  const loop = useGuitarNightLoopController({
    limit: () =>
      Math.max(1, Math.ceil(scoreDurationBeats(options.reference()))),
  })
  const room = useGuitarNightScoreRoomController({
    reference: options.reference,
    loop: loop.span,
    instrument: () => options.reference()?.tuning.instrument ?? 'guitar',
    ampParameters: options.amp,
    createBand:
      options.createBand ??
      (() =>
        createGuitarRoomBand({
          borrowedAudioGraph: { activate: options.activateGraph },
        })),
  })
  const capture =
    options.createCapture?.() ??
    useGuitarNightTakeCapture({
      getStream: options.listening.recordableStream,
      getAudioContext: options.listening.recordableAudioContext,
    })
  useLocalSaveNavigationLock(
    () => capture.state() === 'saving',
    'guitar-night practice take keep',
  )
  const liveScore = useGuitarNightLiveScoreController({
    listeningStatus: options.listening.status,
    inputKind: options.listening.inputProfile,
    take: options.listening.take,
    health: options.listening.health,
    roomStatus: room.status,
    countInRemaining: room.countInRemaining,
    playheadBeat: room.playheadBeat,
    startRoom: room.startLiveScore,
    stopRoom: room.stop,
    pauseRoom: room.pause,
    stopInput: options.listening.stop,
    armTakeAt: (startedAtSeconds) => {
      const armed = options.listening.armTakeAt(startedAtSeconds)
      if (armed) practiceTakeId = options.listening.take()?.id ?? null
      return armed
    },
    completeTakeAt: options.listening.completeTakeAt,
    completeTakeNow: options.listening.completeTakeNow,
    beginReplayCapture: capture.begin,
    finishReplayCapture: capture.finish,
    discardReplayCapture: capture.discard,
  })
  const noteStarts = createMemo(() =>
    buildScoreNoteStartIndex(options.reference()?.notes ?? []),
  )
  const running = () =>
    room.status() === 'playing' || room.status() === 'count-in'
  const busy = () =>
    pending() ||
    settling() ||
    configuring() ||
    resetting() ||
    liveScore.finishing() ||
    capture.state() === 'saving'
  const routeGeneration = () =>
    options.listening.liveInputRoute()?.generation ?? null
  const ownsTake = () =>
    practiceTakeId !== null && options.listening.take()?.id === practiceTakeId
  const invalidateStart = (): void => {
    generation++
    consent = null
    setConsentOpen(false)
    // The room rejects its late scheduler result. Do not clear the score: an
    // attempted replacement has not earned the right to erase the last take.
    if (liveScore.starting()) room.pause()
  }
  const cancelStart = (): void => {
    changes.clear()
    configurationGeneration++
    invalidateStart()
  }
  const stopRun = (finish: boolean): Promise<void> => {
    invalidateStart()
    if (drain !== null) {
      // A finish requested during Pause uses Pause's already pinned end. It
      // must not extend that boundary or open a second detector drain.
      finishAfterDrain ||= finish
      return drain
    }
    const needsEvidence =
      ownsTake() && options.listening.take()?.lifecycle === 'recording'
    if (ownsTake()) {
      if (finish) liveScore.finish()
      else if (needsEvidence) liveScore.hold()
    }
    room.pause()
    // A cancelled activation can still be resolving inside the borrowed band.
    // Record must wait for that promise too, not merely for detector evidence.
    const pendingAdmission = admission
    if (!needsEvidence && pendingAdmission === null) return Promise.resolve()
    setSettling(true)
    finishAfterDrain = false
    const evidence = needsEvidence
      ? options.listening.settleTake()
      : Promise.resolve()
    drain = Promise.all([evidence, pendingAdmission])
      .then(() => {
        if (!disposed && finishAfterDrain && ownsTake()) liveScore.finish()
      })
      .finally(() => {
        drain = null
        finishAfterDrain = false
        if (!disposed) setSettling(false)
      })
    return drain
  }
  const settle = (): Promise<void> => {
    cancelStart()
    return stopRun(true)
  }
  const pause = (): Promise<void> => {
    cancelStart()
    return stopRun(false)
  }
  const admitted = (request: StartRequest) =>
    !disposed &&
    request.operation === generation &&
    options.enabled() &&
    !options.blocked() &&
    capture.state() !== 'saving' &&
    options.reference() === request.reference &&
    options.listening.status() === 'listening' &&
    routeGeneration() === request.route &&
    options.listening.inputProfile() === request.inputKind
  const startRange = (request: StartRequest): Promise<void> => {
    if (!admitted(request)) return Promise.resolve()
    setPending(true)
    const start = liveScore
      .start(request.range)
      .then((started) => {
        if (!admitted(request)) return
        if (!started) {
          const error = room.error()
          room.seekBeat(request.range.start)
          setNotice(
            error ?? 'Practice could not start. Your melody is still ready.',
          )
        }
      })
      .finally(() => {
        if (admission !== start) return
        admission = null
        if (!disposed) setPending(false)
      })
    admission = start
    return start
  }
  const play = async (rangeOverride?: LoopSpan): Promise<void> => {
    if (
      disposed ||
      !options.enabled() ||
      options.blocked() ||
      busy() ||
      running()
    )
      return
    const reference = options.reference()
    if (reference === null) return
    if (options.listening.status() !== 'listening') {
      setNotice('Turn on Listening to score your playing against these notes.')
      options.onListeningRequired?.()
      return
    }
    const range =
      rangeOverride ??
      scoreLiveRange(
        loop.span(),
        room.playheadBeat(),
        room.durationBeats(),
        noteStarts(),
      )
    if (range === null) return
    const operation = ++generation
    const request = {
      range,
      reference,
      operation,
      route: routeGeneration(),
      inputKind: options.listening.inputProfile(),
    }
    setNotice(null)
    if (
      options.listening.inputProfile() === 'microphone' &&
      room.masterVolume() > 0.001 &&
      (room.hearScore() || room.hearClick())
    ) {
      consent = request
      setConsentOpen(true)
      return
    }
    await startRange(request)
  }
  const confirmMic = async (mute: boolean): Promise<void> => {
    const request = consent
    consent = null
    setConsentOpen(false)
    if (request === null || !admitted(request) || busy()) return
    if (mute) {
      room.setHearScore(false)
      room.setHearBacking(false)
      room.setHearClick(false)
    }
    await startRange(request)
  }
  const configure = (
    key: ConfigurationKey,
    change: () => void,
  ): Promise<void> => {
    if (
      disposed ||
      !options.enabled() ||
      options.blocked() ||
      resetting() ||
      capture.state() === 'saving'
    )
      return Promise.resolve()
    if (key === 'clear-loop') {
      changes.delete('A')
      changes.delete('B')
    }
    changes.delete(key)
    changes.set(key, change)
    if (configuration !== null) return configuration
    const reference = options.reference()
    const operation = configurationGeneration
    setConfiguring(true)
    configuration = stopRun(false)
      .then(() => {
        if (
          disposed ||
          operation !== configurationGeneration ||
          options.reference() !== reference ||
          !options.enabled() ||
          options.blocked() ||
          capture.state() === 'saving'
        )
          return
        room.parkForConfiguration()
        for (const apply of changes.values()) apply()
      })
      .finally(() => {
        changes.clear()
        configuration = null
        if (!disposed) setConfiguring(false)
      })
    return configuration
  }
  const seekBeat = (beat: number): Promise<void> =>
    configure('seek', () => room.seekBeat(beat))
  const seekSeconds = (seconds: number): Promise<void> =>
    seekBeat(room.beatForSeconds(seconds))
  const changeMark = (mark: 'A' | 'B', beat: number): void => {
    void configure(mark, () => {
      loop.moveMark(mark, beat)
    })
  }
  let previousReference = untrack(options.reference)
  let referenceGeneration = 0
  createEffect(() => {
    const reference = options.reference()
    if (reference === previousReference) return
    previousReference = reference
    untrack(() => {
      const operation = ++referenceGeneration
      setResetting(true)
      void settle()
        .then(() => {
          if (disposed || operation !== referenceGeneration) return
          // The owner locks source selection while Keep writes. Never discard
          // that immutable capture even if a source changes outside the UI.
          if (capture.state() !== 'saving') liveScore.clear()
          practiceTakeId = null
          room.stop()
          loop.clear()
          room.resetTempo()
          setNotice(null)
        })
        .finally(() => {
          if (!disposed && operation === referenceGeneration)
            setResetting(false)
        })
    })
  })
  createEffect(() => {
    if (!options.enabled() || options.blocked() || capture.state() === 'saving')
      untrack(() => {
        void settle()
      })
  })
  let previousRoute = untrack(routeGeneration)
  let previousInputKind = untrack(options.listening.inputProfile)
  createEffect(() => {
    const route = routeGeneration()
    const status = options.listening.status()
    const inputKind = options.listening.inputProfile()
    if (status === 'listening')
      setNotice((message) =>
        message ===
        'Turn on Listening to score your playing against these notes.'
          ? null
          : message,
      )
    if (
      route !== previousRoute ||
      inputKind !== previousInputKind ||
      status !== 'listening'
    )
      untrack(() => {
        void pause()
      })
    previousRoute = route
    previousInputKind = inputKind
  })
  onCleanup(() => {
    void settle()
    disposed = true
  })
  const stage: GuitarPerformanceStageSource = {
    title: () =>
      (room.displayReference() ?? options.reference())?.title ?? 'Practice',
    notes: () => (room.displayReference() ?? options.reference())?.notes ?? [],
    timeline: {
      positionSeconds: room.displayPositionSeconds,
      durationSeconds: room.durationSeconds,
      playheadBeat: room.playheadBeat,
      tempoBpm: room.tempoBpm,
    },
  }
  return {
    room,
    loop,
    liveScore,
    capture,
    stage,
    notice,
    pending,
    busy,
    running,
    consentOpen,
    confirmMic,
    cancelStart,
    settle,
    pause,
    play,
    toggle: () => (running() || pending() ? void pause() : void play()),
    seekBeat,
    seekSeconds,
    changeMark,
    setTempo: (bpm: number) => configure('tempo', () => room.setTempoBpm(bpm)),
    setCountIn: (beats: number) =>
      configure('count-in', () => room.setCountInBeats(beats)),
    mark: (mark: 'A' | 'B') => {
      const beat = room.playheadBeat() ?? 0
      void configure(mark, () => {
        if (mark === 'A') loop.markStart(beat)
        else loop.markEnd(beat)
      })
    },
    clearLoop: () => configure('clear-loop', loop.clear),
  }
}

export type GuitarFreeFormPractice = ReturnType<
  typeof useGuitarFreeFormPractice
>
