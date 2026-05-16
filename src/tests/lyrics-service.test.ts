// ============================================================
// Lyrics Service Tests — EARS REQ-UV-028 through REQ-UV-033
// ============================================================

import { describe, expect, it, vi } from 'vitest'
import type { LrcLine } from '@/lib/lyrics-service'
import { computeActiveWord, extractTitle, fetchLyricsById, getCurrentLineIndex, getCurrentLrcIndex, parseArtistTitle, parseLrcFile, parseLrcWordTimings, parseTextLyrics, searchLyrics, searchLyricsMulti, } from '@/lib/lyrics-service'

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

// ── parseLrcWordTimings — Embedded Timestamp Extraction ─────────

describe('parseLrcWordTimings', () => {
  it('returns null for plain text with no embedded timestamps', () => {
    expect(parseLrcWordTimings('First line of text', 10)).toBeNull()
    expect(parseLrcWordTimings('Another line here', 0)).toBeNull()
  })

  it('extracts per-word timings from word-level LRC text', () => {
    // Input: parseLrcFile captures [00:22.00] as line start time,
    // remaining embedded timestamps stay in the text.
    const text = 'First [00:22.35]word [00:22.70]here'
    const result = parseLrcWordTimings(text, 22.0)
    expect(result).not.toBeNull()
    expect(result!.words).toEqual(['First', 'word', 'here'])
    // First word starts at lineStartTime (22.0),
    // subsequent words get their embedded timestamps
    expect(result!.wordTimes).toHaveLength(3)
    expect(result!.wordTimes[0]).toBe(22.0)  // First word at line start
    expect(result!.wordTimes[1]).toBe(22.35) // "word" timestamp
    expect(result!.wordTimes[2]).toBe(22.7)  // "here" timestamp
  })

  it('handles multiple words before first embedded timestamp', () => {
    // "Como esta amigo" all come before the next timestamp
    const text = 'Como esta [00:10.29]amigo'
    const result = parseLrcWordTimings(text, 7.3)
    expect(result).not.toBeNull()
    expect(result!.words).toEqual(['Como', 'esta', 'amigo'])
    // First two words share the line start time
    expect(result!.wordTimes[0]).toBe(7.3)
    expect(result!.wordTimes[1]).toBe(7.3)
    expect(result!.wordTimes[2]).toBe(10.29)
  })

  it('handles LRC text from the Iron Maiden test file', () => {
    // Line 1: "Como [00:08.77]esta [00:10.29]amigo"
    const text1 = 'Como [00:08.77]esta [00:10.29]amigo'
    const result1 = parseLrcWordTimings(text1, 7.3)
    expect(result1).not.toBeNull()
    expect(result1!.words).toEqual(['Como', 'esta', 'amigo'])
    expect(result1!.wordTimes).toEqual([7.3, 8.77, 10.29])

    // Line 22: "Amigos [02:32.00]no [02:32.37]more [02:32.99]tears"
    const text22 = 'Amigos [02:32.00]no [02:32.37]more [02:32.99]tears'
    const result22 = parseLrcWordTimings(text22, 150.6) // 02:30.60
    expect(result22).not.toBeNull()
    expect(result22!.words).toEqual(['Amigos', 'no', 'more', 'tears'])
    expect(result22!.wordTimes[0]).toBe(150.6)
    expect(result22!.wordTimes[1]).toBe(152.0)  // 02:32.00
    expect(result22!.wordTimes[2]).toBe(152.37) // 02:32.37
    expect(result22!.wordTimes[3]).toBe(152.99) // 02:32.99
  })

  it('returns null when text has timestamps but no actual words', () => {
    expect(parseLrcWordTimings('[00:05.00][00:10.00]', 0)).toBeNull()
  })

  it('handles 3-digit milliseconds', () => {
    const text = 'Start [00:05.123]word'
    const result = parseLrcWordTimings(text, 0.0)
    expect(result).not.toBeNull()
    expect(result!.wordTimes[1]).toBeCloseTo(5.123, 3)
  })

  it('handles timestamps with colon separator (MM:SS:xx)', () => {
    const text = 'First [01:30:50]second'
    const result = parseLrcWordTimings(text, 5.0)
    expect(result).not.toBeNull()
    // 1*60 + 30 + 0.5 = 90.5
    expect(result!.wordTimes[1]).toBeCloseTo(90.5, 1)
  })
})

// ── computeActiveWord — Per-Word Timing Interpolation ───────────

describe('computeActiveWord — per-word timings', () => {
  const words = ['Amigos', 'no', 'more', 'tears']
  const wordTimes = [150.6, 152.0, 152.37, 152.99]
  const startTime = 150.6
  const endTime = 237.26 // next line at 03:57.26 (~87s gap)

  it('returns no active word before first word timestamp', () => {
    const result = computeActiveWord(words, startTime, endTime, wordTimes, 149.0)
    expect(result.activeUpTo).toBe(-1)
    expect(result.charProgress).toBe(0)
  })

  it('highlights first word at its start time', () => {
    const result = computeActiveWord(words, startTime, endTime, wordTimes, 150.6)
    expect(result.activeUpTo).toBe(-1) // no fully-highlighted words
    // charProgress should be 0 since we're exactly at the start
    expect(result.charProgress).toBe(0)
  })

  it('partially reveals characters within first word', () => {
    // Midway through "Amigos" (duration from 150.6 to 152.0 = 1.4s)
    // At 151.3, we're 0.7s into the word = 50% progress
    const result = computeActiveWord(words, startTime, endTime, wordTimes, 151.3)
    expect(result.activeUpTo).toBe(-1) // no word fully done
    // 0.7 / 1.4 = 0.5, 0.5 * 6 chars = 3
    expect(result.charProgress).toBe(3)
  })

  it('fully highlights first word at second word boundary', () => {
    // At 152.0, "Amigos" is done, "no" begins
    const result = computeActiveWord(words, startTime, endTime, wordTimes, 152.0)
    expect(result.activeUpTo).toBe(0) // "Amigos" fully highlighted
    expect(result.charProgress).toBe(0) // "no" just started
  })

  it('highlights second word during its window', () => {
    // At 2:32.5 (152.5s), "no" (2:32.00-2:32.37) should be fully done
    const result = computeActiveWord(words, startTime, endTime, wordTimes, 152.5)
    expect(result.activeUpTo).toBe(1) // "no" fully highlighted
  })

  it('highlights third word during its window', () => {
    // At 2:32.8 (152.8s), between "more" (2:32.37) and "tears" (2:32.99)
    const result = computeActiveWord(words, startTime, endTime, wordTimes, 152.8)
    // wordIdx=2 ("more"), activeUpTo=1 ("Amigos" and "no" fully done)
    expect(result.activeUpTo).toBe(1)
  })

  it('highlights all words after the last word timestamp', () => {
    // After 2:32.99, the last word "tears" is estimated to end at
    // 152.99 + avgGap(0.80) = 153.79. At 160s all words are fully done.
    const result = computeActiveWord(words, startTime, endTime, wordTimes, 160.0)
    expect(result.activeUpTo).toBe(3)
    expect(result.charProgress).toBe(5)
  })

  it('does NOT stretch highlighting to next line — uses word boundaries', () => {
    // KEY TEST: At 2:31.8 (151.8s), which is between "Amigos" (150.6) and "no" (152.0)
    // With even-division, this would be stretched across 87 seconds (to 237.26)
    // With per-word timing, "Amigos" should still be the active word
    const result = computeActiveWord(words, startTime, endTime, wordTimes, 151.8)
    // activeUpTo = -1 (Amigos not fully done yet)
    expect(result.activeUpTo).toBe(-1)
    // charProgress should be through most of "Amigos"
    // elapsed 1.2s into Amigos's 1.4s window, 1.2/1.4 * 6 ≈ 5 chars
    expect(result.charProgress).toBeGreaterThanOrEqual(4)
  })

  it('interpolates within first word when elapsed is between first and second word times', () => {
    // Checking that word highlighting happens between word boundaries,
    // not stretched across the line-to-next-line interval
    // At 152.7 (between "more" at 152.37 and "tears" at 152.99)
    const result = computeActiveWord(words, startTime, endTime, wordTimes, 152.7)
    // "Amigos" and "no" should be fully done (activeUpTo = 1)
    // "more" should be partially revealed
    expect(result.activeUpTo).toBe(1) // first 2 words fully highlighted
    expect(result.charProgress).toBeGreaterThan(0)
  })
})

// ── computeActiveWord — Even-Division Fallback ──────────────────

describe('computeActiveWord — fallback even-division', () => {
  const words = ['First', 'line', 'of', 'lyrics']
  const startTime = 10.0
  const endTime = 14.0 // 4-second line

  it('returns -1 before line start', () => {
    const result = computeActiveWord(words, startTime, endTime, undefined, 5.0)
    expect(result.activeUpTo).toBe(-1)
  })

  it('evenly divides duration among words', () => {
    // 4 words ("First","line","of","lyrics") over 4 seconds = 1s per word
    const result = computeActiveWord(words, startTime, endTime, undefined, 11.5)
    // 1.5s into the line: wordIndex = floor(0.375*4) = 1 ("line")
    // activeUpTo = 0 ("First" fully done)
    expect(result.activeUpTo).toBe(0)
    // 0.5s into "line" (4 chars): 0.5/1 * 4 = 2 chars revealed
    expect(result.charProgress).toBe(2)
  })

  it('returns all words highlighted after line end', () => {
    const result = computeActiveWord(words, startTime, endTime, undefined, 20.0)
    expect(result.activeUpTo).toBe(3)
    expect(result.charProgress).toBe(6) // "lyrics" full
  })

  it('handles single word', () => {
    const result = computeActiveWord(['solo'], 0, 2, undefined, 1.0)
    expect(result.activeUpTo).toBe(-1)
    expect(result.charProgress).toBe(2) // halfway through "solo" = 2 chars
  })
})

// ── computeActiveWord — Edge Cases ──────────────────────────────

describe('computeActiveWord — edge cases', () => {
  it('returns -1 for empty words array', () => {
    const result = computeActiveWord([], 0, 10, undefined, 5)
    expect(result.activeUpTo).toBe(-1)
    expect(result.charProgress).toBe(0)
  })

  it('handles elapsed before start when per-word timings provided', () => {
    const result = computeActiveWord(
      ['a', 'b'],
      10,
      20,
      [10, 15],
      5,
    )
    expect(result.activeUpTo).toBe(-1)
    expect(result.charProgress).toBe(0)
  })

  it('handles exact word boundary (elapsed === word time)', () => {
    const result = computeActiveWord(
      ['hello', 'world'],
      0,
      10,
      [0, 5],
      5,
    )
    expect(result.activeUpTo).toBe(0) // "hello" fully done
    expect(result.charProgress).toBe(0) // "world" just starting
  })

  it('handles wordTimes length mismatch (falls back to even division)', () => {
    // words.length=3 but wordTimes.length=2 → fallback path
    const result = computeActiveWord(
      ['one', 'two', 'three'],
      0,
      9,
      [0, 3], // mismatched!
      4.5, // halfway through 0-9
    )
    // Even-division: 3s per word. At 4.5s, index = floor(4.5/3) = 1
    expect(result.activeUpTo).toBe(0) // "one" done
    expect(result.charProgress).toBe(1) // halfway into "two" (3 chars / 3s = 0.5 → 1 char)
  })

  it('handles wordTimes present but empty', () => {
    const result = computeActiveWord(['a', 'b'], 0, 2, [], 1)
    // [] !== undefined, but length 0 !== words.length 2 → fallback
    expect(result.activeUpTo).toBe(0) // 50% into line
  })
})

// ── parseLrcWordTimings + computeActiveWord Integration ─────────
// Simulates the full pipeline from LRC text through word parsing
// to active-word determination at specific elapsed times.

describe('LRC word timing integration — Iron Maiden scenario', () => {
  // Simulate parseLrcFile output for the two lines with ~87s gap
  const lrcLines: LrcLine[] = [
    { time: 150.6, text: 'Amigos [02:32.00]no [02:32.37]more [02:32.99]tears' },
    { time: 237.26, text: 'Inside [03:57.79]the [03:58.89]scream [03:59.60]is [04:00.25]silence' },
  ]

  // Build the stableParsedLyrics-equivalent map
  function buildMap(lines: LrcLine[], duration: number) {
    const REST_THRESHOLD = 20
    const result: { time: number; text: string }[] = []
    lines.forEach((line, i) => {
      const gap = i > 0 ? line.time - lines[i - 1].time : 0
      if (gap > REST_THRESHOLD) {
        result.push({ time: lines[i - 1].time + gap / 2, text: '~Rest~' })
      }
      result.push({ time: line.time, text: line.text })
    })

    const map = new Map<number, {
      time: number; endTime: number; words: string[]; key: string; wordTimes?: number[]
    }>()

    result.forEach((item, i) => {
      const endTime = i + 1 < result.length ? result[i + 1].time : duration
      const wt = parseLrcWordTimings(item.text, item.time)
      const words = wt ? wt.words : item.text.split(/\s+/).filter((w) => w.length > 0)
      map.set(i, {
        key: `lrc-${i}`,
        time: item.time,
        endTime,
        words,
        wordTimes: wt?.wordTimes,
      })
    })
    return map
  }

  const duration = 300 // 5 minutes
  const map = buildMap(lrcLines, duration)

  it('inserts ~Rest~ for gap > 20 seconds', () => {
    // Order: index 0 = Amigos (150.6), index 1 = ~Rest~ (193.93), index 2 = Inside (237.26)
    expect(map.get(0)!.words).toEqual(['Amigos', 'no', 'more', 'tears'])
    expect(map.get(1)!.words).toEqual(['~Rest~'])
    expect(map.get(1)!.time).toBeCloseTo(150.6 + (237.26 - 150.6) / 2, 0)
    expect(map.get(2)!.words).toEqual(['Inside', 'the', 'scream', 'is', 'silence'])
  })

  it('uses clean words from parseLrcWordTimings (no timestamp brackets)', () => {
    const amigosLine = map.get(0)!
    // words must NOT contain "[02:32.00]" etc.
    expect(amigosLine.words).not.toContain('[02:32.00]')
    expect(amigosLine.words).toEqual(['Amigos', 'no', 'more', 'tears'])
    // wordTimes length must match words length for per-word path
    expect(amigosLine.wordTimes).toHaveLength(amigosLine.words.length)
  })

  it('at 2:32.5 (152.5s), "no" is the active word, NOT stretched from 2:30', () => {
    // This is the critical bug test: at elapsed 152.5s,
    // the user should see "Amigos" fully highlighted and "no" being revealed.
    // Before the fix, the highlighting stretched evenly across 87 seconds.
    const line = map.get(0)! // Amigos line — index 0
    const result = computeActiveWord(
      line.words,
      line.time,
      line.endTime,
      line.wordTimes,
      152.5,
    )
    // "no" is fully done (it's at 152.0-152.37, and we're past 152.37)
    // "more" is partially done
    expect(result.activeUpTo).toBeGreaterThanOrEqual(1)
  })

  it('at 2:31.0 (151.0s), first word "Amigos" is partially revealed', () => {
    const line = map.get(0)!
    const result = computeActiveWord(
      line.words,
      line.time,
      line.endTime,
      line.wordTimes,
      151.0,
    )
    // Still within "Amigos" (150.6 to 152.0)
    expect(result.activeUpTo).toBe(-1)
  })

  it('at 2:40 (160s), all 4 words of the line are fully highlighted', () => {
    const line = map.get(0)!
    const result = computeActiveWord(
      line.words,
      line.time,
      line.endTime,
      line.wordTimes,
      160,
    )
    expect(result.activeUpTo).toBe(3)
    expect(result.charProgress).toBe(5) // "tears" = 5 chars
  })

  it('~Rest~ line has no per-word timings (falls back to even division)', () => {
    const restLine = map.get(1)! // ~Rest~ is at index 1
    expect(restLine.wordTimes).toBeUndefined()
    expect(restLine.words).toEqual(['~Rest~'])
  })

  it('at ~Rest~ midpoint, the rest word is partially revealed', () => {
    const restLine = map.get(1)! // ~Rest~ at index 1, time ~193.93, endTime ~237.26
    const result = computeActiveWord(
      restLine.words,
      restLine.time,
      restLine.endTime,
      restLine.wordTimes,
      restLine.time + (restLine.endTime - restLine.time) / 2,
    )
    // At midpoint of rest line, should be partially revealed
    expect(result.activeUpTo).toBe(-1)
    expect(result.charProgress).toBeGreaterThan(0)
  })
})

// ── Text lyrics: no per-word timings ────────────────────────────

describe('LRC word timing — no per-word timings (text lyrics)', () => {
  it('even-division is used when lines have no embedded timestamps', () => {
    const words = ['Shall', 'we', 'kneel', 'and', 'say', 'a', 'prayer']
    const startTime = 25.18
    const endTime = 31.13 // next line

    // At halfway point (28.155), should be roughly halfway through words
    const result = computeActiveWord(words, startTime, endTime, undefined, 28.155)
    // 4 words * 0.5 = floor(3.5) = index 3, activeUpTo = 2
    expect(result.activeUpTo).toBe(2)
  })
})

// ── parseLrcFile with per-word timings ──────────────────────────

describe('parseLrcFile preserves embedded timestamps for word-level parsing', () => {
  it('keeps embedded timestamps in text for later word-level parsing', () => {
    const content = '[02:30.60]Amigos [02:32.00]no [02:32.37]more [02:32.99]tears'
    const result = parseLrcFile(content)
    expect(result).toHaveLength(1)
    // First timestamp extracted as line time
    expect(result[0].time).toBe(150.6)
    // Remaining timestamps stay in text for parseLrcWordTimings to handle
    expect(result[0].text).toBe('Amigos [02:32.00]no [02:32.37]more [02:32.99]tears')
  })

  it('sorts multiple per-word lines correctly', () => {
    const content = `[04:12.83]Only [04:13.28]horror, [04:13.95]only [04:14.38]pain
[03:57.26]Inside [03:57.79]the [03:58.89]scream [03:59.60]is [04:00.25]silence`
    const result = parseLrcFile(content)
    expect(result).toHaveLength(2)
    expect(result[0].time).toBe(237.26) // 03:57.26
    expect(result[1].time).toBe(252.83) // 04:12.83
  })
})
