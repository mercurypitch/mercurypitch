// ============================================================
// Spoken audio locales — which languages the app plays recordings in
// ============================================================
//
// Decision (maff, 2026-09-11): v1 ships all audio in English. The Spanish and
// German recordings stay in the bundle and in
// `LOCALIZED_CHARACTER_VOICE_RECORDINGS`, still bound to their own captions,
// until their translations have been checked. The interface, the captions and
// every other on-screen text keep following the chosen language. Switching a
// language's recordings back on is one edit: add it to SPOKEN_AUDIO_LOCALES.

import type { ContentLocale } from './localized-voice-lines'

export const SPOKEN_AUDIO_LOCALES = [
  'en',
] as const satisfies readonly ContentLocale[]

/** The language whose recordings play for an interface language. */
export function resolveSpokenLocale(locale: ContentLocale): ContentLocale {
  return (SPOKEN_AUDIO_LOCALES as readonly ContentLocale[]).includes(locale)
    ? locale
    : 'en'
}
