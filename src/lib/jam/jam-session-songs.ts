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
import type { LyricsVersionKind } from '@/lib/lyrics-versions'
import { sortVersions, VERSION_LABELS } from '@/lib/lyrics-versions'

/** One set of words a room could sing, out of a session's history. */
export interface JamLyricChoice {
  kind: LyricsVersionKind
  label: string
  lines: LyricsLineTiming[]
  /** The one the mixer last had selected. */
  active: boolean
}
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
 * Every set of words this session has, that a room could actually sing.
 *
 * A session accumulates versions -- the imported LRC, the one you fixed by
 * hand, an auto-sync pass -- and they are not equally good. LRCLib's line
 * timings are routinely a couple of seconds out, so the hand-corrected
 * version is usually the one worth singing to, and the room had no way to
 * ask for it: it took whatever `text` happened to hold.
 *
 * Versions with no usable timings are dropped rather than listed. Offering
 * a choice that turns the lyric column into a static wall is offering a
 * dead end.
 */
export async function sessionLyricChoices(
  sessionId: string,
): Promise<JamLyricChoice[]> {
  try {
    const lyrics = await loadLyricsFromDb(sessionId)
    if (lyrics === null) return []
    const versions = lyrics.versions ?? []
    const choices: JamLyricChoice[] = []
    for (const v of sortVersions(versions)) {
      const lines = lrcToSongLines(parseLrcFile(v.text))
      if (lines.length === 0) continue
      choices.push({
        kind: v.kind,
        label: VERSION_LABELS[v.kind],
        lines,
        active: lyrics.activeVersionKind === v.kind,
      })
    }
    if (choices.length > 0) return choices
    // No version history: an older session, or one whose lyrics were saved
    // before versions existed. The single stored text is still a choice.
    if (lyrics.format !== 'lrc') return []
    const lines = lrcToSongLines(parseLrcFile(lyrics.text))
    return lines.length === 0
      ? []
      : [
          {
            kind: 'imported',
            label: VERSION_LABELS.imported,
            lines,
            active: true,
          },
        ]
  } catch {
    return []
  }
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
  // The active version wins over the raw `text` field: the room should
  // open on the words you last chose in the mixer, not on whichever
  // import happened to be written last.
  const choices = await sessionLyricChoices(sessionId)
  if (choices.length === 0) return []
  return (choices.find((c) => c.active) ?? choices[0])?.lines ?? []
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
 * The picker's rows, without touching a single stem.
 *
 * Building the list used to call sessionSong for every session, and that
 * reads the WHOLE stem record out of IndexedDB -- twice, instrumental and
 * vocal -- then mints a blob URL for each and parses the stored pitch
 * analysis. With ten sessions that is twenty multi-megabyte reads and
 * twenty object URLs pinned in memory, to fill a dropdown. The picker sat
 * empty until all of it finished.
 *
 * (Not a re-analysis, despite the "[PitchDB] Loaded pitch analysis" lines
 * in the console -- that is a read of work already done. Nothing was being
 * denoised twice.)
 *
 * Everything here comes off the session record, which is already in
 * memory. The expensive part happens once, when somebody picks a song.
 */
export interface JamSessionRow {
  session: UvrSession
  title: string
  durationSec: number
}

export function jammableSessionRows(
  sessions: readonly UvrSession[],
): JamSessionRow[] {
  return jammableSessions(sessions).map((session) => ({
    session,
    title: (session.originalFile?.name ?? 'Untitled')
      .replace(/\.[^.]+$/, '')
      .trim(),
    durationSec: session.stemMeta?.instrumental?.duration ?? 0,
  }))
}

/**
 * Every session this device can sing, newest first.
 *
 * Resolved in parallel: each is a couple of IndexedDB reads, and doing
 * twenty in series is a visible pause on opening the picker.
 *
 * Kept for callers that genuinely want every song hydrated. The picker no
 * longer does -- see jammableSessionRows.
 */
export async function sessionSongs(
  sessions: readonly UvrSession[],
): Promise<JamSong[]> {
  const built = await Promise.all(jammableSessions(sessions).map(sessionSong))
  return built.filter((s): s is JamSong => s !== null)
}
