// Guitar backing transport keeps separated stems on one route-owned Web Audio clock.
// ============================================================

import { activateAudioPlayback } from '@/lib/audio-unlock'
import { sliderToGain } from '@/lib/volume-curve'

export type GuitarBackingTransportStatus =
  | 'idle'
  | 'armed'
  | 'loading'
  | 'ready'
  | 'playing'
  | 'paused'
  | 'complete'
  | 'error'

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
  memoryBudgetBytes?: number
  fadeSeconds?: number
  scheduleLeadSeconds?: number
  closeContextOnDispose?: boolean
}

const MIB = 1024 * 1024
const DEFAULT_SAMPLE_RATE = 48_000
const DEFAULT_CHANNEL_COUNT = 2
const UNKNOWN_ENCODING_EXPANSION = 64

const MEMORY_ERROR =
  'This mix is too large to open safely on this device. Prepare a shorter song or fewer parts.'

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
  const memoryBudgetBytes = options.memoryBudgetBytes ?? defaultMemoryBudget()
  const fadeSeconds = options.fadeSeconds ?? 0.018
  const scheduleLeadSeconds = options.scheduleLeadSeconds ?? 0.012
  const closeContextOnDispose = options.closeContextOnDispose ?? true

  const listeners = new Set<() => void>()
  let status: GuitarBackingTransportStatus = 'idle'
  let error: string | null = null
  let session: GuitarBackingSession | null = null
  let trackStates: GuitarBackingTrackState[] = []
  let decodedTracks: DecodedTrack[] = []
  let activeVoices: ActiveVoice[] = []
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

  const applyTrackGain = (decoded: DecodedTrack, immediate = false): void => {
    const state = trackState(decoded.track.id)
    const target =
      state === undefined || state.muted ? 0 : sliderToGain(state.level)
    const currentContext = context
    if (currentContext === null || immediate) {
      decoded.gain.gain.value = target
      return
    }
    rampGain(decoded.gain.gain, target, currentContext.currentTime, fadeSeconds)
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
    duration = Math.max(...loaded.map((decoded) => decoded.buffer.duration))
    trackStates = trackStates.map((state) => ({
      ...state,
      available: loaded.some((decoded) => decoded.track.id === state.id),
    }))
    parkedOffset = clamp(parkedOffset, 0, duration)
    setStatus('ready')
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
        const loaded = await load(requestGeneration)
        if (!loaded) return false
      }
      if (disposed || requestGeneration !== generation) return false
      const offset = replayFromStart ? 0 : parkedOffset
      return startAt(offset)
    },

    pause() {
      if (status === 'loading') {
        generation += 1
        loadAbort?.abort()
        loadAbort = null
        stopVoices()
        setStatus(decodedTracks.length > 0 ? 'paused' : 'armed')
        return
      }
      if (status !== 'playing') return
      parkedOffset = currentTime()
      const currentContext = context
      if (currentContext !== null && masterGain !== null) {
        rampGain(masterGain.gain, 0, currentContext.currentTime, fadeSeconds)
        stopVoices(currentContext.currentTime + fadeSeconds)
      } else {
        stopVoices()
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
      if (session === null) setStatus('idle')
      else setStatus(decodedTracks.length > 0 ? 'ready' : 'armed')
    },

    seek(seconds) {
      if (session === null) return
      const target = clamp(seconds, 0, duration)
      const wasPlaying = status === 'playing'
      parkedOffset = target
      if (!wasPlaying) {
        if (target >= duration && duration > 0) setStatus('complete')
        else if (status === 'complete') setStatus('paused')
        else emit()
        return
      }
      if (target >= duration) {
        stopVoices()
        setStatus('complete')
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
      emit()
    },

    getAudioContext: () => context,
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
