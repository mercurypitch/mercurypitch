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
// as 4/4 places them (FACTS 26a), its notes kept for the way back. Past
// 4/4 (Lesson 19 WEB-SPEC, Tests 1): the metres' bars and beats, 6/8's
// eighths beamed 3 + 3 and 3/4's 2 + 2 + 2, the two tunes' counts (Lesson
// 19 FACTS 30), the triplet's tuplet and beamed 3 as the Ear Lab reads its
// starts (FACTS 41), its count "trip-let" (FACTS 40), and Step 4's eighth
// tied to a quarter at beat 3 (FACTS 43), held counts in brackets (FACTS
// 28).

import { describe, expect, it } from 'vitest'
import type { RhythmSymbol } from '@/lib/ear/rhythm-notation'
import { beamGroups, readRhythm, tupletSpans } from '@/lib/ear/rhythm-notation'
import type { Bar, GridBar, GridChange, Metre, NoteValue, PlacedSymbol, } from './rhythm-model'
import { barLength, barQuarters, beamsOf, beatQuarters, countsOf, fillsBars, FOUR_FOUR, FOUR_QUARTERS, fromStarts, halve, HALVINGS, heldSeconds, isCompound, join, lengthOf, metreText, placeBars, runText, secondsText, SIX_EIGHT, soundsOf, stripCells, stripRuns, THREE_FOUR, toggleRest, TWO_FOUR, writeGrid, } from './rhythm-model'

const VALUES: Record<string, NoteValue> = { w: 4, h: 2, q: 1, e: 0.5, s: 0.25 }
const LETTERS = new Map(Object.entries(VALUES).map(([k, v]) => [v, k]))

/** A bar from its symbols: w, h, q, e or s, then "r" for a rest, "." for a dot, "3" for one of a triplet, "~" for a tie to the next note. */
const bar = (line: string): Bar =>
  line.split(' ').map((t) => ({
    kind: t.includes('r') ? 'rest' : 'note',
    value: VALUES[t[0]],
    dotted: t.includes('.'),
    tie: t.includes('~'),
    triplet: t.includes('3'),
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

  it("places each bar from its own first beat when told, so a short rhythm's groups can sit a pause apart", () => {
    // Act: the four words' tie, two quarters, a beat's pause, the same two tied
    const placed = placeBars([bar('q q'), bar('q~ q')], 4, [0, 3])

    // Assert
    expect(placed.map((p) => [p.beat, p.bar, p.onset, p.tie])).toEqual([
      [0, 0, 0, false],
      [1, 0, 1, false],
      [3, 1, 2, true],
      [4, 1, null, false],
    ])
    expect(soundsOf(placed).map((s) => [s.at, s.beats])).toEqual([
      [0, 1],
      [1, 1],
      [3, 2],
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

describe('past 4/4', () => {
  /** A figure's counts, by its metre, as one line. */
  const countLine = (bars: Bar[], m: Metre) =>
    countsOf(placeBars(bars, barQuarters(m)), m)
      .map((c) => c.text)
      .join(' ')

  /** Each beam's members, as the indices of the symbols it joins. */
  const beamed = (b: Bar, m: Metre) =>
    beamsOf(placeBars([b], barQuarters(m)), m).map((g) => g.members)

  it("gives each metre its bar and its beat in quarter notes: 6/8's beat a dotted quarter, the others' the bottom number's note", () => {
    // Act
    const read = [FOUR_FOUR, THREE_FOUR, TWO_FOUR, SIX_EIGHT].map((m) => [
      metreText(m),
      barQuarters(m),
      beatQuarters(m),
      isCompound(m),
    ])

    // Assert: Lesson 19 FACTS 12 to 14 and 17
    expect(read).toEqual([
      ['4/4', 4, 1, false],
      ['3/4', 3, 1, false],
      ['2/4', 2, 1, false],
      ['6/8', 3, 1.5, true],
    ])
  })

  it('writes the same six eighths as a bar of 6/8 or of 3/4, three quarters long, beamed 3 + 3 or 2 + 2 + 2 (FACTS 15)', () => {
    // Arrange
    const six = bar('e e e e e e')

    // Act
    const placed = placeBars([six, six], barQuarters(SIX_EIGHT))

    // Assert
    expect(fillsBars([six], false, barQuarters(SIX_EIGHT))).toBe(true)
    expect(placed.map((p) => [p.beat, p.bar])).toEqual([
      [0, 0],
      [0.5, 0],
      [1, 0],
      [1.5, 0],
      [2, 0],
      [2.5, 0],
      [3, 1],
      [3.5, 1],
      [4, 1],
      [4.5, 1],
      [5, 1],
      [5.5, 1],
    ])
    expect(beamed(six, SIX_EIGHT)).toEqual([
      [0, 1, 2],
      [3, 4, 5],
    ])
    expect(beamed(six, THREE_FOUR)).toEqual([
      [0, 1],
      [2, 3],
      [4, 5],
    ])
    // 4/4's and 2/4's are the Ear Lab's own, by the quarter
    const four = placeBars([bar('e e e e e e e e')])
    expect(beamsOf(four, FOUR_FOUR)).toEqual(beamGroups(four))
    expect(beamed(bar('e e q'), TWO_FOUR)).toEqual([[0, 1]])
  })

  it('counts the six eighths "1 and a 2 and a" in 6/8 and "1 and 2 and 3 and" in 3/4 (FACTS 22, 24)', () => {
    expect(countLine([bar('e e e e e e')], SIX_EIGHT)).toBe('1 and a 2 and a')
    expect(countLine([bar('e e e e e e')], THREE_FOUR)).toBe(
      '1 and 2 and 3 and',
    )
  })

  it("counts the 6/8 tune's bars and the 3/4 tune's, each held beat in brackets (FACTS 28, 30)", () => {
    // Arrange: the tunes' rhythms, bar by bar
    const sixEight = ['e e e q.', 'e e e q.', 'e e e e e e', 'h.'].map(bar)
    const threeFour = ['q q q', 'h q', 'e e e e e e', 'h.'].map(bar)

    // Act
    const each = (bars: Bar[], m: Metre) => bars.map((b) => countLine([b], m))

    // Assert
    expect(each(sixEight, SIX_EIGHT)).toEqual([
      '1 and a 2',
      '1 and a 2',
      '1 and a 2 and a',
      '1 (2)',
    ])
    expect(each(threeFour, THREE_FOUR)).toEqual([
      '1 2 3',
      '1 (2) 3',
      '1 and 2 and 3 and',
      '1 (2) (3)',
    ])
    expect(fillsBars(sixEight, false, 3)).toBe(true)
    expect(fillsBars(threeFour, false, 3)).toBe(true)
    // the 6/8 tune's last bar is one dotted half, two beats of 6/8
    expect(beamed(bar('e e e q.'), SIX_EIGHT)).toEqual([[0, 1, 2]])
  })

  it("writes Step 3's triplet as the Ear Lab reads its starts: three eighths in a quarter's time, one beam and its 3 (FACTS 41)", () => {
    // Arrange: a quarter, two eighths, a triplet of eighths, a quarter
    const triplet = bar('q e e e3 e3 e3 q')

    // Act
    const placed = placeBars([triplet])
    const groups = beamsOf(placed)
    const round = (p: RhythmSymbol) => ({
      ...p,
      beat: Number(p.beat.toFixed(6)),
      beats: Number(p.beats.toFixed(6)),
    })

    // Assert
    expect(fillsBars([triplet])).toBe(true)
    expect(lengthOf(triplet[3])).toBeCloseTo(1 / 3)
    expect(placed.map(earLab).map(round)).toEqual(
      readRhythm([0, 1, 1.5, 2, 2 + 1 / 3, 2 + 2 / 3, 3], 4).map(round),
    )
    expect(groups.map((g) => g.members)).toEqual([
      [1, 2],
      [3, 4, 5],
    ])
    expect(tupletSpans(placed, groups)).toEqual([
      { number: 3, from: 3, to: 5, beamed: true },
    ])
  })

  it('counts the triplet "trip-let" after its beat\'s number: "1, 2 and, 3 trip-let, 4" (FACTS 40)', () => {
    expect(countLine([bar('q e e e3 e3 e3 q')], FOUR_FOUR)).toBe(
      '1 2 and 3 trip let 4',
    )
    // the four words' triplet, in a bar of 2/4
    expect(countLine([bar('e e e3 e3 e3')], TWO_FOUR)).toBe('1 and 2 trip let')
  })

  it('writes Step 4\'s note on "2 and" as an eighth tied to a quarter, sounding once through beat 3, counted "1, 2 and (3) 4" (FACTS 43, 45)', () => {
    // Arrange
    const moved = bar('q e e~ q q')

    // Act
    const placed = placeBars([moved])

    // Assert
    expect(fillsBars([moved])).toBe(true)
    expect(
      soundsOf(placed).map((s) => [s.at, s.beats, s.first, s.last]),
    ).toEqual([
      [0, 1, 0, 0],
      [1, 0.5, 1, 1],
      [1.5, 1.5, 2, 3],
      [3, 1, 4, 4],
    ])
    // the tie lands on beat 3, which stays in sight
    expect(placed[3].beat).toBe(2)
    expect(countLine([moved], FOUR_FOUR)).toBe('1 2 and (3) 4')
  })
})
