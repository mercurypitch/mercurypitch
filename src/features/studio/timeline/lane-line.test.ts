// Studio lane line helper tests — where a value sits in its lane, how it reads, and the point edits a hand makes.
import { describe, expect, it } from 'vitest'
import { STUDIO_MAX_AUTOMATION_POINTS } from '@/lib/studio/model/automation'
import { addStudioLinePoint, formatStudioLineValue, moveStudioLinePoint, removeStudioLinePoint, sameStudioLine, studioLineDepth, studioLineKeyStep, studioLinePointBounds, studioLineValue, studioLineValueAtDepth, } from './lane-line'

const line = [
  { frame: 0, value: 0 },
  { frame: 48000, value: -6 },
  { frame: 96000, value: -12 },
]

describe('Studio lane line places', () => {
  it.each([
    ['volume', 12, 0],
    ['volume', -60, 1],
    ['volume', 0, 1 / 6],
    ['pan', -1, 0],
    ['pan', 0, 0.5],
    ['pan', 1, 1],
  ] as const)(
    'puts %s %s at depth %s, louder or further left higher up',
    (param, value, depth) => {
      // Act
      const at = studioLineDepth(param, value)

      // Assert
      expect(at).toBeCloseTo(depth, 10)
      expect(studioLineValueAtDepth(param, at)).toBeCloseTo(value, 10)
    },
  )

  it('keeps a value past either end of the lane on the line’s travel and step', () => {
    // Act
    const values = [
      studioLineValueAtDepth('volume', -0.5),
      studioLineValueAtDepth('volume', 1.5),
      studioLineValue('volume', -6.04),
      studioLineValue('volume', -0.04),
      studioLineValue('pan', 0.333),
    ]

    // Assert
    expect(values).toEqual([12, -60, -6, 0, 0.33])
    expect(Object.is(values[3], -0)).toBe(false)
  })

  it('reads a volume in decibels with a true minus, and a pan as the knob does', () => {
    // Act
    const read = [
      formatStudioLineValue('volume', -6),
      formatStudioLineValue('volume', 2.5),
      formatStudioLineValue('volume', -0.01),
      formatStudioLineValue('pan', -0.4),
      formatStudioLineValue('pan', 0),
    ]

    // Assert
    expect(read).toEqual(['\u22126.0 dB', '+2.5 dB', '0.0 dB', 'L40', 'C'])
  })

  it('steps a decibel or a twentieth of the knob, a tenth of that with Shift', () => {
    // Act
    const steps = [
      studioLineKeyStep('volume', false),
      studioLineKeyStep('volume', true),
      studioLineKeyStep('pan', false),
      studioLineKeyStep('pan', true),
    ]

    // Assert
    expect(steps).toEqual([1, 0.1, 0.05, 0.005])
  })
})

describe('Studio lane line edits', () => {
  it('adds a point in time order and says where it went', () => {
    // Act
    const added = addStudioLinePoint(line, { frame: 72000, value: -3 })

    // Assert
    expect(added).toEqual({
      points: [line[0], line[1], { frame: 72000, value: -3 }, line[2]],
      index: 2,
    })
  })

  it('picks up the point already on a frame instead of adding a second', () => {
    // Act
    const added = addStudioLinePoint(line, { frame: 48000, value: 6 })

    // Assert
    expect(added).toEqual({ points: line, index: 1 })
  })

  it('adds nothing to a full line', () => {
    // Arrange
    const full = Array.from(
      { length: STUDIO_MAX_AUTOMATION_POINTS },
      (_, frame) => ({ frame, value: 0 }),
    )

    // Act
    const added = addStudioLinePoint(full, { frame: 9999, value: 0 })

    // Assert
    expect(added).toBeNull()
  })

  it('moves a point only between its neighbours, onto a whole frame and the line’s travel', () => {
    // Act
    const early = moveStudioLinePoint(line, 1, 'volume', -10, 40)
    const late = moveStudioLinePoint(line, 1, 'volume', 1e9, -99)
    const inside = moveStudioLinePoint(line, 1, 'volume', 60000.6, -3.04)

    // Assert
    expect(early[1]).toEqual({ frame: 1, value: 12 })
    expect(late[1]).toEqual({ frame: 95999, value: -60 })
    expect(inside).toEqual([line[0], { frame: 60001, value: -3 }, line[2]])
    expect(studioLinePointBounds(line, 2)).toEqual({
      min: 48001,
      max: Number.MAX_SAFE_INTEGER,
    })
  })

  it('removes a point and tells a changed line from the same one', () => {
    // Act
    const removed = removeStudioLinePoint(line, 0)

    // Assert
    expect(removed).toEqual([line[1], line[2]])
    expect(sameStudioLine(removed, line)).toBe(false)
    expect(sameStudioLine([...line], line)).toBe(true)
  })
})
