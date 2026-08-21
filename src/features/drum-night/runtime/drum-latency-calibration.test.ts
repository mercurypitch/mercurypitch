// Drum Night calibration tests — human outliers cannot dominate compensation.
// ============================================================

import { describe, expect, it } from 'vitest'
import { DrumLatencyCalibration, estimateDrumInputLatency, } from './drum-latency-calibration'

describe('DrumLatencyCalibration', () => {
  it('waits for enough evidence and ignores non-finite samples', () => {
    expect(estimateDrumInputLatency([])).toMatchObject({
      status: 'empty',
      estimateMs: null,
    })
    expect(estimateDrumInputLatency([20, 21, 22, Number.NaN])).toMatchObject({
      status: 'collecting',
      estimateMs: null,
      sampleCount: 3,
    })
  })

  it('uses a robust center and rejects one badly mistimed strike', () => {
    const result = estimateDrumInputLatency([31, 32, 33, 34, 35, 420])
    expect(result.status).toBe('ready')
    expect(result.estimateMs).toBe(33)
    expect(result.inlierCount).toBe(5)
    expect(result.spreadMs).toBe(1)
  })

  it('bounds negative and extreme estimates to the supported range', () => {
    expect(estimateDrumInputLatency([-40, -39, -38, -37, -36]).estimateMs).toBe(
      0,
    )
    expect(estimateDrumInputLatency([400, 410, 420, 430, 440]).estimateMs).toBe(
      250,
    )
  })

  it('records expected and observed timestamps and resets cleanly', () => {
    const calibration = new DrumLatencyCalibration()
    for (let index = 0; index < 5; index += 1) {
      calibration.addStrike(index * 500, index * 500 + 28)
    }
    expect(calibration.result()).toMatchObject({
      status: 'ready',
      estimateMs: 28,
    })
    calibration.reset()
    expect(calibration.result().status).toBe('empty')
  })
})
