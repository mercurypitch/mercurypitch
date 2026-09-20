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
import { parseLrcTimingMetadata } from '@/lib/lrc-timing-metadata'
import type { LrcLine } from '@/lib/lyrics-service'
import { parseLrcFile, parseLrcWordTimings } from '@/lib/lyrics-service'

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
 * When each word of a line stops, keyed the way the mixer keys it: by the
 * line's index in the LRC FILE, blank and dropped lines included.
 */
export type JamWordEnds = Readonly<
  Record<number, readonly (number | null | undefined)[]>
>

/**
 * LRC lines into song lines.
 *
 * LrcLine is already `{ time (seconds), text }`, so this is a rename plus
 * two real decisions. An LRC carries starts only, so each line ends where
 * the next begins: leaving endSec undefined would be equally correct for
 * lineAt, but filling it lets a caller measure a line's duration without
 * having to look at its neighbour.
 *
 * And the word times INSIDE a line are kept, not just scrubbed out of the
 * text. They used to be thrown away here, which is why a room lit a whole
 * line at once under a sheet somebody had mapped word by word. They are
 * read by the mixer's own parser, so a word starts in a room exactly when
 * it starts in Karaoke Night -- in either spelling of a stamp, `[mm:ss.xx]`
 * or the enhanced spec's `<mm:ss.xx>`, which that parser reads itself.
 *
 * `wordEnds` is the other half of such a mapping. It is keyed by the line's
 * index in the FILE, so it is looked up before the empty lines are dropped.
 */
export function lrcToSongLines(
  lrc: readonly LrcLine[],
  wordEnds?: JamWordEnds,
): LyricsLineTiming[] {
  return lrc
    .map((l, lrcIndex) => {
      const timed = parseLrcWordTimings(l.text, l.time)
      // The text a singer reads is the words, joined: the same string the
      // word spans add up to, so a line never reflows as it becomes current.
      const text =
        timed !== null ? timed.words.join(' ') : stripWordTimings(l.text)
      return { time: l.time, text, timed, ends: wordEnds?.[lrcIndex] }
    })
    .filter((l) => l.text !== '')
    .map((l, i, arr) => ({
      text: l.text,
      startSec: l.time,
      ...(arr[i + 1] === undefined ? {} : { endSec: arr[i + 1]!.time }),
      ...(l.timed === null
        ? {}
        : { words: l.timed.words, wordStartsSec: l.timed.wordTimes }),
      // Ends mean nothing without the starts they end.
      ...(l.timed === null || l.ends === undefined || l.ends.length === 0
        ? {}
        : { wordEndsSec: Array.from(l.ends, (end) => end ?? null) }),
    }))
}

/**
 * A whole LRC text into song lines.
 *
 * The one door for text, so that every way words reach a room -- a session's
 * versions, an example's file, a sheet dropped in by hand -- reads the word
 * ends the same way: the caller's own map if it has one (a stored version
 * does), else the `[x-mp-timing:...]` tag the app writes into its exports.
 */
export function lrcTextToSongLines(
  text: string,
  wordEnds?: JamWordEnds,
): LyricsLineTiming[] {
  return lrcToSongLines(
    parseLrcFile(text),
    wordEnds ?? parseLrcTimingMetadata(text)?.wordEndTimings,
  )
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
