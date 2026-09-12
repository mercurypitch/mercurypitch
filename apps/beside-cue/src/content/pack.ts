// ============================================================
// Content pack — the cast, their art slots, and everything spoken
// ============================================================
//
// One place that a designer, a voice actor and a translator can all be pointed
// at. Art arrives as slots (see `assets.ts`) and spoken copy arrives as exact,
// durable captions. Optional recordings live in the pack audio manifest and
// bind to a line through its caption hash.
//
// Pull-character names and roles are stable product language. The cue is the
// context that brings a Pull into focus; the character personifies that Pull
// and must never be described as the cue itself.

import type { AssetSlot } from './assets'
import type { AudioAssetManifest, DialogueAudioLookup } from './audio-manifest'
import { validateAudioAssetManifest, validateAudioDialogueLineBindings, } from './audio-manifest'
import { PREMIUM_PULL_DEFINITIONS } from './premium-pulls'
import { canonicalPullId, pullOptions } from './pulls'
import { V2_ONBOARDING_AUDIO_ASSET_MANIFEST } from './v2-onboarding-audio-manifest'
import type { VoiceLineKind, VoiceSpeakerId } from './voice-lines'
import { CANONICAL_VOICE_LINES } from './voice-lines'

export type CharacterStateId = 'rest' | 'notice' | 'turn' | 'quiet'

export const CHARACTER_STATES: readonly CharacterStateId[] = [
  'rest',
  'notice',
  'turn',
  'quiet',
]

export interface Line {
  readonly id: string
  readonly text: string
  /**
   * Precomputed from exact NFC UTF-8 text. Optional for injected legacy packs;
   * required before a manifest recording can bind to this caption.
   */
  readonly captionSha256?: string
  /**
   * Hash of the caption the bound recording was made from, when the pack
   * speaks another language than it shows (v1 plays English under translated
   * captions; see `spoken-locale.ts`). Absent when the two agree.
   */
  readonly spokenCaptionSha256?: string
  readonly speakerId?: VoiceSpeakerId
  readonly fileStem?: string
  readonly kind?: VoiceLineKind
}

export interface Character {
  readonly id: string
  readonly name: string
  readonly states: Readonly<Record<CharacterStateId, AssetSlot>>
}

export interface PullCharacter {
  /** Matches a `PullOption` id, so a pull can find its own creature. */
  readonly id: string
  readonly name: string
  /**
   * The approved render of the creature: a transparent cutout, drawn in the
   * Pull picker and beside Corky at the cue moment. One file per Pull, so no
   * screen can show a rendition the picker did not. The free cast keeps the
   * render's transparent margin; the premium cast is cropped to the
   * silhouette, which the cue-moment stage insets for.
   */
  readonly token: AssetSlot
  /** Direction for the voice actor. Never shown in the interface. */
  readonly voiceNote: string
}

export interface ContentPack {
  readonly id: string
  readonly version: string
  readonly leadCharacterId: string
  readonly characters: readonly Character[]
  readonly pullCharacters: readonly PullCharacter[]
  /** @deprecated Use `pullCharacters`; retained for V1 content callers. */
  readonly cueEntities: readonly PullCharacter[]
  readonly lines: readonly Line[]
  /** Optional media delivery; the empty manifest is a complete silent state. */
  readonly audio: AudioAssetManifest
}

const ART = `${import.meta.env.BASE_URL}art`

// The approved Corky: the Higgsfield reference look, the same character the
// onboarding shows. Source: the transparent 1024 px stills
// `packages/showcase-gallery/gallery-viewer/cues/corky/transparent/
// corky-dark-still-{rest,notice,quiet}.png` in the disjoint-colliders repo
// (committed there 2026-09-11), converted to lossless webp with the alpha
// kept, so every visible pixel is the source's. The Blender and Meshy renders
// of Corky are banned everywhere; nothing in this file may point at one.
//
// The `alt` strings double as interface-copy keys, so a screen localizes one
// with `copy.t(CORKY_REST_ART.alt)`.
export const CORKY_REST_ART = {
  still: `${ART}/corky/corky-rest-approved-1024.webp`,
  alt: 'Corky, a rose-plum cork character with eight tubular limbs, upright and looking straight ahead.',
} as const satisfies AssetSlot

export const CORKY_NOTICE_ART = {
  still: `${ART}/corky/corky-notice-approved-1024.webp`,
  alt: 'Corky, a rose-plum cork character with eight tubular limbs, looking up toward the Pull that has just arrived.',
} as const satisfies AssetSlot

export const CORKY_QUIET_ART = {
  still: `${ART}/corky/corky-quiet-approved-1024.webp`,
  alt: 'Corky, a rose-plum cork character with eight tubular limbs, settled with lowered lids.',
} as const satisfies AssetSlot

// Corky on Home: the rest still, in a slot of its own so the living-rest
// loop (L01) can land here without touching the cue or quiet screens. When
// the clip is accepted, add `video` to this slot, framed on the still's 1024
// canvas; the still stays its poster and the reduced-motion fallback, and
// nothing on Home changes (see `HomeCompanion.tsx`).
export const CORKY_HOME_ART = {
  still: CORKY_REST_ART.still,
  alt: CORKY_REST_ART.alt,
} as const satisfies AssetSlot

// The six free Pulls are the approved cast renders, byte for byte the art the
// landing shows (`packages/beside-cue/src/assets/cast/*.png` in the
// disjoint-colliders repo is a tight crop of these files). Sugarlump is the
// white, blocky one; the earlier Sugarlump rendition is not approved and must
// not come back through any path.
function pullToken(filename: string, alt: string): AssetSlot {
  return {
    still: `${ART}/pulls/${filename}`,
    alt,
  }
}

function pullCharacter(
  id: string,
  name: string,
  token: AssetSlot,
  voiceNote: string,
): PullCharacter {
  return {
    id,
    name,
    token,
    voiceNote,
  }
}

const corky: Character = {
  id: 'corky',
  name: 'Corky',
  states: {
    rest: CORKY_REST_ART,
    notice: CORKY_NOTICE_ART,
    // No approved still shows the turn itself yet. The rest still stands in;
    // it is also what the Side B quiet screen shows once the turn is made.
    turn: {
      still: CORKY_REST_ART.still,
      alt: 'Corky turned away from the cue, calm, looking toward something he chose.',
    },
    quiet: CORKY_QUIET_ART,
  },
}

// The cast personifies Pulls. Voice notes describe temperament, never a
// diagnosis or a specific substance or behaviour.
export const PULL_CHARACTERS: readonly PullCharacter[] = [
  ...PREMIUM_PULL_DEFINITIONS.map((definition) => ({
    id: definition.id,
    name: definition.name,
    // The premium shelf and the cue moment share this one cutout. It is the
    // character's approved Nano Banana three-quarter still, the same source
    // the free cast's files come from: <user-dotfiles>/besidecue/assets/
    // nano_banana_gemini_outputs/new_characters/<id>/transparent/
    // <id>-still-threequarter.png, cropped to the pixels with alpha above 8
    // (nothing visible lies outside), fitted to 512 px, saved lossless with
    // alpha. It replaced the chroma-keyed Flow-frame tokens under
    // public/onboarding/pull-expansion-v1/, which carried magenta spill and
    // a soft edge that showed once they stood beside Corky.
    token: pullToken(
      `pull-${definition.id}-nanobanana-v0_1-512.webp`,
      definition.name,
    ),
    voiceNote:
      'Use this character’s selected voice and preserve the canonical captions.',
  })),
  pullCharacter(
    'scrolling',
    'The Scroll',
    pullToken(
      'pull-the-scroll-nanobanana-v0_1-512.webp',
      'The Scroll, a pale blue rolled-scroll character with sleepy cream eyes and small curled feet.',
    ),
    'Endless, pleasant, never finishes a sentence.',
  ),
  pullCharacter(
    'snacking',
    'Sugarlump',
    pullToken(
      'pull-sugarlump-nanobanana-v0_1-512.webp',
      'Sugarlump, a grainy cream character made of three rounded sugar-block shapes with small arms and feet.',
    ),
    'Sweet and insistent. Offers, never argues.',
  ),
  pullCharacter(
    'familiar-ritual',
    'The Usual',
    pullToken(
      'pull-the-usual-nanobanana-v0_1-512.webp',
      'The Usual, a round wooden character with tiny dot eyes, small arms and broad wooden feet.',
    ),
    'Familiar and hospitable. Knows the routine before you choose it.',
  ),
  pullCharacter(
    'two-minute-pause',
    'Ember',
    pullToken(
      'pull-ember-nanobanana-v0_1-512.webp',
      'Ember, a rounded charcoal character with half-closed eyes and a warm orange seam glowing through the middle.',
    ),
    'Warm, close and patient. Always suggests one more small pause.',
  ),
  pullCharacter(
    'one-tap-convenience',
    'Dinger',
    pullToken(
      'pull-dinger-nanobanana-v0_1-512.webp',
      'Dinger, an olive-green service-bell character with a brass button, cream rim and four small feet.',
    ),
    'Bright and quick. Makes the easiest answer feel already chosen.',
  ),
  pullCharacter(
    'avoidance',
    'The Fog',
    pullToken(
      'pull-the-fog-nanobanana-v0_1-512.webp',
      'The Fog, a low lavender-grey cloud character with dark half-closed eyes and a small smile.',
    ),
    'Soft, unhurried, faintly reasonable. Never states a plan.',
  ),
]

/**
 * The picker's art for a custom Pull, which has no authored character. The
 * generic turquoise shape keeps that list complete without pretending the
 * custom words belong to one of the built-in cast. The cue moment does not
 * use it: there a custom Pull shows no creature at all, and the stage draws
 * its own neutral record-label mark where the creature would stand.
 */
export const GENERIC_PULL_CHARACTER: PullCharacter = pullCharacter(
  'generic',
  'Your Pull',
  {
    still: `${ART}/cues/cue-generic-256.webp`,
    alt: 'A small turquoise shape representing a custom Pull.',
  },
  'Quiet and neutral. Used only when a custom Pull has no cast character.',
)

/** @deprecated Use `PullCharacter`. */
export type CueEntity = PullCharacter

/** @deprecated Use `GENERIC_PULL_CHARACTER`. */
export const GENERIC_CUE_ENTITY = GENERIC_PULL_CHARACTER

export const DEFAULT_CONTENT_PACK: ContentPack = {
  id: 'beside-cue-default',
  version: '0.7.0',
  leadCharacterId: corky.id,
  characters: [corky],
  pullCharacters: PULL_CHARACTERS,
  cueEntities: PULL_CHARACTERS,
  lines: CANONICAL_VOICE_LINES,
  audio: V2_ONBOARDING_AUDIO_ASSET_MANIFEST,
}

export function findCharacter(
  pack: ContentPack,
  id: string,
): Character | undefined {
  return pack.characters.find((character) => character.id === id)
}

export function findPullCharacter(
  pack: ContentPack,
  pullId: string | undefined,
): PullCharacter | undefined {
  if (pullId === undefined) {
    return undefined
  }
  const canonicalId = canonicalPullId(pullId)
  return pack.pullCharacters.find((character) => character.id === canonicalId)
}

/** @deprecated Use `findPullCharacter`. */
export function findCueEntity(
  pack: ContentPack,
  pullId: string | undefined,
): PullCharacter | undefined {
  return findPullCharacter(pack, pullId)
}

export function findLine(pack: ContentPack, id: string): Line | undefined {
  return pack.lines.find((line) => line.id === id)
}

/**
 * The binding a recording has to match for this line: the caption it was
 * recorded from, which is the displayed caption unless the pack speaks another
 * language than it shows. Undefined for a legacy line with no hash.
 */
export function dialogueLookupFor(line: Line): DialogueAudioLookup | undefined {
  const captionSha256 = line.spokenCaptionSha256 ?? line.captionSha256
  return captionSha256 === undefined
    ? undefined
    : { lineId: line.id, captionSha256 }
}

/**
 * Reports everything wrong with a pack instead of throwing on the first fault,
 * so one test run tells a content author the whole story.
 *
 * A Pull with no authored character is allowed on purpose: someone can name
 * their own moment, and a custom Pull will use the generic fallback at runtime.
 */
export function validateContentPack(pack: ContentPack): readonly string[] {
  const problems: string[] = []

  problems.push(...validateAudioAssetManifest(pack.audio))

  if (findCharacter(pack, pack.leadCharacterId) === undefined) {
    problems.push(
      `Lead character "${pack.leadCharacterId}" is not in the pack.`,
    )
  }

  for (const character of pack.characters) {
    for (const state of CHARACTER_STATES) {
      const slot = character.states[state]
      if (slot === undefined) {
        problems.push(`${character.id} has no "${state}" state.`)
        continue
      }
      if (slot.still.trim() === '') {
        problems.push(`${character.id}.${state} has no still.`)
      }
      if (slot.alt.trim() === '') {
        problems.push(`${character.id}.${state} has no alt text.`)
      }
    }
  }

  const pullIds = new Set(pullOptions.map((option) => option.id))
  const seen = new Set<string>()
  for (const character of pack.pullCharacters) {
    if (!pullIds.has(character.id)) {
      problems.push(`Pull character "${character.id}" matches no pull option.`)
    }
    if (seen.has(character.id)) {
      problems.push(`Pull character "${character.id}" is declared twice.`)
    }
    seen.add(character.id)
    if (character.token.alt.trim() === '') {
      problems.push(`Pull character "${character.id}" has no alt text.`)
    }
  }

  const lineIds = new Set<string>()
  for (const line of pack.lines) {
    if (lineIds.has(line.id)) {
      problems.push(`Line "${line.id}" is declared twice.`)
    }
    lineIds.add(line.id)
    if (line.text.trim() === '') {
      problems.push(`Line "${line.id}" has no text.`)
    }
  }

  for (const pull of pullOptions) {
    if (!lineIds.has(pull.previewLineId)) {
      problems.push(
        `Pull "${pull.id}" references missing preview line "${pull.previewLineId}".`,
      )
    }
  }

  problems.push(
    ...validateAudioDialogueLineBindings(
      pack.audio,
      pack.lines.flatMap((line) => {
        const lookup = dialogueLookupFor(line)
        return lookup === undefined ? [] : [lookup]
      }),
    ),
  )

  return problems
}
