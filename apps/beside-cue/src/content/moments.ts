// ============================================================
// Moment engine — what the app shows and says at a named beat
// ============================================================
//
// Screens ask for a moment, not for a picture and a sentence. That keeps the
// cue flow out of the art pipeline: when Corky gains a real `turn` clip, or a
// line gains a recording, the moment definition is the only thing that changes.
//
// Selection is deterministic. The app already rotates its phrases by a stored
// index rather than at random, so a person sees the set in order instead of
// hearing the same line twice running, and a test can assert an exact string.

import type { AssetSlot } from './assets'
import type { Character, CharacterStateId, ContentPack, Line, PullCharacter, } from './pack'
import { findCharacter, findPullCharacter, GENERIC_PULL_CHARACTER, } from './pack'

export type MomentId =
  | 'cue.open'
  | 'turn.b-side'
  | 'turn.a-side'
  | 'return'
  | 'pressing.earned'
  | 'reminder.set'

export interface MomentDefinition {
  readonly id: MomentId
  readonly characterState: CharacterStateId
  /** Whether this beat is about a cue arriving, and so shows its token. */
  readonly showsEntity: boolean
  /** Always visible, whether or not the line is ever recorded. */
  readonly caption: string
  /** Rotated through in order. Never empty. */
  readonly lineIds: readonly string[]
}

export const MOMENTS: Readonly<Record<MomentId, MomentDefinition>> = {
  'cue.open': {
    id: 'cue.open',
    characterState: 'notice',
    showsEntity: true,
    caption: 'One cue, no argument',
    lineIds: [
      'cue.hovering',
      'cue.on-the-label',
      'cue.hold-the-sleeve',
      'cue.quick-spin',
      'cue.your-move',
    ],
  },
  'turn.b-side': {
    id: 'turn.b-side',
    characterState: 'turn',
    showsEntity: false,
    caption: 'Turn toward Side B',
    lineIds: [
      'bside.clean-groove',
      'bside.pressed',
      'bside.the-craft',
      'bside.run-out',
      'bside.good-side',
    ],
  },
  'turn.a-side': {
    id: 'turn.a-side',
    characterState: 'quiet',
    showsEntity: false,
    caption: 'The screen can go quiet now',
    lineIds: [
      'aside.records-do-that',
      'aside.noted',
      'aside.flip-when-ready',
      'aside.beside-you',
      'aside.tomorrow',
    ],
  },
  return: {
    id: 'return',
    characterState: 'rest',
    showsEntity: false,
    caption: 'The turntable kept your place',
    lineIds: [
      'return.kept-your-place',
      'return.surface-noise',
      'return.no-groove-wore-out',
      'return.records-wait',
      'return.left-the-sleeve',
    ],
  },
  'pressing.earned': {
    id: 'pressing.earned',
    characterState: 'turn',
    showsEntity: false,
    caption: 'A pressing, run of one',
    lineIds: [
      'pressing.hold-to-light',
      'pressing.every-groove',
      'pressing.run-of-one',
      'pressing.needed-yours',
      'pressing.listen-back',
    ],
  },
  'reminder.set': {
    id: 'reminder.set',
    characterState: 'rest',
    showsEntity: false,
    caption: 'Your slot on the turntable',
    lineIds: [
      'reminder.at-seven',
      'reminder.same-time',
      'reminder.slot-is-safe',
    ],
  },
}

export interface MomentContext {
  /** Which pull this beat is about, when it is about one. */
  readonly pullId?: string
  /**
   * Rotation counter. The same value always yields the same line, so a screen
   * that re-renders does not reshuffle what it is saying mid-sentence.
   */
  readonly rotation?: number
}

export interface MomentPresentation {
  readonly moment: MomentId
  readonly caption: string
  readonly character: Character
  readonly characterState: CharacterStateId
  readonly art: AssetSlot
  readonly line: Line
  /** Present only when the beat brings a Pull character into view. */
  readonly pullCharacter?: PullCharacter
  /** @deprecated Use `pullCharacter`; retained for V1 stage components. */
  readonly entity?: PullCharacter
}

function itemAt<T>(items: readonly T[], index: number): T {
  // Negative and oversized counters both wrap, so a stored rotation that
  // outlives a content change cannot crash a screen.
  const size = items.length
  const wrapped = ((index % size) + size) % size
  return items[wrapped] as T
}

/**
 * Resolves one beat into everything a screen needs to draw it.
 *
 * Throws only for a genuinely broken pack — a missing lead character or a line
 * id a moment references but the pack does not define. Both are caught by the
 * pack validation test, so they cannot reach a build.
 */
export function resolveMoment(
  pack: ContentPack,
  moment: MomentId,
  context: MomentContext = {},
): MomentPresentation {
  const definition = MOMENTS[moment]
  const character = findCharacter(pack, pack.leadCharacterId)
  if (character === undefined) {
    throw new Error(
      `Content pack "${pack.id}" has no lead character "${pack.leadCharacterId}".`,
    )
  }

  const lineId = itemAt(definition.lineIds, context.rotation ?? 0)
  const line = pack.lines.find((candidate) => candidate.id === lineId)
  if (line === undefined) {
    throw new Error(
      `Moment "${moment}" references line "${lineId}", which the pack does not define.`,
    )
  }

  // A cue-arrival beat can bring the matching Pull character into focus.
  // Someone who named their own Pull has no authored creature, and a blank
  // space where Corky is plainly looking would read as a missing image.
  const pullCharacter = definition.showsEntity
    ? (findPullCharacter(pack, context.pullId) ?? GENERIC_PULL_CHARACTER)
    : undefined

  return {
    moment,
    caption: definition.caption,
    character,
    characterState: definition.characterState,
    art: character.states[definition.characterState],
    line,
    ...(pullCharacter === undefined
      ? {}
      : { pullCharacter, entity: pullCharacter }),
  }
}
