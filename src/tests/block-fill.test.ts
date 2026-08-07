// ============================================================
// fillBlockInstance — the chorus copy nobody watches happen
// ============================================================
//
// Auto-fill runs on finish, across four timing maps at once, minutes into a
// song. If one map gets the delta and another does not, the row still looks
// mapped — the highlighter just stops matching the words underneath it. These
// tests are mostly about the four staying in step.

import { describe, expect, it } from 'vitest'
import type { BlockTimings } from '@/features/stem-mixer/block-fill'
import { fillBlockInstance } from '@/features/stem-mixer/block-fill'

/** A two-line chorus at 10s, with its repeat starting at 40s. */
function chorus(): BlockTimings {
  return {
    lineTimes: [10, 12, undefined, undefined],
    wordTimings: { 0: [10, 11], 1: [12, 13] },
    wordEndTimings: { 0: [10.8, 11.9], 1: [12.8, 13.9] },
    wordSweepTimings: {
      0: {
        0: [
          { time: 10, progress: 0 },
          { time: 10.8, progress: 1 },
        ],
      },
    },
  }
}

const SPAN = {
  templateStart: 0,
  instanceStart: 2,
  lineCount: 2,
  delta: 30,
}

describe('fillBlockInstance', () => {
  it('moves the line starts by the delta', () => {
    expect(fillBlockInstance(chorus(), SPAN).lineTimes).toEqual([
      10, 12, 40, 42,
    ])
  })

  it('moves the word starts by the same delta', () => {
    const filled = fillBlockInstance(chorus(), SPAN)
    expect(filled.wordTimings[2]).toEqual([40, 41])
    expect(filled.wordTimings[3]).toEqual([42, 43])
  })

  it('moves the word ends too, so no word loses its length', () => {
    const filled = fillBlockInstance(chorus(), SPAN)
    expect(filled.wordEndTimings[2]).toEqual([40.8, 41.9])
    expect(filled.wordEndTimings[3]).toEqual([42.8, 43.9])
  })

  it('moves the sub-word splits, keeping each one at its own progress', () => {
    const filled = fillBlockInstance(chorus(), SPAN)
    expect(filled.wordSweepTimings[2]).toEqual({
      0: [
        { time: 40, progress: 0 },
        { time: 40.8, progress: 1 },
      ],
    })
  })

  it('leaves the template exactly as it was', () => {
    const filled = fillBlockInstance(chorus(), SPAN)
    expect(filled.lineTimes[0]).toBe(10)
    expect(filled.wordTimings[0]).toEqual([10, 11])
    expect(filled.wordEndTimings[0]).toEqual([10.8, 11.9])
  })

  it('does not mutate what it was given', () => {
    // The caller holds these as signal values, which Solid treats as
    // immutable. Writing through would leave the UI showing stale rows.
    const original = chorus()
    fillBlockInstance(original, SPAN)
    expect(original.lineTimes).toEqual([10, 12, undefined, undefined])
    expect(original.wordTimings[2]).toBeUndefined()
    expect(original.wordSweepTimings[2]).toBeUndefined()
  })

  it('copies the sweeps rather than aliasing the template', () => {
    const filled = fillBlockInstance(chorus(), SPAN)
    filled.wordSweepTimings[2][0][0].time = 99
    expect(filled.wordSweepTimings[0][0][0].time).toBe(10)
  })

  it('skips a line the template never mapped', () => {
    // Half a chorus mapped should not blank the other half of its repeat,
    // which may already hold better work.
    const partial: BlockTimings = {
      lineTimes: [10, undefined, undefined, 55],
      wordTimings: {},
      wordEndTimings: {},
      wordSweepTimings: {},
    }
    expect(fillBlockInstance(partial, SPAN).lineTimes).toEqual([
      10,
      undefined,
      40,
      55,
    ])
  })

  it('rounds to the millisecond rather than carrying float dust', () => {
    const timings: BlockTimings = {
      lineTimes: [0.1],
      wordTimings: { 0: [0.1] },
      wordEndTimings: {},
      wordSweepTimings: {},
    }
    const filled = fillBlockInstance(timings, {
      templateStart: 0,
      instanceStart: 1,
      lineCount: 1,
      delta: 0.2,
    })
    expect(filled.lineTimes[1]).toBe(0.3)
    expect(filled.wordTimings[1]).toEqual([0.3])
  })

  it('handles a repeat that comes earlier than the template', () => {
    // Blocks are matched by text, so the first instance in the list is not
    // necessarily the first in the song.
    const filled = fillBlockInstance(chorus(), {
      templateStart: 0,
      instanceStart: 2,
      lineCount: 2,
      delta: -5,
    })
    expect(filled.lineTimes[2]).toBe(5)
    expect(filled.wordTimings[2]).toEqual([5, 6])
  })
})
