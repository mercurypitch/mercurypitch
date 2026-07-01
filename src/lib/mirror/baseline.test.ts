// ============================================================
// Voice Mirror baseline — localStorage round-trip and deltas.
// ============================================================

import { beforeEach, describe, expect, it } from 'vitest'
import { deltaVsBaseline, loadBaseline, saveBaseline } from './baseline'
import type { MirrorSummary } from './metrics'

const summary = (overrides: Partial<MirrorSummary> = {}): MirrorSummary => ({
  lowMidi: 43,
  highMidi: 67,
  semitones: 24,
  accuracy: 78,
  steadiness: 71,
  ...overrides,
})

describe('baseline persistence', () => {
  beforeEach(() => localStorage.clear())

  it('round-trips a summary with its timestamp', () => {
    saveBaseline(localStorage, summary(), 1750000000000)
    const stored = loadBaseline(localStorage)
    expect(stored?.summary.semitones).toBe(24)
    expect(stored?.savedAt).toBe(1750000000000)
  })

  it('returns null on first visit and on corrupt data', () => {
    expect(loadBaseline(localStorage)).toBeNull()
    localStorage.setItem('mirror.baseline.v1', '{not json')
    expect(loadBaseline(localStorage)).toBeNull()
    localStorage.setItem('mirror.baseline.v1', '"just a string"')
    expect(loadBaseline(localStorage)).toBeNull()
  })

  it('computes the delta of a later run against the baseline', () => {
    saveBaseline(localStorage, summary(), 1750000000000)
    const later = deltaVsBaseline(
      localStorage,
      summary({ semitones: 26, accuracy: 87 }),
    )
    expect(later?.delta.semitones).toBe(2)
    expect(later?.delta.accuracy).toBe(9)
    expect(later?.delta.steadiness).toBe(0)
    expect(later?.since.getTime()).toBe(1750000000000)
  })

  it('returns null delta when no baseline exists', () => {
    expect(deltaVsBaseline(localStorage, summary())).toBeNull()
  })
})
