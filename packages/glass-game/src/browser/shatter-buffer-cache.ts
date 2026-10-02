// ============================================================
// Fracture cache — bounded optional recordings decoded before an encounter can start.
// ============================================================
import { fetchAssetBytes } from '@irchiinnuss/mobile-runtime/asset-fetch'
import type { GlassShatterProfile } from '../content/shatter-sounds'
import { createShatterVariantSelector, shatterSoundAssetIds, } from '../content/shatter-sounds'
import { reportAudioAssetFailure } from './audio-asset-failure'

export function createShatterBufferCache() {
  return {
    buffers: new Map<string, { url: string; buffer: AudioBuffer }>(),
    pending: new Map<string, Promise<void>>(),
    failed: new Map<string, string>(),
    queue: Promise.resolve(),
    select: createShatterVariantSelector(),
    silences: new Set<() => Promise<void>>(),
    volumeChanges: new Set<() => void>(),
  }
}
export type ShatterBufferCache = ReturnType<typeof createShatterBufferCache>

function cancellable(work: Promise<void>, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.resolve()
  return new Promise((resolve) => {
    const done = (): void => {
      signal.removeEventListener('abort', done)
      resolve()
    }
    signal.addEventListener('abort', done, { once: true })
    void work.then(done, done)
  })
}

export async function prepareShatterBuffers(
  cache: ShatterBufferCache,
  context: AudioContext,
  assetUrl: (id: string) => string,
  profiles: readonly GlassShatterProfile[],
  signal: AbortSignal,
): Promise<void> {
  const ids = [...new Set(profiles.flatMap(shatterSoundAssetIds))]
  await Promise.all(
    ids.map(async (id) => {
      const url = assetUrl(id)
      if (
        signal.aborted ||
        cache.buffers.get(id)?.url === url ||
        cache.failed.get(id) === url
      )
        return
      while (cache.pending.has(id)) {
        await cancellable(cache.pending.get(id)!, signal)
        if (
          signal.aborted ||
          cache.buffers.get(id)?.url === url ||
          cache.failed.get(id) === url
        )
          return
      }
      // Native decode cannot be cancelled. One shared slot bounds native work even
      // when rapid restart/dispose leaves an earlier decode finishing in the host.
      const work = cache.queue.then(async () => {
        if (
          signal.aborted ||
          cache.buffers.get(id)?.url === url ||
          cache.failed.get(id) === url
        )
          return
        try {
          const bytes = await fetchAssetBytes(url, { signal })
          if (signal.aborted) return
          if (bytes.byteLength < 32 || bytes.byteLength > 160_000)
            throw new Error('Fracture recording exceeds the delivery budget.')
          const buffer = await context.decodeAudioData(bytes)
          if (
            !Number.isFinite(buffer.duration) ||
            buffer.duration <= 0 ||
            buffer.duration > 4.25 ||
            buffer.numberOfChannels !== 1 ||
            buffer.length > 408_000
          )
            throw new Error('Fracture recording exceeds the decoded budget.')
          // A late native result is reusable, but cannot start a retired player's output.
          cache.buffers.set(id, { url, buffer })
          cache.failed.delete(id)
        } catch (error) {
          if (!signal.aborted) {
            cache.failed.set(id, url)
            reportAudioAssetFailure('glass-fracture', error)
          }
        }
      })
      cache.pending.set(id, work)
      cache.queue = work.then(
        () => undefined,
        () => undefined,
      )
      void work.then(() => {
        if (cache.pending.get(id) === work) cache.pending.delete(id)
      })
      await cancellable(work, signal)
    }),
  )
}

export function silenceShatterCache(cache: ShatterBufferCache): Promise<void> {
  return Promise.all([...cache.silences].map((silence) => silence())).then(
    () => undefined,
  )
}
