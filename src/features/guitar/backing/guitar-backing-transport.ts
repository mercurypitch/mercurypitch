// Guitar backing transport keeps separated stems on one route-owned Web Audio clock.
// ============================================================

import { activateAudioPlayback } from '@/lib/audio-unlock'
import { sliderToGain } from '@/lib/volume-curve'
import type { GuitarBackingStreamEngine } from './guitar-backing-stream'
import { createGuitarBackingStreamEngine } from './guitar-backing-stream'

export type GuitarBackingTransportStatus =
  | 'idle'
  | 'armed'
  | 'loading'
  | 'ready'
  | 'playing'
  | 'paused'
  | 'complete'
  | 'error'

export type GuitarBackingLoadMode = 'buffered' | 'streamed'

export interface GuitarBackingTrack {
  id: string
  label: string
  url: string
  sizeBytes: number
  durationSeconds?: number
  channelCount?: number
  muted?: boolean
  level?: number
}

export interface GuitarBackingSession {
  sessionId: string
  title: string
  tracks: readonly GuitarBackingTrack[]
}

export interface GuitarBackingTrackState {
  id: string
  label: string
  muted: boolean
  level: number
  available: boolean
}

export interface GuitarBackingTransport {
  configure(session: GuitarBackingSession | null): void
  play(): Promise<boolean>
  pause(): void
  stop(): void
  seek(seconds: number): void
  setMasterVolume(position: number): void
  setTrackMuted(id: string, muted: boolean): void
  getAudioContext(): AudioContext | null
  getLoadMode(): GuitarBackingLoadMode | null
  getStatus(): GuitarBackingTransportStatus
  getCurrentTime(): number
  getDuration(): number
  getTrackStates(): readonly GuitarBackingTrackState[]
  getError(): string | null
  subscribe(listener: () => void): () => void
  dispose(): Promise<void>
}

interface DecodedTrack {
  track: GuitarBackingTrack
  buffer: AudioBuffer
  gain: GainNode
}

interface ActiveVoice {
  source: AudioBufferSourceNode
  gain: GainNode
}

interface GuitarBackingTransportOptions {
  contextFactory?: () => AudioContext
  activateContext?: (context: AudioContext) => Promise<void>
  fetchArrayBuffer?: (url: string, signal: AbortSignal) => Promise<ArrayBuffer>
  mediaElementFactory?: () => HTMLAudioElement
  memoryBudgetBytes?: number
  streamingFallback?: boolean
  fadeSeconds?: number
  scheduleLeadSeconds?: number
  streamSyncIntervalMs?: number
  streamDriftToleranceSeconds?: number
  closeContextOnDispose?: boolean
}

const MIB = 1024 * 1024
const DEFAULT_SAMPLE_RATE = 48_000
const DEFAULT_CHANNEL_COUNT = 2
const UNKNOWN_ENCODING_EXPANSION = 64

const MEMORY_ERROR =
  'This mix is too large to open safely on this device. Prepare a shorter song or fewer parts.'
const STREAM_ERROR =
  'This browser could not open the large room mix. Try a shorter song or fewer band parts.'

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

function defaultMemoryBudget(): number {
  if (typeof window === 'undefined') return 512 * MIB
  return window.matchMedia?.('(max-width: 720px)').matches
    ? 192 * MIB
    : 512 * MIB
}

function decodedAudioBufferBytes(buffer: AudioBuffer): number {
  const frames =
    Number.isFinite(buffer.length) && buffer.length > 0
      ? buffer.length
      : Math.ceil(buffer.duration * buffer.sampleRate)
  return frames * Math.max(1, buffer.numberOfChannels) * 4
}

export function estimateGuitarBackingPcmBytes(
  tracks: readonly Pick<
    GuitarBackingTrack,
    'channelCount' | 'durationSeconds' | 'sizeBytes'
  >[],
  sampleRate = DEFAULT_SAMPLE_RATE,
): number {
  return tracks.reduce((total, track) => {
    const channels = Math.max(1, track.channelCount ?? DEFAULT_CHANNEL_COUNT)
    const duration = track.durationSeconds
    if (duration !== undefined && Number.isFinite(duration) && duration > 0) {
      return total + Math.ceil(duration * sampleRate) * channels * 4
    }
    return total + Math.max(0, track.sizeBytes) * UNKNOWN_ENCODING_EXPANSION
  }, 0)
}

async function defaultFetchArrayBuffer(
  url: string,
  signal: AbortSignal,
): Promise<ArrayBuffer> {
  const response = await fetch(url, { signal })
  if (!response.ok) throw new Error(`Stem request failed (${response.status})`)
  return response.arrayBuffer()
}

function defaultMediaElementFactory(): HTMLAudioElement {
  if (typeof document === 'undefined') {
    throw new Error('Streaming audio requires a browser document')
  }
  return document.createElement('audio')
}

async function defaultActivateContext(context: AudioContext): Promise<void> {
  await activateAudioPlayback({
    getAudioContext: () => context,
    init: async () => undefined,
    resume: async () => context.resume(),
  })
}

function rampGain(
  parameter: AudioParam,
  value: number,
  now: number,
  fadeSeconds: number,
): void {
  parameter.cancelScheduledValues(now)
  parameter.setValueAtTime(parameter.value, now)
  parameter.linearRampToValueAtTime(value, now + fadeSeconds)
}

export function createGuitarBackingTransport(
  options: GuitarBackingTransportOptions = {},
): GuitarBackingTransport {
  const createContext =
    options.contextFactory ??
    (() => new AudioContext({ latencyHint: 'interactive' }))
  const activateContext = options.activateContext ?? defaultActivateContext
  const fetchArrayBuffer = options.fetchArrayBuffer ?? defaultFetchArrayBuffer
  const createMediaElement =
    options.mediaElementFactory ?? defaultMediaElementFactory
  const memoryBudgetBytes = options.memoryBudgetBytes ?? defaultMemoryBudget()
  const streamingFallback = options.streamingFallback ?? true
  const fadeSeconds = options.fadeSeconds ?? 0.018
  const scheduleLeadSeconds = options.scheduleLeadSeconds ?? 0.012
  const streamSyncIntervalMs = options.streamSyncIntervalMs ?? 400
  const streamDriftToleranceSeconds =
    options.streamDriftToleranceSeconds ?? 0.06
  const closeContextOnDispose = options.closeContextOnDispose ?? true

  const listeners = new Set<() => void>()
  let status: GuitarBackingTransportStatus = 'idle'
  let error: string | null = null
  let session: GuitarBackingSession | null = null
  let trackStates: GuitarBackingTrackState[] = []
  let decodedTracks: DecodedTrack[] = []
  let streamEngine: GuitarBackingStreamEngine | null = null
  let activeVoices: ActiveVoice[] = []
  let loadMode: GuitarBackingLoadMode | null = null
  let context: AudioContext | null = null
  let stemsBus: GainNode | null = null
  let masterGain: GainNode | null = null
  let output: DynamicsCompressorNode | null = null
  let masterPosition = 0.78
  let duration = 0
  let parkedOffset = 0
  let startedOffset = 0
  let startedAtContextTime = 0
  let generation = 0
  let voiceGeneration = 0
  let loadAbort: AbortController | null = null
  let disposed = false

  const emit = (): void => {
    for (const listener of listeners) listener()
  }

  const setStatus = (
    nextStatus: GuitarBackingTransportStatus,
    nextError: string | null = null,
  ): void => {
    status = nextStatus
    error = nextError
    emit()
  }

  const disconnectDecodedTracks = (): void => {
    for (const decoded of decodedTracks) decoded.gain.disconnect()
    decodedTracks = []
  }

  const disconnectStreamedTracks = (): void => {
    streamEngine?.dispose()
    streamEngine = null
  }

  const stopVoices = (atTime?: number): void => {
    voiceGeneration += 1
    const voices = activeVoices
    activeVoices = []
    for (const voice of voices) {
      voice.source.onended = null
      try {
        voice.source.stop(atTime)
      } catch {
        // One-shot sources can already have ended; their graph is still safe to drop.
      }
      voice.source.disconnect()
    }
  }

  const resetLoadedAudio = (): void => {
    loadAbort?.abort()
    loadAbort = null
    stopVoices()
    disconnectDecodedTracks()
    disconnectStreamedTracks()
    loadMode = null
  }

  const ensureGraph = (): AudioContext => {
    if (context !== null) return context
    const created = createContext()
    const nextStemsBus = created.createGain()
    const nextMasterGain = created.createGain()
    const nextOutput = created.createDynamicsCompressor()
    nextStemsBus.gain.value = 1
    nextMasterGain.gain.value = sliderToGain(masterPosition)
    nextOutput.threshold.value = -7
    nextOutput.knee.value = 5
    nextOutput.ratio.value = 12
    nextOutput.attack.value = 0.003
    nextOutput.release.value = 0.18
    nextStemsBus.connect(nextMasterGain)
    nextMasterGain.connect(nextOutput)
    nextOutput.connect(created.destination)
    context = created
    stemsBus = nextStemsBus
    masterGain = nextMasterGain
    output = nextOutput
    return created
  }

  const trackState = (id: string): GuitarBackingTrackState | undefined =>
    trackStates.find((candidate) => candidate.id === id)

  const targetTrackGain = (id: string): number => {
    const state = trackState(id)
    return state === undefined || state.muted ? 0 : sliderToGain(state.level)
  }

  const applyGain = (id: string, gain: GainNode, immediate = false): void => {
    const target = targetTrackGain(id)
    const currentContext = context
    if (currentContext === null || immediate) {
      gain.gain.value = target
      return
    }
    rampGain(gain.gain, target, currentContext.currentTime, fadeSeconds)
  }

  const applyTrackGain = (decoded: DecodedTrack, immediate = false): void => {
    applyGain(decoded.track.id, decoded.gain, immediate)
  }

  const loadStreamed = (requestGeneration: number): boolean => {
    const currentSession = session
    const currentContext = context
    const currentStemsBus = stemsBus
    if (
      currentSession === null ||
      currentContext === null ||
      currentStemsBus === null ||
      disposed ||
      requestGeneration !== generation
    ) {
      return false
    }

    const engine = createGuitarBackingStreamEngine({
      createMediaElement,
      syncIntervalMs: streamSyncIntervalMs,
      driftToleranceSeconds: streamDriftToleranceSeconds,
      onEnded: () => {
        if (disposed || status !== 'playing') return
        streamEngine?.pause()
        parkedOffset = duration
        setStatus('complete')
      },
      onTrackError: (trackId, streamState) => {
        const state = trackState(trackId)
        if (state !== undefined) state.available = false
        if (streamState.fatal && status === 'playing') {
          parkedOffset = clamp(streamState.currentTime, 0, duration)
          streamEngine?.pause()
          setStatus(
            'error',
            'The local backing stopped. Reopen the song and try again.',
          )
          return
        }
        emit()
      },
    })
    const loadedIds = engine.load(
      currentContext,
      currentStemsBus,
      currentSession.tracks,
      targetTrackGain,
    )
    if (loadedIds.length === 0) {
      engine.dispose()
      setStatus('error', STREAM_ERROR)
      return false
    }

    streamEngine = engine
    loadMode = 'streamed'
    duration = Math.max(
      duration,
      ...currentSession.tracks.map((track) => track.durationSeconds ?? 0),
    )
    trackStates = trackStates.map((state) => ({
      ...state,
      available: loadedIds.includes(state.id),
    }))
    parkedOffset = clamp(parkedOffset, 0, duration)
    setStatus('ready')
    return true
  }

  const load = async (requestGeneration: number): Promise<boolean> => {
    const currentSession = session
    const currentContext = context
    const currentStemsBus = stemsBus
    if (
      currentSession === null ||
      currentContext === null ||
      currentStemsBus === null
    ) {
      return false
    }

    const estimatedBytes = estimateGuitarBackingPcmBytes(
      currentSession.tracks,
      currentContext.sampleRate,
    )
    if (estimatedBytes > memoryBudgetBytes) {
      if (streamingFallback) return loadStreamed(requestGeneration)
      setStatus('error', MEMORY_ERROR)
      return false
    }

    const abort = new AbortController()
    loadAbort?.abort()
    loadAbort = abort
    setStatus('loading')
    const loaded: DecodedTrack[] = []
    let decodedBytes = 0

    for (const track of currentSession.tracks) {
      try {
        const encoded = await fetchArrayBuffer(track.url, abort.signal)
        if (
          abort.signal.aborted ||
          disposed ||
          requestGeneration !== generation
        ) {
          break
        }
        const buffer = await currentContext.decodeAudioData(encoded.slice(0))
        if (
          abort.signal.aborted ||
          disposed ||
          requestGeneration !== generation
        ) {
          break
        }
        decodedBytes += decodedAudioBufferBytes(buffer)
        if (decodedBytes > memoryBudgetBytes) {
          for (const decoded of loaded) decoded.gain.disconnect()
          loadAbort = null
          if (streamingFallback) return loadStreamed(requestGeneration)
          setStatus('error', MEMORY_ERROR)
          return false
        }
        const gain = currentContext.createGain()
        gain.connect(currentStemsBus)
        const decoded = { track, buffer, gain }
        loaded.push(decoded)
        applyTrackGain(decoded, true)
      } catch {
        if (abort.signal.aborted) break
        // A damaged optional part should not prevent the remaining mix loading.
      }
    }

    if (abort.signal.aborted || disposed || requestGeneration !== generation) {
      for (const decoded of loaded) decoded.gain.disconnect()
      return false
    }
    loadAbort = null
    if (loaded.length === 0) {
      setStatus(
        'error',
        'The prepared audio could not be decoded. Choose the source again or try another song.',
      )
      return false
    }

    disconnectDecodedTracks()
    decodedTracks = loaded
    loadMode = 'buffered'
    duration = Math.max(...loaded.map((decoded) => decoded.buffer.duration))
    trackStates = trackStates.map((state) => ({
      ...state,
      available: loaded.some((decoded) => decoded.track.id === state.id),
    }))
    parkedOffset = clamp(parkedOffset, 0, duration)
    setStatus('ready')
    return true
  }

  const startStreamedAt = async (
    offset: number,
    requestGeneration: number,
  ): Promise<boolean> => {
    const currentContext = context
    const currentMaster = masterGain
    const currentStreamEngine = streamEngine
    if (
      currentContext === null ||
      currentMaster === null ||
      currentStreamEngine === null
    ) {
      return false
    }

    const safeOffset = clamp(offset, 0, Math.max(0, duration - 0.001))
    setStatus('loading')
    currentMaster.gain.cancelScheduledValues(currentContext.currentTime)
    currentMaster.gain.setValueAtTime(0, currentContext.currentTime)
    const started = await currentStreamEngine.play(safeOffset, targetTrackGain)
    if (disposed || requestGeneration !== generation) {
      currentStreamEngine.pause()
      return false
    }
    if (started === null) {
      setStatus('error', STREAM_ERROR)
      return false
    }

    const playableIds = new Set(started.playableTrackIds)
    trackStates = trackStates.map((state) => ({
      ...state,
      available: playableIds.has(state.id),
    }))
    duration = Math.max(duration, started.durationSeconds)
    startedOffset = safeOffset
    parkedOffset = safeOffset
    startedAtContextTime = currentContext.currentTime
    currentMaster.gain.linearRampToValueAtTime(
      sliderToGain(masterPosition),
      currentContext.currentTime + fadeSeconds,
    )
    setStatus('playing')
    return true
  }

  const startAt = (offset: number): boolean => {
    const currentContext = context
    const currentMaster = masterGain
    if (
      currentContext === null ||
      currentMaster === null ||
      decodedTracks.length === 0 ||
      duration <= 0
    ) {
      return false
    }

    const safeOffset = clamp(offset, 0, Math.max(0, duration - 0.001))
    stopVoices()
    const thisVoiceGeneration = voiceGeneration
    const when = currentContext.currentTime + scheduleLeadSeconds
    const voices: ActiveVoice[] = []
    let endingSource: AudioBufferSourceNode | null = null
    let longestRemaining = -1

    currentMaster.gain.cancelScheduledValues(currentContext.currentTime)
    currentMaster.gain.setValueAtTime(0, currentContext.currentTime)
    currentMaster.gain.linearRampToValueAtTime(
      sliderToGain(masterPosition),
      when + fadeSeconds,
    )

    for (const decoded of decodedTracks) {
      if (decoded.buffer.duration <= safeOffset) continue
      const source = currentContext.createBufferSource()
      source.buffer = decoded.buffer
      source.connect(decoded.gain)
      source.start(when, safeOffset)
      voices.push({ source, gain: decoded.gain })
      const remaining = decoded.buffer.duration - safeOffset
      if (remaining > longestRemaining) {
        longestRemaining = remaining
        endingSource = source
      }
    }
    if (voices.length === 0 || endingSource === null) return false

    activeVoices = voices
    startedOffset = safeOffset
    parkedOffset = safeOffset
    startedAtContextTime = when
    endingSource.onended = () => {
      if (
        disposed ||
        voiceGeneration !== thisVoiceGeneration ||
        status !== 'playing'
      ) {
        return
      }
      activeVoices = []
      parkedOffset = duration
      setStatus('complete')
    }
    setStatus('playing')
    return true
  }

  const currentTime = (): number => {
    if (status !== 'playing' || context === null) return parkedOffset
    if (loadMode === 'streamed' && streamEngine !== null) {
      const mediaTime = streamEngine.getCurrentTime()
      if (mediaTime !== null && Number.isFinite(mediaTime)) {
        return clamp(mediaTime, 0, duration)
      }
    }
    return clamp(
      startedOffset + Math.max(0, context.currentTime - startedAtContextTime),
      0,
      duration,
    )
  }

  return {
    configure(nextSession) {
      if (disposed) return
      generation += 1
      resetLoadedAudio()
      session = nextSession
      error = null
      parkedOffset = 0
      startedOffset = 0
      duration = Math.max(
        0,
        ...(nextSession?.tracks.map((track) => track.durationSeconds ?? 0) ??
          []),
      )
      trackStates =
        nextSession?.tracks.map((track) => ({
          id: track.id,
          label: track.label,
          muted: track.muted ?? false,
          level: clamp(track.level ?? 1, 0, 1),
          available: true,
        })) ?? []
      setStatus(nextSession === null ? 'idle' : 'armed')
    },

    async play() {
      if (disposed || session === null) return false
      if (status === 'playing') return true
      if (status === 'loading') return false
      const replayFromStart = status === 'complete'
      const requestGeneration = generation
      setStatus('loading')
      let currentContext: AudioContext
      try {
        currentContext = ensureGraph()
        await activateContext(currentContext)
      } catch {
        if (!disposed && requestGeneration === generation) {
          setStatus(
            'error',
            "Playback could not start. Check this browser's audio permission and try again.",
          )
        }
        return false
      }
      if (disposed || requestGeneration !== generation) return false

      if (decodedTracks.length === 0) {
        const loaded =
          streamEngine !== null ? true : await load(requestGeneration)
        if (!loaded) return false
      }
      if (disposed || requestGeneration !== generation) return false
      const offset = replayFromStart ? 0 : parkedOffset
      if (loadMode === 'streamed') {
        return startStreamedAt(offset, requestGeneration)
      }
      return startAt(offset)
    },

    pause() {
      if (status === 'loading') {
        generation += 1
        loadAbort?.abort()
        loadAbort = null
        stopVoices()
        streamEngine?.pause()
        setStatus(
          decodedTracks.length > 0 || streamEngine !== null
            ? 'paused'
            : 'armed',
        )
        return
      }
      if (status !== 'playing') return
      parkedOffset = currentTime()
      const currentContext = context
      if (currentContext !== null && masterGain !== null) {
        rampGain(masterGain.gain, 0, currentContext.currentTime, fadeSeconds)
        if (loadMode === 'streamed') {
          streamEngine?.pause(fadeSeconds * 1000 + 8)
        } else {
          stopVoices(currentContext.currentTime + fadeSeconds)
        }
      } else {
        stopVoices()
        streamEngine?.pause()
      }
      setStatus('paused')
    },

    stop() {
      if (status === 'loading') {
        generation += 1
        loadAbort?.abort()
        loadAbort = null
      }
      parkedOffset = 0
      stopVoices()
      streamEngine?.pause()
      streamEngine?.seek(0)
      if (session === null) setStatus('idle')
      else
        setStatus(
          decodedTracks.length > 0 || streamEngine !== null ? 'ready' : 'armed',
        )
    },

    seek(seconds) {
      if (session === null) return
      const target = clamp(seconds, 0, duration)
      const wasPlaying = status === 'playing'
      parkedOffset = target
      if (!wasPlaying) {
        streamEngine?.seek(target)
        if (target >= duration && duration > 0) setStatus('complete')
        else if (status === 'complete') setStatus('paused')
        else emit()
        return
      }
      if (target >= duration) {
        stopVoices()
        streamEngine?.pause()
        setStatus('complete')
        return
      }
      if (loadMode === 'streamed') {
        const currentContext = context
        const currentMaster = masterGain
        if (currentContext !== null && currentMaster !== null) {
          currentMaster.gain.cancelScheduledValues(currentContext.currentTime)
          currentMaster.gain.setValueAtTime(0, currentContext.currentTime)
          streamEngine?.seek(target)
          startedOffset = target
          startedAtContextTime = currentContext.currentTime
          currentMaster.gain.linearRampToValueAtTime(
            sliderToGain(masterPosition),
            currentContext.currentTime + fadeSeconds,
          )
          emit()
        }
        return
      }
      startAt(target)
    },

    setMasterVolume(position) {
      masterPosition = clamp(position, 0, 1)
      if (context !== null && masterGain !== null) {
        rampGain(
          masterGain.gain,
          sliderToGain(masterPosition),
          context.currentTime,
          fadeSeconds,
        )
      }
      emit()
    },

    setTrackMuted(id, muted) {
      const state = trackState(id)
      if (state === undefined || state.muted === muted) return
      state.muted = muted
      const decoded = decodedTracks.find(
        (candidate) => candidate.track.id === id,
      )
      if (decoded !== undefined) applyTrackGain(decoded)
      streamEngine?.setTrackGain(id, targetTrackGain(id), fadeSeconds)
      emit()
    },

    getAudioContext: () => context,
    getLoadMode: () => loadMode,
    getStatus: () => status,
    getCurrentTime: currentTime,
    getDuration: () => duration,
    getTrackStates: () => trackStates.map((state) => ({ ...state })),
    getError: () => error,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },

    async dispose() {
      if (disposed) return
      disposed = true
      generation += 1
      resetLoadedAudio()
      stemsBus?.disconnect()
      masterGain?.disconnect()
      output?.disconnect()
      const ownedContext = context
      context = null
      stemsBus = null
      masterGain = null
      output = null
      session = null
      listeners.clear()
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
