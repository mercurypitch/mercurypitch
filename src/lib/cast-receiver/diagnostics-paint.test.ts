// ============================================================
// Cast diagnostics tests — what the panel over the stage says
// ============================================================

import { describe, expect, it } from 'vitest'
import type { CastCapabilities } from '@/lib/cast-receiver/capabilities'
import { castDiagnosticsLines } from '@/lib/cast-receiver/diagnostics-paint'
import type { FrameMeterReading } from '@/lib/cast-receiver/frame-meter'

const METER: FrameMeterReading = {
  fps: 59.8,
  medianMs: 16.7,
  p95Ms: 18.1,
  late: 2,
  frames: 240,
  heapMb: 41.2,
  heapLimitMb: 512,
}

const DEVICE: CastCapabilities = {
  userAgent: 'CrKey',
  screen: { width: 1920, height: 1080, pixelRatio: 1 },
  cores: 4,
  deviceMemoryGb: 2,
  audio: {
    context: true,
    sampleRate: 48_000,
    baseLatencyMs: 10.7,
    outputLatencyMs: 42.7,
    latencySource: 'measured',
  },
  network: { webSocket: true, dataChannel: false },
}

describe('the diagnostics panel', () => {
  it('says how the frames are going, the heap, the screen, the audio and the network', () => {
    expect(castDiagnosticsLines(METER, DEVICE)).toEqual([
      '59.8 fps, median 16.7 ms, p95 18.1 ms, 2 late of 240',
      'heap 41.2 of 512 MB',
      '1920x1080 at 1x, 4 cores, 2 GB',
      'audio 48000 Hz, output latency 42.7 ms',
      'WebSocket yes, data channel no',
    ])
  })

  // REQ-TV-117, as the spike will photograph it.
  it('names the calibration fallback, and a device with no Web Audio', () => {
    const older: CastCapabilities = {
      ...DEVICE,
      audio: {
        ...DEVICE.audio,
        outputLatencyMs: null,
        latencySource: 'calibration',
      },
    }
    expect(castDiagnosticsLines(METER, older)[3]).toBe(
      'audio 48000 Hz, no output latency, calibration',
    )
    const silent: CastCapabilities = {
      ...DEVICE,
      audio: {
        context: false,
        sampleRate: null,
        baseLatencyMs: null,
        outputLatencyMs: null,
        latencySource: 'none',
      },
    }
    expect(castDiagnosticsLines(METER, silent)[3]).toBe('audio: no Web Audio')
    const unread: CastCapabilities = {
      ...DEVICE,
      audio: { ...DEVICE.audio, outputLatencyMs: null },
    }
    expect(castDiagnosticsLines(METER, unread)[3]).toBe(
      'audio 48000 Hz, output latency not read, audio did not start',
    )
  })

  it('says what it does not know yet', () => {
    expect(
      castDiagnosticsLines({ ...METER, heapMb: null, heapLimitMb: null }, null),
    ).toEqual([
      '59.8 fps, median 16.7 ms, p95 18.1 ms, 2 late of 240',
      'heap not reported',
      'reading the device',
    ])
  })
})
