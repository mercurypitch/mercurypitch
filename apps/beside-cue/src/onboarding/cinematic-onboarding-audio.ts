// ============================================================
// Cinematic onboarding audio — one pop-free Web Audio picture clock
// ============================================================
//
// The clock rides the app's shared AudioContext (audio/shared-audio-context.ts)
// rather than opening its own, so the cinematic and everything the player
// reaches afterwards are scheduled against a single clock.

import { acquireSharedAudioContext } from '../audio/shared-audio-context'

const ENVELOPE_FLOOR = 0.0001
const ATTACK_SECONDS = 0.09
const RELEASE_SECONDS = 0.18
const RELEASE_SLACK_SECONDS = 0.06

export interface CinematicOnboardingAudioClock {
  load(url: string): Promise<boolean>
  /** Resume from a direct user gesture before asynchronous media callbacks. */
  unlock(): Promise<boolean>
  start(offsetSeconds: number): Promise<boolean>
  pause(): void
  dispose(): void
}

interface ActiveSource {
  readonly source: AudioBufferSourceNode
  readonly gain: GainNode
}

export interface CinematicOnboardingAudioClockDeps {
  /**
   * Test seam. Injecting a factory also transfers ownership: the clock then
   * closes that context on dispose, where the shared one is only released.
   */
  readonly createContext?: () => AudioContext | undefined
  readonly fetchArrayBuffer?: (url: string) => Promise<ArrayBuffer>
}

function holdThenRelease(param: AudioParam, now: number): void {
  if (typeof param.cancelAndHoldAtTime === 'function') {
    param.cancelAndHoldAtTime(now)
  } else {
    param.cancelScheduledValues(now)
    param.setValueAtTime(Math.max(ENVELOPE_FLOOR, param.value), now)
  }
  param.setTargetAtTime(0, now, RELEASE_SECONDS / 5)
}

/**
 * Decodes the continuous review mix onto Web Audio so the scene video remains
 * the surface's only HTML media element. Every source owns its GainNode; a
 * segment change can release the old source while the new one opens without
 * re-exposing the fading signal.
 */
export function createCinematicOnboardingAudioClock(
  deps: CinematicOnboardingAudioClockDeps = {},
): CinematicOnboardingAudioClock {
  const ownContext = deps.createContext
  const lease =
    ownContext === undefined
      ? acquireSharedAudioContext('onboarding-cinematic')
      : undefined
  const readBytes =
    deps.fetchArrayBuffer ??
    (async (url: string) => {
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`Onboarding audio request failed: ${response.status}`)
      }
      return response.arrayBuffer()
    })

  let context: AudioContext | undefined
  let buffer: AudioBuffer | undefined
  let loadedUrl: string | undefined
  let loading:
    | { readonly url: string; readonly promise: Promise<boolean> }
    | undefined
  let active: ActiveSource | undefined
  let generation = 0
  let playbackRequest = 0
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

  async function unlock(): Promise<boolean> {
    if (disposed) return false
    const audioContext = ensureContext()
    if (audioContext === undefined) return false
    try {
      if (lease !== undefined) {
        if (!(await lease.unlock())) return false
      } else {
        await audioContext.resume()
      }
      return !disposed
    } catch {
      return false
    }
  }

  function release(entry: ActiveSource): void {
    const audioContext = context
    if (audioContext === undefined) return
    const now = audioContext.currentTime
    entry.source.onended = null
    holdThenRelease(entry.gain.gain, now)
    try {
      entry.source.stop(now + RELEASE_SECONDS + RELEASE_SLACK_SECONDS)
    } catch {
      entry.source.disconnect()
      entry.gain.disconnect()
      return
    }
    entry.source.onended = () => {
      entry.source.disconnect()
      entry.gain.disconnect()
    }
  }

  function releaseActiveSource(): void {
    const entry = active
    active = undefined
    if (entry !== undefined) release(entry)
  }

  function pause(): void {
    playbackRequest += 1
    releaseActiveSource()
  }

  async function decode(
    url: string,
    expectedGeneration: number,
  ): Promise<boolean> {
    const audioContext = ensureContext()
    if (audioContext === undefined) return false
    try {
      const bytes = await readBytes(url)
      if (disposed || generation !== expectedGeneration) return false
      const decoded = await audioContext.decodeAudioData(bytes)
      if (disposed || generation !== expectedGeneration) return false
      buffer = decoded
      loadedUrl = url
      return true
    } catch {
      return false
    }
  }

  return {
    load(url) {
      if (disposed) return Promise.resolve(false)
      if (loadedUrl === url && buffer !== undefined)
        return Promise.resolve(true)
      if (loading?.url === url) return loading.promise

      pause()
      buffer = undefined
      loadedUrl = undefined
      const expectedGeneration = ++generation
      const promise = decode(url, expectedGeneration).finally(() => {
        if (loading?.url === url) loading = undefined
      })
      loading = { url, promise }
      return promise
    },

    unlock,

    async start(offsetSeconds) {
      if (disposed) return false
      const audioContext = ensureContext()
      const decoded = buffer
      if (audioContext === undefined || decoded === undefined) {
        return false
      }

      const request = ++playbackRequest
      if (!(await unlock())) return false
      if (disposed || decoded !== buffer || request !== playbackRequest) {
        return false
      }

      releaseActiveSource()
      const offset = Math.max(0, offsetSeconds)
      if (offset >= decoded.duration) return false

      const source = audioContext.createBufferSource()
      const gain = audioContext.createGain()
      const now = audioContext.currentTime
      source.buffer = decoded
      gain.gain.cancelScheduledValues(now)
      gain.gain.setValueAtTime(ENVELOPE_FLOOR, now)
      gain.gain.exponentialRampToValueAtTime(1, now + ATTACK_SECONDS)
      source.connect(gain)
      gain.connect(audioContext.destination)
      source.onended = () => {
        if (active?.source === source) active = undefined
        source.disconnect()
        gain.disconnect()
      }
      source.start(0, offset)
      active = { source, gain }
      return true
    },

    pause,

    dispose() {
      if (disposed) return
      disposed = true
      generation += 1
      pause()
      buffer = undefined
      loadedUrl = undefined
      const audioContext = context
      context = undefined
      if (lease !== undefined) {
        // The shared context outlives onboarding — only the claim ends.
        lease.release()
        return
      }
      if (audioContext !== undefined) {
        void audioContext.close().catch(() => undefined)
      }
    },
  }
}
