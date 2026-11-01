// Mic latency path store — the output path a round trip was measured on is kept per input and route, beside the measurement.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { audioOutputPathSeconds } from '@/lib/mic-latency'
import { micManager } from '@/lib/mic-manager'
import { setAudioRouteForTests } from '@/stores/audio-route-store'
import { micLatencyPathMs, setMicLatencyPathByKey, setMicLatencyPathMs, } from '@/stores/mic-latency-path-store'

describe('mic latency path store', () => {
  beforeEach(() => {
    vi.spyOn(micManager, 'getResolvedDevice').mockReturnValue(null)
    vi.spyOn(micManager, 'getPreferredDevice').mockReturnValue('usb-mic')
    setMicLatencyPathByKey({})
    setAudioRouteForTests(null)
  })
  afterEach(() => vi.restoreAllMocks())

  it('keeps the path for the input and route it was measured on', () => {
    setMicLatencyPathMs(52.4)
    expect(micLatencyPathMs()).toBe(52.4)

    setAudioRouteForTests('bluetooth')
    expect(micLatencyPathMs()).toBeNull()
    setMicLatencyPathMs(210)
    expect(micLatencyPathMs()).toBe(210)

    setAudioRouteForTests(null)
    expect(micLatencyPathMs()).toBe(52.4)
  })

  it('forgets the path when a measurement comes without one', () => {
    setMicLatencyPathMs(40)
    setMicLatencyPathMs(null)
    expect(micLatencyPathMs()).toBeNull()
    setMicLatencyPathMs(Number.NaN)
    expect(micLatencyPathMs()).toBeNull()
  })
})

describe('audioOutputPathSeconds', () => {
  it('adds what the clock buffers to what the device reports, ignoring nonsense', () => {
    expect(
      audioOutputPathSeconds({ baseLatency: 0.02, outputLatency: 0.05 }),
    ).toBeCloseTo(0.07, 9)
    expect(
      audioOutputPathSeconds({ baseLatency: Number.NaN, outputLatency: 0.05 }),
    ).toBeCloseTo(0.05, 9)
    expect(audioOutputPathSeconds({})).toBe(0)
  })
})
