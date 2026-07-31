// ============================================================
// Offline take analysis — spectrogram binning + timbre
// ============================================================

import { describe, expect, it } from 'vitest'
import { analyzeTake } from '@/lib/take-analysis'

/** A steady sine, the simplest signal with a known spectral peak. */
function sine(freq: number, seconds: number, sampleRate: number): Float32Array {
  const out = new Float32Array(Math.floor(seconds * sampleRate))
  for (let i = 0; i < out.length; i++) {
    out[i] = Math.sin((2 * Math.PI * freq * i) / sampleRate) * 0.5
  }
  return out
}

describe('analyzeTake', () => {
  it('produces a spectrogram grid sized to the render target', () => {
    const result = analyzeTake({
      samples: sine(220, 2, 16_000),
      sampleRate: 16_000,
    })

    expect(result.cols).toBeGreaterThan(0)
    expect(result.rows).toBeGreaterThan(0)
    expect(result.rows).toBeLessThanOrEqual(256)
    expect(result.cols).toBeLessThanOrEqual(1200)
    expect(result.image.length).toBe(result.cols * result.rows)
  })

  it('reports the analysed duration and the Nyquist ceiling', () => {
    const result = analyzeTake({
      samples: sine(220, 2, 16_000),
      sampleRate: 16_000,
    })

    expect(result.durationSec).toBeCloseTo(2, 1)
    expect(result.maxFreq).toBe(8000)
    expect(result.truncated).toBe(false)
  })

  it('decimates a 44.1kHz take down to the analysis rate', () => {
    const result = analyzeTake({
      samples: sine(220, 1, 44_100),
      sampleRate: 44_100,
    })

    // 44100 / floor(44100/16000) = 44100 / 2 = 22050 → Nyquist 11025.
    expect(result.maxFreq).toBeCloseTo(11_025, 0)
    expect(result.durationSec).toBeCloseTo(1, 1)
  })

  it('puts the energy of a low tone in the lower rows', () => {
    const result = analyzeTake({
      samples: sine(200, 2, 16_000),
      sampleRate: 16_000,
    })

    // Row 0 is the lowest frequency band. Compare the bottom eighth against
    // the top half, over the middle column.
    const col = Math.floor(result.cols / 2)
    const base = col * result.rows
    let lowSum = 0
    for (let r = 0; r < result.rows / 8; r++) lowSum += result.image[base + r]
    let highSum = 0
    for (let r = result.rows / 2; r < result.rows; r++) {
      highSum += result.image[base + r]
    }

    expect(lowSum).toBeGreaterThan(highSum)
  })

  it('reports progress monotonically to 90', () => {
    const seen: number[] = []
    analyzeTake({ samples: sine(220, 1, 16_000), sampleRate: 16_000 }, (pct) =>
      seen.push(pct),
    )

    expect(seen.length).toBeGreaterThan(0)
    expect(seen).toEqual([...seen].sort((a, b) => a - b))
    expect(seen[seen.length - 1]).toBeLessThanOrEqual(100)
  })

  it('measures timbre when the take has voiced energy', () => {
    const result = analyzeTake({
      samples: sine(220, 2, 16_000),
      sampleRate: 16_000,
      fundamentalHz: 220,
    })

    expect(result.timbre).not.toBeNull()
    expect(result.timbre!.fundamentalHz).toBe(220)
    expect(typeof result.timbre!.breathiness.hnrDb).toBe('number')
    expect(typeof result.timbre!.richness.richnessScore).toBe('number')
    expect(typeof result.timbre!.resonance.dominantZone).toBe('string')
  })

  it('estimates the fundamental when none is supplied', () => {
    const result = analyzeTake({
      samples: sine(330, 2, 16_000),
      sampleRate: 16_000,
    })

    // Bin width at 16kHz / 1024 is ~15.6 Hz, so allow a bin either side.
    expect(result.timbre!.fundamentalHz).toBeGreaterThan(300)
    expect(result.timbre!.fundamentalHz).toBeLessThan(360)
  })

  it('does not throw on silence', () => {
    const result = analyzeTake({
      samples: new Float32Array(16_000),
      sampleRate: 16_000,
    })

    expect(result.image.length).toBe(result.cols * result.rows)
    // Nothing voiced to measure — report no timbre rather than zeros.
    expect(result.timbre).toBeNull()
  })
})
