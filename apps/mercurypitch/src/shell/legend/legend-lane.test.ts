// ============================================================
// The Legend's lane: where the notes sit, what they show, where the voice is
// ============================================================

import { describe, expect, it } from 'vitest'
import type { ResolvedZenTarget, ZenPitchPoint, ZenTargetHighlight, } from '@/features/zen/types'
import { inCountIn, LANE, laneView, missesOf, posterView, traceView, } from './legend-lane'

/** The line the room's fixtures sing: up to a held G4 and home again. */
const LINE: [number, number, number][] = [
  [2, 1, 60],
  [3, 1, 62],
  [4, 1, 64],
  [5, 2, 67],
  [7, 1, 65],
  [8, 1, 64],
  [9, 1, 62],
  [10, 2, 60],
]

function targets(): ResolvedZenTarget[] {
  return LINE.map(([start, dur, midi], i) => ({
    id: `t${i}`,
    startBeat: start,
    durationBeats: dur,
    semitone: midi - 60,
    cue: '',
    startSec: start,
    endSec: start + dur,
    startMidi: midi,
    endMidi: midi,
  }))
}

/** A voice on every note, but `off` semitones away on the ones named. */
function sung(
  off: Record<number, number> = {},
  until = 12,
  step = 0.02,
): ZenPitchPoint[] {
  const points: ZenPitchPoint[] = []
  for (let t = 2; t <= until + 1e-9; t += step) {
    const i = LINE.findIndex(([s, d]) => t >= s && t < s + d)
    const k = i < 0 ? LINE.length - 1 : i
    points.push({ timeSec: t, midi: LINE[k][2] + (off[k] ?? 0) })
  }
  return points
}

const BOX = { width: 390, height: 497 }

/** The web stage's highlights: these notes lit, those missed. */
function lit(
  ids: string[],
  missed: string[] = [],
): Map<string, ZenTargetHighlight> {
  const highlights = new Map<string, ZenTargetHighlight>()
  for (const id of ids) {
    highlights.set(id, { glow: 0, cleared: true, missed: false })
  }
  for (const id of missed) {
    highlights.set(id, { glow: 0, cleared: false, missed: true })
  }
  return highlights
}

describe('the lane', () => {
  it('puts the note being sung under the now line', () => {
    const view = laneView(
      targets(),
      sung({}, 5.6),
      lit(['t0', 't1'], ['t2']),
      5.6,
      BOX,
    )
    const g4 = view.notes.find((note) => note.id === 't3')
    expect(g4?.look).toBe('now')
    expect(g4!.x).toBeLessThan(view.nowX)
    expect(g4!.x + g4!.width).toBeGreaterThan(view.nowX)
  })

  it('shows a passed note lit or missed as the highlight says, never by itself', () => {
    const view = laneView(
      targets(),
      sung({}, 5.6),
      lit(['t1'], ['t2']),
      5.6,
      BOX,
    )
    expect(view.notes.find((note) => note.id === 't1')?.look).toBe('lit')
    expect(view.notes.find((note) => note.id === 't2')?.look).toBe('missed')
    expect(view.notes.find((note) => note.id === 't4')?.look).toBe('ahead')
  })

  it('draws a higher note higher, one row to a pitch', () => {
    const view = laneView(targets(), [], new Map(), 0, BOX)
    expect(view.rows.map((row) => row.label)).toEqual([
      'G4',
      'F4',
      'E4',
      'D4',
      'C4',
    ])
    const ys = view.rows.map((row) => row.y)
    expect([...ys].sort((a, b) => a - b)).toEqual(ys)
  })

  it('keeps a narrow line from stretching past a semitone’s most', () => {
    const view = laneView(targets(), [], new Map(), 0, BOX)
    const g4 = view.rows[0].y
    const c4 = view.rows[view.rows.length - 1].y
    expect(c4 - g4).toBeLessThanOrEqual(7 * LANE.maxSemitonePx + 0.1)
  })

  it('says the count-in until the first note reaches the now line', () => {
    expect(inCountIn(targets(), 1.2)).toBe(true)
    expect(inCountIn(targets(), 2.1)).toBe(false)
    expect(inCountIn([], 5)).toBe(true)
  })

  it('draws the voice up to now, and lifts the pen over a silence', () => {
    const points = sung({}, 5.6).filter(
      (p) => p.timeSec < 3.5 || p.timeSec > 4.2,
    )
    const view = laneView(targets(), points, new Map(), 5.6, BOX)
    expect(view.voice.startsWith('M')).toBe(true)
    // One stroke before the silence, one after it.
    expect(view.voice.match(/M/g)).toHaveLength(2)
    expect(view.tip).not.toBeNull()
    expect(Math.abs(view.tip!.x - view.nowX)).toBeLessThan(2)
  })

  it('has no tip once the voice has stopped', () => {
    const view = laneView(targets(), sung({}, 5), new Map(), 5.6, BOX)
    expect(view.tip).toBeNull()
  })

  it('draws nothing for a line with no notes', () => {
    const view = laneView([], [], new Map(), 0, BOX)
    expect(view.notes).toEqual([])
    expect(view.voice).toBe('')
  })
})

describe('the trace', () => {
  it('fits the whole line into the box, every note lit or missed', () => {
    const view = traceView(
      targets(),
      sung({ 2: -0.7 }),
      lit(['t0', 't1', 't3', 't4', 't5', 't6', 't7'], ['t2']),
      { width: 326, height: 112 },
    )
    expect(view.notes).toHaveLength(8)
    expect(
      view.notes
        .filter((note) => note.look === 'missed')
        .map((note) => note.label),
    ).toEqual(['E4'])
    const last = view.notes[view.notes.length - 1]
    expect(last.x + last.width).toBeLessThanOrEqual(326)
    expect(view.notes[0].x).toBeGreaterThanOrEqual(0)
    expect(view.voice).not.toBe('')
  })
})

describe('the poster', () => {
  it('puts a bead at each note’s start, the thread through all of them', () => {
    const view = posterView(
      LINE.map(([start, dur, midi]) => ({
        startBeat: start,
        durationBeats: dur,
        midi,
      })),
      { width: 390, height: 250 },
    )
    expect(view.beads).toHaveLength(8)
    expect(view.beads[0].x).toBeLessThan(view.beads[1].x)
    // G4, the top of the line, is the highest bead.
    expect(Math.min(...view.beads.map((bead) => bead.y))).toBe(view.beads[3].y)
    expect(
      view.thread.startsWith(`M${view.beads[0].x} ${view.beads[0].y}`),
    ).toBe(true)
    // The thread's light runs from its first bead to its end.
    expect(view.from).toBe(view.beads[0].x)
    expect(view.thread.endsWith(`H${view.to}`)).toBe(true)
  })
})

describe('the misses', () => {
  it('says which way each missed note went', () => {
    const misses = missesOf(
      targets(),
      sung({ 2: -0.7, 4: 0.6 }),
      lit([], ['t2', 't4']),
    )
    expect(misses).toEqual([
      { label: 'E4', side: 'flat' },
      { label: 'F4', side: 'sharp' },
    ])
  })

  it('calls a note with nothing sung in it unsung', () => {
    const points = sung().filter((p) => p.timeSec < 4 || p.timeSec >= 5)
    expect(missesOf(targets(), points, lit([], ['t2']))).toEqual([
      { label: 'E4', side: 'unsung' },
    ])
  })

  it('calls a miss sung near the note unsteady', () => {
    expect(missesOf(targets(), sung({ 2: 0.1 }), lit([], ['t2']))).toEqual([
      { label: 'E4', side: 'unsteady' },
    ])
  })
})
