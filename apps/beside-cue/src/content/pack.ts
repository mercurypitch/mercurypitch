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
import type { AudioAssetManifest } from './audio-manifest'
import { validateAudioAssetManifest, validateAudioDialogueLineBindings, } from './audio-manifest'
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
  /** Tight cutout, for a list row or a card. */
  readonly token: AssetSlot
  /**
   * Full-frame, rendered through the same camera and cropped with the same box
   * as the character states, so it composites over one with no positioning
   * code. That is how a single `notice` render personalises to every pull: the
   * character looks at a fixed point, and the Pull character lands there.
   */
  readonly noticeOverlay: AssetSlot
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

export const CORKY_V023_REST_ART: AssetSlot = {
  still: `${ART}/corky/corky-home-rest-v0_23-1024.webp`,
  alt: 'Corky, a rose-plum cork character with eight tubular limbs, settled beside the current plan.',
}

function corkyState(state: CharacterStateId, alt: string): AssetSlot {
  return { still: `${ART}/corky/corky-${state}-1024.webp`, alt }
}

function pullToken(filename: string, alt: string): AssetSlot {
  return {
    still: `${ART}/pulls/${filename}`,
    alt,
  }
}

function cueOverlay(id: string): AssetSlot {
  return {
    still: `${ART}/notice-cues/notice-cue-${id}-1024.webp`,
    // The character underneath already describes the scene; a second
    // description of the same moment would only repeat itself aloud.
    alt: '',
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
    noticeOverlay: cueOverlay(id),
    voiceNote,
  }
}

const corky: Character = {
  id: 'corky',
  name: 'Corky',
  states: {
    rest: corkyState(
      'rest',
      'Corky, a rose-plum cork-topped character, upright and looking straight ahead.',
    ),
    notice: corkyState(
      'notice',
      'Corky leaning toward a small turquoise cue that has just arrived, eyes wide.',
    ),
    turn: corkyState(
      'turn',
      'Corky turned away from the cue, calm, looking toward something he chose.',
    ),
    quiet: corkyState(
      'quiet',
      'Corky settled with lowered lids, eyes softly down.',
    ),
  },
}

// The cast personifies Pulls. Voice notes describe temperament, never a
// diagnosis or a specific substance or behaviour.
export const PULL_CHARACTERS: readonly PullCharacter[] = [
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
 * Shown when a beat needs a Pull character but a custom Pull has none of its
 * own. The generic turquoise shape keeps that path complete without pretending
 * the custom words belong to one of the built-in cast.
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
  version: '0.5.0',
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
      pack.lines.flatMap((line) =>
        line.captionSha256 === undefined
          ? []
          : [
              {
                lineId: line.id,
                captionSha256: line.captionSha256,
              },
            ],
      ),
    ),
  )

  return problems
}
