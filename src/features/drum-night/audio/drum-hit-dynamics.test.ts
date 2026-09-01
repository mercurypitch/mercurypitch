// ============================================================
// Drum hit dynamics tests — velocity curves, brightness, variation, onset
// ============================================================

import { describe, expect, it } from 'vitest'
import { brightnessCutoffHz, measureOnsetSeconds, microVariation, velocityCurveTarget, velocityGain, } from './drum-hit-dynamics'
import { mulberry32 } from './drum-sample-select'

describe('velocityGain', () => {
  it('reaches unity at full velocity and the floor at v=1', () => {
    expect(velocityGain('kick', 127)).toBeCloseTo(1, 5)
    expect(velocityGain('hh-closed', 127)).toBeCloseTo(1, 5)
    expect(velocityGain('kick', 1)).toBeCloseTo(0.02, 5)
    expect(velocityGain('ride', 1)).toBeCloseTo(0.02, 5)
  })

  it('gives metals a shallower curve than drums', () => {
    expect(velocityGain('hh-closed', 64)).toBeGreaterThan(
      velocityGain('kick', 64),
    )
    expect(velocityGain('crash', 40)).toBeGreaterThan(velocityGain('snare', 40))
  })

  it('clamps out-of-range velocities', () => {
    expect(velocityGain('kick', 200)).toBeCloseTo(1, 5)
    expect(velocityGain('kick', -5)).toBeCloseTo(0.02, 5)
  })

  it('interpolates a validated kit curve without changing the legacy default', () => {
    const curve = [
      [1, 0.08],
      [64, 0.6],
      [127, 1],
    ] as const

    expect(velocityCurveTarget('kick', 1, curve)).toBeCloseTo(0.08, 8)
    expect(velocityCurveTarget('kick', 64, curve)).toBeCloseTo(0.6, 8)
    expect(velocityCurveTarget('kick', 32.5, curve)).toBeCloseTo(0.34, 8)
    expect(velocityGain('kick', 64)).toBeCloseTo(
      0.02 + 0.98 * ((64 - 1) / 126) ** 2,
      8,
    )
  })

  it('closes a measured sample-power gap by at most three decibels', () => {
    const flatCurve = [
      [1, 0.5],
      [127, 0.5],
    ] as const

    expect(velocityGain('kick', 80, flatCurve, 0.5)).toBeCloseTo(1, 8)
    expect(velocityGain('kick', 80, flatCurve, 0.9)).toBeCloseTo(
      10 ** (-3 / 20),
      8,
    )
    expect(velocityGain('kick', 80, flatCurve, 0.1)).toBeCloseTo(
      10 ** (3 / 20),
      8,
    )
    expect(0.5 * velocityGain('kick', 80, flatCurve, 0.5)).toBeCloseTo(0.5, 8)
    expect(
      0.02 *
        velocityGain(
          'kick',
          1,
          [
            [1, 0.02],
            [127, 1],
          ],
          0.02,
        ),
    ).toBeCloseTo(0.02, 8)
  })
})

describe('brightnessCutoffHz', () => {
  it('darkens soft hits and bypasses loud ones', () => {
    const soft = brightnessCutoffHz(8)
    expect(soft).not.toBeNull()
    expect(soft as number).toBeGreaterThan(1200)
    expect(soft as number).toBeLessThan(1500)
    expect(brightnessCutoffHz(127)).toBeNull()
    expect(brightnessCutoffHz(120)).toBeNull()
  })

  it('grows monotonically with velocity below the bypass point', () => {
    const a = brightnessCutoffHz(20) as number
    const b = brightnessCutoffHz(60) as number
    const c = brightnessCutoffHz(100) as number
    expect(b).toBeGreaterThan(a)
    expect(c).toBeGreaterThan(b)
  })
})

describe('microVariation', () => {
  it('stays inside documented bounds and is seed-deterministic', () => {
    const random = mulberry32(9)
    const again = mulberry32(9)
    for (let index = 0; index < 200; index += 1) {
      const kick = microVariation(random, 'kick')
      expect(kick.rateRatio).toBeGreaterThanOrEqual(2 ** (-10 / 1200))
      expect(kick.rateRatio).toBeLessThanOrEqual(2 ** (10 / 1200))
      expect(kick.gainScale).toBeGreaterThanOrEqual(10 ** (-0.75 / 20))
      expect(kick.gainScale).toBeLessThanOrEqual(10 ** (0.75 / 20))
      expect(kick.cutoffScale).toBeGreaterThanOrEqual(0.94)
      expect(kick.cutoffScale).toBeLessThanOrEqual(1.06)
      expect(kick.startOffsetSec).toBeGreaterThanOrEqual(0)
      expect(kick.startOffsetSec).toBeLessThanOrEqual(0.0004)
    }
    expect(microVariation(again, 'kick')).toEqual(
      microVariation(mulberry32(9), 'kick'),
    )
  })

  it('lets metals wander further in pitch than drums', () => {
    const random = mulberry32(21)
    let widestHat = 0
    let widestKick = 0
    for (let index = 0; index < 400; index += 1) {
      widestHat = Math.max(
        widestHat,
        Math.abs(Math.log2(microVariation(random, 'hh-open').rateRatio)),
      )
      widestKick = Math.max(
        widestKick,
        Math.abs(Math.log2(microVariation(random, 'kick').rateRatio)),
      )
    }
    expect(widestHat).toBeGreaterThan(widestKick)
    expect(widestHat).toBeLessThanOrEqual(25 / 1200 + 1e-9)
  })
})

describe('measureOnsetSeconds', () => {
  function bufferWith(samples: Float32Array, sampleRate = 48_000): AudioBuffer {
    return {
      duration: samples.length / sampleRate,
      length: samples.length,
      numberOfChannels: 1,
      sampleRate,
      getChannelData: () => samples,
    } as unknown as AudioBuffer
  }

  it('finds a 30 ms onset within 1.5 ms and keeps a 1 ms preroll', () => {
    const sampleRate = 48_000
    const samples = new Float32Array(sampleRate)
    const onsetIndex = Math.round(0.03 * sampleRate)
    for (let index = onsetIndex; index < samples.length; index += 1) {
      samples[index] = 0.5
    }
    const measured = measureOnsetSeconds(bufferWith(samples))
    expect(measured).toBeGreaterThan(0.0275)
    expect(measured).toBeLessThan(0.0305)
  })

  it('returns 0 for silence, immediate onsets, and unreadable buffers', () => {
    expect(measureOnsetSeconds(bufferWith(new Float32Array(4800)))).toBe(0)
    const hot = new Float32Array(480).fill(0.9)
    expect(measureOnsetSeconds(bufferWith(hot))).toBe(0)
    const unreadable = {
      duration: 0.1,
      length: 4800,
      numberOfChannels: 2,
      sampleRate: 48_000,
    } as unknown as AudioBuffer
    expect(measureOnsetSeconds(unreadable)).toBe(0)
  })
})
