// ============================================================
// Localized action starter — translate built-in instructions, never personal text
// ============================================================

import { getLocalizedActionDefinitions } from '@/content/localized-catalog'
import type { ContentLocale } from '@/content/localized-voice-lines'
import type { LocalActionStarter } from './action-starter'

const CONTENT_LOCALES: readonly ContentLocale[] = ['en', 'es', 'de']

/**
 * A known id alone is not enough: older saved plans can pair it with authored
 * text. Translate only an exact built-in label for that same id in a supported
 * language. All other instructions stay byte-for-byte intact.
 */
export function localizeActionStarter(
  starter: LocalActionStarter,
  locale: ContentLocale,
): LocalActionStarter {
  if (starter.actionId === undefined) return starter
  const action = getLocalizedActionDefinitions(locale).find(
    (candidate) => candidate.id === starter.actionId,
  )
  if (action === undefined || action.label === starter.instruction)
    return starter

  const isBuiltInCopy = CONTENT_LOCALES.some((sourceLocale) =>
    getLocalizedActionDefinitions(sourceLocale).some(
      (candidate) =>
        candidate.id === starter.actionId &&
        candidate.label === starter.instruction,
    ),
  )
  return isBuiltInCopy ? { ...starter, instruction: action.label } : starter
}
