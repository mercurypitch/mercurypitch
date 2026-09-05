// ============================================================
// Localized configuration tests — language changes copy, not product identity
// ============================================================

import { describe, expect, it } from 'vitest'
import { DEFAULT_BESIDE_CUE_CONFIG } from './app-config'
import { getLocalizedPullOptions } from './content/localized-catalog'
import { findLocalizedVoiceLine } from './content/localized-voice-lines'
import { getLocalizedAppConfig } from './localized-app-config'

describe('localized app config', () => {
  it('keeps the English default object and caches every locale', () => {
    expect(getLocalizedAppConfig('en')).toBe(DEFAULT_BESIDE_CUE_CONFIG)
    for (const locale of ['en', 'es', 'de'] as const) {
      expect(getLocalizedAppConfig(locale)).toBe(getLocalizedAppConfig(locale))
      expect(Object.isFrozen(getLocalizedAppConfig(locale))).toBe(true)
    }
  })

  it.each(['es', 'de'] as const)(
    'preserves %s product, reminder and notification identities',
    (locale) => {
      const localized = getLocalizedAppConfig(locale)
      const original = DEFAULT_BESIDE_CUE_CONFIG
      expect(localized.mascotSetId).toBe(original.mascotSetId)
      expect(localized.onboarding).toBe(original.onboarding)
      expect(localized.pullOptions).toBe(getLocalizedPullOptions(locale))
      expect(localized.dailyCue.channel.id).toBe(original.dailyCue.channel.id)
      expect(localized.dailyCue.presets).toHaveLength(
        original.dailyCue.presets.length,
      )
      for (const [index, preset] of localized.dailyCue.presets.entries()) {
        const originalPreset = original.dailyCue.presets[index]!
        expect(preset.id).toBe(originalPreset.id)
        expect(preset.localTime).toBe(originalPreset.localTime)
        expect(preset.label).not.toBe(originalPreset.label)
        expect(preset.note).not.toBe(originalPreset.note)
        expect(Object.isFrozen(preset)).toBe(true)
      }
      expect(localized.dailyCue.channel.name).not.toBe(
        original.dailyCue.channel.name,
      )
      expect(localized.dailyCue.channel.description).not.toBe(
        original.dailyCue.channel.description,
      )
      expect(localized.dailyCue.notification.title).not.toBe(
        original.dailyCue.notification.title,
      )
      expect(localized.dailyCue.notification.body).not.toBe(
        original.dailyCue.notification.body,
      )
      expect(Object.isFrozen(localized.dailyCue)).toBe(true)
      expect(Object.isFrozen(localized.dailyCue.notification)).toBe(true)
    },
  )

  it.each(['es', 'de'] as const)(
    'reuses exact %s canonical captions and legacy rotation lengths',
    (locale) => {
      const config = getLocalizedAppConfig(locale)
      const mappings = [
        [
          'cuePhrases',
          [
            'corky.cue-open.01',
            'corky.cue-open.02',
            'corky.cue-open.03',
            'corky.return.02',
          ],
        ],
        [
          'bSideAcknowledgements',
          ['corky.side-b.01', 'corky.side-b.02', 'corky.side-b.03'],
        ],
        ['notNowAcknowledgements', ['corky.not-now.01', 'corky.not-now.03']],
      ] as const
      for (const [key, ids] of mappings) {
        expect(config[key]).toHaveLength(DEFAULT_BESIDE_CUE_CONFIG[key].length)
        expect(config[key]).toEqual(
          ids.map((id) => findLocalizedVoiceLine(locale, id)?.text),
        )
        expect(Object.isFrozen(config[key])).toBe(true)
      }
    },
  )

  it('uses discreet, actionable reminder copy without changing the default', () => {
    expect(getLocalizedAppConfig('es').dailyCue.notification).toEqual({
      title: 'Una pequeña señal te espera',
      body: 'Abre Beside Cue cuando quieras.',
    })
    expect(getLocalizedAppConfig('de').dailyCue.notification).toEqual({
      title: 'Ein kleiner Hinweis wartet auf dich',
      body: 'Öffne Beside Cue, wenn du magst.',
    })
    expect(DEFAULT_BESIDE_CUE_CONFIG.dailyCue.presets[0]?.label).toBe('Morning')
    expect(DEFAULT_BESIDE_CUE_CONFIG.dailyCue.notification.title).toBe(
      'A small cue is ready',
    )
  })
})
