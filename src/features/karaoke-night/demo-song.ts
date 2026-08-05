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

/** Stable session id — lyrics, pitch analysis and scores persist under it in
 *  the local db exactly like a normal separation session. */
export const DEMO_SESSION_ID = 'karaoke-night-demo'

const MANIFEST_URL = '/karaoke-demo-song.json'

/** What we last seeded, so an authored update can tell an untouched copy
 *  from one the visitor has edited. */
const SEED_STAMP_KEY = 'mercurypitch.demoLyricsSeed.v1'

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

async function loadFromApi(): Promise<DemoSongManifest | null> {
  if ((API_BASE_URL ?? '') === '') return null
  try {
    const res = await fetch(`${API_BASE_URL}/api/demo-song`)
    if (!res.ok) return null
    const data = (await res.json()) as { song: DemoSongManifest | null }
    return isManifest(data.song) ? data.song : null
  } catch (err) {
    if (import.meta.env.DEV)
      console.warn('[KaraokeNight] demo song API failed:', err)
    return null
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

export async function loadDemoSong(): Promise<DemoSongManifest | null> {
  // A studio row only wins if it is actually playable. Half-filled rows
  // (someone saving a title before pasting the stem URLs) fall through to
  // the shipped manifest rather than presenting an unplayable demo.
  const fromApi = await loadFromApi()
  if (fromApi !== null && demoIsPlayable(fromApi)) return fromApi
  return loadFromManifest()
}

/** The demo is singable once both stem URLs are filled in. */
export function demoIsPlayable(m: DemoSongManifest | null): boolean {
  return (
    m !== null &&
    (m.stems.vocal ?? '') !== '' &&
    (m.stems.instrumental ?? '') !== ''
  )
}

function readStamp(): SeedStamp | null {
  try {
    const raw = localStorage.getItem(SEED_STAMP_KEY)
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

function writeStamp(stamp: SeedStamp): void {
  try {
    localStorage.setItem(SEED_STAMP_KEY, JSON.stringify(stamp))
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
    const existing = await loadLyricsFromDb(DEMO_SESSION_ID)
    const revision = m.lyricsRevision ?? 0
    if (!shouldSeedLyrics(existing?.text ?? null, readStamp(), revision)) return

    const lyrics = await demoLyricsText(m)
    if (lyrics === null) return
    await saveLyricsToDb(DEMO_SESSION_ID, {
      text: lyrics.text,
      format: lyrics.format,
      filename: `${m.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.${lyrics.format}`,
    })
    writeStamp({ revision, text: lyrics.text })
  } catch (err) {
    if (import.meta.env.DEV)
      console.warn('[KaraokeNight] demo lyrics seed failed:', err)
  }
}
