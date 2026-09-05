// ============================================================
// Localized catalog contract — translated choices keep their original meaning
// ============================================================

import { describe, expect, it } from 'vitest'
import { ACTION_DEFINITIONS, CUSTOM_PULL_ACTIONS } from './actions'
import { getLocalizedActionDefinitions, getLocalizedCustomPullActions, getLocalizedMoments, getLocalizedPullOptions, } from './localized-catalog'
import { getVoiceLines } from './localized-voice-lines'
import { MOMENTS } from './moments'
import { PREMIUM_PULL_IDS } from './premium-pulls'
import { canSelectPull, FREE_PULL_IDS, pullOptions } from './pulls'

describe('localized catalog', () => {
  it('reuses English authorities without rewriting their copy', () => {
    expect(getLocalizedPullOptions('en')).toBe(pullOptions)
    expect(getLocalizedActionDefinitions('en')).toBe(ACTION_DEFINITIONS)
    expect(getLocalizedCustomPullActions('en')).toBe(CUSTOM_PULL_ACTIONS)
    expect(getLocalizedMoments('en')).toBe(MOMENTS)
  })

  it.each(['es', 'de'] as const)(
    'preserves %s Pull identities, anchors, suggestions and access',
    (locale) => {
      const localized = getLocalizedPullOptions(locale)
      expect(localized).toHaveLength(14)
      expect(localized.map((pull) => pull.id)).toEqual(
        pullOptions.map((pull) => pull.id),
      )
      for (const [index, pull] of localized.entries()) {
        const original = pullOptions[index]!
        expect(pull.access).toBe(original.access)
        expect(pull.previewLineId).toBe(original.previewLineId)
        expect(pull.label).not.toBe(original.label)
        expect(pull.moment).not.toBe(original.moment)
        expect(pull.defaultSideAText).not.toBe(original.defaultSideAText)
        expect(pull.anchorSuggestions).toHaveLength(3)
        for (const [anchorIndex, anchor] of pull.anchorSuggestions.entries()) {
          const originalAnchor = original.anchorSuggestions[anchorIndex]!
          expect(anchor.id).toBe(originalAnchor.id)
          expect(anchor.kind).toBe(originalAnchor.kind)
          expect(anchor.text).toBeTruthy()
          expect(anchor.text).not.toBe(originalAnchor.text)
          expect(anchor.text).toBe(anchor.text.normalize('NFC'))
        }
        expect(pull.bSideSuggestions.map((action) => action.id)).toEqual(
          original.bSideSuggestions.map((action) => action.id),
        )
        for (const action of pull.bSideSuggestions) {
          expect(action).toBe(
            getLocalizedActionDefinitions(locale).find(
              (candidate) => candidate.id === action.id,
            ),
          )
        }
        expect(pull.suggestions).toEqual(
          pull.bSideSuggestions.map((action) => action.label),
        )
        expect(
          getVoiceLines(locale).some((line) => line.id === pull.previewLineId),
        ).toBe(true)
      }
      for (const id of FREE_PULL_IDS)
        expect(canSelectPull(id, false, localized)).toBe(true)
      for (const id of PREMIUM_PULL_IDS) {
        expect(canSelectPull(id, false, localized)).toBe(false)
        expect(canSelectPull(id, true, localized)).toBe(true)
      }
      expect(canSelectPull('custom', false, localized)).toBe(true)
      expect(canSelectPull('not-an-authored-pull', true, localized)).toBe(false)
    },
  )

  it.each(['es', 'de'] as const)(
    'preserves %s action timing and requirements',
    (locale) => {
      const actions = getLocalizedActionDefinitions(locale)
      expect(actions).toHaveLength(19)
      for (const [index, action] of actions.entries()) {
        const original = ACTION_DEFINITIONS[index]!
        expect({ ...action, label: original.label }).toEqual(original)
        expect(action.label).not.toBe(original.label)
        expect(action.label).toBe(action.label.normalize('NFC'))
      }
      const custom = getLocalizedCustomPullActions(locale)
      expect(custom.map((action) => action.id)).toEqual(
        CUSTOM_PULL_ACTIONS.map((action) => action.id),
      )
      for (const action of custom)
        expect(action).toBe(
          actions.find((candidate) => candidate.id === action.id),
        )
    },
  )

  it.each(['es', 'de'] as const)(
    'localizes %s moment captions without changing narrative beats',
    (locale) => {
      const moments = getLocalizedMoments(locale)
      expect(Object.keys(moments)).toEqual(Object.keys(MOMENTS))
      for (const moment of Object.values(moments)) {
        const original = MOMENTS[moment.id]
        expect({ ...moment, caption: original.caption }).toEqual(original)
        expect(moment.caption).not.toBe(original.caption)
        for (const lineId of moment.lineIds) {
          expect(getVoiceLines(locale).some((line) => line.id === lineId)).toBe(
            true,
          )
        }
      }
    },
  )

  it('does not mutate canonical source objects while producing translated choices', () => {
    getLocalizedPullOptions('de')
    getLocalizedPullOptions('es')
    expect(pullOptions[0]?.label).toBe('Endless scrolling')
    expect(pullOptions[0]?.anchorSuggestions[0]?.text).toBe(
      'When I open the feed without deciding to.',
    )
    expect(ACTION_DEFINITIONS[0]?.label).toBe('Put the phone in another room.')
    expect(MOMENTS['turn.b-side'].caption).toBe('Turn toward Side B')
  })
})
