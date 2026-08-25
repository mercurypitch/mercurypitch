// Guitar Night song ports preserve the feature API over shared play-along policies.
// ============================================================

import type { PlayAlongBackingLease, PlayAlongBackingPlan, PlayAlongDefaultMix, PlayAlongOpenBackingResult, PlayAlongSongPort, PlayAlongSongSummary, PlayAlongStemAsset, PlayAlongStemKind, } from '@/features/play-along/song-port'
import { GUITAR_PLAY_ALONG_POLICY, planPlayAlongBacking, resolvePlayAlongDefaultMix, } from '@/features/play-along/song-port'

export type GuitarNightStemKind = PlayAlongStemKind
export type GuitarNightSongSummary = PlayAlongSongSummary
export type GuitarNightStemAsset = PlayAlongStemAsset
export type GuitarNightDefaultMix = PlayAlongDefaultMix<'guitar'>
export type GuitarNightBackingLease = PlayAlongBackingLease<'guitar'>
export type GuitarNightOpenBackingResult = PlayAlongOpenBackingResult<'guitar'>
export type GuitarNightSongPort = PlayAlongSongPort<'guitar'>
export type GuitarNightBackingPlan = PlayAlongBackingPlan

export function planGuitarNightBacking(
  available: readonly GuitarNightStemKind[],
): GuitarNightBackingPlan {
  return planPlayAlongBacking(available, GUITAR_PLAY_ALONG_POLICY)
}

/**
 * Resolve the default mix from the stems that were actually leased. Durable
 * blobs can disappear between discovery and hydration, so UI claims must not
 * rely on the earlier availability snapshot.
 */
export function resolveGuitarNightDefaultMix(
  leased: readonly GuitarNightStemKind[],
): GuitarNightDefaultMix | null {
  return resolvePlayAlongDefaultMix(leased, GUITAR_PLAY_ALONG_POLICY)
}

/**
 * How long the shelf waits on the demo catalog before opening without it.
 *
 * Generous for a few hundred bytes of manifest, and short enough not to
 * read as a hang. It exists because the demo lives on the network and the
 * rest of the library lives on the device: a visitor on a dead connection
 * must still get their own songs.
 */
export const DEMO_CATALOG_WAIT_MS = 4000

/**
 * Resolve when `work` settles, or when `ms` is up — whichever is first.
 * `work` must already be caught: this only ever waits, never handles.
 */
function settleWithin(work: Promise<unknown>, ms: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms)
    void work.then(() => {
      clearTimeout(timer)
      resolve()
    })
  })
}

/**
 * One library out of two sources: the songs this device has separated,
 * and the demo the app offers to anyone who has separated nothing yet.
 *
 * The two fail differently, and the split matters. A device library that
 * cannot be opened is the visitor's own problem to see and retry — it is
 * what "Your local library could not be opened" means — so that failure
 * still propagates. A demo that cannot be reached is a network the room
 * has no claim on, so it costs the demo and nothing else — including the
 * time it would otherwise spend holding the shelf shut.
 */
export function composeGuitarNightSongPorts(
  device: GuitarNightSongPort,
  demo: GuitarNightSongPort,
): GuitarNightSongPort {
  return {
    initialize: async () => {
      const demoReady = demo.initialize().catch(() => undefined)
      await device.initialize()
      await settleWithin(demoReady, DEMO_CATALOG_WAIT_MS)
    },

    // One row per song, and the demo's is the one that survives a
    // collision. Karaoke Night seeds every demo into the session store as
    // an ordinary "Examples" row under this same id, carrying the R2 URLs
    // and no local blobs — so without this the shelf listed each demo
    // twice, and the device's copy of it could never be opened.
    completedSongs: () => {
      const fromDemo = demo.completedSongs()
      const claimed = new Set(fromDemo.map((song) => song.sessionId))
      return [
        ...device
          .completedSongs()
          .filter((song) => !claimed.has(song.sessionId)),
        ...fromDemo,
      ]
    },

    openSession: async (sessionId, signal) => {
      const fromDevice = await device.openSession(sessionId, signal)
      // The device wins whenever it can actually deliver: a visitor who ran
      // the band split on an example has real local part stems for this id,
      // and those beat the demo's two remote ones.
      if (fromDevice.ok || fromDevice.code === 'aborted') return fromDevice
      if (signal.aborted) return { ok: false, code: 'aborted' }

      const fromDemo = await demo.openSession(sessionId, signal)
      if (fromDemo.ok) return fromDemo
      // The demo has nothing to add, so the device's own answer is the
      // useful news: a prepared song whose audio has gone must not be
      // reported as the demo failing to load.
      return fromDevice.code === 'not-found' ? fromDemo : fromDevice
    },
  }
}
