// ============================================================
// Lesson 28 staffs' plays tests — what each step draws, and what each play sounds
// ============================================================
//
// The WEB-SPEC's Toys 2 and 3 and FACTS 33 to 36 and 48 to 51, on the pure
// plans: every play's length at 72 beats a minute, its notes, both parts
// note against note or one part alone; the plagal tag's chords in the soft
// tone; Step 3's bridge written as it plays, then A; and every state's
// scene, its first bar's number, its marks and the rows it keeps for them.

import { describe, expect, it } from 'vitest'
import type { ScorePlayId } from './score-plays'
import { BLOCKS, blockSaid, blockScene, planOf, sceneOfState, stepFourScene, stepOneScene, WAYS, waySaid, wayScene, } from './score-plays'
import { A, B, BAR_SEC, barsOf, bothNotes, GOING, join, partNotes, } from './song'

const ALL: readonly ScorePlayId[] = [
  'phrase1',
  'phrase2',
  'perfect',
  'interrupted',
  'plagal',
  'bridge',
  'block1',
  'block2',
  'block3',
  'block4',
  'both',
  'tavi',
  'merc',
]

/** The MIDI notes sounding at `t` seconds into a plan's notes, low to high. */
const at = (id: ScorePlayId, t: number): number[] =>
  planOf(id)
    .notes.filter((n) => Math.abs(n.t - t) < 1e-6)
    .map((n) => n.midi)
    .sort((a, b) => a - b)

describe("the plays' lengths and sounds", () => {
  it('runs each play for its length at 72 beats a minute (WEB-SPEC, Toys 2 and 3)', () => {
    // Act
    const seconds = ALL.map((id) => Number(planOf(id).seconds.toFixed(2)))

    // Assert
    expect(seconds).toEqual([
      13.33, 13.33, 6.67, 13.33, 13.33, 53.33, 26.67, 26.67, 26.67, 26.67,
      26.67, 26.67, 26.67,
    ])
  })

  it("draws each play for as long as it sounds, its legs' beats adding to its length", () => {
    for (const id of ALL) {
      const plan = planOf(id)
      const beats = plan.legs.reduce((sum, leg) => sum + leg.beats, 0)
      expect(beats * (60 / 72)).toBeCloseTo(plan.seconds, 6)
    }
  })

  it('sounds both parts note against note, and a part alone on its own staff (FACTS 51)', () => {
    // Assert
    expect(planOf('both').notes).toEqual(bothNotes(A))
    expect(planOf('tavi')).toMatchObject({
      notes: partNotes(A.tavi),
      staffs: [0],
    })
    expect(planOf('merc')).toMatchObject({
      notes: partNotes(A.merc),
      staffs: [1],
    })
    expect(planOf('both').staffs).toBeUndefined()
  })

  it("plays Step 1's phrases from bar 1 and from bar 5 of A", () => {
    expect(planOf('phrase1')).toMatchObject({
      state: 1,
      legs: [{ from: 0, beats: 16, write: false }],
      notes: bothNotes(barsOf(A, 1, 4)),
    })
    expect(planOf('phrase2')).toMatchObject({
      state: 1,
      legs: [{ from: 16, beats: 16, write: false }],
      notes: bothNotes(barsOf(A, 5, 8)),
    })
  })

  it('ends the song at bar 8 on G4 over G3, and keeps it going on G4 over E3, V to vi (FACTS 33)', () => {
    expect(at('perfect', BAR_SEC)).toEqual([55, 67])
    expect(at('interrupted', BAR_SEC)).toEqual([52, 67])
    // bars 9 and 10 start A again: B4 over G3
    expect(at('interrupted', 2 * BAR_SEC)).toEqual([55, 71])
  })

  it("holds G in both parts over the soft tone's IV, then I, after the ending (FACTS 35)", () => {
    // Arrange
    const soft = (t: number) =>
      planOf('plagal')
        .notes.filter((n) => n.kind === 'soft' && Math.abs(n.t - t) < 1e-6)
        .map((n) => n.midi)

    // Assert: C3 C4 E4, then B3 D4, under G4 over G3 each time
    expect(soft(2 * BAR_SEC)).toEqual([48, 60, 64])
    expect(soft(3 * BAR_SEC)).toEqual([59, 62])
    expect(at('plagal', 2 * BAR_SEC)).toEqual([48, 55, 60, 64, 67])
    expect(at('plagal', 3 * BAR_SEC)).toEqual([55, 59, 62, 67])
  })

  it('writes B as it plays, then shows A, in the bridge; a block alone writes only B (Toys 3)', () => {
    expect(planOf('bridge').legs).toEqual([
      { from: 0, beats: 32, write: true, block: 3 },
      { from: 0, beats: 32, write: false, block: 4 },
    ])
    expect(planOf('bridge').notes).toEqual(bothNotes(join(B, A)))
    expect(
      ['block1', 'block2', 'block3', 'block4'].map(
        (id) => planOf(id as ScorePlayId).legs[0]?.write,
      ),
    ).toEqual([false, false, true, false])
  })

  it("plays each in its own step's state", () => {
    expect(ALL.map((id) => planOf(id).state)).toEqual([
      1, 1, 2, 2, 2, 3, 3, 3, 3, 3, 4, 4, 4,
    ])
  })
})

describe("the states' scenes", () => {
  it('draws A in Step 1 with its breaths and house, keeping rows for the tags to come', () => {
    // Act
    const scene = stepOneScene()

    // Assert
    expect(scene.first).toBe(1)
    expect(scene.marks).toEqual({
      breaths: [1, 3, 5],
      home: [
        { letter: 'G', alter: 0, octave: 4 },
        { letter: 'G', alter: 0, octave: 3 },
      ],
      tags: [],
      numerals: [],
    })
    expect(sceneOfState(1)).toEqual(scene)
  })

  it('draws Step 4 with no row for a tag or a numeral, so its staffs come out larger', () => {
    expect(stepFourScene().marks?.tags).toBeUndefined()
    expect(stepFourScene().marks?.numerals).toBeUndefined()
    expect(stepFourScene().marks?.breaths).toEqual([1, 3, 5])
  })

  it('draws each way from bar 7, its tag and numerals once heard, the plagal words always (Toys 2)', () => {
    // Act
    const before = wayScene('plagal', false)
    const after = wayScene('plagal', true)

    // Assert
    expect(before.first).toBe(7)
    expect(before.marks).toMatchObject({ tags: [], numerals: [] })
    expect(before.marks?.words?.map((w) => w.text)).toEqual(['A-', 'men'])
    expect(after.marks?.tags).toEqual([{ bar: 3, text: 'Plagal: IV to I' }])
    // the cadence's numerals only, under the tag's bars
    expect(after.marks?.numerals).toEqual([
      { bar: 2, text: 'IV' },
      { bar: 3, text: 'I' },
    ])
    expect(wayScene('interrupted', true).marks?.numerals).toEqual([
      { bar: 0, text: 'V' },
      { bar: 1, text: 'vi' },
    ])
    expect(wayScene('interrupted', true).staffs[1].bars).toEqual(
      barsOf(GOING, 7, 10).merc,
    )
  })

  it('numbers the four sections 1, 9, 17 and 25, B with no breath and no house', () => {
    expect([1, 2, 3, 4].map((k) => blockScene(k).first)).toEqual([1, 9, 17, 25])
    expect(blockScene(3).marks).toEqual({})
    expect(blockScene(4).marks?.breaths).toEqual([1, 3, 5])
    expect(BLOCKS.map((b) => b.letter).join(' ')).toBe('A A B A')
  })
})

describe("the figure's words", () => {
  it('names each section and each way as it shows', () => {
    expect(blockSaid(3)).toBe('Bars 17 to 24, B, the bridge, on two staffs.')
    expect(blockSaid(4)).toBe('Bars 25 to 32, A, on two staffs.')
    expect(waySaid('perfect')).toBe(
      'Bars 7 and 8, the ending. Perfect: V to I.',
    )
    expect(waySaid('interrupted')).toBe(
      'Bars 7 to 10, the way it kept going. Interrupted: V to vi.',
    )
    expect(WAYS.perfect.tags[0]?.text).toBe('Perfect: V to I')
  })
})
