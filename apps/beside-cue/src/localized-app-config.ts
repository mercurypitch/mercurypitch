// ============================================================
// Localized app config — translated defaults without changing scheduling identity
// ============================================================

import type { BesideCueAppConfig } from './app-config'
import { DEFAULT_BESIDE_CUE_CONFIG } from './app-config'
import { getLocalizedPullOptions } from './content/localized-catalog'
import type { ContentLocale } from './content/localized-voice-lines'
import { findLocalizedVoiceLine } from './content/localized-voice-lines'
import type { CanonicalVoiceLineId } from './content/voice-lines'

// Preserve the legacy rotation lengths while reusing frozen character captions,
// not a second translation authority. The fourth cue is Corky's patient return.
const PHRASE_LINE_IDS = {
  cuePhrases: [
    'corky.cue-open.01',
    'corky.cue-open.02',
    'corky.cue-open.03',
    'corky.return.02',
  ],
  bSideAcknowledgements: [
    'corky.side-b.01',
    'corky.side-b.02',
    'corky.side-b.03',
  ],
  notNowAcknowledgements: ['corky.not-now.01', 'corky.not-now.03'],
} as const satisfies Readonly<Record<string, readonly CanonicalVoiceLineId[]>>

const DAILY_CUE_COPY = {
  es: {
    presets: [
      { label: 'Mañana', note: 'Un pequeño comienzo' },
      { label: 'Mediodía', note: 'Un momento para volver a empezar' },
      { label: 'Tarde', note: 'Antes de que se vaya el día' },
    ],
    channel: {
      name: 'Señales suaves',
      description: 'Recordatorios discretos para la señal que elegiste.',
    },
    notification: {
      title: 'Una pequeña señal te espera',
      body: 'Abre Beside Cue cuando quieras.',
    },
  },
  de: {
    presets: [
      { label: 'Morgens', note: 'Ein kleiner Anfang' },
      { label: 'Mittags', note: 'Ein ruhiger Neubeginn' },
      { label: 'Abends', note: 'Bevor der Tag vorbeizieht' },
    ],
    channel: {
      name: 'Sanfte Hinweise',
      description: 'Unaufdringliche Erinnerungen an deinen gewählten Hinweis.',
    },
    notification: {
      title: 'Ein kleiner Hinweis wartet auf dich',
      body: 'Öffne Beside Cue, wenn du magst.',
    },
  },
} as const

function phrases(
  locale: ContentLocale,
  ids: readonly CanonicalVoiceLineId[],
): readonly string[] {
  return Object.freeze(
    ids.map((id) => {
      const line = findLocalizedVoiceLine(locale, id)
      if (line === undefined) throw new Error(`Missing localized phrase: ${id}`)
      return line.text
    }),
  )
}

function localizeConfig(
  locale: Exclude<ContentLocale, 'en'>,
): BesideCueAppConfig {
  const original = DEFAULT_BESIDE_CUE_CONFIG
  const dailyCopy = DAILY_CUE_COPY[locale]
  return Object.freeze({
    ...original,
    pullOptions: getLocalizedPullOptions(locale),
    cuePhrases: phrases(locale, PHRASE_LINE_IDS.cuePhrases),
    bSideAcknowledgements: phrases(
      locale,
      PHRASE_LINE_IDS.bSideAcknowledgements,
    ),
    notNowAcknowledgements: phrases(
      locale,
      PHRASE_LINE_IDS.notNowAcknowledgements,
    ),
    dailyCue: Object.freeze({
      ...original.dailyCue,
      presets: Object.freeze(
        original.dailyCue.presets.map((preset, index) => {
          const copy = dailyCopy.presets[index]
          if (copy === undefined)
            throw new Error(`Missing localized reminder preset: ${preset.id}`)
          return Object.freeze({ ...preset, ...copy })
        }),
      ),
      channel: Object.freeze({
        ...original.dailyCue.channel,
        ...dailyCopy.channel,
      }),
      notification: Object.freeze({ ...dailyCopy.notification }),
    }),
  })
}

const CONFIGS: Readonly<Record<ContentLocale, BesideCueAppConfig>> = {
  en: DEFAULT_BESIDE_CUE_CONFIG,
  es: localizeConfig('es'),
  de: localizeConfig('de'),
}

export function getLocalizedAppConfig(
  locale: ContentLocale,
): BesideCueAppConfig {
  return CONFIGS[locale]
}
