// Latency tests guard the one number, and guard against inventing it.
// ============================================================

import { beforeEach, describe, expect, it } from 'vitest'
import { ASSUMED_ROUND_TRIP_MS, assumeLatencyProfile, describeLatencyProfile, INPUT_LATENCY_STORAGE_KEY, loadInputLatencyProfile, measureRoundTrip, playedAt, reportedOutputLatencyMs, saveInputLatencyProfile, timingErrorMs, } from './input-latency'

const NOW = '2026-08-08T12:00:00.000Z'

describe('reportedOutputLatencyMs', () => {
  it('adds the two figures a browser is willing to state', () => {
    expect(
      reportedOutputLatencyMs({ baseLatency: 0.01, outputLatency: 0.02 }),
    ).toBe(30)
  })

  it('is null when the browser reports nothing usable', () => {
    expect(reportedOutputLatencyMs({})).toBeNull()
    expect(
      reportedOutputLatencyMs({ baseLatency: Number.NaN, outputLatency: 0 }),
    ).toBeNull()
  })
})

describe('assumeLatencyProfile', () => {
  it('doubles a reported output figure, because capture is not reported', () => {
    const profile = assumeLatencyProfile(
      'device-a',
      { baseLatency: 0.01, outputLatency: 0.02 },
      NOW,
    )
    expect(profile.origin).toBe('reported')
    expect(profile.roundTripMs).toBe(60)
    expect(profile.spreadMs).toBeNull()
  })

  it('falls back to a stated assumption rather than to zero', () => {
    const profile = assumeLatencyProfile('device-a', {}, NOW)
    expect(profile.origin).toBe('assumed')
    expect(profile.roundTripMs).toBe(ASSUMED_ROUND_TRIP_MS)
  })
})

describe('measureRoundTrip', () => {
  const clicks = [1, 2, 3, 4, 5, 6]

  it('takes the median delay between click and echo', () => {
    const heard = clicks.map(
      (click, index) =>
        // Around 40 ms, with the jitter a real capture route has.
        click + 0.04 + (index % 3) * 0.002,
    )
    const result = measureRoundTrip(clicks, heard)
    expect(result?.roundTripMs).toBe(42)
    expect(result?.clicksHeard).toBe(6)
  })

  it('ignores one wild reading instead of averaging it in', () => {
    const heard = [1.04, 2.041, 3.039, 4.04, 5.04, 6.2]
    expect(measureRoundTrip(clicks, heard)?.roundTripMs).toBe(40)
  })

  it('reports nothing at all when the clicks never came back', () => {
    // What headphones look like: the click plays, the microphone never hears
    // it. Zero would be a lie; null is the truth.
    expect(measureRoundTrip(clicks, [])).toBeNull()
    expect(measureRoundTrip(clicks, [1.04, 2.04])).toBeNull()
  })

  it('discards an echo that arrives before the click that caused it', () => {
    const heard = [0.98, 2.04, 3.04, 4.04, 5.04]
    const result = measureRoundTrip(clicks, heard)
    expect(result?.clicksHeard).toBe(4)
  })

  it('reports how much the readings disagreed', () => {
    const tight = measureRoundTrip(
      clicks,
      clicks.map((click) => click + 0.04),
    )
    expect(tight?.spreadMs).toBe(0)

    const loose = measureRoundTrip(clicks, [1.02, 2.06, 3.03, 4.07, 5.02, 6.08])
    expect(loose?.spreadMs).toBeGreaterThan(20)
  })
})

describe('playedAt and timingErrorMs', () => {
  const profile = {
    deviceId: 'device-a',
    roundTripMs: 40,
    origin: 'measured' as const,
    spreadMs: 4,
    updatedAt: NOW,
  }

  it('moves a captured strike back by the whole round trip', () => {
    expect(playedAt(10.04, profile)).toBeCloseTo(10, 6)
  })

  it('leaves the time alone when nothing has been calibrated', () => {
    expect(playedAt(10.04, null)).toBe(10.04)
  })

  it('reads late as positive, the way a player expects', () => {
    expect(timingErrorMs(playedAt(10.07, profile), 10)).toBeCloseTo(30, 6)
    expect(timingErrorMs(playedAt(10.02, profile), 10)).toBeCloseTo(-20, 6)
  })
})

describe('describeLatencyProfile', () => {
  it('says a tight measurement plainly', () => {
    expect(
      describeLatencyProfile({
        deviceId: 'a',
        roundTripMs: 38,
        origin: 'measured',
        spreadMs: 3,
        updatedAt: NOW,
      }),
    ).toBe('Measured on this input: 38 ms.')
  })

  it('admits when the measurement wandered', () => {
    expect(
      describeLatencyProfile({
        deviceId: 'a',
        roundTripMs: 38,
        origin: 'measured',
        spreadMs: 25,
        updatedAt: NOW,
      }),
    ).toContain('varying by about 25 ms')
  })

  it('marks an un-measured number as one', () => {
    expect(
      describeLatencyProfile({
        deviceId: 'a',
        roundTripMs: 45,
        origin: 'assumed',
        spreadMs: null,
        updatedAt: NOW,
      }),
    ).toContain('nothing has measured this input yet')
  })
})

describe('input latency storage', () => {
  beforeEach(() => {
    localStorage.removeItem(INPUT_LATENCY_STORAGE_KEY)
  })

  it('keeps a result per capture device, because latency belongs to one', () => {
    saveInputLatencyProfile({
      deviceId: 'built-in',
      roundTripMs: 62,
      origin: 'measured',
      spreadMs: 5,
      updatedAt: NOW,
    })
    saveInputLatencyProfile({
      deviceId: 'interface',
      roundTripMs: 11,
      origin: 'measured',
      spreadMs: 1,
      updatedAt: NOW,
    })

    expect(loadInputLatencyProfile('built-in')?.roundTripMs).toBe(62)
    expect(loadInputLatencyProfile('interface')?.roundTripMs).toBe(11)
    expect(loadInputLatencyProfile('unknown')).toBeNull()
  })

  it('ignores a stored value that is not a measurement', () => {
    localStorage.setItem(
      INPUT_LATENCY_STORAGE_KEY,
      JSON.stringify({ 'built-in': { deviceId: 'built-in' } }),
    )
    expect(loadInputLatencyProfile('built-in')).toBeNull()
  })

  it('survives a store holding something that is not JSON', () => {
    localStorage.setItem(INPUT_LATENCY_STORAGE_KEY, 'not json')
    expect(loadInputLatencyProfile('built-in')).toBeNull()
  })
})
