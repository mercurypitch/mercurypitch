// ============================================================
// First note's count-in, on a band made here to a known tempo
// ============================================================
//
// The beats (band-beats.ts) are the script's and the phone's both. These
// hold them to a band whose answer is known: clicks at a known tempo and
// phase, over a little noise.

import { describe, expect, it } from 'vitest'
import { BAND_RATE, beatsBefore, onsets, onsetSteps, tempoOf, } from './band-beats'

/** A seeded random source, the same every run. */
function seeded(seed = 11): () => number {
  let state = seed
  return () => {
    state = (state * 16807) % 2147483647
    return (state - 1) / 2147483646
  }
}

/** A band of clicks every `period` s from `phase`, over a little noise. */
function clicks(seconds: number, period: number, phase: number): Float32Array {
  const random = seeded()
  const rate = BAND_RATE
  const samples = new Float32Array(Math.round(seconds * rate))
  for (let i = 0; i < samples.length; i++) {
    samples[i] = 0.01 * (random() * 2 - 1)
  }
  for (let t = phase; t < seconds; t += period) {
    const at = Math.round(t * rate)
    for (let i = 0; i < 220 && at + i < samples.length; i++) {
      samples[at + i] += 0.8 * (random() * 2 - 1) * Math.exp(-i / 40)
    }
  }
  return samples
}

describe('the beats', () => {
  const band = clicks(30, 0.5, 0.25)
  const whole = onsets({ samples: band, rate: BAND_RATE })

  it("reads the band's tempo from its onsets", () => {
    expect(Math.abs(tempoOf([whole]) - 120)).toBeLessThanOrEqual(1)
  })

  it('reads the onsets in steps, a step a spectrum, to the same grid', () => {
    const stretch = { samples: band.slice(0, 4 * BAND_RATE), rate: BAND_RATE }
    const steps = onsetSteps(stretch, 2)
    let taken = 0
    let step = steps.next()
    while (step.done !== true) {
      taken += 1
      step = steps.next()
    }
    expect(step.value).toEqual(onsets(stretch, 2))
    expect(taken).toBe(step.value.flux.length)
  })

  it('reads the same tempo from the lead-ins alone', () => {
    const rate = BAND_RATE
    const stretch = (from: number, to: number) =>
      onsets(
        {
          samples: band.slice(Math.round(from * rate), Math.round(to * rate)),
          rate,
        },
        from,
      )
    const leadIns = [
      stretch(1.7, 10.3),
      stretch(11.7, 20.3),
      stretch(19.7, 28.3),
    ]
    expect(Math.abs(tempoOf(leadIns) - 120)).toBeLessThanOrEqual(1)
    // A stretch keeps its place on the song's clock.
    const beats = beatsBefore(leadIns[1], 120, 12, 20)
    expect(beats).toHaveLength(4)
    for (let i = 1; i < beats.length; i++) {
      expect(beats[i] - beats[i - 1]).toBeCloseTo(0.5, 1)
    }
    expect(beats[3]).toBeLessThan(20)
    expect(beats[3]).toBeGreaterThan(19.3)
  })

  it('counts the last four before the entry, on the grid', () => {
    const beats = beatsBefore(whole, 120, 20, 28)
    expect(beats).toHaveLength(4)
    for (let i = 1; i < beats.length; i++) {
      expect(beats[i] - beats[i - 1]).toBeCloseTo(0.5, 1)
    }
    // On the clicks (a little ahead of them: an onset reads as its window
    // starts), never after the entry.
    for (const beat of beats) {
      const off = (((beat - 0.25) % 0.5) + 0.5) % 0.5
      expect(Math.min(off, 0.5 - off)).toBeLessThan(0.06)
      expect(beat).toBeLessThan(28)
    }
  })

  it('counts none where the beats carry no more onset than the rest', () => {
    // As busy between the beats as on them: no grid to count.
    const flat = { flux: new Array<number>(1200).fill(1), fps: 100, start: 0 }
    expect(beatsBefore(flat, 120, 2, 10)).toEqual([])
    // Nothing at all: a lead-in with no onsets.
    const silence = onsets({
      samples: new Float32Array(12 * BAND_RATE),
      rate: BAND_RATE,
    })
    expect(beatsBefore(silence, 120, 2, 10)).toEqual([])
  })

  it('counts none without a tempo', () => {
    expect(beatsBefore(whole, 0, 20, 28)).toEqual([])
    expect(tempoOf([])).toBe(0)
  })
})
