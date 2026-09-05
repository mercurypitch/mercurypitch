// ============================================================
// Localized starter tests — exact built-ins translate, authored text stays intact
// ============================================================

import { describe, expect, it } from 'vitest'
import { getLocalizedActionDefinitions } from '@/content/localized-catalog'
import type { LocalActionStarter } from './action-starter'
import { resolveLocalActionStarter } from './action-starter'
import { localizeActionStarter } from './localized-action-starter'

describe('localizeActionStarter', () => {
  it.each(['en', 'es', 'de'] as const)(
    'translates every exact built-in to %s from any supported language',
    (locale) => {
      for (const sourceLocale of ['en', 'es', 'de'] as const) {
        const sourceActions = getLocalizedActionDefinitions(sourceLocale)
        expect(sourceActions).toHaveLength(19)
        for (const action of sourceActions) {
          const starter = Object.freeze(
            resolveLocalActionStarter({
              bSideSuggestionId: action.id,
              bSideText: action.label,
            }),
          )
          const translated = localizeActionStarter(starter, locale)
          const destination = getLocalizedActionDefinitions(locale).find(
            (candidate) => candidate.id === action.id,
          )!
          expect(translated.instruction).toBe(destination.label)
          expect({ ...translated, instruction: starter.instruction }).toEqual(
            starter,
          )
          expect(starter.instruction).toBe(action.label)
          if (sourceLocale === locale) expect(translated).toBe(starter)
        }
      }
    },
  )

  it('preserves a timer and its personal instruction even when the built-in id is known', () => {
    const starter: LocalActionStarter = Object.freeze({
      kind: 'quiet-timer',
      actionId: 'bside.step-outside',
      durationMs: 180_000,
      instruction: 'Salir con Ana y mirar los árboles.',
    })
    expect(localizeActionStarter(starter, 'de')).toBe(starter)
    expect(localizeActionStarter(starter, 'en')).toBe(starter)
  })

  it.each([
    { kind: 'instruction', instruction: 'My own small step.' },
    { kind: 'instruction', instruction: 'Put the phone in another room.' },
    {
      kind: 'instruction',
      actionId: 'unknown',
      instruction: 'Put the phone in another room.',
    },
    {
      kind: 'instruction',
      actionId: 'bside.phone-away',
      instruction: 'Fill a glass of water.',
    },
    {
      kind: 'instruction',
      actionId: 'bside.phone-away',
      instruction: ' Put the phone in another room. ',
    },
  ] as const)(
    'does not infer authorship from a similar label: %j',
    (starter) => {
      expect(localizeActionStarter(starter, 'es')).toBe(starter)
      expect(localizeActionStarter(starter, 'de')).toBe(starter)
    },
  )
})
