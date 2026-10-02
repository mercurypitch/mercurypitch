// ============================================================
// Recorded fracture output — immediate cached one-shots with bounded voices and silent capture handoff.
// ============================================================
import type { GlassShatterProfile } from '../content/shatter-sounds'
import { shatterSoundAssetIds } from '../content/shatter-sounds'
import type { ShatterBufferCache } from './shatter-buffer-cache'

const FLOOR = 0.0001
const RELEASE_SECONDS = 0.24
export function createShatterPlayer(options: {
  context: AudioContext
  output: AudioNode
  cache: ShatterBufferCache
  volume(): number
  seed?: number
}) {
  const { context, cache } = options
  let disposed = false
  const voices = new Map<
    AudioBufferSourceNode,
    { envelope: GainNode; scale: number; releaseAt: number; closing: boolean }
  >()
  let releasePromise: Promise<void> | undefined
  let disposal: Promise<void> | undefined

  function retire(source: AudioBufferSourceNode): void {
    if (!voices.has(source)) return
    source.onended = null
    source.disconnect()
    voices.get(source)?.envelope.disconnect()
    voices.delete(source)
  }

  function silence(): Promise<void> {
    if (releasePromise !== undefined) return releasePromise
    if (!voices.size) return Promise.resolve()
    const closing = [...voices.entries()]
    const at = context.currentTime
    for (const [source, voice] of closing) {
      voice.closing = true
      const { envelope } = voice
      envelope.gain.cancelScheduledValues(at)
      envelope.gain.setTargetAtTime(0, at, 0.036)
      try {
        source.stop(at + RELEASE_SECONDS)
      } catch {
        /* Already ended. */
      }
    }
    releasePromise = new Promise((resolve) => {
      setTimeout(
        () => {
          for (const [source] of closing) retire(source)
          releasePromise = undefined
          resolve()
        },
        context.state === 'running' ? RELEASE_SECONDS * 1000 : 0,
      )
    })
    return releasePromise
  }

  function setVolume(): void {
    const volume = options.volume()
    if (!Number.isFinite(volume) || volume <= 0) {
      void silence()
      return
    }
    const at = context.currentTime
    for (const { envelope, scale, releaseAt, closing } of voices.values()) {
      if (closing || at >= releaseAt) continue
      envelope.gain.cancelScheduledValues(at)
      envelope.gain.setTargetAtTime(
        Math.max(FLOOR, Math.min(1, volume) * scale),
        at,
        0.024,
      )
      envelope.gain.setTargetAtTime(0, releaseAt, 0.024)
    }
  }
  cache.silences.add(silence)
  cache.volumeChanges.add(setVolume)
  return {
    /** Returns synchronously; missing recordings are omitted, never fetched or played late. */
    play(
      profile: GlassShatterProfile,
      identity: string,
      safeSeconds = 4,
    ): boolean {
      const volume = options.volume()
      if (
        disposed ||
        releasePromise !== undefined ||
        context.state !== 'running' ||
        !Number.isFinite(volume) ||
        volume <= 0 ||
        !Number.isFinite(safeSeconds) ||
        safeSeconds < 0.12 ||
        voices.size >= 2
      )
        return false
      const chosen = cache.select(profile, identity, options.seed)
      const data = cache.buffers.get(chosen)?.buffer
      if (!data) return false
      const at = context.currentTime
      const duration = Math.min(data.duration, safeSeconds - 0.03)
      const source = context.createBufferSource()
      const envelope = context.createGain()
      source.buffer = data
      source.playbackRate.setValueAtTime(1, at)
      const scale = { small: 0.42, medium: 0.58, large: 0.7 }[profile.size]
      envelope.gain.setValueAtTime(FLOOR, at)
      envelope.gain.exponentialRampToValueAtTime(
        Math.max(FLOOR, Math.min(1, volume) * scale),
        at + 0.004,
      )
      const releaseAt = at + Math.max(0.006, duration - 0.18)
      envelope.gain.setTargetAtTime(0, releaseAt, 0.024)
      source.connect(envelope).connect(options.output)
      voices.set(source, { envelope, scale, releaseAt, closing: false })
      source.onended = () => retire(source)
      source.start(at)
      source.stop(at + duration + 0.03)
      return true
    },
    silence,
    setVolume,
    dispose(): Promise<void> {
      if (disposal !== undefined) return disposal
      disposed = true
      cache.volumeChanges.delete(setVolume)
      // A caller may dispose without awaiting. Keep the old release discoverable
      // by a new capture's shared handoff until every source is retired.
      disposal = silence().finally(() => cache.silences.delete(silence))
      return disposal
    },
    available(profile: GlassShatterProfile): boolean {
      return shatterSoundAssetIds(profile).some((id) => cache.buffers.has(id))
    },
    active(): boolean {
      return voices.size > 0
    },
  }
}
