// Guitar backing transport keeps separated stems on one route-owned Web Audio clock.
// ============================================================

import { clampRate } from '@/features/guitar-practice/practice-rate'
import { activateAudioPlayback } from '@/lib/audio-unlock'
import { readCachedSongAudio, writeCachedSongAudio, } from '@/lib/song-audio-cache'
import { sliderToGain } from '@/lib/volume-curve'
import type { GuitarBackingStreamEngine } from './guitar-backing-stream'
import { createGuitarBackingStreamEngine } from './guitar-backing-stream'
import type { GuitarSessionAudioGraph } from './guitar-session-audio-graph'
import { createGuitarSessionAudioGraph } from './guitar-session-audio-graph'

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

/**
 * What a song has fetched so far, while it is still fetching.
 *
 * The room needs this because a stem that lives on the network is not a
 * stem that lives on the device: pressing Play on an uncached demo starts
 * an eight-megabyte download, and a dimmed button with no other sign was
 * indistinguishable from a button that had simply stopped working.
 *
 * `totalBytes` is 0 whenever the server declared no length, which is also
 * the streamed case -- the element loads what it needs and never says how
 * much that will be. `fraction` still advances then, one whole step per
 * finished stem, so the room always has something honest to show.
 */
export interface GuitarBackingLoadProgress {
  loadedTracks: number
  totalTracks: number
  receivedBytes: number
  totalBytes: number
  fraction: number
}

/** Reports bytes as they land. `total` is 0 when the server declared none. */
export type GuitarBackingFetchProgress = (
  receivedBytes: number,
  totalBytes: number,
) => void

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
  activate(): Promise<boolean>
  play(): Promise<boolean>
  pause(): void
  stop(): void
  seek(seconds: number): void
  setPlaybackRate(rate: number): Promise<boolean>
  setMasterVolume(position: number): void
  setTrackMuted(id: string, muted: boolean): void
  getAudioContext(): AudioContext | null
  getAudioGraph(): GuitarSessionAudioGraph | null
  getLoadMode(): GuitarBackingLoadMode | null
  getLoadProgress(): GuitarBackingLoadProgress | null
  getStatus(): GuitarBackingTransportStatus
  getCurrentTime(): number
  getDuration(): number
  getPlaybackRate(): number
  getMasterVolume(): number
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
  fetchArrayBuffer?: (
    url: string,
    signal: AbortSignal,
    onProgress?: GuitarBackingFetchProgress,
  ) => Promise<ArrayBuffer>
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
// Playback owns only this bus gate. The room master also carries tuner guide
// and monitor audio, so transport fades must never automate the master itself.
const STEMS_BUS_OPEN_GAIN = 1

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

function declaredLength(response: Response): number {
  const header = Number(response.headers.get('content-length') ?? '')
  return Number.isFinite(header) && header > 0 ? header : 0
}

async function defaultFetchArrayBuffer(
  url: string,
  signal: AbortSignal,
  onProgress?: GuitarBackingFetchProgress,
): Promise<ArrayBuffer> {
  // Locally separated stems arrive as blob: URLs and are refused by the
  // cache, so this is a no-op for them. It is the remote demo song that
  // pays for a re-download otherwise.
  const kept = await readCachedSongAudio(url)
  if (kept !== null) {
    onProgress?.(kept.byteLength, kept.byteLength)
    return kept
  }

  const response = await fetch(url, { signal })
  if (!response.ok) throw new Error(`Stem request failed (${response.status})`)
  const total = declaredLength(response)
  const body = response.body

  // Read the body a chunk at a time, so a slow link has something to show
  // for itself. `arrayBuffer()` reports nothing until the last byte, which
  // on a phone is the difference between "downloading" and "broken".
  // Anything without a streaming body (a test double, an old browser)
  // falls back to the whole-buffer read.
  if (body === null) {
    const whole = await response.arrayBuffer()
    onProgress?.(whole.byteLength, whole.byteLength)
    void writeCachedSongAudio(url, whole, 'application/octet-stream')
    return whole
  }

  const reader = body.getReader()
  const chunks: Uint8Array[] = []
  let received = 0
  onProgress?.(0, total)
  for (;;) {
    const step = await reader.read()
    if (step.done) break
    chunks.push(step.value)
    received += step.value.byteLength
    onProgress?.(received, total)
  }

  const encoded = new Uint8Array(received)
  let offset = 0
  for (const chunk of chunks) {
    encoded.set(chunk, offset)
    offset += chunk.byteLength
  }
  onProgress?.(received, received)
  void writeCachedSongAudio(url, encoded.buffer, 'application/octet-stream')
  return encoded.buffer
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

/** Nominal close length; treated as five time constants of the decay. */
const CLOSE_SECONDS = 0.06
/** Slack after the close before a source may stop (tail below -40 dB). */
const CLOSE_STOP_SLACK_SECONDS = 0.02

/**
 * The documented pause/stop shape (docs/agent/MISTAKES.md, pop-free audio):
 * asymptotic decay, with the transport stopped only after the nominal close
 * plus slack. A linear ramp to zero at a silence boundary packs its
 * perceived drop into the last milliseconds — the "squeezed pop"
 * (user-confirmed on a PA); a bare stop() at open gain is a full cut.
 * Returns the earliest time the sources may stop.
 */
function closeBus(parameter: AudioParam, now: number): number {
  parameter.cancelScheduledValues(now)
  parameter.setValueAtTime(parameter.value, now)
  parameter.setTargetAtTime(0, now, CLOSE_SECONDS / 5)
  return now + CLOSE_SECONDS + CLOSE_STOP_SLACK_SECONDS
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
  // A copy per call kept the internal array unreachable, but it also handed
  // every consumer new object identities on every transport event. The room's
  // `<For>` over these rebuilt the whole channel strip on each `input` of a
  // seek or volume drag — new DOM in the middle of a gesture, which is where
  // jank shows most. Copies are still handed out; a track that did not change
  // hands out the same copy it did last time.
  const trackStateCopies = new Map<string, GuitarBackingTrackState>()
  const trackStatesView = (): readonly GuitarBackingTrackState[] =>
    trackStates.map((state) => {
      const previous = trackStateCopies.get(state.id)
      if (
        previous !== undefined &&
        previous.label === state.label &&
        previous.muted === state.muted &&
        previous.level === state.level &&
        previous.available === state.available
      ) {
        return previous
      }
      const copy = { ...state }
      trackStateCopies.set(state.id, copy)
      return copy
    })
  let decodedTracks: DecodedTrack[] = []
  let streamEngine: GuitarBackingStreamEngine | null = null
  let activeVoices: ActiveVoice[] = []
  let loadMode: GuitarBackingLoadMode | null = null
  let context: AudioContext | null = null
  let audioGraph: GuitarSessionAudioGraph | null = null
  let masterPosition = 0.78
  let playbackRate = 1
  let duration = 0
  let parkedOffset = 0
  let startedOffset = 0
  let startedAtContextTime = 0
  let generation = 0
  let voiceGeneration = 0
  let loadAbort: AbortController | null = null
  let disposed = false
  /**
   * Where a streamed re-prime is heading, and where the next one should head
   * once it lands. Dragging the scrubber emits an `input` per pixel; starting
   * a fresh pause-seek-play for each of them would be its own stutter, and on
   * iOS the worst kind. Only one runs at a time, and it finishes on the last
   * position the player actually asked for.
   */
  let streamedSeekTarget: number | null = null
  let queuedStreamedSeek: number | null = null
  /**
   * Bumped whenever the player decides the room should stop. A re-prime takes
   * real time, so a pause pressed during one has to outrank it — otherwise
   * the seek lands afterwards and starts the song back up.
   */
  let playIntentEpoch = 0
  /**
   * The status that decision settled on. Captured through `setStatus` because
   * pause() and stop() each have several exits, and a re-prime landing later
   * has to restore what the player actually chose — stop parks at zero and
   * reports 'ready', pause parks where it was and reports 'paused'.
   */
  let playIntentStatus: GuitarBackingTransportStatus = 'idle'
  let playIntentPending = false

  const emit = (): void => {
    for (const listener of listeners) listener()
  }

  /**
   * Download progress, and the last fraction the room was told about.
   *
   * A chunked read fires per chunk -- hundreds of times for one stem -- and
   * every emit is a re-render of the whole deck. The room cannot show more
   * than whole percents, so that is the resolution the listeners are woken
   * at. Track completion always emits regardless.
   */
  let loadProgress: GuitarBackingLoadProgress | null = null
  let announcedFraction = -1

  const publishProgress = (next: GuitarBackingLoadProgress): void => {
    loadProgress = next
    const step = Math.floor(next.fraction * 100)
    if (step === announcedFraction) return
    announcedFraction = step
    emit()
  }

  const clearProgress = (): void => {
    loadProgress = null
    announcedFraction = -1
  }

  const setStatus = (
    nextStatus: GuitarBackingTransportStatus,
    nextError: string | null = null,
  ): void => {
    status = nextStatus
    error = nextError
    // Progress belongs to one load. Leaving 'loading' by any exit -- ready,
    // error, or a fallback to streaming -- ends it, so a later spinner can
    // never inherit the last download's percentage.
    if (nextStatus !== 'loading') clearProgress()
    if (playIntentPending) {
      playIntentStatus = nextStatus
      playIntentPending = false
    }
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
      if (atTime === undefined) {
        voice.source.onended = null
        try {
          voice.source.stop()
        } catch {
          // One-shot sources can already have ended; their graph is still safe to drop.
        }
        voice.source.disconnect()
        continue
      }
      // A scheduled stop keeps the graph wired until it fires: disconnect()
      // is immediate, so disconnecting here would cut the material at open
      // gain — the exact pop the bus close (which picked atTime) exists to
      // prevent. The completion callback is still silenced; only the
      // teardown rides onended.
      voice.source.onended = () => voice.source.disconnect()
      try {
        voice.source.stop(atTime)
      } catch {
        voice.source.disconnect()
      }
    }
  }

  /**
   * Halt everything audible. While the transport is playing over a live
   * graph, the stems bus closes with the documented release and the
   * sources/stream outlast its tail — a bare source.stop() at open gain is
   * a full-scale waveform cut into a PA (the exact case the pop-free doc
   * names). From any silent state it is the plain, immediate halt.
   */
  const haltAudible = (): void => {
    const bus = audioGraph?.buses.stems ?? null
    if (status === 'playing' && context !== null && bus !== null) {
      const now = context.currentTime
      const stopAt = closeBus(bus.gain, now)
      stopVoices(stopAt)
      streamEngine?.pause((stopAt - now) * 1000 + 8)
    } else {
      stopVoices()
      streamEngine?.pause()
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
    const nextGraph = createGuitarSessionAudioGraph(created, {
      masterLevel: masterPosition,
    })
    context = created
    audioGraph = nextGraph
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
    const currentStemsBus = audioGraph?.buses.stems ?? null
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
      onInterrupted: (_trackId, elementTime) => {
        // Each stem is its own media element and so its own OS media session.
        // iOS's Now Playing control pauses whichever one it attached to and
        // leaves the others running — the room went half-silent while the
        // transport still said it was playing. One stem stopping stops all
        // of them, at the position the stopped one reached.
        if (disposed || status !== 'playing') return
        parkedOffset = clamp(
          Number.isFinite(elementTime) ? elementTime : currentTime(),
          0,
          duration,
        )
        haltAudible()
        setStatus('paused')
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
    engine.setPlaybackRate(playbackRate)
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
    const currentStemsBus = audioGraph?.buses.stems ?? null
    if (
      currentSession === null ||
      currentContext === null ||
      currentStemsBus === null
    ) {
      return false
    }

    if (playbackRate !== 1) {
      if (streamingFallback) return loadStreamed(requestGeneration)
      setStatus(
        'error',
        'Pitch-preserving speed control is unavailable in this browser.',
      )
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
    const totalTracks = currentSession.tracks.length
    let finishedTracks = 0
    let bytesBeforeThisTrack = 0
    clearProgress()
    publishProgress({
      loadedTracks: 0,
      totalTracks,
      receivedBytes: 0,
      totalBytes: 0,
      fraction: 0,
    })
    setStatus('loading')
    const loaded: DecodedTrack[] = []
    let decodedBytes = 0

    for (const track of currentSession.tracks) {
      try {
        const encoded = await fetchArrayBuffer(
          track.url,
          abort.signal,
          (received, total) => {
            // One stem's share of the whole song is 1/totalTracks, and
            // within it the byte count if the server declared one. A stem
            // that declares nothing still moves the bar when it finishes.
            const withinTrack = total > 0 ? Math.min(1, received / total) : 0
            publishProgress({
              loadedTracks: finishedTracks,
              totalTracks,
              receivedBytes: bytesBeforeThisTrack + received,
              totalBytes: total > 0 ? bytesBeforeThisTrack + total : 0,
              fraction: (finishedTracks + withinTrack) / totalTracks,
            })
          },
        )
        finishedTracks += 1
        bytesBeforeThisTrack += encoded.byteLength
        publishProgress({
          loadedTracks: finishedTracks,
          totalTracks,
          receivedBytes: bytesBeforeThisTrack,
          totalBytes: bytesBeforeThisTrack,
          fraction: finishedTracks / totalTracks,
        })
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
    /**
     * A seek keeps the room playing. Publishing 'loading' for the length of
     * the re-prime would disable the transport controls and drop the room's
     * frame clock for a beat, both for something the player experiences as
     * one continuous playback.
     */
    announceLoading = true,
  ): Promise<boolean> => {
    const currentContext = context
    const currentStemsBus = audioGraph?.buses.stems ?? null
    const currentStreamEngine = streamEngine
    if (
      currentContext === null ||
      currentStemsBus === null ||
      currentStreamEngine === null
    ) {
      return false
    }

    const safeOffset = clamp(offset, 0, Math.max(0, duration - 0.001))
    if (announceLoading) setStatus('loading')
    // A 15 ms linear dip, not an instant zero: short LINEAR dips are fine
    // inside continuous material (the program masks them) — an instant
    // step is a click at any point.
    rampGain(currentStemsBus.gain, 0, currentContext.currentTime, 0.015)
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
    // Anchored at now, not chained onto the dip: the elements took real time
    // to re-prime, and a bare ramp would interpolate from where the dip ended
    // — which is long past, so the bus would step straight to near-open.
    rampGain(
      currentStemsBus.gain,
      STEMS_BUS_OPEN_GAIN,
      currentContext.currentTime,
      fadeSeconds,
    )
    setStatus('playing')
    return true
  }

  const startAt = (offset: number): boolean => {
    const currentContext = context
    const currentStemsBus = audioGraph?.buses.stems ?? null
    if (
      currentContext === null ||
      currentStemsBus === null ||
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

    // Dip (not cut) the bus while the voices swap, then reopen.
    rampGain(currentStemsBus.gain, 0, currentContext.currentTime, 0.012)
    currentStemsBus.gain.linearRampToValueAtTime(
      STEMS_BUS_OPEN_GAIN,
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

  /**
   * Move a playing streamed room to `target`, one re-prime at a time. A drag
   * that arrives mid-flight replaces the destination rather than starting a
   * second one, so the room lands exactly once, where the finger stopped.
   */
  const seekStreamed = async (
    target: number,
    requestGeneration: number,
  ): Promise<void> => {
    if (streamedSeekTarget !== null) {
      queuedStreamedSeek = target
      return
    }
    const epoch = playIntentEpoch
    let next: number | null = target
    while (next !== null) {
      streamedSeekTarget = next
      queuedStreamedSeek = null
      emit()
      await startStreamedAt(next, requestGeneration, false)
      if (disposed || requestGeneration !== generation) break
      if (playIntentEpoch !== epoch) {
        // Pause or stop already parked the room where it wanted; undo only
        // the sound this re-prime just started.
        haltAudible()
        setStatus(playIntentStatus)
        break
      }
      next = queuedStreamedSeek
    }
    streamedSeekTarget = null
    queuedStreamedSeek = null
  }

  const currentTime = (): number => {
    if (status !== 'playing' || context === null) return parkedOffset
    if (loadMode === 'streamed' && streamEngine !== null) {
      // While a re-prime is in flight the elements still report the old
      // position, and the room's scrubber is bound to this. Reading it then
      // would drag the playhead back out from under the finger that moved it.
      const seekingTo = queuedStreamedSeek ?? streamedSeekTarget
      if (seekingTo !== null) return seekingTo
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

  const activate = async (): Promise<boolean> => {
    if (disposed) return false
    const requestGeneration = generation
    try {
      const currentContext = ensureGraph()
      await activateContext(currentContext)
    } catch {
      if (!disposed && requestGeneration === generation) {
        setStatus(
          'error',
          "Audio could not start. Check this browser's audio permission and try again.",
        )
      }
      return false
    }
    return !disposed && requestGeneration === generation
  }

  const currentStreamEngine = (): GuitarBackingStreamEngine | null =>
    streamEngine

  const setPlaybackRate = async (nextRate: number): Promise<boolean> => {
    const safeRate = Number.isFinite(nextRate) ? clampRate(nextRate) : 1
    if (safeRate === playbackRate) return true
    if (!streamingFallback && safeRate !== 1) return false

    const previousStatus = status
    const wasPlaying = status === 'playing'
    const offset = currentTime()
    playbackRate = safeRate

    if (streamEngine !== null) {
      streamEngine.setPlaybackRate(safeRate)
      emit()
      return true
    }
    if (loadMode !== 'buffered') {
      emit()
      return true
    }

    const requestGeneration = generation
    if (!loadStreamed(requestGeneration)) return false
    const loadedStreamEngine = currentStreamEngine()
    if (loadedStreamEngine === null) return false
    loadedStreamEngine.setPlaybackRate(safeRate)
    parkedOffset = offset
    stopVoices()
    disconnectDecodedTracks()

    if (wasPlaying) return startStreamedAt(offset, requestGeneration)
    setStatus(
      previousStatus === 'complete'
        ? 'complete'
        : previousStatus === 'paused'
          ? 'paused'
          : 'ready',
    )
    return true
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

    activate,

    async play() {
      if (disposed || session === null) return false
      if (status === 'playing') return true
      if (status === 'loading') return false
      const replayFromStart = status === 'complete'
      const requestGeneration = generation
      setStatus('loading')
      if (!(await activate())) return false
      const currentContext = context
      if (currentContext === null || requestGeneration !== generation) {
        return false
      }

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
      playIntentEpoch += 1
      playIntentPending = true
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
      haltAudible()
      setStatus('paused')
    },

    stop() {
      playIntentEpoch += 1
      playIntentPending = true
      if (status === 'loading') {
        generation += 1
        loadAbort?.abort()
        loadAbort = null
      }
      parkedOffset = 0
      haltAudible()
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
        void streamEngine?.seek(target)
        if (target >= duration && duration > 0) setStatus('complete')
        else if (status === 'complete') setStatus('paused')
        else emit()
        return
      }
      if (target >= duration) {
        haltAudible()
        setStatus('complete')
        return
      }
      if (loadMode === 'streamed') {
        // Seeking a PLAYING media element is the one thing this path must not
        // do. The element stalls for as long as its pipeline needs — far
        // longer than the 18 ms this used to hold the bus shut — so the room
        // reopened onto elements that were still seeking, at clocks that
        // disagreed by seconds, and the drift servo then piled corrections on
        // top of that. Re-priming from the new offset is the same sequence
        // that starts playback, and it is the only one that waits for them.
        void seekStreamed(target, generation)
        return
      }
      startAt(target)
    },

    setPlaybackRate,

    setMasterVolume(position) {
      masterPosition = clamp(position, 0, 1)
      const currentMaster = audioGraph?.master ?? null
      if (context !== null && currentMaster !== null) {
        rampGain(
          currentMaster.gain,
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
    getAudioGraph: () => audioGraph,
    getLoadMode: () => loadMode,
    getLoadProgress: () => loadProgress,
    getStatus: () => status,
    getCurrentTime: currentTime,
    getDuration: () => duration,
    getPlaybackRate: () => playbackRate,
    getMasterVolume: () => masterPosition,
    getTrackStates: trackStatesView,
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
      audioGraph?.dispose()
      const ownedContext = context
      context = null
      audioGraph = null
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
