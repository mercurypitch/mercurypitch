import { describe, expect, it } from 'vitest'
import { countGraphemes, CueTextValidationError, normalizeCueText, } from './text'

describe('normalizeCueText', () => {
  it('normalizes to NFC while collapsing and trimming whitespace', () => {
    expect(normalizeCueText('  cafe\u0301\n\tthen   walk  ')).toBe(
      'café then walk',
    )
  })

  it('counts a joined emoji family as one grapheme', () => {
    const joinedFamily =
      '\u{1F468}\u200D\u{1F469}\u200D\u{1F467}\u200D\u{1F466}'

    expect(countGraphemes(joinedFamily)).toBe(1)
    expect(normalizeCueText(joinedFamily)).toBe(joinedFamily)
  })

  it('accepts 120 graphemes and rejects 121', () => {
    expect(normalizeCueText('a'.repeat(120))).toHaveLength(120)

    expect(() => normalizeCueText('a'.repeat(121))).toThrowError(
      CueTextValidationError,
    )
  })

  it('rejects text that becomes empty after normalization', () => {
    expect(() => normalizeCueText(' \n\t ')).toThrowError(
      CueTextValidationError,
    )
    expect(() => normalizeCueText('\u200B\u2060')).toThrowError(
      CueTextValidationError,
    )
    expect(() => normalizeCueText('\u0000\u0007')).toThrowError(
      CueTextValidationError,
    )
    expect(() => normalizeCueText('\u200B \u2060\n\u0007')).toThrowError(
      CueTextValidationError,
    )
  })
})
