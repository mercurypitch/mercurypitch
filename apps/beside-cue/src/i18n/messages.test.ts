// ============================================================
// Locale foundation — released language resolution and local-time boundaries
// ============================================================
import { describe, expect, it } from 'vitest'
import { AVAILABLE_LOCALES, formatLocalTime, message, PLANNED_LOCALES, resolveAppLocale, } from './messages'

describe('locale foundation', () => {
  it('resolves only complete released translations and falls back to English', () => {
    expect(AVAILABLE_LOCALES).toEqual(['en', 'es', 'de'])
    expect(PLANNED_LOCALES).toEqual(['en', 'es', 'hr', 'de', 'it'])
    expect(resolveAppLocale('en-US')).toBe('en')
    expect(resolveAppLocale('es-MX')).toBe('es')
    expect(resolveAppLocale('de-AT')).toBe('de')
    expect(resolveAppLocale('hr-HR')).toBe('en')
    expect(resolveAppLocale('it')).toBe('en')
    expect(resolveAppLocale('bad_locale')).toBe('en')
    expect(message('premium.show', 'en')).toBe('Show premium')
    expect(message('premium.show', 'es')).toBe('Ver opciones premium')
    expect(message('premium.show', 'de')).toBe('Premium anzeigen')
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
