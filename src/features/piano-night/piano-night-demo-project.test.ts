// ============================================================
// Piano Night prepared project tests protect truthful bundled provenance
// ============================================================

import { describe, expect, it } from 'vitest'
import { pianoProjectTicksPerQuarter } from '@/features/piano-project/piano-project'
import { PIANO_NIGHT_DEMO_PROJECT, PIANO_NIGHT_PHRASES, } from './piano-night-demo-project'

describe('Piano Night prepared project', () => {
  it('ships as bounded, validated first-party project data', () => {
    expect(PIANO_NIGHT_DEMO_PROJECT.source.kind).toBe('bundled')
    expect(pianoProjectTicksPerQuarter(PIANO_NIGHT_DEMO_PROJECT)).toBe(480)
    expect(PIANO_NIGHT_DEMO_PROJECT.durationTicks).toBe(64 * 480)
    expect(PIANO_NIGHT_DEMO_PROJECT.tracks).toHaveLength(1)
    expect(PIANO_NIGHT_DEMO_PROJECT.tracks[0].events.length).toBeGreaterThan(
      200,
    )
  })

  it('covers the complete score with contiguous phrase ranges', () => {
    expect(PIANO_NIGHT_PHRASES[0].startBeat).toBe(0)
    expect(PIANO_NIGHT_PHRASES.at(-1)?.endBeat).toBe(64)
    for (let index = 1; index < PIANO_NIGHT_PHRASES.length; index += 1) {
      expect(PIANO_NIGHT_PHRASES[index].startBeat).toBe(
        PIANO_NIGHT_PHRASES[index - 1].endBeat,
      )
    }
  })
})
