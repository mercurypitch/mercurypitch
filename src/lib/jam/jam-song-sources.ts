// ── Where a room's songs come from ───────────────────────────────────
// Adapts the app's existing song shapes into the JamSong a room runs.
//
// Only sources every peer can FETCH belong here. A separated session on
// one device has no URL anyone else can reach, so it is not a source yet
// -- it needs the peer-to-peer transfer, which is a later phase and
// depends on device-sync landing first (docs/plans/jam-karaoke-songs.md).

import type { DemoSongManifest } from '@/features/karaoke-night/demo-song'
import type { JamSong } from '@/lib/jam/jam-song'
import type { JamSongNote, LyricsLineTiming } from '@/lib/jam/types'
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
    .map((l) => ({ ...l, text: stripWordTimings(l.text) }))
    .filter((l) => l.text !== '')
    .map((l, i, arr) => ({
      text: l.text,
      startSec: l.time,
      ...(arr[i + 1] === undefined ? {} : { endSec: arr[i + 1]!.time }),
    }))
}

/**
 * Strip enhanced-LRC word timings out of a line.
 *
 * The A2 format embeds per-word times INSIDE the line -- "Lay, [00:18.87]
 * and [00:19.07] put ..." -- and parseLrcFile only pulls off the leading
 * line timestamp, so the rest arrives as visible text. A singer reading
 * along does not want to read the clock.
 *
 * Both bracket styles, because both are in the wild: `[mm:ss.xx]` and the
 * `<mm:ss.xx>` spelling the enhanced spec actually prescribes.
 */
export function stripWordTimings(text: string): string {
  return text
    .replace(/[[<]\d{1,2}:\d{2}(?:[.:]\d{1,3})?[\]>]/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

/**
 * One of the user's own separated sessions, as a room song.
 *
 * Marked `origin: 'local'`, which is the honest label: the stems live in
 * THIS browser's IndexedDB behind a blob URL that means nothing on
 * another device. The host can sing it today; peers cannot hear it until
 * the peer-to-peer transfer lands (docs/plans/jam-karaoke-songs.md §1b).
 *
 * Built anyway rather than hidden, because the whole path -- picking,
 * loading, lyrics, lanes, transport -- is the same one the transfer will
 * eventually feed, and a shelf you cannot see is a feature nobody can
 * tell you is wrong.
 */
export function sessionToJamSong(
  session: { sessionId: string; originalFile?: { name?: string } },
  urls: { instrumental: string; vocal?: string },
  lines: LyricsLineTiming[] = [],
  durationSec = 0,
  notes: JamSongNote[] = [],
): JamSong | null {
  if (urls.instrumental === '') return null
  return {
    id: `session:${session.sessionId}`,
    // The filename is the only name a separated session has; strip the
    // extension so the shelf does not read "my song.mp3".
    title: (session.originalFile?.name ?? 'Untitled')
      .replace(/\.[^.]+$/, '')
      .trim(),
    stems: {
      instrumental: urls.instrumental,
      ...(urls.vocal === undefined || urls.vocal === ''
        ? {}
        : { vocal: urls.vocal }),
    },
    lines,
    notes,
    durationSec,
    origin: 'local',
  }
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
  notes: JamSongNote[] = [],
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
    notes,
    // A missing duration is not fatal -- the audio element knows the real
    // one once it loads; this is only for the scrubber's initial extent.
    durationSec: manifest.durationSec ?? 0,
    origin: 'url',
  }
}
