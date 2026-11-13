// ============================================================
// Lesson 26 parts tests — the thirds, the copies and every play's timing
// ============================================================
//
// The arithmetic the page stands on (FACTS 11 to 23, 75 to 77; the
// WEB-SPEC's Tests 1 and 2): a third is the key's note three letters up,
// 4 semitones over do, fa and so and 3 over re, mi, la and ti; "Twinkle"'s
// copy in the key's thirds stays on C major's rows, its copy four
// semitones up leaves them on six notes, C♯, G♯ and F♯; Step 3's parts a
// third above and below do re mi re do, Merc's tune a tenth under Tavi's
// part; Step 4's mi fa so over the C major chord; and the plays' lengths.

import { describe, expect, it } from 'vitest'
import { ABOVE3, ABOVE5, BELOW5, C_MAJOR, C4, CHORD, KEY_COPY, lengthOf, letterSaid, MERC5, offLane, SCALE, sizes, spoken, TAVI5, thirdAbove, thirdBelow, timed, TUNE5, TWINKLE, TWINKLE_BEAT, UP4_COPY, } from './parts'

const NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B']
const named = (ats: readonly number[]): string =>
  ats.map((a) => NAMES[(((C4 + a) % 12) + 12) % 12]).join(' ')

describe('thirds in a major key', () => {
  it('takes the key’s note three letters up: 4 semitones over do, fa and so, 3 over re, mi, la and ti (FACTS 11, 12)', () => {
    const third = SCALE.at.map(thirdAbove)
    expect(named(third)).toBe('E F G A B C D')
    expect(sizes(SCALE.at, third)).toEqual([4, 3, 3, 4, 4, 3, 3])
  })

  it('takes the key’s note three letters down, across the octave below do', () => {
    expect(thirdBelow(0)).toBe(-3)
    expect(thirdBelow(2)).toBe(-1)
    expect(thirdBelow(4)).toBe(0)
    expect(thirdBelow(12)).toBe(9)
  })

  it('refuses a note the key does not have', () => {
    expect(() => thirdAbove(1)).toThrow(/not in the key/)
    expect(() => thirdBelow(6)).toThrow(/not in the key/)
  })
})

describe('"Twinkle" and its copies (FACTS 13 to 15)', () => {
  it('is do do so so la la so, fa fa mi mi re re do, in C', () => {
    expect(TWINKLE.map((l) => named(l.at))).toEqual([
      'C C G G A A G',
      'F F E E D D C',
    ])
  })

  it("copies it a third up in the key's own notes, every one on C major's rows", () => {
    expect(KEY_COPY.map(named)).toEqual(['E E B B C C B', 'A A G G F F E'])
    expect(KEY_COPY.flat().every((a) => offLane(C4 + a) === null)).toBe(true)
    expect(sizes(TWINKLE[0].at, KEY_COPY[0])).toEqual([4, 4, 4, 4, 3, 3, 4])
    expect(sizes(TWINKLE[1].at, KEY_COPY[1])).toEqual([4, 4, 3, 3, 3, 3, 4])
  })

  it('copies it four semitones up, six of its notes off the rows: C♯, G♯ and F♯', () => {
    expect(UP4_COPY.map(named)).toEqual([
      'E E B B C♯ C♯ B',
      'A A G♯ G♯ F♯ F♯ E',
    ])
    const off = UP4_COPY.flat()
      .map((a) => offLane(C4 + a))
      .filter((n) => n !== null)
    expect(off).toEqual(['C♯', 'C♯', 'G♯', 'G♯', 'F♯', 'F♯'])
  })

  it("keeps the copy inside the band's C4 to D5", () => {
    const all = [
      ...TWINKLE.flatMap((l) => l.at),
      ...KEY_COPY.flat(),
      ...UP4_COPY.flat(),
    ]
    expect(Math.min(...all)).toBeGreaterThanOrEqual(0)
    expect(Math.max(...all)).toBeLessThanOrEqual(14)
  })
})

describe("the steps' parts (FACTS 17, 19, 23)", () => {
  it('puts mi fa so fa mi above do re mi re do, and la ti do ti la below it', () => {
    expect(named(TUNE5.at)).toBe('C D E D C')
    expect(named(ABOVE5)).toBe('E F G F E')
    expect(named(BELOW5)).toBe('A B C B A')
    expect(sizes(TUNE5.at, ABOVE5)).toEqual([4, 3, 3, 3, 4])
    expect(sizes(TUNE5.at, BELOW5)).toEqual([3, 3, 4, 3, 3])
  })

  it("sets Merc's tune an octave down, a tenth under Tavi's part, C3 to E3 and E4 to G4", () => {
    expect(MERC5.at.map((a) => spoken(C4 + a))).toEqual([
      'C 3',
      'D 3',
      'E 3',
      'D 3',
      'C 3',
    ])
    expect(TAVI5.map((a) => spoken(C4 + a))).toEqual([
      'E 4',
      'F 4',
      'G 4',
      'F 4',
      'E 4',
    ])
    expect(TAVI5[0] - MERC5.at[0]).toBe(16)
  })

  it('puts mi fa so above do re mi, over the C major chord, C3, E3 and G3', () => {
    expect(named(ABOVE3)).toBe('E F G')
    expect(CHORD.map((m) => spoken(m))).toEqual(['C 3', 'E 3', 'G 3'])
  })

  it("names C major's rows as its lanes, and a black key by its sharp", () => {
    expect(C_MAJOR).toEqual([0, 2, 4, 5, 7, 9, 11])
    expect(offLane(61)).toBe('C♯')
    expect(offLane(60)).toBeNull()
    expect(spoken(73)).toBe('C sharp 5')
    expect(letterSaid(66)).toBe('F sharp')
  })
})

describe('timing (FACTS 75 to 77)', () => {
  it('plays "Twinkle" at 0.5 s a crotchet: 4.0 s a line, 8.0 s both', () => {
    const one = timed(TWINKLE[0].at, TWINKLE[0].beats, TWINKLE_BEAT)
    const two = timed(
      TWINKLE[1].at,
      TWINKLE[1].beats,
      TWINKLE_BEAT,
      lengthOf(one),
    )
    expect(lengthOf(one)).toBe(4)
    expect(lengthOf([...one, ...two])).toBe(8)
    expect(two[0].t).toBe(4)
  })

  it('plays do re mi re do in 3.0 s, its last note 1.0 s', () => {
    const notes = timed(TUNE5.at, TUNE5.beats, 0.5)
    expect(lengthOf(notes)).toBe(3)
    expect(notes[4].dur).toBe(1)
  })
})
