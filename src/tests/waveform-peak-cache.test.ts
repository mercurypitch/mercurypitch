import { describe, expect, it } from 'vitest'
import { buildWaveformPeakCache, queryWaveformPeakRange, } from '@/lib/waveform-peak-cache'

const exactRange = (
  samples: Float32Array,
  start: number,
  end: number,
): { min: number; max: number } => {
  const values = [...samples.slice(start, end)]
  return {
    min: Math.min(...values),
    max: Math.max(...values),
  }
}

describe('waveform peak cache', () => {
  const samples = Float32Array.from([
    0.1, -0.2, 0.4, -0.8, 0.7, 0.3, -0.1, 0.2, -0.5, 0.9, -0.3, 0.6, 0.2, -0.4,
    0.8, -0.7, 0.5,
  ])
  const cache = buildWaveformPeakCache(samples, 4)

  it('matches a raw scan for every non-empty range', () => {
    for (let start = 0; start < samples.length; start++) {
      for (let end = start + 1; end <= samples.length; end++) {
        expect(queryWaveformPeakRange(samples, cache, start, end)).toEqual(
          exactRange(samples, start, end),
        )
      }
    }
  })

  it('handles ranges spanning partial edges and many whole blocks', () => {
    expect(queryWaveformPeakRange(samples, cache, 2, 15)).toEqual(
      exactRange(samples, 2, 15),
    )
  })

  it('clamps out-of-bounds and empty ranges safely', () => {
    expect(queryWaveformPeakRange(samples, cache, -20, 200)).toEqual(
      exactRange(samples, 0, samples.length),
    )
    expect(queryWaveformPeakRange(samples, cache, 5, 5)).toEqual({
      min: 0,
      max: 0,
    })
  })

  it('normalizes fractional and invalid block sizes', () => {
    const fractionalCache = buildWaveformPeakCache(samples, 0.5)
    const invalidCache = buildWaveformPeakCache(samples, Number.NaN)

    expect(fractionalCache.blockSize).toBe(1)
    expect(
      queryWaveformPeakRange(samples, fractionalCache, 1, samples.length - 1),
    ).toEqual(exactRange(samples, 1, samples.length - 1))
    expect(invalidCache.blockSize).toBeGreaterThan(0)
  })
})
