// ============================================================
// Piano sampled instrument — lazy Salamander playback on one bounded graph
// ============================================================
//
// Construction is deliberately inert. An owning interaction must call load
// or prewarm after audio activation; synchronous note events then either use a
// cached sample or return false so the instrument router can use its fallback.

import type { PianoInstrumentDescriptor, PianoInstrumentNoteOff, PianoInstrumentNoteOn, PianoInstrumentPedalEvent, PianoInstrumentPort, } from './piano-instrument-port'
import type { PianoSampleResource, SalamanderAttackVelocityLayer, } from './piano-sample-manifest'
import { isAllowedSalamanderSampleUrl, resolveSalamanderRootMidi, resolveSalamanderVelocityLayer, SALAMANDER_ATTACK_VELOCITY_LAYERS, SALAMANDER_COMPACT_PIANO_MANIFEST, SALAMANDER_PEDAL_RESOURCES, salamanderAttackResource, salamanderReleaseResource, } from './piano-sample-manifest'

export type PianoSampledCharacter = 'soft' | 'balanced' | 'bright'
export type PianoSampledAmbience = 'close' | 'studio' | 'hall'
export type PianoSampledLoadStatus = 'idle' | 'loading' | 'ready' | 'error'

export interface PianoSampledInstrumentLoadSnapshot {
  readonly status: PianoSampledLoadStatus
  /** At least one complete requested-key coverage pass can play synchronously. */
  readonly playable: boolean
  /** Decoded entries currently retained in the bounded LRU cache. */
  readonly loadedSamples: number
  /** Successfully prepared resources in the current or most recent plan. */
  readonly preparedSamples: number
  /** Resources in the current or most recent plan. */
  readonly plannedSamples: number
  /** @deprecated Use plannedSamples. Kept for the controller's staged rollout. */
  readonly totalSamples: number
  /** Cached bytes, including buffers retained by active voices. */
  readonly decodedBytes: number
  readonly error: string | null
}

export interface PianoSampledInstrumentControls {
  setCharacter(character: PianoSampledCharacter): void
  setAmbience(ambience: PianoSampledAmbience): void
  getLoadSnapshot(): PianoSampledInstrumentLoadSnapshot
  subscribe(listener: () => void): () => void
}

export interface PianoSampledInstrument
  extends PianoInstrumentPort, PianoSampledInstrumentControls {}

export interface PianoSampledInstrumentOptions {
  /** The route-owned context. This instrument never constructs or closes it. */
  getAudioContext(): AudioContext | null
  /** Test seam; production requests still pass the fixed manifest allowlist. */
  fetchArrayBuffer?: (
    url: string,
    signal: AbortSignal,
    maximumBytes: number,
  ) => Promise<ArrayBuffer>
  maxDecodedBytes?: number
  maxEncodedSampleBytes?: number
  maxVoices?: number
  loadConcurrency?: number
}

interface SampleGraph {
  context: AudioContext
  input: GainNode
  tone: BiquadFilterNode
  dry: GainNode
  earlyDelay: DelayNode
  early: GainNode
  lateDelay: DelayNode
  late: GainNode
  limiter: DynamicsCompressorNode
}

interface CachedSample {
  buffer: AudioBuffer
  bytes: number
}

interface InFlightSample {
  promise: Promise<AudioBuffer>
  signal: AbortSignal
}

interface SampleVoice {
  id: string
  midi: number
  sequence: number
  source: AudioBufferSourceNode
  gain: GainNode
  sampleId: string
  releaseAt: number | null
  releaseSampleTriggered: boolean
  cleaned: boolean
}

interface AuxiliaryVoice {
  sequence: number
  source: AudioBufferSourceNode
  gain: GainNode
  sampleId: string
  cleaned: boolean
}

const MIB = 1024 * 1024
const DEFAULT_MAX_DECODED_BYTES = 96 * MIB
const DEFAULT_MAX_ENCODED_SAMPLE_BYTES = 2 * MIB
const DEFAULT_MAX_VOICES = 64
const MAXIMUM_MAX_VOICES = 96
const DEFAULT_LOAD_CONCURRENCY = 2
const MAX_PREWARM_ROOTS = 8
const MAX_AUXILIARY_VOICES = 24
const ATTACK_RESERVATION_NUMERATOR = 9
const ATTACK_RESERVATION_DENOMINATOR = 8
const RELEASE_RESERVATION_DIVISOR = 16
const PEDAL_DOWN_RESERVATION_NUMERATOR = 3
const PEDAL_DOWN_RESERVATION_DENOMINATOR = 8
const MINIMUM_GAIN = 0.0001
const RELEASE_SECONDS = 0.16
const STEAL_RELEASE_SECONDS = 0.025
const LOAD_ERROR =
  'The sampled piano could not finish loading. The fallback piano remains available.'
const CONTEXT_ERROR =
  'The sampled piano needs an active audio session. The fallback piano remains available.'

const DESCRIPTOR: PianoInstrumentDescriptor = Object.freeze({
  id: SALAMANDER_COMPACT_PIANO_MANIFEST.id,
  name: SALAMANDER_COMPACT_PIANO_MANIFEST.name,
  kind: 'sampled',
  maximumVoices: DEFAULT_MAX_VOICES,
})

const COVERAGE_VELOCITY_LAYER: SalamanderAttackVelocityLayer = 12
const DETAIL_VELOCITY_LAYERS = Object.freeze(
  SALAMANDER_ATTACK_VELOCITY_LAYERS.filter(
    (velocityLayer) => velocityLayer !== COVERAGE_VELOCITY_LAYER,
  ),
)
const BASELINE_COVERAGE_RESOURCES = Object.freeze([
  salamanderAttackResource(60, COVERAGE_VELOCITY_LAYER),
])
const BASELINE_RESOURCES = BASELINE_COVERAGE_RESOURCES

const CHARACTER_SETTINGS: Readonly<
  Record<
    PianoSampledCharacter,
    Readonly<{
      cutoff: number
      resonance: number
      velocityPower: number
      gain: number
    }>
  >
> = Object.freeze({
  soft: Object.freeze({
    cutoff: 5_800,
    resonance: 0.45,
    velocityPower: 1.28,
    gain: 0.9,
  }),
  balanced: Object.freeze({
    cutoff: 12_500,
    resonance: 0.3,
    velocityPower: 1,
    gain: 1,
  }),
  bright: Object.freeze({
    cutoff: 19_000,
    resonance: 0.2,
    velocityPower: 0.78,
    gain: 1.04,
  }),
})

const AMBIENCE_SETTINGS: Readonly<
  Record<
    PianoSampledAmbience,
    Readonly<{
      dry: number
      early: number
      earlyDelay: number
      late: number
      lateDelay: number
    }>
  >
> = Object.freeze({
  close: Object.freeze({
    dry: 0.95,
    early: 0.025,
    earlyDelay: 0.022,
    late: 0.012,
    lateDelay: 0.071,
  }),
  studio: Object.freeze({
    dry: 0.86,
    early: 0.11,
    earlyDelay: 0.034,
    late: 0.055,
    lateDelay: 0.096,
  }),
  hall: Object.freeze({
    dry: 0.72,
    early: 0.17,
    earlyDelay: 0.051,
    late: 0.15,
    lateDelay: 0.142,
  }),
})

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

function decodedBufferBytes(buffer: AudioBuffer): number {
  const length =
    Number.isFinite(buffer.length) && buffer.length > 0
      ? buffer.length
      : Math.ceil(buffer.duration * buffer.sampleRate)
  return length * Math.max(1, buffer.numberOfChannels) * 4
}

function abortError(): DOMException {
  return new DOMException('The piano sample load was cancelled.', 'AbortError')
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) throw abortError()
}

function combineAbortSignals(
  lifetimeSignal: AbortSignal,
  callerSignal?: AbortSignal,
): { signal: AbortSignal; cleanup(): void } {
  if (callerSignal === undefined) {
    return { signal: lifetimeSignal, cleanup() {} }
  }
  const controller = new AbortController()
  const abort = () => controller.abort()
  lifetimeSignal.addEventListener('abort', abort, { once: true })
  callerSignal.addEventListener('abort', abort, { once: true })
  if (lifetimeSignal.aborted || callerSignal.aborted) controller.abort()
  return {
    signal: controller.signal,
    cleanup() {
      lifetimeSignal.removeEventListener('abort', abort)
      callerSignal.removeEventListener('abort', abort)
    },
  }
}

function safeDisconnect(node: AudioNode): void {
  try {
    node.disconnect()
  } catch {
    // Route teardown can race a natural source ending.
  }
}

function safeStop(source: AudioBufferSourceNode, at: number): void {
  try {
    source.stop(at)
  } catch {
    // A stopped or invalidated source is already silent.
  }
}

async function defaultFetchArrayBuffer(
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
  if (!response.ok)
    throw new Error(`Piano sample request failed (${response.status})`)

  const statedLength = response.headers.get('content-length')
  if (statedLength !== null) {
    const parsedLength = Number(statedLength)
    if (Number.isFinite(parsedLength) && parsedLength > maximumBytes) {
      throw new Error('Encoded piano sample exceeds the response budget')
    }
  }
  if (response.body === null) {
    throw new Error('Piano sample response cannot be streamed safely')
  }

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let byteLength = 0
  try {
    while (true) {
      throwIfAborted(signal)
      const next = await reader.read()
      if (next.done) break
      if (next.value.byteLength === 0) continue
      byteLength += next.value.byteLength
      if (byteLength > maximumBytes) {
        await reader.cancel('Piano sample exceeded its response budget')
        throw new Error('Encoded piano sample exceeds the response budget')
      }
      chunks.push(next.value)
    }
  } finally {
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

function setAudioParameter(
  parameter: AudioParam,
  value: number,
  at: number,
): void {
  try {
    parameter.cancelScheduledValues(at)
    parameter.setTargetAtTime(value, at, 0.012)
  } catch {
    try {
      parameter.value = value
    } catch {
      // A closed route no longer needs its pending control change.
    }
  }
}

function velocityLayerDistance(
  left: SalamanderAttackVelocityLayer,
  right: SalamanderAttackVelocityLayer,
): number {
  return Math.abs(left - right)
}

/** Create an inert sampled instrument; load/prewarm performs the first I/O. */
export function createPianoSampledInstrument(
  options: PianoSampledInstrumentOptions,
): PianoSampledInstrument {
  const fetchArrayBuffer = options.fetchArrayBuffer ?? defaultFetchArrayBuffer
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
  const descriptor = Object.freeze({ ...DESCRIPTOR, maximumVoices: maxVoices })
  const cache = new Map<string, CachedSample>()
  const inFlight = new Map<string, InFlightSample>()
  const retainedSampleCounts = new Map<string, number>()
  const voices = new Map<string, SampleVoice>()
  const auxiliaries = new Map<number, AuxiliaryVoice>()
  const listeners = new Set<() => void>()
  const lifetimeAbort = new AbortController()

  let graph: SampleGraph | null = null
  let graphGeneration = 0
  let decodedBytes = 0
  let voiceSequence = 0
  let auxiliarySequence = 0
  let pedalVariant = 0
  let sustainDown = false
  let softPedalValue = 0
  let volume = 1
  let character: PianoSampledCharacter = 'balanced'
  let ambience: PianoSampledAmbience = 'studio'
  let loadStatus: PianoSampledLoadStatus = 'idle'
  let playable = false
  let loadError: string | null = null
  let plannedSamples = 0
  let preparedSamples = 0
  let preparationGeneration = 0
  let loadPromise: Promise<void> | null = null
  let disposed = false

  const snapshot = (): PianoSampledInstrumentLoadSnapshot =>
    Object.freeze({
      status: loadStatus,
      playable,
      loadedSamples: cache.size,
      preparedSamples,
      plannedSamples,
      totalSamples: plannedSamples,
      decodedBytes,
      error: loadError,
    })

  const emit = (): void => {
    if (disposed) return
    for (const listener of listeners) listener()
  }

  const setLoadState = (
    status: PianoSampledLoadStatus,
    error: string | null = null,
  ): void => {
    loadStatus = status
    loadError = error
    emit()
  }

  const applyMasterGain = (activeGraph: SampleGraph): void => {
    const setting = CHARACTER_SETTINGS[character]
    setAudioParameter(
      activeGraph.input.gain,
      0.76 * setting.gain * volume,
      activeGraph.context.currentTime,
    )
  }

  const applyCharacter = (activeGraph: SampleGraph): void => {
    const setting = CHARACTER_SETTINGS[character]
    const now = activeGraph.context.currentTime
    const nyquistSafeCutoff = Math.max(
      1_000,
      Math.min(setting.cutoff, activeGraph.context.sampleRate / 2 - 100),
    )
    setAudioParameter(activeGraph.tone.frequency, nyquistSafeCutoff, now)
    setAudioParameter(activeGraph.tone.Q, setting.resonance, now)
    applyMasterGain(activeGraph)
  }

  const applyAmbience = (activeGraph: SampleGraph): void => {
    const setting = AMBIENCE_SETTINGS[ambience]
    const now = activeGraph.context.currentTime
    setAudioParameter(activeGraph.dry.gain, setting.dry, now)
    setAudioParameter(activeGraph.early.gain, setting.early, now)
    setAudioParameter(activeGraph.late.gain, setting.late, now)
    setAudioParameter(activeGraph.earlyDelay.delayTime, setting.earlyDelay, now)
    setAudioParameter(activeGraph.lateDelay.delayTime, setting.lateDelay, now)
  }

  const disconnectGraph = (activeGraph: SampleGraph | null): void => {
    if (activeGraph === null) return
    safeDisconnect(activeGraph.input)
    safeDisconnect(activeGraph.tone)
    safeDisconnect(activeGraph.dry)
    safeDisconnect(activeGraph.earlyDelay)
    safeDisconnect(activeGraph.early)
    safeDisconnect(activeGraph.lateDelay)
    safeDisconnect(activeGraph.late)
    safeDisconnect(activeGraph.limiter)
  }

  const clearCache = (): void => {
    cache.clear()
    decodedBytes = 0
    playable = false
    emit()
  }

  const retainSample = (sampleId: string): void => {
    retainedSampleCounts.set(
      sampleId,
      (retainedSampleCounts.get(sampleId) ?? 0) + 1,
    )
  }

  const releaseSample = (sampleId: string): void => {
    const count = retainedSampleCounts.get(sampleId)
    if (count === undefined) return
    if (count <= 1) retainedSampleCounts.delete(sampleId)
    else retainedSampleCounts.set(sampleId, count - 1)
  }

  const cleanVoice = (voice: SampleVoice): void => {
    if (voice.cleaned) return
    voice.cleaned = true
    if (voices.get(voice.id) === voice) voices.delete(voice.id)
    releaseSample(voice.sampleId)
    safeDisconnect(voice.source)
    safeDisconnect(voice.gain)
  }

  const cleanAuxiliary = (voice: AuxiliaryVoice): void => {
    if (voice.cleaned) return
    voice.cleaned = true
    if (auxiliaries.get(voice.sequence) === voice) {
      auxiliaries.delete(voice.sequence)
    }
    releaseSample(voice.sampleId)
    safeDisconnect(voice.source)
    safeDisconnect(voice.gain)
  }

  const panicInternal = (atContextTime?: number): void => {
    const context = graph?.context ?? null
    const at = Math.max(
      context?.currentTime ?? 0,
      Number.isFinite(atContextTime) ? (atContextTime as number) : 0,
    )
    const activeVoices = Array.from(voices.values())
    voices.clear()
    for (const voice of activeVoices) {
      safeStop(voice.source, at)
      cleanVoice(voice)
    }
    const activeAuxiliaries = Array.from(auxiliaries.values())
    for (const voice of activeAuxiliaries) {
      safeStop(voice.source, at)
      cleanAuxiliary(voice)
    }
    sustainDown = false
    softPedalValue = 0
  }

  const createGraph = (context: AudioContext): SampleGraph => {
    const input = context.createGain()
    const tone = context.createBiquadFilter()
    const dry = context.createGain()
    const earlyDelay = context.createDelay(0.25)
    const early = context.createGain()
    const lateDelay = context.createDelay(0.35)
    const late = context.createGain()
    const limiter = context.createDynamicsCompressor()

    tone.type = 'lowpass'
    limiter.threshold.value = -7
    limiter.knee.value = 5
    limiter.ratio.value = 10
    limiter.attack.value = 0.003
    limiter.release.value = 0.18

    input.connect(tone)
    tone.connect(dry)
    dry.connect(limiter)
    tone.connect(earlyDelay)
    earlyDelay.connect(early)
    early.connect(limiter)
    tone.connect(lateDelay)
    lateDelay.connect(late)
    late.connect(limiter)
    limiter.connect(context.destination)

    const nextGraph = {
      context,
      input,
      tone,
      dry,
      earlyDelay,
      early,
      lateDelay,
      late,
      limiter,
    }
    applyCharacter(nextGraph)
    applyAmbience(nextGraph)
    return nextGraph
  }

  const ensureGraph = (): SampleGraph => {
    if (disposed) throw new Error(LOAD_ERROR)
    const context = options.getAudioContext()
    if (context === null || context.state === 'closed') {
      throw new Error(CONTEXT_ERROR)
    }
    if (graph?.context === context) return graph
    if (graph !== null) {
      panicInternal(graph.context.currentTime)
      disconnectGraph(graph)
      clearCache()
    }
    graphGeneration += 1
    graph = createGraph(context)
    return graph
  }

  const cachedSample = (
    resource: PianoSampleResource,
  ): CachedSample | undefined => {
    const cached = cache.get(resource.id)
    if (cached === undefined) return undefined
    cache.delete(resource.id)
    cache.set(resource.id, cached)
    return cached
  }

  const storeSample = (
    resource: PianoSampleResource,
    buffer: AudioBuffer,
  ): AudioBuffer => {
    const bytes = decodedBufferBytes(buffer)
    if (!Number.isSafeInteger(bytes) || bytes <= 0 || bytes > maxDecodedBytes) {
      throw new Error('Decoded piano sample exceeds the cache budget')
    }
    const previous = cache.get(resource.id)
    const previousBytes = previous?.bytes ?? 0
    const requiredBytes = decodedBytes - previousBytes + bytes
    const evictionIds: string[] = []
    let evictableBytes = 0
    if (requiredBytes > maxDecodedBytes) {
      for (const [sampleId, sample] of cache) {
        if (sampleId === resource.id || retainedSampleCounts.has(sampleId)) {
          continue
        }
        evictionIds.push(sampleId)
        evictableBytes += sample.bytes
        if (requiredBytes - evictableBytes <= maxDecodedBytes) break
      }
      if (requiredBytes - evictableBytes > maxDecodedBytes) {
        throw new Error(
          'Decoded piano samples retained for playback exceed the cache budget',
        )
      }
    }

    if (previous !== undefined) {
      cache.delete(resource.id)
      decodedBytes -= previous.bytes
    }
    for (const sampleId of evictionIds) {
      const evicted = cache.get(sampleId)
      if (evicted === undefined) continue
      cache.delete(sampleId)
      decodedBytes -= evicted.bytes
    }
    cache.set(resource.id, { buffer, bytes })
    decodedBytes += bytes
    emit()
    return buffer
  }

  const loadResource = (
    resource: PianoSampleResource,
    signal: AbortSignal,
  ): Promise<AudioBuffer> => {
    const cached = cachedSample(resource)
    if (cached !== undefined) return Promise.resolve(cached.buffer)
    const existing = inFlight.get(resource.id)
    if (existing !== undefined && existing.signal === signal) {
      return existing.promise
    }
    if (!isAllowedSalamanderSampleUrl(resource.url)) {
      return Promise.reject(new Error('Piano sample URL was not allowlisted'))
    }
    const activeGraph = ensureGraph()
    const requestGeneration = graphGeneration
    const raw = (async () => {
      throwIfAborted(signal)
      const encoded = await fetchArrayBuffer(
        resource.url,
        signal,
        maxEncodedSampleBytes,
      )
      throwIfAborted(signal)
      if (
        encoded.byteLength <= 0 ||
        encoded.byteLength > maxEncodedSampleBytes
      ) {
        throw new Error('Encoded piano sample exceeds the response budget')
      }
      const buffer = await activeGraph.context.decodeAudioData(encoded.slice(0))
      throwIfAborted(signal)
      if (
        disposed ||
        requestGeneration !== graphGeneration ||
        graph?.context !== activeGraph.context
      ) {
        throw abortError()
      }
      return storeSample(resource, buffer)
    })()
    const tracked: InFlightSample = {
      signal,
      promise: raw.finally(() => {
        if (inFlight.get(resource.id) === tracked) {
          inFlight.delete(resource.id)
        }
      }),
    }
    inFlight.set(resource.id, tracked)
    return tracked.promise
  }

  const loadResources = async (
    resources: readonly PianoSampleResource[],
    signal: AbortSignal,
    onPrepared: () => void,
  ): Promise<unknown[]> => {
    const failures: unknown[] = []
    let cursor = 0
    const worker = async (): Promise<void> => {
      while (cursor < resources.length) {
        const index = cursor
        cursor += 1
        try {
          await loadResource(resources[index], signal)
          onPrepared()
        } catch (error) {
          if (signal.aborted) throw abortError()
          failures.push(error)
        }
      }
    }
    await Promise.all(
      Array.from({ length: Math.min(loadConcurrency, resources.length) }, () =>
        worker(),
      ),
    )
    return failures
  }

  const prepare = async (
    resources: readonly PianoSampleResource[],
    coverageResources: readonly PianoSampleResource[],
    signal?: AbortSignal,
  ): Promise<void> => {
    const combined = combineAbortSignals(lifetimeAbort.signal, signal)
    const generation = ++preparationGeneration
    const priorState = {
      status:
        loadStatus === 'loading'
          ? cache.size > 0
            ? ('ready' as const)
            : ('idle' as const)
          : loadStatus,
      error: loadStatus === 'loading' ? null : loadError,
      playable,
      plannedSamples,
      preparedSamples,
    }
    // The coverage pass determines a device-local decoded-byte estimate before
    // optional details enter the plan. Reporting only that pass initially keeps
    // progress truthful while the final bounded plan is still being selected.
    plannedSamples = coverageResources.length
    preparedSamples = 0
    setLoadState('loading')
    for (const resource of coverageResources) retainSample(resource.id)
    let retainedDetailResources: readonly PianoSampleResource[] = []
    let coveragePrepared = false
    try {
      throwIfAborted(combined.signal)
      ensureGraph()
      const coverageIds = new Set(
        coverageResources.map((resource) => resource.id),
      )
      const detailResources = resources.filter(
        (resource) => !coverageIds.has(resource.id),
      )
      const markPrepared = (): void => {
        if (generation !== preparationGeneration || disposed) return
        preparedSamples += 1
        emit()
      }
      const coverageFailures = await loadResources(
        coverageResources,
        combined.signal,
        markPrepared,
      )
      throwIfAborted(combined.signal)
      if (
        coverageFailures.length > 0 ||
        coverageResources.some((resource) => !cache.has(resource.id))
      ) {
        throw new Error('No playable sample remains for a requested key range')
      }
      coveragePrepared = true
      retainedDetailResources = selectDetailResources(
        detailResources,
        coverageResources,
      )
      for (const resource of retainedDetailResources) retainSample(resource.id)
      plannedSamples = coverageResources.length + retainedDetailResources.length
      // Coverage is the audible contract. Publish it before optional velocity,
      // release, and pedal detail so the route can select the Grand while this
      // same cancellable, pinned preparation continues in the background.
      playable = true
      emit()
      const detailFailures = await loadResources(
        retainedDetailResources,
        combined.signal,
        markPrepared,
      )
      throwIfAborted(combined.signal)
      if (generation === preparationGeneration) {
        setLoadState(
          'ready',
          detailFailures.length > 0
            ? 'Some optional piano details could not be loaded; playable samples remain available.'
            : null,
        )
      }
    } catch (error) {
      if (!disposed && generation === preparationGeneration) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          if (coveragePrepared) {
            plannedSamples = coverageResources.length
            preparedSamples = coverageResources.length
            playable = true
            setLoadState('ready')
          } else {
            plannedSamples = priorState.plannedSamples
            preparedSamples = priorState.preparedSamples
            playable = priorState.playable && cache.size > 0
            setLoadState(priorState.status, priorState.error)
          }
        } else {
          setLoadState(
            'error',
            error instanceof Error && error.message === CONTEXT_ERROR
              ? CONTEXT_ERROR
              : LOAD_ERROR,
          )
        }
      }
      throw error
    } finally {
      for (const resource of coverageResources) releaseSample(resource.id)
      for (const resource of retainedDetailResources) {
        releaseSample(resource.id)
      }
      combined.cleanup()
    }
  }

  const selectDetailResources = (
    detailResources: readonly PianoSampleResource[],
    coverageResources: readonly PianoSampleResource[],
  ): readonly PianoSampleResource[] => {
    const coverageBytes = coverageResources
      .map((resource) => cache.get(resource.id)?.bytes ?? 0)
      .filter((bytes) => bytes > 0)
    const largestCoverageBytes = Math.max(1, ...coverageBytes)
    const attackReservationBytes = Math.ceil(
      (largestCoverageBytes * ATTACK_RESERVATION_NUMERATOR) /
        ATTACK_RESERVATION_DENOMINATOR,
    )
    const releaseReservationBytes = Math.max(
      1,
      Math.ceil(largestCoverageBytes / RELEASE_RESERVATION_DIVISOR),
    )
    const pedalDownReservationBytes = Math.max(
      1,
      Math.ceil(
        (largestCoverageBytes * PEDAL_DOWN_RESERVATION_NUMERATOR) /
          PEDAL_DOWN_RESERVATION_DENOMINATOR,
      ),
    )
    let reservedBytes = 0
    for (const [sampleId, sample] of cache) {
      if (retainedSampleCounts.has(sampleId)) reservedBytes += sample.bytes
    }

    const reservationBytes = (resource: PianoSampleResource): number => {
      const cached = cache.get(resource.id)
      if (cached !== undefined) {
        return retainedSampleCounts.has(resource.id) ? 0 : cached.bytes
      }
      if (resource.kind === 'attack') return attackReservationBytes
      if (resource.kind === 'release') return releaseReservationBytes
      return resource.pedal?.startsWith('down-') === true
        ? pedalDownReservationBytes
        : releaseReservationBytes
    }

    // Releases and pedal noises are small but perceptually important. Reserve
    // them first, then add velocity detail in the deterministic phrase order.
    // Selected resources stay pinned for the pass, so no decoded member of the
    // plan can evict an earlier member of that same plan.
    const candidates = [
      ...detailResources.filter((resource) => resource.kind !== 'attack'),
      ...detailResources.filter((resource) => resource.kind === 'attack'),
    ]
    const selected: PianoSampleResource[] = []
    for (const resource of candidates) {
      const bytes = reservationBytes(resource)
      if (reservedBytes + bytes > maxDecodedBytes) continue
      reservedBytes += bytes
      selected.push(resource)
    }
    return selected
  }

  const prewarmResources = (
    midis: readonly number[],
  ): {
    resources: readonly PianoSampleResource[]
    coverageResources: readonly PianoSampleResource[]
  } => {
    const normalizedMidis = Array.from(
      new Set(
        midis
          .filter((midi) => Number.isFinite(midi) && midi >= 21 && midi <= 108)
          .map((midi) => Math.round(midi)),
      ),
    )
    // The caller supplies current/next phrase order. Keep the first roots in
    // that order so one prewarm cannot decode an entire piece or churn the LRU.
    const roots = Array.from(
      new Set(normalizedMidis.map(resolveSalamanderRootMidi)),
    ).slice(0, MAX_PREWARM_ROOTS)
    const selectedRoots = new Set(roots)
    const resources = new Map<string, PianoSampleResource>()
    const coverageResources = roots.map((rootMidi) =>
      salamanderAttackResource(rootMidi, COVERAGE_VELOCITY_LAYER),
    )
    for (const resource of coverageResources) {
      resources.set(resource.id, resource)
    }
    for (
      let detailIndex = 0;
      detailIndex < DETAIL_VELOCITY_LAYERS.length;
      detailIndex += 1
    ) {
      for (const [rootIndex, rootMidi] of roots.entries()) {
        const firstLayer = rootIndex % 2 === 0 ? 16 : 4
        const secondLayer = firstLayer === 16 ? 4 : 16
        const velocityLayer = [firstLayer, secondLayer, 8][
          detailIndex
        ] as SalamanderAttackVelocityLayer
        const resource = salamanderAttackResource(rootMidi, velocityLayer)
        resources.set(resource.id, resource)
      }
    }
    for (const midi of normalizedMidis) {
      if (!selectedRoots.has(resolveSalamanderRootMidi(midi))) continue
      const resource = salamanderReleaseResource(midi)
      resources.set(resource.id, resource)
    }
    if (roots.length > 0) {
      for (const resource of SALAMANDER_PEDAL_RESOURCES) {
        resources.set(resource.id, resource)
      }
    }
    return {
      resources: Array.from(resources.values()),
      coverageResources,
    }
  }

  const effectiveVelocity = (
    velocity: number,
    noteSoftPedalValue: number,
  ): number => {
    const setting = CHARACTER_SETTINGS[character]
    const curved = Math.pow(clamp(velocity, 0, 1), setting.velocityPower)
    return clamp(curved * (1 - clamp(noteSoftPedalValue, 0, 1) * 0.35), 0, 1)
  }

  const attackSample = (
    midi: number,
    velocity: number,
  ): { sample: CachedSample; sampleId: string; rootMidi: number } | null => {
    const rootMidi = resolveSalamanderRootMidi(midi)
    const desiredLayer = resolveSalamanderVelocityLayer(velocity)
    const candidates = [...SALAMANDER_ATTACK_VELOCITY_LAYERS].sort(
      (left, right) =>
        velocityLayerDistance(left, desiredLayer) -
          velocityLayerDistance(right, desiredLayer) || left - right,
    )
    for (const velocityLayer of candidates) {
      const resource = salamanderAttackResource(rootMidi, velocityLayer)
      const sample = cachedSample(resource)
      if (sample !== undefined) {
        return { sample, sampleId: resource.id, rootMidi }
      }
    }
    return null
  }

  const stealVoice = (voice: SampleVoice, at: number): void => {
    if (voices.get(voice.id) === voice) voices.delete(voice.id)
    try {
      voice.gain.gain.cancelScheduledValues(at)
      voice.gain.gain.setValueAtTime(
        Math.max(MINIMUM_GAIN, voice.gain.gain.value),
        at,
      )
      voice.gain.gain.exponentialRampToValueAtTime(
        MINIMUM_GAIN,
        at + STEAL_RELEASE_SECONDS,
      )
    } catch {
      // A closing context may invalidate its parameters before panic completes.
    }
    safeStop(voice.source, at + STEAL_RELEASE_SECONDS + 0.005)
  }

  const oldestVoice = (): SampleVoice | null => {
    let oldest: SampleVoice | null = null
    for (const voice of voices.values()) {
      if (
        oldest === null ||
        voice.sequence < oldest.sequence ||
        (voice.sequence === oldest.sequence && voice.id < oldest.id)
      ) {
        oldest = voice
      }
    }
    return oldest
  }

  const triggerAuxiliary = (
    resource: PianoSampleResource,
    at: number,
    gainValue: number,
  ): boolean => {
    const activeGraph = graph
    const cached = cachedSample(resource)
    if (activeGraph === null || cached === undefined) return false
    while (auxiliaries.size >= MAX_AUXILIARY_VOICES) {
      const oldest = auxiliaries.values().next().value as
        | AuxiliaryVoice
        | undefined
      if (oldest === undefined) break
      auxiliaries.delete(oldest.sequence)
      safeStop(oldest.source, activeGraph.context.currentTime)
      cleanAuxiliary(oldest)
    }
    let source: AudioBufferSourceNode | null = null
    let gain: GainNode | null = null
    let voice: AuxiliaryVoice | null = null
    try {
      source = activeGraph.context.createBufferSource()
      gain = activeGraph.context.createGain()
      source.buffer = cached.buffer
      gain.gain.setValueAtTime(gainValue, at)
      source.connect(gain)
      gain.connect(activeGraph.input)
      voice = {
        sequence: auxiliarySequence,
        source,
        gain,
        sampleId: resource.id,
        cleaned: false,
      }
      auxiliarySequence += 1
      retainSample(resource.id)
      auxiliaries.set(voice.sequence, voice)
      const startedVoice = voice
      source.onended = () => cleanAuxiliary(startedVoice)
      source.start(at)
      return true
    } catch {
      if (voice !== null) {
        cleanAuxiliary(voice)
        voice = null
        source = null
        gain = null
      }
      if (source !== null) {
        safeStop(source, activeGraph.context.currentTime)
        safeDisconnect(source)
      }
      if (gain !== null) safeDisconnect(gain)
      return false
    }
  }

  const triggerPedalNoise = (down: boolean, at: number): void => {
    const variant = (pedalVariant % 2) + 1
    if (!down) pedalVariant += 1
    const pedal = `${down ? 'down' : 'up'}-${variant}` as const
    const resource = SALAMANDER_PEDAL_RESOURCES.find(
      (candidate) => candidate.pedal === pedal,
    )
    if (resource !== undefined)
      triggerAuxiliary(resource, at, down ? 0.2 : 0.16)
  }

  const releaseVoice = (
    voice: SampleVoice,
    requestedAt: number,
    releaseVelocity = 0.5,
  ): boolean => {
    const activeGraph = graph
    if (activeGraph === null) return false
    const at = Math.max(activeGraph.context.currentTime, requestedAt)
    if (voice.releaseAt !== null && voice.releaseAt <= at) return false
    voice.releaseAt = at
    try {
      if (typeof voice.gain.gain.cancelAndHoldAtTime === 'function') {
        voice.gain.gain.cancelAndHoldAtTime(at)
      } else {
        voice.gain.gain.cancelScheduledValues(at)
        voice.gain.gain.setValueAtTime(
          Math.max(MINIMUM_GAIN, voice.gain.gain.value),
          at,
        )
      }
      voice.gain.gain.exponentialRampToValueAtTime(
        MINIMUM_GAIN,
        at + RELEASE_SECONDS,
      )
    } catch {
      // A route teardown can invalidate the envelope before source cleanup.
    }
    safeStop(voice.source, at + RELEASE_SECONDS + 0.01)
    if (!voice.releaseSampleTriggered) {
      voice.releaseSampleTriggered = true
      triggerAuxiliary(
        salamanderReleaseResource(voice.midi),
        at,
        0.1 + clamp(releaseVelocity, 0, 1) * 0.08,
      )
    }
    return true
  }

  const load = (signal?: AbortSignal): Promise<void> => {
    if (disposed) return Promise.reject(new Error(LOAD_ERROR))
    if (BASELINE_RESOURCES.every((resource) => cache.has(resource.id))) {
      plannedSamples = BASELINE_RESOURCES.length
      preparedSamples = BASELINE_RESOURCES.length
      playable = true
      setLoadState('ready')
      return Promise.resolve()
    }
    if (loadPromise !== null) return loadPromise
    loadPromise = prepare(
      BASELINE_RESOURCES,
      BASELINE_COVERAGE_RESOURCES,
      signal,
    ).finally(() => {
      loadPromise = null
    })
    return loadPromise
  }

  return {
    descriptor() {
      return descriptor
    },

    load,

    async prewarm(midis, signal) {
      if (disposed) throw new Error(LOAD_ERROR)
      const plan = prewarmResources(midis)
      if (plan.coverageResources.length === 0) {
        return
      }
      await prepare(plan.resources, plan.coverageResources, signal)
    },

    setVolume(nextVolume) {
      if (disposed) return
      volume = clamp(nextVolume, 0, 1)
      if (graph !== null) applyMasterGain(graph)
    },

    noteOn(note: PianoInstrumentNoteOn) {
      if (
        disposed ||
        note.id.trim() === '' ||
        !Number.isFinite(note.midi) ||
        note.midi < 21 ||
        note.midi > 108
      ) {
        return false
      }
      const activeGraph = graph
      const context = options.getAudioContext()
      if (
        activeGraph === null ||
        context === null ||
        context !== activeGraph.context ||
        context.state === 'closed'
      ) {
        return false
      }
      const velocity = clamp(note.velocity, 0, 1)
      if (velocity <= 0) return false
      const midi = Math.min(108, Math.max(21, Math.round(note.midi)))
      const playedVelocity = effectiveVelocity(
        velocity,
        note.softPedalValue ?? softPedalValue,
      )
      const attack = attackSample(midi, playedVelocity)
      if (attack === null) return false
      const startAt = Math.max(
        context.currentTime,
        Number.isFinite(note.atContextTime)
          ? (note.atContextTime as number)
          : context.currentTime,
      )

      let source: AudioBufferSourceNode | null = null
      let gain: GainNode | null = null
      let voice: SampleVoice | null = null
      try {
        const existing = voices.get(note.id)
        if (existing !== undefined) stealVoice(existing, context.currentTime)
        while (voices.size >= maxVoices) {
          const oldest = oldestVoice()
          if (oldest === null) break
          stealVoice(oldest, context.currentTime)
        }

        source = context.createBufferSource()
        gain = context.createGain()
        source.buffer = attack.sample.buffer
        source.playbackRate.setValueAtTime(
          Math.pow(2, (midi - attack.rootMidi) / 12),
          startAt,
        )
        const peak = Math.max(
          MINIMUM_GAIN,
          (0.16 + Math.pow(playedVelocity, 0.78) * 0.7) *
            (1 - clamp(note.softPedalValue ?? softPedalValue, 0, 1) * 0.12),
        )
        gain.gain.setValueAtTime(MINIMUM_GAIN, startAt)
        gain.gain.exponentialRampToValueAtTime(peak, startAt + 0.006)
        source.connect(gain)
        gain.connect(activeGraph.input)

        voice = {
          id: note.id,
          midi,
          sequence: voiceSequence,
          source,
          gain,
          sampleId: attack.sampleId,
          releaseAt: null,
          releaseSampleTriggered: false,
          cleaned: false,
        }
        voiceSequence += 1
        retainSample(attack.sampleId)
        voices.set(note.id, voice)
        const startedVoice = voice
        source.onended = () => cleanVoice(startedVoice)
        source.start(startAt)
        return true
      } catch {
        if (voice !== null) {
          cleanVoice(voice)
          voice = null
          source = null
          gain = null
        }
        if (source !== null) {
          safeStop(source, context.currentTime)
          safeDisconnect(source)
        }
        if (gain !== null) safeDisconnect(gain)
        return false
      }
    },

    noteOff(note: PianoInstrumentNoteOff) {
      if (disposed) return false
      const voice = voices.get(note.id)
      const activeGraph = graph
      if (voice === undefined || activeGraph === null) return false
      return releaseVoice(
        voice,
        Number.isFinite(note.atContextTime)
          ? (note.atContextTime as number)
          : activeGraph.context.currentTime,
        note.releaseVelocity,
      )
    },

    pedal(event: PianoInstrumentPedalEvent) {
      if (disposed) return
      const value = clamp(event.value, 0, 1)
      if (event.pedal === 'soft') {
        softPedalValue = value
        return
      }
      const down = value >= 0.5
      if (event.pedal === 'sustain') {
        if (down === sustainDown) return
        sustainDown = down
        const activeGraph = graph
        if (activeGraph !== null) {
          const at = Math.max(
            activeGraph.context.currentTime,
            Number.isFinite(event.atContextTime)
              ? (event.atContextTime as number)
              : activeGraph.context.currentTime,
          )
          triggerPedalNoise(down, at)
        }
      }
    },

    panic(atContextTime) {
      if (!disposed) panicInternal(atContextTime)
    },

    activeVoiceIds() {
      return Object.freeze(Array.from(voices.keys()))
    },

    setCharacter(nextCharacter) {
      character = nextCharacter
      if (graph !== null) applyCharacter(graph)
    },

    setAmbience(nextAmbience) {
      ambience = nextAmbience
      if (graph !== null) applyAmbience(graph)
    },

    getLoadSnapshot() {
      return snapshot()
    },

    subscribe(listener) {
      if (disposed) return () => undefined
      listeners.add(listener)
      return () => listeners.delete(listener)
    },

    dispose() {
      if (disposed) return
      disposed = true
      preparationGeneration += 1
      lifetimeAbort.abort()
      panicInternal(graph?.context.currentTime)
      disconnectGraph(graph)
      graph = null
      cache.clear()
      inFlight.clear()
      retainedSampleCounts.clear()
      decodedBytes = 0
      loadStatus = 'idle'
      playable = false
      loadError = null
      plannedSamples = 0
      preparedSamples = 0
      listeners.clear()
    },
  }
}
