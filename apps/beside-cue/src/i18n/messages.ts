// ============================================================
// UI copy seam — ship complete English; never advertise partial translations
// ============================================================

export const PLANNED_LOCALES = ['en', 'es', 'hr', 'de', 'it'] as const
export const AVAILABLE_LOCALES = ['en'] as const
export type AppLocale = (typeof AVAILABLE_LOCALES)[number]

const english = {
  'home.title': 'Your current pressing',
  'premium.show': 'Show premium',
  'premium.hide': 'Hide premium',
  'premium.available': 'Your Pro cast. Choose the Pull you want to notice.',
  'premium.locked':
    'Meet the extra cast. Pro unlocks selection in Settings; the six originals and your own Pull stay free.',
  'premium.choices': 'Premium Pull choices',
  'premium.revoked':
    'Pro is no longer active. Choose one of the six free Pulls, or name your own.',
  'audio.mute': 'Mute audio',
  'audio.unmute': 'Unmute audio',
} as const

export type MessageKey = keyof typeof english

/** Until a complete reviewed catalog ships, unsupported device locales use English. */
export function resolveAppLocale(_requested?: string): AppLocale {
  return 'en'
}

export function message(key: MessageKey, _locale: AppLocale = 'en'): string {
  return english[key]
}

/** Domain/storage still uses strict local HH:mm; only its visible label is localized. */
export function formatLocalTime(
  localTime: string,
  locale: string = 'en',
): string {
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/u.test(localTime)) return localTime
  const [hour, minute] = localTime.split(':').map(Number)
  const date = new Date(2000, 0, 1, hour, minute)
  try {
    return new Intl.DateTimeFormat(locale, {
      hour: 'numeric',
      minute: '2-digit',
    }).format(date)
  } catch {
    return new Intl.DateTimeFormat('en', {
      hour: 'numeric',
      minute: '2-digit',
    }).format(date)
  }
}
