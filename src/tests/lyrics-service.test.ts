// ============================================================
// Lyrics Service Tests — EARS REQ-UV-028 through REQ-UV-033
// ============================================================

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  extractTitle,
  parseArtistTitle,
  parseTextLyrics,
  parseLrcFile,
  getCurrentLineIndex,
  getCurrentLrcIndex,
} from '@/lib/lyrics-service'
import type { LrcLine } from '@/lib/lyrics-service'

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
