// Demo-song manifest for the Karaoke Night page. The song is configurable:
// swap it by editing public/karaoke-demo-song.json (title/attribution) and
// pointing the stem/LRC URLs at new assets — no code changes. Heavy assets
// (stems, LRC) live on R2; the manifest itself ships with the app so changes
// are code-reviewed.
//
// This module is part of the page's FIRST-PAINT graph — keep it free of
// static db/store imports (the lyrics seed loads the db layer on demand).

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
  durationSec?: number
}

/** Stable session id — lyrics, pitch analysis and scores persist under it in
 *  the local db exactly like a normal separation session. */
export const DEMO_SESSION_ID = 'karaoke-night-demo'

const MANIFEST_URL = '/karaoke-demo-song.json'

export async function loadDemoSong(): Promise<DemoSongManifest | null> {
  try {
    const res = await fetch(MANIFEST_URL, { cache: 'no-cache' })
    if (!res.ok) return null
    const m = (await res.json()) as DemoSongManifest
    if (typeof m.title !== 'string' || typeof m.artist !== 'string') return null
    return m
  } catch (err) {
    if (import.meta.env.DEV)
      console.warn('[KaraokeNight] demo manifest failed:', err)
    return null
  }
}

/** The demo is singable once both stem URLs are filled in. */
export function demoIsPlayable(m: DemoSongManifest | null): boolean {
  return (
    m !== null &&
    (m.stems.vocal ?? '') !== '' &&
    (m.stems.instrumental ?? '') !== ''
  )
}

/** Seed the demo lyrics into the local lyrics db, once. Never overwrites an
 *  existing record — the demo ships with the synced LRC from the start, and
 *  anything already stored under DEMO_SESSION_ID is the visitor's own (an edit
 *  or a lyrics upload), which we must not clobber. */
export async function seedDemoLyrics(m: DemoSongManifest): Promise<void> {
  const url = m.lyrics ?? ''
  if (url === '') return
  try {
    const { loadLyricsFromDb, saveLyricsToDb } =
      await import('@/db/services/lyrics-db-service')
    if ((await loadLyricsFromDb(DEMO_SESSION_ID)) !== null) return
    // .lrc = synced; .txt = a plain-lyrics fallback if a manifest ever ships one.
    const format = url.toLowerCase().endsWith('.lrc') ? 'lrc' : 'txt'
    const res = await fetch(url)
    if (!res.ok) return
    const text = await res.text()
    if (text.trim() === '') return
    await saveLyricsToDb(DEMO_SESSION_ID, {
      text,
      format,
      filename: `${m.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.${format}`,
    })
  } catch (err) {
    if (import.meta.env.DEV)
      console.warn('[KaraokeNight] demo lyrics seed failed:', err)
  }
}
