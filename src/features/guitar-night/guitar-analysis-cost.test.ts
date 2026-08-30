// The detect-cost readout. Its whole reason to exist is that most detections
// return early under the amplitude gate, so a naive average reports ~0 ms
// while the work that actually runs costs several.
// ============================================================

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { guitarAnalysisCost, recordGuitarDetectCost, resetGuitarAnalysisCost, } from './guitar-analysis-cost'

const PUBLISH_MS = 500

beforeEach(() => resetGuitarAnalysisCost())
afterEach(() => resetGuitarAnalysisCost())

describe('recordGuitarDetectCost', () => {
  it('publishes nothing until an interval has passed', () => {
    recordGuitarDetectCost(4, 0)
    expect(guitarAnalysisCost()).toBeNull()

    recordGuitarDetectCost(4, PUBLISH_MS - 1)
    expect(guitarAnalysisCost()).toBeNull()

    recordGuitarDetectCost(4, PUBLISH_MS)
    expect(guitarAnalysisCost()).not.toBeNull()
  })

  it('keeps gated frames out of the median but counts them as frames', () => {
    // Nine frames returned under the amplitude gate and one did the
    // correlation. Averaging all ten reports 0.5 ms for work that cost 5.
    recordGuitarDetectCost(0.01, 0)
    for (let index = 1; index < 9; index += 1) {
      recordGuitarDetectCost(0.01, index)
    }
    recordGuitarDetectCost(5, PUBLISH_MS)

    const cost = guitarAnalysisCost()
    expect(cost?.medianDetectMs).toBe(5)
    expect(cost?.samples).toBe(1)
    expect(cost?.gatedShare).toBe(0.9)
    // The rate is frames, not just the ones that ran: ten in half a second.
    expect(cost?.detectionsPerSecond).toBe(20)
  })

  it('reports the median and the worst of the run that happened', () => {
    recordGuitarDetectCost(1, 0)
    for (const duration of [9, 3, 5]) recordGuitarDetectCost(duration, 1)
    recordGuitarDetectCost(7, PUBLISH_MS)

    const cost = guitarAnalysisCost()
    // 1, 3, 5, 7, 9 -> median 5, worst 9.
    expect(cost?.medianDetectMs).toBe(5)
    expect(cost?.worstDetectMs).toBe(9)
    expect(cost?.samples).toBe(5)
    // A 60 Hz frame is 16.67 ms, so 5 ms is just under a third of it.
    expect(cost?.frameBudgetShare).toBeCloseTo(0.3, 2)
  })

  it('averages the middle pair when the sample count is even', () => {
    recordGuitarDetectCost(2, 0)
    recordGuitarDetectCost(6, 1)
    recordGuitarDetectCost(4, PUBLISH_MS)
    expect(guitarAnalysisCost()?.medianDetectMs).toBe(4)
  })

  it('reports a run of gated frames as costing nothing, not as missing', () => {
    recordGuitarDetectCost(0.01, 0)
    recordGuitarDetectCost(0.01, PUBLISH_MS)

    const cost = guitarAnalysisCost()
    expect(cost?.medianDetectMs).toBe(0)
    expect(cost?.samples).toBe(0)
    expect(cost?.gatedShare).toBe(1)
  })

  it('rolls the sample window rather than growing without bound', () => {
    recordGuitarDetectCost(1, 0)
    // 200 detections against a 120-sample window: only the last 120 survive,
    // and the early cheap ones are gone from the median.
    for (let index = 0; index < 200; index += 1) {
      recordGuitarDetectCost(index < 100 ? 1 : 8, index + 1)
    }
    recordGuitarDetectCost(8, PUBLISH_MS)

    const cost = guitarAnalysisCost()
    expect(cost?.samples).toBe(120)
    expect(cost?.medianDetectMs).toBe(8)
  })
})

describe('resetGuitarAnalysisCost', () => {
  it('clears the published reading and the window behind it', () => {
    recordGuitarDetectCost(4, 0)
    recordGuitarDetectCost(4, PUBLISH_MS)
    expect(guitarAnalysisCost()).not.toBeNull()

    resetGuitarAnalysisCost()
    expect(guitarAnalysisCost()).toBeNull()

    // The next take starts its own window rather than continuing the old one.
    recordGuitarDetectCost(9, 0)
    expect(guitarAnalysisCost()).toBeNull()
    recordGuitarDetectCost(9, PUBLISH_MS)
    expect(guitarAnalysisCost()?.medianDetectMs).toBe(9)
  })
})
