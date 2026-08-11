// ============================================================
// Mic Latency Store Tests
// ============================================================

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MAX_LATENCY_MS } from '@/lib/mic-latency'
import { micManager } from '@/lib/mic-manager'
import { clearMicLatency, currentMicDeviceKey, DEFAULT_DEVICE_KEY, micLatencyByDevice, micLatencyMs, micLatencyMsForDevice, micLatencySec, micLatencySpreadByDevice, micLatencySpreadMs, micLatencySpreadMsForDevice, setMicLatencyByDevice, setMicLatencyMeasurement, setMicLatencyMeasurementForDevice, setMicLatencyMs, setMicLatencySpreadByDevice, } from '@/stores/mic-latency-store'

/** Pretend a particular input is selected, without touching a real device. */
function pretendDevice(deviceId: string | null) {
  return vi.spyOn(micManager, 'getPreferredDevice').mockReturnValue(deviceId)
}

describe('Mic Latency Store', () => {
  beforeEach(() => {
    vi.spyOn(micManager, 'getResolvedDevice').mockReturnValue(null)
    setMicLatencyByDevice({})
    setMicLatencySpreadByDevice({})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('defaults', () => {
    it('is zero for an input that has never been measured', () => {
      expect(micLatencyMs()).toBe(0)
      expect(micLatencySec()).toBe(0)
      expect(micLatencySpreadMs()).toBeNull()
    })

    it('keys the OS default input by name', () => {
      pretendDevice(null)
      expect(currentMicDeviceKey()).toBe(DEFAULT_DEVICE_KEY)
    })

    it('keys a chosen input by its device id', () => {
      pretendDevice('usb-interface-1')
      expect(currentMicDeviceKey()).toBe('usb-interface-1')
    })
  })

  describe('setMicLatencyMs', () => {
    it('stores the offset against the current input', () => {
      pretendDevice('usb-interface-1')
      setMicLatencyMs(96)
      expect(micLatencyMs()).toBe(96)
      expect(micLatencyByDevice()).toEqual({ 'usb-interface-1': 96 })
    })

    it('converts to seconds for the audio clock', () => {
      setMicLatencyMs(250)
      expect(micLatencySec()).toBe(0.25)
    })

    it('rounds to whole milliseconds', () => {
      setMicLatencyMs(96.4)
      expect(micLatencyMs()).toBe(96)
    })

    it('clamps to the believable range', () => {
      setMicLatencyMs(-50)
      expect(micLatencyMs()).toBe(0)
      setMicLatencyMs(MAX_LATENCY_MS + 1000)
      expect(micLatencyMs()).toBe(MAX_LATENCY_MS)
    })

    it('keeps one offset per input rather than one per machine', () => {
      const device = pretendDevice('built-in')
      setMicLatencyMs(140)
      device.mockReturnValue('usb-interface-1')
      setMicLatencyMs(38)

      expect(micLatencyMs()).toBe(38)
      device.mockReturnValue('built-in')
      expect(micLatencyMs()).toBe(140)
    })

    it('clears stale spread evidence when only a legacy offset is replaced', () => {
      pretendDevice('usb-interface-1')
      setMicLatencyMeasurement(96, 7)

      setMicLatencyMs(80)

      expect(micLatencyMs()).toBe(80)
      expect(micLatencySpreadMs()).toBeNull()
    })
  })

  describe('setMicLatencyMeasurement', () => {
    it('persists the rounded latency and spread against the same input', () => {
      pretendDevice('usb-interface-1')

      setMicLatencyMeasurement(96.4, 7.6)

      expect(micLatencyMs()).toBe(96)
      expect(micLatencySpreadMs()).toBe(8)
      expect(micLatencyByDevice()).toEqual({ 'usb-interface-1': 96 })
      expect(micLatencySpreadByDevice()).toEqual({
        'usb-interface-1': 8,
      })
    })

    it('keeps spread provenance isolated per input device', () => {
      const device = pretendDevice('built-in')
      setMicLatencyMeasurement(140, 12)
      device.mockReturnValue('usb-interface-1')
      setMicLatencyMeasurement(38, 3)

      expect(micLatencySpreadMs()).toBe(3)
      device.mockReturnValue('built-in')
      expect(micLatencySpreadMs()).toBe(12)
    })

    it('stores an unknown spread as absent rather than as zero certainty', () => {
      pretendDevice('usb-interface-1')
      setMicLatencyMeasurement(96, 7)

      setMicLatencyMeasurement(80, null)

      expect(micLatencyMs()).toBe(80)
      expect(micLatencySpreadMs()).toBeNull()
      expect(micLatencySpreadByDevice()).toEqual({})
    })

    it('pins a fallback calibration to the actual opened device', () => {
      pretendDevice(null)

      setMicLatencyMeasurementForDevice('fallback-device', 72, 5)

      expect(micLatencyMs()).toBe(0)
      expect(micLatencyMsForDevice('fallback-device')).toBe(72)
      expect(micLatencySpreadMsForDevice('fallback-device')).toBe(5)
    })

    it('shares a resolved default-route measurement with every consumer', () => {
      pretendDevice(null)
      vi.mocked(micManager.getResolvedDevice).mockReturnValue('built-in-input')

      setMicLatencyMeasurementForDevice('built-in-input', 72, 5)

      expect(currentMicDeviceKey()).toBe('built-in-input')
      expect(micLatencyMs()).toBe(72)
      expect(micLatencySpreadMs()).toBe(5)
    })

    it('falls back to the legacy default alias for the resolved route', () => {
      pretendDevice(null)
      setMicLatencyByDevice({ [DEFAULT_DEVICE_KEY]: 96 })
      setMicLatencySpreadByDevice({ [DEFAULT_DEVICE_KEY]: 8 })
      vi.mocked(micManager.getResolvedDevice).mockReturnValue('built-in-input')

      expect(micLatencyMsForDevice('built-in-input')).toBe(96)
      expect(micLatencySpreadMsForDevice('built-in-input')).toBe(8)
    })
  })

  describe('clearMicLatency', () => {
    it('returns the current input to uncompensated', () => {
      pretendDevice('usb-interface-1')
      setMicLatencyMs(96)
      clearMicLatency()
      expect(micLatencyMs()).toBe(0)
      expect(micLatencySpreadMs()).toBeNull()
      expect(micLatencyByDevice()).toEqual({})
      expect(micLatencySpreadByDevice()).toEqual({})
    })

    it('leaves the other inputs alone', () => {
      const device = pretendDevice('built-in')
      setMicLatencyMeasurement(140, 12)
      device.mockReturnValue('usb-interface-1')
      setMicLatencyMeasurement(38, 3)
      clearMicLatency()

      expect(micLatencyByDevice()).toEqual({ 'built-in': 140 })
      expect(micLatencySpreadByDevice()).toEqual({ 'built-in': 12 })
    })

    it('does not resurrect a legacy default offset after clearing its resolved route', () => {
      pretendDevice(null)
      vi.mocked(micManager.getResolvedDevice).mockReturnValue('built-in-input')
      setMicLatencyByDevice({
        [DEFAULT_DEVICE_KEY]: 96,
        'built-in-input': 72,
        'usb-interface': 38,
      })
      setMicLatencySpreadByDevice({
        [DEFAULT_DEVICE_KEY]: 8,
        'built-in-input': 5,
        'usb-interface': 3,
      })

      clearMicLatency()

      expect(micLatencyMs()).toBe(0)
      expect(micLatencySpreadMs()).toBeNull()
      expect(micLatencyByDevice()).toEqual({ 'usb-interface': 38 })
      expect(micLatencySpreadByDevice()).toEqual({ 'usb-interface': 3 })
    })

    it('is a no-op for an input that was never measured', () => {
      pretendDevice('never-seen')
      const before = micLatencyByDevice()
      clearMicLatency()
      expect(micLatencyByDevice()).toBe(before)
    })
  })
})
