// ============================================================
// Drum kit player — inert five-flavor playback with synth-per-hit resilience
// ============================================================
//
// Construction never asks for audio or network access. Gesture-owned activate
// creates one bounded graph with live/authored lanes and starts an optional
// baseline warm-up; trigger falls back to synth while any sample is missing.

import type { DrumKitChoke, DrumKitChokeOutcome, DrumKitPlaybackLane, DrumKitPlayerPort, DrumKitPrewarmHit, DrumKitTrigger, } from '@/features/drum-night/runtime/drum-runtime-types'
import { drumVoiceForMidi } from '@/lib/drum-voice-map'
import { triggerDrumVoice } from '@/lib/drum-voices'
import { normalizeGeneralMidiPercussionKey } from '@/lib/percussion'
import type { DrumKitAuthoredFamily } from '../runtime/drum-pad-layout'
import { DRUM_KIT_AUTHORED_FAMILIES, drumKitAuthoredFamily, } from '../runtime/drum-pad-layout'
import { CIRCUIT_OPEN_HAT_CHOKE_GROUP, createCircuitDrumEngine, drumKitChokeGroupForGmKey, } from './circuit-drum-synth'
import { brightnessCutoffHz, measureOnsetSeconds, microVariation, velocityGain, } from './drum-hit-dynamics'
import type { DrumKitFormatSession, DrumKitRuntimeFormat, } from './drum-kit-format'
import { createDrumKitFormatSession, resolveDrumKitEncodingAssetUrl, } from './drum-kit-format'
import type { DrumKitResourceEncoding } from './drum-kit-manifest'
import type { DrumKitId, DrumKitManifest, DrumKitSampleResource, DrumKitSampleStatus, } from './drum-kit-manifest'
import { DRUM_KIT_CATALOG, drumKitManifest, resolveDrumKitVelocityCurve, } from './drum-kit-manifest'
import { createDrumSampleSelector, fnv1a32, mulberry32, } from './drum-sample-select'

export type DrumKitLoadStatus = 'error' | 'idle' | 'loading' | 'ready'
export type DrumKitTriggerResult =
  | 'dropped'
  | 'sampled'
  | 'synthesized'
  | 'synth-fallback'
  | 'unmapped'

export interface DrumKitPlayerSnapshot {
  readonly selectedKitId: DrumKitId
  readonly sampleStatus: DrumKitSampleStatus
  readonly status: DrumKitLoadStatus
  /** Audio is gesture-activated and the synth fallback can accept hits. */
  readonly fallbackReady: boolean
  /** Every baseline kick/snare/hat resource is decoded for the pinned format. */
  readonly sampledReady: boolean
  readonly loadedSamples: number
  readonly preparedSamples: number
  readonly plannedSamples: number
  /** One format is pinned for every resource in the selected sampled kit. */
  readonly selectedFormat: DrumKitRuntimeFormat | null
  readonly decodedBytes: number
  readonly publishedEncodedBytes: number
  readonly error: string | null
}

export interface DrumKitPlayer extends DrumKitPlayerPort {
  trigger(hit: DrumKitTrigger): DrumKitTriggerResult
  selectedKit(): DrumKitManifest
  selectKit(kitId: DrumKitId, signal?: AbortSignal): Promise<void>
  retry(signal?: AbortSignal): Promise<void>
  prewarm(
    hits: readonly DrumKitPrewarmHit[],
    signal?: AbortSignal,
  ): Promise<void>
  choke(request: DrumKitChoke): DrumKitChokeOutcome
  setVolume(volume: number): void
  /** Optional for injected legacy players; the concrete player always provides it. */
  setLaneVolume?(lane: DrumKitPlaybackLane, volume: number): void
  /** Optional for injected legacy players; affects authored playback only. */
  setAuthoredFamilyVolume?(family: DrumKitAuthoredFamily, volume: number): void
  /** Passive, live-lane-only capture source; never includes authored audio. */
  liveCaptureStream?(): MediaStream | null
  snapshot(): DrumKitPlayerSnapshot
  subscribe(listener: () => void): () => void
}

/** Concrete factory result; injected legacy/test players may omit lane mixing. */
export interface RoutedDrumKitPlayer extends DrumKitPlayer {
  setLaneVolume(lane: DrumKitPlaybackLane, volume: number): void
  setAuthoredFamilyVolume(family: DrumKitAuthoredFamily, volume: number): void
  liveCaptureStream(): MediaStream | null
}

export interface DrumKitPlayerOptions {
  /** Route-owned context; this module never constructs or closes it. */
  readonly getAudioContext: () => AudioContext | null
  /** Route-owned output bus; samples and fallback synth share this destination. */
  readonly getOutput: () => AudioNode | null
  /** Same-origin by default; may be an HTTPS media/R2 custom-domain base. */
  readonly assetBaseUrl?: string
  readonly initialKitId?: DrumKitId
  readonly fetchArrayBuffer?: (
    url: string,
    signal: AbortSignal,
    maximumBytes: number,
  ) => Promise<ArrayBuffer>
  readonly verifyResource?: (
    encoded: ArrayBuffer,
    expectedSha256: string,
  ) => Promise<boolean>
  readonly maxDecodedBytes?: number
  readonly maxEncodedSampleBytes?: number
  readonly maxVoices?: number
  readonly loadConcurrency?: number
  /** Test seam; production probes the route-owned decoder after activation. */
  readonly probeOpusSupport?: () => Promise<boolean>
  /** Seeds pool selection and per-hit micro-variation; fixed default keeps sessions reproducible. */
  readonly selectionSeed?: number
}

interface PlayerGraph {
  context: AudioContext
  output: AudioNode
  master: GainNode
  lanes: Readonly<Record<DrumKitPlaybackLane, GainNode>>
  authoredFamilies: Readonly<Record<DrumKitAuthoredFamily, GainNode>>
  liveCapture: MediaStreamAudioDestinationNode | null
}

interface CachedSample {
  buffer: AudioBuffer
  bytes: number
  format: DrumKitRuntimeFormat
  kitId: DrumKitId
  /** Measured on the decoded buffer so codec padding never delays the hit. */
  onsetSec: number
}

interface SampleVoice {
  sequence: number
  source: AudioBufferSourceNode
  filter: BiquadFilterNode | null
  gain: GainNode
  resourceId: string
  chokeGroup: string | null
  lane: DrumKitPlaybackLane
  releaseAt: number | null
  cleaned: boolean
}

interface FallbackVoice {
  sequence: number
  context: BaseAudioContext
  gain: GainNode
  chokeGroup: string | null
  lane: DrumKitPlaybackLane
  releaseAt: number | null
  cleanupTimer: ReturnType<typeof globalThis.setTimeout> | null
  cleaned: boolean
}

const MIB = 1024 * 1024
const DEFAULT_MAX_DECODED_BYTES = 48 * MIB
const DEFAULT_MAX_ENCODED_SAMPLE_BYTES = 2 * MIB
const DEFAULT_MAX_VOICES = 48
const MAXIMUM_MAX_VOICES = 96
const DEFAULT_LOAD_CONCURRENCY = 2
const MINIMUM_GAIN = 0.0001
const SAMPLE_ATTACK_SECONDS = 0.004
const LANE_LEVEL_TIME_CONSTANT_SECONDS = 0.012
const CHOKE_RELEASE_SECONDS = 0.045
const PANIC_RELEASE_SECONDS = 0.12
const RELEASE_SLACK_SECONDS = 0.03
const FALLBACK_VOICE_TAIL_SECONDS = 0.9
const BASELINE_HITS = Object.freeze([
  Object.freeze({ gmKey: 36, velocity: 104 }),
  Object.freeze({ gmKey: 38, velocity: 104 }),
  Object.freeze({ gmKey: 42, velocity: 104 }),
  Object.freeze({ gmKey: 44, velocity: 104 }),
  Object.freeze({ gmKey: 46, velocity: 104 }),
])
const LOAD_ERROR =
  'This drum kit could not finish loading. Mercury Synth remains available.'
const CONTEXT_ERROR =
  'The drum kit needs an active audio session. Mercury Synth remains available.'

function velocityLayerDistance(
  resource: DrumKitSampleResource,
  velocity: number,
): number {
  if (velocity < resource.velocityMin) return resource.velocityMin - velocity
  if (velocity > resource.velocityMax) return velocity - resource.velocityMax
  return 0
}

function playbackReadyResources(
  resources: readonly DrumKitSampleResource[],
  velocity: number,
): readonly DrumKitSampleResource[] {
  const boundedVelocity = clamp(velocity, 1, 127)
  const nearestDistance = Math.min(
    ...resources.map((resource) =>
      velocityLayerDistance(resource, boundedVelocity),
    ),
  )
  const nearest = resources.filter(
    (resource) =>
      velocityLayerDistance(resource, boundedVelocity) === nearestDistance,
  )
  const ready = nearest.filter((resource) => resource.readiness === 'ready')
  if (ready.length > 0) return ready
  return nearest.filter((resource) => resource.readiness === 'reduced')
}

/** Audited full-articulation pool shared by prewarm and synchronous playback. */
export function drumKitPlaybackResources(
  kitId: DrumKitId,
  gmKey: number,
  velocity: number,
): readonly DrumKitSampleResource[] {
  return playbackReadyResources(
    drumKitManifest(kitId).resources.filter((resource) =>
      resource.gmKeys.includes(gmKey),
    ),
    velocity,
  )
}

function clamp(value: number, minimum: number, maximum: number): number {
  if (!Number.isFinite(value)) return minimum
  return Math.min(maximum, Math.max(minimum, value))
}

function positiveInteger(
  value: number | undefined,
  fallback: number,
  maximum = Number.MAX_SAFE_INTEGER,
): number {
  if (value === undefined || !Number.isFinite(value) || value <= 0) {
    return fallback
  }
  return Math.min(maximum, Math.max(1, Math.floor(value)))
}

function abortError(): DOMException {
  return new DOMException('The drum kit load was cancelled.', 'AbortError')
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) throw abortError()
}

function combineAbortSignals(
  ...signals: readonly (AbortSignal | undefined)[]
): { signal: AbortSignal; cleanup(): void } {
  const activeSignals = signals.filter(
    (signal): signal is AbortSignal => signal !== undefined,
  )
  if (activeSignals.length === 1) {
    return { signal: activeSignals[0], cleanup() {} }
  }
  const controller = new AbortController()
  const abort = () => controller.abort()
  for (const signal of activeSignals) {
    signal.addEventListener('abort', abort, { once: true })
  }
  if (activeSignals.some((signal) => signal.aborted)) controller.abort()
  return {
    signal: controller.signal,
    cleanup() {
      for (const signal of activeSignals) {
        signal.removeEventListener('abort', abort)
      }
    },
  }
}

function waitForCaller<T>(
  promise: Promise<T>,
  signal?: AbortSignal,
): Promise<T> {
  if (signal === undefined) return promise
  if (signal.aborted) return Promise.reject(abortError())
  return new Promise<T>((resolve, reject) => {
    const abort = () => reject(abortError())
    signal.addEventListener('abort', abort, { once: true })
    promise.then(resolve, reject).finally(() => {
      signal.removeEventListener('abort', abort)
    })
  })
}

function decodedBufferBytes(buffer: AudioBuffer): number {
  const length =
    Number.isFinite(buffer.length) && buffer.length > 0
      ? buffer.length
      : Math.ceil(buffer.duration * buffer.sampleRate)
  return length * Math.max(1, buffer.numberOfChannels) * 4
}

function safeDisconnect(node: AudioNode): void {
  try {
    node.disconnect()
  } catch {
    // Natural endings and route teardown may race each other.
  }
}

function safeStopStream(stream: MediaStream): void {
  if (typeof stream.getTracks !== 'function') return
  let tracks: MediaStreamTrack[]
  try {
    tracks = stream.getTracks()
  } catch {
    return
  }
  for (const track of tracks) {
    try {
      track.stop()
    } catch {
      // A stopped or externally ended capture track is already released.
    }
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
    try {
      parameter.cancelScheduledValues(at)
      parameter.setValueAtTime(Math.max(MINIMUM_GAIN, parameter.value), at)
    } catch {
      // A closed context no longer needs a release envelope.
    }
  }
}

export async function fetchDrumKitSampleArrayBuffer(
  url: string,
  signal: AbortSignal,
  maximumBytes: number,
): Promise<ArrayBuffer> {
  const response = await fetch(url, {
    cache: 'force-cache',
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
    signal,
  })
  if (!response.ok) {
    throw new Error(`Drum sample request failed (${response.status})`)
  }
  const statedLength = response.headers.get('content-length')
  if (statedLength !== null) {
    const parsedLength = Number(statedLength)
    if (Number.isFinite(parsedLength) && parsedLength > maximumBytes) {
      try {
        await response.body?.cancel(
          'Drum sample exceeds the declared response budget',
        )
      } catch {
        // The response may already have been cancelled by the fetch signal.
      }
      throw new Error('Encoded drum sample exceeds the response budget')
    }
  }
  if (response.body === null) {
    throw new Error('Drum sample response cannot be streamed safely')
  }
  throwIfAborted(signal)
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let byteLength = 0
  let cancelled = false
  const cancelForAbort = (): void => {
    cancelled = true
    void reader.cancel('Drum sample request was cancelled').catch(() => {
      // A native fetch abort may close the stream before cancel observes it.
    })
  }
  signal.addEventListener('abort', cancelForAbort, { once: true })
  try {
    while (true) {
      throwIfAborted(signal)
      const next = await reader.read()
      throwIfAborted(signal)
      if (next.done) break
      if (next.value.byteLength === 0) continue
      byteLength += next.value.byteLength
      if (byteLength > maximumBytes) {
        await reader.cancel('Drum sample exceeded its response budget')
        cancelled = true
        throw new Error('Encoded drum sample exceeds the response budget')
      }
      chunks.push(next.value)
    }
  } catch (error) {
    if (!cancelled) {
      try {
        await reader.cancel(
          signal.aborted
            ? 'Drum sample request was cancelled'
            : 'Drum sample request failed',
        )
      } catch {
        // The fetch abort may already have closed the stream.
      }
    }
    throw error
  } finally {
    signal.removeEventListener('abort', cancelForAbort)
    reader.releaseLock()
  }
  const encoded = new Uint8Array(byteLength)
  let offset = 0
  for (const chunk of chunks) {
    encoded.set(chunk, offset)
    offset += chunk.byteLength
  }
  return encoded.buffer
}

export async function verifyDrumKitSampleResource(
  encoded: ArrayBuffer,
  expectedSha256: string,
): Promise<boolean> {
  const subtle = globalThis.crypto?.subtle
  if (subtle === undefined) return false
  const digest = new Uint8Array(await subtle.digest('SHA-256', encoded))
  const actual = Array.from(digest, (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')
  return actual === expectedSha256
}

/** Create an inert player. Only activate may acquire its context and output. */
export function createDrumKitPlayer(
  options: DrumKitPlayerOptions,
): RoutedDrumKitPlayer {
  const fetchArrayBuffer =
    options.fetchArrayBuffer ?? fetchDrumKitSampleArrayBuffer
  const verifyResource = options.verifyResource ?? verifyDrumKitSampleResource
  const maxDecodedBytes = positiveInteger(
    options.maxDecodedBytes,
    DEFAULT_MAX_DECODED_BYTES,
  )
  const maxEncodedSampleBytes = positiveInteger(
    options.maxEncodedSampleBytes,
    DEFAULT_MAX_ENCODED_SAMPLE_BYTES,
  )
  const maxVoices = positiveInteger(
    options.maxVoices,
    DEFAULT_MAX_VOICES,
    MAXIMUM_MAX_VOICES,
  )
  const loadConcurrency = positiveInteger(
    options.loadConcurrency,
    DEFAULT_LOAD_CONCURRENCY,
    8,
  )
  const lifetimeAbort = new AbortController()
  let selectionAbort = new AbortController()
  const cache = new Map<string, CachedSample>()
  const retainedSampleCounts = new Map<string, number>()
  const inFlight = new Map<string, Promise<AudioBuffer>>()
  const voices = new Map<number, SampleVoice>()
  const fallbackVoices = new Map<number, FallbackVoice>()
  const selectionSeed = options.selectionSeed ?? 0xd1a7
  const sampleSelector = createDrumSampleSelector(selectionSeed)
  const hitRandom = mulberry32(fnv1a32(selectionSeed, 0x9e3779b9))
  const circuitEngine = createCircuitDrumEngine({
    variationSeed: fnv1a32(selectionSeed, 0xc1ac017),
  })
  const listeners = new Set<() => void>()

  let selectedKitId: DrumKitId = options.initialKitId ?? 'mercury-synth'
  let graph: PlayerGraph | null = null
  let formatSession: DrumKitFormatSession<DrumKitSampleResource> | null = null
  let formatPlanKitId: DrumKitId | null = null
  let selectedFormat: DrumKitRuntimeFormat | null = null
  let selectedEncodings = new Map<string, DrumKitResourceEncoding>()
  let graphGeneration = 0
  let voiceSequence = 0
  let loadGeneration = 0
  let selectionGeneration = 0
  let decodedBytes = 0
  let volume = 1
  const laneVolumes: Record<DrumKitPlaybackLane, number> = {
    authored: 1,
    live: 1,
  }
  const laneOpen: Record<DrumKitPlaybackLane, boolean> = {
    authored: true,
    live: true,
  }
  const authoredFamilyVolumes: Record<DrumKitAuthoredFamily, number> = {
    cymbals: 1,
    hats: 1,
    kick: 1,
    snare: 1,
    toms: 1,
  }
  let masterOpen = false
  let disposed = false
  let status: DrumKitLoadStatus = 'idle'
  let plannedSamples = 0
  let preparedSamples = 0
  let preparedResourceIds = new Set<string>()
  let loadError: string | null = null

  const selectedManifest = (): DrumKitManifest => drumKitManifest(selectedKitId)

  /** One eligibility pool feeds readiness, prewarm, and synchronous selection. */
  const playbackPoolForGmKey = (
    gmKey: number,
    velocity: number,
  ): readonly DrumKitSampleResource[] =>
    drumKitPlaybackResources(selectedKitId, gmKey, velocity)

  const selectedLoadedSamples = (): number => {
    let count = 0
    for (const cached of cache.values()) {
      if (cached.kitId === selectedKitId && cached.format === selectedFormat) {
        count += 1
      }
    }
    return count
  }

  const hasSelectedSample = (resourceId: string): boolean =>
    cache.get(resourceId)?.format === selectedFormat

  const refreshPreparedSamples = (): void => {
    preparedSamples = 0
    for (const resourceId of preparedResourceIds) {
      if (hasSelectedSample(resourceId)) preparedSamples += 1
    }
  }

  const currentSnapshot = (): DrumKitPlayerSnapshot => {
    const loadedSamples = selectedLoadedSamples()
    refreshPreparedSamples()
    const coreResourcePools = BASELINE_HITS.map((hit) =>
      playbackPoolForGmKey(hit.gmKey, hit.velocity),
    )
    return Object.freeze({
      selectedKitId,
      sampleStatus: selectedManifest().sampleStatus,
      status,
      fallbackReady: graph !== null && !disposed,
      sampledReady:
        selectedManifest().engine === 'sampled' &&
        coreResourcePools.every(
          (pool) =>
            pool.length > 0 && pool.every(({ id }) => hasSelectedSample(id)),
        ),
      loadedSamples,
      preparedSamples,
      plannedSamples,
      selectedFormat,
      decodedBytes,
      publishedEncodedBytes: selectedManifest().publishedEncodedBytes,
      error: loadError,
    })
  }

  const emit = (): void => {
    if (disposed) return
    for (const listener of listeners) listener()
  }

  const setLoadState = (
    nextStatus: DrumKitLoadStatus,
    error: string | null = null,
  ): void => {
    status = nextStatus
    loadError = error
    emit()
  }

  const retainSample = (resourceId: string): void => {
    retainedSampleCounts.set(
      resourceId,
      (retainedSampleCounts.get(resourceId) ?? 0) + 1,
    )
  }

  const releaseSample = (resourceId: string): void => {
    const count = retainedSampleCounts.get(resourceId)
    if (count === undefined) return
    if (count <= 1) retainedSampleCounts.delete(resourceId)
    else retainedSampleCounts.set(resourceId, count - 1)
  }

  const cachedSample = (
    resource: DrumKitSampleResource,
  ): CachedSample | undefined => {
    const cached = cache.get(resource.id)
    if (cached === undefined || cached.format !== selectedFormat) {
      return undefined
    }
    cache.delete(resource.id)
    cache.set(resource.id, cached)
    return cached
  }

  const storeSample = (
    resource: DrumKitSampleResource,
    format: DrumKitRuntimeFormat,
    buffer: AudioBuffer,
  ): AudioBuffer => {
    const bytes = decodedBufferBytes(buffer)
    if (!Number.isSafeInteger(bytes) || bytes <= 0 || bytes > maxDecodedBytes) {
      throw new Error('Decoded drum sample exceeds the cache budget')
    }
    const previous = cache.get(resource.id)
    let requiredBytes = decodedBytes - (previous?.bytes ?? 0) + bytes
    for (const [resourceId, candidate] of cache) {
      if (requiredBytes <= maxDecodedBytes) break
      if (
        resourceId === resource.id ||
        (retainedSampleCounts.get(resourceId) ?? 0) > 0
      ) {
        continue
      }
      cache.delete(resourceId)
      decodedBytes -= candidate.bytes
      requiredBytes -= candidate.bytes
    }
    if (requiredBytes > maxDecodedBytes) {
      throw new Error('Decoded drum cache has no safe eviction capacity')
    }
    if (previous !== undefined) decodedBytes -= previous.bytes
    cache.delete(resource.id)
    cache.set(resource.id, {
      buffer,
      bytes,
      format,
      kitId: resource.kitId,
      onsetSec: measureOnsetSeconds(buffer),
    })
    decodedBytes += bytes
    refreshPreparedSamples()
    if (
      status === 'ready' &&
      plannedSamples > 0 &&
      preparedSamples < plannedSamples
    ) {
      status = 'error'
      loadError = LOAD_ERROR
    }
    emit()
    return buffer
  }

  const cleanVoice = (voice: SampleVoice): void => {
    if (voice.cleaned) return
    voice.cleaned = true
    if (voices.get(voice.sequence) === voice) voices.delete(voice.sequence)
    releaseSample(voice.resourceId)
    safeDisconnect(voice.source)
    if (voice.filter !== null) safeDisconnect(voice.filter)
    safeDisconnect(voice.gain)
  }

  const releaseVoice = (
    voice: SampleVoice,
    at: number,
    releaseSeconds: number,
  ): boolean => {
    if (voice.cleaned || (voice.releaseAt !== null && voice.releaseAt <= at)) {
      return false
    }
    voice.releaseAt = at
    holdParameter(voice.gain.gain, at)
    try {
      voice.gain.gain.setTargetAtTime(0, at, releaseSeconds / 5)
    } catch {
      cleanVoice(voice)
      return true
    }
    safeStop(voice.source, at + releaseSeconds + RELEASE_SLACK_SECONDS)
    return true
  }

  const cleanFallbackVoice = (voice: FallbackVoice): void => {
    if (voice.cleaned) return
    voice.cleaned = true
    if (fallbackVoices.get(voice.sequence) === voice) {
      fallbackVoices.delete(voice.sequence)
    }
    if (voice.cleanupTimer !== null) {
      globalThis.clearTimeout(voice.cleanupTimer)
      voice.cleanupTimer = null
    }
    safeDisconnect(voice.gain)
  }

  const scheduleFallbackCleanup = (
    voice: FallbackVoice,
    atContextTime: number,
  ): void => {
    if (voice.cleanupTimer !== null) {
      globalThis.clearTimeout(voice.cleanupTimer)
    }
    const delayMilliseconds = Math.max(
      10,
      (atContextTime - voice.context.currentTime) * 1_000,
    )
    voice.cleanupTimer = globalThis.setTimeout(() => {
      voice.cleanupTimer = null
      if (
        voice.context.state === 'suspended' &&
        voice.context.currentTime + 0.001 < atContextTime
      ) {
        scheduleFallbackCleanup(voice, atContextTime)
        return
      }
      cleanFallbackVoice(voice)
    }, delayMilliseconds)
  }

  const releaseFallbackVoice = (
    voice: FallbackVoice,
    at: number,
    releaseSeconds: number,
  ): boolean => {
    if (voice.cleaned || (voice.releaseAt !== null && voice.releaseAt <= at)) {
      return false
    }
    voice.releaseAt = at
    holdParameter(voice.gain.gain, at)
    try {
      voice.gain.gain.setTargetAtTime(0, at, releaseSeconds / 5)
    } catch {
      cleanFallbackVoice(voice)
      return true
    }
    scheduleFallbackCleanup(voice, at + releaseSeconds + RELEASE_SLACK_SECONDS)
    return true
  }

  const voiceIsActiveAt = (
    voice: Pick<SampleVoice, 'cleaned' | 'releaseAt'>,
    at: number,
  ): boolean =>
    !voice.cleaned && (voice.releaseAt === null || voice.releaseAt > at)

  const enforceVoiceLimit = (at: number): void => {
    while (true) {
      const activeSamples = [...voices.values()].filter((voice) =>
        voiceIsActiveAt(voice, at),
      )
      const activeFallbacks = [...fallbackVoices.values()].filter((voice) =>
        voiceIsActiveAt(voice, at),
      )
      if (activeSamples.length + activeFallbacks.length < maxVoices) return
      const oldestSample = activeSamples[0]
      const oldestFallback = activeFallbacks[0]
      if (
        oldestFallback === undefined ||
        (oldestSample !== undefined &&
          oldestSample.sequence < oldestFallback.sequence)
      ) {
        if (
          oldestSample === undefined ||
          !releaseVoice(oldestSample, at, CHOKE_RELEASE_SECONDS)
        ) {
          return
        }
      } else if (
        !releaseFallbackVoice(oldestFallback, at, CHOKE_RELEASE_SECONDS)
      ) {
        return
      }
    }
  }

  const closeMaster = (activeGraph: PlayerGraph, at: number): void => {
    masterOpen = false
    holdParameter(activeGraph.master.gain, at)
    try {
      activeGraph.master.gain.setTargetAtTime(0, at, PANIC_RELEASE_SECONDS / 5)
    } catch {
      // A closed context is already silent.
    }
  }

  const openMaster = (activeGraph: PlayerGraph, at: number): void => {
    const gain = volume
    try {
      activeGraph.master.gain.cancelScheduledValues(at)
      if (gain === 0) {
        activeGraph.master.gain.setValueAtTime(0, at)
      } else if (!masterOpen) {
        activeGraph.master.gain.setValueAtTime(MINIMUM_GAIN, at)
        activeGraph.master.gain.exponentialRampToValueAtTime(
          gain,
          at + SAMPLE_ATTACK_SECONDS,
        )
      } else {
        activeGraph.master.gain.setTargetAtTime(gain, at, 0.012)
      }
      masterOpen = true
    } catch {
      // Trigger will report dropped if source construction also fails.
    }
  }

  const closeLane = (
    activeGraph: PlayerGraph,
    lane: DrumKitPlaybackLane,
    at: number,
  ): void => {
    laneOpen[lane] = false
    const parameter = activeGraph.lanes[lane].gain
    holdParameter(parameter, at)
    try {
      parameter.setTargetAtTime(0, at, PANIC_RELEASE_SECONDS / 5)
    } catch {
      // A closed context is already silent.
    }
  }

  const openLane = (
    activeGraph: PlayerGraph,
    lane: DrumKitPlaybackLane,
    at: number,
  ): void => {
    if (laneOpen[lane]) return
    const parameter = activeGraph.lanes[lane].gain
    const gain = laneVolumes[lane]
    try {
      parameter.cancelScheduledValues(at)
      if (gain === 0) {
        parameter.setValueAtTime(0, at)
      } else {
        parameter.setValueAtTime(MINIMUM_GAIN, at)
        parameter.exponentialRampToValueAtTime(gain, at + SAMPLE_ATTACK_SECONDS)
      }
      laneOpen[lane] = true
    } catch {
      // Source construction reports a dropped hit if the route is closed.
    }
  }

  const panicInternal = (
    atContextTime?: number,
    lane?: DrumKitPlaybackLane,
  ): void => {
    const activeGraph = graph
    if (activeGraph === null) return
    const at = Math.max(
      activeGraph.context.currentTime,
      Number.isFinite(atContextTime) ? (atContextTime as number) : 0,
    )
    if (lane === undefined) closeMaster(activeGraph, at)
    else closeLane(activeGraph, lane, at)
    circuitEngine.panic(lane)
    for (const voice of voices.values()) {
      if (lane !== undefined && voice.lane !== lane) continue
      releaseVoice(voice, at, PANIC_RELEASE_SECONDS)
    }
    for (const voice of fallbackVoices.values()) {
      if (lane !== undefined && voice.lane !== lane) continue
      releaseFallbackVoice(voice, at, PANIC_RELEASE_SECONDS)
    }
  }

  const retireGraph = (activeGraph: PlayerGraph): void => {
    const at = activeGraph.context.currentTime
    closeMaster(activeGraph, at)
    globalThis.setTimeout(
      () => {
        for (const family of DRUM_KIT_AUTHORED_FAMILIES) {
          safeDisconnect(activeGraph.authoredFamilies[family])
        }
        safeDisconnect(activeGraph.lanes.live)
        safeDisconnect(activeGraph.lanes.authored)
        safeDisconnect(activeGraph.master)
        if (activeGraph.liveCapture !== null) {
          safeStopStream(activeGraph.liveCapture.stream)
        }
      },
      (PANIC_RELEASE_SECONDS + RELEASE_SLACK_SECONDS) * 1_000,
    )
  }

  const makeGraph = (context: AudioContext, output: AudioNode): PlayerGraph => {
    const master = context.createGain()
    const live = context.createGain()
    const authored = context.createGain()
    master.gain.setValueAtTime(MINIMUM_GAIN, context.currentTime)
    live.gain.setValueAtTime(laneVolumes.live, context.currentTime)
    authored.gain.setValueAtTime(laneVolumes.authored, context.currentTime)
    laneOpen.live = true
    laneOpen.authored = true
    live.connect(master)
    authored.connect(master)
    let liveCapture: MediaStreamAudioDestinationNode | null = null
    if (typeof context.createMediaStreamDestination === 'function') {
      try {
        liveCapture = context.createMediaStreamDestination()
        live.connect(liveCapture)
      } catch {
        if (liveCapture !== null) safeStopStream(liveCapture.stream)
        liveCapture = null
      }
    }
    const authoredFamilies = {} as Record<DrumKitAuthoredFamily, GainNode>
    for (const family of DRUM_KIT_AUTHORED_FAMILIES) {
      const familyGain = context.createGain()
      familyGain.gain.setValueAtTime(
        authoredFamilyVolumes[family],
        context.currentTime,
      )
      familyGain.connect(authored)
      authoredFamilies[family] = familyGain
    }
    master.connect(output)
    return {
      context,
      output,
      master,
      lanes: { authored, live },
      authoredFamilies,
      liveCapture,
    }
  }

  const triggerDestination = (
    activeGraph: PlayerGraph,
    lane: DrumKitPlaybackLane,
    gmKey: number,
  ): AudioNode => {
    if (lane === 'live') return activeGraph.lanes.live
    const family = drumKitAuthoredFamily(gmKey)
    return family === null
      ? activeGraph.lanes.authored
      : activeGraph.authoredFamilies[family]
  }

  const resetFormatPlan = (): void => {
    formatPlanKitId = null
    selectedFormat = null
    selectedEncodings = new Map()
  }

  const applyFormatPlan = (
    kitId: DrumKitId,
    format: DrumKitRuntimeFormat,
    resources: readonly {
      readonly resource: DrumKitSampleResource
      readonly encoding: DrumKitResourceEncoding
    }[],
  ): void => {
    formatPlanKitId = kitId
    selectedFormat = format
    selectedEncodings = new Map(
      resources.map(({ resource, encoding }) => [resource.id, encoding]),
    )
  }

  const clearSelectedKitCache = (): void => {
    for (const [resourceId, cached] of cache) {
      if (cached.kitId !== selectedKitId) continue
      cache.delete(resourceId)
      decodedBytes -= cached.bytes
    }
    decodedBytes = Math.max(0, decodedBytes)
    refreshPreparedSamples()
  }

  const acquireGraph = async (): Promise<PlayerGraph> => {
    if (disposed) throw new Error(CONTEXT_ERROR)
    const context = options.getAudioContext()
    const output = options.getOutput()
    if (context === null || output === null || context.state === 'closed') {
      throw new Error(CONTEXT_ERROR)
    }
    const existingGraph =
      graph?.context === context && graph.output === output ? graph : null
    if (context.state === 'suspended') await context.resume()
    if (disposed) throw abortError()
    if (existingGraph !== null) return existingGraph
    if (graph !== null) {
      selectionAbort.abort()
      selectionAbort = new AbortController()
      selectionGeneration += 1
      loadGeneration += 1
      panicInternal(graph.context.currentTime)
      retireGraph(graph)
      cache.clear()
      decodedBytes = 0
      refreshPreparedSamples()
    }
    graphGeneration += 1
    graph = makeGraph(context, output)
    formatSession = createDrumKitFormatSession<DrumKitSampleResource>(context, {
      ...(options.probeOpusSupport === undefined
        ? {}
        : { probeOpus: options.probeOpusSupport }),
      knownResourceIds: DRUM_KIT_CATALOG.flatMap((kit) =>
        kit.resources.map((resource) => resource.id),
      ),
    })
    resetFormatPlan()
    masterOpen = false
    return graph
  }

  const prepareFormatPlan = async (): Promise<void> => {
    const manifest = selectedManifest()
    if (manifest.engine !== 'sampled') {
      resetFormatPlan()
      return
    }
    if (
      formatPlanKitId === selectedKitId &&
      selectedFormat !== null &&
      selectedEncodings.size === manifest.resources.length
    ) {
      return
    }
    const session = formatSession
    if (session === null) throw new Error(CONTEXT_ERROR)
    const kitId = selectedKitId
    const generation = selectionGeneration
    const plan = await session.select(manifest.resources)
    if (
      disposed ||
      selectedKitId !== kitId ||
      selectionGeneration !== generation
    ) {
      throw abortError()
    }
    applyFormatPlan(kitId, plan.format, plan.resources)
  }

  const switchSelectedKitToMp3 = (): boolean => {
    if (selectedFormat !== 'opus' || formatSession === null) return false
    const manifest = selectedManifest()
    if (manifest.engine !== 'sampled') return false
    panicInternal()
    selectionAbort.abort()
    selectionAbort = new AbortController()
    selectionGeneration += 1
    const fallback = formatSession.fallback(manifest.resources)
    clearSelectedKitCache()
    applyFormatPlan(selectedKitId, fallback.format, fallback.resources)
    sampleSelector.reset()
    return true
  }

  const loadResource = async (
    resource: DrumKitSampleResource,
    callerSignal?: AbortSignal,
  ): Promise<AudioBuffer> => {
    const cached = cachedSample(resource)
    if (cached !== undefined) return cached.buffer
    const activeGraph = graph
    if (activeGraph === null) throw new Error(CONTEXT_ERROR)
    const format = selectedFormat
    const encoding = selectedEncodings.get(resource.id)
    if (format === null || encoding === undefined) {
      throw new Error('The selected drum kit has no active format plan')
    }
    const contextGeneration = graphGeneration
    const selectionSignal = selectionAbort.signal
    const inFlightKey = `${contextGeneration}:${selectionGeneration}:${format}:${resource.id}`
    const existing = inFlight.get(inFlightKey)
    if (existing !== undefined) return waitForCaller(existing, callerSignal)
    const combined = combineAbortSignals(lifetimeAbort.signal, selectionSignal)
    const promise = (async (): Promise<AudioBuffer> => {
      try {
        throwIfAborted(combined.signal)
        const maximumBytes = Math.min(
          maxEncodedSampleBytes,
          encoding.encodedBytes,
        )
        const encoded = await fetchArrayBuffer(
          resolveDrumKitEncodingAssetUrl(encoding, options.assetBaseUrl),
          combined.signal,
          maximumBytes,
        )
        throwIfAborted(combined.signal)
        if (encoded.byteLength !== encoding.encodedBytes) {
          throw new Error('Encoded drum sample does not match its manifest')
        }
        if (!(await verifyResource(encoded, encoding.sha256))) {
          throw new Error('Encoded drum sample failed its integrity check')
        }
        throwIfAborted(combined.signal)
        const buffer = await activeGraph.context.decodeAudioData(
          encoded.slice(0),
        )
        throwIfAborted(combined.signal)
        if (
          disposed ||
          graph !== activeGraph ||
          graphGeneration !== contextGeneration ||
          selectedKitId !== resource.kitId ||
          selectedFormat !== format
        ) {
          throw abortError()
        }
        return storeSample(resource, format, buffer)
      } finally {
        combined.cleanup()
      }
    })()
    inFlight.set(inFlightKey, promise)
    promise.then(
      () => {
        if (inFlight.get(inFlightKey) === promise) inFlight.delete(inFlightKey)
      },
      () => {
        if (inFlight.get(inFlightKey) === promise) inFlight.delete(inFlightKey)
      },
    )
    return waitForCaller(promise, callerSignal)
  }

  const prepareResources = async (
    resources: readonly DrumKitSampleResource[],
    signal?: AbortSignal,
    foreground = true,
  ): Promise<void> => {
    if (foreground) setLoadState('loading')
    try {
      await prepareFormatPlan()
    } catch (error) {
      if (!isAbortError(error)) setLoadState('error', LOAD_ERROR)
      return
    }
    const uniqueResources = Array.from(
      new Map(resources.map((resource) => [resource.id, resource])).values(),
    )
    const runSelectionSignal = selectionAbort.signal
    const generation = foreground ? ++loadGeneration : loadGeneration
    if (foreground) {
      preparedResourceIds = new Set(
        uniqueResources.map((resource) => resource.id),
      )
      plannedSamples = uniqueResources.length
      refreshPreparedSamples()
      setLoadState(uniqueResources.length === 0 ? 'ready' : 'loading')
    }
    const resourcesToLoad = uniqueResources.filter(
      (resource) => !hasSelectedSample(resource.id),
    )
    if (resourcesToLoad.length === 0) {
      if (foreground) {
        setLoadState(
          preparedSamples === plannedSamples ? 'ready' : 'error',
          preparedSamples === plannedSamples ? null : LOAD_ERROR,
        )
      }
      return
    }
    if (foreground) {
      for (const resource of uniqueResources) retainSample(resource.id)
    }
    let cursor = 0
    let failure: unknown = null
    try {
      const workers = Array.from(
        { length: Math.min(loadConcurrency, resourcesToLoad.length) },
        async () => {
          while (cursor < resourcesToLoad.length) {
            const resource = resourcesToLoad[cursor]
            cursor += 1
            try {
              await loadResource(resource, signal)
              if (foreground && loadGeneration === generation) {
                refreshPreparedSamples()
                emit()
              }
            } catch (error) {
              const runCancelled =
                disposed ||
                signal?.aborted === true ||
                runSelectionSignal.aborted ||
                (foreground && loadGeneration !== generation)
              if (isAbortError(error) && runCancelled) return
              failure ??= error
            }
          }
        },
      )
      await Promise.all(workers)
    } finally {
      if (foreground) {
        for (const resource of uniqueResources) releaseSample(resource.id)
      }
    }
    if (!foreground) {
      if (
        failure !== null &&
        !disposed &&
        signal?.aborted !== true &&
        !runSelectionSignal.aborted &&
        switchSelectedKitToMp3()
      ) {
        await prepareResources(uniqueResources, signal, true)
        return
      }
      if (
        failure !== null &&
        !disposed &&
        signal?.aborted !== true &&
        !runSelectionSignal.aborted
      ) {
        setLoadState('error', LOAD_ERROR)
      }
      return
    }
    if (loadGeneration !== generation) return
    if (disposed || signal?.aborted === true || runSelectionSignal.aborted) {
      return
    }
    if (failure !== null && switchSelectedKitToMp3()) {
      await prepareResources(uniqueResources, signal, true)
      return
    }
    refreshPreparedSamples()
    if (failure === null && preparedSamples === plannedSamples) {
      setLoadState('ready')
    } else {
      setLoadState('error', LOAD_ERROR)
    }
  }

  const resourcesForHits = (
    hits: readonly DrumKitPrewarmHit[],
  ): readonly DrumKitSampleResource[] =>
    hits.flatMap((hit) => playbackPoolForGmKey(hit.gmKey, hit.velocity))

  const warmMiss = (resource: DrumKitSampleResource): void => {
    void prepareResources([resource], undefined, false).catch(
      (error: unknown) => {
        if (!isAbortError(error)) setLoadState('error', LOAD_ERROR)
      },
    )
  }

  const chooseResource = (
    gmKey: number,
    velocity: number,
  ): DrumKitSampleResource | null => {
    if (selectedKitId === 'mercury-synth') return null
    // Stay in the nearest authored velocity layer, then prefer ready over
    // reduced material. Fallback-quality resources yield to Mercury Synth.
    const pool = playbackPoolForGmKey(gmKey, velocity)
    const curve =
      pool.length === 0
        ? undefined
        : resolveDrumKitVelocityCurve(
            selectedManifest().velcurve,
            pool[0].articulation,
          )
    const preferred = sampleSelector.pick(pool, velocity, curve)
    if (preferred === null) return null
    if (hasSelectedSample(preferred.id)) return preferred
    return pool.find((resource) => hasSelectedSample(resource.id)) ?? preferred
  }

  const chokeInternal = (
    group: string,
    atContextTime?: number,
    lane?: DrumKitPlaybackLane,
  ): number => {
    const activeGraph = graph
    if (activeGraph === null || group === '') return 0
    const at = Math.max(
      activeGraph.context.currentTime,
      Number.isFinite(atContextTime) ? (atContextTime as number) : 0,
    )
    let released = circuitEngine.choke(group, at, lane)
    for (const voice of voices.values()) {
      if (
        voice.chokeGroup === group &&
        (lane === undefined || voice.lane === lane) &&
        releaseVoice(voice, at, CHOKE_RELEASE_SECONDS)
      ) {
        released += 1
      }
    }
    for (const voice of fallbackVoices.values()) {
      if (
        voice.chokeGroup === group &&
        (lane === undefined || voice.lane === lane) &&
        releaseFallbackVoice(voice, at, CHOKE_RELEASE_SECONDS)
      ) {
        released += 1
      }
    }
    return released
  }

  const playSample = (
    resource: DrumKitSampleResource,
    cached: CachedSample,
    gmKey: number,
    velocity: number,
    atContextTime?: number,
    lane: DrumKitPlaybackLane = 'live',
  ): boolean => {
    const activeGraph = graph
    if (activeGraph === null) return false
    const at = Math.max(
      activeGraph.context.currentTime,
      Number.isFinite(atContextTime) ? (atContextTime as number) : 0,
    )
    for (const group of resource.chokes) chokeInternal(group, at, lane)
    enforceVoiceLimit(at)
    let voice: SampleVoice | null = null
    try {
      const boundedVelocity = clamp(velocity, 1, 127)
      const variation = microVariation(hitRandom, resource.articulation)
      const source = activeGraph.context.createBufferSource()
      const gain = activeGraph.context.createGain()
      const strikeGain = Math.max(
        MINIMUM_GAIN,
        resource.playbackGain *
          velocityGain(
            resource.articulation,
            boundedVelocity,
            resolveDrumKitVelocityCurve(
              selectedManifest().velcurve,
              resource.articulation,
            ),
            resource.power,
          ) *
          variation.gainScale,
      )
      source.buffer = cached.buffer
      source.playbackRate.value = variation.rateRatio
      gain.gain.setValueAtTime(MINIMUM_GAIN, at)
      gain.gain.exponentialRampToValueAtTime(
        strikeGain,
        at + SAMPLE_ATTACK_SECONDS,
      )
      const cutoffHz = brightnessCutoffHz(boundedVelocity)
      let filter: BiquadFilterNode | null = null
      if (cutoffHz !== null) {
        filter = activeGraph.context.createBiquadFilter()
        filter.type = 'lowpass'
        filter.frequency.value = cutoffHz * variation.cutoffScale
        filter.Q.value = 0.5
        source.connect(filter)
        filter.connect(gain)
      } else {
        source.connect(gain)
      }
      gain.connect(triggerDestination(activeGraph, lane, gmKey))
      const startedVoice: SampleVoice = {
        sequence: ++voiceSequence,
        source,
        filter,
        gain,
        resourceId: resource.id,
        chokeGroup: drumKitChokeGroupForGmKey(gmKey) ?? resource.chokeGroup,
        lane,
        releaseAt: null,
        cleaned: false,
      }
      voice = startedVoice
      voices.set(startedVoice.sequence, startedVoice)
      retainSample(resource.id)
      source.onended = () => cleanVoice(startedVoice)
      openLane(activeGraph, lane, at)
      openMaster(activeGraph, at)
      source.start(
        at,
        Math.min(
          cached.onsetSec + variation.startOffsetSec,
          Math.max(0, cached.buffer.duration - 0.001),
        ),
      )
      return true
    } catch {
      if (voice !== null) {
        safeStop(voice.source, at)
        cleanVoice(voice)
      }
      return false
    }
  }

  const triggerFallback = (
    gmKey: number,
    velocity: number,
    atContextTime?: number,
    lane: DrumKitPlaybackLane = 'live',
  ): DrumKitTriggerResult => {
    const activeGraph = graph
    const voice = drumVoiceForMidi(gmKey)
    if (voice === null) return 'unmapped'
    if (activeGraph === null) return 'dropped'
    const at = Math.max(
      activeGraph.context.currentTime,
      Number.isFinite(atContextTime) ? (atContextTime as number) : 0,
    )
    if (voice === 'hh-closed' || voice === 'hh-pedal') {
      chokeInternal(CIRCUIT_OPEN_HAT_CHOKE_GROUP, at, lane)
    }
    enforceVoiceLimit(at)
    let fallbackVoice: FallbackVoice | null = null
    try {
      openLane(activeGraph, lane, at)
      openMaster(activeGraph, at)
      const gain = activeGraph.context.createGain()
      gain.gain.setValueAtTime(1, activeGraph.context.currentTime)
      gain.connect(triggerDestination(activeGraph, lane, gmKey))
      const startedVoice: FallbackVoice = {
        sequence: ++voiceSequence,
        context: activeGraph.context,
        gain,
        chokeGroup: drumKitChokeGroupForGmKey(gmKey),
        lane,
        releaseAt: null,
        cleanupTimer: null,
        cleaned: false,
      }
      fallbackVoice = startedVoice
      fallbackVoices.set(startedVoice.sequence, startedVoice)
      scheduleFallbackCleanup(
        startedVoice,
        at + FALLBACK_VOICE_TAIL_SECONDS + RELEASE_SLACK_SECONDS,
      )
      triggerDrumVoice(
        voice,
        activeGraph.context,
        at,
        clamp(velocity, 1, 127) / 127,
        gain,
      )
      return 'synth-fallback'
    } catch {
      if (fallbackVoice !== null) cleanFallbackVoice(fallbackVoice)
      return 'dropped'
    }
  }

  const triggerCircuit = (
    gmKey: number,
    velocity: number,
    atContextTime?: number,
    lane: DrumKitPlaybackLane = 'live',
    sourceId?: string,
  ): DrumKitTriggerResult => {
    const activeGraph = graph
    if (activeGraph === null) return 'dropped'
    const at = Math.max(
      activeGraph.context.currentTime,
      Number.isFinite(atContextTime) ? (atContextTime as number) : 0,
    )
    openLane(activeGraph, lane, at)
    openMaster(activeGraph, at)
    return circuitEngine.trigger(
      activeGraph.context,
      triggerDestination(activeGraph, lane, gmKey),
      {
        gmKey,
        velocity,
        atContextTime: at,
        lane,
        ...(sourceId === undefined ? {} : { sourceId }),
      },
    )
  }

  return {
    running: () => graph !== null && graph.context.state === 'running',
    async activate(): Promise<boolean> {
      try {
        await acquireGraph()
      } catch (error) {
        if (!isAbortError(error)) setLoadState('error', CONTEXT_ERROR)
        return false
      }
      if (selectedManifest().engine === 'synth') {
        preparedResourceIds = new Set()
        plannedSamples = 0
        preparedSamples = 0
        setLoadState('ready')
      } else {
        void prepareResources(resourcesForHits(BASELINE_HITS), undefined)
      }
      return true
    },
    trigger(hit: DrumKitTrigger): DrumKitTriggerResult {
      const gmKey = normalizeGeneralMidiPercussionKey(hit.gmKey)
      if (gmKey === null) return 'unmapped'
      const velocity = clamp(hit.velocity, 1, 127)
      const lane = hit.lane ?? 'live'
      if (selectedManifest().synthModel === 'circuit') {
        return triggerCircuit(
          gmKey,
          velocity,
          hit.atContextTime,
          lane,
          hit.sourceId,
        )
      }
      if (selectedManifest().engine === 'sampled') {
        const resource = chooseResource(gmKey, velocity)
        if (resource !== null) {
          const cached = cachedSample(resource)
          if (
            cached !== undefined &&
            playSample(
              resource,
              cached,
              gmKey,
              velocity,
              hit.atContextTime,
              lane,
            )
          ) {
            return 'sampled'
          }
          if (graph !== null && !disposed) warmMiss(resource)
        }
      }
      return triggerFallback(gmKey, velocity, hit.atContextTime, lane)
    },
    panic(lane?: DrumKitPlaybackLane): void {
      panicInternal(undefined, lane)
    },
    dispose(): void {
      if (disposed) return
      lifetimeAbort.abort()
      selectionAbort.abort()
      panicInternal()
      circuitEngine.dispose()
      for (const voice of fallbackVoices.values()) cleanFallbackVoice(voice)
      const activeGraph = graph
      graph = null
      cache.clear()
      decodedBytes = 0
      preparedResourceIds = new Set()
      plannedSamples = 0
      preparedSamples = 0
      listeners.clear()
      disposed = true
      if (activeGraph !== null) retireGraph(activeGraph)
    },
    selectedKit(): DrumKitManifest {
      return selectedManifest()
    },
    async selectKit(kitId: DrumKitId, signal?: AbortSignal): Promise<void> {
      if (disposed) return
      if (kitId === selectedKitId) {
        if (
          graph !== null &&
          selectedManifest().engine === 'sampled' &&
          status === 'error'
        ) {
          await prepareResources(resourcesForHits(BASELINE_HITS), signal)
        }
        return
      }
      panicInternal()
      selectionAbort.abort()
      selectionAbort = new AbortController()
      selectionGeneration += 1
      loadGeneration += 1
      selectedKitId = kitId
      sampleSelector.reset()
      resetFormatPlan()
      preparedResourceIds = new Set()
      plannedSamples = 0
      preparedSamples = 0
      setLoadState(graph === null ? 'idle' : 'ready')
      if (graph !== null && selectedManifest().engine === 'sampled') {
        await prepareResources(resourcesForHits(BASELINE_HITS), signal)
      }
    },
    async retry(signal?: AbortSignal): Promise<void> {
      if (disposed || graph === null) return
      if (selectedManifest().engine === 'synth') {
        setLoadState('ready')
        return
      }
      await prepareResources(resourcesForHits(BASELINE_HITS), signal)
    },
    async prewarm(
      hits: readonly DrumKitPrewarmHit[],
      signal?: AbortSignal,
    ): Promise<void> {
      if (disposed || graph === null) throw new Error(CONTEXT_ERROR)
      if (selectedManifest().engine === 'synth') {
        preparedResourceIds = new Set()
        plannedSamples = 0
        preparedSamples = 0
        setLoadState('ready')
        return
      }
      await prepareResources(resourcesForHits(hits), signal)
    },
    choke(request: DrumKitChoke): DrumKitChokeOutcome {
      const gmKey = normalizeGeneralMidiPercussionKey(request.gmKey)
      if (gmKey === null) return 'unmapped'
      const group = drumKitChokeGroupForGmKey(gmKey)
      if (group === null) return 'unmapped'
      if (graph === null || disposed) return 'dropped'
      const released = chokeInternal(
        group,
        request.atContextTime,
        request.lane ?? 'live',
      )
      if (released > 0) return 'choked'
      if (selectedManifest().synthModel === 'circuit') return 'idle'
      return drumVoiceForMidi(gmKey) === null ? 'unsupported' : 'idle'
    },
    setVolume(nextVolume: number): void {
      volume = clamp(nextVolume, 0, 1)
      const activeGraph = graph
      if (activeGraph === null || !masterOpen) return
      try {
        activeGraph.master.gain.setTargetAtTime(
          volume,
          activeGraph.context.currentTime,
          LANE_LEVEL_TIME_CONSTANT_SECONDS,
        )
      } catch {
        // A closing route no longer needs live volume automation.
      }
    },
    setLaneVolume(lane: DrumKitPlaybackLane, nextVolume: number): void {
      laneVolumes[lane] = clamp(nextVolume, 0, 1)
      const activeGraph = graph
      if (activeGraph === null || !laneOpen[lane]) return
      const at = activeGraph.context.currentTime
      const parameter = activeGraph.lanes[lane].gain
      holdParameter(parameter, at)
      try {
        parameter.setTargetAtTime(
          laneVolumes[lane],
          at,
          LANE_LEVEL_TIME_CONSTANT_SECONDS,
        )
      } catch {
        // A closing route no longer needs lane automation.
      }
    },
    setAuthoredFamilyVolume(
      family: DrumKitAuthoredFamily,
      nextVolume: number,
    ): void {
      authoredFamilyVolumes[family] = clamp(nextVolume, 0, 1)
      const activeGraph = graph
      if (activeGraph === null) return
      const at = activeGraph.context.currentTime
      const parameter = activeGraph.authoredFamilies[family].gain
      holdParameter(parameter, at)
      try {
        parameter.setTargetAtTime(
          authoredFamilyVolumes[family],
          at,
          LANE_LEVEL_TIME_CONSTANT_SECONDS,
        )
      } catch {
        // A closing route no longer needs family automation.
      }
    },
    liveCaptureStream(): MediaStream | null {
      return graph?.liveCapture?.stream ?? null
    },
    snapshot(): DrumKitPlayerSnapshot {
      return currentSnapshot()
    },
    subscribe(listener: () => void): () => void {
      if (disposed) return () => undefined
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}
