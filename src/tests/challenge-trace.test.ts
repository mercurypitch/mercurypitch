import { describe, expect, it } from 'vitest'
import { loadChallengeTrace, saveChallengeTrace, shouldReplaceTrace, } from '@/features/challenges/challenge-trace'
import type { RunTrace } from '@/features/exercises/last-run-trace'
import { downsampleTrace, MAX_TRACE_POINTS, } from '@/features/exercises/last-run-trace'

function memStorage(): Pick<Storage, 'getItem' | 'setItem'> {
  const map = new Map<string, string>()
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
  }
}

const trace = (score: number): RunTrace => ({
  type: 'long-note',
  completedAt: 1_700_000_000_000 + score,
  durationMs: 8000,
  samples: [
    { t: 0.123456, f: 261.626 },
    { t: 1.5, f: 262.1 },
  ],
  targets: [{ t: 0, f: 261.63 }],
})

describe('challenge trace persistence', () => {
  it('round-trips a stored trace with compacted points', () => {
    const storage = memStorage()
    saveChallengeTrace('ch1', 72, trace(72), storage)
    const loaded = loadChallengeTrace('ch1', storage)
    expect(loaded?.score).toBe(72)
    expect(loaded?.durationMs).toBe(8000)
    // compacted to 10ms / 0.1Hz precision, positional pairs
    expect(loaded?.samples[0]).toEqual([0.12, 261.6])
    expect(loaded?.targets[0]).toEqual([0, 261.6])
  })

  it('keeps the best take: lower score never overwrites', () => {
    const storage = memStorage()
    saveChallengeTrace('ch1', 80, trace(80), storage)
    saveChallengeTrace('ch1', 60, trace(60), storage)
    expect(loadChallengeTrace('ch1', storage)?.score).toBe(80)
    // equal-or-better replaces (fresher take wins ties)
    saveChallengeTrace('ch1', 80, trace(81), storage)
    expect(loadChallengeTrace('ch1', storage)?.at).toBe(1_700_000_000_000 + 81)
  })

  it('shouldReplaceTrace: first take always stores', () => {
    expect(shouldReplaceTrace(null, 1)).toBe(true)
    expect(shouldReplaceTrace({ score: 50 }, 49)).toBe(false)
    expect(shouldReplaceTrace({ score: 50 }, 50)).toBe(true)
  })

  it('missing or corrupt entries load as null', () => {
    const storage = memStorage()
    expect(loadChallengeTrace('none', storage)).toBeNull()
    storage.setItem('mp_challenge_trace_v1_bad', '{not json')
    expect(loadChallengeTrace('bad', storage)).toBeNull()
    storage.setItem('mp_challenge_trace_v1_shape', '{"score":"x"}')
    expect(loadChallengeTrace('shape', storage)).toBeNull()
  })
})

describe('downsampleTrace', () => {
  it('passes short traces through untouched', () => {
    const pts = [
      { t: 0, f: 100 },
      { t: 1, f: 200 },
    ]
    expect(downsampleTrace(pts)).toEqual(pts)
  })

  it('caps long traces and keeps the final point', () => {
    const pts = Array.from({ length: 5000 }, (_, i) => ({
      t: i / 100,
      f: 100 + i,
    }))
    const out = downsampleTrace(pts)
    expect(out.length).toBe(MAX_TRACE_POINTS)
    expect(out[out.length - 1]).toEqual(pts[pts.length - 1])
    // strictly increasing time (no reordering/duplication drift)
    for (let i = 1; i < out.length; i++) {
      expect(out[i].t).toBeGreaterThan(out[i - 1].t)
    }
  })
})
