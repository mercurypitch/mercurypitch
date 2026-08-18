// Demo song port lets Guitar Night open the shared song nobody had to separate.
// ============================================================
//
// Guitar Night's library is the visitor's own separations, read out of
// IndexedDB — so a guitarist who has never run a separation opens the
// room to "No prepared songs on this device yet." and no way to hear what
// the room does. Karaoke Night has had a demo song all along; it just had
// no route into here.
//
// Two stems, both remote, so this port hands the URLs back unchanged and
// lets the transport download them — through the song audio cache, which
// is what stops the second open costing another eight megabytes. There is
// nothing to lease and nothing to release.

import type { DemoSongManifest } from '@/features/karaoke-night/demo-song'
import { demoSessionId, loadDemoSongs, } from '@/features/karaoke-night/demo-song'
import type { GuitarNightDefaultMix, GuitarNightOpenBackingResult, GuitarNightSongPort, GuitarNightSongSummary, GuitarNightStemAsset, } from './song-port'

/**
 * How long an undeclared demo is assumed to be.
 *
 * The transport sizes its decode budget from the duration, and a song
 * that declares none is scored at nothing at all — which on a phone means
 * decoding something that will not fit rather than streaming it. Erring
 * long costs a stream the room handles well; erring short costs the room.
 */
export const ASSUMED_DEMO_SECONDS = 360

/**
 * A demo reduced to what this room needs, with the optionals resolved.
 * Anything that cannot fill this in is not offered at all, so nothing
 * downstream has to ask again whether a stem is really there.
 */
interface DemoBacking {
  sessionId: string
  title: string
  artist: string
  vocalUrl: string
  instrumentalUrl: string
  durationSeconds: number
}

function toBacking(manifest: DemoSongManifest): DemoBacking | null {
  const vocalUrl = manifest.stems.vocal ?? ''
  const instrumentalUrl = manifest.stems.instrumental ?? ''
  // A demo missing either stem is unplayable everywhere, and offering it
  // here would be a row that can only ever fail to open.
  if (vocalUrl === '' || instrumentalUrl === '') return null
  return {
    sessionId: demoSessionId(manifest.slug),
    title: manifest.title,
    artist: manifest.artist,
    vocalUrl,
    instrumentalUrl,
    durationSeconds:
      manifest.durationSec !== undefined && manifest.durationSec > 0
        ? manifest.durationSec
        : ASSUMED_DEMO_SECONDS,
  }
}

function summary(backing: DemoBacking): GuitarNightSongSummary {
  return {
    sessionId: backing.sessionId,
    title: backing.title,
    // Nothing was prepared here, so there is no prepared date to sort by
    // or to show. The room reads `source` and shows the subtitle instead.
    createdAt: 0,
    source: 'demo',
    subtitle: `Demo song · ${backing.artist}`,
  }
}

function stems(backing: DemoBacking): GuitarNightStemAsset[] {
  // sizeBytes is only ever read as a stand-in for a missing duration, and
  // the duration is always resolved above — asking the network for a real
  // byte count would put a round trip in front of every demo open, on
  // exactly the slow links this is most needed on.
  const asset = (
    kind: 'vocal' | 'instrumental',
    url: string,
  ): GuitarNightStemAsset => ({
    kind,
    url,
    sizeBytes: 0,
    durationSeconds: backing.durationSeconds,
  })
  return [
    asset('vocal', backing.vocalUrl),
    asset('instrumental', backing.instrumentalUrl),
  ]
}

/**
 * The mix for the pair above, stated rather than resolved: a demo is
 * always exactly a vocal and an instrumental, both audible, which is the
 * whole song. `resolveGuitarNightDefaultMix` exists for a lease whose
 * contents were discovered at runtime and can come back short.
 */
const DEMO_MIX: GuitarNightDefaultMix = {
  kind: 'mixed-instrumental',
  audible: ['vocal', 'instrumental'],
  muted: [],
}

/**
 * The demos the app is offering right now, as Guitar Night backing.
 *
 * The manifest list is exactly the one Karaoke Night reads, so a demo
 * swapped in the Content Studio changes in both rooms at once, and a
 * parked one disappears from both.
 */
export function createDemoGuitarNightSongPort(
  options: { loadManifests?: () => Promise<DemoSongManifest[]> } = {},
): GuitarNightSongPort {
  const load = options.loadManifests ?? loadDemoSongs
  let catalog: readonly DemoBacking[] = []
  let refreshGeneration = 0

  return {
    initialize: async () => {
      const generation = ++refreshGeneration
      const loaded = await load()
      // A later refresh has already answered; this one's list is stale.
      if (generation !== refreshGeneration) return
      catalog = loaded.flatMap((manifest) => {
        const backing = toBacking(manifest)
        return backing === null ? [] : [backing]
      })
    },

    completedSongs: () => catalog.map(summary),

    openSession: async (
      sessionId: string,
      signal: AbortSignal,
    ): Promise<GuitarNightOpenBackingResult> => {
      if (signal.aborted) return { ok: false, code: 'aborted' }

      const backing = catalog.find(
        (candidate) => candidate.sessionId === sessionId,
      )
      if (backing === undefined) return { ok: false, code: 'not-found' }

      return {
        ok: true,
        lease: {
          sessionId,
          title: backing.title,
          stems: stems(backing),
          defaultMix: DEMO_MIX,
          source: 'demo',
          // Nothing was leased — these are remote URLs, not object URLs
          // held open against IndexedDB — so there is nothing to give back.
          release: () => undefined,
        },
      }
    },
  }
}
