// The beat machine's model: a pattern as bars of hits for the beat clock,
// the arm's swing, the cells' edits and the words a screen reader hears.

import { describe, expect, it } from 'vitest'
import type { Lane, Pattern } from './beat-patterns'
import { angleAtBeats, cellName, CLICK, clickBar, describeLane, describePattern, emptyPattern, isBackbeat, listBeats, metronomeAngle, patternBar, resizePattern, toggleCell, } from './beat-patterns'

const LANES: readonly Lane[] = [
  {
    id: 'kick',
    name: 'Kick',
    one: 'kick',
    many: 'kick',
    voice: 'kick',
    level: 0.8,
    accent: 1,
    perBeat: 1,
  },
  {
    id: 'clap',
    name: 'Clap',
    one: 'clap',
    many: 'claps',
    voice: 'clap',
    level: 0.7,
    perBeat: 1,
    backbeat: true,
  },
  {
    id: 'hat',
    name: 'Hi-hat',
    one: 'hi-hat',
    many: 'hi-hat',
    voice: 'hh-closed',
    level: 0.5,
    perBeat: 2,
  },
]
const [KICK, CLAP, HAT] = LANES

const ROCK: Pattern = {
  beats: 4,
  cells: { kick: [1, 0, 1, 0], clap: [0, 1, 0, 1], hat: [1, 1, 1, 1] },
}
const MARCH: Pattern = {
  beats: 4,
  cells: { kick: [2, 0, 0, 0], clap: [0, 1, 1, 1], hat: [0, 0, 0, 0] },
}

describe('clickBar', () => {
  it('clicks once a beat, high only on beat 1 when it counts bars', () => {
    // Arrange, Act
    const plain = clickBar(4, 'plain')
    const bars = clickBar(3, 'bars')

    // Assert
    expect(plain.hits.map((h) => h.beat)).toEqual([0, 1, 2, 3])
    expect(
      plain.hits.every((h) => h.data.kind === 'click' && !h.data.high),
    ).toBe(true)
    expect(bars.beats).toBe(3)
    expect(bars.hits.map((h) => h.data)).toEqual([
      { kind: 'click', high: true },
      { kind: 'click', high: false },
      { kind: 'click', high: false },
    ])
    expect(clickBar(4, 'none').hits).toEqual([])
  })

  it('keeps the two clicks of FACTS 74', () => {
    // Assert
    expect(CLICK.high).toEqual({ hz: 1500, gain: 0.09 })
    expect(CLICK.plain).toEqual({ hz: 1000, gain: 0.06 })
  })
})

describe('patternBar', () => {
  it("plays each lane's cells on their beats, the hi-hat twice a beat", () => {
    // Act
    const bar = patternBar(ROCK, LANES)
    const of = (lane: string) =>
      bar.hits.flatMap((h) =>
        h.data.kind === 'drum' && h.data.lane === lane ? [h.beat] : [],
      )

    // Assert
    expect(of('kick')).toEqual([0, 2])
    expect(of('clap')).toEqual([1, 3])
    expect(of('hat')).toEqual([0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5])
    // in time order, for the clock
    const beats = bar.hits.map((h) => h.beat)
    expect([...beats].sort((a, b) => a - b)).toEqual(beats)
  })

  it('plays an accented cell at its lane accent, and scales every drum together', () => {
    // Act
    const march = patternBar(MARCH, LANES)
    const half = patternBar(ROCK, LANES, 'none', 0.5)

    // Assert
    const boom = march.hits.find(
      (h) => h.data.kind === 'drum' && h.data.lane === 'kick',
    )
    expect(boom?.data).toMatchObject({ level: 1, cell: 0, voice: 'kick' })
    const levels = half.hits.flatMap((h) =>
      h.data.kind === 'drum' ? [[h.data.lane, h.data.level]] : [],
    )
    expect(new Map(levels as [string, number][])).toEqual(
      new Map([
        ['kick', 0.4],
        ['clap', 0.35],
        ['hat', 0.25],
      ]),
    )
  })

  it('lays the click under the drums when asked, and none by default', () => {
    // Act
    const withClick = patternBar(ROCK, LANES, 'bars')

    // Assert
    expect(withClick.hits.filter((h) => h.data.kind === 'click')).toHaveLength(
      4,
    )
    expect(
      patternBar(ROCK, LANES).hits.some((h) => h.data.kind === 'click'),
    ).toBe(false)
  })

  it('plays only the cells of the bar it has, after a resize', () => {
    // Act
    const three = patternBar(resizePattern(ROCK, 3), LANES)

    // Assert
    expect(three.beats).toBe(3)
    expect(three.hits.every((h) => h.beat < 3)).toBe(true)
  })
})

describe("the metronome's arm", () => {
  it('reaches −24° and +24° on the beats in turn and the middle between, at every tempo', () => {
    for (let bpm = 60; bpm <= 140; bpm += 5) {
      const beat = 60 / bpm
      // Assert
      expect(metronomeAngle(0, bpm)).toBeCloseTo(-24, 9)
      expect(metronomeAngle(beat, bpm)).toBeCloseTo(24, 9)
      expect(metronomeAngle(2 * beat, bpm)).toBeCloseTo(-24, 9)
      expect(metronomeAngle(beat / 2, bpm)).toBe(0)
      expect(metronomeAngle(1.5 * beat, bpm)).toBe(0)
    }
  })

  it("counts on the run's own beats, so a change of tempo bends no swing", () => {
    // Assert
    expect(angleAtBeats(3)).toBeCloseTo(24, 9)
    expect(angleAtBeats(3.5)).toBe(0)
    expect(Object.is(angleAtBeats(0.5), -0)).toBe(false)
  })
})

describe('editing a pattern', () => {
  it('toggles one cell on and off, and an accented one off', () => {
    // Act
    const on = toggleCell(ROCK, 'clap', 0)
    const off = toggleCell(on, 'clap', 0)
    const boomOff = toggleCell(MARCH, 'kick', 0)

    // Assert
    expect(on.cells.clap).toEqual([1, 1, 0, 1])
    expect(off.cells.clap).toEqual([0, 1, 0, 1])
    expect(boomOff.cells.kick).toEqual([0, 0, 0, 0])
    // the pattern it came from is untouched
    expect(ROCK.cells.clap).toEqual([0, 1, 0, 1])
  })

  it('keeps the first cells on a resize, and adds new ones off', () => {
    // Act
    const two = resizePattern(ROCK, 2)
    const back = resizePattern(two, 4)

    // Assert
    expect(two.cells.kick).toEqual([1, 0])
    expect(back.cells.kick).toEqual([1, 0, 0, 0])
    expect(back.cells.hat).toEqual([1, 1, 0, 0])
  })

  it('makes an empty pattern with a row for every lane', () => {
    // Assert
    expect(emptyPattern(LANES, 3)).toEqual({
      beats: 3,
      cells: { kick: [0, 0, 0], clap: [0, 0, 0], hat: [0, 0, 0] },
    })
  })

  it('calls 2 and 4 of a bar of four the backbeat, and nothing in a bar of three', () => {
    // Assert
    expect([0, 1, 2, 3].map((i) => isBackbeat(4, i))).toEqual([
      false,
      true,
      false,
      true,
    ])
    expect([0, 1, 2].map((i) => isBackbeat(3, i))).toEqual([
      false,
      false,
      false,
    ])
  })
})

describe('the words', () => {
  it('lists beats as a sentence does', () => {
    // Assert
    expect(listBeats([])).toBe('')
    expect(listBeats([2])).toBe('2')
    expect(listBeats([1, 3])).toBe('1 and 3')
    expect(listBeats([1, 2, 4])).toBe('1, 2 and 4')
  })

  it('says each lane of Rock and March as the summary reads it', () => {
    // Assert
    expect(describePattern(ROCK, LANES)).toBe(
      'Drum pattern, one bar: kick on 1 and 3, claps on 2 and 4, hi-hat on every half beat',
    )
    expect(describePattern(MARCH, LANES)).toBe(
      'Drum pattern, one bar: accented kick on 1, claps on 2, 3 and 4, no hi-hat',
    )
    expect(describePattern(resizePattern(ROCK, 3), LANES)).toBe(
      'Drum pattern, one bar of 3 beats: kick on 1 and 3, clap on 2, hi-hat on every half beat',
    )
  })

  it('says a lone hit in the singular, part of a hi-hat row, and an accent among plain hits', () => {
    // Arrange
    const p: Pattern = {
      beats: 4,
      cells: { kick: [2, 0, 1, 0], clap: [0, 0, 0, 1], hat: [1, 0, 1, 0] },
    }

    // Assert
    expect(describeLane(CLAP, p)).toBe('clap on 4')
    expect(describeLane(HAT, p)).toBe('hi-hat on 1 and 3, both halves')
    expect(describeLane(KICK, p)).toBe('kick on 1 and 3, accented on 1')
    expect(describeLane(CLAP, emptyPattern(LANES, 4))).toBe('no claps')
  })

  it("names a cell by its lane and beat, a hi-hat's both halves and an accent", () => {
    // Assert
    expect(cellName(CLAP, 1, 1)).toBe('Clap on beat 2')
    expect(cellName(HAT, 1, 1)).toBe('Hi-hat on beat 2, both halves')
    expect(cellName(KICK, 0, 2)).toBe('Kick on beat 1, accented')
    expect(cellName(KICK, 0, 0)).toBe('Kick on beat 1')
  })
})
