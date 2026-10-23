// ============================================================
// The day the latency was measured, per input
// ============================================================
//
// S6 7a: the Latency row says when its number was measured. The number is
// the wizard's, kept per input, and per route on a TV over AirPlay; the
// phone keeps the day beside it, under the same key, and forgets it when the
// offset is cleared.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { micManager } from '@/lib/mic-manager'
import { setAudioRouteForTests } from '@/stores/audio-route-store'
import { forgetLatencyMeasured, latencyMeasuredAt, measuredLine, recordLatencyMeasured, resetLatencyMeasured, } from './latency-measured'

const DAY = new Date(2026, 8, 21, 12, 0, 0)
const LATER = new Date(2026, 9, 22, 12, 0, 0)

beforeEach(() => {
  localStorage.clear()
  resetLatencyMeasured()
  setAudioRouteForTests(null)
  vi.spyOn(micManager, 'getPreferredDevice').mockReturnValue(null)
  vi.spyOn(micManager, 'getResolvedDevice').mockReturnValue('built-in')
})

afterEach(() => {
  setAudioRouteForTests(null)
  vi.restoreAllMocks()
})

describe('the day of the measurement', () => {
  it('is kept for the input it was measured on', () => {
    recordLatencyMeasured(DAY)

    expect(latencyMeasuredAt()?.getTime()).toBe(DAY.getTime())
  })

  it('is not claimed for another input', () => {
    recordLatencyMeasured(DAY)

    vi.mocked(micManager.getResolvedDevice).mockReturnValue('usb-interface')

    expect(latencyMeasuredAt()).toBeNull()
  })

  it('outlives a restart', () => {
    recordLatencyMeasured(DAY)

    resetLatencyMeasured()

    expect(latencyMeasuredAt()?.getTime()).toBe(DAY.getTime())
  })

  it('goes when the offset is cleared', () => {
    recordLatencyMeasured(DAY)

    forgetLatencyMeasured()

    expect(latencyMeasuredAt()).toBeNull()
  })

  it('is kept for a TV on AirPlay apart from the phone’s own outputs', () => {
    recordLatencyMeasured(DAY)
    setAudioRouteForTests('airplay')
    const beforeRun = latencyMeasuredAt()

    recordLatencyMeasured(LATER)

    expect(beforeRun).toBeNull()
    expect(latencyMeasuredAt()?.getTime()).toBe(LATER.getTime())
    setAudioRouteForTests('speaker')
    expect(latencyMeasuredAt()?.getTime()).toBe(DAY.getTime())
  })

  it('goes for the TV alone when the TV’s offset is cleared', () => {
    recordLatencyMeasured(DAY)
    setAudioRouteForTests('airplay')
    recordLatencyMeasured(LATER)

    forgetLatencyMeasured()

    expect(latencyMeasuredAt()).toBeNull()
    setAudioRouteForTests(null)
    expect(latencyMeasuredAt()?.getTime()).toBe(DAY.getTime())
  })

  it('reads as the mock writes it', () => {
    expect(measuredLine(DAY)).toBe('Measured 21 September 2026')
  })
})
