// Studio record view helpers — the input meter's fill in decibels, and the live take's span from its clip start to what has arrived.
import { describe, expect, it } from 'vitest'
import { createStudioLivePeaks } from '@/lib/studio/record/take-audio'
import { studioInputMeterFill } from './StudioInputMeter'
import { liveTakeSpan } from './StudioLaneTake'

describe('studioInputMeterFill', () => {
  it('maps -60 dBFS and below to empty and full scale to full', () => {
    expect(studioInputMeterFill(0)).toBe(0)
    expect(studioInputMeterFill(Number.NaN)).toBe(0)
    expect(studioInputMeterFill(0.001)).toBeCloseTo(0, 9)
    expect(studioInputMeterFill(0.0001)).toBe(0)
    expect(studioInputMeterFill(1)).toBe(1)
    expect(studioInputMeterFill(4)).toBe(1)
    // -6 dBFS fills nine tenths of the meter.
    expect(studioInputMeterFill(10 ** (-6 / 20))).toBeCloseTo(0.9, 9)
  })
})

describe('liveTakeSpan', () => {
  const live = (patch: {
    heardFirst: number
    fromFrame: number | null
    sampleRate: number
    count: number
  }) => ({
    ...patch,
    title: 'Take 1',
    peaks: createStudioLivePeaks(patch.sampleRate, patch.sampleRate * 10),
  })

  it('starts where the clip will and grows with the peaks that arrived', () => {
    // One second of peaks heard from frame 90000, the clip held to the playhead at 96000.
    expect(
      liveTakeSpan(
        live({
          heardFirst: 90000,
          fromFrame: 96000,
          sampleRate: 48000,
          count: 100,
        }),
      ),
    ).toEqual({ from: 96000, to: 138000 })
  })

  it('counts a 44.1 kHz capture in song frames, and never starts before zero', () => {
    expect(
      liveTakeSpan(
        live({
          heardFirst: -2000,
          fromFrame: null,
          sampleRate: 44100,
          count: 50,
        }),
      ),
    ).toEqual({ from: 0, to: 22000 })
  })

  it('is empty, not negative, before the first sample reaches the clip', () => {
    expect(
      liveTakeSpan(
        live({ heardFirst: 0, fromFrame: 48000, sampleRate: 48000, count: 10 }),
      ),
    ).toEqual({ from: 48000, to: 48000 })
  })
})
