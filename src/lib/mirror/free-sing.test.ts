// ============================================================
// Free Sing analysis — synthetic "songs": phrases with breaths,
// a home note, melodic movement and a vibrato stretch.
// ============================================================

import { describe, expect, it } from 'vitest'
import { computeFreeSing, splitPhrases } from './free-sing'
import type { F0Frame } from './metrics'
import { preprocess } from './metrics'

const HOP = 0.016
const centsToHz = (cents: number): number => 440 * 2 ** ((cents - 6900) / 1200)

interface ToneOpts {
  vibratoHz?: number
  vibratoCents?: number
  tStart?: number
}

function tone(
  midi: number,
  durationSec: number,
  opts: ToneOpts = {},
): F0Frame[] {
  const { vibratoHz = 0, vibratoCents = 0, tStart = 0 } = opts
  const frames: F0Frame[] = []
  for (let t = 0; t < durationSec; t += HOP) {
    const cents =
      midi * 100 + vibratoCents * Math.sin(2 * Math.PI * vibratoHz * t)
    frames.push({ t: tStart + t, f0: centsToHz(cents), conf: 0.95 })
  }
  return frames
}

/** A little synthetic song: home-note hold · melody run · vibrato hold. */
function song(): F0Frame[] {
  return [
    ...tone(57, 4), // phrase 1: long A3 — the home note
    ...tone(60, 0.7, { tStart: 4.6 }), // phrase 2: C4 D4 E4 D4 melody
    ...tone(62, 0.7, { tStart: 5.3 }),
    ...tone(64, 0.7, { tStart: 6.0 }),
    ...tone(62, 0.7, { tStart: 6.7 }),
    ...tone(57, 3, { tStart: 8.2, vibratoHz: 5.5, vibratoCents: 30 }), // phrase 3
  ]
}

describe('splitPhrases', () => {
  it('splits voiced frames at breath-sized gaps', () => {
    const phrases = splitPhrases(preprocess(song()))
    expect(phrases).toHaveLength(3)
  })

  it('drops sub-phrase blips', () => {
    const blip = [...tone(57, 0.2), ...tone(57, 2, { tStart: 1 })]
    expect(splitPhrases(preprocess(blip))).toHaveLength(1)
  })
})

describe('computeFreeSing', () => {
  it('finds the home note where the voice dwells most', () => {
    const result = computeFreeSing(song())
    expect(result).not.toBeNull()
    expect(result?.homeNote).toBe('A3')
  })

  it('reports phrase stats between breaths', () => {
    const result = computeFreeSing(song())
    expect(result?.phrases?.count).toBe(3)
    expect(result?.phrases?.longestSec).toBeGreaterThan(3.5)
    expect(result?.phrases?.medianSec).toBeGreaterThan(2)
  })

  it('measures range-in-use and a sensible tessitura', () => {
    const result = computeFreeSing(song())
    expect(result?.range?.lowNote).toBe('A3')
    expect(result?.range?.highNote).toBe('E4')
    // Dwell is dominated by the two A3 holds.
    expect(result?.tessituraLowMidi).toBe(57)
    expect(result?.tessituraHighMidi).toBeLessThanOrEqual(62)
  })

  it('separates movers from sustainers', () => {
    const sustained = computeFreeSing(tone(57, 10))
    const moving = computeFreeSing(song())
    expect(sustained?.agilityMovesPerSec ?? 99).toBeLessThan(0.2)
    expect(moving?.agilityMovesPerSec ?? 0).toBeGreaterThan(0.3)
  })

  it('hears vibrato on the longest sustained stretch when present', () => {
    const withVibrato = computeFreeSing([
      ...tone(57, 5, { vibratoHz: 5.5, vibratoCents: 30 }),
      ...tone(60, 1.5, { tStart: 5.6 }),
    ])
    expect(withVibrato?.vibrato).not.toBeNull()
    expect(withVibrato?.vibrato?.rateHz).toBeGreaterThan(4.5)
    expect(withVibrato?.vibrato?.rateHz).toBeLessThan(6.5)
  })

  it('returns null on silence', () => {
    const silent: F0Frame[] = Array.from({ length: 200 }, (_, i) => ({
      t: i * HOP,
      f0: 0,
      conf: 0,
    }))
    expect(computeFreeSing(silent)).toBeNull()
  })
})
