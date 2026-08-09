// ============================================================
// Piano audio-clock transport — beat time derived from one lazy Web Audio clock
// ============================================================
//
// The transport owns no animation or timer loop. Consumers sample playheadBeat
// on their existing render loop, while AudioContext.currentTime remains the
// sole time authority. Construction and configuration stay silent: the context
// is created and activated synchronously from the first explicit Play intent.

import type { Accessor } from 'solid-js'
import { createSignal } from 'solid-js'
import { activateAudioPlayback } from '@/lib/audio-unlock'
import type { PianoPerformancePhase, PianoPerformanceTransport, } from './piano-performance-contract'

export interface PianoAudioClockTransportOptions {
  totalBeats: Accessor<number>
  initialTempoBpm?: number
  initialSpeed?: number
  contextFactory?: () => AudioContext
  activateContext?: (context: AudioContext) => Promise<void>
  closeContextOnDispose?: boolean
}

export interface PianoAudioClockTransport extends PianoPerformanceTransport {
  error: Accessor<string | null>
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
  const listeners = new Set<() => void>()
  const [revision, setRevision] = createSignal(0)

  let context: AudioContext | null = null
  let currentPhase: PianoPerformancePhase = 'ready'
  let currentError: string | null = null
  let tempoBpm = positiveOr(options.initialTempoBpm, DEFAULT_TEMPO_BPM)
  let speed = positiveOr(options.initialSpeed, DEFAULT_SPEED)
  let parkedBeat = 0
  let startedBeat = 0
  let startedAtContextTime = 0
  let generation = 0
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

  const beatsPerSecond = (): number => (tempoBpm / 60) * speed

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

    const elapsedSeconds = Math.max(
      0,
      context.currentTime - startedAtContextTime,
    )
    const beat = startedBeat + elapsedSeconds * beatsPerSecond()
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

  const rebasePlayingRate = (setRate: () => void): void => {
    if (currentPhase !== 'playing' || context === null) {
      setRate()
      emit()
      return
    }

    const currentContextTime = context.currentTime
    const duration = totalBeats()
    const elapsedSeconds = Math.max(
      0,
      currentContextTime - startedAtContextTime,
    )
    const beat = clamp(
      startedBeat + elapsedSeconds * beatsPerSecond(),
      0,
      duration,
    )
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
      let currentContext: AudioContext
      try {
        // Keep creation before the first await so this remains in the Play
        // gesture browsers require for Web Audio activation.
        currentContext = ensureContext()
        await activateContext(currentContext)
      } catch {
        if (!disposed && requestGeneration === generation) {
          setPhase('error', AUDIO_START_ERROR)
        }
        return false
      }

      if (disposed || requestGeneration !== generation) return false
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

    play: beginPlay,

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
