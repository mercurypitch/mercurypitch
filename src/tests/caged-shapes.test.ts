import { describe, expect, it } from 'vitest'
import { CAGED_ORDER, CAGED_SHAPES, computeShapeFrets, findRootForShape, } from '@/lib/guitar/caged-shapes'
import { OPEN_MIDI } from '@/lib/guitar/constants'

describe('CAGED_SHAPES', () => {
  it('every shape places its own root on a playable fret at its rootString', () => {
    // Previously rootString/offsets were authored assuming OPEN_MIDI is
    // ordered low-E-first, but it's actually ordered high-e-first — every
    // shape's root ended up on the wrong string with several negative
    // (unplayable) frets.
    for (const name of CAGED_ORDER) {
      const shape = CAGED_SHAPES[name]
      const rootMidi = findRootForShape(shape, 48) // key of C
      const frets = computeShapeFrets(shape, rootMidi)

      const rootNote = frets.find(
        (f) => f.stringIndex === shape.rootString && f.midi === rootMidi,
      )
      expect(
        rootNote,
        `${name}-shape root not found on its rootString`,
      ).toBeDefined()
      expect(rootNote?.role).toBe('root')
      expect(rootNote!.fret).toBeGreaterThanOrEqual(0)
    }
  })

  it('does not produce a majority-unplayable (negative fret) shape for a low root', () => {
    // The pre-fix C-shape at MIDI 60 produced only 3 of 6 possible notes
    // (three strings landed on negative frets and were dropped).
    for (const name of CAGED_ORDER) {
      const shape = CAGED_SHAPES[name]
      const playable = shape.offsets.filter((o) => o !== null).length
      const rootMidi = findRootForShape(shape, 48) // key of C, nearest playable octave
      const frets = computeShapeFrets(shape, rootMidi)
      expect(
        frets.length,
        `${name}-shape only produced ${frets.length}/${playable} playable notes`,
      ).toBe(playable)
    }
  })

  it('E-shape barre voicing matches the real open-E-chord shape moved up to the root fret', () => {
    // Concrete, independently-verifiable anchor: an E-shape barre chord is
    // just the open E chord (0-2-2-1-0-0) shifted up by the barre fret.
    const shape = CAGED_SHAPES.E
    const rootMidi = 48 // C, per the shape's own calibration comment (fret 8 on low E)
    const frets = computeShapeFrets(shape, rootMidi)
    const byString = new Map(frets.map((f) => [f.stringIndex, f.fret]))

    expect(byString.get(5)).toBe(8) // low E (root)
    expect(byString.get(4)).toBe(10) // A
    expect(byString.get(3)).toBe(10) // D
    expect(byString.get(2)).toBe(9) // G
    expect(byString.get(1)).toBe(8) // B
    expect(byString.get(0)).toBe(8) // high e
  })

  it("rootString indices point at the string named in the shape's own calibration comment", () => {
    // OPEN_MIDI/STRING_LABELS are high-e-first: 0=e,1=B,2=G,3=D,4=A,5=E.
    expect(CAGED_SHAPES.C.rootString).toBe(4) // A string
    expect(CAGED_SHAPES.A.rootString).toBe(4) // A string
    expect(CAGED_SHAPES.G.rootString).toBe(5) // low E string
    expect(CAGED_SHAPES.E.rootString).toBe(5) // low E string
    expect(CAGED_SHAPES.D.rootString).toBe(3) // D string
  })

  it('OPEN_MIDI is high-e-first (sanity check the assumption this fix depends on)', () => {
    expect(OPEN_MIDI[0]).toBeGreaterThan(OPEN_MIDI[5])
  })
})
