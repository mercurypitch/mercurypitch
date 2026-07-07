import { describe, expect, it } from 'vitest'
import { voiceTypeHint } from './metrics'
import { singerForVoiceType } from './singer-match'

describe('singerForVoiceType', () => {
  it('maps every voice type to a legend', () => {
    expect(singerForVoiceType('Bass')).toBe('Johnny Cash')
    expect(singerForVoiceType('Baritone')).toBe('Freddie Mercury')
    expect(singerForVoiceType('Tenor')).toBe('Bruce Dickinson')
    expect(singerForVoiceType('Alto')).toBe('Adele')
    expect(singerForVoiceType('Mezzo-soprano')).toBe('Whitney Houston')
    expect(singerForVoiceType('Soprano')).toBe('Mariah Carey')
  })

  it('returns null for unknown or missing voice types', () => {
    expect(singerForVoiceType(null)).toBeNull()
    expect(singerForVoiceType('Countertenor')).toBeNull()
    expect(singerForVoiceType('')).toBeNull()
  })

  it('pairs a real detected range with a legend end-to-end', () => {
    // G2–G4 classifies as Baritone (see metrics.test.ts) → Freddie Mercury.
    expect(singerForVoiceType(voiceTypeHint(43, 67))).toBe('Freddie Mercury')
    // C4–C6 → Soprano → Mariah Carey.
    expect(singerForVoiceType(voiceTypeHint(60, 84))).toBe('Mariah Carey')
  })
})
