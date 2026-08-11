// ============================================================
// Piano Night practice-section tests protect unanalysed-source truth
// ============================================================

import { describe, expect, it } from 'vitest'
import { createPianoNightPracticeSections } from './piano-night-practice-sections'

describe('createPianoNightPracticeSections', () => {
  it('builds deterministic bounded windows without claiming authored phrases', () => {
    expect(createPianoNightPracticeSections(35)).toEqual([
      expect.objectContaining({
        startBeat: 0,
        endBeat: 16,
        range: 'beats 0–16',
        focus: 'Project section · not analysed',
      }),
      expect.objectContaining({
        startBeat: 16,
        endBeat: 32,
        range: 'beats 16–32',
      }),
      expect.objectContaining({
        startBeat: 32,
        endBeat: 35,
        range: 'beats 32–35',
      }),
    ])
  })

  it('keeps a short or malformed duration on one safe section', () => {
    expect(createPianoNightPracticeSections(7.5)).toEqual([
      expect.objectContaining({
        startBeat: 0,
        endBeat: 7.5,
        range: 'full piece · beats 0–7.5',
      }),
    ])
    expect(createPianoNightPracticeSections(Number.NaN)).toHaveLength(1)
  })
})
