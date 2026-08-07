// ============================================================
// lyricsfile 1.0 — serialisation
// ============================================================
//
// An interchange file is read by software we do not control, so the two things
// worth pinning hard are that the YAML cannot be misread and that a line's
// words reconstruct the line exactly. Everything else is bookkeeping.

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { WordSweepTimingsMap, WordTimingsMap, } from '@/features/stem-mixer/types'
import { parseLrcFile, parseLrcWordTimings } from '@/lib/lyrics-service'
import { LYRICSFILE_SWEEPS_KEY, serialiseLyricsfile, splitWithSpacing, } from '@/lib/lyricsfile'

const LINES = [
  { time: 2, text: 'hold on' },
  { time: 11, text: 'soul mate' },
]

describe('splitWithSpacing', () => {
  it('reconstructs the line exactly', () => {
    for (const line of [
      'hold on',
      '  leading space',
      'trailing space  ',
      'double  spaced   words',
      "I'll be right behind you, Josephine",
      '\ttabbed\tout\t',
    ]) {
      expect(splitWithSpacing(line).join('')).toBe(line)
    }
  })

  it('keeps the word count the timing maps are keyed by', () => {
    // Every timing map in the app indexes by split(/\s+/) position, so a
    // different count here would silently attach times to the wrong words.
    for (const line of ['a  b   c', ' a b ', 'one']) {
      expect(splitWithSpacing(line)).toHaveLength(
        line.split(/\s+/).filter((w) => w !== '').length,
      )
    }
  })

  it('yields no words for a line with nothing in it', () => {
    expect(splitWithSpacing('')).toEqual([])
    expect(splitWithSpacing('   ')).toEqual([])
  })
})

describe('serialiseLyricsfile', () => {
  it('opens with the version the spec requires', () => {
    expect(serialiseLyricsfile({ lines: LINES })).toMatch(/^version: "1\.0"\n/)
  })

  it('writes line starts as whole milliseconds', () => {
    const out = serialiseLyricsfile({ lines: [{ time: 2.345, text: 'x' }] })
    expect(out).toContain('start_ms: 2345')
  })

  it('carries the metadata enhanced LRC has no room for', () => {
    const out = serialiseLyricsfile({
      lines: LINES,
      metadata: {
        title: 'Josephine',
        artist: 'Josh Woodward',
        durationMs: 214_000,
        offsetMs: -200,
        language: 'en',
      },
    })
    expect(out).toContain('duration_ms: 214000')
    expect(out).toContain('offset_ms: -200')
    expect(out).toContain('language: "en"')
  })

  it('omits metadata entirely when there is none', () => {
    expect(serialiseLyricsfile({ lines: LINES })).not.toContain('metadata:')
  })

  it('writes word timings with the spacing intact', () => {
    const wordTimings: WordTimingsMap = { 0: [2, 6] }
    const out = serialiseLyricsfile({
      lines: [{ time: 2, text: 'hold  on' }],
      wordTimings,
    })
    // Two spaces, preserved inside the first word's text.
    expect(out).toContain('- text: "hold  "')
    expect(out).toContain('- text: "on"')
  })

  it('writes word ends and the line end they imply', () => {
    const out = serialiseLyricsfile({
      lines: [{ time: 2, text: 'hold on' }],
      wordTimings: { 0: [2, 6] },
      wordEndTimings: { 0: [5.5, 9] },
    })
    expect(out).toContain('end_ms: 9000')
    expect(out).toContain('end_ms: 5500')
  })

  it('skips a word that was never timed rather than inventing one', () => {
    // A fabricated timestamp in an interchange file is worse than a gap.
    const sparse: number[] = []
    sparse[0] = 2
    sparse[2] = 8
    const out = serialiseLyricsfile({
      lines: [{ time: 2, text: 'one two three' }],
      wordTimings: { 0: sparse },
    })
    expect(out).toContain('- text: "one "')
    expect(out).toContain('- text: "three"')
    expect(out).not.toContain('- text: "two "')
  })

  it('leaves out the words block for a line with no timings at all', () => {
    const out = serialiseLyricsfile({ lines: LINES, wordTimings: { 0: [] } })
    expect(out).not.toContain('words:')
  })

  it('carries the plain text alongside the lines', () => {
    expect(serialiseLyricsfile({ lines: LINES })).toContain(
      'plain: "hold on\\nsoul mate"',
    )
  })

  it('quotes every scalar, so lyrics cannot be misread as YAML', () => {
    // ": " opens a mapping, a leading "- " a list item, and bare `no` is a
    // boolean in YAML 1.1. All three appear in real lyrics.
    const nasty = [
      { time: 0, text: 'no' },
      { time: 1, text: '- and then: this' },
      { time: 2, text: '"quoted" and \\escaped\\' },
      { time: 3, text: 'yes # not a comment' },
    ]
    const out = serialiseLyricsfile({ lines: nasty })
    expect(out).toContain('- text: "no"')
    expect(out).toContain('- text: "- and then: this"')
    expect(out).toContain('- text: "\\"quoted\\" and \\\\escaped\\\\"')
    expect(out).toContain('- text: "yes # not a comment"')
  })

  it('parses as YAML for anything that reads the JSON subset', () => {
    // Every scalar this writes is JSON-escaped and double-quoted, which is
    // exactly the subset YAML and JSON agree on.
    const out = serialiseLyricsfile({ lines: LINES })
    for (const line of out.split('\n')) {
      const value = line.match(/: (".*")$/)?.[1]
      if (value !== undefined) expect(() => JSON.parse(value)).not.toThrow()
    }
  })
})

describe('sub-word split points', () => {
  const sweeps: WordSweepTimingsMap = {
    0: {
      1: [
        { time: 6, progress: 0 },
        { time: 6.5, progress: 0.5 },
      ],
    },
  }

  it('writes them under a namespaced key, not a top-level one', () => {
    // The 1.0 spec defines no extension mechanism, so a bare field would be
    // a fork. A reader that drops this key still has a valid file.
    const out = serialiseLyricsfile({
      lines: LINES,
      wordTimings: { 0: [2, 6] },
      wordSweepTimings: sweeps,
    })
    expect(out).toContain(`${LYRICSFILE_SWEEPS_KEY}:`)
    expect(out).toContain('- { t: 6500, p: 0.5 }')
  })

  it('writes nothing at all when nobody split a word', () => {
    expect(serialiseLyricsfile({ lines: LINES })).not.toContain(
      LYRICSFILE_SWEEPS_KEY,
    )
    expect(
      serialiseLyricsfile({ lines: LINES, wordSweepTimings: { 0: {} } }),
    ).not.toContain(LYRICSFILE_SWEEPS_KEY)
  })
})

describe('the gold corpus', () => {
  // The one file in the repo whose timings are hand-verified: 38 lines, 322
  // words, real apostrophes and commas. If serialising loses a word, this is
  // the case that shows it.
  //
  // `parseLrcFile` leaves the inline word stamps inside `text`, so the clean
  // text and the word starts both come from `parseLrcWordTimings` — the same
  // shape a real caller hands over.
  const raw = parseLrcFile(
    readFileSync('fixtures/lrc/josephine.v2.lrc', 'utf8'),
  )
  const parsed = raw.map((line) => parseLrcWordTimings(line.text, line.time))
  const lines = raw.map((line, i) => ({
    time: line.time,
    text: parsed[i]?.words.join(' ') ?? line.text,
  }))
  const wordTimings: WordTimingsMap = {}
  for (const [i, wt] of parsed.entries()) {
    if (wt !== null) wordTimings[i] = wt.wordTimes
  }

  it('keeps every line', () => {
    const out = serialiseLyricsfile({ lines, wordTimings })
    expect(out.match(/^ {2}- text: /gm)).toHaveLength(lines.length)
  })

  it('keeps every word', () => {
    const total = lines.reduce(
      (sum, line) => sum + splitWithSpacing(line.text).length,
      0,
    )
    expect(total).toBe(322)
    const out = serialiseLyricsfile({ lines, wordTimings })
    expect(out.match(/^ {6}- text: /gm)).toHaveLength(total)
  })

  it('reconstructs every line from its words', () => {
    for (const line of lines) {
      expect(splitWithSpacing(line.text).join('')).toBe(line.text)
    }
  })

  it('survives the apostrophes and commas the corpus is full of', () => {
    const out = serialiseLyricsfile({ lines, wordTimings })
    expect(out).toContain('"I\'ll be right behind you, Josephine"')
    expect(out).toContain('- text: "you, "')
  })
})
