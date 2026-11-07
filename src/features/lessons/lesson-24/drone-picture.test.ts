// ============================================================
// Lesson 24 drone picture tests — each state's window, still and plays
// ============================================================
//
// WEB-SPEC, Look and Toys 2, and FACTS 40 and 46: each state's window; the
// drone as the amber band in Steps 1 and 2 (its second harmonic in the
// octave view), a chrome line in Step 3 and pinned below in Step 4; Lesson
// 5's band on mi in Step 3 alone; the ticks, Step 2's pure ones only from
// its choice; the beads, the sounding ones lit; every state held back to
// the drone's band alone until the choices that would answer; and a play's
// lines drawn as far as it has sounded, whole under reduced motion, its
// brightness only while it sounds and held still under reduced motion.

import { describe, expect, it } from 'vitest'
import type { Choices, DroneState } from './drone-picture'
import { heldBack, HERO_VIEW, litOf, miHz, OCTAVE_VIEW, playOf, START, stillOf, viewOf, VIEWS, } from './drone-picture'
import { PIANO, playFor } from './sounds'

const NONE: Choices = { cold: false, step2: false }
const COLD: Choices = { cold: true, step2: false }
const BOTH: Choices = { cold: true, step2: true }
const STATES: readonly DroneState[] = [1, 2, 3, 4]

describe('the windows', () => {
  it("runs each state's window as the spec has it, the hero's from 20 cents under A3 to 45 over", () => {
    // Assert
    expect(VIEWS).toEqual({
      1: { target: 57, span: [-40, 40] },
      2: { target: 57, span: [-50, 760] },
      3: { target: 61, span: [-440, 60] },
      4: { target: 64, span: [-80, 80] },
    })
    expect(OCTAVE_VIEW).toEqual({ target: 69, span: [-40, 40] })
    expect(HERO_VIEW).toEqual({ target: 57, span: [-20, 45] })
  })

  it("moves Step 1's window up an octave with its switch, and holds a state back on Step 1's window", () => {
    // Assert
    expect(viewOf(1, { ...START, octave: true }, COLD)).toBe(OCTAVE_VIEW)
    expect(viewOf(3, START, COLD)).toBe(VIEWS[1])
    expect(viewOf(3, START, BOTH)).toBe(VIEWS[3])
  })
})

describe('held back', () => {
  it("draws the drone's band alone in every state before the cold open's choice, and in Steps 3 and 4 until Step 2's", () => {
    // Assert
    for (const n of STATES) expect(heldBack(n, NONE)).toBe(true)
    expect(STATES.map((n) => heldBack(n, COLD))).toEqual([
      false,
      false,
      true,
      true,
    ])
    for (const n of STATES) {
      const s = stillOf(n, START, NONE, 4)
      expect(s.drone).toEqual({ c: 0, as: 'band', label: 'drone · A3' })
      expect([s.band, s.ticks, s.beads, s.tops, s.bright]).toEqual([
        null,
        [],
        [],
        [],
        null,
      ])
    }
  })
})

describe('the stills', () => {
  it("draws Step 1's top note across the window at its slider's pitch, just above the drone's band", () => {
    // Act
    const s = stillOf(1, START, COLD, 4)

    // Assert
    expect(s.drone.as).toBe('band')
    expect(s.tops).toHaveLength(1)
    const [stretch] = s.tops[0].stretches
    expect(stretch).toMatchObject({ kind: 'level', from: 0, to: 4 })
    expect(stretch.kind === 'level' && stretch.c).toBeCloseTo(31.19, 2)
  })

  it("marks the drone's second harmonic in the octave view, named for it", () => {
    // Act
    const s = stillOf(1, { ...START, octave: true, top: 441 }, COLD, 4)

    // Assert
    expect(s.drone).toEqual({ c: 0, as: 'band', label: 'drone × 2 · 440 Hz' })
    const [stretch] = s.tops[0].stretches
    expect(stretch.kind === 'level' && stretch.c).toBeCloseTo(3.93, 2)
  })

  it("shows Step 2's beads at once in the switch's tuning, and its pure ticks only from its choice", () => {
    // Act
    const before = stillOf(2, START, COLD, 4)
    const after = stillOf(2, { ...START, tuning: 'pure' }, BOTH, 4)

    // Assert
    expect(
      before.beads.map((b) => [b.name, Math.round(b.c * 100) / 100]),
    ).toEqual([
      ['do', 0],
      ['mi', 400],
      ['so', 700],
    ])
    expect(before.ticks).toEqual([])
    expect(after.beads.map((b) => Math.round(b.c * 100) / 100)).toEqual([
      0, 386.31, 701.96,
    ])
    expect(
      after.ticks.map((t) => [t.kind, Math.round(t.c * 100) / 100]),
    ).toEqual([
      ['pure', 386.31],
      ['pure', 701.96],
    ])
  })

  it("puts Lesson 5's band on mi in Step 3, the piano's and the pure ticks, the drone a chrome line at A3 and mi's line at its slider", () => {
    // Act
    const s = stillOf(3, { ...START, mi: -10 }, BOTH, 4)

    // Assert
    expect(s.band).toEqual({ c: 0, line: false })
    expect(s.drone).toEqual({
      c: expect.closeTo(-400, 9),
      as: 'line',
      label: 'drone',
    })
    expect(s.ticks.map((t) => [t.kind, Math.round(t.c * 100) / 100])).toEqual([
      ['piano', 0],
      ['pure', -13.69],
    ])
    const [stretch] = s.tops[0].stretches
    expect(stretch.kind === 'level' && stretch.c).toBeCloseTo(-10, 6)
    expect(miHz(0)).toBe(PIANO.mi)
  })

  it("draws no band in Step 4: the top note on E4 at the piano's tick, the drone pinned below", () => {
    // Act
    const s = stillOf(4, START, BOTH, 4)

    // Assert
    expect(s.band).toBeNull()
    expect(s.drone).toEqual({
      c: expect.closeTo(-700, 9),
      as: 'line',
      label: 'drone · A3',
    })
    expect(s.ticks).toEqual([{ c: 0, kind: 'piano' }])
    expect(s.tops).toHaveLength(1)
  })
})

describe('a play', () => {
  it('draws its lines as far as it has sounded, and its brightness while it sounds', () => {
    // Act
    const sounding = playOf(1, START, COLD, {
      key: '222',
      play: playFor('222'),
      t: 1.2,
      sounding: true,
      reduced: false,
    })
    const ended = playOf(1, START, COLD, {
      key: '222',
      play: playFor('222'),
      t: 3,
      sounding: false,
      reduced: false,
    })

    // Assert
    expect(sounding.tops.map((l) => l.upTo)).toEqual([1.2])
    expect(sounding.bright?.slow).not.toBeNull()
    expect(ended.tops.map((l) => l.upTo)).toEqual([3])
    expect(ended.bright).toBeNull()
  })

  it('lands its lines whole as it starts under reduced motion, its brightness held still', () => {
    // Act
    const s = playOf(2, START, BOTH, {
      key: 'chord',
      play: playFor('chord'),
      t: 0.1,
      sounding: true,
      reduced: true,
    })

    // Assert
    expect(s.tops.map((l) => l.upTo)).toEqual([4, 4])
    expect(s.bright).toEqual({ slow: null, fast: null })
  })

  it('lights do and the beads a play sets, only while it sounds', () => {
    // Assert
    expect(litOf('mi')).toEqual(['do', 'mi'])
    expect(litOf('fifth')).toEqual(['do', 'so'])
    expect(litOf('chord')).toEqual(['do', 'mi', 'so'])
    const lit = (sounding: boolean): string[] =>
      playOf(2, START, BOTH, {
        key: 'so',
        play: playFor('so'),
        t: 1,
        sounding,
        reduced: false,
      })
        .beads.filter((b) => b.lit)
        .map((b) => b.name)
    expect(lit(true)).toEqual(['do', 'so'])
    expect(lit(false)).toEqual([])
  })

  it("draws the slide from 31 cents above the drone down into its band's middle", () => {
    // Act
    const s = playOf(1, START, COLD, {
      key: 'slide',
      play: playFor('slide'),
      t: 10,
      sounding: false,
      reduced: false,
    })

    // Assert
    const [hold, glide, after] = s.tops[0].stretches
    expect(hold.kind === 'level' && hold.c).toBeCloseTo(31.19, 2)
    expect(glide.kind).toBe('wave')
    expect(after.kind === 'level' && after.c).toBeCloseTo(0, 9)
  })
})
