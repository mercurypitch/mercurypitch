// ── Attaching lyrics to a song already in the room ───────────────────
// A separated session often has no LRC: you split the stems and never
// opened the lyrics panel. Without words the room is a backing track and
// a pitch lane, which is most of a karaoke machine but not the part
// people came for.
//
// So the room can go and find them. This is the small, shared half of
// what the stem mixer's lyrics controller does -- search LRCLib, take a
// match, save it -- without the eight hundred lines of block marking, tap
// timing and edit layers that make that controller unmovable. The network
// functions themselves are imported, not copied: lyrics-service is
// already a clean module, and duplicating its fetch logic to avoid
// touching the mixer would be the actual laziness.

import { saveLyricsToDb } from '@/db/services/lyrics-db-service'
import type { JamSong } from '@/lib/jam/jam-song'
import { lrcToSongLines } from '@/lib/jam/jam-song-sources'
import { parseLrcFile } from '@/lib/lyrics-service'

/** The session behind a room song, or null for anything else. */
export function sessionIdOfSong(song: JamSong | null): string | null {
  if (song === null) return null
  const [kind, ...rest] = song.id.split(':')
  if (kind !== 'session') return null
  const id = rest.join(':')
  return id === '' ? null : id
}

/**
 * Whether the room should offer to go and find words for this song.
 *
 * Only for a session you own and only when there are none: the demo song
 * ships with its lyrics, and a song that already has them does not want a
 * search box sitting where the words should be.
 */
export function canAttachLyrics(song: JamSong | null): boolean {
  return (
    song !== null && song.lines.length === 0 && sessionIdOfSong(song) !== null
  )
}

/**
 * Turn LRC text into a song's lines.
 *
 * Returns an empty array for lyrics with no timings at all. That is the
 * same rule sessionSongLines applies to a stored .txt: plain words cannot
 * be scrolled in time, and a static wall of text pinned above a moving
 * playhead is worse than an honest "sing along by ear".
 */
export function linesFromLrc(text: string): ReturnType<typeof lrcToSongLines> {
  return lrcToSongLines(parseLrcFile(text))
}

/**
 * Persist found lyrics against the session.
 *
 * So the next room, and the stem mixer, and the next device to sync, all
 * see them -- finding the words once should be the last time anybody has
 * to. Failure is swallowed on purpose: the singing works from the parsed
 * lines already in memory, and losing the save is worth strictly less than
 * losing the take to an error dialog.
 */
export async function persistSongLyrics(
  sessionId: string,
  text: string,
  filename: string,
): Promise<void> {
  try {
    await saveLyricsToDb(sessionId, { text, format: 'lrc', filename })
  } catch {
    /* the room already has the words; the cache is a nicety */
  }
}
