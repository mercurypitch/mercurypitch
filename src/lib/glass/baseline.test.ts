// ============================================================
// Glass baseline — localStorage round-trip and the delta line.
// ============================================================

import { beforeEach, describe, expect, it } from 'vitest'
import type { GlassBaseline } from './baseline'
import { formatGlassDelta, loadGlassBaseline, saveGlassBaseline, } from './baseline'

const summary = {
  targetMidi: 67,
  shatterRep: 3,
  bestLockMs: 2100,
  precisionCents: 18,
}

describe('glass baseline', () => {
  beforeEach(() => localStorage.clear())

  it('round-trips through storage', () => {
    saveGlassBaseline(localStorage, summary)
    const loaded = loadGlassBaseline(localStorage)
    expect(loaded).not.toBeNull()
    expect(loaded!.targetMidi).toBe(67)
    expect(loaded!.bestLockMs).toBe(2100)
    expect(loaded!.at).toBeGreaterThan(0)
  })

  it('returns null for missing or corrupt data', () => {
    expect(loadGlassBaseline(localStorage)).toBeNull()
    localStorage.setItem('glass.baseline.v1', '{"broken":')
    expect(loadGlassBaseline(localStorage)).toBeNull()
    localStorage.setItem('glass.baseline.v1', '{"targetMidi":"nope"}')
    expect(loadGlassBaseline(localStorage)).toBeNull()
  })

  it('formats an honest improvement line', () => {
    const previous: GlassBaseline = {
      at: Date.parse('2026-07-14T10:00:00Z'),
      targetMidi: 66,
      shatterRep: 0,
      bestLockMs: 900,
      precisionCents: 40,
    }
    const line = formatGlassDelta(previous, summary)
    expect(line).toContain('target +1 semitone')
    expect(line).toContain('lock +1.2s')
    expect(line).toContain('22¢ tighter')
  })

  it('stays silent when nothing meaningful changed', () => {
    const previous: GlassBaseline = { ...summary, at: Date.now() }
    expect(formatGlassDelta(previous, summary)).toBeNull()
  })

  it('reports regressions honestly too', () => {
    const previous: GlassBaseline = {
      at: Date.now(),
      targetMidi: 67,
      shatterRep: 1,
      bestLockMs: 2100,
      precisionCents: 10,
    }
    const line = formatGlassDelta(previous, { ...summary, precisionCents: 30 })
    expect(line).toContain('20¢ looser')
  })
})
