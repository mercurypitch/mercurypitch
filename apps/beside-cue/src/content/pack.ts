// ============================================================
// Content pack — the cast, their art slots, and everything spoken
// ============================================================
//
// One place that a designer, a voice actor and a translator can all be pointed
// at. Art arrives as slots (see `assets.ts`), spoken copy arrives as lines with
// an optional audio file, and neither needs a code change to land: an asset
// pass fills in `frames` or `video`, a recording pass fills in `audio`.
//
// Pull-character names and roles are stable product language. The cue is the
// context that brings a Pull into focus; the character personifies that Pull
// and must never be described as the cue itself.

import type { AssetSlot } from './assets'
import { canonicalPullId, pullOptions } from './pulls'

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
   * Undefined until a voice actor has delivered this line. The interface shows
   * the caption either way, so an unrecorded line is quieter, never missing.
   */
  readonly audio?: string
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

// Corky's own lines. Selected from the mantra set; the audio field stays
// undefined until the recording pass lands.
const lines: readonly Line[] = [
  // V2 Pull-character recording contract. Captions are complete without audio;
  // selected `.m4a` files can be added to these records after the voice session.
  {
    id: 'pull.scrolling.meet',
    text: 'I’m The Scroll. I always have one more thing to show you, and then one more after that.',
  },
  {
    id: 'pull.scrolling.present',
    text: 'I can keep going for you. That’s what I do.',
  },
  {
    id: 'pull.scrolling.recede',
    text: 'All right. I’ll keep the next thing for later.',
  },
  {
    id: 'pull.snacking.meet',
    text: 'Hi. I’m Sugarlump—the little reach that happens before you notice the reaching.',
  },
  {
    id: 'pull.snacking.present',
    text: 'Something easy and sweet? I can make that sound like the whole plan.',
  },
  {
    id: 'pull.snacking.recede',
    text: 'Okay. The sparkle keeps. You can choose again later.',
  },
  {
    id: 'pull.familiar-ritual.meet',
    text: 'I’m The Usual. I know the time, the place, and the shape of the routine.',
  },
  {
    id: 'pull.familiar-ritual.present',
    text: 'Same place, same order, no new decision. Familiar can feel very comfortable.',
  },
  {
    id: 'pull.familiar-ritual.recede',
    text: 'The place will still be here. You can make a different ritual in it.',
  },
  {
    id: 'pull.two-minute-pause.meet',
    text: 'I’m Ember. I turn a busy moment into one small pause you already know.',
  },
  {
    id: 'pull.two-minute-pause.present',
    text: 'Step away with me for a minute. The rest can wait.',
  },
  {
    id: 'pull.two-minute-pause.recede',
    text: 'Take the pause without me. The quiet part was yours anyway.',
  },
  {
    id: 'pull.one-tap-convenience.meet',
    text: 'Ding. I’m Dinger. I make the fastest answer feel chosen before you choose it.',
  },
  {
    id: 'pull.one-tap-convenience.present',
    text: 'One tap, no planning, done. Easy has a very good sound.',
  },
  {
    id: 'pull.one-tap-convenience.recede',
    text: 'Ding—unrung. The button can wait.',
  },
  {
    id: 'pull.avoidance.meet',
    text: 'I’m The Fog. I’m not stopping anything. I’m just making the first step hard to see.',
  },
  {
    id: 'pull.avoidance.present',
    text: 'It can wait until later. Later always sounds a little easier.',
  },
  {
    id: 'pull.avoidance.recede',
    text: 'Start with one small thing, then. I tend to thin out once you begin.',
  },

  {
    id: 'core.two-sides',
    text: 'Every record has two sides. So does this moment.',
  },
  {
    id: 'core.beside-it',
    text: "I'm not here to grade the spin. I'm here beside it.",
  },
  {
    id: 'core.needle-drop',
    text: 'A cue is just the needle dropping. You choose the track.',
  },
  {
    id: 'core.b-side-meaning',
    text: "Side B doesn't mean second best. It means the one you chose.",
  },
  { id: 'core.one-turn', text: 'One turn at a time.' },
  { id: 'core.same-record', text: 'Same record. Better side.' },
  {
    id: 'core.flip-it',
    text: "You can't unplay a groove. You can flip the record.",
  },
  { id: 'core.loud-quiet', text: 'Loud cue. Quiet turn.' },
  {
    id: 'core.a-side-talking',
    text: "The pull is the A-side talking. It's allowed to talk.",
  },
  { id: 'core.still-spinning', text: "Still spinning. That's the whole job." },

  { id: 'bside.clean-groove', text: "That's a clean groove." },
  { id: 'bside.pressed', text: 'Pressed. Nothing flashy. It counts.' },
  {
    id: 'bside.the-craft',
    text: "Heard the cue, chose the track. That's the craft.",
  },
  {
    id: 'bside.run-out',
    text: 'One more turn in the run-out. See you at the next spin.',
  },
  { id: 'bside.good-side', text: 'Good side, this one.' },

  { id: 'aside.records-do-that', text: 'The A-side played. Records do that.' },
  { id: 'aside.noted', text: 'Noted, not graded.' },
  {
    id: 'aside.flip-when-ready',
    text: "Still the same record. Flip it when you're ready.",
  },
  {
    id: 'aside.beside-you',
    text: "Some spins go that way. I'm still beside you.",
  },
  {
    id: 'aside.tomorrow',
    text: 'The needle drops again tomorrow. Same time, same us.',
  },

  {
    id: 'return.kept-your-place',
    text: 'There you are. The turntable kept your place.',
  },
  {
    id: 'return.surface-noise',
    text: "Surface noise. The music's still under it.",
  },
  {
    id: 'return.no-groove-wore-out',
    text: 'No groove wore out while you were gone.',
  },
  {
    id: 'return.records-wait',
    text: "Records wait. It's one of their best features.",
  },
  { id: 'return.left-the-sleeve', text: 'Right where we left the sleeve.' },

  {
    id: 'pressing.hold-to-light',
    text: "That's a pressing. Hold it up to the light.",
  },
  {
    id: 'pressing.every-groove',
    text: 'Every groove in this one is a turn you made.',
  },
  { id: 'pressing.run-of-one', text: 'Limited edition. Run of one.' },
  {
    id: 'pressing.needed-yours',
    text: "This didn't need to be perfect. It needed to be yours.",
  },
  {
    id: 'pressing.listen-back',
    text: 'Worth a listen back, this side of you.',
  },

  { id: 'cue.hovering', text: "Needle's hovering. No rush." },
  {
    id: 'cue.on-the-label',
    text: "It's that time on the label. What are we playing?",
  },
  { id: 'cue.hold-the-sleeve', text: "Cue's here. I'll hold the sleeve." },
  { id: 'cue.quick-spin', text: 'Quick spin with me?' },
  { id: 'cue.your-move', text: "The record's on the platter. Your move, DJ." },

  { id: 'reminder.at-seven', text: "I'll drop the needle at seven, then." },
  { id: 'reminder.same-time', text: 'Same time on the label as always.' },
  {
    id: 'reminder.slot-is-safe',
    text: 'Your slot on the turntable is safe with me.',
  },
]

export const DEFAULT_CONTENT_PACK: ContentPack = {
  id: 'beside-cue-default',
  version: '0.3.0',
  leadCharacterId: corky.id,
  characters: [corky],
  pullCharacters: PULL_CHARACTERS,
  cueEntities: PULL_CHARACTERS,
  lines,
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

  return problems
}
