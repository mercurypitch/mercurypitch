// ── Your own sessions, as room songs ─────────────────────────────────
// Turns a completed separation into something the jam picker can offer.
//
// The stems live in this browser's IndexedDB, so what comes back is blob
// URLs -- playable here and meaningless on any other device. That is why
// the resulting song is marked `origin: 'local'`: the room can sing it
// alone today, and peers get it once the transfer lands.
//
// Kept out of jam-song-sources.ts because everything here is async and
// touches the database, while that module is pure mapping. A pure module
// that suddenly needs a db mock is a module nobody wants to test.

import { loadLyricsFromDb } from '@/db/services/lyrics-db-service'
import { loadPitchAnalysisFromDb } from '@/db/services/session-pitch-analysis-service'
import { getStemBlobUrl } from '@/db/services/uvr-service'
import type { JamSong } from '@/lib/jam/jam-song'
import { lrcToSongLines, sessionToJamSong } from '@/lib/jam/jam-song-sources'
import type { JamSongNote, LyricsLineTiming } from '@/lib/jam/types'
import { parseLrcFile } from '@/lib/lyrics-service'
import type { UvrSession } from '@/stores/uvr-store'

/**
 * Sessions worth offering.
 *
 * Only 'completed'. 'finalizing' means the stems are still being written
 * to IndexedDB and the session is explicitly not safe to reload yet --
 * offering it would hand the room a half-written blob.
 */
export function jammableSessions(
  sessions: readonly UvrSession[],
): UvrSession[] {
  return sessions.filter((s) => s.status === 'completed')
}

/**
 * Timed lines for a session, or none.
 *
 * Only LRC gives times, and times are what the lyric column scrolls by. A
 * plain .txt is real lyrics but has nothing to sync to, so it is treated
 * as no lyrics rather than dumped on screen as a static wall -- the
 * column then says "sing along by ear", which is at least true.
 */
export async function sessionSongLines(
  sessionId: string,
): Promise<LyricsLineTiming[]> {
  try {
    const lyrics = await loadLyricsFromDb(sessionId)
    if (lyrics === null || lyrics.format !== 'lrc') return []
    return lrcToSongLines(parseLrcFile(lyrics.text))
  } catch {
    // Lyrics are a nicety; a database hiccup must not cost you the song.
    return []
  }
}

/**
 * The vocal line as target notes, or none.
 *
 * Prefers mergedNotes -- the cleaned, sustained version -- over the raw
 * segmentation, because a lane wants the line a person would sing and not
 * every frame the detector twitched on. Absent when the session was never
 * analysed, which is legal: the room falls back to lyrics and your own
 * trail, which is still a karaoke machine.
 */
export async function sessionSongNotes(
  sessionId: string,
): Promise<JamSongNote[]> {
  try {
    const data = await loadPitchAnalysisFromDb(sessionId)
    const notes = data?.mergedNotes ?? data?.segmentedNotes ?? []
    return notes.map((n) => ({
      midi: n.midi,
      startSec: n.startSec,
      endSec: n.endSec,
    }))
  } catch {
    // Same rule as lyrics: a nicety must not cost you the song.
    return []
  }
}

/**
 * Build one session into a room song, or null if it cannot be sung.
 *
 * Null when there is no instrumental: a session that separated badly, or
 * one whose blobs were evicted, has nothing to sing over, and an entry
 * that plays silence is worse than an entry that is not there.
 */
export async function sessionSong(
  session: UvrSession,
): Promise<JamSong | null> {
  const instrumental = await getStemBlobUrl(session.sessionId, 'instrumental')
  if (instrumental === null || instrumental === '') return null
  const vocal = await getStemBlobUrl(session.sessionId, 'vocal')
  const [lines, notes] = await Promise.all([
    sessionSongLines(session.sessionId),
    sessionSongNotes(session.sessionId),
  ])
  return sessionToJamSong(
    session,
    { instrumental, ...(vocal === null ? {} : { vocal }) },
    lines,
    session.stemMeta?.instrumental?.duration ?? 0,
    notes,
  )
}

/**
 * Every session this device can sing, newest first.
 *
 * Resolved in parallel: each is a couple of IndexedDB reads, and doing
 * twenty in series is a visible pause on opening the picker.
 */
export async function sessionSongs(
  sessions: readonly UvrSession[],
): Promise<JamSong[]> {
  const built = await Promise.all(jammableSessions(sessions).map(sessionSong))
  return built.filter((s): s is JamSong => s !== null)
}
