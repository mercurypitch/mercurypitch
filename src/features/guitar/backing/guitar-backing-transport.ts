// Guitar backing transport keeps separated stems on one route-owned Web Audio clock.
// ============================================================

import { clampRate } from '@/features/guitar-practice/practice-rate'
import { decodedAudioBudgetBytes } from '@/lib/audio-memory-budget'
import { activateAudioPlayback } from '@/lib/audio-unlock'
import type { GuitarElectricAmpParameters } from '@/lib/guitar/guitar-electric-amp'
import { DEFAULT_GUITAR_ELECTRIC_AMP_PARAMETERS } from '@/lib/guitar/guitar-electric-amp'
import type { LoopSpan } from '@/lib/guitar/loop-span'
import { foldIntoLoop } from '@/lib/guitar/loop-span'
import { readCachedSongAudio, writeCachedSongAudio, } from '@/lib/song-audio-cache'
import { sliderToGain } from '@/lib/volume-curve'
import { createGuitarBackingLoopEnvelope, guitarBackingLoopSeekPosition, normalizeGuitarBackingLoop, } from './guitar-backing-loop'
import type { GuitarBackingMixStorage } from './guitar-backing-mix-storage'
import { readGuitarBackingMix, writeGuitarBackingMix, } from './guitar-backing-mix-storage'
import type { GuitarBackingStreamEngine } from './guitar-backing-stream'
import { createGuitarBackingStreamEngine } from './guitar-backing-stream'
import type { GuitarSessionAudioGraph } from './guitar-session-audio-graph'
import { createGuitarSessionAudioGraph } from './guitar-session-audio-graph'
import { clampGuitarTrackMixGain, guitarTrackMixDbToGain, normalizeGuitarTrackMixDb, } from './guitar-track-mix'

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
  /** Explicit mute and Solo's temporary mask are kept separate. */
  effectiveMuted: boolean
  levelDb: number
  /** Legacy 0–1 slider position; new controls use levelDb to expose boost. */
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
  setLoopRange(range: LoopSpan | null): boolean
  setPlaybackRate(rate: number): Promise<boolean>
  setMasterVolume(position: number): void
  setBackingMuted(muted: boolean): void
  setElectricAmpParameters(parameters: GuitarElectricAmpParameters): void
  setTrackMuted(id: string, muted: boolean): void
  setTrackLevelDb(id: string, db: number): void
  toggleTrackSolo(id: string): void
  resetTrackLevels(): void
  getAudioContext(): AudioContext | null
  getAudioGraph(): GuitarSessionAudioGraph | null
  getLoadMode(): GuitarBackingLoadMode | null
  getLoopRange(): LoopSpan | null
  getLoopMode(): GuitarBackingLoadMode | null
  getLoopError(): string | null
  getLoadProgress(): GuitarBackingLoadProgress | null
  getStatus(): GuitarBackingTransportStatus
  getCurrentTime(): number
  getDuration(): number
  getPlaybackRate(): number
  getMasterVolume(): number
  getBackingMuted(): boolean
  getSoloedTrackId(): string | null
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
  mixStorage?: GuitarBackingMixStorage | null
}

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
  return decodedAudioBudgetBytes()
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
  let soloedTrackId: string | null = null
  const defaultTrackLevels = new Map<
    string,
    { level: number; levelDb: number }
  >()
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
        previous.effectiveMuted === state.effectiveMuted &&
        previous.levelDb === state.levelDb &&
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
  // A temporary mix mask, not the room master: live input stays audible and
  // retained per-track mute, level and Solo choices are never overwritten.
  let backingMuted = false
  let electricAmpParameters: GuitarElectricAmpParameters = {
    ...DEFAULT_GUITAR_ELECTRIC_AMP_PARAMETERS,
  }
  let playbackRate = 1
  let loopRange: LoopSpan | null = null
  let loopError: string | null = null
  let loopRevision = 0
  let loopEnvelope: ReturnType<typeof createGuitarBackingLoopEnvelope> | null =
    null
  const paddedLoopBuffers = new Map<string, AudioBuffer>()
  let streamLoopTimer: ReturnType<typeof setTimeout> | null = null
  // A clear during an automatic re-prime should continue from B, not commit
  // the now-obsolete jump to A. An explicit seek supersedes this marker.
  let streamedLoopBoundary: number | null = null
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
  let streamStartEpoch = 0
  let streamSeekEpoch = 0
  let streamDipWait: {
    timer: ReturnType<typeof setTimeout>
    cancel: () => void
  } | null = null
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

  const cancelStreamDip = (): void => {
    streamDipWait?.cancel()
    streamDipWait = null
  }

  const invalidateStreamStarts = (): void => {
    cancelStreamDip()
    streamStartEpoch += 1
    streamSeekEpoch += 1
    streamedSeekTarget = null
    queuedStreamedSeek = null
    streamedLoopBoundary = null
  }

  const waitForStreamDip = (): Promise<boolean> =>
    new Promise((resolve) => {
      const timer = setTimeout(() => {
        streamDipWait = null
        resolve(true)
      }, 15)
      streamDipWait = {
        timer,
        cancel: () => {
          clearTimeout(timer)
          resolve(false)
        },
      }
    })

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
    refreshStreamLoopTimer()
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
    loopEnvelope?.stop()
    paddedLoopBuffers.clear()
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
  const haltAudible = (audibleStreamDip = false): void => {
    loopEnvelope?.stop()
    const bus = audioGraph?.buses.stems ?? null
    if (
      (status === 'playing' || audibleStreamDip) &&
      context !== null &&
      bus !== null
    ) {
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
    clearStreamLoopTimer()
    invalidateStreamStarts()
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
      electricAmpParameters,
    })
    context = created
    audioGraph = nextGraph
    return created
  }

  const trackState = (id: string): GuitarBackingTrackState | undefined =>
    trackStates.find((candidate) => candidate.id === id)

  const targetTrackGain = (id: string): number => {
    const state = trackState(id)
    // Legacy source defaults may be quieter than the interactive fader floor;
    // preserve those exactly until the player intentionally edits the fader.
    return backingMuted ||
      state === undefined ||
      !state.available ||
      state.effectiveMuted
      ? 0
      : clampGuitarTrackMixGain(10 ** (state.levelDb / 20))
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

  const applyMix = (initializeDecoded = false): void => {
    for (const state of trackStates) {
      state.effectiveMuted =
        state.muted || (soloedTrackId !== null && soloedTrackId !== state.id)
      const decoded = decodedTracks.find(
        (candidate) => candidate.track.id === state.id,
      )
      if (decoded !== undefined) applyTrackGain(decoded, initializeDecoded)
      streamEngine?.setTrackGain(
        state.id,
        targetTrackGain(state.id),
        fadeSeconds,
      )
    }
    emit()
  }

  const saveMix = (): void => {
    if (session !== null)
      writeGuitarBackingMix(session.sessionId, trackStates, options.mixStorage)
  }

  const refreshAvailableTracks = (
    ids: readonly string[],
    initializeDecoded = false,
  ): void => {
    for (const state of trackStates) state.available = ids.includes(state.id)
    if (
      soloedTrackId !== null &&
      trackState(soloedTrackId)?.available !== true
    ) {
      soloedTrackId = null
    }
    // Mix edits can arrive while a later stem is still decoding. Reapply the
    // current mask and levels after the loaded nodes become the active graph.
    applyMix(initializeDecoded)
  }

  /** Pad only short stems, and account for originals and old/new copies at peak. */
  const prepareBufferedLoop = (): boolean => {
    if (loopRange === null || context === null || loadMode !== 'buffered')
      return true
    loopRange = normalizeGuitarBackingLoop(loopRange, duration)
    if (loopRange === null) {
      loopError =
        'The loop is outside this recording. Set A and B within the song.'
      return false
    }
    const end = loopRange.end
    const needsPadding = decodedTracks.filter(
      ({ track, buffer }) =>
        buffer.duration < end &&
        (paddedLoopBuffers.get(track.id)?.duration ?? 0) < end,
    )
    const allocatedBytes =
      decodedTracks.reduce(
        (bytes, { buffer }) => bytes + decodedAudioBufferBytes(buffer),
        0,
      ) +
      [...paddedLoopBuffers.values()].reduce(
        (bytes, buffer) => bytes + decodedAudioBufferBytes(buffer),
        0,
      )
    const additionalBytes = needsPadding.reduce(
      (bytes, { buffer }) =>
        bytes +
        Math.ceil(end * buffer.sampleRate) * buffer.numberOfChannels * 4,
      0,
    )
    try {
      if (allocatedBytes + additionalBytes > memoryBudgetBytes)
        throw new Error('Loop memory budget exceeded')
      for (const { track, buffer } of needsPadding) {
        const padded = context.createBuffer(
          buffer.numberOfChannels,
          Math.ceil(end * buffer.sampleRate),
          buffer.sampleRate,
        )
        for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
          padded.copyToChannel(buffer.getChannelData(channel), channel)
        }
        paddedLoopBuffers.set(track.id, padded)
      }
      return true
    } catch {
      loopRange = null
      loopError =
        'This loop needs more audio memory than this device allows. Move B earlier or use a shorter song.'
      return false
    }
  }

  const clearStreamLoopTimer = (): void => {
    if (streamLoopTimer !== null) clearTimeout(streamLoopTimer)
    streamLoopTimer = null
  }

  const wrapStreamed = (): void => {
    if (
      disposed ||
      status !== 'playing' ||
      loadMode !== 'streamed' ||
      loopRange === null
    )
      return
    streamedLoopBoundary = loopRange.end
    parkedOffset = loopRange.start
    void seekStreamed(loopRange.start, generation)
  }

  const refreshStreamLoopTimer = (): void => {
    clearStreamLoopTimer()
    if (
      disposed ||
      status !== 'playing' ||
      loadMode !== 'streamed' ||
      loopRange === null
    )
      return
    const position = streamEngine?.getCurrentTime() ?? parkedOffset
    const delay = Math.max(
      10,
      Math.min(100, ((loopRange.end - position) / playbackRate) * 1000),
    )
    streamLoopTimer = setTimeout(() => {
      streamLoopTimer = null
      if (loopRange === null || status !== 'playing') return
      const position = streamEngine?.getCurrentTime() ?? parkedOffset
      if (position >= loopRange.end) wrapStreamed()
      else refreshStreamLoopTimer()
    }, delay)
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
        if (loopRange !== null) {
          wrapStreamed()
          return
        }
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
        if (soloedTrackId === trackId) soloedTrackId = null
        applyMix()
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
      refreshAvailableTracks([])
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
    refreshAvailableTracks(loadedIds)
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
        // decodeAudioData detaches `encoded`; nothing reads it after this
        // line, so decoding in place frees the fetched copy immediately
        // instead of holding stem-sized buffer twice per track.
        const buffer = await currentContext.decodeAudioData(encoded)
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
        loopEnvelope ??= createGuitarBackingLoopEnvelope(
          currentContext,
          currentStemsBus,
        )
        gain.connect(loopEnvelope.input)
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
      refreshAvailableTracks([])
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
    // No sources are running on these newly decoded nodes. Set exact values
    // before starting them; a live ramp could outlast the source start delay.
    refreshAvailableTracks(
      loaded.map((decoded) => decoded.track.id),
      true,
    )
    prepareBufferedLoop()
    parkedOffset = clamp(parkedOffset, 0, duration)
    setStatus('ready')
    return true
  }

  const startStreamedAt = async (
    offset: number,
    requestGeneration: number,
    shouldCommit: () => boolean = () => true,
  ): Promise<boolean> => {
    const currentContext = context
    const currentStemsBus = audioGraph?.buses.stems ?? null
    const currentStreamEngine = streamEngine
    const wasAudible = status === 'playing'
    cancelStreamDip()
    const startEpoch = ++streamStartEpoch
    if (
      currentContext === null ||
      currentStemsBus === null ||
      currentStreamEngine === null
    ) {
      return false
    }

    const revision = loopRevision
    const safeOffset = guitarBackingLoopSeekPosition(
      clamp(offset, 0, Math.max(0, duration - 0.001)),
      loopRange,
    )
    setStatus('loading')
    // A 15 ms linear dip, not an instant zero: short LINEAR dips are fine
    // inside continuous material (the program masks them) — an instant
    // step is a click at any point.
    rampGain(currentStemsBus.gain, 0, currentContext.currentTime, 0.015)
    // Keep already-playing media running through the dip, instead of cutting
    // its waveform immediately when the engine pauses to seek. Cold starts
    // still call play() within the user's gesture, with no timer in between.
    if (wasAudible) {
      const finishedDip = await waitForStreamDip()
      if (
        !finishedDip ||
        disposed ||
        requestGeneration !== generation ||
        startEpoch !== streamStartEpoch ||
        !shouldCommit()
      )
        return false
    }
    const started = await currentStreamEngine.play(safeOffset, targetTrackGain)
    if (
      disposed ||
      requestGeneration !== generation ||
      startEpoch !== streamStartEpoch
    ) {
      // The replacement/pause already owns the engine. A stale promise must
      // not pause media that a newer Play has successfully started.
      return false
    }
    // A newer scrub target can arrive while this target is still buffering.
    // The muted warm-up may finish, but an obsolete target must never publish
    // `playing` or reopen the bus for even one frame before its replacement.
    if (!shouldCommit()) {
      currentStreamEngine.pause()
      return false
    }
    if (started === null) {
      setStatus('error', STREAM_ERROR)
      return false
    }

    duration = started.durationSeconds > 0 ? started.durationSeconds : duration
    const previousLoop = loopRange
    loopRange = normalizeGuitarBackingLoop(loopRange, duration)
    if (previousLoop !== null && loopRange === null) {
      loopError =
        'The loop is outside this recording. Set A and B within the song.'
    }
    // Marks and real metadata can change while media is seeking/buffering.
    // Never open the bus onto an offset the newest duration/loop forbids.
    const latestOffset = guitarBackingLoopSeekPosition(
      clamp(safeOffset, 0, Math.max(0, duration - 0.001)),
      loopRange,
    )
    if (
      latestOffset !== safeOffset ||
      (revision !== loopRevision && !shouldCommit())
    ) {
      currentStreamEngine.pause()
      return startStreamedAt(latestOffset, requestGeneration, shouldCommit)
    }

    refreshAvailableTracks(started.playableTrackIds)
    startedOffset = safeOffset
    parkedOffset = safeOffset
    streamedLoopBoundary = null
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

    const safeOffset = guitarBackingLoopSeekPosition(
      clamp(offset, 0, Math.max(0, duration - 0.001)),
      loopRange,
    )
    const when =
      currentContext.currentTime + Math.max(scheduleLeadSeconds, 0.012)
    // Keep old sources connected until the dip has reached zero. Native
    // loop wraps never visit this path; only explicit transport edits do.
    stopVoices(when)
    const thisVoiceGeneration = voiceGeneration
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
      const buffer =
        loopRange === null
          ? decoded.buffer
          : (paddedLoopBuffers.get(decoded.track.id) ?? decoded.buffer)
      if (buffer.duration <= safeOffset) continue
      const source = currentContext.createBufferSource()
      source.buffer = buffer
      source.loop = loopRange !== null
      if (loopRange !== null) {
        source.loopStart = loopRange.start
        source.loopEnd = loopRange.end
      }
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
    loopEnvelope?.start(loopRange, when, safeOffset)
    endingSource.onended = () => {
      if (
        disposed ||
        voiceGeneration !== thisVoiceGeneration ||
        loopRange !== null ||
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
   * The transport reports loading while the media window warms; the room's
   * existing Play spinner is the honest state for an iPhone that cannot yet
   * play the requested position continuously.
   */
  const seekStreamed = async (
    target: number,
    requestGeneration: number,
  ): Promise<void> => {
    if (streamedSeekTarget !== null) {
      // Returning to the target already warming cancels an older queued move
      // and lets this in-flight target commit normally.
      queuedStreamedSeek = target === streamedSeekTarget ? null : target
      return
    }
    const epoch = playIntentEpoch
    const seekEpoch = ++streamSeekEpoch
    let next: number | null = target
    while (next !== null) {
      streamedSeekTarget = next
      queuedStreamedSeek = null
      await startStreamedAt(
        next,
        requestGeneration,
        () => queuedStreamedSeek === null && streamedSeekTarget === next,
      )
      if (
        disposed ||
        requestGeneration !== generation ||
        seekEpoch !== streamSeekEpoch
      )
        break
      if (playIntentEpoch !== epoch) {
        // Pause or stop already parked the room where it wanted; undo only
        // the sound this re-prime just started.
        haltAudible()
        setStatus(playIntentStatus)
        break
      }
      next = queuedStreamedSeek
    }
    if (seekEpoch === streamSeekEpoch) {
      streamedSeekTarget = null
      queuedStreamedSeek = null
    }
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
      foldIntoLoop(
        startedOffset + Math.max(0, context.currentTime - startedAtContextTime),
        loopRange,
      ),
      0,
      duration,
    )
  }

  const setLoopRange = (requested: LoopSpan | null): boolean => {
    if (disposed || session === null) return false
    const next = normalizeGuitarBackingLoop(requested, duration)
    const accepted = requested === null || next !== null
    if (
      loopRange?.start === next?.start &&
      loopRange?.end === next?.end &&
      loopError === null
    )
      return accepted
    const position =
      streamedLoopBoundary !== null && next === null
        ? streamedLoopBoundary
        : currentTime()
    loopRange = next
    loopError = null
    loopRevision += 1
    const prepared = prepareBufferedLoop()
    const target = guitarBackingLoopSeekPosition(position, loopRange)
    parkedOffset = target
    if (status === 'playing' || streamedSeekTarget !== null) {
      if (loadMode === 'buffered') startAt(target)
      else if (streamedSeekTarget !== null || target !== position)
        void seekStreamed(target, generation)
    }
    refreshStreamLoopTimer()
    emit()
    return accepted && prepared
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
      refreshStreamLoopTimer()
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
      backingMuted = false
      loopRange = null
      loopError = null
      loopRevision += 1
      soloedTrackId = null
      defaultTrackLevels.clear()
      trackStateCopies.clear()
      error = null
      parkedOffset = 0
      startedOffset = 0
      duration = Math.max(
        0,
        ...(nextSession?.tracks.map((track) => track.durationSeconds ?? 0) ??
          []),
      )
      const savedMix =
        nextSession === null
          ? new Map()
          : readGuitarBackingMix(nextSession.sessionId, options.mixStorage)
      trackStates =
        nextSession?.tracks.map((track) => {
          const level = Number.isFinite(track.level)
            ? clamp(track.level!, 0, 1)
            : 1
          const levelDb =
            level > 0
              ? 20 * Math.log10(sliderToGain(level))
              : Number.NEGATIVE_INFINITY
          defaultTrackLevels.set(track.id, { level, levelDb })
          const saved = savedMix.get(track.id)
          const muted = saved?.muted ?? track.muted ?? false
          return {
            id: track.id,
            label: track.label,
            muted,
            effectiveMuted: muted,
            level:
              saved === undefined
                ? level
                : Math.min(
                    1,
                    Math.sqrt(
                      clampGuitarTrackMixGain(10 ** (saved.levelDb / 20)),
                    ),
                  ),
            levelDb: saved?.levelDb ?? levelDb,
            available: true,
          }
        }) ?? []
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
      const audibleStreamDip = streamDipWait !== null
      playIntentEpoch += 1
      invalidateStreamStarts()
      playIntentPending = true
      if (status === 'loading') {
        generation += 1
        loadAbort?.abort()
        loadAbort = null
        haltAudible(audibleStreamDip)
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
      const audibleStreamDip = streamDipWait !== null
      playIntentEpoch += 1
      invalidateStreamStarts()
      playIntentPending = true
      if (status === 'loading') {
        generation += 1
        loadAbort?.abort()
        loadAbort = null
      }
      parkedOffset = 0
      haltAudible(audibleStreamDip)
      // Park the transport now; the next Play primes media at zero. Seeking
      // the elements here would move audible material during the close tail.
      if (session === null) setStatus('idle')
      else
        setStatus(
          decodedTracks.length > 0 || streamEngine !== null ? 'ready' : 'armed',
        )
    },

    seek(seconds) {
      if (session === null) return
      streamedLoopBoundary = null
      const target = guitarBackingLoopSeekPosition(
        clamp(Number.isFinite(seconds) ? seconds : 0, 0, duration),
        loopRange,
      )
      // A streamed seek deliberately reports `loading` while it primes the
      // requested media window. Further scrubber input still belongs to the
      // same playing intent and must replace its queued destination rather
      // than taking the quiet-seek path.
      const wasPlaying = status === 'playing' || streamedSeekTarget !== null
      parkedOffset = target
      if (target >= duration && duration > 0) {
        const audibleStreamDip = streamDipWait !== null
        invalidateStreamStarts()
        // A terminal seek also outranks the initial load/Play, before there
        // is a streamedSeekTarget. Its late promise must not reopen at zero.
        if (status === 'loading') {
          generation += 1
          loadAbort?.abort()
          loadAbort = null
        }
        haltAudible(audibleStreamDip)
        setStatus('complete')
        return
      }
      if (!wasPlaying) {
        void streamEngine?.seek(target)
        if (status === 'complete') setStatus('paused')
        else emit()
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
    setLoopRange,

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

    setBackingMuted(muted) {
      if (disposed || backingMuted === muted) return
      backingMuted = muted
      applyMix()
    },

    setElectricAmpParameters(parameters) {
      electricAmpParameters = { ...parameters }
      if (disposed) return
      audioGraph?.setElectricAmpParameters(electricAmpParameters)
    },

    setTrackMuted(id, muted) {
      const state = trackState(id)
      if (
        disposed ||
        state === undefined ||
        (state.muted === muted && !(muted && soloedTrackId === id))
      )
        return
      state.muted = muted
      if (muted && soloedTrackId === id) soloedTrackId = null
      applyMix()
      saveMix()
    },

    setTrackLevelDb(id, db) {
      const state = trackState(id)
      if (disposed || state === undefined) return
      const nextDb = normalizeGuitarTrackMixDb(db)
      if (state.levelDb === nextDb) return
      state.levelDb = nextDb
      state.level = Math.min(1, Math.sqrt(guitarTrackMixDbToGain(nextDb)))
      applyMix()
      saveMix()
    },

    toggleTrackSolo(id) {
      const state = trackState(id)
      if (disposed || state === undefined || !state.available) return
      soloedTrackId = soloedTrackId === id ? null : id
      applyMix()
    },

    resetTrackLevels() {
      if (disposed) return
      for (const state of trackStates) {
        const defaults = defaultTrackLevels.get(state.id)
        if (defaults !== undefined) Object.assign(state, defaults)
      }
      applyMix()
      saveMix()
    },

    getAudioContext: () => context,
    getAudioGraph: () => audioGraph,
    getLoadMode: () => loadMode,
    getLoopRange: () => (loopRange === null ? null : { ...loopRange }),
    getLoopMode: () => loadMode,
    getLoopError: () => loopError,
    getLoadProgress: () => loadProgress,
    getStatus: () => status,
    getCurrentTime: currentTime,
    getDuration: () => duration,
    getPlaybackRate: () => playbackRate,
    getMasterVolume: () => masterPosition,
    getBackingMuted: () => backingMuted,
    getSoloedTrackId: () => soloedTrackId,
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
      loopEnvelope?.dispose()
      loopEnvelope = null
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
