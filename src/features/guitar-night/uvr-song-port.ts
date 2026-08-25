// Guitar Night UVR adapter preserves its public factory over the shared target policy.
// ============================================================

import { GUITAR_PLAY_ALONG_POLICY } from '@/features/play-along/song-port'
import { createUvrPlayAlongSongPort } from '@/features/play-along/uvr-song-port'
import type { GuitarNightSongPort } from './song-port'

export function createUvrGuitarNightSongPort(): GuitarNightSongPort {
  const sources = createUvrPlayAlongSongPort(GUITAR_PLAY_ALONG_POLICY)
  return {
    initialize: () => sources.initialize(),
    completedSongs: () => sources.completedSongs(),
    openSession: async (sessionId, signal) => {
      const selected = await sources.openSession(sessionId, signal)
      if (!selected.ok) return selected

      try {
        const loaded = await selected.lease.load({ signal })
        if (!loaded.ok) {
          selected.lease.release()
          return {
            ok: false,
            code:
              loaded.code === 'aborted'
                ? ('aborted' as const)
                : ('missing-local-audio' as const),
          }
        }
        return {
          ok: true,
          lease: {
            ...loaded.lease,
            // Guitar Night keeps its established eager lease contract. The
            // metadata source remains the lifetime owner underneath it.
            release: () => selected.lease.release(),
          },
        }
      } catch (error) {
        selected.lease.release()
        throw error
      }
    },
  }
}
