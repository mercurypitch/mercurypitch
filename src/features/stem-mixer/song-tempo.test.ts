// ============================================================
// Song tempo — the estimate on steady synthetic pulses
// ============================================================
//
// The real measurements (two Josh Woodward songs, read at their listed 92
// and 85) are in song-tempo.ts. These hold the parts a recording cannot pin:
// the octave rule, the refinement off a whole-BPM grid, silence, and abort.

import { describe, expect, it } from 'vitest'
import { CONFIDENT_TEMPO, estimateSongTempo, foldTempo } from './song-tempo'

const RATE = 11025

/**
 * A drum-machine pulse: a loud noise burst on every beat and a softer one on
 * every eighth note, the shape that makes onsets pulse at twice the tempo.
 */
function pulse(bpm: number, seconds: number, rate = RATE): Float32Array {
  const samples = new Float32Array(Math.round(rate * seconds))
  let seed = 7
  const noise = (): number => {
    seed = (seed * 1103515245 + 12345) % 2147483648
    return seed / 1073741824 - 1
  }
  const hit = (at: number, level: number): void => {
    const from = Math.round(at * rate)
    const length = Math.round(0.03 * rate)
    for (
      let index = 0;
      index < length && from + index < samples.length;
      index++
    )
      samples[from + index] +=
        level * noise() * Math.exp(-index / (0.006 * rate))
  }
  const eighth = 30 / bpm
  for (let step = 0; step * eighth < seconds; step += 1) {
    hit(step * eighth, step % 2 === 0 ? 0.8 : 0.3)
  }
  return samples
}

describe('estimateSongTempo', () => {
  it('reads a steady 92 BPM pulse as 92, with confidence to use it', async () => {
    const estimate = await estimateSongTempo(pulse(92, 30), RATE)

    expect(estimate?.bpm).toBe(92)
    expect(estimate?.confidence).toBeGreaterThanOrEqual(CONFIDENT_TEMPO)
  })

  it('reads an 85 BPM pulse at 85, not at its 170 eighth notes', async () => {
    const estimate = await estimateSongTempo(pulse(85, 30), RATE)

    expect(estimate?.bpm).toBe(85)
  })

  it('finds a tempo between whole BPMs to the nearest one', async () => {
    // 97.4 sits inside detectTempo's 5% band around several whole BPMs.
    const estimate = await estimateSongTempo(pulse(97.4, 30), RATE)

    expect(estimate?.bpm).toBe(97)
  })

  it('reads every channel of a 44.1 kHz recording, not only the first', async () => {
    const silent = new Float32Array(44_100 * 30)
    const estimate = await estimateSongTempo(
      [silent, pulse(92, 30, 44_100)],
      44_100,
    )

    expect(estimate?.bpm).toBe(92)
  })

  it('reads no tempo from a one-second tone, which has no pulse', async () => {
    // The e2e songs are this tone (helpers/tone-wav.ts): A3 with two
    // harmonics, 48 kHz, a second long. A handful of onsets agreed on 108.
    const rate = 48_000
    const tone = new Float32Array(rate)
    for (let index = 0; index < tone.length; index += 1) {
      const phase = (2 * Math.PI * 220 * index) / rate
      tone[index] =
        0.5 * Math.sin(phase) +
        0.2 * Math.sin(2 * phase) +
        0.1 * Math.sin(3 * phase)
    }

    expect(await estimateSongTempo(tone, rate)).toBeNull()
  })

  it('returns null for silence', async () => {
    expect(
      await estimateSongTempo(new Float32Array(RATE * 10), RATE),
    ).toBeNull()
  })

  it('stops with an AbortError once aborted', async () => {
    const controller = new AbortController()
    controller.abort()

    await expect(
      estimateSongTempo(pulse(92, 30), RATE, controller.signal),
    ).rejects.toMatchObject({ name: 'AbortError' })
  })
})

describe('foldTempo', () => {
  it.each([
    [184, 92],
    [169, 84.5],
    [240, 120],
    [40, 80],
    [120, 120],
    [140, 140],
  ])('writes %s BPM at %s', (bpm, folded) => {
    expect(foldTempo(bpm)).toBe(folded)
  })
})
