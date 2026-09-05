// ============================================================
// Localized cue display — translate exact built-in labels without rewriting a saved plan
// ============================================================

import type { Cue } from '@irchiinnuss/beside-cue-core'
import { getLocalizedActionDefinitions, getLocalizedPullOptions, } from './localized-catalog'
import type { ContentLocale } from './localized-voice-lines'

const SOURCE_LOCALES = ['en', 'es', 'de'] as const

/** Display-only projection. Callers must keep the original cue for all mutations. */
export function localizeCueForDisplay(cue: Cue, locale: ContentLocale): Cue {
  const targetPull = getLocalizedPullOptions(locale).find(
    (pull) => pull.id === cue.pullCategoryId,
  )
  let pullText = cue.pullText
  let cueContextText = cue.cueContextText
  let bSideText = cue.bSideText

  if (targetPull !== undefined) {
    for (const sourceLocale of SOURCE_LOCALES) {
      const sourcePull = getLocalizedPullOptions(sourceLocale).find(
        (pull) => pull.id === cue.pullCategoryId,
      )
      if (sourcePull === undefined) continue
      if (
        cue.pullText === sourcePull.defaultSideAText &&
        targetPull.defaultSideAText !== undefined
      ) {
        pullText = targetPull.defaultSideAText
      } else if (cue.pullText === sourcePull.label) {
        pullText = targetPull.label
      }
      const sourceAnchor = sourcePull.anchorSuggestions?.find(
        (anchor) => anchor.id === cue.cueContextSuggestionId,
      )
      const targetAnchor = targetPull.anchorSuggestions?.find(
        (anchor) => anchor.id === cue.cueContextSuggestionId,
      )
      if (
        sourceAnchor !== undefined &&
        targetAnchor !== undefined &&
        cue.cueContextText === sourceAnchor.text
      ) {
        cueContextText = targetAnchor.text
      }
    }
  }

  const targetAction = getLocalizedActionDefinitions(locale).find(
    (action) => action.id === cue.bSideSuggestionId,
  )
  if (
    targetAction !== undefined &&
    SOURCE_LOCALES.some((sourceLocale) =>
      getLocalizedActionDefinitions(sourceLocale).some(
        (action) =>
          action.id === cue.bSideSuggestionId && action.label === cue.bSideText,
      ),
    )
  ) {
    bSideText = targetAction.label
  }

  if (
    pullText === cue.pullText &&
    bSideText === cue.bSideText &&
    cueContextText === cue.cueContextText
  )
    return cue
  return {
    ...cue,
    pullText,
    bSideText,
    ...(cueContextText === undefined ? {} : { cueContextText }),
  }
}
