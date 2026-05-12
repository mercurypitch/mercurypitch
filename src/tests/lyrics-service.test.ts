// ============================================================
// Lyrics Service Tests — EARS REQ-UV-028 through REQ-UV-033
// ============================================================

import { describe, expect, it, vi } from 'vitest'
import type { LrcLine } from '@/lib/lyrics-service'
import { extractTitle, fetchLyricsById, getCurrentLineIndex, getCurrentLrcIndex, parseArtistTitle, parseLrcFile, parseTextLyrics, searchLyrics, searchLyricsMulti, } from '@/lib/lyrics-service'

// ── REQ-UV-029: LRC Parsing ──────────────────────────────────

describe('LRC Parsing (REQ-UV-029)', () => {
  it('parses standard LRC format [mm:ss.xx]', () => {
    const content = `[00:12.34]First line of lyrics
[00:25.67]Second line here
[01:05.00]Third line`

    const result = parseLrcFile(content)
    expect(result).toHaveLength(3)
    expect(result[0]).toEqual({ time: 12.34, text: 'First line of lyrics' })
    expect(result[1]).toEqual({ time: 25.67, text: 'Second line here' })
    expect(result[2]).toEqual({ time: 65.0, text: 'Third line' })
  })

  it('parses lines sorted by time regardless of input order', () => {
    const content = `[00:30.00]Middle
[00:10.00]First
[00:20.00]Second`

    const result = parseLrcFile(content)
    expect(result.map((l) => l.text)).toEqual(['First', 'Second', 'Middle'])
    expect(result.map((l) => l.time)).toEqual([10, 20, 30])
  })

  it('skips empty text lines', () => {
    const content = `[00:10.00]Real line
[00:20.00]
[00:30.00]Another real line`

    const result = parseLrcFile(content)
    expect(result).toHaveLength(2)
    expect(result[0].text).toBe('Real line')
    expect(result[1].text).toBe('Another real line')
  })

  it('skips non-LRC lines (no timestamp)', () => {
    const content = `[ti:Song Title]
[ar:Artist Name]
[00:10.00]First real line`

    const result = parseLrcFile(content)
    expect(result).toHaveLength(1)
    expect(result[0].text).toBe('First real line')
  })

  it('handles timestamps without milliseconds', () => {
    const content = `[01:30]No milliseconds line`

    const result = parseLrcFile(content)
    expect(result).toHaveLength(1)
    expect(result[0].time).toBe(90)
    expect(result[0].text).toBe('No milliseconds line')
  })

  it('handles 3-digit milliseconds', () => {
    const content = `[00:05.123]Three-digit ms`

    const result = parseLrcFile(content)
    expect(result).toHaveLength(1)
    expect(result[0].time).toBe(5.123)
  })

  it('returns empty array for empty input', () => {
    expect(parseLrcFile('')).toEqual([])
    expect(parseLrcFile('\n\n\n')).toEqual([])
  })
})

// ── REQ-UV-030: Plain Text Parsing ───────────────────────────

describe('Plain Text Parsing (REQ-UV-030)', () => {
  it('splits text into lines', () => {
    const text = `Line one
Line two
Line three`

    const result = parseTextLyrics(text)
    expect(result).toEqual(['Line one', 'Line two', 'Line three'])
  })

  it('trims whitespace from each line', () => {
    const text = `  Line one
  Line two  `

    const result = parseTextLyrics(text)
    expect(result).toEqual(['Line one', 'Line two'])
  })

  it('filters out empty lines', () => {
    const text = `Line one

Line two

Line three
`

    const result = parseTextLyrics(text)
    expect(result).toEqual(['Line one', 'Line two', 'Line three'])
  })

  it('handles single line', () => {
    expect(parseTextLyrics('Only one line')).toEqual(['Only one line'])
  })

  it('returns empty array for empty input', () => {
    expect(parseTextLyrics('')).toEqual([])
  })
})

// ── Title Extraction ─────────────────────────────────────────

describe('Title Extraction', () => {
  it('removes file extension', () => {
    expect(extractTitle('My Song.mp3')).toBe('My Song')
    expect(extractTitle('song.wav')).toBe('song')
  })

  it('removes "Official Video" suffixes', () => {
    expect(extractTitle('My Song - Official Video')).toBe('My Song')
    expect(extractTitle('My Song - Official Music Video')).toBe('My Song')
    expect(extractTitle('My Song (Official Video)')).toBe('My Song')
    expect(extractTitle('My Song (Official Audio)')).toBe('My Song')
  })

  it('removes "Lyrics" suffixes', () => {
    expect(extractTitle('My Song - Lyrics')).toBe('My Song')
    expect(extractTitle('My Song (Lyrics)')).toBe('My Song')
    expect(extractTitle('My Song - Official Lyric Video')).toBe('My Song')
  })

  it('removes version suffixes', () => {
    expect(extractTitle('My Song - Instrumental')).toBe('My Song')
    expect(extractTitle('My Song - Acoustic')).toBe('My Song')
    expect(extractTitle('My Song (Remix)')).toBe('My Song')
    expect(extractTitle('My Song - Live')).toBe('My Song')
    expect(extractTitle('My Song (Cover)')).toBe('My Song')
    expect(extractTitle('My Song (Karoake)')).toBe('My Song')
  })

  it('returns "Unknown" for empty input', () => {
    expect(extractTitle('')).toBe('Unknown')
  })

  it('handles title with no recognized patterns', () => {
    expect(extractTitle('My Song')).toBe('My Song')
  })
})

// ── Artist/Title Parsing ─────────────────────────────────────

describe('Artist/Title Parsing', () => {
  it('parses "Artist - Title" pattern', () => {
    const result = parseArtistTitle('Artist Name - Song Title')
    expect(result.artist).toBe('Artist Name')
    expect(result.title).toBe('Song Title')
  })

  it('parses "Title by Artist" pattern', () => {
    const result = parseArtistTitle('Song Title by Artist Name')
    expect(result.artist).toBe('Artist Name')
    expect(result.title).toBe('Song Title')
  })

  it('returns empty artist when no separator', () => {
    const result = parseArtistTitle('JustASong')
    expect(result.artist).toBe('')
    expect(result.title).toBe('JustASong')
  })

  it('handles en-dash and em-dash separators', () => {
    const enDash = parseArtistTitle('Artist – Title')
    expect(enDash.artist).toBe('Artist')
    expect(enDash.title).toBe('Title')

    const emDash = parseArtistTitle('Artist — Title')
    expect(emDash.artist).toBe('Artist')
    expect(emDash.title).toBe('Title')
  })
})

// ── REQ-UV-033: Line Syncing ─────────────────────────────────

describe('Line Syncing (REQ-UV-032, REQ-UV-033)', () => {
  it('getCurrentLineIndex returns -1 for empty lyrics', () => {
    expect(getCurrentLineIndex(0, 10, 60)).toBe(-1)
  })

  it('getCurrentLineIndex returns -1 for zero duration', () => {
    expect(getCurrentLineIndex(50, 10, 0)).toBe(-1)
  })

  it('getCurrentLineIndex returns correct index based on progress', () => {
    // 100 lines, 60s duration, 30s elapsed = 50% → Math.floor(0.5 * 100) = 50
    expect(getCurrentLineIndex(100, 30, 60)).toBe(50)
  })

  it('getCurrentLineIndex clamps to last index', () => {
    // 10 lines, elapsed past end
    expect(getCurrentLineIndex(10, 100, 60)).toBe(9)
  })

  it('getCurrentLineIndex returns 0 at start', () => {
    expect(getCurrentLineIndex(10, 0, 60)).toBe(0)
  })

  it('getCurrentLrcIndex returns -1 for empty LRC', () => {
    expect(getCurrentLrcIndex([], 10)).toBe(-1)
  })

  it('getCurrentLrcIndex returns -1 before first line', () => {
    const lines: LrcLine[] = [
      { time: 5, text: 'First' },
      { time: 10, text: 'Second' },
    ]
    expect(getCurrentLrcIndex(lines, 2)).toBe(-1)
  })

  it('getCurrentLrcIndex returns correct index for elapsed time', () => {
    const lines: LrcLine[] = [
      { time: 5, text: 'First' },
      { time: 10, text: 'Second' },
      { time: 15, text: 'Third' },
    ]
    expect(getCurrentLrcIndex(lines, 7)).toBe(0) // between 5-10
    expect(getCurrentLrcIndex(lines, 12)).toBe(1) // between 10-15
    expect(getCurrentLrcIndex(lines, 20)).toBe(2) // after all lines
  })

  it('getCurrentLrcIndex returns exact boundary', () => {
    const lines: LrcLine[] = [{ time: 10, text: 'Exact' }]
    expect(getCurrentLrcIndex(lines, 10)).toBe(0)
  })
})

// ── REQ-UV-005, REQ-UV-006: Lyrics API Fetching ─────────────

describe('searchLyrics', () => {
  it('returns LRC format when LRCLIB returns synced lyrics', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          syncedLyrics:
            '[00:10.00]First line\n[00:20.00]Second line\n[00:30.00]Third\n',
          plainLyrics: 'First line\nSecond line\nThird\n',
        }),
    } as Response)

    const result = await searchLyrics('Test Artist - Test Song')
    expect(result).not.toBeNull()
    expect(result!.format).toBe('lrc')
    expect(result!.text).toContain('[00:10.00]')
    expect(result!.text).toContain('First line')
  })

  it('returns null when all APIs fail', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 404,
      json: () => Promise.resolve({}),
    } as Response)

    const result = await searchLyrics('Nonexistent Artist - Nonexistent Song')
    expect(result).toBeNull()
  })

  it('returns null when lyrics text is too short', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ plainLyrics: 'short' }),
    } as Response)

    const result = await searchLyrics('Test')
    expect(result).toBeNull()
  })
})

// ── searchLyricsMulti ──────────────────────────────────────────

describe('searchLyricsMulti', () => {
  it('returns deduplicated results from LRCLIB search', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve([
          {
            id: 1,
            artistName: 'Artist A',
            trackName: 'Song A',
            syncedLyrics: '[00:05.00]Line 1',
          },
          {
            id: 2,
            artistName: 'Artist B',
            trackName: 'Song B',
            plainLyrics: 'Plain text',
          },
        ]),
    } as Response)

    const results = await searchLyricsMulti('Artist A - Song A')
    expect(results).toHaveLength(2)
    expect(results[0].id).toBe(1)
    expect(results[0].artist).toBe('Artist A')
    expect(results[0].title).toBe('Song A')
    expect(results[0].syncedLyrics).toBe('[00:05.00]Line 1')
    expect(results[1].id).toBe(2)
    expect(results[1].plainLyrics).toBe('Plain text')
  })

  it('deduplicates results by ID across multiple queries', async () => {
    // Same ID returned from both queries
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve([{ id: 1, artistName: 'Artist', trackName: 'Song' }]),
    } as Response)

    const results = await searchLyricsMulti('Artist - Song')
    // Only one unique result despite multiple queries
    expect(results).toHaveLength(1)
    expect(results[0].id).toBe(1)
  })

  it('caps results at 20', async () => {
    const allResults = Array.from({ length: 25 }, (_, i) => ({
      id: i + 1,
      artistName: `Artist ${i}`,
      trackName: `Song ${i}`,
    }))

    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(allResults),
    } as Response)

    const results = await searchLyricsMulti('Song')
    expect(results.length).toBeLessThanOrEqual(20)
  })

  it('returns empty array when search fails', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('Network error'))

    const results = await searchLyricsMulti('Nonexistent Song')
    expect(results).toEqual([])
  })

  it('returns empty array for non-ok response', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({}),
    } as Response)

    const results = await searchLyricsMulti('Test Song')
    expect(results).toEqual([])
  })

  it('handles non-array API response gracefully', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ error: 'invalid' }),
    } as Response)

    const results = await searchLyricsMulti('Test')
    expect(results).toEqual([])
  })

  it('uses artistName/trackName fields from LRCLIB response', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve([
          {
            id: 42,
            artistName: 'The Beatles',
            trackName: 'Yesterday',
            syncedLyrics: '[00:10.00]Yesterday',
          },
        ]),
    } as Response)

    const results = await searchLyricsMulti('The Beatles - Yesterday')
    expect(results).toHaveLength(1)
    expect(results[0].artist).toBe('The Beatles')
    expect(results[0].title).toBe('Yesterday')
    expect(results[0].syncedLyrics).toBe('[00:10.00]Yesterday')
  })

  it('filters out items without numeric ID', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve([
          { artistName: 'No ID', trackName: 'Bad' },
          { id: 1, artistName: 'Has ID', trackName: 'Good' },
          { id: 'string-id', artistName: 'String ID', trackName: 'Bad' },
        ]),
    } as Response)

    const results = await searchLyricsMulti('Test')
    expect(results).toHaveLength(1)
    expect(results[0].id).toBe(1)
  })

  it('tries multiple query variants (with and without artist)', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve([]),
    } as Response)

    await searchLyricsMulti('Artist - Title (Remix)')

    const urls = fetchSpy.mock.calls.map((c) => String(c[0]))
    // Should try: artist+title, artist+cleaned title, title-only, cleaned title-only
    expect(urls.length).toBeGreaterThanOrEqual(1)
    // At least one should contain track_name
    expect(urls.some((u) => u.includes('track_name='))).toBe(true)
  })
})

// ── fetchLyricsById ────────────────────────────────────────────

describe('fetchLyricsById', () => {
  it('returns LRC format when syncedLyrics available', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          id: 123,
          syncedLyrics:
            '[00:05.00]Line one\n[00:10.00]Line two\n[00:15.00]Line three\n',
          plainLyrics: 'Line one\nLine two\nLine three\n',
        }),
    } as Response)

    const result = await fetchLyricsById(123)
    expect(result).not.toBeNull()
    expect(result!.format).toBe('lrc')
    expect(result!.text).toContain('[00:05.00]')
  })

  it('falls back to plain lyrics when no synced lyrics', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          id: 456,
          plainLyrics: 'Plain lyrics content here\nmore than 10 chars',
        }),
    } as Response)

    const result = await fetchLyricsById(456)
    expect(result).not.toBeNull()
    expect(result!.format).toBe('txt')
    expect(result!.text).toBe('Plain lyrics content here\nmore than 10 chars')
  })

  it('returns null for non-ok response', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 404,
      json: () => Promise.resolve({}),
    } as Response)

    const result = await fetchLyricsById(999)
    expect(result).toBeNull()
  })

  it('returns null when lyrics text is too short', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ plainLyrics: 'short' }),
    } as Response)

    const result = await fetchLyricsById(1)
    expect(result).toBeNull()
  })

  it('returns null on network error', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('Network error'))

    const result = await fetchLyricsById(1)
    expect(result).toBeNull()
  })

  it('fetches from correct LRCLIB endpoint', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          syncedLyrics: '[00:10.00]Test lyric line here\n',
        }),
    } as Response)

    await fetchLyricsById(789)
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://lrclib.net/api/get/789',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    )
  })
})
