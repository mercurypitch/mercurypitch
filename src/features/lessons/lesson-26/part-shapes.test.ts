// ============================================================
// Lesson 26 step states tests — what each state draws, says and plays
// ============================================================
//
// The WEB-SPEC's Toys 2 and Tests 5, as data: the plain "Twinkle" every
// place draws before the choice; Step 1's lanes, house and one pair with
// its bracket in words; Step 2's copy on both lines, its brackets 4 and 3
// in the key's thirds and all 4 moved four semitones up, the notes off the
// lanes named; Step 3's part above or below, and Merc and Tavi in their
// colours a tenth apart; Step 4's chord bar with re and fa hollow; the
// words each state says, in words, never signs; and every play's notes,
// lengths, levels and lights (FACTS 43 to 46, 77).

import { describe, expect, it } from 'vitest'
import { COLOR } from '@/features/lessons/kit/notes'
import { CHORD_GAIN } from '@/features/lessons/kit/sound'
import type { PlayId, StepState } from './part-shapes'
import { FIRSTS, pairWords, PLAIN, PLAIN_SAID, playOf, said, shapeOf, START, stateOfPlay, } from './part-shapes'
import { lengthOf, LINE } from './parts'

const UP4 = { ...START, copy: 'up4' } as const

describe('the plain state, before the choice', () => {
  it('draws "Twinkle"\'s two lines on plain rows with the house, and nothing that answers', () => {
    expect(PLAIN.lines).toEqual([LINE.twinkle1, LINE.twinkle2])
    expect(PLAIN.dress).toEqual({ house: 60 })
    expect(PLAIN.beadButtons || PLAIN.gapButtons).toBe(false)
    expect(PLAIN_SAID).toBe(
      '‘Twinkle’ in C major: two lines of seven notes, from C 4 up to A 4.',
    )
  })
})

describe('Step 1: the thirds up the scale', () => {
  it('lights the lanes, the house on do, and one pair: the scale’s note and the key’s third above it', () => {
    const shape = shapeOf(1, START)
    expect(shape.lines).toEqual([LINE.scale])
    expect(shape.window).toEqual([60, 74])
    expect(shape.dress?.lanes).toEqual([0, 2, 4, 5, 7, 9, 11])
    expect(shape.dress?.house).toBe(60)
    expect(shape.dress?.only).toBe(FIRSTS[LINE.scale])
    expect(shape.dress?.parts?.[0].only).toBe(0)
  })

  it('names each pair’s letters and semitones, with the unit (FACTS 43)', () => {
    expect([0, 1, 2, 3, 4, 5, 6].map(pairWords)).toEqual([
      'C up to E: 4 semitones',
      'D up to F: 3 semitones',
      'E up to G: 3 semitones',
      'F up to A: 4 semitones',
      'G up to B: 4 semitones',
      'A up to C: 3 semitones',
      'B up to D: 3 semitones',
    ])
    expect(
      shapeOf(1, { ...START, pair: 3 }).dress?.parts?.[0].brackets?.[3],
    ).toBe('F up to A: 4 semitones')
  })
})

describe('Step 2: "Twinkle" with its copy', () => {
  it('puts a copy beside each line, its brackets 4 over C, F and G and 3 over D, E and A, every note on the lanes', () => {
    const parts = shapeOf(2, START).dress?.parts ?? []
    expect(parts.map((p) => [p.line, p.label])).toEqual([
      [LINE.twinkle1, 'copy'],
      [LINE.twinkle2, 'copy'],
    ])
    expect(parts.map((p) => p.brackets?.join(''))).toEqual([
      '4444334',
      '4433334',
    ])
    expect(parts.flatMap((p) => p.names ?? []).every((n) => n === null)).toBe(
      true,
    )
  })

  it('moves the copy four semitones up: every bracket 4, the notes over D, E and A named off the lanes', () => {
    const parts = shapeOf(2, UP4).dress?.parts ?? []
    expect(parts.map((p) => p.brackets?.join(''))).toEqual([
      '4444444',
      '4444444',
    ])
    expect(parts.map((p) => (p.names ?? []).filter((n) => n !== null))).toEqual(
      [
        ['C♯', 'C♯'],
        ['G♯', 'G♯', 'F♯', 'F♯'],
      ],
    )
  })

  it('keeps the same part between the two, so only the beads that move slide', () => {
    const [a, b] = [shapeOf(2, START), shapeOf(2, UP4)].map(
      (s) => s.dress?.parts?.[0],
    )
    expect([a?.line, a?.label, a?.at.length]).toEqual([
      b?.line,
      b?.label,
      b?.at.length,
    ])
    const moved = a?.at.flatMap((x, i) => (x === b?.at[i] ? [] : [i]))
    expect(moved).toEqual([4, 5])
  })
})

describe('Step 3: above or below, and Merc and Tavi', () => {
  it('draws the part a third above or below do re mi re do, on A3 to G4', () => {
    const above = shapeOf(3, START)
    const below = shapeOf(3, { ...START, side: 'below' })
    expect(above.window).toEqual([57, 67])
    expect(above.dress?.parts?.[0].brackets?.join('')).toBe('43334')
    expect(below.dress?.parts?.[0].brackets?.join('')).toBe('33433')
    expect(below.dress?.parts?.[0].label).toBe('part')
  })

  it("redraws the band for the duet, C3 to G4: Merc's tune blue, Tavi's part orange, a tenth apart", () => {
    const duet = shapeOf(3, { ...START, duet: true })
    expect(duet.window).toEqual([48, 67])
    expect(duet.dress?.color).toBe(COLOR.blue)
    expect(duet.dress?.label).toBe('Merc')
    expect(duet.dress?.parts?.[0]).toMatchObject({
      label: 'Tavi',
      color: COLOR.orange,
    })
    expect(duet.dress?.parts?.[0].brackets?.[0]).toBe('a tenth')
  })
})

describe('Step 4: the note in the middle', () => {
  it('holds the C major chord under the band, its bar named, re and fa hollow', () => {
    const d = shapeOf(4, START).dress
    expect(d?.chord).toEqual({ name: 'C major chord', pcs: [0, 4, 7] })
    expect(d?.hollow).toEqual([FIRSTS[LINE.tune3] + 1])
    expect(d?.parts?.[0].hollow).toEqual([1])
    expect(d?.lanes).toBeUndefined()
  })
})

describe('the words each state says', () => {
  const STATES: readonly [StepState, typeof START][] = [
    [1, START],
    [1, { ...START, pair: 6 }],
    [2, START],
    [2, UP4],
    [3, START],
    [3, { ...START, side: 'below' }],
    [3, { ...START, duet: true }],
    [4, START],
  ]

  it('says every state in words, never signs', () => {
    for (const [n, s] of STATES) {
      expect(said(n, s)).not.toMatch(/[♯♭]/)
      expect(said(n, s).length).toBeGreaterThan(40)
    }
  })

  it('says the pair, its letters and semitones', () => {
    expect(said(1, { ...START, pair: 1 })).toMatch(
      /D 4.*F 4.*D up to F, 3 semitones/,
    )
  })

  it('says which notes move off the lanes four semitones up', () => {
    expect(said(2, UP4)).toMatch(/F sharp 4, G sharp 4 and C sharp 5/)
  })

  it('names the passing notes in Step 4', () => {
    expect(said(4, START)).toMatch(/passing notes/)
  })
})

describe('the plays (FACTS 77)', () => {
  const LENGTHS: Readonly<Record<PlayId, number>> = {
    thirds: 7,
    pair: 1,
    copy: 8,
    above: 3,
    below: 3,
    duet: 3,
    'part-chord': 3,
    'tune-chord': 3,
    both: 3,
  }

  it('lasts as long as each play should', () => {
    for (const [id, sec] of Object.entries(LENGTHS))
      expect(lengthOf(playOf(id as PlayId, START).notes)).toBeCloseTo(sec, 6)
  })

  it('plays the pairs up the scale together, a second each, and walks the pair with them', () => {
    const p = playOf('thirds', START)
    expect(p.notes.filter((n) => n.t === 2).map((n) => n.midi)).toEqual([
      64, 67,
    ])
    expect(p.pairOf).toEqual([0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6])
    expect(p.look.parts?.filter((x) => x === 0)).toHaveLength(7)
  })

  it('plays the copy the switch sets, note against note with the tune', () => {
    const key = playOf('copy', START).notes.filter((n) => n.t === 2)
    const up4 = playOf('copy', UP4).notes.filter((n) => n.t === 2)
    expect(key.map((n) => n.midi)).toEqual([69, 72])
    expect(up4.map((n) => n.midi)).toEqual([69, 73])
  })

  it("sings the duet in Merc's ooh, blue and orange", () => {
    const p = playOf('duet', START)
    expect(p.kind).toBe('merc')
    expect(new Set(p.look.colors)).toEqual(new Set([COLOR.blue, COLOR.orange]))
  })

  it('holds the chord at the chord level under Step 4’s plays, gold on a chord note and no light on a passing one', () => {
    const p = playOf('both', START)
    const held = p.notes.filter((n) => n.gain === CHORD_GAIN)
    expect(held.map((n) => [n.midi, n.dur])).toEqual([
      [48, 3],
      [52, 3],
      [55, 3],
    ])
    // do re mi, then mi fa so: re and fa pass
    expect(p.look.colors).toEqual([
      COLOR.gold,
      null,
      COLOR.gold,
      COLOR.gold,
      null,
      COLOR.gold,
    ])
  })

  it('belongs to its step, and sets the switch it plays', () => {
    expect(stateOfPlay('thirds', START).n).toBe(1)
    expect(stateOfPlay('copy', UP4)).toEqual({ n: 2, s: UP4 })
    expect(stateOfPlay('below', START)).toEqual({
      n: 3,
      s: { ...START, side: 'below', duet: false },
    })
    expect(stateOfPlay('duet', START).s.duet).toBe(true)
    expect(stateOfPlay('both', START).n).toBe(4)
  })
})
