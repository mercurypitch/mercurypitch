// ============================================================
// Lyrics automap tests — pasted lines timed against the sung notes
// ============================================================
//
// The rules on hand-made notes first, then the whole thing on the three
// example songs the app carries: the notes their analysis keeps (notes.json's
// mergedNotes, the ones the app times lyrics against) against their
// hand-timed lyrics (manifest.json), the times stripped as a paste would
// have none. The even spread the room used before scores 5 to 12 per cent
// of lines within a second on them.

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseEnhancedLrc } from './lrc-compare'
import type { PastedLine, TimedNote } from './lyrics-automap'
import { automapLineStarts, automappedLrc, pastedLines } from './lyrics-automap'

const note = (startSec: number, endSec: number): TimedNote => ({
  startSec,
  endSec,
})

/** A run of notes from `from` to `to`, one every `step` seconds. */
function phrase(from: number, to: number, step = 0.25): TimedNote[] {
  const out: TimedNote[] = []
  for (let t = from; t < to - 1e-9; t += step) {
    out.push(note(t, Math.min(to, t + step)))
  }
  return out
}

const line = (text: string, stanzaStart = false): PastedLine => ({
  text,
  stanzaStart,
})

describe('pastedLines', () => {
  it('keeps the sung lines, and marks where a blank line or a label started a stanza', () => {
    const lines = pastedLines(
      [
        '[Verse 1]',
        'First line here',
        'Second line here',
        '',
        '',
        'Chorus:',
        'Third line here',
        '(x2)',
        '  Fourth line here  ',
      ].join('\n'),
    )

    expect(lines).toEqual([
      line('First line here'),
      line('Second line here'),
      line('Third line here', true),
      line('Fourth line here', true),
    ])
  })

  it('reads the labels lyrics sites write as labels, not as lines to sing', () => {
    for (const label of [
      'Chorus x2',
      'Chorus (x2)',
      'Repeat Chorus',
      'Instrumental',
      '(Instrumental break)',
      'Guitar Solo',
      '*Chorus*',
      'Verse 2 - Artist',
      'Pre-Chorus:',
      '[Bridge: Someone]',
      '2x',
    ]) {
      expect(pastedLines(`First line\n${label}\nSecond line`)).toEqual([
        line('First line'),
        line('Second line', true),
      ])
    }
  })

  it('keeps a sung line in brackets that is not a label', () => {
    for (const sung of [
      '(ooh, la la)',
      '(Repeat after me)',
      '(Hook me up)',
      '(Bridge over troubled water)',
    ]) {
      expect(pastedLines(`${sung}\nAnd on we go`)).toEqual([
        line(sung),
        line('And on we go'),
      ])
    }
  })
})

describe('automapLineStarts', () => {
  it('starts each line after a clear silence', () => {
    const notes = [...phrase(10, 13), ...phrase(15, 18), ...phrase(20, 23)]
    const lines = [
      'One two three four',
      'Five six seven eight',
      'Nine ten eleven twelve',
    ]

    expect(
      automapLineStarts(
        lines.map((t) => line(t)),
        notes,
      ),
    ).toEqual([10, 15, 20])
  })

  it('starts the first line on the first real singing, not a breath before it', () => {
    // A breath at 2 s, a tenth of a second alone, then the voice at 8 s.
    const notes = [note(2, 2.1), ...phrase(8, 11), ...phrase(13, 16)]
    const starts = automapLineStarts(
      [line('The first line'), line('The second line')],
      notes,
    )

    expect(starts).toEqual([8, 13])
  })

  it('splits a phrase sung straight through by the lines’ syllables', () => {
    // Eight seconds without a break; the first line has three times the
    // syllables of the second, so it takes about three quarters of them.
    const notes = phrase(0, 8)
    const starts = automapLineStarts(
      [line('Many many syllables sung along here'), line('Two more')],
      notes,
    )

    expect(starts).not.toBeNull()
    expect(starts![0]).toBe(0)
    expect(starts![1]).toBeGreaterThan(4.5)
    expect(starts![1]).toBeLessThan(7.5)
  })

  it('starts a stanza after the long silence of a break', () => {
    // Three phrases; the break is the second gap, but the first is longer
    // than a breath too. The stanza mark settles which one the lines take.
    const notes = [...phrase(0, 4), ...phrase(5.2, 9), ...phrase(17, 21)]
    const starts = automapLineStarts(
      [line('A line of the verse'), line('The chorus comes in', true)],
      notes,
    )

    expect(starts).toEqual([0, 17])
  })

  it('leaves out a "yeah" set apart before the first line, not a phrase that runs up to it', () => {
    const lines = [
      line('Every word of the first line sung'),
      line('And every word of the second'),
    ]
    const song = [...phrase(20, 23.5), ...phrase(27, 30.5)]
    // Half a second of voice, five seconds ahead: in no line.
    expect(automapLineStarts(lines, [...phrase(14.5, 15), ...song])).toEqual([
      20, 27,
    ])
    // Three seconds of voice that runs up to the line: the line's own.
    expect(automapLineStarts(lines, [...phrase(16, 19), ...song])?.[0]).toBe(16)
  })

  it('leaves the lyrics untimed rather than search a long, dense song for long', () => {
    // Fourteen minutes at nearly seven notes a second, and 250 lines.
    const notes: TimedNote[] = []
    for (let t = 0; t < 840; t += 0.15) {
      if (t % 3 < 2.6) notes.push(note(t, t + 0.13))
    }
    const lines = Array.from({ length: 250 }, (_, i) =>
      line(`Line number ${String(i)} goes here`),
    )

    expect(automapLineStarts(lines, notes)).toBeNull()
  })

  it('has no answer without notes, or with fewer note starts than lines', () => {
    expect(automapLineStarts([line('Alone')], [])).toBeNull()
    expect(
      automapLineStarts(
        [line('One'), line('Two'), line('Three')],
        [note(1, 2), note(3, 4)],
      ),
    ).toBeNull()
    expect(automapLineStarts([], phrase(0, 4))).toBeNull()
  })
})

describe('automappedLrc', () => {
  it('writes the paste as line-timed LRC, labels and blank lines left out', () => {
    const notes = [...phrase(65.5, 68), ...phrase(70, 73)]

    expect(automappedLrc('[Intro]\nFirst line\n\nSecond line', notes)).toBe(
      '[01:05.50]First line\n[01:10.00]Second line',
    )
  })

  it('has no LRC when the notes cannot carry the lines', () => {
    expect(automappedLrc('One\nTwo', [])).toBeNull()
  })
})

// ── The example songs ──────────────────────────────────────────

const EXAMPLES = 'apps/mercurypitch/native-only/karaoke/examples'

interface Example {
  readonly notes: TimedNote[]
  readonly truth: number[]
  readonly texts: string[]
  /** Where a lyrics site's blank line would go (see `pasted`). */
  readonly sections: boolean[]
}

function example(dir: string): Example {
  const manifest = JSON.parse(
    readFileSync(`${EXAMPLES}/manifest.json`, 'utf8'),
  ) as { songs: { notes: string; lyricsText: string }[] }
  const song = manifest.songs.find((s) => s.notes.includes(`/${dir}/`))
  if (song === undefined) throw new Error(`no example ${dir}`)
  const analysis = JSON.parse(
    readFileSync(`${EXAMPLES}/${dir}/notes.json`, 'utf8'),
  ) as { mergedNotes: TimedNote[] }
  // The timing extension's own tag is not a lyric line.
  const lyrics = parseEnhancedLrc(
    song.lyricsText
      .split('\n')
      .filter((l) => !/^\[[a-z-]+:/i.test(l))
      .join('\n'),
  )
  return {
    notes: analysis.mergedNotes.map((n) => note(n.startSec, n.endSec)),
    truth: lyrics.map((l) => l.words[0].time),
    texts: lyrics.map((l) => l.words.map((w) => w.value).join(' ')),
    // A section ends where the hand-timed lyrics pause five seconds or more
    // after a line's last word: these songs' verses and choruses change
    // there. (Not the vocal's silences, which the automap reads itself.)
    sections: lyrics.map((l, i) => {
      if (i === 0) return false
      const before = lyrics[i - 1].words
      return l.words[0].time - before[before.length - 1].time >= 5
    }),
  }
}

/** The song as a paste: with blank lines between its sections, or none. */
function pasted(song: Example, blankLines: boolean): PastedLine[] {
  return song.texts.map((text, i) => line(text, blankLines && song.sections[i]))
}

/** The share of lines within a second of the hand-timed start. */
function withinASecond(
  starts: readonly number[] | null,
  truth: readonly number[],
): number {
  if (starts === null) return 0
  const near = starts.filter((t, i) => Math.abs(t - truth[i]) <= 1)
  return near.length / truth.length
}

/** Everything from `at` on, `sec` later: a long instrumental break. */
function withBreak(song: Example, at: number, sec: number): Example {
  const later = (t: number) => (t >= at ? t + sec : t)
  return {
    ...song,
    notes: song.notes.map((n) => note(later(n.startSec), later(n.endSec))),
    truth: song.truth.map(later),
  }
}

const SONGS = [
  // dir, the share within a second without blank lines, and with them
  ['goodbye-to-spring', 0.8, 0.8],
  ['josephine', 0.8, 0.8],
  ['nothing-in-the-dark', 0.6, 0.7],
] as const

/** A "yeah" (1.5 s of voice) 6 s before the first line; an "ooh" (8 s) 4 s after the last. */
function withStrays(song: Example): {
  yeah: TimedNote[]
  ooh: TimedNote[]
} {
  const first = Math.min(...song.notes.map((n) => n.startSec))
  const last = Math.max(...song.notes.map((n) => n.endSec))
  return {
    yeah: [...phrase(first - 7.5, first - 6), ...song.notes],
    ooh: [...song.notes, ...phrase(last + 4, last + 12)],
  }
}

describe('the example songs, timed from their notes', () => {
  it.each(SONGS)('times %s, the first line within a second', (dir, share) => {
    const song = example(dir)
    const starts = automapLineStarts(pasted(song, false), song.notes)

    expect(starts).not.toBeNull()
    expect(Math.abs(starts![0] - song.truth[0])).toBeLessThan(1)
    expect(withinASecond(starts, song.truth)).toBeGreaterThanOrEqual(share)
  })

  it.each(SONGS)(
    'reads a paste’s blank lines between sections: %s',
    (dir, _, share) => {
      const song = example(dir)
      const starts = automapLineStarts(pasted(song, true), song.notes)

      expect(withinASecond(starts, song.truth)).toBeGreaterThanOrEqual(share)
    },
  )

  it.each(SONGS)(
    'keeps the pace of the singing, not of the song: %s with a 40 s break',
    (dir, share) => {
      // The pace a line is measured by leaves the silences out, so a long
      // instrumental break moves nothing.
      const plain = example(dir)
      const song = withBreak(
        plain,
        plain.truth[Math.floor(plain.truth.length / 2)] - 0.5,
        40,
      )
      const starts = automapLineStarts(pasted(song, false), song.notes)

      expect(withinASecond(starts, song.truth)).toBeGreaterThanOrEqual(share)
    },
  )

  it('times a long song, each line looked for near where an even pace puts it', () => {
    // Nothing in the Dark three times over, 14 minutes: past the search's
    // budget, so each line is looked for within a band.
    const song = example('nothing-in-the-dark')
    const span = Math.max(...song.notes.map((n) => n.endSec)) + 5
    const times = [0, 1, 2]
    const notes = times.flatMap((k) =>
      song.notes.map((n) => note(n.startSec + k * span, n.endSec + k * span)),
    )
    const truth = times.flatMap((k) => song.truth.map((t) => t + k * span))
    const lines = times.flatMap(() => pasted(song, false))

    expect(
      withinASecond(automapLineStarts(lines, notes), truth),
    ).toBeGreaterThanOrEqual(0.45)
  })

  it.each([
    // dir, with a "yeah" ahead, with an "ooh" after (blank lines in)
    ['goodbye-to-spring', 0.75, 0.78],
    ['josephine', 0.8, 0.8],
    ['nothing-in-the-dark', 0.7, 0.68],
  ] as const)(
    'leaves a stray phrase at either end out of the lines: %s',
    (dir, yeahShare, oohShare) => {
      const song = example(dir)
      const { yeah, ooh } = withStrays(song)
      const lines = pasted(song, true)

      expect(
        withinASecond(automapLineStarts(lines, yeah), song.truth),
      ).toBeGreaterThanOrEqual(yeahShare)
      expect(
        withinASecond(automapLineStarts(lines, ooh), song.truth),
      ).toBeGreaterThanOrEqual(oohShare)
    },
  )

  it('keeps most songs right with a stray phrase even without blank lines', () => {
    // Without them nothing says which phrase is the first line's, and a
    // song whose lines are of a like length can come out a line late
    // throughout: Nothing in the Dark with the "yeah", Goodbye to Spring
    // with the "ooh" (lyrics-automap.ts). These two hold.
    const josephine = example('josephine')
    const spring = example('goodbye-to-spring')
    const j = withStrays(josephine)

    expect(
      withinASecond(
        automapLineStarts(pasted(josephine, false), j.yeah),
        josephine.truth,
      ),
    ).toBeGreaterThanOrEqual(0.8)
    expect(
      withinASecond(
        automapLineStarts(pasted(josephine, false), j.ooh),
        josephine.truth,
      ),
    ).toBeGreaterThanOrEqual(0.8)
    expect(
      withinASecond(
        automapLineStarts(pasted(spring, false), withStrays(spring).yeah),
        spring.truth,
      ),
    ).toBeGreaterThanOrEqual(0.75)
  })
})
