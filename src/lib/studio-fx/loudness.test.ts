import { describe, expect, it } from 'vitest'
import type { SampledAudio } from './loudness'
import { integratedLoudness, measureLoudness } from './loudness'

function audio(channels: Float32Array[], sampleRate = 48000): SampledAudio {
  return {
    sampleRate,
    numberOfChannels: channels.length,
    getChannelData: (channel) => channels[channel],
  }
}

function sine(
  seconds: number,
  frequency: number,
  amplitude: number,
  sampleRate = 48000,
  phase = 0,
): Float32Array {
  const data = new Float32Array(Math.round(seconds * sampleRate))
  for (let i = 0; i < data.length; i++) {
    data[i] =
      amplitude * Math.sin((2 * Math.PI * frequency * i) / sampleRate + phase)
  }
  return data
}

describe('integratedLoudness (ITU-R BS.1770)', () => {
  it('reads a full-scale 997 Hz sine on both channels as 0 LUFS, the standard calibration', () => {
    const tone = sine(5, 997, 1)
    expect(integratedLoudness(audio([tone, tone]))).toBeCloseTo(0, 1)
  })

  it('reads the same sine on one channel only as -3.01 LUFS', () => {
    const tone = sine(5, 997, 1)
    expect(
      integratedLoudness(audio([tone, new Float32Array(tone.length)])),
    ).toBeCloseTo(-3.01, 1)
  })

  it('measures alike at 44.1 kHz, because the K-weighting is derived per rate', () => {
    const tone = sine(5, 997, 0.1, 44100)
    expect(integratedLoudness(audio([tone, tone], 44100))).toBeCloseTo(-20, 1)
  })

  it('treats mono as dual mono, as it is played on both speakers', () => {
    const tone = sine(5, 997, 0.1)
    expect(integratedLoudness(audio([tone]))).toBeCloseTo(
      integratedLoudness(audio([tone, tone])),
      6,
    )
  })

  it('tracks level decibel for decibel', () => {
    const loud = sine(5, 1000, 0.5)
    const quiet = sine(5, 1000, 0.05)
    const difference =
      integratedLoudness(audio([loud])) - integratedLoudness(audio([quiet]))
    expect(difference).toBeCloseTo(20, 2)
  })

  it('weights highs up and lows down, as the K-curve does', () => {
    const at60 = integratedLoudness(audio([sine(5, 60, 0.1)]))
    const at1k = integratedLoudness(audio([sine(5, 1000, 0.1)]))
    const at5k = integratedLoudness(audio([sine(5, 5000, 0.1)]))
    expect(at60).toBeLessThan(at1k - 0.5)
    expect(at5k).toBeGreaterThan(at1k + 2)
  })

  it('gates silence out, so pauses do not drag a phrase down', () => {
    // Ungated, four seconds of silence after four of tone would read 3 dB low;
    // only the three blocks that straddle the edge still count, partly.
    const tone = sine(4, 1000, 0.1)
    const withPause = new Float32Array(tone.length * 2)
    withPause.set(tone, 0)
    const drop =
      integratedLoudness(audio([tone])) - integratedLoudness(audio([withPause]))
    expect(drop).toBeGreaterThanOrEqual(0)
    expect(drop).toBeLessThan(0.3)
  })

  it('is -Infinity for silence and still measures a clip shorter than one block', () => {
    expect(integratedLoudness(audio([new Float32Array(48000)]))).toBe(
      Number.NEGATIVE_INFINITY,
    )
    expect(
      Number.isFinite(integratedLoudness(audio([sine(0.2, 1000, 0.1)]))),
    ).toBe(true)
  })
})

describe('measureLoudness peaks', () => {
  it('does not skip a larger reconstructed peak because its adjacent samples are quieter', () => {
    const data = new Float32Array(48000)
    data[100] = 1
    for (let k = -7; k <= 8; k++) {
      const t = k - 0.5
      const weight =
        (Math.sin(Math.PI * t) / (Math.PI * t)) *
        (0.5 + 0.5 * Math.cos((Math.PI * t) / 8))
      data[1000 + k] = 0.7 * Math.sign(weight)
    }
    // The original kernel itself reaches +3.129 dB at the skipped interval.
    expect(measureLoudness(audio([data])).truePeakDb).toBeGreaterThan(3.12)
  })

  it('reports the sample peak', () => {
    const tone = sine(1, 1000, 0.5)
    expect(measureLoudness(audio([tone])).samplePeakDb).toBeCloseTo(-6.02, 1)
  })

  it('finds a peak that falls between samples', () => {
    // A quarter-rate sine sampled at +-45 degrees never lands on its crest:
    // every sample is 0.707 of it, so the sample peak reads 3 dB low.
    const tone = sine(1, 12000, 1, 48000, Math.PI / 4)
    const { samplePeakDb, truePeakDb } = measureLoudness(audio([tone]))
    expect(samplePeakDb).toBeCloseTo(-3.01, 1)
    expect(truePeakDb).toBeGreaterThan(-0.5)
  })
})
