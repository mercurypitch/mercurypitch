// ============================================================
// Lyrics Service — fetch, parse, and sync lyrics
// ============================================================

export interface LrcLine {
  time: number // seconds
  text: string
}

// ── Title Extraction ──────────────────────────────────────────

export function extractTitle(filename: string): string {
  // Remove extension
  let title = filename.replace(/\.[^/.]+$/, '')

  // Remove common patterns
  title = title
    .replace(/\s*[-–—]\s*(official\s+)?(music\s+)?video\s*$/i, '')
    .replace(/\s*[-–—]\s*(official\s+)?audio\s*$/i, '')
    .replace(/\s*[-–—]\s*(official\s+)?lyric\s*video\s*$/i, '')
    .replace(/\s*[-–—]\s*lyrics?\s*$/i, '')
    .replace(/\s*\(official\s*(music\s+)?video\)\s*$/i, '')
    .replace(/\s*\(official\s*audio\)\s*$/i, '')
    .replace(/\s*\(lyrics?\)\s*$/i, '')
    .replace(
      /\s*\(.*?(instrumental|acoustic|remix|live|cover|karoake).*?\)\s*$/i,
      '',
    )
    .replace(/\s*[-–—]\s*(instrumental|acoustic|remix|live|cover)\s*$/i, '')
    .trim()

  return title || 'Unknown'
}

/**
 * Parse "Artist - Title" from a cleaned filename string.
 * Returns { artist, title } with best-guess extraction.
 */
export function parseArtistTitle(input: string): {
  artist: string
  title: string
} {
  const cleaned = extractTitle(input)

  // Try "Artist - Title" pattern
  const dashMatch = cleaned.match(/^(.+?)\s*[-–—]\s*(.+)$/)
  if (dashMatch) {
    return {
      artist: dashMatch[1].trim(),
      title: dashMatch[2].trim(),
    }
  }

  // Try "Artist – Title" (en dash) or "Artist — Title" (em dash) — already covered above
  // Try "Title by Artist"
  const byMatch = cleaned.match(/^(.+?)\s+by\s+(.+)$/i)
  if (byMatch) {
    return {
      artist: byMatch[2].trim(),
      title: byMatch[1].trim(),
    }
  }

  // No separator — assume the whole thing is the title
  return { artist: '', title: cleaned }
}

// ── Lyrics API Fetching ──────────────────────────────────────

export interface LyricsSearchResult {
  text: string
  format: 'txt' | 'lrc'
}

function createTimeoutSignal(ms: number): {
  signal: AbortSignal
  clear: () => void
} {
  const ctrl = new AbortController()
  const id = setTimeout(() => ctrl.abort(), ms)
  return { signal: ctrl.signal, clear: () => clearTimeout(id) }
}

export async function searchLyrics(
  rawInput: string,
): Promise<LyricsSearchResult | null> {
  const { artist, title } = parseArtistTitle(rawInput)

  const cleanTitle = title.replace(/\s*\(.*?\)\s*/g, '').trim()

  // 1. Try strict GET match first if we have both artist and title
  if (artist && cleanTitle) {
    try {
      const result = await fetchLyricsLrclib(artist, cleanTitle)
      if (result) return result
    } catch {
      /* ignore */
    }
  }

  // 2. Fallback to a single fuzzy search using 'q'
  // We use the cleaned title (no parentheticals) to maximize match chances
  const queryStr = artist ? `${artist} ${cleanTitle}` : cleanTitle

  try {
    const results = await fetchSearchLrclib(queryStr)
    if (results.length > 0) {
      // Find best match with synced lyrics first
      const synced = results.find(
        (r) => r.syncedLyrics !== undefined && r.syncedLyrics.length > 20,
      )
      if (synced !== undefined && synced.syncedLyrics !== undefined) {
        return { text: synced.syncedLyrics, format: 'lrc' }
      }
      // Fallback to any plain lyrics
      const plain = results.find(
        (r) => r.plainLyrics !== undefined && r.plainLyrics.length > 10,
      )
      if (plain !== undefined && plain.plainLyrics !== undefined) {
        return { text: plain.plainLyrics, format: 'txt' }
      }
    }
  } catch {
    /* ignore */
  }

  return null
}

async function fetchLyricsLrclib(
  artist: string,
  title: string,
): Promise<LyricsSearchResult | null> {
  const params = new URLSearchParams()
  params.set('track_name', title)
  if (artist) params.set('artist_name', artist)

  const { signal, clear } = createTimeoutSignal(25000)
  const resp = await fetch(`https://lrclib.net/api/get?${params.toString()}`, {
    signal,
    headers: {
      'LrcLib-Client': 'PitchPerfect/1.0.0',
    },
  })
  clear()
  if (!resp.ok) return null

  const data = await resp.json()

  // Prefer synced LRC lyrics
  if (typeof data?.syncedLyrics === 'string' && data.syncedLyrics.length > 20) {
    return { text: data.syncedLyrics, format: 'lrc' }
  }
  // Fall back to plain lyrics
  if (typeof data?.plainLyrics === 'string' && data.plainLyrics.length > 10) {
    return { text: data.plainLyrics, format: 'txt' }
  }
  return null
}

// ── Multi-Result Search ─────────────────────────────────────

export interface LyricsSearchMatch {
  artist: string
  title: string
  plainLyrics?: string
  syncedLyrics?: string
  id: number
}

export async function searchLyricsMulti(
  rawInput: string,
): Promise<LyricsSearchMatch[]> {
  const { artist, title } = parseArtistTitle(rawInput)

  const cleanTitle = title.replace(/\s*\(.*?\)\s*/g, '').trim()
  const rawQueries: string[] = []

  if (artist && title) {
    if (title !== cleanTitle) {
      rawQueries.push(`${artist} ${cleanTitle}`)
    }
    rawQueries.push(`${artist} ${title}`)
  }
  if (title !== cleanTitle) {
    rawQueries.push(cleanTitle)
  }
  rawQueries.push(title)

  // Deduplicate to avoid making identical API calls
  const queries = [...new Set(rawQueries)]

  const seen = new Set<number>()
  const results: LyricsSearchMatch[] = []

  for (const q of queries) {
    if (results.length >= 20) break
    try {
      const batch = await fetchSearchLrclib(q)
      if (batch.length > 0) {
        for (const match of batch) {
          if (results.length >= 20) break
          if (!seen.has(match.id)) {
            seen.add(match.id)
            results.push(match)
          }
        }
        // If we found results for this query, stop falling back to avoid rate limits
        if (results.length > 0) break
      }
    } catch {
      /* continue */
    }
  }

  return results
}

export async function fetchLyricsById(
  id: number,
): Promise<LyricsSearchResult | null> {
  try {
    const { signal, clear } = createTimeoutSignal(25000)
    const resp = await fetch(`https://lrclib.net/api/get/${id}`, {
      signal,
      headers: {
        'LrcLib-Client': 'PitchPerfect/1.0.0',
      },
    })
    clear()
    if (!resp.ok) return null

    const data = await resp.json()

    if (
      typeof data?.syncedLyrics === 'string' &&
      data.syncedLyrics.length > 20
    ) {
      return { text: data.syncedLyrics, format: 'lrc' }
    }
    if (typeof data?.plainLyrics === 'string' && data.plainLyrics.length > 10) {
      return { text: data.plainLyrics, format: 'txt' }
    }
    return null
  } catch {
    return null
  }
}

async function fetchSearchLrclib(query: string): Promise<LyricsSearchMatch[]> {
  const params = new URLSearchParams()
  params.set('q', query)

  console.log(`[Lyrics Service] -> Fetching search API: q="${query}"`)
  const { signal, clear } = createTimeoutSignal(25000)

  try {
    const resp = await fetch(
      `https://lrclib.net/api/search?${params.toString()}`,
      {
        signal,
        headers: {
          'LrcLib-Client': 'PitchPerfect/1.0.0',
        },
      },
    )
    clear()

    console.log(
      `[Lyrics Service] <- Search API status: ${resp.status} for q="${query}"`,
    )

    if (!resp.ok) {
      console.warn(
        `[Lyrics Service] Search API error response: ${resp.statusText}`,
      )
      return []
    }

    const data = await resp.json()
    if (!Array.isArray(data)) {
      console.warn(`[Lyrics Service] Search API returned non-array data.`)
      return []
    }

    console.log(
      `[Lyrics Service] <- Search API returned ${data.length} results.`,
    )

    return data
      .filter((item: Record<string, unknown>) => typeof item.id === 'number')
      .map((item: Record<string, unknown>) => ({
        id: item.id as number,
        artist:
          typeof item.artistName === 'string'
            ? item.artistName
            : typeof item.artist === 'string'
              ? item.artist
              : 'Unknown',
        title:
          typeof item.trackName === 'string'
            ? item.trackName
            : typeof item.name === 'string'
              ? item.name
              : 'Unknown',
        plainLyrics:
          typeof item.plainLyrics === 'string' ? item.plainLyrics : undefined,
        syncedLyrics:
          typeof item.syncedLyrics === 'string' ? item.syncedLyrics : undefined,
      }))
  } catch (error) {
    console.error(`[Lyrics Service] Search API error:`, error)
    return []
  }
}

// ── Text Parsing ─────────────────────────────────────────────

export function parseTextLyrics(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
}

// ── LRC Parsing ──────────────────────────────────────────────

const LRC_LINE_RE = /^\[(\d{1,3}):(\d{2})(?:[.:](\d{2,3}))?\](.*)/

export function parseLrcFile(content: string): LrcLine[] {
  const lines: LrcLine[] = []

  for (const raw of content.split('\n')) {
    const match = raw.match(LRC_LINE_RE)
    if (!match) continue

    const mins = parseInt(match[1], 10)
    const secs = parseInt(match[2], 10)
    let ms = 0
    if (match[3]) {
      ms = parseInt(match[3], 10)
      if (match[3].length === 2) ms *= 10
    }

    const time = mins * 60 + secs + ms / 1000
    const text = match[4].trim()
    if (text) {
      lines.push({ time, text })
    }
  }

  return lines.sort((a, b) => a.time - b.time)
}

/** Per-word timings extracted from an LRC line. */
export interface LrcWordTimings {
  words: string[]
  wordTimes: number[] // start time (seconds) for each word
}

/** Regex that matches a single LRC timestamp anywhere in text. */
const LRC_TS_GLOBAL = /\[(\d{1,3}):(\d{2})(?:[.:](\d{2,3}))?\]/g

/**
 * Parse word-level timestamps from LRC line text.
 *
 * Standard LRC: `[00:12.00]First line of text`
 *   → words: ["First","line","of","text"], no per-word timings → returns null
 *
 * Word-level LRC: `[00:22.00]First [00:22.35]word [00:22.70]here`
 *   → `parseLrcFile` already captured the *first* timestamp as the line start
 *   time, so `text` is `"First [00:22.35]word [00:22.70]here"`.
 *   This function extracts the remaining timestamps from within the text.
 *
 * Returns null when there are no embedded timestamps (plain line).
 */
export function parseLrcWordTimings(
  text: string,
  lineStartTime: number,
): LrcWordTimings | null {
  // Collect all embedded timestamps
  const times: number[] = []
  const re = new RegExp(LRC_TS_GLOBAL)
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    const mins = parseInt(m[1], 10)
    const secs = parseInt(m[2], 10)
    let ms = 0
    if (m[3]) {
      ms = parseInt(m[3], 10)
      if (m[3].length === 2) ms *= 10
    }
    times.push(mins * 60 + secs + ms / 1000)
  }

  if (times.length === 0) return null

  // Split text on timestamps to isolate word groups
  const parts = text.split(LRC_TS_GLOBAL).filter((s) => s.trim().length > 0)
  if (parts.length === 0) return null

  // First word starts at lineStartTime, subsequent at each embedded timestamp
  const words: string[] = []
  const wordTimes: number[] = []
  for (let i = 0; i < parts.length; i++) {
    const chunk = parts[i].trim()
    const chunkWords = chunk.split(/\s+/).filter((w) => w.length > 0)
    if (chunkWords.length === 0) continue
    // First chunk may contain multiple words (before the first embedded timestamp)
    if (i === 0) {
      // All words in first chunk share the line start time
      for (const w of chunkWords) {
        words.push(w)
        wordTimes.push(lineStartTime)
      }
    } else {
      // Subsequent chunks: first word gets the timestamp, remaining words are
      // distributed between this timestamp and the next (or end of known times)
      for (let j = 0; j < chunkWords.length; j++) {
        words.push(chunkWords[j])
        if (j === 0 && i - 1 < times.length) {
          wordTimes.push(times[i - 1])
        } else {
          // Fallback: interpolate within the chunk
          const t0 = i - 1 < times.length ? times[i - 1] : lineStartTime
          const t1 =
            i < times.length
              ? times[i]
              : t0 + chunkWords.length * 0.3
          const frac = j / chunkWords.length
          wordTimes.push(t0 + frac * (t1 - t0))
        }
      }
    }
  }

  return words.length > 0 ? { words, wordTimes } : null
}

// ── Line Syncing ─────────────────────────────────────────────

export function getCurrentLineIndex(
  totalLines: number,
  elapsed: number,
  totalDuration: number,
): number {
  if (totalLines === 0 || totalDuration <= 0) return -1
  const progress = elapsed / totalDuration
  return Math.min(Math.floor(progress * totalLines), totalLines - 1)
}

export function getCurrentLrcIndex(lines: LrcLine[], elapsed: number): number {
  let idx = -1
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].time <= elapsed) idx = i
    else break
  }
  return idx
}
