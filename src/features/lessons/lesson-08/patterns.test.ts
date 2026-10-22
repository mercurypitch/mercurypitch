// ============================================================
// Lesson 8 pattern tests — the tune, the drums and every run's bars
// ============================================================
//
// WEB-SPEC, Tests 1 and 2 (FACTS 24, 25, 30, 30c, 31, 32, 73, 76, 79): the
// tune is Lesson 6's, imported; Rock is the basic rock beat with a clap for
// the snare; March is BOOM-whack-whack-whack; the cold open's two versions
// differ in their claps alone; Merc is loudest on beat 1; and the words',
// the take's and the sung line's bars are what the plans say they are.

import { describe, expect, it } from 'vitest'
import type { Bar } from '@/features/lessons/kit/beat-clock'
import type { MachineHit } from '@/features/lessons/kit/beat-patterns'
import { patternBar } from '@/features/lessons/kit/beat-patterns'
import { hz } from '@/features/lessons/kit/notes'
import { C4, lineMidis, TWINKLE } from '@/features/lessons/lesson-06/melody'
import type { ColdHit } from './patterns'
import { BEAT_SEC, BPM, CLAPS, coldOpenBars, COUNT_IN_DO_GAIN, GROOVE, grooveBars, HERO_ROWS, LANES, LINE_GROOVE_SCALE, lineBars, MARCH, mercLevel, PATTERNS, ROCK, takeBars, TUNE, WORD_SOUNDS, } from './patterns'
import { lineDo, lineFrom } from './sing-line'

/** A lane's hits in a bar, by beat. */
const laneBeats = (bar: Bar<MachineHit>, lane: string): number[] =>
  bar.hits.flatMap((h) =>
    h.data.kind === 'drum' && h.data.lane === lane ? [h.beat] : [],
  )

describe('the tune', () => {
  it("is Lesson 6's Twinkle, its fourteen notes from C4, imported", () => {
    // Assert: FACTS 31
    expect(TUNE).toHaveLength(14)
    expect(TUNE.map((s) => s.midi)).toEqual([
      ...lineMidis(TWINKLE[0], C4),
      ...lineMidis(TWINKLE[1], C4),
    ])
    expect(TUNE.map((s) => s.midi)).toEqual([
      60, 60, 67, 67, 69, 69, 67, 65, 65, 64, 64, 62, 62, 60,
    ])
  })

  it('starts each syllable on a beat, "star" and "are" held for two, sixteen beats in all', () => {
    // Assert: FACTS 32
    const first = TUNE.slice(0, 7)
    expect(first.map((s) => [s.text, (s.beat % 4) + 1])).toEqual([
      ['twin', 1],
      ['kle', 2],
      ['twin', 3],
      ['kle', 4],
      ['lit', 1],
      ['tle', 2],
      ['star', 3],
    ])
    expect(first[6].beats).toBe(2)
    expect(TUNE[13]).toMatchObject({ text: 'are', beat: 14, beats: 2 })
    // the syllables that start on 2 and 4 of the first line
    expect(first.filter((s) => s.beat % 2 === 1).map((s) => s.text)).toEqual([
      'kle',
      'kle',
      'tle',
    ])
  })

  it("draws the hero's two rows, a cell a syllable, the held ones across two beats", () => {
    // Assert
    expect(HERO_ROWS).toHaveLength(2)
    expect(HERO_ROWS[0].cells.map((c) => c.text)).toEqual([
      'Twin',
      'kle',
      'twin',
      'kle',
      'lit',
      'tle',
      'star',
    ])
    expect(HERO_ROWS[1].cells[0].text).toBe('How')
    for (const row of HERO_ROWS)
      expect(row.cells.reduce((n, c) => n + c.span, 0)).toBe(8)
  })
})

describe('the drums', () => {
  it('plays Rock as the basic rock beat: kick 1 and 3, clap 2 and 4, hi-hat every eighth', () => {
    // Act
    const bar = patternBar(ROCK, LANES)

    // Assert: FACTS 24, on 0-based beats
    expect(laneBeats(bar, 'kick')).toEqual([0, 2])
    expect(laneBeats(bar, 'clap')).toEqual([1, 3])
    expect(laneBeats(bar, 'hat')).toEqual([0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5])
    expect(PATTERNS.rock.bpm).toBe(90)
  })

  it('plays March as an accented kick on 1 and claps on 2, 3 and 4, at 120', () => {
    // Act
    const bar = patternBar(MARCH, LANES)

    // Assert: FACTS 25, 75
    expect(laneBeats(bar, 'kick')).toEqual([0])
    expect(laneBeats(bar, 'clap')).toEqual([1, 2, 3])
    expect(laneBeats(bar, 'hat')).toEqual([])
    const kick = bar.hits.find((h) => h.data.kind === 'drum')
    expect(kick?.data).toMatchObject({ lane: 'kick', level: 1 })
    expect(PATTERNS.march.bpm).toBe(120)
  })

  it("leaves the take's groove without a clap, for the viewer's taps", () => {
    // Assert: FACTS 76
    expect(GROOVE.cells.clap).toEqual([0, 0, 0, 0])
    expect(GROOVE.cells.kick).toEqual(ROCK.cells.kick)
    expect(GROOVE.cells.hat).toEqual(ROCK.cells.hat)
    expect(grooveBars()).toHaveLength(4)
  })
})

describe('the cold open', () => {
  const strip = (bars: Bar<ColdHit>[], kind: ColdHit['kind']) =>
    bars.flatMap((b, i) =>
      b.hits.flatMap((h) =>
        h.data.kind === kind ? [{ at: i * 4 + h.beat, data: h.data }] : [],
      ),
    )

  it('differs between its two versions in the claps alone', () => {
    // Act
    const a = coldOpenBars(13, 0.4)
    const b = coldOpenBars(24, 0.4)

    // Assert: FACTS 30
    expect(strip(a, 'sing')).toEqual(strip(b, 'sing'))
    expect(strip(a, 'click')).toEqual(strip(b, 'click'))
    expect(strip(a, 'clap').map((c) => c.at)).toEqual([
      0, 2, 4, 6, 8, 10, 12, 14,
    ])
    expect(strip(b, 'clap').map((c) => c.at)).toEqual([
      1, 3, 5, 7, 9, 11, 13, 15,
    ])
    expect(CLAPS).toEqual({ 13: [0, 2], 24: [1, 3] })
  })

  it("starts each Merc's hop its own length before the clap it lands on", () => {
    // Act
    const hops = strip(coldOpenBars(24, 0.53 / BEAT_SEC), 'hop').map(
      (h) => h.at,
    )

    // Assert: FACTS 30d, 0.53 s before each clap
    const claps = [1, 3, 5, 7, 9, 11, 13, 15]
    hops.forEach((at, i) =>
      expect((claps[i] - at) * BEAT_SEC).toBeCloseTo(0.53, 9),
    )
  })

  it("sings Merc's line loudest on beat 1, then 3, softest on 2 and 4", () => {
    // Assert: FACTS 30c
    expect([0, 1, 2, 3].map(mercLevel)).toEqual([0.2, 0.14, 0.17, 0.14])
    expect(mercLevel(6)).toBe(0.17)
  })

  it('runs at 90 BPM', () => {
    expect(BPM).toBe(90)
    expect(BEAT_SEC).toBeCloseTo(0.6667, 4)
  })
})

describe('the four words', () => {
  it('play four clicks, two tempos, two bars and a backbeat', () => {
    // Assert: FACTS 73
    expect(WORD_SOUNDS.beat.bars[0].hits).toHaveLength(4)
    const tempo = WORD_SOUNDS.tempo
    expect(tempo.bars[0].hits).toHaveLength(8)
    // four at 60 (a second a beat), 0.6 s of quiet after the fourth, four at 120
    expect([0, 1, 2, 3, 4, 5, 6].map(tempo.beatSec)).toEqual([
      1, 1, 1, 1.6, 0.5, 0.5, 0.5,
    ])
    const bar = WORD_SOUNDS.bar.bars.flatMap((b) =>
      b.hits.map((h) => h.data.kind === 'click' && h.data.high),
    )
    expect(bar).toEqual([true, false, false, false, true, false, false, false])
    const backbeat = WORD_SOUNDS.backbeat.bars[0]
    expect(laneBeats(backbeat, 'kick')).toEqual([0, 2])
    expect(laneBeats(backbeat, 'clap')).toEqual([1, 3])
    expect(laneBeats(backbeat, 'hat')).toEqual([])
  })
})

describe('the tap take', () => {
  it('counts in a bar, then plays two bars of the groove with the click and four without', () => {
    // Act
    const bars = takeBars()
    const clicks = bars.map(
      (b) => b.hits.filter((h) => h.data.kind === 'click').length,
    )

    // Assert: FACTS 43, 76: 28 beats
    expect(bars.reduce((n, b) => n + b.beats, 0)).toBe(28)
    expect(clicks).toEqual([4, 4, 4, 0, 0, 0, 0])
    expect(bars[0].hits.some((h) => h.data.kind === 'drum')).toBe(false)
    for (const b of bars.slice(1)) expect(laneBeats(b, 'clap')).toEqual([])
  })
})

describe('the sung line', () => {
  it('counts in with do softly on beat 1, then two bars of Rock at half its level', () => {
    // Act
    const [countIn, one, two] = lineBars(50, true)

    // Assert: FACTS 68, 76, 79
    expect(countIn.hits.find((h) => h.data.kind === 'do')).toEqual({
      beat: 0,
      data: { kind: 'do', midi: 50 },
    })
    expect(COUNT_IN_DO_GAIN).toBe(0.065)
    const levels = one.hits.flatMap((h) =>
      h.data.kind === 'drum' ? [h.data.level] : [],
    )
    expect(Math.max(...levels)).toBeCloseTo(0.8 * LINE_GROOVE_SCALE, 9)
    expect(one.hits.some((h) => h.data.kind === 'click')).toBe(false)
    expect(two.hits.some((h) => h.data.kind === 'click')).toBe(false)
  })

  it("has Merc sing the first line's seven syllables from do, and the guide leave them to the viewer", () => {
    // Act
    const sung = lineBars(50, true).flatMap((b, i) =>
      b.hits.flatMap((h) =>
        h.data.kind === 'sing' ? [[i, h.beat, h.data.syllable.midi]] : [],
      ),
    )
    const guide = lineBars(62, false)

    // Assert: D3 D3 A3 A3 B3 B3 A3, a beat each, "star" on 3
    expect(sung).toEqual([
      [1, 0, 50],
      [1, 1, 50],
      [1, 2, 57],
      [1, 3, 57],
      [2, 0, 59],
      [2, 1, 59],
      [2, 2, 57],
    ])
    expect(guide.some((b) => b.hits.some((h) => h.data.kind === 'sing'))).toBe(
      false,
    )
    expect(guide[0].hits.find((h) => h.data.kind === 'do')?.data).toEqual({
      kind: 'do',
      midi: 62,
    })
  })
})

describe('the fixed notes', () => {
  /** FACTS 71: each fixed example's note, and Move do's limits, Hz. */
  const FREQS: Readonly<Record<number, number>> = {
    46: 116.54,
    50: 146.83,
    54: 185.0,
    57: 220.0,
    58: 233.08,
    59: 246.94,
    60: 261.63,
    62: 293.66,
    63: 311.13,
    64: 329.63,
    65: 349.23,
    66: 369.99,
    67: 392.0,
    69: 440.0,
    71: 493.88,
    73: 554.37,
    75: 622.25,
  }

  it("sound at hz(m), FACTS 71's frequencies", () => {
    for (const [m, f] of Object.entries(FREQS))
      expect(hz(Number(m)), `MIDI ${m}`).toBeCloseTo(f, 2)
  })

  it("play FACTS 71's notes as written, and reach its limits at Move do's ends", () => {
    // Arrange
    const written = [
      ...TUNE.map((s) => s.midi),
      ...(['lower', 'higher'] as const).flatMap((v) =>
        lineFrom(lineDo(v, 0)).map((s) => s.midi),
      ),
    ]
    const ends = (['lower', 'higher'] as const).flatMap((v) =>
      [-4, 4].flatMap((shift) => lineFrom(lineDo(v, shift)).map((s) => s.midi)),
    )

    // Assert: every note between moves by the same formula
    for (const m of written) expect(FREQS[m], `MIDI ${m}`).toBeDefined()
    expect(Math.min(...ends)).toBe(46)
    expect(Math.max(...ends)).toBe(75)
    for (const m of [46, 54, 58, 75]) expect(ends).toContain(m)
  })
})
