// ============================================================
// Localized cue display tests — exact built-ins change; personal words do not
// ============================================================

import type { Cue } from '@irchiinnuss/beside-cue-core'
import { describe, expect, it } from 'vitest'
import { getLocalizedActionDefinitions, getLocalizedPullOptions, } from './localized-catalog'
import { localizeCueForDisplay } from './localized-cue'

const pull = getLocalizedPullOptions('en').find(
  (option) => option.id === 'scrolling',
)!
const action = getLocalizedActionDefinitions('en').find(
  (option) => option.id === 'bside.phone-away',
)!
const anchor = pull.anchorSuggestions![0]!
const cue: Cue = {
  id: 'saved',
  status: 'active',
  pullCategoryId: pull.id,
  pullText: pull.defaultSideAText!,
  bSideSuggestionId: action.id,
  bSideText: action.label,
  cueContextSuggestionId: anchor.id,
  cueContextText: anchor.text,
  mascotSetId: 'corktop-v1',
  createdAt: '2026-09-05T10:00:00.000Z',
  updatedAt: '2026-09-05T10:00:00.000Z',
}

describe('saved cue localization', () => {
  it.each(['es', 'de'] as const)(
    'projects %s built-ins without changing storage or identities',
    (locale) => {
      const original = structuredClone(cue)
      const displayed = localizeCueForDisplay(cue, locale)
      const target = getLocalizedPullOptions(locale).find(
        (option) => option.id === pull.id,
      )!
      expect(displayed.pullText).toBe(target.defaultSideAText)
      expect(displayed.bSideText).toBe(
        getLocalizedActionDefinitions(locale).find(
          (option) => option.id === action.id,
        )!.label,
      )
      expect(displayed.cueContextText).toBe(
        target.anchorSuggestions!.find((item) => item.id === anchor.id)!.text,
      )
      expect(cue).toEqual(original)
      expect({
        ...displayed,
        pullText: cue.pullText,
        bSideText: cue.bSideText,
        cueContextText: cue.cueContextText,
      }).toEqual(cue)
      expect(localizeCueForDisplay(displayed, 'en')).toEqual(cue)
    },
  )

  it('leaves personal text intact even when it is paired with known suggestion ids', () => {
    const personal = {
      ...cue,
      pullText: 'My evening loop',
      bSideText: 'Read my own notebook',
      cueContextText: 'When I see my cat',
    }
    expect(localizeCueForDisplay(personal, 'de')).toBe(personal)
  })

  it('does not infer identities or translate custom words that happen to match another built-in', () => {
    const personal = {
      ...cue,
      pullCategoryId: 'custom',
      bSideSuggestionId: undefined,
      cueContextSuggestionId: undefined,
    }
    expect(localizeCueForDisplay(personal, 'es')).toBe(personal)
  })
})
