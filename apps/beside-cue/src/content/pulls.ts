// ============================================================
// Pull catalog — neutral contexts and stable Side B choices
// ============================================================
//
// A Pull is the recurring pattern being noticed, never the cue that happens to
// reveal it. Built-in choices carry stable ids, while `suggestions` remains a
// derived string view for V1 screens and custom Pulls remain free-form.

import type { ActionDefinition, BuiltInActionId } from './actions'
import { findActionDefinition } from './actions'

export type PullAnchorKind =
  | 'device'
  | 'place'
  | 'routine'
  | 'time'
  | 'transition'

export interface PullAnchorSuggestion {
  readonly id: string
  readonly kind: PullAnchorKind
  readonly text: string
}

export interface PullOption {
  readonly id: string
  readonly label: string
  readonly moment: string
  /** Familiar response shown as Side A after this Pull is chosen. */
  readonly defaultSideAText?: string
  /** Optional only so V1 injected configs remain source-compatible. */
  readonly previewLineId?: string
  /** Optional only so V1 injected configs remain source-compatible. */
  readonly anchorSuggestions?: readonly PullAnchorSuggestion[]
  /** Optional only so V1 injected configs remain source-compatible. */
  readonly bSideSuggestions?: readonly ActionDefinition[]
  /** @deprecated Use `bSideSuggestions`; retained for V1 string-only screens. */
  readonly suggestions: readonly string[]
}

export interface BuiltInPullOption extends PullOption {
  readonly defaultSideAText: string
  /** Stable voice-content reference; the matching line can land separately. */
  readonly previewLineId: string
  readonly anchorSuggestions: readonly PullAnchorSuggestion[]
  /** Canonical built-in Side B choices. Persist each choice by its `id`. */
  readonly bSideSuggestions: readonly ActionDefinition[]
}

export const BUILT_IN_PULL_IDS = [
  'scrolling',
  'snacking',
  'familiar-ritual',
  'two-minute-pause',
  'one-tap-convenience',
  'avoidance',
] as const

export type BuiltInPullId = (typeof BUILT_IN_PULL_IDS)[number]

/**
 * Unpublished debug builds used these ids. Their meaning remains readable, but
 * every current screen, character and new persisted record uses the neutral id.
 */
export const LEGACY_PULL_ID_ALIASES: Readonly<Record<string, BuiltInPullId>> =
  Object.freeze({
    'alcohol-ritual': 'familiar-ritual',
    'smoking-vaping': 'two-minute-pause',
    takeaway: 'one-tap-convenience',
  })

interface PullDefinition {
  readonly id: BuiltInPullId
  readonly label: string
  readonly moment: string
  readonly defaultSideAText: string
  readonly previewLineId: string
  readonly anchorSuggestions: readonly PullAnchorSuggestion[]
  readonly bSideSuggestionIds: readonly BuiltInActionId[]
}

function requiredAction(id: BuiltInActionId): ActionDefinition {
  const action = findActionDefinition(id)
  if (action === undefined) {
    throw new Error(`Pull catalog references unknown Side B action "${id}".`)
  }
  return action
}

function definePull(definition: PullDefinition): BuiltInPullOption {
  const bSideSuggestions = definition.bSideSuggestionIds.map(requiredAction)
  return {
    id: definition.id,
    label: definition.label,
    moment: definition.moment,
    defaultSideAText: definition.defaultSideAText,
    previewLineId: definition.previewLineId,
    anchorSuggestions: definition.anchorSuggestions,
    bSideSuggestions,
    suggestions: bSideSuggestions.map((suggestion) => suggestion.label),
  }
}

export const pullOptions: readonly BuiltInPullOption[] = [
  definePull({
    id: 'scrolling',
    label: 'Endless scrolling',
    moment: 'When the feed keeps going after you meant to leave.',
    defaultSideAText: 'Keep scrolling',
    previewLineId: 'pull.scrolling.meet',
    anchorSuggestions: [
      {
        id: 'anchor.scrolling.open-feed',
        kind: 'device',
        text: 'When I open the feed without deciding to.',
      },
      {
        id: 'anchor.scrolling.in-bed',
        kind: 'routine',
        text: 'When I get into bed with my phone.',
      },
      {
        id: 'anchor.scrolling.post-to-post',
        kind: 'routine',
        text: 'When one post turns into another.',
      },
    ],
    bSideSuggestionIds: [
      'bside.phone-away',
      'bside.guitar-riff',
      'bside.street-walk',
    ],
  }),
  definePull({
    id: 'snacking',
    label: 'Automatic snacking',
    moment: 'When reaching for something happens before choosing it.',
    defaultSideAText: 'Reach for a snack automatically',
    previewLineId: 'pull.snacking.meet',
    anchorSuggestions: [
      {
        id: 'anchor.snacking.enter-kitchen',
        kind: 'place',
        text: 'When I walk into the kitchen without a plan.',
      },
      {
        id: 'anchor.snacking.see-food',
        kind: 'routine',
        text: 'When I see food while doing something else.',
      },
      {
        id: 'anchor.snacking.want-break',
        kind: 'transition',
        text: 'When I want a break but have not chosen one.',
      },
    ],
    bSideSuggestionIds: [
      'bside.fill-water',
      'bside.make-tea',
      'bside.step-outside',
    ],
  }),
  definePull({
    id: 'familiar-ritual',
    label: 'Familiar ritual',
    moment: 'When the usual time or place starts the routine.',
    defaultSideAText: 'Follow the usual ritual',
    previewLineId: 'pull.familiar-ritual.meet',
    anchorSuggestions: [
      {
        id: 'anchor.familiar-ritual.usual-time',
        kind: 'time',
        text: 'When the familiar time of day arrives.',
      },
      {
        id: 'anchor.familiar-ritual.usual-place',
        kind: 'place',
        text: 'When I sit in the usual place.',
      },
      {
        id: 'anchor.familiar-ritual.day-transition',
        kind: 'transition',
        text: 'When finishing one part of the day starts the routine.',
      },
    ],
    bSideSuggestionIds: [
      'bside.pour-water',
      'bside.play-one-song',
      'bside.block-walk',
    ],
  }),
  definePull({
    id: 'two-minute-pause',
    label: 'Familiar break',
    moment: 'When you reach for a familiar pause before choosing it.',
    defaultSideAText: 'Take the familiar pause',
    previewLineId: 'pull.two-minute-pause.meet',
    anchorSuggestions: [
      {
        id: 'anchor.two-minute-pause.between-tasks',
        kind: 'transition',
        text: 'When I step away between two tasks.',
      },
      {
        id: 'anchor.two-minute-pause.tense-moment',
        kind: 'routine',
        text: 'When a tense moment makes me want a familiar pause.',
      },
      {
        id: 'anchor.two-minute-pause.usual-place',
        kind: 'place',
        text: 'When I go to the usual place for a break.',
      },
    ],
    bSideSuggestionIds: [
      'bside.six-breaths',
      'bside.open-window-pause',
      'bside.send-message',
    ],
  }),
  definePull({
    id: 'one-tap-convenience',
    label: 'One-tap convenience',
    moment: 'When one tap starts to feel like the easiest answer.',
    defaultSideAText: 'Choose the one-tap option',
    previewLineId: 'pull.one-tap-convenience.meet',
    anchorSuggestions: [
      {
        id: 'anchor.one-tap-convenience.easy-option',
        kind: 'device',
        text: 'When an app puts the easy option in front of me.',
      },
      {
        id: 'anchor.one-tap-convenience.end-of-day',
        kind: 'time',
        text: 'When I am tired and want the fastest answer.',
      },
      {
        id: 'anchor.one-tap-convenience.checkout',
        kind: 'device',
        text: 'When I reach checkout before I have really chosen.',
      },
    ],
    bSideSuggestionIds: [
      'bside.checkout-pause',
      'bside.note-order',
      'bside.later-list',
    ],
  }),
  definePull({
    id: 'avoidance',
    label: 'Putting it off',
    moment: 'When circling the task takes over from beginning it.',
    defaultSideAText: 'Put off beginning',
    previewLineId: 'pull.avoidance.meet',
    anchorSuggestions: [
      {
        id: 'anchor.avoidance.look-away',
        kind: 'routine',
        text: 'When the task comes into view and I look away.',
      },
      {
        id: 'anchor.avoidance.unclear-first-step',
        kind: 'routine',
        text: 'When the first step feels unclear.',
      },
      {
        id: 'anchor.avoidance.planning',
        kind: 'transition',
        text: 'When planning replaces beginning.',
      },
    ],
    bSideSuggestionIds: [
      'bside.open-file-line',
      'bside.quiet-work',
      'bside.first-object',
    ],
  }),
]

export function canonicalPullId(id: string): string {
  return LEGACY_PULL_ID_ALIASES[id] ?? id
}

export function findPullOption(
  id: string | undefined,
): BuiltInPullOption | undefined {
  if (id === undefined) {
    return undefined
  }
  const canonicalId = canonicalPullId(id)
  return pullOptions.find((option) => option.id === canonicalId)
}

export const cuePhrases = [
  'A small turn still changes the direction.',
  'One small next choice is enough.',
  'Your attention is yours to place.',
  'Make room for what you chose.',
] as const

export const bSideAcknowledgements = [
  'The turn is yours now.',
  'Good. Back to your day.',
  'Coming back matters.',
] as const

export const notNowAcknowledgements = [
  'All right. The next cue will still be here.',
  'Nothing to make up. Your next cue is enough.',
] as const
