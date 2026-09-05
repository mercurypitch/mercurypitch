// Persist stable language codes, never translated labels or device regions.
// ============================================================
// App locale — supported language identities and stable fallbacks
// ============================================================

export const PLANNED_LOCALES = ['en', 'es', 'hr', 'de', 'it'] as const
export const AVAILABLE_LOCALES = ['en', 'es', 'de'] as const
export type AppLocale = (typeof AVAILABLE_LOCALES)[number]

export const LANGUAGE_NAMES: Readonly<Record<AppLocale, string>> = {
  en: 'English',
  es: 'Español',
  de: 'Deutsch',
}

export function resolveAppLocale(requested?: string): AppLocale {
  const language = requested?.trim().toLowerCase().split('-')[0]
  return AVAILABLE_LOCALES.find((locale) => locale === language) ?? 'en'
}
