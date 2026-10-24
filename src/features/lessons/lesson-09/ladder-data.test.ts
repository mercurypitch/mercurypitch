// ============================================================
// Lesson 9 ladder data tests — the ladders, their spelling, Move do, windows
// ============================================================
//
// WEB-SPEC, Tests 1 to 3: the full and smaller ladders from D3 and D4 equal
// FACTS 20 and 90, their leaps 4, 3, 7, 5 and 12 semitones, and both sit
// inside every preset of their voice with two semitones to spare, against
// the app's own VOCAL_RANGES (FACTS 73); at every Move do position the
// rungs are `majorScale(do)` at degrees 1, 3, 5 and 8, as FACTS 22's table
// spells them, and every spoken name says its sign in words; Move do stops
// at four either way, and from there the full ladder can fill the middle
// half of each of the six presets (FACTS 75). Tests 3's disabled end
// buttons are the page's, so Sing it's tests hold them. And the windows of
// Toys 1.

import { describe, expect, it } from 'vitest'
import { majorScale } from '@/features/lessons/kit/major-scale'
import { MOVE_MAX } from '@/features/lessons/kit/move-do'
import { hz, signName } from '@/features/lessons/kit/notes'
import type { Voice } from '@/features/lessons/kit/voice-choice'
import { middleHalf } from '@/lib/mirror/metrics'
import type { VocalRangePreset } from '@/stores/settings-store'
import { VOCAL_RANGES } from '@/stores/settings-store'
import type { ChartState, LadderId, Leap } from './ladder-data'
import { doOf, HOME_DO, ladderNotes, LADDERS, ladderSteps, ladderTop, leapName, leapSize, liveWindow, RUNG_ORDER, rungMidi, rungName, spelledRung, windowOf, } from './ladder-data'

const VOICES: readonly Voice[] = ['lower', 'higher']
const LADDER_IDS: readonly LadderId[] = ['full', 'smaller']
const PRESETS: Readonly<Record<Voice, readonly VocalRangePreset[]>> = {
  lower: ['bass', 'baritone', 'tenor'],
  higher: ['alto', 'mezzo-soprano', 'soprano'],
}
/** Every Move do position: four either way. */
const SHIFTS = [-4, -3, -2, -1, 0, 1, 2, 3, 4]

/** FACTS 90: every fixed note, MIDI to hertz, to two decimals. */
const FACTS_90: Readonly<Record<number, number>> = {
  50: 146.83,
  52: 164.81,
  54: 185.0,
  55: 196.0,
  57: 220.0,
  62: 293.66,
  64: 329.63,
  66: 369.99,
  67: 392.0,
  69: 440.0,
  74: 587.33,
}

describe('the two ladders', () => {
  it('climb D3 F♯3 A3 D4 and D4 F♯4 A4 D5, at FACTS 90’s frequencies', () => {
    // Act
    const lower = ladderNotes('full', doOf('lower'))
    const higher = ladderNotes('full', doOf('higher'))

    // Assert: FACTS 20 and 90
    expect(lower).toEqual([50, 54, 57, 62])
    expect(higher).toEqual([62, 66, 69, 74])
    for (const m of [...lower, ...higher])
      expect(hz(m), `MIDI ${m}`).toBeCloseTo(FACTS_90[m], 2)
  })

  it('go do, mi, so, mi, do on the smaller one, labelled for the reading lines', () => {
    // Assert
    expect(ladderNotes('smaller', doOf('lower'))).toEqual([50, 54, 57, 54, 50])
    expect(ladderNotes('smaller', doOf('higher'))).toEqual([62, 66, 69, 66, 62])
    expect(LADDERS.full.map((n) => n.label)).toEqual([
      'Do',
      'Mi',
      'So',
      'Top do',
    ])
    expect(LADDERS.smaller.map((n) => n.label)).toEqual([
      'Do',
      'Mi',
      'So',
      'Mi again',
      'Do again',
    ])
    expect(ladderTop('full')).toBe(12)
    expect(ladderTop('smaller')).toBe(7)
  })

  it('hold the five leaps, 4, 3, 7, 5 and 12 semitones, each named', () => {
    // Arrange: FACTS 20's leaps, in the ladder's order
    const leaps: readonly Leap[] = [
      { from: 'do', to: 'mi' },
      { from: 'mi', to: 'so' },
      { from: 'do', to: 'so' },
      { from: 'so', to: 'top' },
      { from: 'do', to: 'top' },
    ]
    const [d, m, s, t] = ladderNotes('full', 50)

    // Act
    const sizes = leaps.map(leapSize)

    // Assert: the sizes measured on the ladder's own notes too
    expect(sizes).toEqual([4, 3, 7, 5, 12])
    expect([m - d, s - m, s - d, t - s, t - d]).toEqual(sizes)
    expect(sizes.map(leapName)).toEqual([
      'a major third',
      'a minor third',
      'a perfect fifth',
      'a perfect fourth',
      'an octave',
    ])
    expect(leapSize({ from: 'top', to: 'so' })).toBe(-5)
  })

  it('names the step a tone, a move either way alike, and never mi to the top do', () => {
    // Act
    const names = [2, -5, 8].map(leapName)

    // Assert: mi to the top do is on the ladder, and never named (FACTS 20)
    expect(names).toEqual(['a tone', 'a perfect fourth', null])
  })

  it("sit inside every preset of their voice, FACTS 73's margins at each end", () => {
    // Arrange: below and above, each preset's bottom and top to the full ladder's
    const margins: Readonly<Record<VocalRangePreset, [number, number]>> = {
      bass: [10, 2],
      baritone: [7, 5],
      tenor: [2, 10],
      alto: [9, 3],
      'mezzo-soprano': [5, 7],
      soprano: [2, 10],
    }

    for (const v of VOICES)
      for (const id of PRESETS[v]) {
        // Act
        const full = ladderNotes('full', doOf(v))
        const smaller = ladderNotes('smaller', doOf(v))
        const r = VOCAL_RANGES[id]
        const below = Math.min(...full) - r.lowMidi
        const above = r.highMidi - Math.max(...full)

        // Assert
        expect([below, above], id).toEqual(margins[id])
        expect(Math.min(below, above), id).toBeGreaterThanOrEqual(2)
        // the smaller ladder, up to so, leaves 5 more at the top
        expect(r.highMidi - Math.max(...smaller), id).toBe(above + 5)
      }
  })
})

describe('spelling', () => {
  it("names the rungs as FACTS 22's table does, at every Move do position", () => {
    // Arrange: do from B♭2 to F♯3, lower voice
    const table = [
      'B♭ D F B♭',
      'B D♯ F♯ B',
      'C E G C',
      'D♭ F A♭ D♭',
      'D F♯ A D',
      'E♭ G B♭ E♭',
      'E G♯ B E',
      'F A C F',
      'F♯ A♯ C♯ F♯',
    ]

    for (const v of VOICES) {
      // Act
      const read = SHIFTS.map((s) =>
        RUNG_ORDER.map((id) =>
          signName(spelledRung(doOf(v, s), id), { octave: false }),
        ).join(' '),
      )

      // Assert
      expect(read, v).toEqual(table)
    }
  })

  it('takes the rungs from majorScale(do) at degrees 1, 3, 5 and 8, never a double sign or E♯, B♯, C♭, F♭', () => {
    for (const v of VOICES)
      for (const s of SHIFTS) {
        // Arrange
        const d = doOf(v, s)
        const scale = majorScale(d)

        // Act
        const rungs = RUNG_ORDER.map((id) => spelledRung(d, id))

        // Assert
        expect(rungs).toEqual([scale[0], scale[2], scale[4], scale[7]])
        for (const r of rungs) {
          const name = signName(r, { octave: false })
          expect(Math.abs(r.alter), name).toBeLessThanOrEqual(1)
          expect(['E♯', 'B♯', 'C♭', 'F♭']).not.toContain(name)
        }
        // the rungs' MIDI notes are the ladder's own
        expect(RUNG_ORDER.map((id) => rungMidi(d, id))).toEqual(
          ladderNotes('full', d),
        )
      }
  })

  it('names each rung in signs for the canvas and in words for a screen reader', () => {
    // Act
    const mi = rungName(doOf('lower'), 'mi')
    const top = rungName(doOf('higher'), 'top')

    // Assert
    expect(mi.text).toBe('mi · F♯3')
    expect(mi.spoken).toBe('mi, F sharp 3')
    expect(mi.html).toBe(
      'mi · F<span aria-hidden="true">♯</span><span class="sr"> sharp </span>3',
    )
    expect(top).toEqual({
      text: 'top do · D5',
      html: 'top do · D5',
      spoken: 'top do, D5',
    })
    expect(rungName(doOf('lower', -4), 'so').spoken).toBe('so, F3')
    expect(rungName(doOf('lower', -4), 'do').spoken).toBe('do, B flat 2')
  })

  it('says every sign in words and never prints one in a spoken name', () => {
    for (const v of VOICES)
      for (const s of SHIFTS)
        for (const id of RUNG_ORDER) {
          // Act
          const d = doOf(v, s)
          const { spoken } = rungName(d, id)
          const { alter } = spelledRung(d, id)

          // Assert
          expect(spoken).not.toMatch(/[♯♭]/)
          expect(/ (sharp|flat) /.test(spoken), spoken).toBe(alter !== 0)
        }
  })
})

describe('Move do', () => {
  it('moves do four semitones either way and no further', () => {
    for (const v of VOICES) {
      // Act
      const dos = [-6, -5, ...SHIFTS, 5, 6].map((s) => doOf(v, s))

      // Assert
      expect(Math.min(...dos)).toBe(HOME_DO[v] - MOVE_MAX)
      expect(Math.max(...dos)).toBe(HOME_DO[v] + MOVE_MAX)
    }
    expect(MOVE_MAX).toBe(4)
  })

  it('runs the lower ladder from B♭2 to F♯4 and the higher from B♭3 to F♯5 (FACTS 90)', () => {
    for (const [v, lo, hi, loHz, hiHz] of [
      ['lower', 46, 66, 116.54, 369.99],
      ['higher', 58, 78, 233.08, 739.99],
    ] as const) {
      // Act
      const notes = SHIFTS.flatMap((s) => ladderNotes('full', doOf(v, s)))

      // Assert
      expect([Math.min(...notes), Math.max(...notes)]).toEqual([lo, hi])
      expect(hz(lo)).toBeCloseTo(loHz, 2)
      expect(hz(hi)).toBeCloseTo(hiHz, 2)
    }
  })

  it('fills the middle half of each preset exactly with the full ladder, within the four', () => {
    // Arrange: FACTS 75's middle halves, MIDI
    const halves: Readonly<Record<VocalRangePreset, [number, number]>> = {
      bass: [46, 58],
      baritone: [49, 61],
      tenor: [54, 66],
      alto: [59, 71],
      'mezzo-soprano': [63, 75],
      soprano: [66, 78],
    }

    for (const v of VOICES)
      for (const id of PRESETS[v]) {
        // Act
        const r = VOCAL_RANGES[id]
        const half = middleHalf(r.lowMidi, r.highMidi)
        const shift = half.low - HOME_DO[v]
        const ladder = ladderNotes('full', doOf(v, shift))

        // Assert
        expect([half.low, half.high], id).toEqual(halves[id])
        expect(Math.abs(shift), id).toBeLessThanOrEqual(MOVE_MAX)
        expect([Math.min(...ladder), Math.max(...ladder)], id).toEqual([
          half.low,
          half.high,
        ])
      }
  })
})

describe('the windows', () => {
  const STATES: readonly ChartState[] = [
    'compact',
    'step',
    'hear',
    'ladder',
    'order',
    'landing',
    'free',
  ]

  it('span 11 semitones, do − 2 to so + 2, for the compact chart and Steps 1, 2 and 5', () => {
    for (const state of ['compact', 'step', 'hear', 'landing'] as const) {
      // Act
      const [lo, hi] = windowOf(state, 50)

      // Assert
      expect([lo, hi], state).toEqual([48, 59])
    }
  })

  it('span 14 semitones, do − 1 to the top do + 1, for Steps 3 and 4 and free play', () => {
    for (const state of ['ladder', 'order', 'free'] as const) {
      // Act
      const [lo, hi] = windowOf(state, 62)

      // Assert
      expect([lo, hi], state).toEqual([61, 75])
    }
  })

  it('hold every rung each state draws, in either voice', () => {
    // Arrange: the compact and two-slot states draw do and so; the rest the whole ladder
    const drawn = (state: ChartState): number[] =>
      ['compact', 'step', 'hear', 'landing'].includes(state)
        ? [0, 7]
        : ladderSteps('full')

    for (const v of VOICES)
      for (const state of STATES) {
        // Act
        const d = doOf(v)
        const [lo, hi] = windowOf(state, d)

        // Assert
        for (const s of drawn(state)) {
          expect(d + s, state).toBeGreaterThanOrEqual(lo)
          expect(d + s, state).toBeLessThanOrEqual(hi)
        }
      }
  })

  it("give Sing it's live chart 14 semitones for the full ladder and 9 for the smaller, wherever Move do puts do", () => {
    for (const v of VOICES)
      for (const s of SHIFTS)
        for (const id of LADDER_IDS) {
          // Act
          const d = doOf(v, s)
          const [lo, hi] = liveWindow(id, d)
          const notes = ladderNotes(id, d)

          // Assert
          expect(hi - lo).toBe(id === 'full' ? 14 : 9)
          expect(lo).toBe(Math.min(...notes) - 1)
          expect(hi).toBe(Math.max(...notes) + 1)
        }
  })
})
