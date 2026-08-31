// ============================================================
// rhythm-notation: the gap to the next onset is the note's value, a
// pattern that starts late gets its rest first, flagged notes inside
// one beat are beamed, and nothing is written across a barline.
// ============================================================

import { describe, expect, it } from 'vitest'
import { PULSE_BANK } from './banks'
import type { RhythmSymbol } from './rhythm-notation'
import { beamGroups, gridFractions, readRhythm, tupletSpans, WRITTEN_BAR, } from './rhythm-notation'
import { barBeats } from './rhythm-take'

const notes = (symbols: readonly RhythmSymbol[]): RhythmSymbol[] =>
  symbols.filter((symbol) => symbol.kind === 'note')
const rests = (symbols: readonly RhythmSymbol[]): RhythmSymbol[] =>
  symbols.filter((symbol) => symbol.kind === 'rest')

describe('readRhythm', () => {
  it('reads a note value off the gap to the next onset', () => {
    // Quarter, quarter, and a half that runs to the end of the bar.
    const symbols = readRhythm([0, 1, 2], 4)
    expect(notes(symbols).map((n) => n.beats)).toEqual([1, 1, 2])
    expect(notes(symbols).map((n) => n.value)).toEqual([1, 1, 2])
    expect(rests(symbols)).toHaveLength(0)
  })

  it('dots a note rather than inventing a rest for it', () => {
    // 0 → 1.5 is a dotted quarter, not a quarter and an eighth rest.
    const symbols = readRhythm([0, 1.5, 2, 3], 4)
    expect(notes(symbols)[0]).toMatchObject({
      beats: 1.5,
      value: 1,
      dotted: true,
      flags: 0,
    })
    expect(rests(symbols)).toHaveLength(0)
  })

  it('writes the rest a pattern that starts off the beat opens with', () => {
    const symbols = readRhythm([0.5, 1, 2.5, 3], 4)
    expect(symbols[0]).toMatchObject({ kind: 'rest', beat: 0, beats: 0.5 })
    expect(notes(symbols).map((n) => n.beat)).toEqual([0.5, 1, 2.5, 3])
  })

  it('fills a silent bar with rests it can read', () => {
    const symbols = readRhythm([], 4)
    expect(notes(symbols)).toHaveLength(0)
    expect(rests(symbols).map((r) => r.beats)).toEqual([4])
  })

  it('never writes a value across the barline', () => {
    // The onset on three lasts two beats, and the bar ends after one.
    const symbols = readRhythm([0, 3, 4, 6], 8)
    for (const symbol of symbols) {
      expect(Math.floor((symbol.beat + 1e-6) / WRITTEN_BAR)).toBe(
        Math.floor((symbol.beat + symbol.beats - 1e-6) / WRITTEN_BAR),
      )
    }
  })

  it('reads the triplet as thirds of a beat', () => {
    const symbols = readRhythm([0, 1 / 3, 2 / 3, 1], 4)
    const written = notes(symbols)
    expect(written.slice(0, 3).map((n) => n.tuplet)).toEqual([3, 3, 3])
    expect(written.slice(0, 3).map((n) => n.flags)).toEqual([1, 1, 1])
    // and the last onset holds the remaining three beats
    expect(written[3]).toMatchObject({ beats: 3, value: 2, dotted: true })
  })

  it('writes every bank pattern back onto its own onsets', () => {
    for (const item of PULSE_BANK) {
      const bar = barBeats(item.payload)
      const symbols = readRhythm(item.payload, bar)
      const written = notes(symbols).map((n) => n.beat)
      expect(written).toEqual([...item.payload])
      // and the symbols tile the bar exactly, with no gap or overrun
      let at = 0
      for (const symbol of symbols) {
        expect(symbol.beat).toBeCloseTo(at, 6)
        at += symbol.beats
      }
      expect(at).toBeCloseTo(bar, 6)
    }
  })
})

describe('beamGroups', () => {
  it('beams the flagged notes that share a beat', () => {
    const symbols = readRhythm([0, 0.5, 1, 1.5, 2, 3], 4)
    const groups = beamGroups(symbols)
    expect(groups).toHaveLength(2)
    expect(groups.map((group) => group.members)).toEqual([
      [0, 1],
      [2, 3],
    ])
  })

  it('leaves a lone eighth its flag', () => {
    // The eighth on the and of one has no neighbour inside beat one.
    const symbols = readRhythm([0, 1.5, 2, 3], 4)
    expect(beamGroups(symbols)).toHaveLength(0)
  })

  it('stubs the sixteenth of a gallop back at the note it follows', () => {
    const symbols = readRhythm([0, 0.75, 1, 2], 4)
    const groups = beamGroups(symbols)
    expect(groups).toHaveLength(1)
    expect(groups[0].members).toEqual([0, 1])
    expect(groups[0].segments).toEqual([
      { level: 1, from: 0, to: 1, stub: null },
      { level: 2, from: 1, to: 1, stub: 'left' },
    ])
  })

  it('runs the second beam under the sixteenths that share it', () => {
    const symbols = readRhythm([0, 0.5, 0.75, 1, 2.5], 4)
    const groups = beamGroups(symbols)
    expect(groups[0].members).toEqual([0, 1, 2])
    expect(groups[0].segments).toContainEqual({
      level: 2,
      from: 1,
      to: 2,
      stub: null,
    })
  })

  it('does not beam across a beat, or across a rest', () => {
    const symbols = readRhythm([0.5, 1, 2.5, 3], 4)
    expect(beamGroups(symbols)).toHaveLength(0)
  })
})

describe('tupletSpans', () => {
  it('marks a beamed triplet with its numeral alone', () => {
    const symbols = readRhythm([0, 1 / 3, 2 / 3, 1], 4)
    const spans = tupletSpans(symbols, beamGroups(symbols))
    expect(spans).toHaveLength(1)
    expect(spans[0]).toMatchObject({ number: 3, from: 0, to: 2, beamed: true })
  })

  it('finds nothing to mark in a pattern with no tuplet', () => {
    const symbols = readRhythm([0, 0.5, 1, 2], 4)
    expect(tupletSpans(symbols, beamGroups(symbols))).toHaveLength(0)
  })
})

describe('gridFractions', () => {
  it('has nothing to draw for quarters — the beats are the grid', () => {
    expect(gridFractions('quarters')).toEqual([])
  })

  it('marks the places a note can sit inside the beat', () => {
    expect(gridFractions('eighths')).toEqual([0.5])
    expect(gridFractions('triplets')).toEqual([1 / 3, 2 / 3])
    expect(gridFractions('sixteenths')).toEqual([0.25, 0.5, 0.75])
  })
})
