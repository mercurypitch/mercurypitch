// ============================================================
// mic-latency tests
// ============================================================
//
// Synthetic recordings only: a buffer of noise with click bursts planted at
// known offsets, so the expected answer is known exactly and nothing here
// depends on a device.

import { describe, expect, it } from 'vitest'
import { detectOnsets, LATENCY_CLICK_COUNT, matchOnsetDeltas, MAX_LATENCY_MS, MIN_LATENCY_HITS, summariseLatency, sungBeat, } from './mic-latency'

const SAMPLE_RATE = 48_000

/** Deterministic low-level noise, so a run is reproducible. */
function noiseAt(index: number): number {
  const x = Math.sin(index * 12.9898) * 43758.5453
  return (x - Math.floor(x) - 0.5) * 0.002
}

/**
 * A recording with a 40 ms burst planted at each of `atSec`. `burstLevel` is
 * the peak amplitude — the detector's thresholds are relative, so what matters
 * is its ratio to the noise floor, not the absolute value.
 */
function recordingWithClicks(
  lengthSec: number,
  atSec: number[],
  burstLevel = 0.4,
): Float32Array {
  const samples = new Float32Array(Math.round(lengthSec * SAMPLE_RATE))
  for (let i = 0; i < samples.length; i++) samples[i] = noiseAt(i)

  const burstSamples = Math.round(0.04 * SAMPLE_RATE)
  for (const at of atSec) {
    const start = Math.round(at * SAMPLE_RATE)
    for (let i = 0; i < burstSamples; i++) {
      const idx = start + i
      if (idx >= samples.length) break
      samples[idx] +=
        burstLevel * Math.sin((2 * Math.PI * 1000 * i) / SAMPLE_RATE)
    }
  }
  return samples
}

describe('detectOnsets', () => {
  it('finds a planted burst within a couple of milliseconds', () => {
    const onsets = detectOnsets(recordingWithClicks(1, [0.5]), SAMPLE_RATE)
    expect(onsets).toHaveLength(1)
    expect(onsets[0]).toBeCloseTo(0.5, 2)
  })

  it('finds every burst in a click train', () => {
    const planted = [0.4, 1.15, 1.9, 2.65]
    const onsets = detectOnsets(recordingWithClicks(3.2, planted), SAMPLE_RATE)
    expect(onsets).toHaveLength(planted.length)
    onsets.forEach((onset, i) => {
      expect(onset).toBeCloseTo(planted[i], 2)
    })
  })

  it('reports one onset per burst, not one per loud window', () => {
    // A 40 ms burst spans dozens of envelope windows; the refractory period is
    // what keeps that from becoming dozens of onsets.
    const onsets = detectOnsets(recordingWithClicks(1, [0.3]), SAMPLE_RATE)
    expect(onsets).toHaveLength(1)
  })

  it('hears nothing in a recording that is only noise', () => {
    expect(detectOnsets(recordingWithClicks(1, []), SAMPLE_RATE)).toEqual([])
  })

  it('hears nothing when the clicks are barely above the floor', () => {
    const quiet = recordingWithClicks(1, [0.5], 0.002)
    expect(detectOnsets(quiet, SAMPLE_RATE)).toEqual([])
  })

  it('survives an empty buffer', () => {
    expect(detectOnsets(new Float32Array(0), SAMPLE_RATE)).toEqual([])
  })
})

describe('matchOnsetDeltas', () => {
  const scheduled = [1, 1.75, 2.5, 3.25]

  it('pairs each onset with the click that caused it', () => {
    const onsets = scheduled.map((t) => t + 0.12)
    const deltas = matchOnsetDeltas(scheduled, onsets)
    expect(deltas).toHaveLength(scheduled.length)
    for (const delta of deltas) expect(delta).toBeCloseTo(0.12, 6)
  })

  it('drops an onset too far from every click to answer one', () => {
    // 0.2 s is before the first click; 9 s is long after the last.
    const deltas = matchOnsetDeltas(scheduled, [0.2, 1.1, 9])
    expect(deltas).toHaveLength(1)
    expect(deltas[0]).toBeCloseTo(0.1, 6)
  })

  it('drops a negative gap — a click cannot return before it is played', () => {
    expect(matchOnsetDeltas(scheduled, [0.95])).toEqual([])
  })

  it('uses at most one return for each click when a room echo repeats it', () => {
    expect(matchOnsetDeltas(scheduled, [1.08, 1.14, 1.83])).toEqual([
      0.08000000000000007, 0.08000000000000007,
    ])
  })

  it('does not let one onset answer two scheduled clicks', () => {
    expect(matchOnsetDeltas([1, 1.2], [1.19], 0.25)).toHaveLength(1)
  })
})

describe('summariseLatency', () => {
  const good = [0.09, 0.1, 0.1, 0.11, 0.1, 0.1]

  it('reports the median in whole milliseconds', () => {
    const result = summariseLatency(good, good.length)
    expect(result.latencyMs).toBe(100)
    expect(result.failure).toBeNull()
    expect(result.hits).toBe(good.length)
  })

  it('reports the spread as a confidence hint', () => {
    expect(summariseLatency(good, good.length).spreadMs).not.toBeNull()
  })

  it('says nothing was heard when no onsets were found', () => {
    const result = summariseLatency([], 0)
    expect(result.latencyMs).toBeNull()
    expect(result.failure).toBe('not-heard')
  })

  it('refuses a median built on too few clicks', () => {
    const few = Array.from({ length: MIN_LATENCY_HITS - 1 }, () => 0.1)
    const result = summariseLatency(few, few.length)
    expect(result.latencyMs).toBeNull()
    expect(result.failure).toBe('too-few-hits')
  })

  it('refuses an implausible round trip', () => {
    const absurd = Array.from({ length: 6 }, () => MAX_LATENCY_MS / 1000 + 0.1)
    const result = summariseLatency(absurd, absurd.length)
    expect(result.latencyMs).toBeNull()
    expect(result.failure).toBe('out-of-range')
  })

  it('refuses a zero or negative median rather than storing a no-op', () => {
    const result = summariseLatency([0, 0, 0, 0, 0, 0], 6)
    expect(result.latencyMs).toBeNull()
    expect(result.failure).toBe('out-of-range')
  })
})

describe('end to end on a synthetic run', () => {
  it('recovers a planted round-trip latency', () => {
    const latencySec = 0.086
    const scheduled = Array.from(
      { length: LATENCY_CLICK_COUNT },
      (_, i) => 1 + i * 0.75,
    )
    // The recording is anchored at audio-clock zero here, so onsets are
    // directly comparable with the schedule.
    const returns = scheduled.map((t) => t + latencySec)
    const samples = recordingWithClicks(
      scheduled[scheduled.length - 1] + 1,
      returns,
    )

    const onsets = detectOnsets(samples, SAMPLE_RATE)
    const result = summariseLatency(
      matchOnsetDeltas(scheduled, onsets),
      onsets.length,
    )

    expect(result.failure).toBeNull()
    expect(result.latencyMs).toBeGreaterThanOrEqual(84)
    expect(result.latencyMs).toBeLessThanOrEqual(88)
  })
})

describe('sungBeat', () => {
  it('leaves the beat alone on an unmeasured device', () => {
    expect(sungBeat(4, 0, 120)).toBe(4)
  })

  it('moves the frame back by the round trip, in beats', () => {
    // 120 bpm is two beats a second, so 95 ms is 0.19 of a beat.
    expect(sungBeat(4, 95, 120)).toBeCloseTo(3.81, 5)
    // Half the tempo, half the shift for the same offset.
    expect(sungBeat(4, 95, 60)).toBeCloseTo(4 - 0.095, 5)
  })

  it('moves it back, never forward — the frame is older than its arrival', () => {
    expect(sungBeat(4, 95, 120)).toBeLessThan(4)
  })

  it('keeps a frame sung before the first note before it, rather than clamping', () => {
    // The singer came in early: the trace belongs left of beat 0, which is
    // where the canvas draws it. Clamping would stack early frames on the
    // downbeat and hide exactly the mistake the trace is there to show.
    expect(sungBeat(0.05, 95, 120)).toBeLessThan(0)
  })

  it('ignores a nonsense tempo instead of returning NaN', () => {
    expect(sungBeat(4, 95, 0)).toBe(4)
  })
})
