import { describe, expect, it } from 'vitest'
import { createRunningMedian, median } from './running-median'

describe('median', () => {
  it('returns 0 for an empty array', () => {
    expect(median([])).toBe(0)
  })
  it('takes the middle of odd-length input', () => {
    expect(median([3, 1, 2])).toBe(2)
  })
  it('averages the two middle values for even-length input', () => {
    expect(median([1, 2, 3, 4])).toBe(2.5)
  })
})

describe('createRunningMedian', () => {
  it('rejects an isolated single-frame spike', () => {
    const m = createRunningMedian(5)
    const out = [57, 57, 57, 69, 57, 57, 57].map((v) => m.push(v))
    // The window is never majority-spike, so the spike never reaches the output.
    expect(out.every((v) => v === 57)).toBe(true)
  })

  it('rejects up to floor(N/2) consecutive outliers', () => {
    const m = createRunningMedian(5)
    const out = [57, 57, 57, 69, 69, 57, 57, 57].map((v) => m.push(v))
    expect(out.every((v) => v === 57)).toBe(true)
  })

  it('tracks a sustained change', () => {
    const m = createRunningMedian(5)
    const seq = [57, 57, 57, 60, 60, 60, 60, 60]
    const out = seq.map((v) => m.push(v))
    expect(out[out.length - 1]).toBe(60)
  })

  it('reset clears the window', () => {
    const m = createRunningMedian(3)
    m.push(10)
    m.push(20)
    m.reset()
    expect(m.size).toBe(0)
    expect(m.push(5)).toBe(5)
  })
})
