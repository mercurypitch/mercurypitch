// ============================================================
// Lyrics Service — fetch, parse, and sync lyrics
// ============================================================

export interface LrcLine {
  time: number       // seconds
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
    .replace(/\s*\(.*?(instrumental|acoustic|remix|live|cover|karoake).*?\)\s*$/i, '')
    .replace(/\s*[-–—]\s*(instrumental|acoustic|remix|live|cover)\s*$/i, '')
    .trim()

  return title || 'Unknown'
}

/**
 * Parse "Artist - Title" from a cleaned filename string.
 * Returns { artist, title } with best-guess extraction.
 */
export function parseArtistTitle(input: string): { artist: string; title: string } {
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

export async function searchLyrics(rawInput: string): Promise<string | null> {
  const { artist, title } = parseArtistTitle(rawInput)

  // Build candidate queries ordered by likely success
  const queries: { artist: string; title: string }[] = []

  if (artist && title) {
    queries.push({ artist, title })
    queries.push({ artist, title: title.replace(/\s*\(.*?\)\s*/g, '').trim() }) // strip parens
  }
  queries.push({ artist: '', title })
  queries.push({ artist: '', title: title.replace(/\s*\(.*?\)\s*/g, '').trim() })

  // Try Lyrics.ovh first
  for (const q of queries) {
    try {
      const lyrics = await fetchLyricsOvh(q.artist, q.title)
      if (lyrics) return lyrics
    } catch {
      // continue
    }
  }

  // Fallback: try lyrics.astrid.sh (also free, no auth)
  for (const q of queries.slice(0, 2)) {
    try {
      const lyrics = await fetchLyricsAstrid(q.artist, q.title)
      if (lyrics) return lyrics
    } catch {
      // continue
    }
  }

  return null
}

async function fetchLyricsOvh(artist: string, title: string): Promise<string | null> {
  const artistParam = artist ? `${encodeURIComponent(artist)}/` : ''
  const url = `https://api.lyrics.ovh/v1/${artistParam}${encodeURIComponent(title)}`

  const resp = await fetch(url, { signal: AbortSignal.timeout(5000) })
  if (!resp.ok) return null

  const data = await resp.json()
  if (data?.lyrics && typeof data.lyrics === 'string' && data.lyrics.length > 10) {
    return data.lyrics
  }
  return null
}

async function fetchLyricsAstrid(artist: string, title: string): Promise<string | null> {
  const params = new URLSearchParams()
  if (artist) params.set('artist', artist)
  params.set('title', title)

  const url = `https://lyrics.astrid.sh/api/lyrics?${params.toString()}`
  const resp = await fetch(url, { signal: AbortSignal.timeout(5000) })
  if (!resp.ok) return null

  const data = await resp.json()
  if (data?.lyrics && typeof data.lyrics === 'string' && data.lyrics.length > 10) {
    return data.lyrics
  }
  return null
}

// ── Text Parsing ─────────────────────────────────────────────

export function parseTextLyrics(text: string): string[] {
  return text
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
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

export function getCurrentLrcIndex(
  lines: LrcLine[],
  elapsed: number,
): number {
  let idx = -1
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].time <= elapsed) idx = i
    else break
  }
  return idx
}
