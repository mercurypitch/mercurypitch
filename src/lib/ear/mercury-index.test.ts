// ============================================================
// Ear Lab — the Mercury Index composite.
// ============================================================

import { describe, expect, it } from 'vitest'
import type { ReadingScale } from './drills'
import { findIdentificationDrill, findThresholdDrill, guessRate, IDENTIFICATION_DRILLS, THRESHOLD_DRILLS, } from './drills'
import type { FacultyReading } from './mercury-index'
import { FACULTY_WEIGHTS, INDEX_MAX, mercuryIndex, scoreReading, } from './mercury-index'

const CENTS: ReadingScale = { novice: 40, expert: 3, curve: 'log' }
const SPAN: ReadingScale = { novice: 3, expert: 9, curve: 'linear' }

describe('scoreReading', () => {
  it('anchors the novice reading at zero and the expert at full', () => {
    expect(scoreReading(40, CENTS)).toBe(0)
    expect(scoreReading(3, CENTS)).toBe(INDEX_MAX)
    expect(scoreReading(3, SPAN)).toBe(0)
    expect(scoreReading(9, SPAN)).toBe(INDEX_MAX)
  })

  it('rises as a threshold falls', () => {
    // The core inversion: a smaller cents reading is a better ear.
    expect(scoreReading(10, CENTS)).toBeGreaterThan(scoreReading(20, CENTS))
    expect(scoreReading(5, CENTS)).toBeGreaterThan(scoreReading(10, CENTS))
  })

  it('rises as a span grows', () => {
    expect(scoreReading(7, SPAN)).toBeGreaterThan(scoreReading(5, SPAN))
  })

  it('clamps beyond either anchor', () => {
    expect(scoreReading(200, CENTS)).toBe(0)
    expect(scoreReading(0.5, CENTS)).toBe(INDEX_MAX)
    expect(scoreReading(20, SPAN)).toBe(INDEX_MAX)
    expect(scoreReading(1, SPAN)).toBe(0)
  })

  it('places the log midpoint at the geometric mean, not the arithmetic one', () => {
    const geometric = Math.sqrt(40 * 3)
    expect(scoreReading(geometric, CENTS)).toBe(INDEX_MAX / 2)
    expect(scoreReading((40 + 3) / 2, CENTS)).toBeLessThan(INDEX_MAX / 2)
  })

  it('refuses to read a non-positive value as a perfect ear', () => {
    expect(scoreReading(0, CENTS)).toBe(0)
    expect(scoreReading(-5, CENTS)).toBe(0)
  })

  it('returns zero for a degenerate scale', () => {
    expect(scoreReading(5, { novice: 5, expert: 5, curve: 'linear' })).toBe(0)
  })
})

describe('mercuryIndex', () => {
  const reading = (
    faculty: FacultyReading['faculty'],
    value: number,
    scale: ReadingScale,
  ): FacultyReading => ({ faculty, value, scale })

  it('reads zero with nothing measured yet', () => {
    const index = mercuryIndex([])
    expect(index.value).toBe(0)
    expect(index.missing).toHaveLength(Object.keys(FACULTY_WEIGHTS).length)
  })

  it('averages only the faculties that have a reading', () => {
    // One faculty at full marks reads full — an untouched drill is
    // missing data, not a failing ear.
    const index = mercuryIndex([reading('resolution', 3, CENTS)])
    expect(index.value).toBe(INDEX_MAX)
    expect(index.parts.resolution).toBe(INDEX_MAX)
    expect(index.missing).not.toContain('resolution')
    expect(index.missing).toContain('function')
  })

  it('weights function above time', () => {
    const strongFunction = mercuryIndex([
      reading('function', 2000, { novice: 800, expert: 2000, curve: 'linear' }),
      reading('time', 55, { novice: 55, expert: 10, curve: 'log' }),
    ])
    const strongTime = mercuryIndex([
      reading('function', 800, { novice: 800, expert: 2000, curve: 'linear' }),
      reading('time', 10, { novice: 55, expert: 10, curve: 'log' }),
    ])
    expect(strongFunction.value).toBeGreaterThan(strongTime.value)
  })

  it('averages several drills measuring the same faculty', () => {
    // Shape measured by two drills: a perfect one and a novice one
    // must read as the middle, not as whichever came last.
    const index = mercuryIndex([
      reading('shape', 9, SPAN),
      reading('shape', 3, SPAN),
    ])
    expect(index.parts.shape).toBe(INDEX_MAX / 2)
    expect(index.value).toBe(INDEX_MAX / 2)
  })

  it('normalises over present faculties rather than the full set', () => {
    const half = mercuryIndex([
      reading('resolution', Math.sqrt(40 * 3), CENTS),
      reading('shape', 6, SPAN),
    ])
    expect(half.value).toBe(INDEX_MAX / 2)
  })

  it('lists every unmeasured faculty so the column can show a dashed cap', () => {
    const index = mercuryIndex([
      reading('resolution', 10, CENTS),
      reading('shape', 6, SPAN),
    ])
    expect(index.missing.sort()).toEqual(['colour', 'function', 'time', 'wild'])
  })

  it('rises monotonically as every faculty improves', () => {
    const at = (cents: number, span: number) =>
      mercuryIndex([
        reading('resolution', cents, CENTS),
        reading('shape', span, SPAN),
      ]).value
    expect(at(30, 4)).toBeLessThan(at(15, 6))
    expect(at(15, 6)).toBeLessThan(at(5, 8))
  })
})

describe('drill catalogue', () => {
  it('gives every drill a unique id', () => {
    const ids = [...THRESHOLD_DRILLS, ...IDENTIFICATION_DRILLS].map((d) => d.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('scores every threshold drill’s novice anchor at zero and expert at full', () => {
    for (const drill of THRESHOLD_DRILLS) {
      expect(scoreReading(drill.scale.novice, drill.scale)).toBe(0)
      expect(scoreReading(drill.scale.expert, drill.scale)).toBe(INDEX_MAX)
    }
  })

  it('starts every staircase between its own floor and ceiling', () => {
    for (const { staircase: s } of THRESHOLD_DRILLS) {
      expect(s.start).toBeGreaterThanOrEqual(s.min)
      expect(s.start).toBeLessThanOrEqual(s.max)
      expect(s.reversalsToAverage % 2).toBe(0)
      expect(s.reversalsToAverage).toBeLessThanOrEqual(s.reversalsToStop)
    }
  })

  it('derives the guess floor from the choices actually rendered', () => {
    const home = findIdentificationDrill('home')
    expect(home && guessRate(home)).toBeCloseTo(1 / 7, 10)
  })

  it('gives played-back drills no guess floor', () => {
    // Echo and Pulse are answered on an instrument, so there is no
    // menu to luck into.
    for (const id of ['echo', 'pulse']) {
      const drill = findIdentificationDrill(id)
      expect(drill && guessRate(drill)).toBe(0)
    }
  })

  it('looks drills up by id', () => {
    expect(findThresholdDrill('hairline')?.unit).toBe('cents')
    expect(findThresholdDrill('nope')).toBeUndefined()
    expect(findIdentificationDrill('nope')).toBeUndefined()
  })
})
