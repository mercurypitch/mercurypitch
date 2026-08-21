// ============================================================
// Piano Night controller — one replaceable source and one route-owned runtime
// ============================================================
//
// The standalone route stays store-free on first paint. Browser capabilities
// activate only from Play, Connect MIDI, or an on-screen key gesture.

import { batch, createMemo, createSignal, onCleanup, onMount } from 'solid-js'
import type { PianoInputSnapshot, PianoInputState, PianoPedalKind, } from '@/features/piano/input/piano-input-state'
import { createPianoInputState } from '@/features/piano/input/piano-input-state'
import { createTouchPianoInputPort } from '@/features/piano/input/touch-piano-input-port'
import type { WebMidiInputPortSnapshot } from '@/features/piano/input/web-midi-input-port'
import { createWebMidiInputPort } from '@/features/piano/input/web-midi-input-port'
import type { PianoInstrumentPreference } from '@/features/piano/instrument/piano-instrument-router'
import { createPianoInstrumentRouter } from '@/features/piano/instrument/piano-instrument-router'
import { createPianoAudioClockTransport } from '@/features/piano/runtime/piano-audio-clock-transport'
import { createPianoFallbackSynth } from '@/features/piano/runtime/piano-fallback-synth'
import { createPianoPerformanceScheduler } from '@/features/piano/runtime/piano-performance-scheduler'
import type { PianoPerformanceScoringSource, PianoPerformanceScoringState, PianoPerformanceScoringUpdate, } from '@/features/piano/runtime/piano-performance-scoring'
import { createPianoPerformanceScoringEngine } from '@/features/piano/runtime/piano-performance-scoring'
import { pianoTempoBeatToSeconds } from '@/features/piano/runtime/piano-tempo-map'
import { installAudioUnlock } from '@/lib/audio-unlock'
import { presentationFps, recordAnimationFrame } from '@/lib/device-tier'
import { createAdaptiveFrameRateLimiter } from '@/lib/frame-rate-limiter'
import { createPersistedSignal } from '@/lib/storage'
import { createPianoNightActiveMidiIndex } from './piano-night-active-midi-index'
import { createPianoNightArrangement } from './piano-night-arrangement'
import type { PianoNightStageMotion } from './piano-night-fall-geometry'
import { isPianoNightStageMotion } from './piano-night-fall-geometry'
import type { PianoNightPracticeLoopState, PianoNightPracticeRange, } from './piano-night-practice-loop'
import { clampPianoNightMasterVolume, clampPianoNightRepeatCount, INITIAL_PIANO_NIGHT_PRACTICE_LOOP, isBeatInPianoNightPracticeRange, isPianoNightPracticeSpeed, normalizePianoNightPracticeRange, PIANO_NIGHT_DEFAULT_MASTER_VOLUME, } from './piano-night-practice-loop'
import type { PianoNightSource } from './piano-night-source'
import { PIANO_NIGHT_INCLUDED_SOURCE } from './piano-night-source'

const MINIMUM_TEMPO_BPM = 40
const MAXIMUM_TEMPO_BPM = 280
const SAMPLE_WINDOW_BEATS = 4
const PRACTICE_SPEED_STORAGE_KEY = 'pitchperfect_piano_night_practice_speed'
const MASTER_VOLUME_STORAGE_KEY = 'pitchperfect_piano_night_master_volume'
const INSTRUMENT_STORAGE_KEY = 'pitchperfect_piano_night_instrument'
const SOUND_CHARACTER_STORAGE_KEY = 'pitchperfect_piano_night_character'
const SOUND_AMBIENCE_STORAGE_KEY = 'pitchperfect_piano_night_ambience'
const STAGE_MOTION_STORAGE_KEY = 'pitchperfect_piano_night_stage_motion'

export type PianoNightSoundLoadStatus = 'idle' | 'loading' | 'ready' | 'error'
export type PianoNightSoundCharacter = 'soft' | 'balanced' | 'bright'
export type PianoNightSoundAmbience = 'close' | 'studio' | 'hall'

interface PianoNightSampledInstrument {
  setCharacter(character: PianoNightSoundCharacter): void
  setAmbience(ambience: PianoNightSoundAmbience): void
  getLoadSnapshot(): {
    readonly status: PianoNightSoundLoadStatus
    readonly playable: boolean
    readonly loadedSamples: number
    readonly preparedSamples: number
    readonly plannedSamples: number
    readonly totalSamples: number
    readonly decodedBytes: number
    readonly error: string | null
  }
  subscribe(listener: () => void): () => void
}

interface PianoNightSampleWindow {
  readonly key: string
  readonly midis: readonly number[]
  readonly sourceId: string
  readonly startBeat: number
  readonly coveredThroughBeat: number
}

type PianoNightSamplePreparationMode = 'initial' | 'current' | 'rolling'

function boundedTempoBpm(tempoBpm: number): number {
  if (!Number.isFinite(tempoBpm)) return 120
  return Math.max(MINIMUM_TEMPO_BPM, Math.min(MAXIMUM_TEMPO_BPM, tempoBpm))
}

function isInstrumentPreference(
  value: unknown,
): value is PianoInstrumentPreference {
  return value === 'auto' || value === 'sampled' || value === 'fallback'
}

function isSoundCharacter(value: unknown): value is PianoNightSoundCharacter {
  return value === 'soft' || value === 'balanced' || value === 'bright'
}

function isSoundAmbience(value: unknown): value is PianoNightSoundAmbience {
  return value === 'close' || value === 'studio' || value === 'hall'
}

function sameMidiSet(
  previous: ReadonlySet<number>,
  next: ReadonlySet<number>,
): boolean {
  if (previous.size !== next.size) return false
  for (const midiNote of previous) {
    if (!next.has(midiNote)) return false
  }
  return true
}

function scoringSourceFor(
  source: PianoNightSource,
): PianoPerformanceScoringSource {
  const tempoMap = source.stage.tempoMap
  return Object.freeze({
    sourceId: source.id,
    notes: source.stage.notes,
    scoreTimeAtBeatMs: (beat: number) =>
      pianoTempoBeatToSeconds(tempoMap, beat) * 1000,
  })
}

function samplePrewarmMidis(
  notes: readonly { midi: number; startBeat: number; duration: number }[],
  windowStartBeat: number,
): number[] {
  const horizonBeat = windowStartBeat + SAMPLE_WINDOW_BEATS
  const midis = new Set<number>()
  for (const note of notes) {
    if (
      note.startBeat < horizonBeat &&
      note.startBeat + note.duration > windowStartBeat
    ) {
      midis.add(note.midi)
    }
  }
  return Array.from(midis)
}

function sampleWindowStartBeat(playheadBeat: number): number {
  const normalizedBeat = Number.isFinite(playheadBeat)
    ? Math.max(0, playheadBeat)
    : 0
  return Math.floor(normalizedBeat / SAMPLE_WINDOW_BEATS) * SAMPLE_WINDOW_BEATS
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

export function usePianoNightController() {
  const [source, setSource] = createSignal<PianoNightSource>(
    PIANO_NIGHT_INCLUDED_SOURCE,
  )
  const [practiceLoop, setPracticeLoop] =
    createSignal<PianoNightPracticeLoopState>(INITIAL_PIANO_NIGHT_PRACTICE_LOOP)
  const [practiceSpeed, setPracticeSpeedState] = createPersistedSignal<number>(
    PRACTICE_SPEED_STORAGE_KEY,
    1,
    { validator: isPianoNightPracticeSpeed },
  )
  const [masterVolume, setMasterVolumeState] = createPersistedSignal<number>(
    MASTER_VOLUME_STORAGE_KEY,
    PIANO_NIGHT_DEFAULT_MASTER_VOLUME,
    {
      validator: (value): value is number =>
        typeof value === 'number' &&
        Number.isFinite(value) &&
        value >= 0 &&
        value <= 1,
    },
  )
  const stage = () => source().stage
  const arrangement = createMemo(() => createPianoNightArrangement(source()))
  const projectActiveMidis = createMemo(() =>
    createPianoNightActiveMidiIndex(stage().notes),
  )
  const transport = createPianoAudioClockTransport({
    totalBeats: () => stage().totalBeats,
    tempoMap: () => stage().tempoMap,
    initialTempoBpm: stage().initialTempoBpm,
    initialSpeed: practiceSpeed(),
  })
  const fallbackSynth = createPianoFallbackSynth({
    getAudioContext: () => transport.getAudioContext(),
  })
  const instrument = createPianoInstrumentRouter({
    fallback: fallbackSynth,
    preference: 'fallback',
  })
  instrument.setVolume(masterVolume())
  const scheduler = createPianoPerformanceScheduler({
    transport,
    notes: () => arrangement().audibleNotes,
    synth: instrument,
    playbackEndBeat: () => {
      const loop = practiceLoop()
      return loop.enabled ? (loop.range?.endBeat ?? null) : null
    },
  })
  const input = createPianoInputState()
  type InputTransportSample = Readonly<{
    beat: number
    phase: ReturnType<typeof transport.phase>
  }>
  let prepareInputTransportSample = (): InputTransportSample => ({
    beat: transport.timeline.playheadBeat(),
    phase: transport.phase(),
  })
  let pendingInputTransportSample: InputTransportSample | null = null
  const withInputTransportSample = <T>(apply: () => T): T => {
    const transportSample = prepareInputTransportSample()
    pendingInputTransportSample = transportSample
    try {
      return apply()
    } finally {
      pendingInputTransportSample = null
    }
  }
  const boundaryAwareInput: PianoInputState = {
    apply(event) {
      return withInputTransportSample(() => input.apply(event))
    },
    snapshot: input.snapshot,
    subscribe: input.subscribe,
  }
  const scoring = createPianoPerformanceScoringEngine(
    // eslint-disable-next-line solid/reactivity -- one-time seed; source swaps are explicit below
    scoringSourceFor(source()),
    { playheadBeat: 0, input: input.snapshot() },
  )
  const touch = createTouchPianoInputPort({
    input,
    sourceId: 'piano-night-keys',
    sourceName: 'Piano Night keys',
    defaultVelocity: 0.78,
  })
  const midi = createWebMidiInputPort({
    onInput: (event) => boundaryAwareInput.apply(event),
  })

  const [playheadBeat, setPlayheadBeat] = createSignal(0)
  const [inputSnapshot, setInputSnapshot] = createSignal<PianoInputSnapshot>(
    input.snapshot(),
  )
  const [midiSnapshot, setMidiSnapshot] =
    createSignal<WebMidiInputPortSnapshot>(midi.snapshot())
  const [observedPedals, setObservedPedals] = createSignal<
    ReadonlySet<PianoPedalKind>
  >(new Set())
  const [audioError, setAudioError] = createSignal<string | null>(null)
  const [audioActive, setAudioActive] = createSignal(false)
  const [instrumentPreference, setInstrumentPreferenceState] =
    createPersistedSignal<PianoInstrumentPreference>(
      INSTRUMENT_STORAGE_KEY,
      'auto',
      { validator: isInstrumentPreference },
    )
  const [soundLoadStatus, setSoundLoadStatus] =
    createSignal<PianoNightSoundLoadStatus>('idle')
  const [soundLoadError, setSoundLoadError] = createSignal<string | null>(null)
  const [soundLoadedSamples, setSoundLoadedSamples] = createSignal(0)
  const [soundTotalSamples, setSoundTotalSamples] = createSignal(0)
  const [soundRefining, setSoundRefining] = createSignal(false)
  const [soundCharacter, setSoundCharacterState] =
    createPersistedSignal<PianoNightSoundCharacter>(
      SOUND_CHARACTER_STORAGE_KEY,
      'balanced',
      { validator: isSoundCharacter },
    )
  const [soundAmbience, setSoundAmbienceState] =
    createPersistedSignal<PianoNightSoundAmbience>(
      SOUND_AMBIENCE_STORAGE_KEY,
      'studio',
      { validator: isSoundAmbience },
    )
  // The OS signal is advisory here. It strips the decorative transitions
  // (see the prefers-reduced-motion block in PianoNightApp.module.css) and
  // surfaces the stage-motion choice in the drawer, but it does NOT stop
  // the fall: WCAG exempts motion essential to the function, and on this
  // stage the descent is the notation.
  const [systemReducedMotion, setSystemReducedMotion] = createSignal(false)
  const [stageMotion, setStageMotion] =
    createPersistedSignal<PianoNightStageMotion>(
      STAGE_MOTION_STORAGE_KEY,
      'flowing',
      { validator: isPianoNightStageMotion },
    )
  const [scoringState, setScoringState] =
    createSignal<PianoPerformanceScoringState>(scoring.snapshot())
  const [statusMessage, setStatusMessage] = createSignal(
    `${stage().title} is ready. Audio and input are off.`,
  )
  const [practiceRunComplete, setPracticeRunComplete] = createSignal(false)

  const pendingPointers = new Map<number, number>()
  const keyboardReleaseTimers = new Map<number, number>()
  let frame: number | null = null
  let uninstallAudioUnlock: (() => void) | null = null
  let commandGeneration = 0
  let completionSettled = false
  let settlingPracticeBoundary = false
  let disposed = false
  let sampledInstrument:
    | (PianoNightSampledInstrument &
        Parameters<typeof instrument.setSampled>[0])
    | null = null
  let unsubscribeSampled: (() => void) | null = null
  let sampledUsable = false
  let samplePreparationPending = false
  let samplePreparationGeneration = 0
  let samplePreparationAbort: AbortController | null = null
  let samplePreparationMode: PianoNightSamplePreparationMode | null = null
  let samplePreparationWindow: PianoNightSampleWindow | null = null
  let samplePreparationTail: Promise<void> = Promise.resolve()
  let lastRollingCurrentWindowKey: string | null = null

  const releaseLiveVoices = (): void => {
    pendingPointers.clear()
    for (const timer of keyboardReleaseTimers.values()) {
      window.clearTimeout(timer)
    }
    keyboardReleaseTimers.clear()
    touch.releaseAll()
    input.apply({ type: 'panic', timestampMs: performance.now() })
    instrument.panic()
  }

  const activeMidis = createMemo<ReadonlySet<number>>(
    () => {
      const active = new Set(
        inputSnapshot().soundingNotes.map((voice) => voice.midi),
      )
      if (transport.phase() === 'playing') {
        for (const midiNote of projectActiveMidis().atBeat(playheadBeat())) {
          active.add(midiNote)
        }
      }
      return active
    },
    new Set<number>(),
    { equals: sameMidiSet },
  )

  const scoringPlaybackRate = (beat: number): number => {
    const authoredTempo = transport.authoredTempoBpmAtBeat(beat)
    return transport.effectiveTempoBpmAtBeat(beat) / authoredTempo
  }

  const applyScoringUpdate = (update: PianoPerformanceScoringUpdate): void => {
    if (update.state.revision !== scoringState().revision) {
      setScoringState(update.state)
    }
  }

  const sampleScoring = (
    snapshot: PianoInputSnapshot,
    beat: number,
    phase = transport.phase(),
  ): void => {
    applyScoringUpdate(
      scoring.sample({
        phase,
        playheadBeat: beat,
        sampledAtMs: performance.now(),
        playbackRate: scoringPlaybackRate(beat),
        input: snapshot,
      }),
    )
  }

  const cancelFrame = (): void => {
    if (frame === null) return
    cancelAnimationFrame(frame)
    frame = null
  }

  const settleCompletion = (beat: number): void => {
    if (completionSettled) return
    completionSettled = true
    sampleScoring(input.snapshot(), beat, 'complete')
    scheduler.stop()
    releaseLiveVoices()
    setStatusMessage(`${stage().title} complete. Ready to play again.`)
  }

  const isAtPracticeBoundary = (beat: number): boolean => {
    const loop = practiceLoop()
    return (
      !practiceRunComplete() &&
      loop.enabled &&
      loop.range !== null &&
      beat >= loop.range.endBeat
    )
  }

  const settlePracticeBoundary = (beat: number): boolean => {
    const loop = practiceLoop()
    const range = loop.range
    const phase = transport.phase()
    if (
      practiceRunComplete() ||
      settlingPracticeBoundary ||
      !loop.enabled ||
      range === null ||
      (phase !== 'playing' && phase !== 'complete') ||
      beat < range.endBeat
    ) {
      return false
    }

    settlingPracticeBoundary = true
    try {
      const finished = scoring.sample({
        phase: 'complete',
        playheadBeat: range.endBeat,
        sampledAtMs: performance.now(),
        playbackRate: scoringPlaybackRate(range.endBeat),
        input: input.snapshot(),
      })
      applyScoringUpdate(finished)
      scheduler.stop()
      releaseLiveVoices()

      if (loop.currentPass < loop.repeatCount) {
        const nextPass = loop.currentPass + 1
        const rebased = transport.rebasePlayingBeat(range.startBeat)
        if (!rebased) {
          setStatusMessage('The practice loop could not restart. Press Play.')
          return true
        }
        applyScoringUpdate(
          scoring.reset(
            {
              playheadBeat: range.startBeat,
              input: input.snapshot(),
            },
            range,
          ),
        )
        setPracticeLoop({ ...loop, currentPass: nextPass })
        setPlayheadBeat(range.startBeat)
        completionSettled = false
        setPracticeRunComplete(false)
        prepareCurrentSampleWindow(range.startBeat)
        scheduler.start()
        setStatusMessage(
          `Pass ${loop.currentPass} finished at ${finished.state.accuracyPercent}%. Pass ${nextPass} of ${loop.repeatCount}.`,
        )
        return true
      }

      completionSettled = true
      setPracticeRunComplete(true)
      if (phase === 'playing') transport.pause()
      transport.seekToBeat(range.endBeat)
      setPlayheadBeat(range.endBeat)
      setStatusMessage(
        `Practice complete — ${loop.repeatCount} passes. Final pass ${finished.state.accuracyPercent}%.`,
      )
      return true
    } finally {
      settlingPracticeBoundary = false
    }
  }

  // eslint-disable-next-line solid/reactivity -- invoked only by MIDI/touch event handlers
  prepareInputTransportSample = (): InputTransportSample => {
    let beat = transport.timeline.playheadBeat()
    let phase = transport.phase()

    // Input events arrive outside the presentation RAF. Settle B against the
    // audio clock before the normalized onset can become scoring evidence.
    // Re-read after each synchronous transport notification because a final
    // beat read can rebase an intermediate pass to A while returning stale B.
    if (phase === 'complete' && isAtPracticeBoundary(beat)) {
      settlePracticeBoundary(beat)
      beat = transport.timeline.playheadBeat()
      phase = transport.phase()
    } else if (phase === 'playing' && isAtPracticeBoundary(beat)) {
      beat = transport.timeline.playheadBeat()
      phase = transport.phase()
    }

    if (phase === 'playing' && isAtPracticeBoundary(beat)) {
      settlePracticeBoundary(beat)
      beat = transport.timeline.playheadBeat()
      phase = transport.phase()
    }

    return { beat, phase }
  }

  // Presentation cap: every setPlayheadBeat write re-renders the falling
  // notes and key glow, and on a low-tier device (a television) capping that
  // hands the saved budget back to the audio thread. Capable devices keep an
  // uncapped clock (presentationFps() is Infinity, so the limiter passes
  // everything). Adaptive on purpose: recordAnimationFrame below is what
  // demotes a struggling device, and the cap must land on THIS session, not
  // the next mount. Scoring still samples EVERY frame — it is cheap next to
  // a render, and capping it would coarsen hit timing.
  const presentationLimiter = createAdaptiveFrameRateLimiter(presentationFps)

  const sampleClock = (timestampMs: number): void => {
    // The callback has consumed this request. Any synchronous transport
    // notification may now schedule exactly one successor via startFrame().
    frame = null
    recordAnimationFrame(timestampMs)
    let beat = transport.timeline.playheadBeat()
    let phase = transport.phase()
    if (phase === 'playing' && isAtPracticeBoundary(beat)) {
      beat = transport.timeline.playheadBeat()
      phase = transport.phase()
      if (phase === 'playing' && isAtPracticeBoundary(beat)) {
        settlePracticeBoundary(beat)
        beat = transport.timeline.playheadBeat()
        phase = transport.phase()
      }
    }
    if (
      presentationLimiter.shouldRun(timestampMs / 1000) ||
      // The final position must land exactly, cap or no cap.
      phase !== 'playing'
    ) {
      setPlayheadBeat(beat)
    }
    if (phase !== 'playing') {
      frame = null
      if (phase === 'complete') settleCompletion(beat)
      else scheduler.stop()
      return
    }
    sampleScoring(input.snapshot(), beat, phase)
    maybePrepareNextSampleWindow(beat)
    startFrame()
  }

  const startFrame = (): void => {
    if (frame === null) frame = requestAnimationFrame(sampleClock)
  }

  const syncTransport = (): void => {
    let beat = transport.timeline.playheadBeat()
    let phase = transport.phase()

    // A final-beat read can synchronously flip the transport to complete.
    // Settle that boundary before cancelling the only pending presentation
    // frame, then re-read because an intermediate pass rebases to A.
    if (phase === 'complete' && isAtPracticeBoundary(beat)) {
      settlePracticeBoundary(beat)
      beat = transport.timeline.playheadBeat()
      phase = transport.phase()
    } else if (phase === 'playing' && isAtPracticeBoundary(beat)) {
      // An outer accessor can retain the old B value after its synchronous
      // completion notification already rebased the nested subscriber to A.
      beat = transport.timeline.playheadBeat()
      phase = transport.phase()
    }

    if (phase === 'playing' && isAtPracticeBoundary(beat)) {
      settlePracticeBoundary(beat)
      beat = transport.timeline.playheadBeat()
      phase = transport.phase()
    }

    setPlayheadBeat(beat)
    if (phase === 'playing') {
      completionSettled = false
      startFrame()
      return
    }
    cancelFrame()
    if (phase === 'complete') settleCompletion(beat)
    else scheduler.stop()
  }

  const armAudioRecovery = (): void => {
    if (uninstallAudioUnlock !== null) return
    uninstallAudioUnlock = installAudioUnlock(() => transport.getAudioContext())
  }

  const activateAudio = async (): Promise<boolean> => {
    const activated = await transport.activate()
    if (disposed) return false
    if (activated) {
      armAudioRecovery()
      setAudioActive(true)
      setAudioError(null)
      return true
    }
    const message =
      "Audio could not start. Check this browser's audio permission and try again."
    setAudioError(message)
    setStatusMessage(message)
    return false
  }

  const syncSampledState = (): void => {
    if (sampledInstrument === null) return
    const snapshot = sampledInstrument.getLoadSnapshot()
    if (!sampledUsable && samplePreparationPending && snapshot.playable) {
      // The requested-key coverage pass is the audible readiness boundary.
      // Optional layers stay on the same serialized preparation so a seek or
      // teardown can still cancel them without delaying Grand selection.
      sampledUsable = true
      applyRequestedInstrument()
      if (instrumentPreference() !== 'fallback') {
        setStatusMessage('Mercury Concert Grand is ready.')
      }
    }
    if (sampledUsable) {
      // A rolling decode never changes the selected output. Missing zones
      // continue through the router's per-note fallback while it is pending.
      setSoundLoadStatus('ready')
    } else if (samplePreparationPending) {
      setSoundLoadStatus(snapshot.status === 'error' ? 'error' : 'loading')
    } else {
      setSoundLoadStatus(snapshot.status === 'ready' ? 'idle' : snapshot.status)
    }
    setSoundLoadError(
      sampledUsable && snapshot.status === 'error' ? null : snapshot.error,
    )
    setSoundLoadedSamples(snapshot.preparedSamples)
    setSoundTotalSamples(snapshot.plannedSamples)
    setSoundRefining(
      sampledUsable &&
        snapshot.status === 'loading' &&
        snapshot.preparedSamples < snapshot.plannedSamples,
    )
  }

  const sampleWindowStartingAt = (
    requestedStartBeat: number,
  ): PianoNightSampleWindow => {
    // Read every reactive source before the asynchronous preparation begins.
    const currentSource = source()
    const notes = arrangement().audibleNotes
    const startBeat = sampleWindowStartBeat(requestedStartBeat)
    return Object.freeze({
      key: `${currentSource.id}:${startBeat}`,
      midis: Object.freeze(samplePrewarmMidis(notes, startBeat)),
      sourceId: currentSource.id,
      startBeat,
      coveredThroughBeat: startBeat + SAMPLE_WINDOW_BEATS,
    })
  }

  const combinedSampleWindow = (
    current: PianoNightSampleWindow,
    next: PianoNightSampleWindow,
  ): PianoNightSampleWindow =>
    Object.freeze({
      key: `${current.key}+${next.key}`,
      midis: Object.freeze([...current.midis, ...next.midis]),
      sourceId: current.sourceId,
      startBeat: current.startBeat,
      coveredThroughBeat: next.coveredThroughBeat,
    })

  const applyRequestedInstrument = (): void => {
    const preference = instrumentPreference()
    instrument.setPreference(
      preference === 'fallback' ? 'fallback' : preference,
    )
  }

  const failInitialSamplePreparation = (message: string): void => {
    instrument.setPreference('fallback')
    setSoundLoadStatus('error')
    setSoundLoadError(message)
    setStatusMessage(
      'Concert grand unavailable. Mercury Felt Synth remains active.',
    )
  }

  const cancelSamplePreparation = (resetUnusableState = false): void => {
    samplePreparationGeneration += 1
    samplePreparationAbort?.abort()
    samplePreparationAbort = null
    samplePreparationMode = null
    samplePreparationWindow = null
    samplePreparationPending = false
    if (resetUnusableState && !sampledUsable) {
      instrument.setPreference('fallback')
      setSoundLoadStatus('idle')
      setSoundLoadError(null)
    }
  }

  const prepareSampleWindow = (
    window: PianoNightSampleWindow,
    mode: PianoNightSamplePreparationMode,
    activation?: Promise<boolean>,
  ): Promise<boolean> => {
    if (disposed) return Promise.resolve(false)

    const previousPreparation = samplePreparationTail
    samplePreparationAbort?.abort()
    const controller = new AbortController()
    const generation = ++samplePreparationGeneration
    samplePreparationAbort = controller
    samplePreparationMode = mode
    samplePreparationWindow = window
    samplePreparationPending = true
    if (!sampledUsable) {
      instrument.setPreference('fallback')
      setSoundLoadStatus('loading')
      setSoundLoadError(null)
    }

    const isCurrent = (): boolean =>
      !disposed &&
      !controller.signal.aborted &&
      generation === samplePreparationGeneration
    const finishCurrentPreparation = (): void => {
      if (generation !== samplePreparationGeneration) return
      samplePreparationAbort = null
      samplePreparationMode = null
      samplePreparationWindow = null
      samplePreparationPending = false
    }

    const request = (async (): Promise<boolean> => {
      await previousPreparation
      if (!isCurrent()) return false

      if (activation !== undefined) {
        const activated = await activation
        if (!isCurrent()) return false
        if (!activated) {
          failInitialSamplePreparation(
            audioError() ??
              "Audio could not start. Check this browser's audio permission and try again.",
          )
          finishCurrentPreparation()
          return false
        }
      }

      try {
        let activeSampledInstrument = sampledInstrument
        if (activeSampledInstrument === null) {
          if (mode !== 'initial') return false
          const module =
            await import('@/features/piano/instrument/piano-sampled-instrument')
          if (!isCurrent()) return false
          activeSampledInstrument = module.createPianoSampledInstrument({
            getAudioContext: () => transport.getAudioContext(),
          })
          activeSampledInstrument.setCharacter(soundCharacter())
          activeSampledInstrument.setAmbience(soundAmbience())
          sampledInstrument = activeSampledInstrument
          unsubscribeSampled =
            activeSampledInstrument.subscribe(syncSampledState)
          // setSampled follows the router's explicit fallback selection so an
          // attached but unprepared engine can never become audible.
          instrument.setPreference('fallback')
          instrument.setSampled(activeSampledInstrument)
        }

        if (window.midis.length > 0) {
          await activeSampledInstrument.prewarm(window.midis, controller.signal)
        } else {
          await activeSampledInstrument.load(controller.signal)
        }
        if (!isCurrent()) return false

        const becameUsable = !sampledUsable
        sampledUsable = true
        syncSampledState()
        applyRequestedInstrument()
        if (
          (mode === 'initial' || becameUsable) &&
          instrumentPreference() !== 'fallback'
        ) {
          setStatusMessage('Mercury Concert Grand is ready.')
        }
        return true
      } catch (error) {
        if (!isCurrent() || isAbortError(error)) return false
        if (!sampledUsable) {
          failInitialSamplePreparation(
            error instanceof Error
              ? error.message
              : 'The sample bank did not load.',
          )
        } else {
          // Existing decoded zones remain usable. The router handles any
          // missing note in this window with the lightweight synth.
          setSoundLoadStatus('ready')
          setSoundLoadError(null)
        }
        return false
      } finally {
        finishCurrentPreparation()
      }
    })()

    samplePreparationTail = request.then(
      () => undefined,
      () => undefined,
    )
    return request
  }

  const prepareCurrentSampleWindow = (beat: number): void => {
    lastRollingCurrentWindowKey = null
    if (sampledInstrument === null) return
    void prepareSampleWindow(sampleWindowStartingAt(beat), 'current')
  }

  const maybePrepareNextSampleWindow = (beat: number): void => {
    if (
      !sampledUsable ||
      sampledInstrument === null ||
      instrumentPreference() === 'fallback'
    ) {
      return
    }
    if (
      samplePreparationAbort !== null &&
      samplePreparationMode !== 'rolling' &&
      !sampledUsable
    ) {
      return
    }

    const currentWindowStart = sampleWindowStartBeat(beat)
    const currentWindow = sampleWindowStartingAt(currentWindowStart)
    if (lastRollingCurrentWindowKey === currentWindow.key) return

    // Only reuse a pending plan that began at this exact current window. A
    // previous current+lookahead plan can exceed the sampler's root budget, so
    // crossing the bar boundary must reprioritize the newly current notes.
    if (
      samplePreparationWindow !== null &&
      samplePreparationWindow.sourceId === currentWindow.sourceId &&
      samplePreparationWindow.startBeat === currentWindow.startBeat &&
      samplePreparationWindow.coveredThroughBeat > currentWindow.startBeat &&
      (samplePreparationMode === 'rolling' ||
        samplePreparationWindow.coveredThroughBeat >=
          Math.min(
            stage().totalBeats,
            currentWindow.startBeat + SAMPLE_WINDOW_BEATS * 2,
          ))
    ) {
      return
    }

    const nextWindowStart = currentWindowStart + SAMPLE_WINDOW_BEATS
    lastRollingCurrentWindowKey = currentWindow.key
    if (nextWindowStart >= stage().totalBeats) {
      void prepareSampleWindow(currentWindow, 'rolling')
      return
    }
    void prepareSampleWindow(
      combinedSampleWindow(
        currentWindow,
        sampleWindowStartingAt(nextWindowStart),
      ),
      'rolling',
    )
  }

  const loadSampledInstrument = (): Promise<boolean> => {
    if (disposed) return Promise.resolve(false)
    const window = sampleWindowStartingAt(transport.timeline.playheadBeat())
    // Start activation synchronously inside the user's gesture. Preparation
    // itself remains serialized behind any aborted decode.
    const activation = activateAudio()
    return prepareSampleWindow(window, 'initial', activation)
  }

  const setInstrumentPreference = (
    preference: PianoInstrumentPreference,
  ): void => {
    setInstrumentPreferenceState(preference)
    if (preference === 'fallback') {
      instrument.setPreference('fallback')
      setStatusMessage('Mercury Felt Synth selected.')
      return
    }
    if (sampledUsable && sampledInstrument !== null) {
      instrument.setPreference(preference)
      prepareCurrentSampleWindow(transport.timeline.playheadBeat())
      setStatusMessage('Mercury Concert Grand selected.')
      return
    }
    instrument.setPreference('fallback')
  }

  const setSoundCharacter = (character: PianoNightSoundCharacter): void => {
    setSoundCharacterState(character)
    sampledInstrument?.setCharacter(character)
  }

  const setSoundAmbience = (ambience: PianoNightSoundAmbience): void => {
    setSoundAmbienceState(ambience)
    sampledInstrument?.setAmbience(ambience)
  }

  const syncInstrumentPedal = (
    snapshot: PianoInputSnapshot,
    pedal: PianoPedalKind,
  ): void => {
    instrument.pedal({
      pedal,
      value: snapshot.pedals.reduce(
        (maximum, state) => Math.max(maximum, state[pedal]),
        0,
      ),
    })
  }

  const syncInstrumentPedals = (snapshot: PianoInputSnapshot): void => {
    for (const pedal of ['sustain', 'sostenuto', 'soft'] as const) {
      syncInstrumentPedal(snapshot, pedal)
    }
  }

  // These route-owned imperative ports invoke callbacks outside Solid's graph.
  // eslint-disable-next-line solid/reactivity -- external transport callback
  const unsubscribeTransport = transport.subscribe(syncTransport)
  const unsubscribeMidi = midi.subscribe(setMidiSnapshot)
  // eslint-disable-next-line solid/reactivity -- external input callback
  const unsubscribeInput = input.subscribe((update) => {
    const inputTransportSample = pendingInputTransportSample
    if (update.event.type === 'pedal') {
      const pedal = update.event.pedal
      syncInstrumentPedal(update.snapshot, pedal)
      setObservedPedals((current) => {
        const next = new Set<PianoPedalKind>(current)
        next.add(pedal)
        return next
      })
    } else if (
      update.event.type === 'reset-controllers' ||
      update.event.type === 'source-disconnected' ||
      update.event.type === 'panic'
    ) {
      // The normalized input state has already removed the affected pedal
      // values. Mirror its remaining aggregate into the sound engines without
      // panicking scheduled score voices.
      syncInstrumentPedals(update.snapshot)
      if (
        update.event.type === 'source-disconnected' ||
        update.event.type === 'panic'
      ) {
        setObservedPedals(new Set<PianoPedalKind>())
      }
    }
    for (const voice of update.soundingStarted) {
      instrument.noteOn({
        id: `live:${voice.id}`,
        midi: voice.midi,
        velocity: voice.velocity,
        softPedalValue: voice.softPedalValue,
      })
    }
    for (const voice of update.soundingStopped) {
      instrument.noteOff({
        id: `live:${voice.id}`,
        releaseVelocity: voice.releaseVelocity,
      })
    }
    setInputSnapshot(update.snapshot)
    sampleScoring(
      update.snapshot,
      inputTransportSample?.beat ?? transport.timeline.playheadBeat(),
      inputTransportSample?.phase ?? transport.phase(),
    )
  })

  const cancelPendingPlayForPracticeMutation = (): void => {
    if (transport.phase() !== 'loading') return
    commandGeneration += 1
    transport.pause()
    cancelFrame()
  }

  const configurePracticeLoop = (
    requestedRange: PianoNightPracticeRange,
  ): boolean => {
    const range = normalizePianoNightPracticeRange(
      requestedRange,
      stage().totalBeats,
    )
    if (range === null) {
      setStatusMessage('Choose a practice range at least a quarter beat long.')
      return false
    }

    cancelPendingPlayForPracticeMutation()
    cancelSamplePreparation(true)
    scheduler.stop()
    releaseLiveVoices()
    setPracticeRunComplete(false)
    completionSettled = false
    setPracticeLoop((current) => ({
      range,
      enabled: true,
      repeatCount: current.repeatCount,
      currentPass: 1,
    }))
    transport.seekToBeat(range.startBeat)
    applyScoringUpdate(
      scoring.reset(
        { playheadBeat: range.startBeat, input: input.snapshot() },
        range,
      ),
    )
    setPlayheadBeat(range.startBeat)
    if (transport.phase() === 'playing') scheduler.start()
    else scheduler.stop()
    prepareCurrentSampleWindow(range.startBeat)
    setStatusMessage(
      `Practice loop set from beat ${range.startBeat.toFixed(1)} to ${range.endBeat.toFixed(1)}. Pass 1 of ${practiceLoop().repeatCount}.`,
    )
    return true
  }

  const setPracticeLoopStart = (beat: number): boolean => {
    const current = practiceLoop().range
    return configurePracticeLoop({
      startBeat: beat,
      endBeat: current?.endBeat ?? stage().totalBeats,
    })
  }

  const setPracticeLoopEnd = (beat: number): boolean => {
    const current = practiceLoop().range
    return configurePracticeLoop({
      startBeat: current?.startBeat ?? 0,
      endBeat: beat,
    })
  }

  const setPracticeLoopEnabled = (enabled: boolean): boolean => {
    const loop = practiceLoop()
    const range = loop.range
    if (enabled && range === null) {
      setStatusMessage('Set a section or A/B range before turning repeat on.')
      return false
    }
    if (loop.enabled === enabled) return true

    cancelPendingPlayForPracticeMutation()
    scheduler.stop()
    releaseLiveVoices()
    setPracticeRunComplete(false)
    completionSettled = false
    const currentBeat = transport.timeline.playheadBeat()
    const targetBeat =
      enabled &&
      range !== null &&
      !isBeatInPianoNightPracticeRange(currentBeat, range)
        ? range.startBeat
        : currentBeat
    setPracticeLoop({ ...loop, enabled, currentPass: 1 })
    transport.seekToBeat(targetBeat)
    applyScoringUpdate(
      scoring.reset(
        { playheadBeat: targetBeat, input: input.snapshot() },
        enabled && range !== null ? range : undefined,
      ),
    )
    setPlayheadBeat(targetBeat)
    if (transport.phase() === 'playing') scheduler.start()
    prepareCurrentSampleWindow(targetBeat)
    setStatusMessage(
      enabled
        ? `Repeat on. Pass 1 of ${loop.repeatCount}.`
        : 'Repeat off. The A/B markers are saved.',
    )
    return true
  }

  const clearPracticeLoop = (): void => {
    const loop = practiceLoop()
    const beat = transport.timeline.playheadBeat()
    cancelPendingPlayForPracticeMutation()
    scheduler.stop()
    releaseLiveVoices()
    setPracticeRunComplete(false)
    completionSettled = false
    setPracticeLoop({
      range: null,
      enabled: false,
      repeatCount: loop.repeatCount,
      currentPass: 1,
    })
    applyScoringUpdate(
      scoring.reset({ playheadBeat: beat, input: input.snapshot() }),
    )
    if (transport.phase() === 'playing') scheduler.start()
    setStatusMessage('Practice loop cleared.')
  }

  const setPracticeRepeatCount = (repeatCount: number): void => {
    const current = practiceLoop()
    const clamped = Math.max(
      current.currentPass,
      clampPianoNightRepeatCount(repeatCount),
    )
    setPracticeLoop({ ...current, repeatCount: clamped })
    setStatusMessage(`Practice will finish after ${clamped} passes.`)
  }

  const setPracticeSpeed = (speed: number): boolean => {
    if (!isPianoNightPracticeSpeed(speed)) return false
    const beat = transport.timeline.playheadBeat()
    applyScoringUpdate(
      scoring.discontinue({
        reason: 'rate-change',
        playheadBeat: beat,
        input: input.snapshot(),
      }),
    )
    transport.setSpeed(speed)
    setPracticeSpeedState(speed)
    if (transport.phase() === 'playing') scheduler.refresh()
    syncTransport()
    setStatusMessage(`Practice speed set to ${speed}×.`)
    return true
  }

  const setMasterVolume = (volume: number): void => {
    const normalized = clampPianoNightMasterVolume(volume)
    setMasterVolumeState(normalized)
    instrument.setVolume(normalized)
    setStatusMessage(`Piano volume set to ${Math.round(normalized * 100)}%.`)
  }

  const play = async (): Promise<boolean> => {
    const loop = practiceLoop()
    const range = loop.enabled ? loop.range : null
    if (practiceRunComplete() && range !== null) {
      transport.seekToBeat(range.startBeat)
      applyScoringUpdate(
        scoring.reset(
          { playheadBeat: range.startBeat, input: input.snapshot() },
          range,
        ),
      )
      setPracticeLoop({ ...loop, currentPass: 1 })
      setPlayheadBeat(range.startBeat)
      setPracticeRunComplete(false)
      completionSettled = false
      prepareCurrentSampleWindow(range.startBeat)
    }
    const generation = commandGeneration
    const previousPhase = transport.phase()
    if (previousPhase === 'complete') {
      // Playback restarts at beat zero, whose samples may have been evicted by
      // later rolling batches.
      prepareCurrentSampleWindow(0)
    }
    const started = await transport.play()
    if (disposed || generation !== commandGeneration) return false
    syncTransport()
    if (!started) {
      setAudioError(transport.error())
      setStatusMessage(
        transport.error() ?? 'The prepared score could not start.',
      )
      return false
    }
    armAudioRecovery()
    setAudioActive(true)
    setAudioError(null)
    const resumedPosition = {
      playheadBeat: transport.timeline.playheadBeat(),
      input: input.snapshot(),
    }
    applyScoringUpdate(
      previousPhase === 'complete'
        ? scoring.reset(resumedPosition, range ?? undefined)
        : scoring.discontinue({ reason: 'resume', ...resumedPosition }),
    )
    scheduler.start()
    startFrame()
    const effectiveInstrument = instrument.descriptor()
    setStatusMessage(
      `Playing ${stage().title} with ${effectiveInstrument.name}.`,
    )
    return true
  }

  const pause = (): void => {
    commandGeneration += 1
    transport.pause()
    scheduler.stop()
    applyScoringUpdate(
      scoring.discontinue({
        reason: 'pause',
        playheadBeat: transport.timeline.playheadBeat(),
        input: input.snapshot(),
      }),
    )
    releaseLiveVoices()
    syncTransport()
    setStatusMessage('Playback paused.')
  }

  const togglePlayback = (): void => {
    if (transport.phase() === 'playing') pause()
    else void play()
  }

  const stop = (): void => {
    commandGeneration += 1
    cancelSamplePreparation(true)
    scheduler.stop()
    cancelFrame()
    transport.stop()
    releaseLiveVoices()
    setPracticeRunComplete(false)
    completionSettled = false
    const loop = practiceLoop()
    const range = loop.enabled ? loop.range : null
    const resetBeat = range?.startBeat ?? 0
    if (resetBeat > 0) transport.seekToBeat(resetBeat)
    setPracticeLoop({ ...loop, currentPass: 1 })
    applyScoringUpdate(
      scoring.reset(
        { playheadBeat: resetBeat, input: input.snapshot() },
        range ?? undefined,
      ),
    )
    setPlayheadBeat(resetBeat)
    prepareCurrentSampleWindow(resetBeat)
    setStatusMessage(
      range === null
        ? `${stage().title} reset to the beginning.`
        : `Practice reset to beat ${range.startBeat.toFixed(1)}. Pass 1 of ${loop.repeatCount}.`,
    )
  }

  const seekToBeat = (beat: number): void => {
    const targetBeat = Number.isFinite(beat)
      ? Math.min(stage().totalBeats, Math.max(0, beat))
      : 0
    cancelPendingPlayForPracticeMutation()
    cancelSamplePreparation(true)
    const loop = practiceLoop()
    const leavesActiveRange =
      loop.enabled &&
      loop.range !== null &&
      !isBeatInPianoNightPracticeRange(targetBeat, loop.range)
    if (leavesActiveRange) {
      setPracticeLoop({ ...loop, enabled: false, currentPass: 1 })
      setPracticeRunComplete(false)
      completionSettled = false
      applyScoringUpdate(
        scoring.reset({
          playheadBeat: targetBeat,
          input: input.snapshot(),
        }),
      )
      setStatusMessage('Repeat paused because the playhead moved outside A/B.')
    } else {
      applyScoringUpdate(
        scoring.discontinue({
          reason: 'seek',
          playheadBeat: targetBeat,
          input: input.snapshot(),
        }),
      )
    }
    transport.seekToBeat(targetBeat)
    releaseLiveVoices()
    if (transport.phase() === 'playing') scheduler.refresh()
    else scheduler.stop()
    syncTransport()
    prepareCurrentSampleWindow(targetBeat)
  }

  const setTempoBpm = (tempoBpm: number): void => {
    applyScoringUpdate(
      scoring.discontinue({
        reason: 'rate-change',
        playheadBeat: transport.timeline.playheadBeat(),
        input: input.snapshot(),
      }),
    )
    transport.setTempoBpm(boundedTempoBpm(tempoBpm))
    if (transport.phase() === 'playing') scheduler.refresh()
    syncTransport()
    setStatusMessage(
      `Tempo set to ${Math.round(transport.timeline.tempoBpm())} BPM.`,
    )
  }

  const replaceSource = (nextSource: PianoNightSource): boolean => {
    if (
      disposed ||
      nextSource.stage.notes.length === 0 ||
      !(nextSource.stage.totalBeats > 0)
    ) {
      return false
    }

    commandGeneration += 1
    cancelSamplePreparation(true)
    scheduler.stop()
    cancelFrame()
    transport.stop()
    releaseLiveVoices()
    completionSettled = false
    setPracticeRunComplete(false)
    batch(() => {
      setSource(nextSource)
      setPracticeLoop((current) => ({
        range: null,
        enabled: false,
        repeatCount: current.repeatCount,
        currentPass: 1,
      }))
      transport.setTempoBpm(boundedTempoBpm(nextSource.stage.initialTempoBpm))
      setScoringState(
        scoring.replaceSource(scoringSourceFor(nextSource), {
          playheadBeat: 0,
          input: input.snapshot(),
        }).state,
      )
      setPlayheadBeat(0)
      setAudioError(null)
      setStatusMessage(`${nextSource.stage.title} is ready.`)
    })
    prepareCurrentSampleWindow(0)
    return true
  }

  const connectMidi = async (): Promise<boolean> => {
    setStatusMessage('Requesting MIDI access.')
    // Both requests begin inside the same explicit click gesture.
    const audioRequest = activateAudio()
    const midiRequest = midi.connect()
    const [audioReady, midiReady] = await Promise.all([
      audioRequest,
      midiRequest,
    ])
    if (disposed) return false
    const snapshot = midi.snapshot()
    setMidiSnapshot(snapshot)
    if (!audioReady) return false
    if (midiReady) {
      setStatusMessage(
        `MIDI keyboard connected to ${instrument.descriptor().name}.`,
      )
      return true
    }
    const message =
      snapshot.permission === 'unsupported'
        ? 'Web MIDI is not supported in this browser. Touch keys remain available.'
        : snapshot.permission === 'denied'
          ? 'MIDI access was denied. Allow it in browser settings, then retry.'
          : 'No MIDI input is available. Connect a keyboard, then retry.'
    setStatusMessage(message)
    return false
  }

  const disconnectMidi = (): void => {
    midi.disconnect()
    setMidiSnapshot(midi.snapshot())
    setStatusMessage('MIDI input disconnected. Touch keys remain available.')
  }

  const selectMidiInput = (inputId: string | null): boolean => {
    const selected = midi.selectInput(inputId)
    setMidiSnapshot(midi.snapshot())
    if (selected) {
      const device = midi
        .snapshot()
        .devices.find((candidate) => candidate.id === inputId)
      setStatusMessage(
        device === undefined
          ? 'MIDI input disconnected.'
          : `${device.name} selected for Piano Night.`,
      )
    }
    return selected
  }

  const pressTouchKey = (event: PointerEvent, midiNote: number): void => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    event.preventDefault()
    const target = event.currentTarget as HTMLElement | null
    target?.setPointerCapture?.(event.pointerId)
    pendingPointers.set(event.pointerId, midiNote)
    const pointerId = event.pointerId
    void activateAudio().then((activated) => {
      if (!activated || disposed) {
        pendingPointers.delete(pointerId)
        return
      }
      const pendingMidi = pendingPointers.get(pointerId)
      if (pendingMidi === undefined) return
      withInputTransportSample(() => touch.press(pointerId, pendingMidi))
      setStatusMessage(`Playing ${pendingMidi} from the touch keyboard.`)
    })
  }

  const moveTouchKey = (event: PointerEvent): void => {
    const active = touch
      .activePointers()
      .some((pointer) => pointer.pointerId === event.pointerId)
    if (!active && !pendingPointers.has(event.pointerId)) return
    const key = document
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest<HTMLElement>('[data-midi]')
    const midiNote = Number(key?.dataset.midi)
    if (!Number.isFinite(midiNote)) return
    if (pendingPointers.has(event.pointerId)) {
      pendingPointers.set(event.pointerId, midiNote)
    } else {
      withInputTransportSample(() => touch.move(event.pointerId, midiNote))
    }
  }

  const releaseTouchKey = (event: PointerEvent): void => {
    pendingPointers.delete(event.pointerId)
    withInputTransportSample(() => touch.release(event.pointerId))
    const target = event.currentTarget as HTMLElement | null
    if (target?.hasPointerCapture?.(event.pointerId) === true) {
      target.releasePointerCapture(event.pointerId)
    }
  }

  const playKeyboardKey = (midiNote: number): void => {
    const pointerId = -1000 - midiNote
    pendingPointers.set(pointerId, midiNote)
    void activateAudio().then((activated) => {
      if (!activated || disposed) {
        pendingPointers.delete(pointerId)
        return
      }
      if (pendingPointers.get(pointerId) !== midiNote) return
      withInputTransportSample(() => touch.press(pointerId, midiNote))
      const previousTimer = keyboardReleaseTimers.get(pointerId)
      if (previousTimer !== undefined) window.clearTimeout(previousTimer)
      const timer = window.setTimeout(() => {
        pendingPointers.delete(pointerId)
        withInputTransportSample(() => touch.release(pointerId))
        keyboardReleaseTimers.delete(pointerId)
      }, 420)
      keyboardReleaseTimers.set(pointerId, timer)
      setStatusMessage(`Playing ${midiNote} from the keyboard horizon.`)
    })
  }

  const panic = (message = 'All Piano Night notes released.'): void => {
    releaseLiveVoices()
    setStatusMessage(message)
  }

  onMount(() => {
    const motion =
      typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-reduced-motion: reduce)')
        : null
    const syncMotion = (): void => {
      setSystemReducedMotion(motion?.matches ?? false)
    }
    const onVisibility = (): void => {
      if (document.visibilityState === 'visible') return
      pause()
      panic(
        'Playback paused and all notes released while Piano Night is hidden.',
      )
    }
    syncMotion()
    motion?.addEventListener?.('change', syncMotion)
    document.addEventListener('visibilitychange', onVisibility)

    onCleanup(() => {
      motion?.removeEventListener?.('change', syncMotion)
      document.removeEventListener('visibilitychange', onVisibility)
    })
  })

  onCleanup(() => {
    disposed = true
    commandGeneration += 1
    cancelSamplePreparation()
    pendingPointers.clear()
    for (const timer of keyboardReleaseTimers.values()) {
      window.clearTimeout(timer)
    }
    keyboardReleaseTimers.clear()
    cancelFrame()
    scheduler.dispose()
    transport.pause()
    midi.dispose()
    touch.dispose()
    input.apply({ type: 'panic', timestampMs: performance.now() })
    unsubscribeMidi()
    unsubscribeInput()
    unsubscribeTransport()
    unsubscribeSampled?.()
    unsubscribeSampled = null
    instrument.dispose()
    uninstallAudioUnlock?.()
    uninstallAudioUnlock = null
    void transport.dispose()
  })

  return {
    source,
    stage,
    arrangement,
    transport,
    playheadBeat,
    activeMidis,
    inputSnapshot,
    midiSnapshot,
    observedPedals,
    audioError,
    audioActive,
    instrumentPreference,
    soundLoadStatus,
    soundLoadError,
    soundLoadedSamples,
    soundTotalSamples,
    soundRefining,
    soundCharacter,
    soundAmbience,
    practiceLoop,
    practiceRunComplete,
    practiceSpeed,
    masterVolume,
    systemReducedMotion,
    stageMotion,
    setStageMotion,
    statusMessage,
    scoringState,
    play,
    pause,
    stop,
    togglePlayback,
    seekToBeat,
    setTempoBpm,
    configurePracticeLoop,
    setPracticeLoopStart,
    setPracticeLoopEnd,
    setPracticeLoopEnabled,
    clearPracticeLoop,
    setPracticeRepeatCount,
    setPracticeSpeed,
    setMasterVolume,
    loadSampledInstrument,
    setInstrumentPreference,
    setSoundCharacter,
    setSoundAmbience,
    replaceSource,
    connectMidi,
    disconnectMidi,
    selectMidiInput,
    pressTouchKey,
    moveTouchKey,
    releaseTouchKey,
    playKeyboardKey,
    panic,
  }
}

export type PianoNightController = ReturnType<typeof usePianoNightController>
