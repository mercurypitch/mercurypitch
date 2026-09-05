import { describe, expect, it } from 'vitest'
import { AVAILABLE_LOCALES, LANGUAGE_NAMES, resolveAppLocale } from './locale'

describe('app locale selection', () => {
  it('offers exactly the English, Spanish and German test languages', () => {
    expect(AVAILABLE_LOCALES).toEqual(['en', 'es', 'de'])
    expect(LANGUAGE_NAMES).toEqual({
      en: 'English',
      es: 'Español',
      de: 'Deutsch',
    })
  })

  it.each([
    ['en-US', 'en'],
    ['es-MX', 'es'],
    ['es-ES', 'es'],
    ['de-DE', 'de'],
    ['de-AT', 'de'],
    [' DE ', 'de'],
    ['hr', 'en'],
    ['it', 'en'],
    ['bad_locale', 'en'],
    ['', 'en'],
    [undefined, 'en'],
  ])(
    'resolves %s without promising unavailable languages',
    (requested, expected) => {
      expect(resolveAppLocale(requested)).toBe(expected)
    },
  )
})
