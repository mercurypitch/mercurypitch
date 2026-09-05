// ============================================================
// Each instrument reads its own drill
// ============================================================
// The mixing desk's `desk` case was added inside the fall-through group for
// Hairline, The Grid and Span, so all three tiles read the desk's Colour
// threshold: the desk's number where their own belonged, and nothing at all
// until the desk had been run.

import { beforeEach, describe, expect, it } from 'vitest'
import { recordThresholdReading, resetEarLabStore, } from '@/stores/ear-lab-store'
import type { Instrument } from './instruments'
import { instrumentReading, INSTRUMENTS } from './instruments'

function instrument(view: Instrument['view']): Instrument {
  const found = INSTRUMENTS.find((candidate) => candidate.view === view)
  if (found === undefined) throw new Error(`no instrument with view ${view}`)
  return found
}

function reading(drillId: string, value: number): void {
  recordThresholdReading({
    drillId,
    value,
    spread: 0.1,
    tracks: 1,
    source: 'practice',
  })
}

beforeEach(() => {
  resetEarLabStore()
})

describe('instrumentReading', () => {
  it('reads each threshold drill from its own drill, not the desk', () => {
    reading('hairline', 3.2)
    reading('the-grid', 18)
    reading('span', 4.5)
    reading('desk-colour', 2.5)
    expect(instrumentReading(instrument('hairline'))).toEqual({
      value: '3.2',
      unit: '¢',
      settling: false,
    })
    expect(instrumentReading(instrument('grid'))).toEqual({
      value: '18',
      unit: 'ms',
      settling: false,
    })
    expect(instrumentReading(instrument('span'))).toEqual({
      value: '4.5',
      unit: 'notes',
      settling: false,
    })
    expect(instrumentReading(instrument('desk'))).toMatchObject({
      value: '2.5',
      settling: false,
    })
  })

  it('shows nothing on a drill that has never been run, whatever the desk says', () => {
    reading('desk-colour', 2.5)
    expect(instrumentReading(instrument('hairline'))).toBeNull()
    expect(instrumentReading(instrument('grid'))).toBeNull()
    expect(instrumentReading(instrument('span'))).toBeNull()
    expect(instrumentReading(instrument('desk'))).not.toBeNull()
  })
})
