// ============================================================
// Content pack — the cast, their art slots, and everything spoken
// ============================================================
//
// One place that a designer, a voice actor and a translator can all be pointed
// at. Art arrives as slots (see `assets.ts`), spoken copy arrives as lines with
// an optional audio file, and neither needs a code change to land: an asset
// pass fills in `frames` or `video`, a recording pass fills in `audio`.
//
// Cue names and roles are stable product language. The current app cutouts are
// explicit stand-ins until each versioned character export is ready; detailed
// modelling and rig readiness live with the authored source packages, not in
// runtime content that would drift away from them.

import type { AssetSlot } from './assets'
import { pullOptions } from './pulls'

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

export interface CueEntity {
  /** Matches a `PullOption` id, so a pull can find its own creature. */
  readonly id: string
  readonly name: string
  /** Tight cutout, for a list row or a card. */
  readonly token: AssetSlot
  /**
   * Full-frame, rendered through the same camera and cropped with the same box
   * as the character states, so it composites over one with no positioning
   * code. That is how a single `notice` render personalises to every pull: the
   * character looks at a fixed point, and the entity is what lands there.
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
  readonly cueEntities: readonly CueEntity[]
  readonly lines: readonly Line[]
}

const ART = `${import.meta.env.BASE_URL}art`

export const CORKY_V023_REST_ART: AssetSlot = {
  still: `${ART}/corky/corky-home-rest-v0_23-1024.webp`,
  alt: 'Corky, a rose-plum cork character with eight tubular limbs, settled beside the current plan.',
}

/**
 * Debug APKs from the unpublished content-spine branch may already have saved
 * one of these technical ids. Keep compatibility private while every new cue
 * and every user-facing string uses the neutral taxonomy.
 */
const LEGACY_PULL_ID_ALIASES: Readonly<Record<string, string>> = Object.freeze({
  'alcohol-ritual': 'familiar-ritual',
  'smoking-vaping': 'two-minute-pause',
  takeaway: 'one-tap-convenience',
})

function corkyState(state: CharacterStateId, alt: string): AssetSlot {
  return { still: `${ART}/corky/corky-${state}-1024.webp`, alt }
}

function cueToken(id: string, name: string): AssetSlot {
  return {
    still: `${ART}/cues/cue-${id}-256.webp`,
    alt: `${name}, a soft coloured token standing in for this cue.`,
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

function entity(id: string, name: string, voiceNote: string): CueEntity {
  return {
    id,
    name,
    token: cueToken(id, name),
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

// The names are the current generic cue-world cast. Voice notes describe
// temperament, never a diagnosis or a specific substance or behaviour.
const cueEntities: readonly CueEntity[] = [
  entity(
    'scrolling',
    'The Scroll',
    'Endless, pleasant, never finishes a sentence.',
  ),
  entity(
    'snacking',
    'Sugar Cube',
    'Sweet and insistent. Offers, never argues.',
  ),
  entity(
    'familiar-ritual',
    'The Usual',
    'Familiar and hospitable. Knows the routine before you choose it.',
  ),
  entity(
    'two-minute-pause',
    'Ember',
    'Warm, close and patient. Always suggests one more small pause.',
  ),
  entity(
    'one-tap-convenience',
    'Dinger',
    'Bright and quick. Makes the easiest answer feel already chosen.',
  ),
  entity(
    'avoidance',
    'The Fog',
    'Soft, unhurried, faintly reasonable. Never states a plan.',
  ),
]

/**
 * Shown when a beat needs a cue but the pull has none of its own -- someone
 * who named their own moment, for instance. Keeps the canon turquoise.
 */
export const GENERIC_CUE_ENTITY: CueEntity = entity(
  'generic',
  'Cue',
  'No entity. The plain cue, used where a pull has no creature.',
)

// Corky's own lines. Selected from the mantra set; the audio field stays
// undefined until the recording pass lands.
const lines: readonly Line[] = [
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
  version: '0.2.0',
  leadCharacterId: corky.id,
  characters: [corky],
  cueEntities,
  lines,
}

export function findCharacter(
  pack: ContentPack,
  id: string,
): Character | undefined {
  return pack.characters.find((character) => character.id === id)
}

export function findCueEntity(
  pack: ContentPack,
  pullId: string | undefined,
): CueEntity | undefined {
  if (pullId === undefined) {
    return undefined
  }
  const canonicalId = LEGACY_PULL_ID_ALIASES[pullId] ?? pullId
  return pack.cueEntities.find((entity) => entity.id === canonicalId)
}

export function findLine(pack: ContentPack, id: string): Line | undefined {
  return pack.lines.find((line) => line.id === id)
}

/**
 * Reports everything wrong with a pack instead of throwing on the first fault,
 * so one test run tells a content author the whole story.
 *
 * A pull with no entity is allowed on purpose: someone can name their own
 * moment, and a custom pull will never have a creature.
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
  for (const entity of pack.cueEntities) {
    if (!pullIds.has(entity.id)) {
      problems.push(`Cue entity "${entity.id}" matches no pull option.`)
    }
    if (seen.has(entity.id)) {
      problems.push(`Cue entity "${entity.id}" is declared twice.`)
    }
    seen.add(entity.id)
    if (entity.token.alt.trim() === '') {
      problems.push(`Cue entity "${entity.id}" has no alt text.`)
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

  return problems
}
