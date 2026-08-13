// ============================================================
// Piano audio-clock transport — beat time derived from one lazy Web Audio clock
// ============================================================
//
// The transport owns no animation or timer loop. Consumers sample playheadBeat
// on their existing render loop, while AudioContext.currentTime remains the
// sole time authority. Construction and configuration stay silent: the context
// is created synchronously from the first explicit Play or live-input intent.

import type { Accessor } from 'solid-js'
import { createSignal } from 'solid-js'
import { activateAudioPlayback } from '@/lib/audio-unlock'
import type { PianoPerformancePhase, PianoPerformanceTransport, } from './piano-performance-contract'
import type { CompiledPianoTempoMap } from './piano-tempo-map'
import { compilePianoTempoMap, pianoTempoBeatToSeconds, pianoTempoBpmAtBeat, pianoTempoSecondsToBeat, } from './piano-tempo-map'

export interface PianoAudioClockTransportOptions {
  totalBeats: Accessor<number>
  /** Reactive stage map; replace sources only while this transport is stopped. */
  tempoMap?: Accessor<CompiledPianoTempoMap>
  initialTempoBpm?: number
  initialSpeed?: number
  contextFactory?: () => AudioContext
  activateContext?: (context: AudioContext) => Promise<void>
  closeContextOnDispose?: boolean
}

export interface PianoAudioClockTransport extends PianoPerformanceTransport {
  error: Accessor<string | null>
  /**
   * Activate the route-owned audio context without starting the score or
   * moving the playhead. Call this from live-key and MIDI-connect gestures.
   */
  activate(): Promise<boolean>
  /** BPM authored in the score before user tempo or speed scaling. */
  authoredTempoBpmAtBeat(beat: number): number
  /** Authored BPM scaled by the user's base-tempo choice, excluding speed. */
  scaledTempoBpmAtBeat(beat: number): number
  /** Actual performed BPM after base-tempo and playback-speed scaling. */
  effectiveTempoBpmAtBeat(beat: number): number
  /** Performed seconds from beat zero using the current tempo and speed. */
  playbackSecondsAtBeat(beat: number): number
  /** Absolute AudioContext time for a score beat, or null before activation. */
  contextTimeAtBeat(beat: number): number | null
  /** Score beat at an AudioContext time, clamped to this performance. */
  beatAtContextTime(contextTime: number): number
  /**
   * Re-anchor an already-running performance without activating another
   * context. A natural final-beat completion may re-enter playing so a
   * route-owned loop can wrap on the same audio clock.
   */
  rebasePlayingBeat(beat: number): boolean
  getAudioContext(): AudioContext | null
  subscribe(listener: () => void): () => void
  dispose(): Promise<void>
}

const DEFAULT_TEMPO_BPM = 120
const DEFAULT_SPEED = 1
const AUDIO_START_ERROR =
  "Audio could not start. Check this browser's audio permission and try again."

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

function positiveOr(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isFinite(value) && value > 0
    ? value
    : fallback
}

async function defaultActivateContext(context: AudioContext): Promise<void> {
  await activateAudioPlayback({
    getAudioContext: () => context,
    init: async () => undefined,
    resume: async () => context.resume(),
  })
}

export function createPianoAudioClockTransport(
  options: PianoAudioClockTransportOptions,
): PianoAudioClockTransport {
  const createContext =
    options.contextFactory ??
    (() => new AudioContext({ latencyHint: 'interactive' }))
  const activateContext = options.activateContext ?? defaultActivateContext
  const closeContextOnDispose = options.closeContextOnDispose ?? true
  const fallbackTempoMap = compilePianoTempoMap([
    {
      beat: 0,
      bpm: positiveOr(options.initialTempoBpm, DEFAULT_TEMPO_BPM),
    },
  ])
  const listeners = new Set<() => void>()
  const [revision, setRevision] = createSignal(0)

  let context: AudioContext | null = null
  let currentPhase: PianoPerformancePhase = 'ready'
  let currentError: string | null = null
  let tempoBpm = positiveOr(
    options.initialTempoBpm,
    (options.tempoMap?.() ?? fallbackTempoMap).initialTempoBpm,
  )
  let speed = positiveOr(options.initialSpeed, DEFAULT_SPEED)
  let parkedBeat = 0
  let startedBeat = 0
  let startedAtContextTime = 0
  let generation = 0
  let pendingActivation: Promise<boolean> | null = null
  let pendingPlay: Promise<boolean> | null = null
  let disposed = false

  const trackRevision = (): void => {
    revision()
  }

  const invalidateAccessors = (): void => {
    setRevision((value) => value + 1)
  }

  const emit = (): void => {
    invalidateAccessors()
    for (const listener of listeners) listener()
  }

  const setPhase = (
    nextPhase: PianoPerformancePhase,
    nextError: string | null = null,
  ): void => {
    if (currentPhase === nextPhase && currentError === nextError) return
    currentPhase = nextPhase
    currentError = nextError
    emit()
  }

  const totalBeats = (): number => {
    const value = options.totalBeats()
    return Number.isFinite(value) ? Math.max(0, value) : 0
  }

  const tempoMap = (): CompiledPianoTempoMap =>
    options.tempoMap?.() ?? fallbackTempoMap

  const baseTempoScale = (map: CompiledPianoTempoMap): number =>
    tempoBpm / map.initialTempoBpm

  const playbackRate = (map: CompiledPianoTempoMap): number =>
    baseTempoScale(map) * speed

  const beatAtContextTime = (contextTime: number): number => {
    const duration = totalBeats()
    if (currentPhase !== 'playing' || context === null) {
      return clamp(parkedBeat, 0, duration)
    }
    const map = tempoMap()
    const safeContextTime = Number.isFinite(contextTime)
      ? contextTime
      : context.currentTime
    const elapsedSeconds = Math.max(0, safeContextTime - startedAtContextTime)
    const authoredSeconds =
      pianoTempoBeatToSeconds(map, startedBeat) +
      elapsedSeconds * playbackRate(map)
    return clamp(pianoTempoSecondsToBeat(map, authoredSeconds), 0, duration)
  }

  const contextTimeAtBeat = (beat: number): number | null => {
    if (context === null) return null
    const map = tempoMap()
    const duration = totalBeats()
    const targetBeat = Number.isFinite(beat) ? clamp(beat, 0, duration) : 0
    const referenceBeat =
      currentPhase === 'playing' ? startedBeat : clamp(parkedBeat, 0, duration)
    const referenceContextTime =
      currentPhase === 'playing' ? startedAtContextTime : context.currentTime
    const authoredDelta =
      pianoTempoBeatToSeconds(map, targetBeat) -
      pianoTempoBeatToSeconds(map, referenceBeat)
    return referenceContextTime + authoredDelta / playbackRate(map)
  }

  const completeAt = (beat: number): number => {
    parkedBeat = beat
    startedBeat = beat
    if (context !== null) startedAtContextTime = context.currentTime
    setPhase('complete')
    return beat
  }

  const playheadBeat = (): number => {
    trackRevision()
    const duration = totalBeats()
    if (currentPhase !== 'playing' || context === null) {
      return clamp(parkedBeat, 0, duration)
    }

    const beat = beatAtContextTime(context.currentTime)
    if (beat >= duration) return completeAt(duration)
    parkedBeat = beat
    return clamp(beat, 0, duration)
  }

  const phase = (): PianoPerformancePhase => {
    trackRevision()
    playheadBeat()
    return currentPhase
  }

  const ensureContext = (): AudioContext => {
    if (context !== null) return context
    const created = createContext()
    context = created
    return created
  }

  const activate = (): Promise<boolean> => {
    if (disposed) return Promise.resolve(false)
    if (pendingActivation !== null) return pendingActivation

    let currentContext: AudioContext
    try {
      // Keep creation synchronous with the caller's gesture. In particular,
      // do not move this below the async boundary in the request below.
      currentContext = ensureContext()
    } catch {
      return Promise.resolve(false)
    }

    const request = (async (): Promise<boolean> => {
      try {
        await activateContext(currentContext)
      } catch {
        return false
      }
      return !disposed && context === currentContext
    })()

    pendingActivation = request
    void request.finally(() => {
      if (pendingActivation === request) pendingActivation = null
    })
    return request
  }

  const rebasePlayingRate = (setRate: () => void): void => {
    if (currentPhase !== 'playing' || context === null) {
      setRate()
      emit()
      return
    }

    const currentContextTime = context.currentTime
    const duration = totalBeats()
    const beat = beatAtContextTime(currentContextTime)
    if (beat >= duration) {
      completeAt(duration)
      setRate()
      emit()
      return
    }

    parkedBeat = beat
    startedBeat = beat
    startedAtContextTime = currentContextTime
    setRate()
    emit()
  }

  const beginPlay = (): Promise<boolean> => {
    if (disposed) return Promise.resolve(false)
    if (phase() === 'playing') return Promise.resolve(true)
    if (pendingPlay !== null) return pendingPlay

    const duration = totalBeats()
    if (duration <= 0) return Promise.resolve(false)
    if (currentPhase === 'complete' || parkedBeat >= duration) parkedBeat = 0

    const requestGeneration = ++generation
    setPhase('loading')

    const request = (async (): Promise<boolean> => {
      const activated = await activate()
      if (!activated) {
        if (!disposed && requestGeneration === generation) {
          setPhase('error', AUDIO_START_ERROR)
        }
        return false
      }

      if (disposed || requestGeneration !== generation) return false
      const currentContext = context
      if (currentContext === null) return false
      const latestDuration = totalBeats()
      if (latestDuration <= 0) {
        parkedBeat = 0
        setPhase('ready')
        return false
      }

      parkedBeat = clamp(parkedBeat, 0, latestDuration)
      startedBeat = parkedBeat
      startedAtContextTime = currentContext.currentTime
      setPhase('playing')
      return true
    })()

    pendingPlay = request
    void request.finally(() => {
      if (pendingPlay === request) pendingPlay = null
    })
    return request
  }

  return {
    phase,
    timeline: {
      playheadBeat,
      totalBeats,
      tempoBpm: () => {
        trackRevision()
        return tempoBpm
      },
    },
    speed: () => {
      trackRevision()
      return speed
    },
    error: () => {
      trackRevision()
      return currentError
    },

    activate,
    play: beginPlay,

    rebasePlayingBeat(beat) {
      if (
        disposed ||
        context === null ||
        (currentPhase !== 'playing' && currentPhase !== 'complete')
      ) {
        return false
      }

      const duration = totalBeats()
      if (!(duration > 0) || !Number.isFinite(beat)) return false
      const target = clamp(beat, 0, duration)
      if (target >= duration) return false

      parkedBeat = target
      startedBeat = target
      startedAtContextTime = context.currentTime
      if (currentPhase === 'playing') emit()
      else setPhase('playing')
      return true
    },

    pause() {
      if (disposed) return
      if (currentPhase === 'loading') {
        generation += 1
        pendingPlay = null
        setPhase(parkedBeat > 0 ? 'paused' : 'ready')
        return
      }
      if (currentPhase !== 'playing') return

      parkedBeat = playheadBeat()
      if (parkedBeat >= totalBeats()) return
      generation += 1
      setPhase('paused')
    },

    stop() {
      if (disposed) return
      generation += 1
      pendingPlay = null
      parkedBeat = 0
      startedBeat = 0
      if (context !== null) startedAtContextTime = context.currentTime
      setPhase('ready')
    },

    seekToBeat(beat) {
      if (disposed) return
      const duration = totalBeats()
      const target = Number.isFinite(beat) ? clamp(beat, 0, duration) : 0
      const wasPlaying = currentPhase === 'playing'
      parkedBeat = target
      startedBeat = target
      if (context !== null) startedAtContextTime = context.currentTime

      if (duration > 0 && target >= duration) {
        generation += 1
        pendingPlay = null
        setPhase('complete')
        return
      }
      if (currentPhase === 'complete' || currentPhase === 'error') {
        setPhase(target > 0 ? 'paused' : 'ready')
        return
      }
      if (wasPlaying) {
        emit()
        return
      }
      emit()
    },

    setTempoBpm(nextTempoBpm) {
      if (disposed) return
      const safeTempoBpm = positiveOr(nextTempoBpm, tempoBpm)
      if (safeTempoBpm === tempoBpm) return
      rebasePlayingRate(() => {
        tempoBpm = safeTempoBpm
      })
    },

    setSpeed(nextSpeed) {
      if (disposed) return
      const safeSpeed = positiveOr(nextSpeed, speed)
      if (safeSpeed === speed) return
      rebasePlayingRate(() => {
        speed = safeSpeed
      })
    },

    authoredTempoBpmAtBeat(beat) {
      trackRevision()
      return pianoTempoBpmAtBeat(tempoMap(), beat)
    },

    scaledTempoBpmAtBeat(beat) {
      trackRevision()
      const map = tempoMap()
      return pianoTempoBpmAtBeat(map, beat) * baseTempoScale(map)
    },

    effectiveTempoBpmAtBeat(beat) {
      trackRevision()
      const map = tempoMap()
      return pianoTempoBpmAtBeat(map, beat) * playbackRate(map)
    },

    playbackSecondsAtBeat(beat) {
      trackRevision()
      const map = tempoMap()
      return pianoTempoBeatToSeconds(map, beat) / playbackRate(map)
    },

    contextTimeAtBeat,
    beatAtContextTime,

    getAudioContext: () => context,

    subscribe(listener) {
      if (disposed) return () => undefined
      listeners.add(listener)
      return () => listeners.delete(listener)
    },

    async dispose() {
      if (disposed) return
      disposed = true
      generation += 1
      pendingActivation = null
      pendingPlay = null
      parkedBeat = 0
      startedBeat = 0
      currentPhase = 'ready'
      currentError = null
      listeners.clear()
      invalidateAccessors()

      const ownedContext = context
      context = null
      if (
        closeContextOnDispose &&
        ownedContext !== null &&
        ownedContext.state !== 'closed'
      ) {
        await ownedContext.close()
      }
    },
  }
}
