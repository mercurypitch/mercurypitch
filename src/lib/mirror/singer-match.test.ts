import { describe, expect, it } from 'vitest'
import { voiceTypeHint } from './metrics'
import { singerForVoiceType } from './singer-match'

const OPTIONS: Record<string, string[]> = {
  Bass: ['Johnny Cash', 'Barry White'],
  Baritone: ['Elvis Presley', 'Frank Sinatra'],
  Tenor: ['Freddie Mercury', 'Bruce Dickinson'],
  Alto: ['Amy Winehouse', 'Cher'],
  'Mezzo-soprano': ['Adele', 'Whitney Houston'],
  Soprano: ['Mariah Carey', 'Celine Dion'],
}

describe('singerForVoiceType', () => {
  it('returns one of the two legends for each voice type', () => {
    for (const [type, options] of Object.entries(OPTIONS)) {
      expect(options).toContain(singerForVoiceType(type, 43, 67))
    }
  })

  it('is deterministic for a given range (card + chip + re-share match)', () => {
    expect(singerForVoiceType('Tenor', 48, 72)).toBe(
      singerForVoiceType('Tenor', 48, 72),
    )
  })

  it('can reach BOTH legends of a type across different ranges', () => {
    // seed = lowMidi*3 + highMidi; 48*3+72=216 (even → [0]), 48*3+73=217 (odd → [1])
    expect(singerForVoiceType('Tenor', 48, 72)).toBe('Freddie Mercury')
    expect(singerForVoiceType('Tenor', 48, 73)).toBe('Bruce Dickinson')
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
