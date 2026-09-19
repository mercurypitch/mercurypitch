// ── Demo song admin API ─────────────────────────────────────────────
// The Karaoke Night demo used to be a git-tracked manifest, so changing
// the song or fixing a lyric line meant shipping a build. `/api/demo-song`
// is the override layer: a public GET the page reads, and an admin PUT the
// studio writes.
//
// Kept out of `features/karaoke-night/demo-song.ts` on purpose — that
// module is on the Karaoke page's first-paint graph, and nothing an
// authoring page needs belongs there.

import { API_BASE_URL } from '@/lib/defaults'

/** The slug the shipped manifest and every pre-list row carry. */
export const DEFAULT_DEMO_SLUG = 'karaoke-night'

/**
 * Constrain a slug to what the Worker will accept, so the studio rejects a
 * bad one before a round trip rather than showing a 400.
 *
 * Two deliberate differences from the Worker's version. Spaces are folded
 * to hyphens, because an author typing a name should not have to know the
 * rule. And an empty id is REJECTED rather than defaulting to
 * `karaoke-night` — the Worker's default is what keeps pre-list clients
 * working, but here it would quietly point a new song at the original one
 * and overwrite it on save.
 */
export function normalizeDemoSlug(raw: string): string | null {
  const slug = raw.trim().toLowerCase().replace(/\s+/g, '-')
  if (slug === '' || slug.length > 64) return null
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) ? slug : null
}

/** The row as the API returns it, admin fields included. */
export interface DemoSongRecord {
  slug: string
  title: string
  artist: string
  attribution: {
    text: string
    url: string
    license: string
    licenseUrl: string
  }
  stems: { vocal?: string; instrumental?: string }
  lyrics: string | null
  lyricsText: string | null
  lyricsRevision: number
  durationSec: number | null
  /** Absent on the shipped manifest, which is live by definition. */
  active?: boolean
  updatedAt?: string
}

/** Everything an author supplies. The server owns revision and timestamps. */
export interface DemoSongDraft {
  title: string
  artist: string
  attributionText: string
  attributionUrl: string
  licenseName: string
  licenseUrl: string
  vocalUrl: string
  instrumentalUrl: string
  lyricsUrl: string
  lyricsText: string
  durationSec: number | null
  active: boolean
}

function base(): string {
  return API_BASE_URL ?? ''
}

/** Kept identical to the runtime's test in `karaoke-night/demo-song.ts`. */
const LRC_STAMP = /\[\d{1,2}:\d{2}/

export const blankDemoSongDraft = (): DemoSongDraft => ({
  title: '',
  artist: '',
  attributionText: '',
  attributionUrl: '',
  licenseName: '',
  licenseUrl: '',
  vocalUrl: '',
  instrumentalUrl: '',
  lyricsUrl: '',
  lyricsText: '',
  durationSec: null,
  active: true,
})

export function recordToDraft(row: DemoSongRecord): DemoSongDraft {
  return {
    title: row.title,
    artist: row.artist,
    attributionText: row.attribution?.text ?? '',
    attributionUrl: row.attribution?.url ?? '',
    licenseName: row.attribution?.license ?? '',
    licenseUrl: row.attribution?.licenseUrl ?? '',
    vocalUrl: row.stems?.vocal ?? '',
    instrumentalUrl: row.stems?.instrumental ?? '',
    lyricsUrl: row.lyrics ?? '',
    lyricsText: row.lyricsText ?? '',
    durationSec: row.durationSec,
    active: row.active ?? true,
  }
}

/**
 * Every row, parked ones included — the admin key is what makes the API
 * return those, and a list that hid them would be a list you could not
 * un-park from.
 *
 * Throws nothing: callers distinguish "no rows yet" from a transport
 * failure by the `ok` flag rather than by an exception.
 */
export async function loadDemoSongs(
  adminKey: string,
): Promise<
  { ok: true; songs: DemoSongRecord[] } | { ok: false; error: string }
> {
  if (base() === '') return { ok: false, error: 'No API configured' }
  try {
    const res = await fetch(`${base()}/api/demo-songs`, {
      headers: { 'X-Admin-Key': adminKey },
    })
    if (!res.ok) return { ok: false, error: `Request failed (${res.status})` }
    const data = (await res.json()) as { songs?: DemoSongRecord[] }
    return { ok: true, songs: data.songs ?? [] }
  } catch (e) {
    return { ok: false, error: String(e) }
  }
}

export async function saveDemoSong(
  slug: string,
  draft: DemoSongDraft,
  adminKey: string,
): Promise<
  { ok: true; song: DemoSongRecord | null } | { ok: false; error: string }
> {
  if (base() === '') return { ok: false, error: 'No API configured' }
  try {
    const res = await fetch(
      `${base()}/api/demo-song?slug=${encodeURIComponent(slug)}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Key': adminKey,
        },
        body: JSON.stringify(draft),
      },
    )
    const data = (await res.json().catch(() => ({}))) as {
      song?: DemoSongRecord
      error?: string
    }
    if (!res.ok) {
      return { ok: false, error: data.error ?? `Save failed (${res.status})` }
    }
    return { ok: true, song: data.song ?? null }
  } catch (e) {
    return { ok: false, error: String(e) }
  }
}

/** What a lyrics file carries beyond its line and word starts. */
export interface LyricsFileTiming {
  /** Words with an authored end time. */
  wordEnds: number
  /** Words split into sub-word sweeps. */
  splits: number
}

export type LyricsFileRead =
  | {
      ok: true
      text: string
      format: 'lrc' | 'txt'
      /** Present when the text carries word ends or splits a singer will get. */
      timing?: LyricsFileTiming
      /**
       * The text has an `x-mp-timing` tag that cannot be read. The lyrics
       * still work; the word ends in it are lost, and the author should hear
       * that here rather than find out on the stage.
       */
      timingUnreadable?: true
    }
  | { ok: false; error: string }

const READABLE = ['lrc', 'txt', 'lyricsfile']

function readAsText(file: File): Promise<string | null> {
  return new Promise<string | null>((resolve) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => resolve(null)
    reader.readAsText(file)
  })
}

/** How much a parsed timing extension actually holds. */
function countTiming(extension: {
  wordEndTimings: Record<number, (number | undefined)[]>
  wordSweepTimings: Record<number, Record<number, unknown[]>>
}): LyricsFileTiming {
  let wordEnds = 0
  for (const line of Object.values(extension.wordEndTimings)) {
    // Sparse: `forEach` skips the holes, which `length` would count.
    line.forEach((end) => {
      if (end !== undefined) wordEnds += 1
    })
  }
  let splits = 0
  for (const line of Object.values(extension.wordSweepTimings)) {
    splits += Object.values(line).filter((points) => points.length > 0).length
  }
  return { wordEnds, splits }
}

/**
 * Read a dropped or browsed lyrics file into text.
 *
 * The file itself is never uploaded — it goes straight into the pasted
 * lyrics field and is saved with the row, which is why an `.lrc` needs no
 * R2 round trip to reach a singer. Every failure is a returned error
 * rather than a throw: the author is mid-form, and losing their other
 * fields to an exception would cost far more than a bad file does.
 *
 * A `.lyricsfile` becomes enhanced LRC here, the same conversion the mixer's
 * own import does, with its word ends and splits riding in the `x-mp-timing`
 * tag. One stored text is enough: the singer's mixer derives either download
 * from what it loaded, so there is no second copy to keep in step.
 */
export async function readLyricsFile(file: File): Promise<LyricsFileRead> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (!READABLE.includes(ext)) {
    return {
      ok: false,
      error: 'Only .lrc, .lyricsfile and .txt files can be read.',
    }
  }
  const raw = await readAsText(file)
  if (raw === null) return { ok: false, error: 'That file could not be read.' }
  if (raw.trim() === '') return { ok: false, error: 'That file is empty.' }

  // Both loaded on demand: the YAML parser is heavy, and this page is the
  // only thing in the studio that ever needs it.
  const { hasLrcTimingMetadata, parseLrcTimingMetadata } =
    await import('@/lib/lrc-timing-metadata')

  let text = raw
  if (ext === 'lyricsfile') {
    const { lyricsfileToStoredLrc, parseLyricsfile } =
      await import('@/lib/lyricsfile')
    const parsed = await parseLyricsfile(raw)
    if (parsed === null) {
      return { ok: false, error: 'That is not a valid .lyricsfile.' }
    }
    text = lyricsfileToStoredLrc(parsed)
  }

  // Inferred from the CONTENT, not the extension, because that is what
  // the runtime does (`demoLyricsText` looks for [mm:ss stamps). A .lrc
  // with its timestamps stripped is plain text, and the studio has to say
  // so rather than promise a sync the singer will not get.
  const format = LRC_STAMP.test(text) ? 'lrc' : 'txt'
  if (!hasLrcTimingMetadata(text)) return { ok: true, text, format }

  const extension = parseLrcTimingMetadata(text)
  if (extension === null) {
    return { ok: true, text, format, timingUnreadable: true }
  }
  const timing = countTiming(extension)
  return timing.wordEnds + timing.splits > 0
    ? { ok: true, text, format, timing }
    : { ok: true, text, format }
}

const plural = (n: number, one: string, many: string): string =>
  `${n} ${n === 1 ? one : many}`

/**
 * What the studio says after a file lands in the box.
 *
 * The timing tag is a line of base64 at the top of the text, and to an
 * author who has never seen one it looks exactly like a corrupted export.
 * So the note names what it holds, in the author's terms, and says so just
 * as plainly when it cannot be read.
 */
export function describeLyricsFile(
  filename: string,
  read: Extract<LyricsFileRead, { ok: true }>,
): string {
  const lines = read.text
    .split('\n')
    .filter((l) => l.trim() !== '' && !l.startsWith('[x-mp-timing:')).length
  const parts = [
    plural(lines, 'line', 'lines'),
    read.format === 'lrc' ? 'timed' : 'plain text',
  ]
  if (read.timing !== undefined) {
    const held: string[] = []
    if (read.timing.wordEnds > 0) {
      held.push(plural(read.timing.wordEnds, 'word end', 'word ends'))
    }
    if (read.timing.splits > 0) {
      held.push(plural(read.timing.splits, 'split word', 'split words'))
    }
    parts.push(`with ${held.join(' and ')}`)
  }
  const warning =
    read.timingUnreadable === true
      ? ' Its timing tag could not be read, so the word ends in it will be ignored.'
      : ''
  return `Loaded ${filename} — ${parts.join(', ')}.${warning} Save to publish it.`
}

/**
 * The manifest that ships with the build — the floor the live page falls
 * back to. Shown in the studio so an author can see what they are
 * overriding, and start from it rather than from an empty form.
 */
export async function loadShippedManifest(): Promise<DemoSongRecord | null> {
  try {
    const res = await fetch('/karaoke-demo-song.json', { cache: 'no-cache' })
    if (!res.ok) return null
    const m = (await res.json()) as Partial<DemoSongRecord>
    if (typeof m.title !== 'string' || typeof m.artist !== 'string') return null
    return {
      slug: 'karaoke-night',
      title: m.title,
      artist: m.artist,
      attribution: m.attribution ?? {
        text: '',
        url: '',
        license: '',
        licenseUrl: '',
      },
      stems: m.stems ?? {},
      lyrics: m.lyrics ?? null,
      lyricsText: null,
      lyricsRevision: 0,
      durationSec: m.durationSec ?? null,
    }
  } catch {
    return null
  }
}
