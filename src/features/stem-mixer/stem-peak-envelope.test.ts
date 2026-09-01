// ============================================================
// The waveform's data, at a thousandth of the song's memory
// ============================================================
//
// The canvas draws a signed waveform from per-column minima and maxima, so an
// envelope of absolute peaks would render as a one-sided smear — which is why
// buckets alternate. And the duration has to be the audio's, not the bucket
// count's, because the transport maps positions through it.

import { describe, expect, it } from 'vitest'
import { createPeakEnvelopeBuilder, DEFAULT_PEAK_ENVELOPE_RATE, fillPeakEnvelopeWindow, silentPeakEnvelope, } from './stem-peak-envelope'

const RATE = 48_000

/** A ramp is easy to reason about: bucket k's extremes are its endpoints. */
function ramp(frames: number, from: number, to: number): Float32Array {
  const data = new Float32Array(frames)
  for (let i = 0; i < frames; i++) {
    data[i] = from + ((to - from) * i) / Math.max(1, frames - 1)
  }
  return data
}

describe('what the envelope keeps', () => {
  it('keeps the peak in both directions, not a rectified one', () => {
    const builder = createPeakEnvelopeBuilder(4)
    // One second, four buckets, every sample either +1 or -1.
    const data = new Float32Array(RATE)
    for (let i = 0; i < data.length; i++) data[i] = i % 2 === 0 ? 1 : -1
    builder.push([data], RATE)
    const envelope = builder.build()

    expect(envelope.data.length).toBe(4)
    // Alternating, so a column always spans a real minimum and maximum.
    expect(Array.from(envelope.data)).toEqual([1, -1, 1, -1])
  })

  it('reports the audio’s duration, not the bucket count’s', () => {
    const builder = createPeakEnvelopeBuilder(1000)
    builder.push([ramp(RATE * 3, -1, 1)], RATE)
    const envelope = builder.build()

    expect(envelope.durationSeconds).toBeCloseTo(3, 6)
    expect(envelope.sampleRate).toBe(1000)
    // Close enough that `buffer.duration` and the transport agree.
    expect(envelope.data.length / envelope.sampleRate).toBeCloseTo(3, 2)
  })

  it('carries a bucket across a chunk boundary instead of dropping it', () => {
    // Chunks of 100 frames with a bucket of 480: nothing lines up, and a
    // per-chunk implementation would lose the tail of every one.
    const builder = createPeakEnvelopeBuilder(100)
    const chunkFrames = 100
    const chunks = 48
    for (let c = 0; c < chunks; c++) {
      builder.push(
        [new Float32Array(chunkFrames).fill(c % 2 === 0 ? 1 : -1)],
        RATE,
      )
    }
    const envelope = builder.build()

    expect(envelope.durationSeconds).toBeCloseTo(
      (chunkFrames * chunks) / RATE,
      6,
    )
    // 4800 frames at 100 Hz is 10 buckets; the last partial one is kept.
    expect(envelope.data.length).toBe(10)
  })

  it('finds an extreme that sits inside a chunk, not only at its edges', () => {
    const builder = createPeakEnvelopeBuilder(2)
    const data = new Float32Array(RATE)
    data[100] = 0.75
    data[RATE - 100] = -0.75
    builder.push([data], RATE)
    const envelope = builder.build()

    expect(envelope.data[0]).toBeCloseTo(0.75, 6)
    expect(envelope.data[1]).toBeCloseTo(-0.75, 6)
  })

  it('survives being asked for nothing', () => {
    const envelope = createPeakEnvelopeBuilder(4000).build()
    expect(envelope.data.length).toBe(0)
    expect(envelope.durationSeconds).toBe(0)
  })
})

describe('a lane filled in as the song plays', () => {
  it('starts empty and the right length', () => {
    const envelope = silentPeakEnvelope(246.3, 1000)
    expect(envelope.data.length).toBe(246_300)
    expect(envelope.durationSeconds).toBeCloseTo(246.3, 6)
    expect(envelope.data.every((v) => v === 0)).toBe(true)
  })

  it('writes a window at the song position it belongs to', () => {
    const envelope = silentPeakEnvelope(10, 100)
    const window = new Float32Array(RATE)
    for (let i = 0; i < window.length; i++) window[i] = i % 2 === 0 ? 0.6 : -0.6

    // One second of audio, dropped in at four seconds.
    fillPeakEnvelopeWindow(envelope.data, 100, 4, window, RATE)

    // Before and after are untouched; the second it covers is not.
    expect(envelope.data.slice(0, 400).every((v) => v === 0)).toBe(true)
    expect(envelope.data.slice(500).every((v) => v === 0)).toBe(true)
    const written = envelope.data.slice(400, 500)
    expect(written.some((v) => v > 0.5)).toBe(true)
    expect(written.some((v) => v < -0.5)).toBe(true)
  })

  it('looks the same as a lane built in one pass', () => {
    const seconds = 4
    const source = new Float32Array(seconds * RATE)
    for (let i = 0; i < source.length; i++) {
      source[i] = 0.8 * Math.sin((i / RATE) * 2 * Math.PI * 110)
    }

    const built = createPeakEnvelopeBuilder(200)
    built.push([source], RATE)
    const inOnePass = built.build()

    const filled = silentPeakEnvelope(seconds, 200)
    // In window-sized pieces, as playback would deliver them.
    for (let at = 0; at < seconds; at++) {
      fillPeakEnvelopeWindow(
        filled.data,
        200,
        at,
        source.subarray(at * RATE, (at + 1) * RATE),
        RATE,
      )
    }

    expect(filled.data.length).toBe(inOnePass.data.length)
    for (let i = 0; i < filled.data.length; i++) {
      expect(filled.data[i]).toBeCloseTo(inOnePass.data[i], 5)
    }
  })

  it('ignores a window that falls outside the lane', () => {
    const envelope = silentPeakEnvelope(2, 100)
    const window = new Float32Array(RATE).fill(0.9)

    fillPeakEnvelopeWindow(envelope.data, 100, 30, window, RATE)
    fillPeakEnvelopeWindow(envelope.data, 100, -30, window, RATE)

    expect(envelope.data.every((v) => v === 0)).toBe(true)
  })
})

describe('what the canvas gets out of it', () => {
  it('still tells a loud passage from a quiet one, column by column', () => {
    // The canvas draws a column per pixel by taking the extremes of the
    // samples that fall in it. Whether that reads as a waveform is the only
    // thing the display half has to get right.
    const builder = createPeakEnvelopeBuilder(DEFAULT_PEAK_ENVELOPE_RATE)
    const seconds = 8
    const source = new Float32Array(seconds * RATE)
    for (let i = 0; i < source.length; i++) {
      const loud = i < source.length / 2
      source[i] = (loud ? 0.9 : 0.1) * Math.sin((i / RATE) * 2 * Math.PI * 220)
    }
    // Pushed in chunks, as a decoder would deliver it.
    for (let at = 0; at < source.length; at += 1024) {
      builder.push([source.subarray(at, at + 1024)], RATE)
    }
    const envelope = builder.build()

    // 350 columns — a phone's waveform lane — across the whole envelope.
    const columns = 350
    const column = (index: number): { min: number; max: number } => {
      const from = Math.floor((index / columns) * envelope.data.length)
      const to = Math.floor(((index + 1) / columns) * envelope.data.length)
      let min = Number.POSITIVE_INFINITY
      let max = Number.NEGATIVE_INFINITY
      for (let i = from; i < to; i++) {
        min = Math.min(min, envelope.data[i])
        max = Math.max(max, envelope.data[i])
      }
      return { min, max }
    }

    const loud = column(80)
    const quiet = column(270)
    expect(loud.max).toBeGreaterThan(0.8)
    expect(loud.min).toBeLessThan(-0.8)
    expect(quiet.max).toBeLessThan(0.15)
    expect(quiet.min).toBeGreaterThan(-0.15)
    // Every column has real samples in it, so none of the lane is blank.
    for (let i = 0; i < columns; i++) {
      expect(Number.isFinite(column(i).max)).toBe(true)
    }
  })
})

describe('what the envelope costs', () => {
  it('is a few megabytes where the decode was ninety', () => {
    const songSeconds = 246.3
    const envelopeBytes = songSeconds * DEFAULT_PEAK_ENVELOPE_RATE * 4
    const decodedBytes = songSeconds * 48_000 * 2 * 4

    expect(envelopeBytes).toBeLessThan(5 * 1024 * 1024)
    // The ratio is the reason the tab lives: 24× off the display half alone.
    expect(decodedBytes / envelopeBytes).toBeGreaterThan(20)
  })
})
