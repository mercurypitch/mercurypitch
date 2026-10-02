// Fracture audio API — shared recorded breaks for existing games without a second audio context.

import type { GlassShatterProfile } from '../content/shatter-sounds'
import { createShatterBufferCache, prepareShatterBuffers, silenceShatterCache, } from './shatter-buffer-cache'
import { createShatterPlayer } from './shatter-player'

export type { GlassShatterProfile } from '../content/shatter-sounds'
export {
  createShatterBufferCache,
  prepareShatterBuffers,
  silenceShatterCache,
} from './shatter-buffer-cache'
export { createShatterPlayer } from './shatter-player'

/** Existing museum sound preference also controls recordings in older games. */
export function readGlassEffectsVolume(
  storagePrefix: string,
  storage?: Pick<Storage, 'getItem'>,
): number {
  try {
    const value = JSON.parse(
      (storage ?? globalThis.localStorage)?.getItem(
        `${storagePrefix}:museum-audio:v1`,
      ) ?? 'null',
    ) as { muted?: boolean; ambienceVolume?: number } | null
    if (value?.muted === true) return 0
    return Number.isFinite(value?.ambienceVolume)
      ? Math.max(0, Math.min(1, value!.ambienceVolume!))
      : 0.65
  } catch {
    return 0.65
  }
}

const caches = new WeakMap<
  AudioContext,
  ReturnType<typeof createShatterBufferCache>
>()

/** The caller owns the context and closes its judge before calling play. */
export function createRecordedGlassFracture(options: {
  context: AudioContext
  output?: AudioNode
  assetUrl(id: string): string
  profile: GlassShatterProfile
  volume(): number
  seed?: number
}) {
  const cache = caches.get(options.context) ?? createShatterBufferCache()
  caches.set(options.context, cache)
  const controller = new AbortController()
  const player = createShatterPlayer({
    ...options,
    output: options.output ?? options.context.destination,
    cache,
  })
  let prepared: Promise<void> | undefined
  return {
    prepare(): Promise<void> {
      return (prepared ??= (async () => {
        const timeout = setTimeout(() => controller.abort(), 5000)
        try {
          await silenceShatterCache(cache)
          await prepareShatterBuffers(
            cache,
            options.context,
            options.assetUrl,
            [options.profile],
            controller.signal,
          )
        } finally {
          clearTimeout(timeout)
        }
      })())
    },
    play(identity: string, safeSeconds = 4): boolean {
      return player.play(options.profile, identity, safeSeconds)
    },
    silence: player.silence,
    setVolume: player.setVolume,
    dispose(): Promise<void> {
      controller.abort()
      return player.dispose()
    },
  }
}
