// Demo-song manifest for the Karaoke Night page.
//
// Two sources, in order:
//   1. GET /api/demo-song — the row the Content Studio edits, so the demo
//      can be changed without shipping a build.
//   2. public/karaoke-demo-song.json — the manifest that ships with the
//      app, and the floor. An absent row, a parked row, a malformed row or
//      an unreachable API all land here, so the demo cannot be broken from
//      the studio or by an outage.
//
// Heavy assets (stems, LRC) live on R2 either way; only the pointers move.
//
// This module is part of the page's FIRST-PAINT graph — keep it free of
// static db/store imports (the lyrics seed loads the db layer on demand).

import type { LyricsData } from '@/db/services/lyrics-db-service'
import { API_BASE_URL } from '@/lib/defaults'

export interface DemoSongManifest {
  /**
   * Stable id for this demo. Absent on the shipped manifest, which is
   * `LEGACY_SLUG` by definition — see `demoSessionId`.
   */
  slug?: string
  title: string
  artist: string
  attribution: {
    text: string
    url: string
    license: string
    licenseUrl: string
  }
  stems: { vocal?: string; instrumental?: string }
  /** Lyrics URL — .lrc or .lyricsfile (synced), or .txt (plain). */
  lyrics?: string
  /** Lyrics pasted straight into the studio. Wins over `lyrics` when set. */
  lyricsText?: string
  /**
   * Bumped by the API whenever the lyrics change. Seeding is deliberately
   * non-destructive, so this is the only way an authored correction can
   * reach a visitor who already has the old copy. Absent for the shipped
   * manifest, which is revision zero by definition.
   */
  lyricsRevision?: number
  durationSec?: number
}

/**
 * Session id of the ORIGINAL demo — lyrics, pitch analysis and scores
 * persist under it in the local db exactly like a normal separation
 * session.
 *
 * It is a bare string with no slug in it because it shipped that way, and
 * every visitor who has ever sung the demo has local rows keyed by it.
 * `demoSessionId` therefore keeps returning exactly this for the original
 * slug rather than migrating anybody.
 */
export const DEMO_SESSION_ID = 'karaoke-night-demo'

/** The slug the shipped manifest and every pre-list row carry. */
export const LEGACY_SLUG = 'karaoke-night'

/**
 * Local-db session id for a demo.
 *
 * The original keeps its historic id; anything added later is namespaced
 * under it. Getting this wrong does not throw — it silently orphans a
 * visitor's lyrics and takes, which is why the legacy case is spelled out
 * rather than derived.
 */
export function demoSessionId(slug: string | undefined): string {
  const s = (slug ?? '').trim()
  return s === '' || s === LEGACY_SLUG
    ? DEMO_SESSION_ID
    : `${DEMO_SESSION_ID}:${s}`
}

/** Whether a local session belongs to any demo song. */
export function isDemoSessionId(sessionId: string): boolean {
  return (
    sessionId === DEMO_SESSION_ID || sessionId.startsWith(`${DEMO_SESSION_ID}:`)
  )
}

const MANIFEST_URL = '/karaoke-demo-song.json'

/** What we last seeded, so an authored update can tell an untouched copy
 *  from one the visitor has edited. Per demo — the original keeps the
 *  unsuffixed key it has always written, for the same reason the session
 *  id does. */
const SEED_STAMP_KEY = 'mercurypitch.demoLyricsSeed.v1'

function seedStampKey(slug: string | undefined): string {
  const id = demoSessionId(slug)
  return id === DEMO_SESSION_ID ? SEED_STAMP_KEY : `${SEED_STAMP_KEY}.${id}`
}

export interface SeedStamp {
  revision: number
  /** Exactly the text we wrote. Still equal ⇒ nobody has edited it. */
  text: string
}

/**
 * Whether an authored lyric correction may replace what is already stored
 * under the demo session id.
 *
 * Three ways the answer is no, and each protects something different:
 * an unstamped copy predates this mechanism and its provenance is
 * unknown; a stamp at or above the incoming revision means we already
 * seeded this text; and text that no longer matches the stamp is the
 * visitor's own edit, which outranks anything the studio says.
 */
export function shouldSeedLyrics(
  existingText: string | null,
  stamp: SeedStamp | null,
  revision: number,
): boolean {
  if (existingText === null) return true
  if (stamp === null) return false
  if (stamp.revision >= revision) return false
  return existingText === stamp.text
}

function isManifest(m: unknown): m is DemoSongManifest {
  return (
    typeof m === 'object' &&
    m !== null &&
    typeof (m as DemoSongManifest).title === 'string' &&
    typeof (m as DemoSongManifest).artist === 'string'
  )
}

async function loadListFromApi(
  signal?: AbortSignal,
): Promise<DemoSongManifest[]> {
  if ((API_BASE_URL ?? '') === '') return []
  try {
    const res = await fetch(`${API_BASE_URL}/api/demo-songs`, { signal })
    if (!res.ok) return []
    const data = (await res.json()) as { songs?: unknown }
    if (!Array.isArray(data.songs)) return []
    // Filter rather than reject the batch: one malformed row must not cost
    // the visitor the songs that are fine.
    return data.songs.filter(isManifest).filter(demoIsPlayable)
  } catch (err) {
    if (import.meta.env.DEV)
      console.warn('[KaraokeNight] demo song API failed:', err)
    return []
  }
}

async function loadFromManifest(
  signal?: AbortSignal,
): Promise<DemoSongManifest | null> {
  try {
    const res = await fetch(MANIFEST_URL, { cache: 'no-cache', signal })
    if (!res.ok) return null
    const m = (await res.json()) as unknown
    return isManifest(m) ? m : null
  } catch (err) {
    if (import.meta.env.DEV)
      console.warn('[KaraokeNight] demo manifest failed:', err)
    return null
  }
}

/**
 * Every demo the page should offer, in the order it should offer them.
 *
 * The API list wins whole: as soon as the studio has one playable row, it
 * is the set. Mixing in the shipped manifest would resurrect a song an
 * author had deliberately parked, and there would be no way to take it
 * down. An empty list — no rows, no API, an outage — falls back to the
 * manifest that ships with the build, which is the floor.
 */
export async function loadDemoSongs(
  signal?: AbortSignal,
): Promise<DemoSongManifest[]> {
  const fromApi = await loadListFromApi(signal)
  if (fromApi.length > 0) return fromApi
  const shipped = await loadFromManifest(signal)
  return shipped === null ? [] : [shipped]
}

/**
 * The first playable demo. Kept for the single-song paths (a `?session=`
 * restore of the original, and the attribution line) that have no list to
 * choose from.
 */
export async function loadDemoSong(): Promise<DemoSongManifest | null> {
  const songs = await loadDemoSongs()
  return songs[0] ?? null
}

/** The demo is singable once both stem URLs are filled in. */
export function demoIsPlayable(m: DemoSongManifest | null): boolean {
  return (
    m !== null &&
    (m.stems.vocal ?? '') !== '' &&
    (m.stems.instrumental ?? '') !== ''
  )
}

function readStamp(key: string): SeedStamp | null {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return null
    const parsed = JSON.parse(raw) as SeedStamp
    return typeof parsed.revision === 'number' &&
      typeof parsed.text === 'string'
      ? parsed
      : null
  } catch {
    return null
  }
}

function writeStamp(key: string, stamp: SeedStamp): void {
  try {
    localStorage.setItem(key, JSON.stringify(stamp))
  } catch {
    // Private-mode storage failure just means we re-check next time.
  }
}

/** The lyric text this manifest carries, pasted text winning over a URL. */
export async function demoLyricsText(
  m: DemoSongManifest,
  signal?: AbortSignal,
): Promise<{ text: string; format: 'lrc' | 'txt' } | null> {
  const pasted = (m.lyricsText ?? '').trim()
  if (pasted !== '') {
    // Pasted lyrics are synced if any line carries an [mm:ss.xx] stamp.
    return {
      text: m.lyricsText!,
      format: /\[\d{1,2}:\d{2}/.test(pasted) ? 'lrc' : 'txt',
    }
  }
  const url = m.lyrics ?? ''
  if (url === '') return null
  const res = await fetch(url, { signal })
  if (!res.ok) return null
  const text = await res.text()
  if (text.trim() === '') return null
  // The path alone: a cache-busting `?v=2` is a normal thing to put on an
  // asset URL, and it must not turn a synced file into plain text.
  const path = url.toLowerCase().split(/[?#]/)[0]
  if (path.endsWith('.lyricsfile')) return lyricsfileAsLrc(text)
  return { text, format: path.endsWith('.lrc') ? 'lrc' : 'txt' }
}

/**
 * A `.lyricsfile` behind the lyrics URL, as the LRC the rest of the app
 * speaks. Null for a file that is not one: seeding nothing leaves the singer
 * with the finder, where seeding it as text would put a page of YAML on the
 * stage. Loaded on demand — the YAML parser has no business on this page's
 * first paint.
 */
async function lyricsfileAsLrc(
  text: string,
): Promise<{ text: string; format: 'lrc' } | null> {
  const { lyricsfileToStoredLrc, parseLyricsfile } =
    await import('@/lib/lyricsfile')
  const parsed = await parseLyricsfile(text)
  return parsed === null
    ? null
    : { text: lyricsfileToStoredLrc(parsed), format: 'lrc' }
}

/** Characters a download cannot carry in its name on one platform or another. */
const UNSAFE_IN_A_FILENAME = /[\\/:*?"<>|]+/g

/**
 * What a seeded lyric is called — and so what a download of it is called,
 * because both exports take their name from the stored record.
 *
 * "Artist - Title", the shape a lyric found online is stored under, so an
 * example exports like any other song in the library.
 */
export function demoLyricsFilename(
  m: Pick<DemoSongManifest, 'title' | 'artist'>,
  extension: string,
): string {
  const clean = (part: string): string =>
    part.replace(UNSAFE_IN_A_FILENAME, ' ').replace(/\s+/g, ' ').trim()
  const artist = clean(m.artist)
  const title = clean(m.title)
  const base = artist === '' ? title : `${artist} - ${title}`
  return `${base === '' ? 'lyrics' : base}.${extension}`
}

/**
 * The new name for a record still carrying the one every seed used to write
 * — the title alone, as a slug — or null for a record that is not. The
 * extension is kept: mapping a plain-text seed turns it into an `.lrc`.
 */
function renamedFromLegacy(
  m: DemoSongManifest,
  filename: string,
): string | null {
  const dot = filename.lastIndexOf('.')
  const base = dot > 0 ? filename.slice(0, dot) : filename
  if (base !== m.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')) return null
  const renamed = demoLyricsFilename(
    m,
    dot > 0 ? filename.slice(dot + 1) : 'lrc',
  )
  return renamed === filename ? null : renamed
}

/**
 * What a correction has no business taking with it.
 *
 * `shouldSeedLyrics` looks at the active text, and the active text is only
 * one of a record's versions. A singer who corrected the words and then went
 * back to the Original has an untouched active text AND an Edited version
 * of their own -- and the store replaces whole records, so a correction
 * written as bare text deleted their version along with the old Original.
 *
 * The Original is rebuilt the way a bare record's is on load, so the end
 * marks in the corrected text are read: a record that already has versions
 * is never derived again, and a version written without them has lost them.
 * With nothing to keep there is nothing to pre-empt, and the record stays
 * bare.
 */
async function keptBesideTheOriginal(
  current: LyricsData | null,
  correctedText: string,
): Promise<Partial<LyricsData>> {
  const size =
    current?.fontSize === undefined ? {} : { fontSize: current.fontSize }
  const theirs = (current?.versions ?? []).filter((v) => v.kind !== 'imported')
  if (theirs.length === 0) return size
  const { sortVersions, synthesizeVersions } =
    await import('@/lib/lyrics-versions')
  const original = synthesizeVersions({ text: correctedText }, Date.now())
  return {
    ...size,
    versions: sortVersions([...original.versions, ...theirs]),
    activeVersionKind: 'imported',
  }
}

/** Seeds under way, by session id — see `seedDemoLyrics`. */
const seedsInFlight = new Map<string, Promise<void>>()

/**
 * Seed the demo lyrics into the local lyrics db.
 *
 * Never clobbers the visitor's own work: anything stored under
 * DEMO_SESSION_ID may be an edit or an upload of theirs. But an authored
 * correction has to be able to land, so a revision bump replaces the copy
 * **only when it still matches what we seeded** — i.e. nobody has touched
 * it. A copy seeded before revisions existed has no stamp to compare, so
 * it is left alone rather than guessed at.
 *
 * One seed per song at a time. The startup seeder, the song card and the
 * stage can all ask within the same second, and the store upserts as
 * create-then-delete — two writers that both read "nothing here" would each
 * leave a row behind.
 */
export function seedDemoLyrics(
  m: DemoSongManifest,
  signal?: AbortSignal,
): Promise<void> {
  const sessionId = demoSessionId(m.slug)
  const running = seedsInFlight.get(sessionId)
  if (running !== undefined) return running
  const seed = seedOnce(m, signal).finally(() => {
    seedsInFlight.delete(sessionId)
  })
  seedsInFlight.set(sessionId, seed)
  return seed
}

async function seedOnce(
  m: DemoSongManifest,
  signal?: AbortSignal,
): Promise<void> {
  try {
    const { loadLyricsFromDb, renameLyricsInDb, saveLyricsToDb } =
      await import('@/db/services/lyrics-db-service')
    const sessionId = demoSessionId(m.slug)
    const stampKey = seedStampKey(m.slug)
    const existing = await loadLyricsFromDb(sessionId)
    const revision = m.lyricsRevision ?? 0
    if (
      !shouldSeedLyrics(existing?.text ?? null, readStamp(stampKey), revision)
    ) {
      // Nothing to seed, but a copy from before examples were named after
      // their artist still downloads as the bare title. Renaming it touches
      // no word of the visitor's text, so it is safe whoever edited it --
      // as long as it is a rename. Re-saving the copy read above would put
      // back whatever the mixer has stored since.
      const renamed =
        existing === null ? null : renamedFromLegacy(m, existing.filename)
      if (renamed !== null) await renameLyricsInDb(sessionId, renamed)
      return
    }

    const lyrics = await demoLyricsText(m, signal)
    if (lyrics === null || signal?.aborted === true) return
    // A lyrics URL can take seconds on a bad connection, and the stage does
    // not wait for ever — it goes online for the words instead. Whatever it
    // stored in the meantime is the visitor's, so look again before writing.
    const current = await loadLyricsFromDb(sessionId)
    if (!shouldSeedLyrics(current?.text ?? null, readStamp(stampKey), revision))
      return
    await saveLyricsToDb(sessionId, {
      text: lyrics.text,
      format: lyrics.format,
      filename: demoLyricsFilename(m, lyrics.format),
      ...(await keptBesideTheOriginal(current, lyrics.text)),
    })
    writeStamp(stampKey, { revision, text: lyrics.text })
  } catch (err) {
    if (import.meta.env.DEV)
      console.warn('[KaraokeNight] demo lyrics seed failed:', err)
  }
}

/**
 * Seed by session id, for a caller that was handed an id and not a manifest.
 *
 * The stage is the one that matters: a song sheet pick, a playlist step and
 * the in-app mixer all open an example by its row, and a row can be in the
 * library before its lyrics are. Quiet on every failure, like the seed — the
 * caller looks in the store afterwards and finds them there or does not.
 */
export async function seedDemoLyricsForSession(
  sessionId: string,
  signal?: AbortSignal,
): Promise<void> {
  if (!isDemoSessionId(sessionId)) return
  const songs = await loadDemoSongs(signal)
  const manifest = songs.find((m) => demoSessionId(m.slug) === sessionId)
  if (manifest !== undefined) await seedDemoLyrics(manifest, signal)
}
