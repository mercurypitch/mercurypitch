// Evidence export tests guard its query gate and metadata-only payload.
// ============================================================

import { describe, expect, it } from 'vitest'
import type { GuitarTakeSnapshot } from '@/lib/guitar/guitar-take-recorder'
import { buildGuitarTakeEvidenceReport, guitarInputEvidenceExportEnabled, } from './guitar-input-evidence-export'

const TAKE: GuitarTakeSnapshot = {
  id: 'take-1',
  lifecycle: 'completed',
  input: {
    kind: 'midi',
    requestedDeviceId: 'midi-1',
    activeDeviceId: 'midi-1',
    activeDeviceLabel: 'Test MIDI',
  },
  clock: {
    startedAtFrame: 48_000,
    sampleRate: 48_000,
    attack: {
      timingSource: 'midi-clock',
      precision: 'high-resolution-midi',
    },
    latency: {
      seconds: 0,
      frames: 0,
      provenance: 'midi-route-unmeasured',
      uncertaintySeconds: null,
    },
  },
  events: [],
  durationFrames: 48_000,
  filteredBeforeStart: 0,
  filteredAfterEnd: 0,
  truncated: false,
  droppedEventCount: 0,
  inputHealth: {
    readings: 1,
    states: {
      silent: 0,
      quiet: 0,
      good: 1,
      hot: 0,
      clipping: 0,
      noisy: 0,
      uncertain: 0,
    },
  },
}

describe('guitarInputEvidenceExportEnabled', () => {
  it('is available only behind the explicit development query', () => {
    expect(guitarInputEvidenceExportEnabled('')).toBe(false)
    expect(guitarInputEvidenceExportEnabled('?input-evidence=0')).toBe(false)
    expect(guitarInputEvidenceExportEnabled('?input-evidence=1')).toBe(true)
  })
})

describe('buildGuitarTakeEvidenceReport', () => {
  it('retains clock provenance without events or audio samples', () => {
    const report = buildGuitarTakeEvidenceReport(
      TAKE,
      '2026-08-11T12:00:00.000Z',
    )
    const json = JSON.stringify(report)

    expect(report.hardwareValidation).toBe('user-captured-unverified')
    expect(report.take?.latencyProvenance).toBe('midi-route-unmeasured')
    expect(report.take?.precision).toBe('high-resolution-midi')
    expect(json).not.toContain('events')
    expect(json).not.toContain('samples')
    expect(report.rawAudioIncluded).toBe(false)
  })
})
