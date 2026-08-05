// ── Demo song (Karaoke Night) — the parts worth testing ──────────────
//
// The row shape, the public projection and the two decisions the handler
// makes. Split out of index.ts because both decisions are quiet ones: a
// wrong answer does not throw, it just makes a visitor's lyrics stale or
// silently re-arms a parked row, and neither shows up in a smoke test.

export interface DemoSongRow {
  id: string
  slug: string
  title: string
  artist: string
  attributionText: string
  attributionUrl: string
  licenseName: string
  licenseUrl: string
  vocalUrl: string | null
  instrumentalUrl: string | null
  lyricsUrl: string | null
  lyricsText: string | null
  lyricsRevision: number
  durationSec: number | null
  active: number
  updatedAt: string
}

/** The slug every pre-list row carries, and the default when none is given. */
export const DEFAULT_DEMO_SLUG = 'karaoke-night'

/**
 * Constrain a slug, or reject it.
 *
 * Binding keeps it out of the SQL, but it does not stay in the database:
 * the client builds a local-db session id from it and a `?session=` URL
 * around that. So it has to survive a round trip through a URL and a key
 * unchanged — which means lowercase, no spaces, no separators of its own.
 * Returns null for anything that does not qualify, so the caller answers
 * 400 rather than quietly creating a row nobody can address.
 */
export function normalizeDemoSlug(raw: string | null): string | null {
  const slug = (raw ?? '').trim().toLowerCase()
  if (slug === '') return DEFAULT_DEMO_SLUG
  if (slug.length > 64) return null
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) ? slug : null
}

/** The columns a PUT may set, in bind order. */
export const DEMO_SONG_FIELDS = [
  'title',
  'artist',
  'attributionText',
  'attributionUrl',
  'licenseName',
  'licenseUrl',
  'vocalUrl',
  'instrumentalUrl',
  'lyricsUrl',
  'lyricsText',
  'durationSec',
  'active',
] as const

export type DemoSongField = (typeof DEMO_SONG_FIELDS)[number]

/** The client-facing shape — mirrors `DemoSongManifest` in the app. */
export function publicDemoSong(row: DemoSongRow): Record<string, unknown> {
  return {
    slug: row.slug,
    title: row.title,
    artist: row.artist,
    attribution: {
      text: row.attributionText,
      url: row.attributionUrl,
      license: row.licenseName,
      licenseUrl: row.licenseUrl,
    },
    stems: {
      vocal: row.vocalUrl ?? '',
      instrumental: row.instrumentalUrl ?? '',
    },
    lyrics: row.lyricsUrl,
    lyricsText: row.lyricsText,
    lyricsRevision: row.lyricsRevision,
    durationSec: row.durationSec,
    // Always true on the public read (that query filters on it) — it is
    // here for the studio, which reads parked rows and must show them as
    // parked rather than silently re-arming them on the next save.
    active: row.active === 1,
    updatedAt: row.updatedAt,
  }
}

/**
 * The revision only moves when the lyrics actually change.
 *
 * It is the client's cue to re-seed a visitor's local copy, so bumping it
 * for an unrelated edit (a title typo, a new licence URL) would re-seed
 * everybody for nothing. A first row starts at 1 — revision zero belongs
 * to the manifest that ships with the build.
 */
export function nextLyricsRevision(
  existing: Pick<DemoSongRow, 'lyricsUrl' | 'lyricsText' | 'lyricsRevision'> | null,
  nextLyricsUrl: string | null,
  nextLyricsText: string | null,
): number {
  const prior = existing?.lyricsRevision ?? 0
  const changed =
    existing === null ||
    existing.lyricsUrl !== nextLyricsUrl ||
    existing.lyricsText !== nextLyricsText
  return changed ? prior + 1 : prior
}

/**
 * Normalise a PUT body into column values.
 *
 * Empty strings become NULL so "no lyrics URL" has one representation
 * rather than two — the client tests these with `?? ''`, and a stored ''
 * would otherwise read as a URL to fetch. `active` defaults to live: only
 * an explicit false parks a row, so a client that omits the field cannot
 * take the demo down by accident.
 */
export function demoSongValues(
  body: Record<string, unknown>,
): Record<DemoSongField, string | number | null> {
  const str = (key: string): string =>
    typeof body[key] === 'string' ? (body[key] as string) : ''
  const nullable = (key: string): string | null => {
    const v = body[key]
    if (typeof v !== 'string') return null
    return v.trim() === '' ? null : v
  }
  return {
    title: String(body.title ?? '').trim(),
    artist: String(body.artist ?? '').trim(),
    attributionText: str('attributionText'),
    attributionUrl: str('attributionUrl'),
    licenseName: str('licenseName'),
    licenseUrl: str('licenseUrl'),
    vocalUrl: nullable('vocalUrl'),
    instrumentalUrl: nullable('instrumentalUrl'),
    lyricsUrl: nullable('lyricsUrl'),
    lyricsText: nullable('lyricsText'),
    durationSec:
      typeof body.durationSec === 'number' && Number.isFinite(body.durationSec)
        ? Math.round(body.durationSec)
        : null,
    active: body.active === false || body.active === 0 ? 0 : 1,
  }
}
