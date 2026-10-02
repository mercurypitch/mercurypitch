// Museum sound — owned reference and fracture graphs with a soft, bounded suspension release.
import { acquireSharedAudioContext } from '@irchiinnuss/audio-io'
import type { GlassShatterProfile } from '../content/shatter-sounds'
import { DEFAULT_SHATTER_PROFILE } from '../content/shatter-sounds'
import type { GlassSound } from '../host'
import type { ShatterBufferCache } from './shatter-buffer-cache'
import { createShatterBufferCache, prepareShatterBuffers, silenceShatterCache, } from './shatter-buffer-cache'
import { createShatterPlayer } from './shatter-player'

const FLOOR = 0.0001
const RELEASE_MS = 240
interface SoundGraph {
  source: AudioScheduledSourceNode
  nodes: AudioNode[]
}

export function createBrowserGlassSound(
  options: {
    assetUrl?: (id: string) => string
    cache?: ShatterBufferCache
    profile?: GlassShatterProfile
    identity?: string
    volume?: () => number
  } = {},
): GlassSound {
  let disposed = false
  let finished = false
  let releaseDeadline = 0
  let releaseTimer: ReturnType<typeof setTimeout> | undefined
  const graphs = new Set<SoundGraph>()
  const pending = new Set<(error: Error) => void>()
  const preparation = new AbortController()
  const cache = options.cache ?? createShatterBufferCache()
  const profile = options.profile ?? DEFAULT_SHATTER_PROFILE
  const lease = acquireSharedAudioContext('glass-adventure-sound', {
    prepareToSuspend: () => {
      dispose()
      return Math.max(0, releaseDeadline - Date.now())
    },
  })
  const context = lease.ensure()
  const bus = context?.createGain() ?? null
  if (context && bus) bus.connect(context.destination)
  const fracture =
    context && bus
      ? createShatterPlayer({
          context,
          output: bus,
          cache,
          volume: options.volume ?? (() => 0.65),
        })
      : null

  function retire(graph: SoundGraph): void {
    graph.source.onended = null
    try {
      graph.source.stop()
    } catch {
      /* Already ended. */
    }
    graph.source.disconnect()
    for (const node of graph.nodes) node.disconnect()
    graphs.delete(graph)
  }

  function finish(): void {
    if (finished) return
    finished = true
    clearTimeout(releaseTimer)
    releaseDeadline = 0
    void fracture?.dispose()
    for (const graph of graphs) retire(graph)
    bus?.disconnect()
    context?.removeEventListener('statechange', changed)
    lease.release()
  }

  function dispose(): void {
    if (disposed) return
    disposed = true
    preparation.abort()
    const hasFracture = fracture?.active() ?? false
    void fracture?.dispose()
    for (const reject of pending)
      reject(new Error('The reference was cancelled. Tap Start to try again.'))
    pending.clear()
    if (
      !context ||
      !bus ||
      context.state !== 'running' ||
      (graphs.size === 0 && !hasFracture)
    ) {
      finish()
      return
    }
    const at = context.currentTime
    // 180 ms audible release plus 60 ms cleanup slack, matching shared output policy.
    bus.gain.cancelScheduledValues(at)
    bus.gain.setTargetAtTime(0, at, 0.036)
    for (const graph of graphs) {
      try {
        graph.source.stop(at + RELEASE_MS / 1000)
      } catch {
        /* Already ended. */
      }
    }
    releaseDeadline = Date.now() + RELEASE_MS
    releaseTimer = setTimeout(finish, RELEASE_MS)
  }

  function changed(): void {
    if (!context || context.state === 'running') return
    // A suspended/interrupted clock cannot finish a scheduled fade. Retire this
    // encounter before shared foreground recovery advances its sources again.
    dispose()
    finish()
  }
  context?.addEventListener('statechange', changed)
  // Reached synchronously inside the host's Start gesture, before mic permission.
  if (context) void lease.unlock()

  function own(source: AudioScheduledSourceNode, nodes: AudioNode[]): void {
    const graph = { source, nodes }
    graphs.add(graph)
    source.onended = () => retire(graph)
  }

  function tone(
    frequency: number,
    at: number,
    duration: number,
    gain: number,
  ): void {
    if (!context || !bus || disposed) return
    const oscillator = context.createOscillator()
    const envelope = context.createGain()
    oscillator.frequency.value = frequency
    envelope.gain.setValueAtTime(FLOOR, at)
    envelope.gain.exponentialRampToValueAtTime(gain, at + 0.018)
    envelope.gain.setTargetAtTime(0, at + 0.035, duration / 5)
    oscillator.connect(envelope).connect(bus)
    own(oscillator, [envelope])
    oscillator.start(at)
    oscillator.stop(at + duration + 0.095)
  }

  function waitForReference(until: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const deadline =
        Date.now() +
        Math.max(4000, (until - (context?.currentTime ?? until) + 1) * 1000)
      let timer: ReturnType<typeof setTimeout> | undefined
      const fail = (error: Error): void => {
        clearTimeout(timer)
        pending.delete(fail)
        reject(error)
      }
      const check = (): void => {
        if (disposed || !context || context.state !== 'running') {
          fail(new Error('The reference stopped. Tap Start to try again.'))
          return
        }
        if (context.currentTime >= until) {
          pending.delete(fail)
          resolve()
          return
        }
        if (Date.now() >= deadline) {
          fail(new Error('Audio is not advancing. Tap Start to try again.'))
          dispose()
          return
        }
        timer = setTimeout(check, 25)
      }
      pending.add(fail)
      check()
    })
  }

  function unlockReference(): Promise<boolean> {
    return new Promise((resolve, reject) => {
      let settled = false
      const done = (): void => {
        settled = true
        clearTimeout(timer)
        pending.delete(fail)
      }
      const fail = (error: Error): void => {
        if (settled) return
        done()
        reject(error)
      }
      const timer = setTimeout(() => {
        fail(new Error('Audio could not start. Tap Start to try again.'))
        dispose()
      }, 4000)
      pending.add(fail)
      void lease.unlock().then((available) => {
        if (settled) return
        done()
        resolve(available)
      }, fail)
    })
  }
  return {
    async reference(midi, pattern, waveCycles = 2) {
      if (
        !context ||
        disposed ||
        !Number.isFinite(midi) ||
        midi < 0 ||
        midi > 127
      )
        throw new Error('The reference is unavailable. Tap Start to try again.')
      const available = await unlockReference()
      if (!available || disposed || context.state !== 'running')
        throw new Error('Audio could not start. Tap Start to try again.')
      const at = context.currentTime
      if (pattern === 'gentle-wave') {
        const oscillator = context.createOscillator()
        const envelope = context.createGain()
        const cycles =
          Number.isSafeInteger(waveCycles) && waveCycles >= 1 && waveCycles <= 4
            ? waveCycles
            : 2
        const duration = cycles + 1
        const frequency = 440 * 2 ** ((midi - 69) / 12)
        const curve = Float32Array.from(
          { length: duration * 100 + 1 },
          (_, index) => {
            const waveTime = Math.min(cycles, Math.max(0, index / 100 - 0.8))
            return (
              frequency * 2 ** ((70 * Math.sin(2 * Math.PI * waveTime)) / 1200)
            )
          },
        )
        oscillator.frequency.setValueCurveAtTime(curve, at, duration)
        envelope.gain.setValueAtTime(FLOOR, at)
        envelope.gain.exponentialRampToValueAtTime(0.13, at + 0.018)
        envelope.gain.setTargetAtTime(0, at + duration, 0.036)
        oscillator.connect(envelope).connect(bus!)
        own(oscillator, [envelope])
        oscillator.start(at)
        oscillator.stop(at + duration + 0.24)
        await waitForReference(at + duration + 0.55)
        return
      }
      tone(440 * 2 ** ((midi - 69) / 12), at, 0.65, 0.13)
      // The quiet gap follows audio time; a frozen reference cannot later score itself.
      await waitForReference(at + 1.15)
    },
    async prepareShatter() {
      const quiet = silenceShatterCache(cache)
      if (!context || !options.assetUrl || disposed) {
        await quiet
        return
      }
      const timeout = setTimeout(() => preparation.abort(), 5000)
      try {
        await Promise.all([
          quiet,
          prepareShatterBuffers(
            cache,
            context,
            options.assetUrl,
            [profile],
            preparation.signal,
          ),
        ])
      } finally {
        clearTimeout(timeout)
      }
    },
    shatter() {
      if (!disposed)
        fracture?.play(profile, options.identity ?? 'gallery-fracture', 2.7)
    },
    dispose,
  }
}
