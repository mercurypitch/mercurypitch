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
import { arcPath, dialSeats, octaveArcPath, octaveArcs, octaveAtPoint, octavesIn, PITCH_CLASSES, pitchClassAvailable, polarPoint, rangeBand, rangeEnds, rangePosition, resolvePick, seatAtPoint, seatPoint, splitNote, } from '@/components/note-dial-model'

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

// ============================================================
// Octave segments on the rim
// ============================================================
//
// The rim already showed range position. Dividing it by octave makes
// the boundary a tick on that same gauge — but ONLY if the segments are
// proportional to what each octave actually holds. Equal slices are
// right for C3-B5 by coincidence and wrong for every range that does
// not start on a C, and the failure is silent: the marker just sits in
// the neighbouring segment and the design quietly stops being true.

const TOP = -Math.PI / 2

/** The fraction of a full turn an angle sits at, measured from the top. */
const turnOf = (angle: number): number => {
  let a = angle
  while (a < TOP) a += Math.PI * 2
  return (a - TOP) / (Math.PI * 2)
}

describe('octave arcs', () => {
  it('gives every octave in the range a segment, in order', () => {
    const arcs = octaveArcs(TENOR, midiOf)
    expect(arcs.map((a) => a.octave)).toEqual([3, 4, 5])
  })

  it('draws nothing when there is no boundary to draw', () => {
    expect(octaveArcs(['C4', 'D4', 'E4'], midiOf)).toEqual([])
    expect(octaveArcs(['C4'], midiOf)).toEqual([])
    expect(octaveArcs([], midiOf)).toEqual([])
  })

  it('tiles the whole ring, so no tap lands on nothing', () => {
    // Segments run to the midpoint of the semitone between octaves. Ending
    // each at its own last note instead left a semitone of dead ring at
    // every boundary — 14 degrees of the tenor dial that did nothing.
    const arcs = octaveArcs(TENOR, midiOf)
    expect(turnOf(arcs[0].start)).toBeLessThan(0.02)
    expect(turnOf(arcs[arcs.length - 1].end)).toBeGreaterThan(0.98)
    for (let i = 1; i < arcs.length; i++) {
      const gap = turnOf(arcs[i].start) - turnOf(arcs[i - 1].end)
      // Only the cosmetic separator, never a semitone of nothing.
      expect(gap).toBeGreaterThan(0)
      expect(gap).toBeLessThan(0.02)
    }
  })

  it('splits three whole octaves into near-thirds', () => {
    const arcs = octaveArcs(TENOR, midiOf)
    const spans = arcs.map((a) => turnOf(a.end) - turnOf(a.start))
    for (const span of spans) expect(span).toBeCloseTo(1 / 3, 1)
  })

  it('sizes an UNEVEN range by what each octave actually holds', () => {
    // A3-C5: octave 3 holds A3-B3 (3 notes), 4 holds C4-B4 (12), 5 holds
    // C5 alone. Equal thirds would be a lie about all three.
    const notes: string[] = []
    for (let m = midiOf('A3'); m <= midiOf('C5'); m++) {
      const pc = PITCH_CLASSES[m % 12]
      notes.push(`${pc}${Math.floor(m / 12) - 1}`)
    }
    const arcs = octaveArcs(notes, midiOf)
    const span = (o: number): number => {
      const a = arcs.find((x) => x.octave === o)!
      return turnOf(a.end) - turnOf(a.start)
    }
    expect(span(4)).toBeGreaterThan(span(3) * 2)
    expect(span(3)).toBeGreaterThan(span(5))
  })

  it('puts the selected note inside its OWN octave segment', () => {
    // The whole claim of the design, checked on a range that does not
    // start on a C. Equal slices fail this.
    const notes: string[] = []
    for (let m = midiOf('E2'); m <= midiOf('G5'); m++) {
      const pc = PITCH_CLASSES[m % 12]
      notes.push(`${pc}${Math.floor(m / 12) - 1}`)
    }
    const arcs = octaveArcs(notes, midiOf)
    for (const note of notes) {
      const octave = splitNote(note)!.octave
      const arc = arcs.find((a) => a.octave === octave)!
      const at = rangePosition(note, notes, midiOf)
      // Allow the gap that separates neighbouring segments.
      expect(at).toBeGreaterThanOrEqual(turnOf(arc.start) - 0.02)
      expect(at).toBeLessThanOrEqual(turnOf(arc.end) + 0.02)
    }
  })

  it('never draws a segment backwards, however thin', () => {
    // One octave holding a single note would go negative once the gap
    // is trimmed off both ends.
    const arcs = octaveArcs(['B3', 'C4', 'C#4', 'D4'], midiOf)
    for (const arc of arcs) expect(arc.end).toBeGreaterThanOrEqual(arc.start)
  })

  it('leaves a visible gap between neighbours', () => {
    const arcs = octaveArcs(TENOR, midiOf)
    for (let i = 1; i < arcs.length; i++) {
      expect(turnOf(arcs[i].start)).toBeGreaterThan(turnOf(arcs[i - 1].end))
    }
  })
})

describe('octave arc hit-testing', () => {
  const arcs = octaveArcs(TENOR, midiOf)

  /** A point on the ring at the midpoint of the given octave's segment. */
  const onArc = (octave: number, radius = 1): { x: number; y: number } =>
    polarPoint(arcs.find((a) => a.octave === octave)!.mid, radius)

  it('resolves a pointer on the ring to the segment under it', () => {
    for (const octave of [3, 4, 5]) {
      const p = onArc(octave)
      expect(octaveAtPoint(p.x, p.y, arcs)?.octave).toBe(octave)
    }
  })

  it('ignores the seats, which own everything inside the ring', () => {
    // The outermost natural reaches ~0.9 of the radius. If the ring
    // reached in that far, tapping C would change the octave instead.
    const p = onArc(4, 0.74)
    expect(octaveAtPoint(p.x, p.y, arcs)).toBeNull()
    expect(octaveAtPoint(0, 0, arcs)).toBeNull()
  })

  it('ignores a pointer well outside the dial', () => {
    const p = onArc(4, 2.0)
    expect(octaveAtPoint(p.x, p.y, arcs)).toBeNull()
  })

  it('hands a tap in the boundary gap to the nearer segment', () => {
    const lower = arcs.find((a) => a.octave === 3)!
    const upper = arcs.find((a) => a.octave === 4)!
    const justAfter = polarPoint(lower.end + 0.01, 1)
    const justBefore = polarPoint(upper.start - 0.01, 1)
    expect(octaveAtPoint(justAfter.x, justAfter.y, arcs)?.octave).toBe(3)
    expect(octaveAtPoint(justBefore.x, justBefore.y, arcs)?.octave).toBe(4)
  })

  it('resolves every angle on the ring to some octave', () => {
    // No dead zones: a full sweep of the ring must always land somewhere.
    let misses = 0
    for (let i = 0; i < 360; i++) {
      const p = polarPoint(TOP + (i / 360) * Math.PI * 2, 1)
      if (octaveAtPoint(p.x, p.y, arcs) === null) misses++
    }
    expect(misses).toBe(0)
  })
})

describe('octave arc paths', () => {
  it('draws an arc between the segment ends', () => {
    const [arc] = octaveArcs(TENOR, midiOf)
    const d = octaveArcPath(arc, 100, 100, 90)
    expect(d.startsWith('M ')).toBe(true)
    expect(d).toContain(' A 90 90 ')
  })

  it('flags the large-arc case so a two-octave range still draws', () => {
    // Two octaves means each segment is nearly half the circle; one of
    // them crosses the 180-degree threshold where the flag matters.
    const notes: string[] = []
    for (const octave of [3, 4]) {
      for (const pc of PITCH_CLASSES) notes.push(`${pc}${octave}`)
    }
    const arcs = octaveArcs(notes, midiOf)
    const flags = arcs.map((a) => octaveArcPath(a, 100, 100, 90).split(' ')[7])
    expect(flags.every((f) => f === '0' || f === '1')).toBe(true)
  })
})
