// ============================================================
// Localized content packs — language-bound speech with shared nonverbal assets
// ============================================================

import { registerCharacterVoiceRecordings } from './character-voice-recordings'
import { LOCALIZED_CHARACTER_VOICE_RECORDINGS } from './localized-character-voice-recordings'
import type { ContentLocale } from './localized-voice-lines'
import { getVoiceLines } from './localized-voice-lines'
import type { CharacterStateId, ContentPack, PullCharacter } from './pack'
import { DEFAULT_CONTENT_PACK, GENERIC_PULL_CHARACTER } from './pack'

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

function localizePack(locale: Exclude<ContentLocale, 'en'>): ContentPack {
  const lines = getVoiceLines(locale)
  const dialogue = registerCharacterVoiceRecordings(
    LOCALIZED_CHARACTER_VOICE_RECORDINGS[locale],
    { locale, lines },
  )
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
    lines,
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
    audio: Object.freeze({
      ...DEFAULT_CONTENT_PACK.audio,
      locale,
      revision: `beside-cue-selected-voices-${locale}-v1`,
      assets: Object.freeze([
        ...dialogue,
        ...DEFAULT_CONTENT_PACK.audio.assets.filter(
          (asset) => asset.lane !== 'dialogue',
        ),
      ]),
    }),
  })
}

const PACKS: Readonly<Record<ContentLocale, ContentPack>> = {
  en: DEFAULT_CONTENT_PACK,
  es: localizePack('es'),
  de: localizePack('de'),
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
