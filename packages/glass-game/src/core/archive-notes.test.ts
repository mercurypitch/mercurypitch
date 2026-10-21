// Archive note tests — written targets stay inside measured reach and change with calibration.

import { describe, expect, it } from 'vitest'
import type { PitchTargets } from '../contracts'
import { formatArchiveNote, resolveArchiveNote } from './archive-notes'

const resolveAll = (targets: PitchTargets) =>
  ([0, 1, 2] as const).map((degree) => resolveArchiveNote(targets, degree))

describe('archive written notes', () => {
  it.each([
    [64, [57, 61, 64]],
    [63.9, [57, 59, 61]],
    [61, [57, 59, 61]],
    [60.9, [57, 58, 59]],
    [59, [57, 58, 59]],
    [58.9, [57, 57, 57]],
  ])('keeps degrees within the verified upper note %s', (high, expected) => {
    expect(resolveAll({ comfortable: 57, low: 52, high })).toEqual(expected)
  })

  it.each([
    {},
    { low: 50 },
    { low: 58, high: 66 },
    { low: 60, high: 50 },
    { low: 50, high: 56 },
    { low: NaN, high: 70 },
    { low: 50, high: Infinity },
  ])(
    'uses the easy note when the saved range is absent or invalid: %j',
    (range) => {
      expect(resolveAll({ comfortable: 57, ...range })).toEqual([57, 57, 57])
    },
  )

  it('requires a valid comfortable note and rejects malformed degree data', () => {
    expect(resolveAll({ low: 50, high: 70 })).toEqual([null, null, null])
    expect(resolveAll({ comfortable: NaN })).toEqual([null, null, null])
    expect(resolveAll({ comfortable: 128 })).toEqual([null, null, null])
    expect(resolveArchiveNote({ comfortable: 57 }, 3 as 2)).toBeNull()
  })

  it('uses new calibration for both MIDI and written note without shifting the easy root', () => {
    const first = resolveAll({ comfortable: 57, low: 50, high: 70 })
    const second = resolveAll({ comfortable: 60, low: 50, high: 70 })
    expect(first).toEqual([57, 61, 64])
    expect(second).toEqual([60, 64, 67])
    expect(first.map((midi) => formatArchiveNote(midi!))).toEqual([
      'A3',
      'C♯4',
      'E4',
    ])
    expect(second.map((midi) => formatArchiveNote(midi!))).toEqual([
      'C4',
      'E4',
      'G4',
    ])
  })
})
