// ============================================================
// Play-along stem mix engine — externally clocked, bounded Web Audio playback
// ============================================================

import { encodedAudioBudgetBytes } from '@/lib/audio-memory-budget'
//
// The host route owns the AudioContext, output graph, and transport clock. This
// engine only turns an explicitly loaded stem lease into sample-aligned buffer
// sources scheduled by that owner. Construction and configuration are inert:
// no context access, fetch, decode, timer, media element, or animation loop is
// allowed before load().

export type PlayAlongStemBus = 'drums' | 'backing'

export type PlayAlongStemMixStatus =
  | 'idle'
  | 'configured'
  | 'loading'
  | 'ready'
  | 'playing'
  | 'paused'
  | 'stopped'
  | 'error'
  | 'disposed'

export type PlayAlongStemMixErrorCode =
  | 'invalid-configuration'
  | 'audio-unavailable'
  | 'encoded-budget'
  | 'memory-budget'
  | 'fetch-failed'
  | 'decode-failed'

export interface PlayAlongStemAsset {
  readonly id: string
  readonly label: string
  readonly bus: PlayAlongStemBus
  readonly url: string
  readonly sizeBytes: number
  readonly durationSeconds?: number
  readonly channelCount?: number
  readonly muted?: boolean
  readonly level?: number
  /**
   * Route an aligned copy of this already-decoded asset with inverted polarity
   * through this track. Drum Night uses it to reconstruct a drum-free backing
   * from the reconciled instrumental and isolated drums without decoding all
   * five full-band parts.
   */
  readonly subtractAssetId?: string
}

/**
 * Ownership transfers to the engine at configure(). Its release callback is
 * invoked exactly once when the lease is replaced, cleared, or disposed.
 */
export interface PlayAlongStemLease {
  readonly id: string
  readonly stems: readonly PlayAlongStemAsset[]
  release(): void
}

export interface PlayAlongStemTrackState {
  readonly id: string
  readonly label: string
  readonly bus: PlayAlongStemBus
  readonly muted: boolean
  readonly level: number
  readonly available: boolean
}

export interface PlayAlongStemBusState {
  readonly bus: PlayAlongStemBus
  readonly muted: boolean
  readonly level: number
}

export interface PlayAlongStemLoadProgress {
  readonly phase: 'fetching' | 'decoding' | 'complete'
  readonly loadedTracks: number
  readonly totalTracks: number
  readonly receivedBytes: number
  readonly declaredBytes: number
  readonly decodedBytes: number
  readonly decodedMemoryBudgetBytes: number
  readonly fraction: number
}

/**
 * How a loaded mix was actually decoded. Float32 PCM costs
 * `duration x sampleRate x channels x 4` bytes regardless of the source codec,
 * so a long multi-stem separation can blow a device budget even though the
 * downloaded files are small. Rather than refuse, the engine steps down the
 * decode rate (and, last, the channel count) until the mix fits, and reports
 * what it settled on so the room can say so out loud.
 */
export interface PlayAlongStemFidelity {
  readonly sampleRate: number
  readonly mono: boolean
}

export interface PlayAlongStemMixError {
  readonly code: PlayAlongStemMixErrorCode
  readonly message: string
  readonly requiredBytes?: number
  readonly budgetBytes?: number
}

export interface PlayAlongStemSchedule {
  /** Shared Web Audio clock time chosen by the route transport. */
  readonly atContextTime: number
  /** Shared song position chosen by the route transport. */
  readonly sourceOffsetSeconds: number
  readonly playbackRate: number
}

export type PlayAlongStemFetchProgress = (
  receivedBytes: number,
  totalBytes: number,
) => void

export type PlayAlongStemFetchArrayBuffer = (
  asset: PlayAlongStemAsset,
  signal: AbortSignal,
  onProgress: PlayAlongStemFetchProgress,
) => Promise<ArrayBuffer>

export interface PlayAlongStemMixEngineOptions {
  /** Existing route-owned context; the engine never creates or closes it. */
  getAudioContext(): AudioContext | null
  /** Existing route-owned output; the engine never disconnects this node. */
  getOutput(context: AudioContext): AudioNode | null
  /** Explicit device policy. There is deliberately no implicit fallback. */
  decodedMemoryBudgetBytes: number
  /**
   * Ordered fallbacks tried, best first, when the native-rate estimate exceeds
   * `decodedMemoryBudgetBytes`. An empty list restores refuse-on-overflow.
   */
  reducedFidelityTiers?: readonly PlayAlongStemFidelity[]
  /**
   * Builds the decoder used for a reduced tier. `decodeAudioData` resamples to
   * the decoding context's rate, so a lower-rate context is what makes the mix
   * smaller. Returning null keeps the native rate.
   */
  createDecodeContext?: (sampleRate: number) => BaseAudioContext | null
  /** Bounds total encoded bytes accepted during one load. */
  encodedLoadBudgetBytes?: number
  fetchArrayBuffer?: PlayAlongStemFetchArrayBuffer
  attackSeconds?: number
  releaseSeconds?: number
  seekFadeSeconds?: number
  releaseSlackSeconds?: number
  mixSmoothingSeconds?: number
}

export interface PlayAlongStemMixEngine {
  configure(lease: PlayAlongStemLease | null): void
  /** Fetch and decode the configured lease after an explicit user action. */
  load(): Promise<boolean>
  /** Schedule all decoded stems against the route's Web Audio clock. */
  start(schedule: PlayAlongStemSchedule): boolean
  /** Fade and stop the current source generation at an owner-chosen time. */
  pause(atContextTime: number): void
  /** Fade and stop at an owner-chosen time without retaining transport state. */
  stop(atContextTime: number): void
  /** Replace the active source generation at one shared offset and clock time. */
  seek(schedule: PlayAlongStemSchedule): boolean
  setTrackMuted(id: string, muted: boolean): void
  setTrackLevel(id: string, level: number): void
  setBusMuted(bus: PlayAlongStemBus, muted: boolean): void
  setBusLevel(bus: PlayAlongStemBus, level: number): void
  getStatus(): PlayAlongStemMixStatus
  getProgress(): PlayAlongStemLoadProgress | null
  getError(): PlayAlongStemMixError | null
  getDurationSeconds(): number
  getTrackStates(): readonly PlayAlongStemTrackState[]
  getBusStates(): readonly PlayAlongStemBusState[]
  /** Non-null only when the mix had to be decoded below its native fidelity. */
  getReducedFidelity(): PlayAlongStemFidelity | null
  subscribe(listener: () => void): () => void
  dispose(): void
}

interface MutableTrackState {
  id: string
  label: string
  bus: PlayAlongStemBus
  muted: boolean
  level: number
  available: boolean
}

interface MutableBusState {
  bus: PlayAlongStemBus
  muted: boolean
  level: number
}

interface DecodedStem {
  asset: PlayAlongStemAsset
  buffer: AudioBuffer
  trackGain: GainNode
  subtractionBuffer: AudioBuffer | null
  subtractionGain: GainNode | null
}

interface ActiveStemVoice {
  source: AudioBufferSourceNode
  envelope: GainNode
  ended: boolean
}

interface VoiceGroup {
  voices: ActiveStemVoice[]
  current: boolean
  closeAt: number | null
}

interface StemGraph {
  context: AudioContext
  output: AudioNode
  buses: Record<PlayAlongStemBus, GainNode>
  stems: DecodedStem[]
  groups: Set<VoiceGroup>
  retired: boolean
}

interface OwnedLease {
  lease: PlayAlongStemLease
  released: boolean
}

const MIB = 1024 * 1024
/** Device-aware; the room may still pass an explicit ceiling of its own. */
const defaultEncodedLoadBudgetBytes = (): number => encodedAudioBudgetBytes()
const DEFAULT_SAMPLE_RATE = 48_000
const DEFAULT_CHANNEL_COUNT = 2
const UNKNOWN_ENCODING_EXPANSION = 64
/**
 * Rate first, channels last: halving the rate costs the top octave, which a
 * backing track survives, while collapsing to mono costs the whole stereo
 * image. 32 kHz keeps a 16 kHz ceiling; 24 kHz is the audible floor we accept.
 */
const DEFAULT_REDUCED_FIDELITY_TIERS: readonly PlayAlongStemFidelity[] = [
  { sampleRate: 32_000, mono: false },
  { sampleRate: 32_000, mono: true },
  { sampleRate: 24_000, mono: true },
]
const SILENCE_FLOOR = 0.0001
const MINIMUM_RATE = 0.25
const MAXIMUM_RATE = 2

const INVALID_CONFIGURATION_MESSAGE =
  'This stem mix is incomplete. Choose another prepared song.'
const AUDIO_UNAVAILABLE_MESSAGE =
  'The room audio output is not ready. Try Play again.'
const ENCODED_BUDGET_MESSAGE =
  'This stem mix is too large to download safely on this device.'
const FETCH_FAILED_MESSAGE =
  'One or more prepared song parts could not be loaded.'
const DECODE_FAILED_MESSAGE =
  'One or more prepared song parts could not be decoded.'

function clamp(value: number, minimum: number, maximum: number): number {
  if (!Number.isFinite(value)) return minimum
  return Math.min(maximum, Math.max(minimum, value))
}

function finiteNonNegative(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0
}

function decodedAudioBufferBytes(buffer: AudioBuffer): number {
  if (
    !Number.isFinite(buffer.duration) ||
    buffer.duration < 0 ||
    !Number.isFinite(buffer.sampleRate) ||
    buffer.sampleRate <= 0 ||
    !Number.isFinite(buffer.numberOfChannels) ||
    buffer.numberOfChannels < 1
  ) {
    return Number.POSITIVE_INFINITY
  }
  const frames =
    Number.isFinite(buffer.length) && buffer.length > 0
      ? buffer.length
      : Math.ceil(buffer.duration * buffer.sampleRate)
  const bytes = frames * Math.max(1, buffer.numberOfChannels) * 4
  return Number.isFinite(bytes) ? bytes : Number.POSITIVE_INFINITY
}

export function estimatePlayAlongStemPcmBytes(
  stems: readonly Pick<
    PlayAlongStemAsset,
    'channelCount' | 'durationSeconds' | 'sizeBytes'
  >[],
  sampleRate = DEFAULT_SAMPLE_RATE,
  /** Forces every stem to this channel count, for mono-downmix estimates. */
  channelOverride?: number,
): number {
  const boundedSampleRate =
    Number.isFinite(sampleRate) && sampleRate > 0
      ? sampleRate
      : DEFAULT_SAMPLE_RATE
  const forcedChannels =
    channelOverride !== undefined &&
    Number.isFinite(channelOverride) &&
    channelOverride > 0
      ? Math.floor(channelOverride)
      : null
  return stems.reduce((total, stem) => {
    const declaredChannels =
      stem.channelCount !== undefined &&
      Number.isFinite(stem.channelCount) &&
      stem.channelCount > 0
        ? stem.channelCount
        : DEFAULT_CHANNEL_COUNT
    const channels =
      forcedChannels === null
        ? declaredChannels
        : Math.min(forcedChannels, declaredChannels)
    const duration = stem.durationSeconds
    if (duration !== undefined && Number.isFinite(duration) && duration > 0) {
      return total + Math.ceil(duration * boundedSampleRate) * channels * 4
    }
    return (
      total + finiteNonNegative(stem.sizeBytes) * UNKNOWN_ENCODING_EXPANSION
    )
  }, 0)
}

function defaultDecodeContextFactory(
  sampleRate: number,
): BaseAudioContext | null {
  if (typeof OfflineAudioContext !== 'function') return null
  try {
    // Length and channel count are irrelevant here: decodeAudioData allocates
    // its own buffer and only borrows this context's sample rate.
    return new OfflineAudioContext(1, 1, sampleRate)
  } catch {
    return null
  }
}

/**
 * Averages every channel into one. Callers drop the multi-channel source right
 * after, so the doubled footprint lasts a single stem, not the whole mix.
 */
function downmixToMono(
  context: BaseAudioContext,
  buffer: AudioBuffer,
): AudioBuffer {
  if (buffer.numberOfChannels <= 1) return buffer
  const mono = context.createBuffer(1, buffer.length, buffer.sampleRate)
  const target = mono.getChannelData(0)
  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    const source = buffer.getChannelData(channel)
    for (let frame = 0; frame < target.length; frame += 1) {
      target[frame] += source[frame] / buffer.numberOfChannels
    }
  }
  return mono
}

function memoryBudgetMessage(
  requiredBytes: number,
  budgetBytes: number,
  reducedBytes?: number,
): string {
  const requiredMib = Math.ceil(requiredBytes / MIB)
  const budgetMib = Math.max(0, Math.floor(budgetBytes / MIB))
  const head = `This stem mix needs about ${requiredMib} MB decoded, above this device's ${budgetMib} MB limit.`
  if (reducedBytes === undefined) return head
  return `${head} Even at reduced quality it still needs about ${Math.ceil(
    reducedBytes / MIB,
  )} MB.`
}

function safeDisconnect(node: AudioNode): void {
  try {
    node.disconnect()
  } catch {
    // Natural endings, reconfiguration, and route teardown may race.
  }
}

function safeStop(source: AudioBufferSourceNode, at: number): void {
  try {
    source.stop(at)
  } catch {
    // A naturally ended source is already silent.
  }
}

function holdParameter(parameter: AudioParam, at: number): void {
  try {
    parameter.cancelAndHoldAtTime(at)
  } catch {
    parameter.cancelScheduledValues(at)
    parameter.setValueAtTime(Math.max(SILENCE_FLOOR, parameter.value), at)
  }
}

function smoothGain(
  parameter: AudioParam,
  target: number,
  at: number,
  smoothingSeconds: number,
): void {
  holdParameter(parameter, at)
  parameter.setTargetAtTime(target, at, smoothingSeconds)
}

function sourceDurationSeconds(buffer: AudioBuffer, offset: number): number {
  return Math.max(0, buffer.duration - offset)
}

function leaseIsValid(lease: PlayAlongStemLease): boolean {
  if (lease.id.trim() === '' || lease.stems.length === 0) return false
  const ids = new Set<string>()
  for (const stem of lease.stems) {
    if (
      stem.id.trim() === '' ||
      stem.label.trim() === '' ||
      stem.url.trim() === '' ||
      (stem.bus !== 'drums' && stem.bus !== 'backing') ||
      !Number.isFinite(stem.sizeBytes) ||
      stem.sizeBytes < 0 ||
      (stem.durationSeconds !== undefined &&
        (!Number.isFinite(stem.durationSeconds) ||
          stem.durationSeconds <= 0)) ||
      (stem.channelCount !== undefined &&
        (!Number.isFinite(stem.channelCount) || stem.channelCount < 1)) ||
      ids.has(stem.id)
    ) {
      return false
    }
    ids.add(stem.id)
  }
  for (const stem of lease.stems) {
    if (
      stem.subtractAssetId !== undefined &&
      (stem.subtractAssetId === stem.id || !ids.has(stem.subtractAssetId))
    ) {
      return false
    }
  }
  return true
}

class EncodedBudgetExceededError extends Error {}

function declaredResponseBytes(response: Response): number {
  const declared = Number(response.headers.get('content-length') ?? '')
  return Number.isFinite(declared) && declared > 0 ? declared : 0
}

async function fetchStemArrayBuffer(
  asset: PlayAlongStemAsset,
  signal: AbortSignal,
  onProgress: PlayAlongStemFetchProgress,
  maximumBytes: number,
): Promise<ArrayBuffer> {
  const response = await fetch(asset.url, {
    cache: 'force-cache',
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
    signal,
  })
  if (!response.ok) throw new Error('stem request failed')

  const declared = declaredResponseBytes(response)
  if (declared > maximumBytes) {
    await response.body?.cancel('Stem exceeds the encoded load budget')
    throw new EncodedBudgetExceededError()
  }

  if (response.body === null) {
    const whole = await response.arrayBuffer()
    if (whole.byteLength > maximumBytes) {
      throw new EncodedBudgetExceededError()
    }
    onProgress(whole.byteLength, declared || whole.byteLength)
    return whole
  }

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let received = 0
  onProgress(0, declared)
  try {
    for (;;) {
      const next = await reader.read()
      if (next.done) break
      if (next.value.byteLength === 0) continue
      received += next.value.byteLength
      if (received > maximumBytes) {
        await reader.cancel('Stem exceeds the encoded load budget')
        throw new EncodedBudgetExceededError()
      }
      chunks.push(next.value)
      onProgress(received, declared)
    }
  } catch (error) {
    try {
      await reader.cancel(
        signal.aborted ? 'Stem request was cancelled' : 'Stem request failed',
      )
    } catch {
      // Native fetch abort may already have closed the reader.
    }
    throw error
  }

  const encoded = new Uint8Array(received)
  let offset = 0
  for (const chunk of chunks) {
    encoded.set(chunk, offset)
    offset += chunk.byteLength
  }
  onProgress(received, declared || received)
  return encoded.buffer
}

export function createPlayAlongStemMixEngine(
  options: PlayAlongStemMixEngineOptions,
): PlayAlongStemMixEngine {
  const decodedMemoryBudgetBytes = Math.max(
    0,
    Math.floor(finiteNonNegative(options.decodedMemoryBudgetBytes)),
  )
  const encodedLoadBudgetBytes = Math.max(
    0,
    Math.floor(
      finiteNonNegative(
        options.encodedLoadBudgetBytes ?? defaultEncodedLoadBudgetBytes(),
      ),
    ),
  )
  const attackSeconds = Math.max(
    0.001,
    finiteNonNegative(options.attackSeconds ?? 0.09),
  )
  const releaseSeconds = Math.max(
    0.001,
    finiteNonNegative(options.releaseSeconds ?? 0.18),
  )
  const seekFadeSeconds = Math.max(
    0.001,
    finiteNonNegative(options.seekFadeSeconds ?? 0.015),
  )
  const releaseSlackSeconds = finiteNonNegative(
    options.releaseSlackSeconds ?? 0.06,
  )
  const mixSmoothingSeconds = Math.max(
    0.001,
    finiteNonNegative(options.mixSmoothingSeconds ?? 0.012),
  )
  const reducedFidelityTiers = (
    options.reducedFidelityTiers ?? DEFAULT_REDUCED_FIDELITY_TIERS
  ).filter((tier) => Number.isFinite(tier.sampleRate) && tier.sampleRate > 0)
  const createDecodeContext =
    options.createDecodeContext ?? defaultDecodeContextFactory

  const listeners = new Set<() => void>()
  const releasedLeaseObjects = new WeakSet<PlayAlongStemLease>()
  let ownedLease: OwnedLease | null = null
  let status: PlayAlongStemMixStatus = 'idle'
  let progress: PlayAlongStemLoadProgress | null = null
  let error: PlayAlongStemMixError | null = null
  let trackStates: MutableTrackState[] = []
  const busStates: Record<PlayAlongStemBus, MutableBusState> = {
    drums: { bus: 'drums', muted: false, level: 1 },
    backing: { bus: 'backing', muted: false, level: 1 },
  }
  let durationSeconds = 0
  let reducedFidelity: PlayAlongStemFidelity | null = null
  let decodeContext: BaseAudioContext | null = null
  let graph: StemGraph | null = null
  let currentGroup: VoiceGroup | null = null
  let generation = 0
  let loadAbort: AbortController | null = null
  let loading: { generation: number; promise: Promise<boolean> } | null = null
  let disposed = false

  const notify = (): void => {
    for (const listener of listeners) listener()
  }

  const setError = (
    code: PlayAlongStemMixErrorCode,
    message: string,
    details: Pick<PlayAlongStemMixError, 'requiredBytes' | 'budgetBytes'> = {},
  ): false => {
    status = 'error'
    error = { code, message, ...details }
    for (const state of trackStates) state.available = false
    notify()
    return false
  }

  const releaseOwnedLease = (): void => {
    if (ownedLease === null || ownedLease.released) return
    const ending = ownedLease
    ending.released = true
    ownedLease = null
    releasedLeaseObjects.add(ending.lease)
    try {
      ending.lease.release()
    } catch {
      // Revocation is best effort; ownership still ends exactly once here.
    }
  }

  const disconnectGraph = (target: StemGraph): void => {
    for (const stem of target.stems) {
      if (stem.subtractionGain !== null) safeDisconnect(stem.subtractionGain)
      safeDisconnect(stem.trackGain)
    }
    safeDisconnect(target.buses.drums)
    safeDisconnect(target.buses.backing)
  }

  const finishVoice = (
    targetGraph: StemGraph,
    group: VoiceGroup,
    voice: ActiveStemVoice,
  ): void => {
    if (voice.ended) return
    voice.ended = true
    voice.source.onended = null
    safeDisconnect(voice.source)
    safeDisconnect(voice.envelope)
    if (group.voices.some((candidate) => !candidate.ended)) return
    targetGraph.groups.delete(group)
    if (currentGroup === group) {
      currentGroup = null
      if (!disposed && graph === targetGraph && status === 'playing') {
        status = 'ready'
        notify()
      }
    }
    if (targetGraph.retired && targetGraph.groups.size === 0) {
      disconnectGraph(targetGraph)
    }
  }

  const closeGroup = (
    targetGraph: StemGraph,
    group: VoiceGroup,
    atContextTime: number,
    shape: 'release' | 'seek',
  ): void => {
    const at = Math.max(targetGraph.context.currentTime, atContextTime)
    // A group can already carry a future loop-seam close. A pause before that
    // seam must pull the close forward; a later teardown must never push an
    // already scheduled stop back out again.
    if (group.closeAt !== null && at >= group.closeAt) return
    group.current = false
    group.closeAt = at
    for (const voice of group.voices) {
      if (voice.ended) continue
      holdParameter(voice.envelope.gain, at)
      if (shape === 'seek') {
        voice.envelope.gain.linearRampToValueAtTime(0, at + seekFadeSeconds)
        safeStop(voice.source, at + seekFadeSeconds + releaseSlackSeconds)
      } else {
        voice.envelope.gain.setTargetAtTime(0, at, releaseSeconds / 5)
        safeStop(voice.source, at + releaseSeconds + releaseSlackSeconds)
      }
    }
    if (currentGroup === group) currentGroup = null
  }

  const closeAllGroups = (
    targetGraph: StemGraph,
    atContextTime: number,
    shape: 'release' | 'seek',
  ): void => {
    for (const group of [...targetGraph.groups]) {
      closeGroup(targetGraph, group, atContextTime, shape)
    }
    currentGroup = null
  }

  const retireGraph = (target: StemGraph): void => {
    target.retired = true
    closeAllGroups(target, target.context.currentTime, 'release')
    if (target.groups.size === 0) disconnectGraph(target)
  }

  /**
   * Decodes one stem at the tier chosen by the pre-flight. When no reduced-rate
   * decoder is available the native context still decodes: the post-decode
   * budget check below stays the honest backstop.
   */
  // The encoded buffer is handed to exactly one decodeAudioData call, which
  // DETACHES it — that is the point. A defensive `slice(0)` here would keep a
  // second full copy of every stem alive through the decode; the caller never
  // touches `encoded` again, so detaching frees it at the earliest moment.
  const decodeStem = async (
    context: AudioContext,
    encoded: ArrayBuffer,
  ): Promise<AudioBuffer> => {
    const tier = reducedFidelity
    if (tier === null) return context.decodeAudioData(encoded)
    if (decodeContext === null) {
      decodeContext = createDecodeContext(tier.sampleRate)
    }
    const decoder = decodeContext
    if (decoder === null) return context.decodeAudioData(encoded)
    const decoded = await decoder.decodeAudioData(encoded)
    return tier.mono ? downmixToMono(decoder, decoded) : decoded
  }

  const clearConfiguration = (): void => {
    generation += 1
    loadAbort?.abort()
    loadAbort = null
    loading = null
    if (graph !== null) retireGraph(graph)
    graph = null
    currentGroup = null
    releaseOwnedLease()
    trackStates = []
    durationSeconds = 0
    progress = null
    error = null
    reducedFidelity = null
    decodeContext = null
  }

  const updateProgress = (
    phase: PlayAlongStemLoadProgress['phase'],
    loadedTracks: number,
    totalTracks: number,
    receivedBytes: number,
    declaredBytes: number,
    decodedBytes: number,
    fraction: number,
  ): void => {
    progress = {
      phase,
      loadedTracks,
      totalTracks,
      receivedBytes: finiteNonNegative(receivedBytes),
      declaredBytes: finiteNonNegative(declaredBytes),
      decodedBytes: finiteNonNegative(decodedBytes),
      decodedMemoryBudgetBytes,
      fraction: clamp(fraction, 0, 1),
    }
    notify()
  }

  const buildGraph = (
    context: AudioContext,
    output: AudioNode,
    loaded: readonly { asset: PlayAlongStemAsset; buffer: AudioBuffer }[],
  ): StemGraph => {
    const createdNodes: AudioNode[] = []
    try {
      const buses: Record<PlayAlongStemBus, GainNode> = {
        drums: context.createGain(),
        backing: context.createGain(),
      }
      createdNodes.push(buses.drums, buses.backing)
      for (const bus of ['drums', 'backing'] as const) {
        const state = busStates[bus]
        buses[bus].gain.value = state.muted ? 0 : state.level
        buses[bus].connect(output)
      }
      const loadedById = new Map(
        loaded.map(({ asset, buffer }) => [asset.id, buffer] as const),
      )
      const stems = loaded.map(({ asset, buffer }) => {
        const state = trackStates.find(
          (candidate) => candidate.id === asset.id,
        )!
        const trackGain = context.createGain()
        createdNodes.push(trackGain)
        trackGain.gain.value = state.muted ? 0 : state.level
        trackGain.connect(buses[asset.bus])
        const subtractionBuffer =
          asset.subtractAssetId === undefined
            ? null
            : (loadedById.get(asset.subtractAssetId) ?? null)
        const subtractionGain =
          subtractionBuffer === null ? null : context.createGain()
        if (subtractionGain !== null) {
          createdNodes.push(subtractionGain)
          subtractionGain.gain.value = -1
          subtractionGain.connect(trackGain)
        }
        return {
          asset,
          buffer,
          trackGain,
          subtractionBuffer,
          subtractionGain,
        }
      })
      return {
        context,
        output,
        buses,
        stems,
        groups: new Set<VoiceGroup>(),
        retired: false,
      }
    } catch (cause) {
      for (const node of createdNodes) safeDisconnect(node)
      throw cause
    }
  }

  const runLoad = async (loadGeneration: number): Promise<boolean> => {
    const lease = ownedLease?.lease
    if (lease === undefined || disposed || loadGeneration !== generation) {
      return false
    }

    if (!leaseIsValid(lease)) {
      return setError('invalid-configuration', INVALID_CONFIGURATION_MESSAGE)
    }

    // Fidelity ladder. The native estimate is tried first; each fallback is
    // only reached because the one above it did not fit. Estimating against
    // DEFAULT_SAMPLE_RATE rather than the live context keeps this decision
    // ahead of any audio or network work, which is the contract of this gate.
    const estimatedBytes = estimatePlayAlongStemPcmBytes(lease.stems)
    reducedFidelity = null
    if (estimatedBytes > decodedMemoryBudgetBytes) {
      let smallestBytes: number | undefined
      for (const tier of reducedFidelityTiers) {
        const tierBytes = estimatePlayAlongStemPcmBytes(
          lease.stems,
          tier.sampleRate,
          tier.mono ? 1 : undefined,
        )
        smallestBytes =
          smallestBytes === undefined
            ? tierBytes
            : Math.min(smallestBytes, tierBytes)
        if (tierBytes <= decodedMemoryBudgetBytes) {
          reducedFidelity = { ...tier }
          break
        }
      }
      if (reducedFidelity === null) {
        return setError(
          'memory-budget',
          memoryBudgetMessage(
            estimatedBytes,
            decodedMemoryBudgetBytes,
            smallestBytes,
          ),
          {
            requiredBytes: estimatedBytes,
            budgetBytes: decodedMemoryBudgetBytes,
          },
        )
      }
    }

    const declaredBytes = lease.stems.reduce(
      (sum, stem) => sum + finiteNonNegative(stem.sizeBytes),
      0,
    )
    if (declaredBytes > encodedLoadBudgetBytes) {
      return setError('encoded-budget', ENCODED_BUDGET_MESSAGE, {
        requiredBytes: declaredBytes,
        budgetBytes: encodedLoadBudgetBytes,
      })
    }

    let context: AudioContext | null
    let output: AudioNode | null
    try {
      context = options.getAudioContext()
      output = context === null ? null : options.getOutput(context)
    } catch {
      context = null
      output = null
    }
    if (context === null || output === null) {
      return setError('audio-unavailable', AUDIO_UNAVAILABLE_MESSAGE)
    }

    status = 'loading'
    error = null
    for (const state of trackStates) state.available = false
    const abort = new AbortController()
    loadAbort = abort
    const receivedByTrack = new Map<string, number>()
    const loaded: { asset: PlayAlongStemAsset; buffer: AudioBuffer }[] = []
    let decodedBytes = 0
    let completed = 0
    let lastFraction = 0
    let encodedBudgetExceeded = false
    updateProgress('fetching', 0, lease.stems.length, 0, declaredBytes, 0, 0)

    try {
      for (const asset of lease.stems) {
        if (abort.signal.aborted || disposed || loadGeneration !== generation) {
          return false
        }

        const remainingEncodedBudget = Math.max(
          0,
          encodedLoadBudgetBytes -
            [...receivedByTrack.values()].reduce(
              (sum, bytes) => sum + bytes,
              0,
            ),
        )
        const onFetchProgress: PlayAlongStemFetchProgress = (
          received,
          total,
        ) => {
          if (abort.signal.aborted || loadGeneration !== generation) return
          const boundedReceived = finiteNonNegative(received)
          receivedByTrack.set(asset.id, boundedReceived)
          const cumulativeReceived = [...receivedByTrack.values()].reduce(
            (sum, bytes) => sum + bytes,
            0,
          )
          if (cumulativeReceived > encodedLoadBudgetBytes) {
            encodedBudgetExceeded = true
            abort.abort()
            return
          }
          const declaredForTrack = Math.max(
            finiteNonNegative(total),
            finiteNonNegative(asset.sizeBytes),
          )
          const fetchPart =
            declaredForTrack > 0
              ? clamp(boundedReceived / declaredForTrack, 0, 1) * 0.8
              : boundedReceived > 0
                ? 0.4
                : 0
          lastFraction = Math.max(
            lastFraction,
            (completed + fetchPart) / lease.stems.length,
          )
          updateProgress(
            'fetching',
            completed,
            lease.stems.length,
            cumulativeReceived,
            declaredBytes,
            decodedBytes,
            lastFraction,
          )
        }

        let encoded: ArrayBuffer
        try {
          encoded = options.fetchArrayBuffer
            ? await options.fetchArrayBuffer(
                asset,
                abort.signal,
                onFetchProgress,
              )
            : await fetchStemArrayBuffer(
                asset,
                abort.signal,
                onFetchProgress,
                remainingEncodedBudget,
              )
        } catch (cause) {
          if (
            (encodedBudgetExceeded ||
              cause instanceof EncodedBudgetExceededError) &&
            loadGeneration === generation &&
            !disposed
          ) {
            return setError('encoded-budget', ENCODED_BUDGET_MESSAGE, {
              requiredBytes: encodedLoadBudgetBytes + 1,
              budgetBytes: encodedLoadBudgetBytes,
            })
          }
          if (
            abort.signal.aborted ||
            loadGeneration !== generation ||
            disposed
          ) {
            return false
          }
          return setError('fetch-failed', FETCH_FAILED_MESSAGE)
        }

        if (
          encodedBudgetExceeded &&
          loadGeneration === generation &&
          !disposed
        ) {
          return setError('encoded-budget', ENCODED_BUDGET_MESSAGE, {
            requiredBytes: encodedLoadBudgetBytes + 1,
            budgetBytes: encodedLoadBudgetBytes,
          })
        }
        if (abort.signal.aborted || loadGeneration !== generation || disposed) {
          return false
        }
        const earlierTrackBytes = receivedByTrack.get(asset.id) ?? 0
        receivedByTrack.set(
          asset.id,
          Math.max(earlierTrackBytes, encoded.byteLength),
        )
        const cumulativeReceived = [...receivedByTrack.values()].reduce(
          (sum, bytes) => sum + bytes,
          0,
        )
        if (cumulativeReceived > encodedLoadBudgetBytes) {
          return setError('encoded-budget', ENCODED_BUDGET_MESSAGE, {
            requiredBytes: cumulativeReceived,
            budgetBytes: encodedLoadBudgetBytes,
          })
        }

        lastFraction = Math.max(
          lastFraction,
          (completed + 0.85) / lease.stems.length,
        )
        updateProgress(
          'decoding',
          completed,
          lease.stems.length,
          cumulativeReceived,
          declaredBytes,
          decodedBytes,
          lastFraction,
        )

        let buffer: AudioBuffer
        try {
          buffer = await decodeStem(context, encoded)
        } catch {
          if (
            abort.signal.aborted ||
            loadGeneration !== generation ||
            disposed
          ) {
            return false
          }
          return setError('decode-failed', DECODE_FAILED_MESSAGE)
        }
        if (abort.signal.aborted || loadGeneration !== generation || disposed) {
          return false
        }

        const stemDecodedBytes = decodedAudioBufferBytes(buffer)
        const requiredBytes = decodedBytes + stemDecodedBytes
        if (requiredBytes > decodedMemoryBudgetBytes) {
          return setError(
            'memory-budget',
            memoryBudgetMessage(requiredBytes, decodedMemoryBudgetBytes),
            {
              requiredBytes,
              budgetBytes: decodedMemoryBudgetBytes,
            },
          )
        }
        decodedBytes = requiredBytes
        loaded.push({ asset, buffer })
        const state = trackStates.find((candidate) => candidate.id === asset.id)
        if (state !== undefined) state.available = true
        completed += 1
        lastFraction = completed / lease.stems.length
        updateProgress(
          completed === lease.stems.length ? 'complete' : 'fetching',
          completed,
          lease.stems.length,
          cumulativeReceived,
          declaredBytes,
          decodedBytes,
          lastFraction,
        )
      }

      if (abort.signal.aborted || loadGeneration !== generation || disposed) {
        return false
      }
      try {
        graph = buildGraph(context, output, loaded)
      } catch {
        return setError('audio-unavailable', AUDIO_UNAVAILABLE_MESSAGE)
      }
      durationSeconds = loaded.reduce(
        (longest, stem) => Math.max(longest, stem.buffer.duration),
        0,
      )
      status = 'ready'
      error = null
      notify()
      return true
    } finally {
      if (loadAbort === abort) loadAbort = null
    }
  }

  const scheduleGroup = (
    schedule: PlayAlongStemSchedule,
    opening: 'attack' | 'seek',
  ): boolean => {
    const activeGraph = graph
    if (
      activeGraph === null ||
      activeGraph.retired ||
      disposed ||
      !Number.isFinite(schedule.atContextTime) ||
      !Number.isFinite(schedule.sourceOffsetSeconds) ||
      !Number.isFinite(schedule.playbackRate)
    ) {
      return false
    }
    const at = Math.max(activeGraph.context.currentTime, schedule.atContextTime)
    const offset = Math.max(0, schedule.sourceOffsetSeconds)
    const rate = clamp(schedule.playbackRate, MINIMUM_RATE, MAXIMUM_RATE)
    const group: VoiceGroup = { voices: [], current: true, closeAt: null }

    const scheduleVoice = (
      buffer: AudioBuffer,
      destination: AudioNode,
      maximumSourceDuration?: number,
    ): void => {
      const availableSourceDuration = sourceDurationSeconds(buffer, offset)
      const sourceDuration =
        maximumSourceDuration === undefined
          ? availableSourceDuration
          : Math.min(availableSourceDuration, maximumSourceDuration)
      if (sourceDuration <= 0) return
      const source = activeGraph.context.createBufferSource()
      const envelope = activeGraph.context.createGain()
      source.buffer = buffer
      source.playbackRate.setValueAtTime(rate, at)
      envelope.gain.value = SILENCE_FLOOR
      envelope.gain.cancelScheduledValues(at)
      envelope.gain.setValueAtTime(SILENCE_FLOOR, at)
      if (opening === 'seek') {
        envelope.gain.linearRampToValueAtTime(1, at + seekFadeSeconds)
      } else {
        envelope.gain.exponentialRampToValueAtTime(1, at + attackSeconds)
      }
      source.connect(envelope)
      envelope.connect(destination)
      const voice: ActiveStemVoice = { source, envelope, ended: false }
      source.onended = () => finishVoice(activeGraph, group, voice)
      group.voices.push(voice)
      if (maximumSourceDuration === undefined) source.start(at, offset)
      else source.start(at, offset, sourceDuration)
    }

    for (const stem of activeGraph.stems) {
      scheduleVoice(stem.buffer, stem.trackGain)
      if (stem.subtractionBuffer !== null && stem.subtractionGain !== null) {
        scheduleVoice(
          stem.subtractionBuffer,
          stem.subtractionGain,
          sourceDurationSeconds(stem.buffer, offset),
        )
      }
    }

    if (group.voices.length === 0) return false
    activeGraph.groups.add(group)
    currentGroup = group
    status = 'playing'
    error = null
    notify()
    return true
  }

  const canSchedule = (schedule: PlayAlongStemSchedule): boolean => {
    const activeGraph = graph
    if (
      activeGraph === null ||
      activeGraph.retired ||
      disposed ||
      !Number.isFinite(schedule.atContextTime) ||
      !Number.isFinite(schedule.sourceOffsetSeconds) ||
      !Number.isFinite(schedule.playbackRate)
    ) {
      return false
    }
    const offset = Math.max(0, schedule.sourceOffsetSeconds)
    return activeGraph.stems.some(
      (stem) => sourceDurationSeconds(stem.buffer, offset) > 0,
    )
  }

  return {
    configure(lease) {
      if (disposed) {
        if (lease !== null && !releasedLeaseObjects.has(lease)) {
          releasedLeaseObjects.add(lease)
          try {
            lease.release()
          } catch {
            // A lease handed to a disposed owner still ends here.
          }
        }
        return
      }
      clearConfiguration()
      if (lease === null) {
        status = 'idle'
        notify()
        return
      }
      if (releasedLeaseObjects.has(lease)) {
        status = 'error'
        error = {
          code: 'invalid-configuration',
          message: INVALID_CONFIGURATION_MESSAGE,
        }
        notify()
        return
      }
      ownedLease = { lease, released: false }
      trackStates = lease.stems.map((stem) => ({
        id: stem.id,
        label: stem.label,
        bus: stem.bus,
        muted: stem.muted ?? false,
        level: clamp(stem.level ?? 1, 0, 1),
        available: false,
      }))
      durationSeconds = lease.stems.reduce(
        (longest, stem) =>
          Math.max(longest, finiteNonNegative(stem.durationSeconds ?? 0)),
        0,
      )
      if (!leaseIsValid(lease)) {
        status = 'error'
        error = {
          code: 'invalid-configuration',
          message: INVALID_CONFIGURATION_MESSAGE,
        }
      } else {
        status = 'configured'
      }
      notify()
    },

    load() {
      if (disposed || ownedLease === null) return Promise.resolve(false)
      if (graph !== null && !graph.retired) return Promise.resolve(true)
      if (loading !== null && loading.generation === generation) {
        return loading.promise
      }
      const loadGeneration = generation
      const promise = runLoad(loadGeneration).finally(() => {
        if (loading?.promise === promise) loading = null
      })
      loading = { generation: loadGeneration, promise }
      return promise
    },

    start(schedule) {
      if (!canSchedule(schedule)) return false
      if (graph !== null) {
        closeAllGroups(graph, schedule.atContextTime, 'release')
      }
      return scheduleGroup(schedule, 'attack')
    },

    pause(atContextTime) {
      if (
        graph === null ||
        graph.groups.size === 0 ||
        disposed ||
        !Number.isFinite(atContextTime)
      ) {
        return
      }
      closeAllGroups(graph, atContextTime, 'release')
      status = 'paused'
      notify()
    },

    stop(atContextTime) {
      if (graph === null || disposed || !Number.isFinite(atContextTime)) return
      closeAllGroups(graph, atContextTime, 'release')
      status = 'stopped'
      notify()
    },

    seek(schedule) {
      if (graph === null || disposed || !canSchedule(schedule)) return false
      if (currentGroup === null || status !== 'playing') {
        return false
      }
      closeGroup(graph, currentGroup, schedule.atContextTime, 'seek')
      return scheduleGroup(schedule, 'seek')
    },

    setTrackMuted(id, muted) {
      const state = trackStates.find((candidate) => candidate.id === id)
      if (state === undefined || state.muted === muted) return
      state.muted = muted
      const activeGraph = graph
      const stem = activeGraph?.stems.find(
        (candidate) => candidate.asset.id === id,
      )
      if (
        activeGraph !== null &&
        activeGraph !== undefined &&
        stem !== undefined
      ) {
        smoothGain(
          stem.trackGain.gain,
          muted ? 0 : state.level,
          activeGraph.context.currentTime,
          mixSmoothingSeconds,
        )
      }
      notify()
    },

    setTrackLevel(id, level) {
      const state = trackStates.find((candidate) => candidate.id === id)
      if (state === undefined) return
      const bounded = clamp(level, 0, 1)
      if (state.level === bounded) return
      state.level = bounded
      const activeGraph = graph
      const stem = activeGraph?.stems.find(
        (candidate) => candidate.asset.id === id,
      )
      if (
        activeGraph !== null &&
        activeGraph !== undefined &&
        stem !== undefined
      ) {
        smoothGain(
          stem.trackGain.gain,
          state.muted ? 0 : bounded,
          activeGraph.context.currentTime,
          mixSmoothingSeconds,
        )
      }
      notify()
    },

    setBusMuted(bus, muted) {
      const state = busStates[bus]
      if (state.muted === muted) return
      state.muted = muted
      const activeGraph = graph
      if (activeGraph !== null) {
        smoothGain(
          activeGraph.buses[bus].gain,
          muted ? 0 : state.level,
          activeGraph.context.currentTime,
          mixSmoothingSeconds,
        )
      }
      notify()
    },

    setBusLevel(bus, level) {
      const state = busStates[bus]
      const bounded = clamp(level, 0, 1)
      if (state.level === bounded) return
      state.level = bounded
      const activeGraph = graph
      if (activeGraph !== null) {
        smoothGain(
          activeGraph.buses[bus].gain,
          state.muted ? 0 : bounded,
          activeGraph.context.currentTime,
          mixSmoothingSeconds,
        )
      }
      notify()
    },

    getStatus: () => status,
    getProgress: () => progress,
    getError: () => error,
    getDurationSeconds: () => durationSeconds,
    getTrackStates: () => trackStates.map((state) => ({ ...state })),
    getBusStates: () => [{ ...busStates.drums }, { ...busStates.backing }],
    getReducedFidelity: () =>
      reducedFidelity === null ? null : { ...reducedFidelity },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },

    dispose() {
      if (disposed) return
      clearConfiguration()
      disposed = true
      status = 'disposed'
      listeners.clear()
    },
  }
}
