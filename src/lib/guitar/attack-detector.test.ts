// Attack-detector tests drive real waveforms, not stand-ins for them.
// ============================================================
//
// The failure modes worth guarding are all shape, not arithmetic: one strike
// read as two, a decay read as a strike, a fast run read as one long note.
// So every case here renders an actual plucked-string signal and feeds it
// through in 128-sample blocks, exactly as the worklet will.

import { describe, expect, it } from 'vitest'
import { createAttackDetector, holdDecayFactor } from './attack-detector'

const SAMPLE_RATE = 48000
const QUANTUM = 128

interface Pluck {
  atSec: number
  amplitude: number
  freqHz?: number
  /** Exponential decay constant. A quarter second is a plain plucked note. */
  decaySec?: number
}

/** Render decaying sine plucks into one buffer, summed where they overlap. */
function renderPlucks(
  durationSec: number,
  plucks: readonly Pluck[],
): Float32Array {
  const buffer = new Float32Array(Math.round(durationSec * SAMPLE_RATE))
  for (const pluck of plucks) {
    const start = Math.round(pluck.atSec * SAMPLE_RATE)
    const freq = pluck.freqHz ?? 110
    const decay = pluck.decaySec ?? 0.25
    for (let index = start; index < buffer.length; index += 1) {
      const elapsed = (index - start) / SAMPLE_RATE
      buffer[index] +=
        pluck.amplitude *
        Math.exp(-elapsed / decay) *
        Math.sin(2 * Math.PI * freq * elapsed)
    }
  }
  return buffer
}

/** Feed a whole signal through block by block, returning attack times in ms. */
function attackTimesMs(
  signal: Float32Array,
  detector = createAttackDetector({ sampleRate: SAMPLE_RATE }),
): number[] {
  const times: number[] = []
  for (let start = 0; start < signal.length; start += QUANTUM) {
    const block = signal.subarray(
      start,
      Math.min(start + QUANTUM, signal.length),
    )
    for (const attack of detector.process(block)) {
      times.push(((start + attack.offsetSamples) / SAMPLE_RATE) * 1000)
    }
  }
  return times
}

describe('holdDecayFactor', () => {
  it('drops a peak immediately when asked to hold it for no time', () => {
    expect(holdDecayFactor(0, SAMPLE_RATE)).toBe(0)
    expect(holdDecayFactor(-5, SAMPLE_RATE)).toBe(0)
  })

  it('holds a peak longer the longer the time constant', () => {
    const brief = holdDecayFactor(5, SAMPLE_RATE)
    const long = holdDecayFactor(200, SAMPLE_RATE)
    expect(long).toBeGreaterThan(brief)
    expect(long).toBeLessThan(1)
    expect(brief).toBeGreaterThan(0)
  })
})

describe('createAttackDetector', () => {
  it('hears nothing in silence', () => {
    expect(attackTimesMs(new Float32Array(SAMPLE_RATE))).toEqual([])
  })

  it('leaves room noise below the floor alone', () => {
    // A steady hiss an order of magnitude under the floor. Deterministic on
    // purpose: a seeded shape, not Math.random, so a failure is reproducible.
    const noise = new Float32Array(SAMPLE_RATE)
    for (let index = 0; index < noise.length; index += 1) {
      noise[index] = 0.004 * Math.sin(index * 12.9898)
    }
    expect(attackTimesMs(noise)).toEqual([])
  })

  it('finds one strike, at the moment it was struck', () => {
    const times = attackTimesMs(
      renderPlucks(1, [{ atSec: 0.2, amplitude: 0.5 }]),
    )
    expect(times).toHaveLength(1)
    expect(times[0]).toBeGreaterThanOrEqual(200)
    expect(times[0]).toBeLessThan(202)
  })

  it('does not read a decaying note as a second strike', () => {
    // Two seconds of one note dying away — the case a plain level threshold
    // fires on repeatedly as the envelope wobbles past it.
    const times = attackTimesMs(
      renderPlucks(2, [{ atSec: 0.1, amplitude: 0.6, decaySec: 0.9 }]),
    )
    expect(times).toHaveLength(1)
  })

  it('does not read a held chord as a second strike', () => {
    // A tone that never decays at all: the reference floor climbs towards it
    // and, without the re-arm rule, the ratio test would fire again on the way.
    const held = new Float32Array(SAMPLE_RATE)
    for (let index = 0; index < held.length; index += 1) {
      held[index] = 0.4 * Math.sin((2 * Math.PI * 196 * index) / SAMPLE_RATE)
    }
    expect(attackTimesMs(held)).toHaveLength(1)
  })

  it('keeps up with sixteenths at 150 BPM on a ringing string', () => {
    const spacing = 0.1
    const plucks = Array.from({ length: 8 }, (_, index) => ({
      atSec: 0.15 + index * spacing,
      amplitude: 0.5,
      decaySec: 0.25,
    }))
    const times = attackTimesMs(renderPlucks(1.4, plucks))

    expect(times).toHaveLength(8)
    for (const [index, time] of times.entries()) {
      // Never early, and inside a couple of milliseconds. The lag is the time
      // the string needs to swing far enough to be distinguishable from the
      // note still ringing under it — a real property of the signal, not slack.
      const struckAt = (0.15 + index * spacing) * 1000
      expect(time).toBeGreaterThanOrEqual(struckAt)
      expect(time - struckAt).toBeLessThan(2)
    }
  })

  it('hears a quiet note struck while a loud one is still ringing', () => {
    const times = attackTimesMs(
      renderPlucks(1.5, [
        { atSec: 0.1, amplitude: 0.6, decaySec: 0.5 },
        { atSec: 0.45, amplitude: 0.35, freqHz: 165, decaySec: 0.5 },
      ]),
    )
    expect(times).toHaveLength(2)
    // A note quieter than the one masking it takes a few milliseconds to clear
    // it. Late by four is the honest cost; inventing an earlier time is not.
    expect(times[1]).toBeGreaterThanOrEqual(450)
    expect(times[1]).toBeLessThan(456)
  })

  it('reports the loudest sample of the last block for the meter', () => {
    const detector = createAttackDetector({ sampleRate: SAMPLE_RATE })
    const block = new Float32Array(QUANTUM)
    block[40] = -0.82
    detector.process(block)
    expect(detector.peak()).toBeCloseTo(0.82, 5)

    detector.process(new Float32Array(QUANTUM))
    expect(detector.peak()).toBe(0)
  })

  it('resets to a state that hears the next note as a first note', () => {
    const detector = createAttackDetector({ sampleRate: SAMPLE_RATE })
    const signal = renderPlucks(0.5, [{ atSec: 0.05, amplitude: 0.5 }])
    expect(attackTimesMs(signal, detector)).toHaveLength(1)

    detector.reset()
    expect(detector.floor()).toBe(0)
    expect(attackTimesMs(signal, detector)).toHaveLength(1)
  })

  it('a stricter floor ignores a note played too softly to be evidence', () => {
    const quiet = renderPlucks(0.6, [{ atSec: 0.1, amplitude: 0.05 }])
    expect(attackTimesMs(quiet)).toHaveLength(1)
    expect(
      attackTimesMs(
        quiet,
        createAttackDetector({ sampleRate: SAMPLE_RATE, floorLevel: 0.2 }),
      ),
    ).toEqual([])
  })
})
