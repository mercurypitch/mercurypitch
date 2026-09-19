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
 * Song id of the ORIGINAL example song, which is also its session id: an
 * example stores lyrics, pitch analysis and scores in the local db exactly
 * like a separation does (features/karaoke-night/demo-song's
 * DEMO_SESSION_ID, spelled here so this module stays in its own layer).
 */
export const DEMO_SONG_ID = 'karaoke-night-demo'

/** The slug the original example carries -- demo-song's LEGACY_SLUG. */
const ORIGINAL_EXAMPLE_SLUG = 'karaoke-night'

/**
 * Song id of one example, which is also its session id.
 *
 * The original keeps the bare id it has always had; every example added
 * since is namespaced under it. That is `demoSessionId()` in
 * features/karaoke-night/demo-song, spelled here for the reason
 * DEMO_SONG_ID is. A test pins the two together, because drifting apart
 * would not throw -- it would quietly file a song's pitch guide under a
 * session nothing else reads.
 */
export function exampleSongId(slug: string | undefined): string {
  const s = (slug ?? '').trim()
  return s === '' || s === ORIGINAL_EXAMPLE_SLUG
    ? DEMO_SONG_ID
    : `${DEMO_SONG_ID}:${s}`
}

/** Whether a room song is one of the examples, original or not. */
export function isExampleSongId(songId: string): boolean {
  return songId === DEMO_SONG_ID || songId.startsWith(`${DEMO_SONG_ID}:`)
}

/** What a separated session's song id is prefixed with. */
export const SESSION_SONG_PREFIX = 'session:'

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
 * `origin` is 'url' for the one kind of session whose stems are NOT in this
 * browser: an example's library row, whose outputs are the public URLs
 * themselves (see sessionSong). Every peer can fetch those, so the room
 * must not treat the song as something only the host holds.
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
  origin: JamSong['origin'] = 'local',
): JamSong | null {
  if (urls.instrumental === '') return null
  return {
    id: `${SESSION_SONG_PREFIX}${session.sessionId}`,
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
    origin,
  }
}

/**
 * An example song as a room song.
 *
 * These are the songs that need no transfer: their stems are already on
 * R2 behind public CORS, so every peer fetches the same URLs. That makes
 * them the right first target -- they exercise the layout, the seconds
 * transport and the per-peer trails without also having to prove the
 * file transfer.
 *
 * Returns null rather than a half-song when the manifest is missing an
 * instrumental: there is nothing to sing over, and a room that loads it
 * would be silent with no explanation.
 */
/**
 * The session id a room song's pitch analysis is stored under, or null.
 *
 * The two sources that can be analysed both carry one: a separated
 * session is `session:<id>`, and an example's song id IS its session id.
 * Everything else a room can run -- a drill, a saved melody, the weekly
 * challenge -- has its notes by construction and nothing to analyse.
 */
export function jamSongSessionId(songId: string): string | null {
  if (songId.startsWith(SESSION_SONG_PREFIX)) {
    const id = songId.slice(SESSION_SONG_PREFIX.length)
    return id === '' ? null : id
  }
  return isExampleSongId(songId) ? songId : null
}

export function demoSongToJamSong(
  manifest: DemoSongManifest | null,
  lines: LyricsLineTiming[] = [],
  notes: JamSongNote[] = [],
): JamSong | null {
  const instrumental = manifest?.stems.instrumental ?? ''
  if (manifest === null || instrumental === '') return null
  return {
    id: exampleSongId(manifest.slug),
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
