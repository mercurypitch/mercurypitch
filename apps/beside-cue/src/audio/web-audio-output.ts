// ============================================================
// Web Audio output — lazy, pop-free decoded asset playback
// ============================================================
//
// Playback rides the app's one shared AudioContext (shared-audio-context.ts),
// so a cue and a game note are scheduled against the same clock. Each playback
// gets separate envelope and live-mix gains so release tails cannot be
// reopened by ducking.

import type { AudioSourceVariant } from '../content/audio-manifest'
import { fetchAssetBytes } from './asset-fetch'
import type { AudioOutputFinishResult, AudioOutputPlayback, AudioOutputPlayRequest, AudioOutputStartResult, AudioSessionOutput, } from './audio-session'
import { acquireSharedAudioContext } from './shared-audio-context'

const ENVELOPE_FLOOR = 0.0001
const ATTACK_SECONDS = 0.09
const RELEASE_SECONDS = 0.18
const RELEASE_SLACK_SECONDS = 0.06
const RELEASE_CLOSE_DELAY_MS = (RELEASE_SECONDS + RELEASE_SLACK_SECONDS) * 1_000
const LIVE_GAIN_SECONDS = 0.09
const DEFAULT_MAX_DECODED_BYTES = 32 * 1024 * 1024

interface Deferred<T> {
  readonly promise: Promise<T>
  readonly settled: () => boolean
  resolve(value: T): boolean
}

interface PlaybackGraph {
  readonly source: AudioBufferSourceNode
  readonly envelope: GainNode
  readonly mix: GainNode
}

interface CacheEntry {
  readonly buffer: AudioBuffer
  readonly bytes: number
}

export interface WebAudioOutputDependencies {
  /**
   * Test seam. Injecting a factory also transfers ownership: the output then
   * closes that context on dispose, where the shared one is only released.
   */
  readonly createContext?: () => AudioContext | undefined
  readonly fetchArrayBuffer?: (
    url: string,
    signal: AbortSignal,
  ) => Promise<ArrayBuffer>
  readonly supportsMimeType?: (mimeType: string) => boolean
  readonly resolveAssetUrl?: (src: string) => string
  readonly maxDecodedBytes?: number
}

function deferred<T>(): Deferred<T> {
  let didSettle = false
  let resolvePromise!: (value: T) => void
  const promise = new Promise<T>((resolve) => {
    resolvePromise = resolve
  })
  return {
    promise,
    settled: () => didSettle,
    resolve(value) {
      if (didSettle) return false
      didSettle = true
      resolvePromise(value)
      return true
    },
  }
}

function packagedAudioUrl(src: string): string {
  const relative = src.replace(/^\.?\//u, '')
  const base = import.meta.env.BASE_URL.endsWith('/')
    ? import.meta.env.BASE_URL
    : `${import.meta.env.BASE_URL}/`
  return `${base}${relative}`
}

async function defaultFetchArrayBuffer(
  url: string,
  signal: AbortSignal,
): Promise<ArrayBuffer> {
  // Not `response.ok`: on iOS every packaged media file arrives with
  // status 0 and a complete body. See audio/asset-fetch for the whole
  // story -- it is why the V2 onboarding was silent on iOS too.
  return fetchAssetBytes(url, { signal })
}

function createMimeTypeProbe(): (mimeType: string) => boolean {
  let probe: HTMLAudioElement | undefined
  return (mimeType) => {
    if (typeof Audio === 'undefined') return false
    try {
      probe ??= new Audio()
      return probe.canPlayType(mimeType) !== ''
    } catch {
      return false
    }
  }
}

function holdAtCurrentValue(param: AudioParam, now: number): void {
  if (typeof param.cancelAndHoldAtTime === 'function') {
    param.cancelAndHoldAtTime(now)
    return
  }
  param.cancelScheduledValues(now)
  param.setValueAtTime(Math.max(ENVELOPE_FLOOR, param.value), now)
}

function disconnectGraph(graph: PlaybackGraph): void {
  graph.source.onended = null
  graph.source.disconnect()
  graph.envelope.disconnect()
  graph.mix.disconnect()
}

function terminateSuspendedGraph(graph: PlaybackGraph): void {
  try {
    graph.source.stop(0)
  } catch {
    // A source that already ended is still safe to disconnect.
  }
  disconnectGraph(graph)
}

function releaseGraph(context: AudioContext, graph: PlaybackGraph): void {
  const now = context.currentTime
  graph.source.onended = () => {
    disconnectGraph(graph)
  }
  holdAtCurrentValue(graph.envelope.gain, now)
  graph.envelope.gain.setTargetAtTime(0, now, RELEASE_SECONDS / 5)
  try {
    graph.source.stop(now + RELEASE_SECONDS + RELEASE_SLACK_SECONDS)
  } catch {
    disconnectGraph(graph)
  }
}

function decodedBytes(buffer: AudioBuffer): number {
  return (
    buffer.length * buffer.numberOfChannels * Float32Array.BYTES_PER_ELEMENT
  )
}

function validLoopBounds(
  request: AudioOutputPlayRequest,
  buffer: AudioBuffer,
): boolean {
  if (request.playback.kind !== 'loop') return true
  return request.playback.loopEndMs <= buffer.duration * 1_000 + 1
}

/** Creates a lazy output over the app's shared context, for one session. */
export function createWebAudioOutput(
  dependencies: WebAudioOutputDependencies = {},
): AudioSessionOutput {
  const ownContext = dependencies.createContext
  const lease =
    ownContext === undefined
      ? acquireSharedAudioContext('asset-output')
      : undefined
  const readBytes = dependencies.fetchArrayBuffer ?? defaultFetchArrayBuffer
  const supports = dependencies.supportsMimeType ?? createMimeTypeProbe()
  const resolveUrl = dependencies.resolveAssetUrl ?? packagedAudioUrl
  const maxDecodedBytes = Math.max(
    0,
    dependencies.maxDecodedBytes ?? DEFAULT_MAX_DECODED_BYTES,
  )
  const cache = new Map<string, CacheEntry>()
  const handles = new Set<AudioOutputPlayback>()

  let context: AudioContext | undefined
  let cachedBytes = 0
  let disposed = false

  function ensureContext(): AudioContext | undefined {
    if (context !== undefined) return context
    if (lease !== undefined) {
      context = lease.ensure() ?? undefined
      return context
    }
    try {
      context = ownContext?.()
    } catch {
      return undefined
    }
    return context
  }

  function readCached(source: AudioSourceVariant): AudioBuffer | undefined {
    const entry = cache.get(source.sha256)
    if (entry === undefined) return undefined
    cache.delete(source.sha256)
    cache.set(source.sha256, entry)
    return entry.buffer
  }

  function cacheDecoded(source: AudioSourceVariant, buffer: AudioBuffer): void {
    if (maxDecodedBytes === 0 || cache.has(source.sha256)) return
    const bytes = decodedBytes(buffer)
    if (bytes > maxDecodedBytes) return
    while (cachedBytes + bytes > maxDecodedBytes) {
      const oldest = cache.entries().next().value as
        | [string, CacheEntry]
        | undefined
      if (oldest === undefined) break
      cache.delete(oldest[0])
      cachedBytes -= oldest[1].bytes
    }
    cache.set(source.sha256, { buffer, bytes })
    cachedBytes += bytes
  }

  async function loadBuffer(
    audioContext: AudioContext,
    source: AudioSourceVariant,
    signal: AbortSignal,
  ): Promise<AudioBuffer> {
    const cached = readCached(source)
    if (cached !== undefined) return cached
    const bytes = await readBytes(resolveUrl(source.src), signal)
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError')
    const buffer = await audioContext.decodeAudioData(bytes)
    if (disposed || signal.aborted) {
      throw new DOMException('Aborted', 'AbortError')
    }
    cacheDecoded(source, buffer)
    return buffer
  }

  function play(request: AudioOutputPlayRequest): AudioOutputPlayback {
    const started = deferred<AudioOutputStartResult>()
    const finished = deferred<AudioOutputFinishResult>()
    const abort = new AbortController()
    let graph: PlaybackGraph | undefined
    let desiredGain = Math.max(ENVELOPE_FLOOR, request.initialGain)
    let stopped = false

    const playback: AudioOutputPlayback = {
      started: started.promise,
      finished: finished.promise,
      setGain(gain) {
        desiredGain = Math.max(ENVELOPE_FLOOR, Math.min(1, gain))
        const activeGraph = graph
        const audioContext = context
        if (
          stopped ||
          activeGraph === undefined ||
          audioContext === undefined
        ) {
          return
        }
        const now = audioContext.currentTime
        holdAtCurrentValue(activeGraph.mix.gain, now)
        activeGraph.mix.gain.setTargetAtTime(
          desiredGain,
          now,
          LIVE_GAIN_SECONDS / 5,
        )
      },
      stop() {
        if (stopped || finished.settled()) return
        stopped = true
        abort.abort()
        const activeGraph = graph
        graph = undefined
        if (activeGraph !== undefined && context !== undefined) {
          if (context.state === 'running') {
            releaseGraph(context, activeGraph)
          } else {
            // Suspended/interrupted context time cannot advance a release.
            // Disconnect now so a future unlock cannot revive stale audio.
            terminateSuspendedGraph(activeGraph)
          }
        }
        started.resolve('stopped')
        finished.resolve('stopped')
      },
    }
    handles.add(playback)
    void finished.promise.then(() => handles.delete(playback))

    if (disposed) {
      stopped = true
      started.resolve('stopped')
      finished.resolve('stopped')
      return playback
    }

    const audioContext = ensureContext()
    if (audioContext === undefined) {
      started.resolve('failed')
      finished.resolve('failed')
      return playback
    }

    // Resume is intentionally requested before the first await so a caller can
    // invoke play directly from the permitting pointer/keyboard gesture.
    let resume: Promise<void>
    try {
      resume = audioContext.resume()
    } catch {
      resume = Promise.reject(new Error('Audio context could not resume.'))
    }

    void (async () => {
      try {
        await resume
        if (disposed || stopped || abort.signal.aborted) return
        const buffer = await loadBuffer(
          audioContext,
          request.source,
          abort.signal,
        )
        if (
          disposed ||
          stopped ||
          abort.signal.aborted ||
          !validLoopBounds(request, buffer)
        ) {
          if (!stopped && !abort.signal.aborted) {
            started.resolve('failed')
            finished.resolve('failed')
          }
          return
        }

        const source = audioContext.createBufferSource()
        const envelope = audioContext.createGain()
        const mix = audioContext.createGain()
        const now = audioContext.currentTime
        source.buffer = buffer
        if (request.playback.kind === 'loop') {
          source.loop = true
          source.loopStart = request.playback.loopStartMs / 1_000
          source.loopEnd = request.playback.loopEndMs / 1_000
        }
        envelope.gain.cancelScheduledValues(now)
        envelope.gain.setValueAtTime(ENVELOPE_FLOOR, now)
        mix.gain.cancelScheduledValues(now)
        mix.gain.setValueAtTime(desiredGain, now)
        source.connect(envelope)
        envelope.connect(mix)
        mix.connect(audioContext.destination)
        const nextGraph = { source, envelope, mix }
        graph = nextGraph
        source.onended = () => {
          source.disconnect()
          envelope.disconnect()
          mix.disconnect()
          if (graph !== nextGraph) return
          graph = undefined
          if (stopped) return
          finished.resolve('ended')
        }
        try {
          source.start(0)
          envelope.gain.exponentialRampToValueAtTime(1, now + ATTACK_SECONDS)
        } catch (error) {
          graph = undefined
          source.onended = null
          source.disconnect()
          envelope.disconnect()
          mix.disconnect()
          throw error
        }
        started.resolve('started')
      } catch {
        if (stopped || disposed || abort.signal.aborted) return
        started.resolve('failed')
        finished.resolve('failed')
      }
    })()

    return playback
  }

  return {
    supportsMimeType(mimeType) {
      if (disposed) return false
      try {
        return supports(mimeType)
      } catch {
        return false
      }
    },

    async unlock() {
      if (disposed) return false
      const audioContext = ensureContext()
      if (audioContext === undefined) return false
      try {
        if (lease !== undefined) {
          if (!(await lease.unlock())) return false
        } else {
          await audioContext.resume()
        }
        return !disposed && audioContext.state !== 'closed'
      } catch {
        return false
      }
    },

    play,

    dispose() {
      if (disposed) return
      disposed = true
      for (const handle of [...handles]) handle.stop()
      handles.clear()
      cache.clear()
      cachedBytes = 0
      const audioContext = context
      context = undefined
      if (lease !== undefined) {
        // Same delay the owned context gets: the handles above scheduled
        // release tails, and parking the clock under them would freeze a
        // graph mid-fade. The shared context outlives this output, so only
        // the claim ends.
        globalThis.setTimeout(() => {
          lease.release()
        }, RELEASE_CLOSE_DELAY_MS)
        return
      }
      if (audioContext !== undefined) {
        globalThis.setTimeout(() => {
          void audioContext.close().catch(() => undefined)
        }, RELEASE_CLOSE_DELAY_MS)
      }
    },
  }
}
