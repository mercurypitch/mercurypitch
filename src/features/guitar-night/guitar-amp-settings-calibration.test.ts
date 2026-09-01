// Guitar Night amp calibration tests pin curated loudness, headroom, and voicing.
// ============================================================

import { describe, expect, it } from 'vitest'
import { computeGuitarElectricAmpToneResponse, computeGuitarElectricAmpVoicing, shapeGuitarElectricPowerAmp, shapeGuitarElectricPreamp, } from '@/lib/guitar/guitar-electric-amp'
import { GUITAR_NIGHT_AMP_PRESETS } from './guitar-amp-settings'

const REFERENCE_SAMPLE_RATE = 8192
const REFERENCE_SAMPLE_COUNT = 8192
const REFERENCE_CHORD_FREQUENCIES_HZ = [82, 123, 165, 208, 247, 330] as const
const TONE_RESPONSE_FREQUENCIES_HZ = Array.from({ length: 96 }, (_, index) => {
  const progress = index / 95
  return 50 * (8000 / 50) ** progress
})

interface AmpPresetReferenceMetrics {
  readonly rmsDb: number
  readonly peakDb: number
  readonly maximumToneBoostDb: number
  readonly estimatedPeakAfterToneDb: number
}

function gainToDb(gain: number): number {
  return 20 * Math.log10(Math.max(gain, Number.EPSILON))
}

/**
 * Render an aligned, deterministic six-string reference through the same pure
 * nonlinear functions and gain staging used to build the live WaveShapers.
 */
function renderAmpPresetReference(
  preset: (typeof GUITAR_NIGHT_AMP_PRESETS)[number],
): AmpPresetReferenceMetrics {
  const samples = new Float64Array(REFERENCE_SAMPLE_COUNT)
  const voicing = computeGuitarElectricAmpVoicing(preset.settings)
  let mean = 0

  for (let index = 0; index < samples.length; index += 1) {
    const input = REFERENCE_CHORD_FREQUENCIES_HZ.reduce(
      (sum, frequencyHz) =>
        sum +
        0.07 *
          Math.sin((2 * Math.PI * frequencyHz * index) / REFERENCE_SAMPLE_RATE),
      0,
    )
    const preamp = shapeGuitarElectricPreamp(
      input,
      preset.settings.drive,
      preset.settings.asymmetry,
    )
    samples[index] =
      shapeGuitarElectricPowerAmp(preamp, preset.settings.drive) *
      voicing.outputGain
    mean += samples[index]
  }

  mean /= samples.length
  let squareSum = 0
  let peak = 0
  for (const sample of samples) {
    const acSample = sample - mean
    squareSum += acSample ** 2
    peak = Math.max(peak, Math.abs(acSample))
  }

  const response = computeGuitarElectricAmpToneResponse(
    preset.settings,
    TONE_RESPONSE_FREQUENCIES_HZ,
  )
  const maximumToneBoostDb = Math.max(...response)
  const peakDb = gainToDb(peak)
  return {
    rmsDb: gainToDb(Math.sqrt(squareSum / samples.length)),
    peakDb,
    maximumToneBoostDb,
    estimatedPeakAfterToneDb: peakDb + maximumToneBoostDb,
  }
}

describe('Guitar Night curated amp calibration', () => {
  const metrics = GUITAR_NIGHT_AMP_PRESETS.map(renderAmpPresetReference)

  it('matches reference energy instead of making higher drive merely louder', () => {
    const rmsLevels = metrics.map((result) => result.rmsDb)

    expect(Math.max(...rmsLevels) - Math.min(...rmsLevels)).toBeLessThan(1.5)
    expect(
      GUITAR_NIGHT_AMP_PRESETS.map((preset) => preset.settings.drive),
    ).toEqual([0.22, 0.42, 0.68, 0.84])
    expect(
      GUITAR_NIGHT_AMP_PRESETS.map((preset) => preset.settings.output),
    ).toEqual([0.72, 0.6, 0.4, 0.25])
  })

  it('retains conservative peak headroom after each strongest tone boost', () => {
    for (const result of metrics) {
      expect(result.peakDb).toBeLessThan(-6.5)
      expect(result.estimatedPeakAfterToneDb).toBeLessThan(-5)
    }
  })

  it('progressively focuses the mids and removes brittle cabinet top end', () => {
    const responses = GUITAR_NIGHT_AMP_PRESETS.map((preset) =>
      computeGuitarElectricAmpToneResponse(preset.settings, [750, 6000]),
    )
    const midLevels = responses.map((response) => response[0])
    const highLevels = responses.map((response) => response[1])

    for (let index = 1; index < responses.length; index += 1) {
      expect(midLevels[index]).toBeGreaterThan(midLevels[index - 1])
      expect(highLevels[index]).toBeLessThan(highLevels[index - 1])
    }
    expect(midLevels[midLevels.length - 1]! - midLevels[0]!).toBeGreaterThan(3)
    expect(highLevels[0]! - highLevels[highLevels.length - 1]!).toBeGreaterThan(
      5,
    )
  })
})
