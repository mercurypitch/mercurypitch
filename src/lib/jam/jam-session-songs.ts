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
import type { DemoSongManifest } from '@/features/karaoke-night/demo-song'
import { demoLyricsText } from '@/features/karaoke-night/demo-song'
import { isExampleSession } from '@/features/karaoke-night/examples-library'
import type { EditableNote } from '@/features/stem-mixer/pitch-edit-model'
import { applyEditLayer, emptyEditLayer, isEditLayerEmpty, } from '@/features/stem-mixer/pitch-edit-model'
import type { JamNotesSource, JamSong } from '@/lib/jam/jam-song'
import { demoSongToJamSong, exampleSongId, lrcToSongLines, sessionToJamSong, } from '@/lib/jam/jam-song-sources'
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
 * Prefers segmentedNotes with the stored edit layer applied -- the same
 * melody Karaoke Night draws. segmentedNotes is the edit mode's BASE, and
 * the layer is where every note the user moved, retuned or deleted by hand
 * lives; mergedNotes is the raw merge, which has none of that. Reading
 * mergedNotes meant a room sang against a line its owner had already
 * corrected, and the comment here used to claim the opposite.
 *
 * mergedNotes stays as the fallback for a record that has no segmentation
 * -- an analysis from before edit mode existed. Absent when the session
 * was never analysed at all, which is legal: the room falls back to lyrics
 * and your own trail, which is still a karaoke machine.
 */
export async function sessionSongNotes(
  sessionId: string,
): Promise<JamSongNote[]> {
  return (await sessionSongGuide(sessionId)).notes
}

/** A session's target line, and where it came from. */
export interface JamSongGuide {
  notes: JamSongNote[]
  /** Null when there is no line at all. */
  from: JamNotesSource | null
}

const NO_GUIDE: JamSongGuide = { notes: [], from: null }

/**
 * The same notes as `sessionSongNotes`, with their provenance.
 *
 * The room needs it for two things. It tells the singer what they are
 * aiming at -- the line they corrected by hand is not the same promise as
 * one a machine produced a minute ago. And it lets the room notice a `raw`
 * line, the merge from before the clean-up pass existed, and replace it
 * instead of singing against every wobble for ever because "there are
 * notes" looked like "there is nothing to do".
 */
export async function sessionSongGuide(
  sessionId: string,
): Promise<JamSongGuide> {
  try {
    const data = await loadPitchAnalysisFromDb(sessionId)
    if (data === null) return NO_GUIDE
    const segmented = data.segmentedNotes ?? []
    if (segmented.length > 0) {
      // EditableNote's beat fields carry SECONDS here, exactly as the
      // mixer's own controller seeds them -- the edit layer was recorded
      // in the same units it is replayed in.
      const base: EditableNote[] = segmented.map((n, i) => ({
        id: `base-${i}`,
        startBeat: n.startSec,
        endBeat: n.endSec,
        midi: n.midi,
      }))
      const layer = data.editLayer ?? emptyEditLayer()
      const notes = applyEditLayer(base, layer).map((n) => ({
        midi: n.midi,
        startSec: n.startBeat,
        endSec: n.endBeat,
      }))
      if (notes.length === 0) return NO_GUIDE
      return { notes, from: isEditLayerEmpty(layer) ? 'saved' : 'edited' }
    }
    const merged = data.mergedNotes.map((n) => ({
      midi: n.midi,
      startSec: n.startSec,
      endSec: n.endSec,
    }))
    return merged.length === 0 ? NO_GUIDE : { notes: merged, from: 'raw' }
  } catch {
    // Same rule as lyrics: a nicety must not cost you the song.
    return NO_GUIDE
  }
}

/** A song with its line's provenance written on it, or null for no song. */
function withGuide(song: JamSong | null, guide: JamSongGuide): JamSong | null {
  if (song === null) return null
  return guide.from === null ? song : { ...song, notesFrom: guide.from }
}

/** A stem address every device can fetch, or null. */
function publicStemUrl(url: string | undefined): string | null {
  return url !== undefined && /^https?:\/\//i.test(url) ? url : null
}

/**
 * Where an example's stems are, or null for anything that is not one.
 *
 * An example's library row is metadata only: its `outputs` ARE the public
 * addresses, and no audio is ever written to this browser's IndexedDB --
 * opening one streams it. So the blob lookup below finds nothing for it,
 * every time, and "open it in Karaoke and try again" could never help.
 *
 * Examples only. A separation's `outputs` can hold an address too, left
 * over from the server that produced it, and that one expires; handing it
 * to a room would load a song that plays silence.
 */
function exampleStemUrls(
  session: UvrSession,
): { instrumental: string; vocal?: string } | null {
  if (!isExampleSession(session)) return null
  const instrumental = publicStemUrl(session.outputs?.instrumental)
  if (instrumental === null) return null
  const vocal = publicStemUrl(session.outputs?.vocal)
  return { instrumental, ...(vocal === null ? {} : { vocal }) }
}

/**
 * Build one session into a room song, or null if it cannot be sung.
 *
 * Null when there is no instrumental: a session that separated badly, or
 * one whose blobs were evicted, has nothing to sing over, and an entry
 * that plays silence is worse than an entry that is not there.
 *
 * An example is the exception to "the stems live in this browser". It is
 * sung straight from its public addresses, and marked `origin: 'url'`
 * because every peer can fetch them -- nothing has to be transferred.
 */
export async function sessionSong(
  session: UvrSession,
): Promise<JamSong | null> {
  const stored = await getStemBlobUrl(session.sessionId, 'instrumental')
  const remote =
    stored === null || stored === '' ? exampleStemUrls(session) : null
  if ((stored === null || stored === '') && remote === null) return null
  const [lines, guide] = await Promise.all([
    sessionSongLines(session.sessionId),
    sessionSongGuide(session.sessionId),
  ])
  const durationSec = session.stemMeta?.instrumental?.duration ?? 0
  if (remote !== null) {
    return withGuide(
      sessionToJamSong(session, remote, lines, durationSec, guide.notes, 'url'),
      guide,
    )
  }
  const vocal = await getStemBlobUrl(session.sessionId, 'vocal')
  return withGuide(
    sessionToJamSong(
      session,
      { instrumental: stored ?? '', ...(vocal === null ? {} : { vocal }) },
      lines,
      durationSec,
      guide.notes,
    ),
    guide,
  )
}

/**
 * One example song, hydrated for the room.
 *
 * The words are the studio's unless the singer has their own. demoLyricsText
 * is the one reader that knows all three shapes the studio can publish --
 * pasted text, a .lrc, and a .lyricsfile -- and its copy is the freshest
 * Original there is: a correction reaches the manifest before it reaches
 * the copy stored on this device.
 *
 * An example somebody has corrected in the mixer is the exception, and the
 * rule is the one every other song follows: the room opens on the words you
 * last chose. Its stored copy lives under the example's own id, which is
 * also where the version buttons read from, so what the room opens on is
 * always one of the buttons. Peers are sent the host's lines either way.
 *
 * An example is a normal session as far as analysis is concerned, so if it
 * has been opened in the mixer once there is a vocal line to aim at; if
 * not, the room works one out (jam-pitch-provision).
 */
export async function exampleSong(
  manifest: DemoSongManifest,
): Promise<JamSong | null> {
  const sessionId = exampleSongId(manifest.slug)
  const [lyrics, stored, guide] = await Promise.all([
    demoLyricsText(manifest).catch(() => null),
    sessionLyricChoices(sessionId),
    sessionSongGuide(sessionId),
  ])
  const theirs = stored.find((c) => c.active && c.kind !== 'imported')
  const lines =
    theirs !== undefined
      ? theirs.lines
      : lyrics !== null && lyrics.format === 'lrc'
        ? lrcToSongLines(parseLrcFile(lyrics.text))
        : []
  return withGuide(demoSongToJamSong(manifest, lines, guide.notes), guide)
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
 * The rows the picker's "Your songs" shelf should show, given whatever the
 * Songs shelf above it is already listing.
 *
 * That shelf serves the examples straight from their manifests, and every
 * example also has a local session row — the Examples library seeds one for
 * each, and opening one in Karaoke Night always did. Listed in both places
 * it reads as a duplicate rather than as two routes to the same song, and a
 * picker that shows a title twice is a picker nobody trusts.
 *
 * Only what is shelved is dropped. An example whose manifest could not be
 * fetched, or one the studio has since parked, still has its row — and
 * sessionSong can still sing it — so it stays reachable here, under a
 * slightly wrong heading, which beats being unjammable.
 */
export function ownSongRows(
  sessions: readonly UvrSession[],
  shelvedSessionIds: ReadonlySet<string>,
): JamSessionRow[] {
  return jammableSessionRows(sessions).filter(
    (row) => !shelvedSessionIds.has(row.session.sessionId),
  )
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
