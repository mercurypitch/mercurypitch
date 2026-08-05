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
  /** Lyrics URL — .lrc (synced) or .txt (plain, until an LRC exists). */
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

async function loadListFromApi(): Promise<DemoSongManifest[]> {
  if ((API_BASE_URL ?? '') === '') return []
  try {
    const res = await fetch(`${API_BASE_URL}/api/demo-songs`)
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

async function loadFromManifest(): Promise<DemoSongManifest | null> {
  try {
    const res = await fetch(MANIFEST_URL, { cache: 'no-cache' })
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
export async function loadDemoSongs(): Promise<DemoSongManifest[]> {
  const fromApi = await loadListFromApi()
  if (fromApi.length > 0) return fromApi
  const shipped = await loadFromManifest()
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
async function demoLyricsText(
  m: DemoSongManifest,
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
  const res = await fetch(url)
  if (!res.ok) return null
  const text = await res.text()
  if (text.trim() === '') return null
  return { text, format: url.toLowerCase().endsWith('.lrc') ? 'lrc' : 'txt' }
}

/**
 * Seed the demo lyrics into the local lyrics db.
 *
 * Never clobbers the visitor's own work: anything stored under
 * DEMO_SESSION_ID may be an edit or an upload of theirs. But an authored
 * correction has to be able to land, so a revision bump replaces the copy
 * **only when it still matches what we seeded** — i.e. nobody has touched
 * it. A copy seeded before revisions existed has no stamp to compare, so
 * it is left alone rather than guessed at.
 */
export async function seedDemoLyrics(m: DemoSongManifest): Promise<void> {
  try {
    const { loadLyricsFromDb, saveLyricsToDb } =
      await import('@/db/services/lyrics-db-service')
    const sessionId = demoSessionId(m.slug)
    const stampKey = seedStampKey(m.slug)
    const existing = await loadLyricsFromDb(sessionId)
    const revision = m.lyricsRevision ?? 0
    if (
      !shouldSeedLyrics(existing?.text ?? null, readStamp(stampKey), revision)
    )
      return

    const lyrics = await demoLyricsText(m)
    if (lyrics === null) return
    await saveLyricsToDb(sessionId, {
      text: lyrics.text,
      format: lyrics.format,
      filename: `${m.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.${lyrics.format}`,
    })
    writeStamp(stampKey, { revision, text: lyrics.text })
  } catch (err) {
    if (import.meta.env.DEV)
      console.warn('[KaraokeNight] demo lyrics seed failed:', err)
  }
}
