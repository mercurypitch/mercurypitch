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
          // Report why. Collapsing every failure into `missing-local-audio`
          // told the player their audio was gone whenever a long song merely
          // crossed the encoded-byte ceiling, which is what it looked like
          // for songs the stem mixer plays back without complaint.
          return loaded.code === 'encoded-budget'
            ? {
                ok: false as const,
                code: 'encoded-budget' as const,
                requiredBytes: loaded.requiredBytes,
                budgetBytes: loaded.budgetBytes,
              }
            : {
                ok: false as const,
                code: loaded.code,
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
