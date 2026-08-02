// ── Where a room's songs come from ───────────────────────────────────
// Adapts the app's existing song shapes into the JamSong a room runs.
//
// Only sources every peer can FETCH belong here. A separated session on
// one device has no URL anyone else can reach, so it is not a source yet
// -- it needs the peer-to-peer transfer, which is a later phase and
// depends on device-sync landing first (docs/plans/jam-karaoke-songs.md).

import type { DemoSongManifest } from '@/features/karaoke-night/demo-song'
import type { JamSong } from '@/lib/jam/jam-song'
import type { LyricsLineTiming } from '@/lib/jam/types'
import type { LrcLine } from '@/lib/lyrics-service'

/**
 * LRC lines into song lines.
 *
 * LrcLine is already `{ time (seconds), text }`, so this is a rename plus
 * one real decision: an LRC carries starts only, so each line ends where
 * the next begins. Leaving endSec undefined would be equally correct for
 * lineAt, but filling it lets a caller measure a line's duration without
 * having to look at its neighbour.
 */
export function lrcToSongLines(lrc: readonly LrcLine[]): LyricsLineTiming[] {
  return lrc
    .filter((l) => l.text.trim() !== '')
    .map((l, i, arr) => ({
      text: l.text,
      startSec: l.time,
      ...(arr[i + 1] === undefined ? {} : { endSec: arr[i + 1]!.time }),
    }))
}

/**
 * The Karaoke Night demo as a room song.
 *
 * This is the one song that needs no transfer: its stems are already on
 * R2 behind public CORS, so every peer fetches the same URLs. That makes
 * it the right first target -- it exercises the layout, the seconds
 * transport and the per-peer trails without also having to prove the
 * file transfer.
 *
 * Returns null rather than a half-song when the manifest is missing an
 * instrumental: there is nothing to sing over, and a room that loads it
 * would be silent with no explanation.
 */
export function demoSongToJamSong(
  manifest: DemoSongManifest | null,
  lines: LyricsLineTiming[] = [],
): JamSong | null {
  const instrumental = manifest?.stems.instrumental ?? ''
  if (manifest === null || instrumental === '') return null
  return {
    id: 'karaoke-night-demo',
    title: manifest.title,
    artist: manifest.artist,
    stems: {
      instrumental,
      ...(manifest.stems.vocal === undefined || manifest.stems.vocal === ''
        ? {}
        : { vocal: manifest.stems.vocal }),
    },
    lines,
    // A missing duration is not fatal -- the audio element knows the real
    // one once it loads; this is only for the scrubber's initial extent.
    durationSec: manifest.durationSec ?? 0,
    origin: 'url',
  }
}
