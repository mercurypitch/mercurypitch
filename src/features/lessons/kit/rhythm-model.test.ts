// ============================================================
// Rhythm model tests — bars, sounds, the strip, the counts, the grid
// ============================================================
//
// Lesson 17 WEB-SPEC, Tests 1, and the parts of Tests 2 and 3 that need no
// drawing: the checkpoint's bars as the Ear Lab reads their starts (FACTS
// 37); written rests kept (FACTS 44); beams within a beat; dots and ties,
// a tied run sounding once (FACTS 28); the strip's readings at 60, 90, 100
// and 120 BPM and its runs under a beat (Toys 6); the counts (FACTS 20 to
// 22); Halve and Join from four quarters, a whole note and sixteenths with
// every refusal, every bar they reach at four beats with its half notes on
// beats 1 and 3; the halvings (FACTS 66); and Note · Rest, its rests placed
// as 4/4 places them (FACTS 26a), its notes kept for the way back.

import { describe, expect, it } from 'vitest'
import type { RhythmSymbol } from '@/lib/ear/rhythm-notation'
import { beamGroups, readRhythm } from '@/lib/ear/rhythm-notation'
import type { Bar, GridBar, GridChange, NoteValue, PlacedSymbol, } from './rhythm-model'
import { barLength, countsOf, fillsBars, FOUR_QUARTERS, fromStarts, halve, HALVINGS, heldSeconds, join, placeBars, runText, secondsText, soundsOf, stripCells, stripRuns, toggleRest, writeGrid, } from './rhythm-model'

const VALUES: Record<string, NoteValue> = { w: 4, h: 2, q: 1, e: 0.5, s: 0.25 }
const LETTERS = new Map(Object.entries(VALUES).map(([k, v]) => [v, k]))

/** A bar from its symbols: w, h, q, e or s, then "r" for a rest, "." for a dot, "~" for a tie to the next note. */
const bar = (line: string): Bar =>
  line.split(' ').map((t) => ({
    kind: t.includes('r') ? 'rest' : 'note',
    value: VALUES[t[0]],
    dotted: t.includes('.'),
    tie: t.includes('~'),
  }))

/** A bar's symbols as a line, the same way. */
const line = (b: Bar): string =>
  b
    .map(
      (w) =>
        `${LETTERS.get(w.value)}${w.kind === 'rest' ? 'r' : ''}${w.dotted === true ? '.' : ''}${w.tie === true ? '~' : ''}`,
    )
    .join(' ')

/** The Ear Lab's fields of a placed symbol. */
const earLab = ({ bar: _bar, tie: _tie, ...s }: PlacedSymbol): RhythmSymbol => s

const made = (change: GridChange): GridBar => {
  if ('refused' in change) throw new Error(`refused: ${change.refused}`)
  return change.bar
}

const written = (b: GridBar): string => line(writeGrid(b))

const BEATS = [0, 1, 2, 3]

describe('the bars in place', () => {
  it("writes the checkpoint's bars as the Ear Lab reads their nine starts (FACTS 37)", () => {
    // Arrange
    const starts = [0, 1, 2, 4, 4.5, 5, 6, 6.5, 7]

    // Act
    const placed = placeBars([bar('q q h'), bar('e e q e e q')])

    // Assert
    expect(placed.map(earLab)).toEqual(readRhythm(starts, 8))
    expect(fromStarts(starts, 8)).toEqual(placed)
  })

  it('flags an eighth once and a sixteenth twice, as the Ear Lab reads their starts', () => {
    // Act
    const placed = placeBars([bar('q e e s s s s q')])

    // Assert
    expect(placed.map(earLab)).toEqual(
      readRhythm([0, 1, 1.5, 2, 2.25, 2.5, 2.75, 3], 4),
    )
    expect(placed.map((p) => p.flags)).toEqual([0, 1, 1, 2, 2, 2, 2, 0])
  })

  it('places each symbol from the figure start, a bar every four beats, its dot in its length', () => {
    // Act
    const placed = placeBars([bar('h. q~'), bar('q. e h')])

    // Assert
    expect(
      placed.map((p) => [p.beat, p.beats, p.bar, p.flags, p.onset, p.tie]),
    ).toEqual([
      [0, 3, 0, 0, 0, false],
      [3, 1, 0, 0, 1, true],
      [4, 1.5, 1, 0, null, false],
      [5.5, 0.5, 1, 1, 2, false],
      [6, 2, 1, 0, 3, false],
    ])
  })

  it('keeps a written rest where the Ear Lab would hold the note through it (FACTS 26a, 44)', () => {
    // Act: quarter, quarter, half rest, then the next bar's first quarter
    const placed = placeBars([bar('q q hr'), bar('q')])

    // Assert
    expect(placed.map((p) => [p.kind, p.beat, p.beats])).toEqual([
      ['note', 0, 1],
      ['note', 1, 1],
      ['rest', 2, 2],
      ['note', 4, 1],
    ])
    expect(readRhythm([0, 1, 4], 5).map((s) => [s.kind, s.beats])).toEqual([
      ['note', 1],
      ['note', 3],
      ['note', 1],
    ])
  })

  it('beams only the flagged notes of one beat, and a rest ends a beam', () => {
    // Act
    const groups = (b: string) =>
      beamGroups(placeBars([bar(b)])).map((g) => g.members)

    // Assert
    expect(groups('q e e s s s s q')).toEqual([
      [1, 2],
      [3, 4, 5, 6],
    ])
    expect(groups('e e e e q q')).toEqual([
      [0, 1],
      [2, 3],
    ])
    expect(groups('q er e h')).toEqual([])
    expect(groups('q sr s e h')).toEqual([[2, 3]])
  })

  it('fills every bar, a figure stopping short only on its last', () => {
    expect(fillsBars([bar('h. q'), bar('q. e h')])).toBe(true)
    expect(fillsBars([bar('q q q')])).toBe(false)
    expect(fillsBars([bar('q q hr'), bar('q')], true)).toBe(true)
    expect(fillsBars([bar('q q hr'), bar('q')])).toBe(false)
    expect(fillsBars([bar('q'), bar('q q h')], true)).toBe(false)
  })
})

describe('the sounds', () => {
  const sounds = (bars: Bar[]) =>
    soundsOf(placeBars(bars)).map((s) => [s.at, s.beats])

  it('sounds a tied pair once, for both lengths, across the bar line (FACTS 28)', () => {
    // Act
    const tied = soundsOf(placeBars([bar('h q q~'), bar('q q h')]))

    // Assert
    expect(tied.map((s) => [s.at, s.beats])).toEqual([
      [0, 2],
      [2, 1],
      [3, 2],
      [5, 1],
      [6, 2],
    ])
    expect(tied[2]).toMatchObject({ first: 2, last: 3 })
    expect(sounds([bar('h q q'), bar('q q h')])).toHaveLength(6)
  })

  it('sounds the dotted quarter tied to the quarter before it as one note of 2.5 beats', () => {
    expect(sounds([bar('h. q~'), bar('q. e h')])).toEqual([
      [0, 3],
      [3, 2.5],
      [5.5, 0.5],
      [6, 2],
    ])
  })

  it('sounds nothing for a rest, and a tie into a rest joins nothing', () => {
    expect(sounds([bar('q~ qr q h')])).toEqual([
      [0, 1],
      [2, 1],
      [3, 2],
    ])
  })

  it('holds each sound for its length less 0.08 s, or a quarter of it when that is less (FACTS 63)', () => {
    expect(heldSeconds(1, 60)).toBeCloseTo(0.92)
    expect(heldSeconds(2.5, 60)).toBeCloseTo(2.42)
    expect(heldSeconds(0.25, 120)).toBeCloseTo(0.09375)
  })
})

describe('the stopwatch strip', () => {
  it('reads every length at 60, 90, 100 and 120 BPM to two decimals at most (Toys 6)', () => {
    // Arrange: whole, dotted half, tied pair, half, dotted quarter, quarter, eighth, sixteenth
    const lengths = [4, 3, 2.5, 2, 1.5, 1, 0.5, 0.25]

    // Act
    const read = (bpm: number) =>
      lengths.map((b) => secondsText(b, bpm)).join(', ')

    // Assert
    expect(read(60)).toBe('4 s, 3 s, 2.5 s, 2 s, 1.5 s, 1 s, 0.5 s, 0.25 s')
    expect(read(90)).toBe(
      '2.67 s, 2 s, 1.67 s, 1.33 s, 1 s, 0.67 s, 0.33 s, 0.17 s',
    )
    expect(read(100)).toBe(
      '2.4 s, 1.8 s, 1.5 s, 1.2 s, 0.9 s, 0.6 s, 0.3 s, 0.15 s',
    )
    expect(read(120)).toBe(
      '2 s, 1.5 s, 1.25 s, 1 s, 0.75 s, 0.5 s, 0.25 s, 0.13 s',
    )
  })

  it('gives a tied pair one cell across both its notes, and a rest a cell of its own', () => {
    // Act
    const cells = stripCells(placeBars([bar('h q q~'), bar('q qr h')]))

    // Assert
    expect(cells.map((c) => [c.kind, c.at, c.beats, c.first, c.last])).toEqual([
      ['note', 0, 2, 0, 0],
      ['note', 2, 1, 1, 1],
      ['note', 3, 2, 2, 3],
      ['rest', 5, 1, 4, 4],
      ['note', 6, 2, 5, 5],
    ])
  })

  it('finds the runs of equal notes in one beat that read once under it, "4 × 0.25 s"', () => {
    // Act
    const runs = (b: string) =>
      stripRuns(stripCells(placeBars([bar(b)]))).map((r) => [
        r.from,
        r.to,
        runText(r, 60),
      ])

    // Assert
    expect(runs('q s s s s e e q')).toEqual([
      [1, 4, '4 × 0.25 s'],
      [5, 6, '2 × 0.5 s'],
    ])
    expect(runs('e e e e h')).toEqual([
      [0, 1, '2 × 0.5 s'],
      [2, 3, '2 × 0.5 s'],
    ])
    expect(runs('s s e q h')).toEqual([[0, 1, '2 × 0.25 s']])
    // a tied pair is a sound of its own, even as long as the note beside it
    expect(runs('e~ e q h')).toEqual([])
    expect(runs('s~ s e q h')).toEqual([])
  })
})

describe('the counts', () => {
  const counts = (bars: Bar[]) =>
    countsOf(placeBars(bars))
      .map((c) => c.text)
      .join(' ')

  it('counts the checkpoint\'s bars "1, 2, 3 (4), 1 and 2, 3 and 4" (FACTS 22)', () => {
    expect(counts([bar('q q h'), bar('e e q e e q')])).toBe(
      '1 2 3 (4) 1 and 2 3 and 4',
    )
  })

  it("counts Step 3's two bars, the eighths and the sixteenths (FACTS 20, 22)", () => {
    expect(counts([bar('e e e e e e e e')])).toBe('1 and 2 and 3 and 4 and')
    expect(counts([bar('q e e s s s s q')])).toBe('1 2 and 3 e and a 4')
  })

  it('holds in brackets the counts a rest, a tie or a dot leaves unsaid (FACTS 21)', () => {
    // Act
    const placed = placeBars([bar('h q q~'), bar('q q h')])

    // Assert
    expect(counts([bar('q qr q qr')])).toBe('1 (2) 3 (4)')
    expect(counts([bar('h q q~'), bar('q q h')])).toBe('1 (2) 3 4 (1) 2 3 (4)')
    expect(counts([bar('q. e h')])).toBe('1 (2) and 3 (4)')
    expect(counts([bar('wr')])).toBe('(1) (2) (3) (4)')
    expect(countsOf(placed).filter((c) => c.said)).toHaveLength(
      soundsOf(placed).length,
    )
  })
})

describe('Halve and Join', () => {
  const whole = HALVINGS[0]

  it('halves each beat of four quarters into two eighths, and Join puts the quarter back', () => {
    for (const beat of BEATS) {
      // Act
      const halved = made(halve(FOUR_QUARTERS, beat))

      // Assert
      expect(written(halved)).toBe(
        BEATS.map((b) => (b === beat ? 'e e' : 'q')).join(' '),
      )
      expect(made(join(halved, beat))).toEqual(FOUR_QUARTERS)
    }
  })

  it('joins a quarter with the other beat of its pair into a half note, on beat 1 or beat 3', () => {
    expect(BEATS.map((b) => written(made(join(FOUR_QUARTERS, b))))).toEqual([
      'h q q',
      'h q q',
      'q q h',
      'q q h',
    ])
  })

  it('splits a whole note into two halves and a half into two quarters, and joins them back', () => {
    // Arrange
    const halves = made(halve(whole, 2))

    // Act
    const quarters = made(halve(halves, 3))

    // Assert
    expect(BEATS.map((b) => written(made(halve(whole, b))))).toEqual(
      Array(4).fill('h h'),
    )
    expect(written(quarters)).toBe('h q q')
    expect(made(join(made(join(quarters, 2)), 0))).toEqual(whole)
  })

  it('halves sixteenths no further, and joins each beat of them into two eighths', () => {
    // Arrange
    const sixteenths = HALVINGS[4]

    // Act
    const joined = BEATS.map((b) => written(made(join(sixteenths, b))))

    // Assert
    expect(BEATS.map((b) => halve(sixteenths, b))).toEqual(
      Array(4).fill({ refused: 'shortest' }),
    )
    expect(joined[1]).toBe('s s s s e e s s s s s s s s')
  })

  it('refuses a Join with the reason for each case that cannot go', () => {
    // Arrange: beat 2 halved; beats 3 and 4 a half note; beat 1 silent; two halves, the second silent
    const split = made(halve(FOUR_QUARTERS, 1))
    const half = made(join(FOUR_QUARTERS, 2))
    const quiet = toggleRest(FOUR_QUARTERS, 0)
    const quietHalf = toggleRest(made(halve(whole, 0)), 2)

    // Act
    const reasons = [
      join(split, 0),
      join(quiet, 1),
      join(half, 2),
      join(quietHalf, 0),
      join(whole, 3),
      join(quiet, 0),
      halve(quiet, 0),
    ]

    // Assert
    expect(reasons).toEqual([
      { refused: 'pair' },
      { refused: 'pair' },
      { refused: 'halves' },
      { refused: 'halves' },
      { refused: 'whole' },
      { refused: 'silent' },
      { refused: 'silent' },
    ])
    expect(join(made(join(half, 0)), 2)).toEqual({ bar: whole })
  })

  it('keeps every bar it can reach at four beats, its half notes on beats 1 and 3', () => {
    // Arrange
    const seen = new Map<string, GridBar>()
    const queue = [FOUR_QUARTERS]

    // Act: every press of Halve and Join on every beat, from four quarters
    while (queue.length > 0) {
      const b = queue.pop()
      if (b === undefined) break
      const key = JSON.stringify(b.cells)
      if (seen.has(key)) continue
      seen.set(key, b)
      for (const beat of BEATS)
        for (const change of [halve(b, beat), join(b, beat)])
          if ('bar' in change) queue.push(change.bar)
    }

    // Assert: a whole note, or each half a half note or two beats of one, two or four notes
    const bars = [...seen.values()]
    expect(bars).toHaveLength(1 + 10 * 10)
    for (const b of bars) {
      expect(barLength(writeGrid(b))).toBe(4)
      for (const c of b.cells)
        if (c.value === 2) expect([0, 2]).toContain(c.from)
        else if (c.value === 4) expect(c.from).toBe(0)
    }
    for (const h of HALVINGS)
      expect(seen.get(JSON.stringify(h.cells))).toEqual(h)
  })

  it('plays the halvings, each bar the one before halved on every note (FACTS 66)', () => {
    // Act
    const halvedOnce = HALVINGS.slice(0, 4).map((h) =>
      h.cells.reduce((b, c) => made(halve(b, c.from)), h),
    )

    // Assert
    expect(HALVINGS.map(written)).toEqual([
      'w',
      'h h',
      'q q q q',
      'e e e e e e e e',
      Array(16).fill('s').join(' '),
    ])
    expect(halvedOnce).toEqual(HALVINGS.slice(1))
  })
})

describe('Note · Rest', () => {
  const silence = (b: GridBar, beats: number[]) =>
    beats.reduce((x, beat) => toggleRest(x, beat), b)

  it('writes a silent beat as one quarter rest whatever it held, and keeps its notes for the way back', () => {
    // Arrange: beat 2 of four sixteenths
    const sixteenths = made(halve(made(halve(FOUR_QUARTERS, 1)), 1))

    // Act
    const quiet = toggleRest(sixteenths, 1)

    // Assert
    expect(written(quiet)).toBe('q qr q q')
    expect(toggleRest(quiet, 1)).toEqual(sixteenths)
  })

  it('makes one half rest only from beat 1 or beat 3, and a silent bar one whole rest (FACTS 26a)', () => {
    expect(
      [[0, 1], [2, 3], [1, 2], [0, 1, 2], [1, 2, 3], [0, 2], [0, 3], BEATS].map(
        (beats) => written(silence(FOUR_QUARTERS, beats)),
      ),
    ).toEqual([
      'hr q q',
      'q q hr',
      'q qr qr q',
      'hr qr q',
      'q qr hr',
      'qr q qr q',
      'qr q q qr',
      'wr',
    ])
  })

  it('silences a half or a whole note from any beat inside it, as one rest', () => {
    // Arrange
    const half = made(join(FOUR_QUARTERS, 2))

    // Act
    const quiet = toggleRest(half, 3)

    // Assert
    expect(written(quiet)).toBe('q q hr')
    expect(quiet.silent).toEqual([false, false, true, true])
    expect(written(toggleRest(HALVINGS[0], 1))).toBe('wr')
    expect(toggleRest(quiet, 2)).toEqual(half)
  })
})
