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
import { LYRICSFILE_SWEEPS_KEY, lyricsfileToLrc, parseLyricsfile, serialiseLyricsfile, splitWithSpacing, } from '@/lib/lyricsfile'

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

  it('writes no words at all for a half-mapped line', () => {
    // start_ms is required on a word, so an untimed one could only be
    // fabricated or omitted — and omitting it shifts every word after it by a
    // position, landing the rest of the line's timings on the wrong words.
    // A half-mapped line has no faithful word-level form here.
    const sparse: number[] = []
    sparse[0] = 2
    sparse[2] = 8
    const out = serialiseLyricsfile({
      lines: [{ time: 2, text: 'one two three' }],
      wordTimings: { 0: sparse },
    })
    expect(out).not.toContain('words:')
    expect(out).toContain('start_ms: 2000')
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

// ── Reading ──────────────────────────────────────────────────────

describe('parseLyricsfile', () => {
  it('round-trips a mapping through the format', async () => {
    const input = {
      lines: [
        { time: 2, text: 'hold on' },
        { time: 11, text: 'soul mate' },
      ],
      metadata: { title: 'Josephine', durationMs: 214_000, offsetMs: -200 },
      wordTimings: { 0: [2, 6], 1: [11, 16] },
      wordEndTimings: { 0: [5.5, 9], 1: [15, 19] },
    }
    const parsed = await parseLyricsfile(serialiseLyricsfile(input))

    expect(parsed?.lines).toEqual(input.lines)
    expect(parsed?.wordTimings).toEqual(input.wordTimings)
    expect(parsed?.wordEndTimings).toEqual(input.wordEndTimings)
    expect(parsed?.metadata).toEqual(input.metadata)
  })

  it('round-trips sub-word split points', async () => {
    const wordSweepTimings: WordSweepTimingsMap = {
      0: {
        1: [
          { time: 6, progress: 0 },
          { time: 6.5, progress: 0.5 },
          { time: 7, progress: 1 },
        ],
      },
    }
    const parsed = await parseLyricsfile(
      serialiseLyricsfile({
        lines: LINES,
        wordTimings: { 0: [2, 6] },
        wordSweepTimings,
      }),
    )
    expect(parsed?.wordSweepTimings).toEqual(wordSweepTimings)
  })

  it('round-trips the lyrics that would break bare YAML', async () => {
    const lines = [
      { time: 0, text: 'no' },
      { time: 1, text: '- and then: this' },
      { time: 2, text: '"quoted" and \\escaped\\' },
      { time: 3, text: 'yes # not a comment' },
      { time: 4, text: "I'll be right behind you, Josephine" },
    ]
    const parsed = await parseLyricsfile(serialiseLyricsfile({ lines }))
    expect(parsed?.lines).toEqual(lines)
  })

  it('does not shift a half-mapped line onto the wrong words', async () => {
    // The alternative — writing only the timed words — round-trips "three"
    // back as word 1, and every later word with it. Losing the partial word
    // timings is the honest outcome; moving them is not.
    const sparse: number[] = []
    sparse[0] = 2
    sparse[2] = 8
    const parsed = await parseLyricsfile(
      serialiseLyricsfile({
        lines: [{ time: 2, text: 'one two three' }],
        wordTimings: { 0: sparse },
      }),
    )
    expect(parsed?.lines).toEqual([{ time: 2, text: 'one two three' }])
    expect(parsed?.wordTimings).toEqual({})
  })

  it('round-trips a fully mapped line word for word', async () => {
    const parsed = await parseLyricsfile(
      serialiseLyricsfile({
        lines: [{ time: 2, text: 'one two three' }],
        wordTimings: { 0: [2, 5, 8] },
      }),
    )
    expect(parsed?.wordTimings).toEqual({ 0: [2, 5, 8] })
  })

  it('round-trips the gold corpus word for word', async () => {
    const raw = parseLrcFile(
      readFileSync('fixtures/lrc/josephine.v2.lrc', 'utf8'),
    )
    const parsedLrc = raw.map((l) => parseLrcWordTimings(l.text, l.time))
    const lines = raw.map((line, i) => ({
      time: line.time,
      text: parsedLrc[i]?.words.join(' ') ?? line.text,
    }))
    const wordTimings: WordTimingsMap = {}
    for (const [i, wt] of parsedLrc.entries()) {
      if (wt !== null) wordTimings[i] = wt.wordTimes
    }

    const back = await parseLyricsfile(
      serialiseLyricsfile({ lines, wordTimings }),
    )
    expect(back?.lines).toEqual(lines)
    expect(back?.wordTimings).toEqual(wordTimings)
  })

  it('reads a file written by hand, not only by us', async () => {
    // Bare scalars, single quotes, a block string — all legal YAML that our
    // writer never emits, and exactly what another tool will hand over.
    const parsed = await parseLyricsfile(
      [
        'version: 1.0',
        'metadata:',
        '  title: Goodbye to Spring',
        '  duration_ms: 180000',
        'lines:',
        '  - text: hold on',
        '    start_ms: 2000',
        '    words:',
        '      - text: hold',
        '        start_ms: 2000',
        "      - text: 'on'",
        '        start_ms: 6000',
      ].join('\n'),
    )
    expect(parsed?.metadata.title).toBe('Goodbye to Spring')
    expect(parsed?.lines).toEqual([{ time: 2, text: 'hold on' }])
    expect(parsed?.wordTimings[0]).toEqual([2, 6])
  })

  it('is null for a file that is not one of these', async () => {
    // The caller is an upload handler; a mistyped file is a normal mistake.
    expect(await parseLyricsfile('')).toBeNull()
    expect(await parseLyricsfile('[00:02.00] hold on')).toBeNull()
    expect(await parseLyricsfile('{ not: [valid')).toBeNull()
    expect(await parseLyricsfile('version: "1.0"\nlines: []\n')).toBeNull()
    expect(await parseLyricsfile('version: "1.0"\nlines: "nope"\n')).toBeNull()
  })

  it('drops a line whose timing is not a number', async () => {
    // Untrusted input: "soon" must not become NaN timestamps three layers
    // down, where the failure looks like a rendering bug.
    const parsed = await parseLyricsfile(
      [
        'lines:',
        '  - text: "good"',
        '    start_ms: 1000',
        '  - text: "bad"',
        '    start_ms: soon',
        '  - text: "worse"',
        '    start_ms: .inf',
      ].join('\n'),
    )
    expect(parsed?.lines).toEqual([{ time: 1, text: 'good' }])
  })

  it('ignores a malformed sweep block rather than failing the file', async () => {
    // The key is lossy-optional both ways: a reader may drop it entirely, so
    // a broken one must never cost the visitor their word timings.
    const parsed = await parseLyricsfile(
      [
        'lines:',
        '  - text: "hold on"',
        '    start_ms: 2000',
        `${LYRICSFILE_SWEEPS_KEY}:`,
        '  "0":',
        '    "1":',
        '      - { t: nope, p: 0.5 }',
      ].join('\n'),
    )
    expect(parsed?.lines).toHaveLength(1)
    expect(parsed?.wordSweepTimings).toEqual({})
  })

  it('clamps a progress value that escaped its range', async () => {
    const parsed = await parseLyricsfile(
      [
        'lines:',
        '  - text: "hold on"',
        '    start_ms: 2000',
        `${LYRICSFILE_SWEEPS_KEY}:`,
        '  "0":',
        '    "1":',
        '      - { t: 6000, p: 4 }',
        '      - { t: 6500, p: -1 }',
      ].join('\n'),
    )
    expect(parsed?.wordSweepTimings[0][1].map((p) => p.progress)).toEqual([
      1, 0,
    ])
  })
})

describe('lyricsfileToLrc', () => {
  it('produces enhanced LRC the app can already parse', async () => {
    const parsed = await parseLyricsfile(
      serialiseLyricsfile({
        lines: [{ time: 2, text: 'hold on' }],
        wordTimings: { 0: [2, 6] },
      }),
    )
    const lrc = lyricsfileToLrc(parsed!)
    expect(lrc).toBe('[00:02.00] hold [00:06.00] on')

    // Round-trips through the app's own parser back to the same timings.
    const back = parseLrcFile(lrc)
    expect(parseLrcWordTimings(back[0].text, back[0].time)?.wordTimes).toEqual([
      2, 6,
    ])
  })

  it('keeps a line that has only a line time', async () => {
    const parsed = await parseLyricsfile(
      serialiseLyricsfile({ lines: [{ time: 65.5, text: 'hold on' }] }),
    )
    expect(lyricsfileToLrc(parsed!)).toBe('[01:05.50] hold on')
  })

  it('hands offset_ms to the ID tag rather than applying it here', async () => {
    // parseLrcOffsetTag is the one place that knows the sign convention and
    // shifts the embedded word stamps to match; a second copy would drift.
    const parsed = await parseLyricsfile(
      serialiseLyricsfile({ lines: LINES, metadata: { offsetMs: -200 } }),
    )
    expect(lyricsfileToLrc(parsed!).split('\n')[0]).toBe('[offset:-200]')
  })

  it('writes no offset tag when there is nothing to shift', async () => {
    const parsed = await parseLyricsfile(
      serialiseLyricsfile({ lines: LINES, metadata: { offsetMs: 0 } }),
    )
    expect(lyricsfileToLrc(parsed!)).not.toContain('[offset:')
  })

  it('carries the gold corpus through the whole loop', async () => {
    // LRC -> lyricsfile -> LRC, comparing the timings the app actually reads.
    const raw = parseLrcFile(
      readFileSync('fixtures/lrc/josephine.v2.lrc', 'utf8'),
    )
    const parsedLrc = raw.map((l) => parseLrcWordTimings(l.text, l.time))
    const lines = raw.map((line, i) => ({
      time: line.time,
      text: parsedLrc[i]?.words.join(' ') ?? line.text,
    }))
    const wordTimings: WordTimingsMap = {}
    for (const [i, wt] of parsedLrc.entries()) {
      if (wt !== null) wordTimings[i] = wt.wordTimes
    }

    const parsed = await parseLyricsfile(
      serialiseLyricsfile({ lines, wordTimings }),
    )
    const rebuilt = parseLrcFile(lyricsfileToLrc(parsed!))
    expect(rebuilt).toHaveLength(raw.length)
    for (const [i, line] of rebuilt.entries()) {
      const wt = parseLrcWordTimings(line.text, line.time)
      expect(wt?.words.join(' ')).toBe(lines[i].text)
      expect(wt?.wordTimes).toEqual(wordTimings[i])
    }
  })
})
