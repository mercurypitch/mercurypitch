// ============================================================
// Note dial geometry
// ============================================================
//
// The prototype shipped a bug worth keeping a test for: pointer input
// resolved to the nearest of the seven NATURALS by angle, so the five
// sharps could never be hit — and because naturals still worked, it
// looked fine. Hit-testing is exactly the kind of thing that should fail
// in a suite rather than be noticed by someone clicking C#.

import { describe, expect, it } from 'vitest'
import { arcPath, dialSeats, octavesIn, PITCH_CLASSES, pitchClassAvailable, rangeBand, rangeEnds, rangePosition, resolvePick, seatAtPoint, seatPoint, splitNote, } from '@/components/note-dial-model'

const midiOf = (note: string): number => {
  const m = /^([A-G]#?)(-?\d+)$/.exec(note)
  if (m === null) return Number.NaN
  return (Number(m[2]) + 1) * 12 + PITCH_CLASSES.indexOf(m[1] as never)
}

/** Every note from C3 to B5 — what a tenor is offered. */
const TENOR = (() => {
  const out: string[] = []
  for (let octave = 3; octave <= 5; octave++) {
    for (const pc of PITCH_CLASSES) out.push(`${pc}${octave}`)
  }
  return out
})()

describe('seat layout', () => {
  it('gives all twelve pitch classes a seat', () => {
    const seats = dialSeats()
    expect(seats).toHaveLength(12)
    expect(seats.map((s) => s.pitchClass)).toEqual([...PITCH_CLASSES])
  })

  it('sets sharps inside the naturals, like black keys', () => {
    for (const seat of dialSeats()) {
      expect(seat.sharp).toBe(seat.pitchClass.includes('#'))
    }
    const naturals = dialSeats().filter((s) => !s.sharp)
    const sharps = dialSeats().filter((s) => s.sharp)
    expect(naturals).toHaveLength(7)
    expect(sharps).toHaveLength(5)
    expect(Math.max(...sharps.map((s) => s.radius))).toBeLessThan(
      Math.min(...naturals.map((s) => s.radius)),
    )
  })

  it('puts each sharp between the naturals it belongs between', () => {
    const at = (pc: string): number =>
      dialSeats().find((s) => s.pitchClass === pc)!.angle
    // C# sits between C and D; F# between F and G.
    expect(at('C#')).toBeGreaterThan(at('C'))
    expect(at('C#')).toBeLessThan(at('D'))
    expect(at('F#')).toBeGreaterThan(at('F'))
    expect(at('F#')).toBeLessThan(at('G'))
  })
})

describe('hit testing', () => {
  const seats = dialSeats()

  it('finds every seat at its own centre — sharps included', () => {
    // The regression: sharps were unreachable because the resolver only
    // knew the seven naturals.
    for (const seat of seats) {
      const p = seatPoint(seat)
      expect(seatAtPoint(p.x, p.y, seats)?.pitchClass).toBe(seat.pitchClass)
    }
  })

  it('reaches all five sharps specifically', () => {
    const sharps = seats.filter((s) => s.sharp)
    const hits = sharps.map((s) => {
      const p = seatPoint(s)
      return seatAtPoint(p.x, p.y, seats)?.pitchClass
    })
    expect(hits).toEqual(['C#', 'D#', 'F#', 'G#', 'A#'])
  })

  it('treats the hub as a readout, not a target', () => {
    expect(seatAtPoint(0, 0, seats)).toBeNull()
    expect(seatAtPoint(0.1, 0.1, seats)).toBeNull()
  })

  it('does not guess at a click on bare dial', () => {
    // Well outside the ring: snapping here would pick something arbitrary.
    expect(seatAtPoint(1.6, 1.6, seats)).toBeNull()
  })
})

describe('picking a pitch class', () => {
  it('stays in the current octave when it can', () => {
    expect(resolvePick('G', 'C4', TENOR)).toBe('G4')
    expect(resolvePick('A#', 'C4', TENOR)).toBe('A#4')
  })

  it('moves to the nearest octave that offers the class', () => {
    // A range that only has G in one octave.
    const sparse = ['E3', 'F3', 'G5', 'A5']
    expect(resolvePick('G', 'E3', sparse)).toBe('G5')
  })

  it('returns null when nothing offers the class', () => {
    expect(resolvePick('C#', 'E3', ['E3', 'F3', 'G3'])).toBeNull()
  })
})

describe('what the range readout says', () => {
  it('places the lowest and highest notes at the ends', () => {
    expect(rangePosition('C3', TENOR, midiOf)).toBe(0)
    expect(rangePosition('B5', TENOR, midiOf)).toBe(1)
  })

  it('bands the position into low, mid and high', () => {
    expect(rangeBand(0)).toBe('low')
    expect(rangeBand(0.5)).toBe('mid')
    expect(rangeBand(1)).toBe('high')
  })

  it('calls a single-note range the middle rather than dividing by zero', () => {
    expect(rangePosition('C4', ['C4'], midiOf)).toBe(0.5)
    expect(rangePosition('C4', [], midiOf)).toBe(0.5)
  })
})

describe('the range arc on the rim', () => {
  it('draws nothing at the bottom of the range', () => {
    expect(arcPath(0, 100, 100, 90)).toBe('')
  })

  it('starts at twelve o clock and sweeps clockwise', () => {
    // A quarter turn ends at three o'clock: (cx + r, cy).
    const d = arcPath(0.25, 100, 100, 90)
    expect(d.startsWith('M 100.000 10.000')).toBe(true)
    expect(d.endsWith('190.000 100.000')).toBe(true)
  })

  it('sets the large-arc flag only past the halfway point', () => {
    expect(arcPath(0.4, 100, 100, 90)).toContain('90 90 0 0 1')
    expect(arcPath(0.6, 100, 100, 90)).toContain('90 90 0 1 1')
  })

  it('closes a full sweep with two arcs, since one would not render', () => {
    // A single arc from a point back to itself is degenerate and draws
    // nothing — the highest note in the range would lose its gauge.
    const d = arcPath(1, 100, 100, 90)
    expect(d.match(/A /g)).toHaveLength(2)
  })

  it('clamps rather than trusting a position outside 0..1', () => {
    expect(arcPath(-0.5, 100, 100, 90)).toBe('')
    expect(arcPath(2, 100, 100, 90).match(/A /g)).toHaveLength(2)
  })
})

describe('naming the ends of the range', () => {
  it('reports the lowest and highest by pitch, not by list order', () => {
    expect(rangeEnds(['G4', 'C3', 'A#5', 'E3'], midiOf)).toEqual({
      low: 'C3',
      high: 'A#5',
    })
  })

  it('returns null for an empty range', () => {
    expect(rangeEnds([], midiOf)).toBeNull()
  })
})

describe('reading the note list', () => {
  it('splits names, sharps and all', () => {
    expect(splitNote('C4')).toEqual({ pitchClass: 'C', octave: 4 })
    expect(splitNote('A#2')).toEqual({ pitchClass: 'A#', octave: 2 })
    expect(splitNote('nonsense')).toBeNull()
  })

  it('lists the octaves on offer, in order', () => {
    expect(octavesIn(['C4', 'A3', 'G5', 'C4'])).toEqual([3, 4, 5])
  })

  it('knows which classes the range can reach', () => {
    expect(pitchClassAvailable('C#', TENOR)).toBe(true)
    expect(pitchClassAvailable('C#', ['E3', 'F3'])).toBe(false)
  })
})
