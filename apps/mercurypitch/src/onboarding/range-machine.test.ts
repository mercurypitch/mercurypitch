// ============================================================
// The range's machine: starts, answers, two slides, and Merc's lines
// ============================================================

import { describe, expect, it } from 'vitest'
import type { RangeResult } from '@/lib/mirror/metrics'
import type { RangeEvent, RangeState } from './range-machine'
import { RANGE_START, rangeLine, rangeReducer } from './range-machine'

const E2_G4: RangeResult = {
  lowMidi: 40,
  highMidi: 67,
  lowNote: 'E2',
  highNote: 'G4',
  semitones: 27,
  qualifyingMidis: [40, 67],
  voiceHint: 'Baritone',
}

function run(...events: RangeEvent[]): RangeState {
  return events.reduce(rangeReducer, RANGE_START)
}

const listening: RangeEvent[] = [
  { type: 'start' },
  { type: 'mic-ready', run: 1 },
]

describe('rangeReducer', () => {
  it('opens one numbered start from a tap, and slides down once the mic is open', () => {
    const starting = run({ type: 'start' })

    expect(starting).toMatchObject({ phase: 'starting', run: 1 })
    expect(rangeReducer(starting, { type: 'start' })).toBe(starting)
    expect(run(...listening).phase).toBe('down')
  })

  it('drops an answer to a start that no longer stands', () => {
    const again = run(
      { type: 'start' },
      { type: 'stop' },
      { type: 'start' },
      { type: 'mic-ready', run: 1 },
    )

    expect(again).toMatchObject({ phase: 'starting', run: 2 })
  })

  it('goes from the slide down to the slide up, and only from there', () => {
    expect(run(...listening, { type: 'slid' }).phase).toBe('up')
    expect(run({ type: 'slid' }).phase).toBe('ready')
  })

  it('holds the range the two slides measured, and locks there', () => {
    const done = run(
      ...listening,
      { type: 'slid' },
      {
        type: 'measured',
        outcome: { kind: 'range', range: E2_G4 },
      },
    )

    expect(done).toMatchObject({ phase: 'done', range: E2_G4, miss: null })
    expect(rangeReducer(done, { type: 'stop' })).toBe(done)
    expect(rangeReducer(done, { type: 'start' })).toBe(done)
  })

  it('takes a measurement only after the second slide', () => {
    const early = run(...listening, {
      type: 'measured',
      outcome: { kind: 'range', range: E2_G4 },
    })

    expect(early.phase).toBe('down')
  })

  it('says why two slides gave no range, and a tap goes again from the first', () => {
    const narrow = run(
      ...listening,
      { type: 'slid' },
      {
        type: 'measured',
        outcome: { kind: 'narrow', range: E2_G4 },
      },
    )

    expect(narrow).toMatchObject({
      phase: 'missed',
      miss: 'narrow',
      range: null,
    })
    expect(rangeReducer(narrow, { type: 'start' })).toMatchObject({
      phase: 'starting',
      run: 2,
      miss: null,
    })
  })

  it('is blocked by a mic that would not open, and starts again from there', () => {
    const blocked = run(
      { type: 'start' },
      { type: 'mic-failed', run: 1, block: 'denied' },
    )

    expect(blocked).toMatchObject({ phase: 'blocked', block: 'denied' })
    expect(rangeReducer(blocked, { type: 'start' })).toMatchObject({
      phase: 'starting',
      block: null,
    })
  })

  it('stops back to ready from any slide, and from nowhere else', () => {
    expect(run(...listening, { type: 'slid' }, { type: 'stop' }).phase).toBe(
      'ready',
    )
    const blocked = run(
      { type: 'start' },
      { type: 'mic-failed', run: 1, block: 'unavailable' },
    )
    expect(rangeReducer(blocked, { type: 'stop' })).toBe(blocked)
  })
})

describe('rangeLine', () => {
  const waiting = (nudge: boolean) => ({ kind: 'waiting' as const, nudge })

  it('asks for the slide down before the mic opens and while it slides', () => {
    expect(rangeLine(RANGE_START, null)).toBe('slide-down')
    expect(rangeLine(run(...listening), waiting(false))).toBe('slide-down')
  })

  it('nudges each slide after a long wait, and only while waiting', () => {
    const down = run(...listening)
    const up = run(...listening, { type: 'slid' })

    expect(rangeLine(down, waiting(true))).toBe('slide-down-nudge')
    expect(rangeLine(up, waiting(true))).toBe('slide-up-nudge')
    expect(rangeLine(up, { kind: 'sliding', onset: 1 })).toBe('slide-up')
  })

  it('names the range once measured, the miss after one, and why the mic did not open', () => {
    const done = run(
      ...listening,
      { type: 'slid' },
      {
        type: 'measured',
        outcome: { kind: 'range', range: E2_G4 },
      },
    )
    const unheard = run(
      ...listening,
      { type: 'slid' },
      {
        type: 'measured',
        outcome: { kind: 'unheard' },
      },
    )
    const blocked = run(
      { type: 'start' },
      { type: 'mic-failed', run: 1, block: 'denied' },
    )

    expect(rangeLine(done, null)).toBe('range')
    expect(rangeLine(unheard, null)).toBe('unheard')
    expect(rangeLine(blocked, null)).toBe('blocked')
    const again = rangeReducer(rangeReducer(blocked, { type: 'start' }), {
      type: 'mic-failed',
      run: 2,
      block: 'denied',
    })
    expect(rangeLine(again, null)).toBe('still-blocked')
  })

  it('starts the count of refusals over once the mic opens', () => {
    const opened: RangeEvent[] = [
      { type: 'start' },
      { type: 'mic-failed', run: 1, block: 'denied' },
      { type: 'start' },
      { type: 'mic-ready', run: 2 },
    ]
    expect(run(...opened).blocks).toBe(0)
    // Refused again later, after slides that went unheard: Merc says why
    // as he did the first time, not that it is still off.
    const refused = run(
      ...opened,
      { type: 'slid' },
      { type: 'measured', outcome: { kind: 'unheard' } },
      { type: 'start' },
      { type: 'mic-failed', run: 3, block: 'denied' },
    )
    expect(refused.phase).toBe('blocked')
    expect(rangeLine(refused, null)).toBe('blocked')
  })
})
