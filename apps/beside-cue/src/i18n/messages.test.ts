// ============================================================
// Locale foundation — explicit English fallback and local-time boundaries
// ============================================================
import { describe, expect, it } from 'vitest'
import { AVAILABLE_LOCALES, formatLocalTime, message, PLANNED_LOCALES, resolveAppLocale, } from './messages'

describe('locale foundation', () => {
  it('does not advertise unreviewed translations', () => {
    expect(AVAILABLE_LOCALES).toEqual(['en'])
    expect(PLANNED_LOCALES).toEqual(['en', 'es', 'hr', 'de', 'it'])
    for (const requested of [
      'en-US',
      'es',
      'hr-HR',
      'de',
      'it',
      'bad_locale',
    ]) {
      expect(resolveAppLocale(requested)).toBe('en')
      expect(message('premium.show', resolveAppLocale(requested))).toBe(
        'Show premium',
      )
    }
  })
  it('formats labels without changing HH:mm data or guessing invalid values', () => {
    expect(formatLocalTime('21:05', 'en-US')).toMatch(/9:05.*PM/u)
    expect(formatLocalTime('21:05', 'de-DE')).toBe('21:05')
    expect(formatLocalTime('21:05', 'hr-HR')).toBe('21:05')
    expect(formatLocalTime('21:05', 'bad_locale')).toMatch(/9:05.*PM/u)
    expect(formatLocalTime('25:00')).toBe('25:00')
    expect(formatLocalTime('')).toBe('')
  })
})
