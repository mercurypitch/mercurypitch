// ============================================================
// Scale-state sync — Rows/octave rebuilds keep the chosen scale type
// ============================================================
//
// Regression for the Compose bug where picking a scale in the roll toolbar
// updated only the editor + an app-store signal, so the store's tracked
// _scaleType stayed 'major' and the next Rows +/- rebuilt the grid in
// C major while the select still showed the user's choice.

import { describe, expect, it } from 'vitest'
import { currentScale, refreshScale, setNumOctaves, setOctave, } from '@/stores/melody-store'

const names = () => currentScale().map((d) => `${d.name}${d.octave}`)
const hasSharps = () => currentScale().some((d) => d.name.includes('#'))

describe('melody-store scale rebuilds', () => {
  it('setNumOctaves keeps the scale type set by refreshScale', () => {
    refreshScale('C', 2, 'harmonic-minor')
    expect(hasSharps()).toBe(true) // C harmonic minor carries D#/G#

    setNumOctaves(3)
    expect(hasSharps()).toBe(true)
    // Root stays C2 at the bottom (scale is high→low)
    expect(names()[names().length - 1]).toBe('C2')

    setNumOctaves(2)
    expect(hasSharps()).toBe(true)
  })

  it('setOctave keeps key and type while moving the window', () => {
    refreshScale('G', 3, 'natural-minor')
    setOctave(2)
    const list = names()
    expect(list[list.length - 1]).toBe('G2')
    // G natural minor includes A# — type survived the octave move
    expect(currentScale().some((d) => d.name === 'A#')).toBe(true)
  })

  it('restores majors cleanly afterwards', () => {
    refreshScale('C', 3, 'major')
    setNumOctaves(2)
    expect(hasSharps()).toBe(false)
  })
})
