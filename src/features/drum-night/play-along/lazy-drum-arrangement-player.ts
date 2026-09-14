// Lazy drum arrangement backing — keep synth playback code behind audio intent.

import type { createDrumArrangementBackingPlayer, DrumArrangementBackingPlayerOptions, DrumArrangementBackingPlayerPort, } from './drum-arrangement-player'

interface PlayerModule {
  createDrumArrangementBackingPlayer: typeof createDrumArrangementBackingPlayer
}

/** Retain the silent mix while the user browses, then activate one real player. */
export function createLazyDrumArrangementBackingPlayer(
  options: DrumArrangementBackingPlayerOptions,
  load: () => Promise<PlayerModule> = () => import('./drum-arrangement-player'),
): DrumArrangementBackingPlayerPort {
  const levels = new Map<string, number>()
  let player: DrumArrangementBackingPlayerPort | null = null
  let pending: Promise<boolean> | null = null
  let disposed = false

  return {
    activate() {
      if (disposed) return false
      if (player !== null) return player.activate()
      if (pending !== null) return pending
      const activation = (async () => {
        try {
          const module = await load()
          if (disposed) return false
          player = module.createDrumArrangementBackingPlayer(options)
          for (const [id, position] of levels)
            player.setTrackLevel(id, position)
          const active = await player.activate()
          return active && !disposed
        } catch {
          return false
        }
      })()
      pending = activation
      void activation.finally(() => {
        if (pending === activation) pending = null
      })
      return activation
    },
    trigger(note) {
      return disposed ? 'dropped' : (player?.trigger(note) ?? 'dropped')
    },
    setTrackLevel(id, position) {
      if (disposed) return
      levels.set(id, position)
      player?.setTrackLevel(id, position)
    },
    panic() {
      player?.panic()
    },
    async dispose() {
      disposed = true
      levels.clear()
      const active = player
      player = null
      await active?.dispose()
    },
  }
}
