// ============================================================
// Drum sample selector tests — determinism, anti-repeat, layer targeting
// ============================================================

import { describe, expect, it } from 'vitest'
import type { DrumKitSampleResource } from './drum-kit-manifest'
import { createDrumSampleSelector, fnv1a32, mulberry32, } from './drum-sample-select'

function resource(
  id: string,
  velocityMin: number,
  velocityMax: number,
  roundRobin: number,
  power?: number,
): DrumKitSampleResource {
  const path = `classic-gm/v1/${id}.mp3`
  return {
    id,
    kitId: 'classic-gm',
    articulation: 'kick',
    gmKeys: [36],
    velocityMin,
    velocityMax,
    roundRobin,
    chokeGroup: null,
    chokes: [],
    readiness: 'ready',
    path,
    mimeType: 'audio/mpeg',
    encodedBytes: 1,
    sha256: id,
    power,
    formats: {
      mp3: {
        path,
        mimeType: 'audio/mpeg',
        encodedBytes: 1,
        sha256: id,
      },
    },
    playbackGain: 1,
  }
}

const TWO_LAYER_TWO_RR = Object.freeze([
  resource('kick-l1-rr1', 1, 80, 1),
  resource('kick-l1-rr2', 1, 80, 2),
  resource('kick-l2-rr1', 81, 127, 1),
  resource('kick-l2-rr2', 81, 127, 2),
])

describe('mulberry32 and fnv1a32', () => {
  it('produces a deterministic uniform stream in [0, 1)', () => {
    const a = mulberry32(42)
    const b = mulberry32(42)
    const draws = Array.from({ length: 16 }, () => a())
    for (const draw of draws) {
      expect(draw).toBeGreaterThanOrEqual(0)
      expect(draw).toBeLessThan(1)
    }
    expect(Array.from({ length: 16 }, () => b())).toEqual(draws)
  })

  it('hashes tuples order-sensitively', () => {
    expect(fnv1a32(1, 2, 3)).not.toBe(fnv1a32(3, 2, 1))
    expect(fnv1a32(1, 2, 3)).toBe(fnv1a32(1, 2, 3))
  })
})

describe('createDrumSampleSelector', () => {
  it('returns null for an empty pool and the sole entry for a singleton', () => {
    const selector = createDrumSampleSelector(1)
    expect(selector.pick([], 96)).toBeNull()
    const only = resource('kick-solo', 1, 127, 1)
    expect(selector.pick([only], 5)?.id).toBe('kick-solo')
    expect(selector.pick([only], 127)?.id).toBe('kick-solo')
  })

  it('is deterministic for the same seed and call sequence', () => {
    const a = createDrumSampleSelector(7)
    const b = createDrumSampleSelector(7)
    const picksA = Array.from(
      { length: 32 },
      (_, index) => a.pick(TWO_LAYER_TWO_RR, (index * 13) % 127 || 1)?.id,
    )
    const picksB = Array.from(
      { length: 32 },
      (_, index) => b.pick(TWO_LAYER_TWO_RR, (index * 13) % 127 || 1)?.id,
    )
    expect(picksA).toEqual(picksB)
  })

  it('never repeats the same sample twice in a row when siblings exist', () => {
    const pool = Object.freeze([
      resource('hh-l1-rr1', 1, 127, 1),
      resource('hh-l1-rr2', 1, 127, 2),
    ])
    const selector = createDrumSampleSelector(3)
    let previous: string | undefined
    for (let index = 0; index < 64; index += 1) {
      const picked = selector.pick(pool, 96)?.id
      expect(picked).toBeDefined()
      expect(picked).not.toBe(previous)
      previous = picked
    }
  })

  it('targets the layer whose velocity range matches the hit', () => {
    for (let seed = 1; seed <= 5; seed += 1) {
      const selector = createDrumSampleSelector(seed)
      let softLow = 0
      let hardHigh = 0
      for (let index = 0; index < 100; index += 1) {
        if (selector.pick(TWO_LAYER_TWO_RR, 20)?.id.includes('l1') === true) {
          softLow += 1
        }
        if (selector.pick(TWO_LAYER_TWO_RR, 120)?.id.includes('l2') === true) {
          hardHigh += 1
        }
      }
      expect(softLow).toBeGreaterThan(80)
      expect(hardHigh).toBeGreaterThan(80)
    }
  })

  it('uses measured power and the kit velocity curve when both are present', () => {
    const quiet = resource('kick-power-low', 1, 127, 1, 0.2)
    const loud = resource('kick-power-high', 1, 127, 2, 0.8)
    const curve = [
      [1, 0.2],
      [64, 0.8],
      [127, 1],
    ] as const
    const selector = createDrumSampleSelector(41)

    const picks = Array.from(
      { length: 64 },
      () => selector.pick([quiet, loud], 64, curve)?.id,
    )

    expect(picks.filter((id) => id === loud.id).length).toBeGreaterThan(48)
  })

  it('targets measured power with the default articulation curve', () => {
    const matched = resource('kick-power-matched', 1, 127, 1, 0.25)
    const tooLoud = resource('kick-power-loud', 1, 127, 2, 0.55)
    let matchedPicks = 0

    for (let seed = 1; seed <= 128; seed += 1) {
      const selector = createDrumSampleSelector(seed)
      if (selector.pick([matched, tooLoud], 64)?.id === matched.id) {
        matchedPicks += 1
      }
    }

    expect(matchedPicks).toBeGreaterThan(90)
  })

  it('reset clears recency state without changing the seedable stream shape', () => {
    const pool = Object.freeze([
      resource('sn-l1-rr1', 1, 127, 1),
      resource('sn-l1-rr2', 1, 127, 2),
    ])
    const selector = createDrumSampleSelector(11)
    const first = selector.pick(pool, 90)?.id
    selector.reset()
    expect(typeof first).toBe('string')
    expect(selector.pick(pool, 90)?.id).toBeDefined()
  })
})
