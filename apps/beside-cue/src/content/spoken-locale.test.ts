// ============================================================
// Spoken locale — v1 plays the English clip under a translated caption and interface
// ============================================================

import { describe, expect, it } from 'vitest'
import { translateUi } from '@/i18n/ui-copy'
import type { AudioSourceVariant } from './audio-manifest'
import { getLocalizedContentPack } from './localized-pack'
import { getVoiceLines } from './localized-voice-lines'
import { findLine } from './pack'
import { resolveSpokenLocale, SPOKEN_AUDIO_LOCALES } from './spoken-locale'
import type { VoiceAudioPort } from './voice'
import { createVoicePlayer } from './voice'

function recordingPort(): {
  readonly port: VoiceAudioPort
  readonly played: AudioSourceVariant[]
} {
  const played: AudioSourceVariant[] = []
  const port: VoiceAudioPort = {
    supportsMimeType: () => true,
    play(source) {
      played.push(source)
      return {
        started: Promise.resolve(),
        finished: new Promise(() => undefined),
        stop: () => undefined,
      }
    },
    dispose: () => undefined,
  }
  return { port, played }
}

describe('spoken audio locales', () => {
  it('lists English only for v1 and resolves every interface language to it', () => {
    expect(SPOKEN_AUDIO_LOCALES).toEqual(['en'])
    expect(resolveSpokenLocale('en')).toBe('en')
    expect(resolveSpokenLocale('es')).toBe('en')
    expect(resolveSpokenLocale('de')).toBe('en')
  })

  it.each(['es', 'de'] as const)(
    'plays the English clip for a %s line while the caption and interface stay translated',
    async (locale) => {
      const pack = getLocalizedContentPack(locale)
      const { port, played } = recordingPort()
      const player = createVoicePlayer({ pack, audio: port })

      const cue = player.playLine('corky.onboarding.greeting')

      await expect(cue.started).resolves.toEqual({ kind: 'started' })
      expect(played.map((source) => source.src)).toEqual([
        '/audio/voice/en/corky/en__corky__onboarding-greeting__v1_01.m4a',
      ])
      const translated = getVoiceLines(locale).find(
        (line) => line.id === 'corky.onboarding.greeting',
      )!
      const english = findLine(
        getLocalizedContentPack('en'),
        'corky.onboarding.greeting',
      )!
      expect(cue.caption).toBe(translated.text)
      expect(cue.caption).not.toBe(english.text)
      expect(translateUi('Settings', locale)).toBe(
        locale === 'es' ? 'Ajustes' : 'Einstellungen',
      )
      player.dispose()
    },
  )
})
