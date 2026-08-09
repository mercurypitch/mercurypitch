// ============================================================
// Ear Lab latency analysis — synthetic captures with known click
// positions, noise, and the failure modes the wizard must survive
// (silence, coughs, echoes).
// ============================================================

import { describe, expect, it } from 'vitest'
import { aggregateLatency, detectClicks, detectOnset, MIN_DETECTIONS, } from './latency'
import { rng } from './test-rng'

const SR = 48000

/** A capture buffer with 2 kHz click bursts at the given times. */
function makeCapture(options: {
  seconds: number
  clickAts?: readonly number[]
  clickAmp?: number
  noiseAmp?: number
  seed?: number
}): Float32Array {
  const out = new Float32Array(Math.floor(options.seconds * SR))
  const random = rng(options.seed ?? 1)
  const noise = options.noiseAmp ?? 0.002
  for (let i = 0; i < out.length; i++) out[i] = (random() * 2 - 1) * noise

  for (const at of options.clickAts ?? []) {
    const start = Math.floor(at * SR)
    const len = Math.floor(0.025 * SR)
    for (let i = 0; i < len && start + i < out.length; i++) {
      // 2 kHz burst with a 1 ms attack so the onset edge is sharp
      // but not a single-sample spike.
      const env = Math.min(1, i / (0.001 * SR))
      out[start + i] +=
        (options.clickAmp ?? 0.4) *
        env *
        Math.sin((2 * Math.PI * 2000 * i) / SR)
    }
  }
  return out
}

describe('detectOnset', () => {
  it('finds a click within a millisecond of its true position', () => {
    const capture = makeCapture({ seconds: 1, clickAts: [0.5] })
    const detected = detectOnset(capture, SR, 0, 0.4)
    expect(detected).not.toBeNull()
    expect(Math.abs((detected ?? 0) - 0.5) * 1000).toBeLessThan(1.5)
  })

  it('detects nothing in silence', () => {
    const capture = makeCapture({ seconds: 1 })
    expect(detectOnset(capture, SR, 0, 0.2)).toBeNull()
  })

  it('rides over a noisy floor without a false onset', () => {
    const capture = makeCapture({ seconds: 1, noiseAmp: 0.01 })
    expect(detectOnset(capture, SR, 0, 0.2)).toBeNull()
  })

  it('still finds the click over that same noise', () => {
    const capture = makeCapture({
      seconds: 1,
      clickAts: [0.45],
      noiseAmp: 0.01,
    })
    const detected = detectOnset(capture, SR, 0, 0.3)
    expect(detected).not.toBeNull()
    expect(Math.abs((detected ?? 0) - 0.45) * 1000).toBeLessThan(2)
  })

  it('respects the capture clock offset', () => {
    // Capture began at t=10 on the context clock; click scheduled at
    // 10.3 arrives 120 ms late at 10.42.
    const capture = makeCapture({ seconds: 1, clickAts: [0.42] })
    const detected = detectOnset(capture, SR, 10, 10.3)
    expect(Math.abs((detected ?? 0) - 10.42) * 1000).toBeLessThan(1.5)
  })

  it('ignores energy outside its search window', () => {
    // A click at 0.05 must not be claimed by a search starting at 0.2.
    const capture = makeCapture({ seconds: 1, clickAts: [0.05] })
    expect(detectOnset(capture, SR, 0, 0.2)).toBeNull()
  })
})

describe('detectClicks + aggregateLatency', () => {
  it('recovers a uniform 140 ms round trip', () => {
    const scheduled = [0.3, 0.9, 1.5, 2.1, 2.7]
    const capture = makeCapture({
      seconds: 3.5,
      clickAts: scheduled.map((t) => t + 0.14),
    })
    const reading = aggregateLatency(detectClicks(capture, SR, 0, scheduled))
    expect(reading).not.toBeNull()
    expect(reading?.detected).toBe(5)
    expect(reading?.medianMs).toBeGreaterThan(138)
    expect(reading?.medianMs).toBeLessThan(143)
    expect(reading?.spreadMs).toBeLessThan(3)
  })

  it('survives one click swallowed by a cough', () => {
    const scheduled = [0.3, 0.9, 1.5, 2.1, 2.7]
    const arrivals = [0.44, 1.04, 2.24, 2.84] // the 1.5 click is missing
    const capture = makeCapture({ seconds: 3.5, clickAts: arrivals })
    const reading = aggregateLatency(detectClicks(capture, SR, 0, scheduled))
    expect(reading?.detected).toBe(4)
    expect(reading?.medianMs).toBeGreaterThan(138)
    expect(reading?.medianMs).toBeLessThan(143)
  })

  it('keeps the median honest against one late echo', () => {
    const scheduled = [0.3, 0.9, 1.5, 2.1, 2.7]
    const arrivals = [0.44, 1.04, 1.64, 2.24, 3.05] // last one +350 ms
    const capture = makeCapture({ seconds: 3.6, clickAts: arrivals })
    const reading = aggregateLatency(detectClicks(capture, SR, 0, scheduled))
    // The MAD-based aggregate shrugs off a single outlier entirely —
    // the median stays at the true round trip and the spread stays
    // tight (a lone echo among five clicks is exactly what MAD is
    // built to ignore).
    expect(reading?.medianMs).toBeGreaterThan(138)
    expect(reading?.medianMs).toBeLessThan(143)
    expect(reading?.spreadMs).toBeLessThan(3)
  })

  it('returns nothing when too few clicks were heard', () => {
    const scheduled = [0.3, 0.9, 1.5, 2.1, 2.7]
    const capture = makeCapture({ seconds: 3.5, clickAts: [0.44, 1.04] })
    const detections = detectClicks(capture, SR, 0, scheduled)
    expect(detections.filter((d) => d.detectedAt !== null).length).toBeLessThan(
      MIN_DETECTIONS,
    )
    expect(aggregateLatency(detections)).toBeNull()
  })

  it('returns nothing for a silent capture (muted speakers)', () => {
    const scheduled = [0.3, 0.9, 1.5]
    const capture = makeCapture({ seconds: 2.5 })
    expect(aggregateLatency(detectClicks(capture, SR, 0, scheduled))).toBeNull()
  })
})
