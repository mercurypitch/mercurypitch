// ============================================================
// Localized content packs — translated captions over the spoken language's audio
// ============================================================
//
// A pack shows one language and speaks one language, and they need not agree:
// v1 shows Spanish or German captions over the English recordings (see
// `spoken-locale.ts`). Captions keep their own hashes; each line also carries
// the hash of the caption its recording was made from, so the caption-bound
// lookup still finds the clip. Nonverbal media is shared by every language.

import type { AudioAssetManifest } from './audio-manifest'
import { registerCharacterVoiceRecordings } from './character-voice-recordings'
import { LOCALIZED_CHARACTER_VOICE_RECORDINGS } from './localized-character-voice-recordings'
import type { ContentLocale } from './localized-voice-lines'
import { findLocalizedVoiceLine, getVoiceLines } from './localized-voice-lines'
import type { CharacterStateId, ContentPack, Line, PullCharacter } from './pack'
import { DEFAULT_CONTENT_PACK, GENERIC_PULL_CHARACTER } from './pack'
import { resolveSpokenLocale } from './spoken-locale'

const CORKY_ALT: Readonly<
  Record<
    Exclude<ContentLocale, 'en'>,
    Readonly<Record<CharacterStateId, string>>
  >
> = {
  es: {
    rest: 'Corky, una criatura de color ciruela rosado con cabeza de corcho, erguida y mirando al frente.',
    notice:
      'Corky se inclina hacia una pequeña señal turquesa recién llegada, con los ojos abiertos.',
    turn: 'Corky se aparta de la señal y mira con calma hacia lo que eligió.',
    quiet:
      'Corky en reposo, con los párpados bajos y la mirada suave hacia abajo.',
  },
  de: {
    rest: 'Corky, ein rosa-pflaumenfarbenes Wesen mit Korkkopf, aufrecht und mit Blick nach vorn.',
    notice:
      'Corky beugt sich mit großen Augen zu einem kleinen türkisfarbenen Hinweis, der gerade angekommen ist.',
    turn: 'Corky wendet sich ruhig vom Hinweis ab und schaut zu etwas, das er gewählt hat.',
    quiet: 'Corky ruht mit gesenkten Lidern und sanftem Blick nach unten.',
  },
}

const PULL_ALT: Readonly<
  Record<Exclude<ContentLocale, 'en'>, Readonly<Record<string, string>>>
> = {
  es: {
    scrolling:
      'The Scroll, un pergamino enrollado de color azul claro, con ojos somnolientos de color crema y pequeños pies curvados.',
    snacking:
      'Sugarlump, una criatura granulada de color crema formada por tres bloques de azúcar redondeados, con pequeños brazos y pies.',
    'familiar-ritual':
      'The Usual, una criatura redonda de madera con pequeños ojos de punto, brazos cortos y pies anchos de madera.',
    'two-minute-pause':
      'Ember, una criatura redondeada de carbón con ojos entrecerrados y una cálida línea naranja que brilla en el centro.',
    'one-tap-convenience':
      'Dinger, una campanilla de servicio de color verde oliva, con botón de latón, borde de color crema y cuatro pies pequeños.',
    avoidance:
      'The Fog, una nube baja de color gris lavanda, con ojos oscuros entrecerrados y una pequeña sonrisa.',
  },
  de: {
    scrolling:
      'The Scroll, eine hellblaue Schriftrolle mit schläfrigen cremefarbenen Augen und kleinen eingerollten Füßen.',
    snacking:
      'Sugarlump, ein körniges cremefarbenes Wesen aus drei abgerundeten Zuckerstücken mit kleinen Armen und Füßen.',
    'familiar-ritual':
      'The Usual, ein rundes Holzwesen mit winzigen Punktaugen, kleinen Armen und breiten Holzfüßen.',
    'two-minute-pause':
      'Ember, ein rundliches Kohlewesen mit halb geschlossenen Augen und einer warm orange leuchtenden Naht in der Mitte.',
    'one-tap-convenience':
      'Dinger, eine olivgrüne Tischglocke mit Messingknopf, cremefarbenem Rand und vier kleinen Füßen.',
    avoidance:
      'The Fog, ein flaches lavendelgraues Wolkenwesen mit dunklen, halb geschlossenen Augen und einem kleinen Lächeln.',
  },
}

/**
 * The audio of the spoken language: the English manifest verbatim, or the
 * shared nonverbal media with that language's screened recordings, each bound
 * to that language's own caption.
 */
function spokenAudioManifest(spokenLocale: ContentLocale): AudioAssetManifest {
  if (spokenLocale === 'en') return DEFAULT_CONTENT_PACK.audio
  const dialogue = registerCharacterVoiceRecordings(
    LOCALIZED_CHARACTER_VOICE_RECORDINGS[spokenLocale],
    { locale: spokenLocale, lines: getVoiceLines(spokenLocale) },
  )
  return Object.freeze({
    ...DEFAULT_CONTENT_PACK.audio,
    locale: spokenLocale,
    revision: `beside-cue-selected-voices-${spokenLocale}-v1`,
    assets: Object.freeze([
      ...dialogue,
      ...DEFAULT_CONTENT_PACK.audio.assets.filter(
        (asset) => asset.lane !== 'dialogue',
      ),
    ]),
  })
}

/**
 * Captions in the shown language. When another language is spoken, each line
 * also names the caption its recording was made from, so the voice player
 * finds the clip while the screen shows the translation.
 */
function captionedLines(
  locale: ContentLocale,
  spokenLocale: ContentLocale,
): readonly Line[] {
  const lines = getVoiceLines(locale)
  if (spokenLocale === locale) return lines
  return lines.map((line) => {
    const spoken = findLocalizedVoiceLine(spokenLocale, line.id)
    return spoken === undefined
      ? line
      : { ...line, spokenCaptionSha256: spoken.captionSha256 }
  })
}

export interface LocalizeContentPackOptions {
  /**
   * The language whose recordings play. Defaults to the v1 decision in
   * `spoken-locale.ts`; a test passes the shown language to exercise the
   * localized recordings the app is not playing yet.
   */
  readonly spokenLocale?: ContentLocale
}

export function localizeContentPack(
  locale: Exclude<ContentLocale, 'en'>,
  options: LocalizeContentPackOptions = {},
): ContentPack {
  const spokenLocale = options.spokenLocale ?? resolveSpokenLocale(locale)
  const pullCharacters = DEFAULT_CONTENT_PACK.pullCharacters.map(
    (character) => ({
      ...character,
      token: {
        ...character.token,
        alt: PULL_ALT[locale][character.id] ?? character.name,
      },
    }),
  )
  return Object.freeze({
    ...DEFAULT_CONTENT_PACK,
    id: `${DEFAULT_CONTENT_PACK.id}-${locale}`,
    lines: captionedLines(locale, spokenLocale),
    characters: DEFAULT_CONTENT_PACK.characters.map((character) => ({
      ...character,
      states: {
        rest: {
          ...character.states.rest,
          alt: CORKY_ALT[locale].rest,
        },
        notice: {
          ...character.states.notice,
          alt: CORKY_ALT[locale].notice,
        },
        turn: {
          ...character.states.turn,
          alt: CORKY_ALT[locale].turn,
        },
        quiet: {
          ...character.states.quiet,
          alt: CORKY_ALT[locale].quiet,
        },
      },
    })),
    pullCharacters,
    cueEntities: pullCharacters,
    audio: spokenAudioManifest(spokenLocale),
  })
}

const PACKS: Readonly<Record<ContentLocale, ContentPack>> = {
  en: DEFAULT_CONTENT_PACK,
  es: localizeContentPack('es'),
  de: localizeContentPack('de'),
}

const GENERIC_CHARACTERS: Readonly<Record<ContentLocale, PullCharacter>> = {
  en: GENERIC_PULL_CHARACTER,
  es: {
    ...GENERIC_PULL_CHARACTER,
    name: 'Tu impulso',
    token: {
      ...GENERIC_PULL_CHARACTER.token,
      alt: 'Una pequeña forma turquesa que representa un impulso personalizado.',
    },
  },
  de: {
    ...GENERIC_PULL_CHARACTER,
    name: 'Dein Impuls',
    token: {
      ...GENERIC_PULL_CHARACTER.token,
      alt: 'Eine kleine türkisfarbene Form für einen selbst benannten Impuls.',
    },
  },
}

/** Custom Pull art is a fallback, not an extra selectable member of the cast. */
export function getLocalizedGenericPullCharacter(
  locale: ContentLocale,
): PullCharacter {
  return GENERIC_CHARACTERS[locale]
}

export function getLocalizedContentPack(locale: ContentLocale): ContentPack {
  return PACKS[locale]
}
