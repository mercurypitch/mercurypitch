import { describe, expect, it } from 'vitest'
import { LEGENDS } from '@/features/mirror/LegendCaricature'
import { VOICE_LEGENDS, VOICE_TYPE_BANDS } from './legend-catalog'
import { voiceTypeHint } from './metrics'
import { singerForVoiceType, SINGERS_BY_VOICE_TYPE } from './singer-match'

// The roster is imported, not restated. It used to be copied into this
// file, which meant adding a legend passed a test suite that was still
// asserting against the old list.
const OPTIONS = SINGERS_BY_VOICE_TYPE

describe('singerForVoiceType', () => {
  it('derives every roster and its order from the canonical catalogue', () => {
    expect(Object.keys(OPTIONS)).toEqual(
      VOICE_TYPE_BANDS.map((band) => band.id),
    )
    for (const band of VOICE_TYPE_BANDS) {
      expect(OPTIONS[band.id]).toEqual(
        VOICE_LEGENDS.filter((legend) => legend.band === band.id).map(
          (legend) => legend.name,
        ),
      )
    }
  })

  it('returns one of the legends for each voice type', () => {
    for (const [type, options] of Object.entries(OPTIONS)) {
      expect(options).toContain(singerForVoiceType(type, 43, 67))
    }
  })

  it('is deterministic for a given range (card + chip + re-share match)', () => {
    expect(singerForVoiceType('Tenor', 48, 72)).toBe(
      singerForVoiceType('Tenor', 48, 72),
    )
  })

  it('reaches EVERY legend of EVERY type across different ranges', () => {
    // seed = |round(low)*3 + round(high)|, so holding low and stepping high
    // by one walks the seed by one — n consecutive values must therefore
    // cover an n-name roster exactly once. This is the property that makes
    // a legend reachable at all; a name nobody can be matched to is dead
    // weight, and with a 2-name roster the twin was close to a coin flip.
    for (const [type, options] of Object.entries(OPTIONS)) {
      const reached = new Set(
        options.map((_, i) => singerForVoiceType(type, 42, 70 + i)),
      )
      expect([...reached].sort(), type).toEqual([...options].sort())
    }
  })

  it('gives every voice type at least three legends', () => {
    for (const [type, options] of Object.entries(OPTIONS)) {
      expect(options.length, type).toBeGreaterThanOrEqual(3)
    }
  })

  it('never lists the same legend under two voice types', () => {
    const all = Object.values(OPTIONS).flat()
    expect(all.length).toBe(new Set(all).size)
  })

  it('has a portrait for every legend on the roster', () => {
    // singer-match names the twin; LegendCaricature draws it. A name with
    // no entry silently falls back to the generic bust, which reads as a
    // bug on the one screen the whole flow builds up to.
    const missing = Object.values(OPTIONS)
      .flat()
      .filter((name) => LEGENDS[name]?.imageSrc == null)
    expect(missing).toEqual([])
  })

  it('places Freddie Mercury under Tenor, never Baritone', () => {
    expect(OPTIONS.Tenor).toContain('Freddie Mercury')
    expect(OPTIONS.Baritone).not.toContain('Freddie Mercury')
    // No Baritone range should ever return Freddie.
    for (let low = 41; low <= 47; low++) {
      expect(singerForVoiceType('Baritone', low, low + 24)).not.toBe(
        'Freddie Mercury',
      )
    }
  })

  it('returns null for unknown or missing voice types', () => {
    expect(singerForVoiceType(null)).toBeNull()
    expect(singerForVoiceType('Countertenor', 50, 74)).toBeNull()
    expect(singerForVoiceType('')).toBeNull()
  })

  it('pairs a real detected range with a legend end-to-end', () => {
    // G2–G4 → Baritone; C4–C6 → Soprano (see metrics.test.ts).
    expect(OPTIONS.Baritone).toContain(
      singerForVoiceType(voiceTypeHint(43, 67), 43, 67),
    )
    expect(OPTIONS.Soprano).toContain(
      singerForVoiceType(voiceTypeHint(60, 84), 60, 84),
    )
  })
})
