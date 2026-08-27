// ============================================================
// Side B actions — stable local definitions independent of display copy
// ============================================================
//
// A saved plan identifies an action by `id`, never by its current label. The
// kinds and requirements describe what Beside Cue can offer without naming an
// execution provider; a later integration can bind an action elsewhere while
// the local prompt remains a complete, offline-safe fallback.

export const ACTION_KINDS = [
  'plain',
  'quiet-timer',
  'guided-audio',
  'external-activity',
] as const

export type ActionKind = (typeof ACTION_KINDS)[number]

export type ActionTheme =
  | 'environment-shift'
  | 'movement'
  | 'creative'
  | 'sensory-reset'
  | 'connection'
  | 'task-start'
  | 'deliberate-pause'

export const ACTION_REQUIREMENTS = [
  'timer',
  'audio-output',
  'external-navigation',
  'network',
  'microphone',
  'haptics',
] as const

export type ActionRequirement = (typeof ACTION_REQUIREMENTS)[number]

export interface ActionDefinition {
  /** Stable persistence identity. It must not be derived from `label`. */
  readonly id: string
  readonly label: string
  readonly kind: ActionKind
  readonly theme: ActionTheme
  readonly requires: readonly ActionRequirement[]
  /** Suggested duration when a visible countdown would add useful structure. */
  readonly durationMinutes?: number
}

export const ACTION_DEFINITIONS = [
  {
    id: 'bside.phone-away',
    label: 'Put the phone in another room.',
    kind: 'plain',
    theme: 'environment-shift',
    requires: [],
  },
  {
    id: 'bside.guitar-riff',
    label: 'Play one guitar riff.',
    kind: 'plain',
    theme: 'creative',
    requires: [],
  },
  {
    id: 'bside.street-walk',
    label: 'Walk to the end of the street.',
    kind: 'plain',
    theme: 'movement',
    requires: [],
  },
  {
    id: 'bside.fill-water',
    label: 'Fill a glass of water.',
    kind: 'plain',
    theme: 'sensory-reset',
    requires: [],
  },
  {
    id: 'bside.make-tea',
    label: 'Make a cup of tea.',
    kind: 'plain',
    theme: 'sensory-reset',
    requires: [],
  },
  {
    id: 'bside.step-outside',
    label: 'Step outside for three minutes.',
    kind: 'quiet-timer',
    theme: 'environment-shift',
    requires: ['timer'],
    durationMinutes: 3,
  },
  {
    id: 'bside.pour-water',
    label: 'Pour a glass of water.',
    kind: 'plain',
    theme: 'sensory-reset',
    requires: [],
  },
  {
    id: 'bside.play-one-song',
    label: 'Put on one song you like.',
    kind: 'plain',
    theme: 'sensory-reset',
    requires: [],
  },
  {
    id: 'bside.block-walk',
    label: 'Take a short walk around the block.',
    kind: 'plain',
    theme: 'movement',
    requires: [],
  },
  {
    id: 'bside.six-breaths',
    label: 'Take six slow breaths.',
    kind: 'plain',
    theme: 'sensory-reset',
    requires: [],
  },
  {
    id: 'bside.open-window-pause',
    label: 'Stand by an open window for two minutes.',
    kind: 'quiet-timer',
    theme: 'environment-shift',
    requires: ['timer'],
    durationMinutes: 2,
  },
  {
    id: 'bside.send-message',
    label: 'Send one message to someone you like.',
    kind: 'plain',
    theme: 'connection',
    requires: [],
  },
  {
    id: 'bside.checkout-pause',
    label: 'Wait five minutes before opening checkout.',
    kind: 'quiet-timer',
    theme: 'deliberate-pause',
    requires: ['timer'],
    durationMinutes: 5,
  },
  {
    id: 'bside.note-order',
    label: 'Write down what you were about to order.',
    kind: 'plain',
    theme: 'deliberate-pause',
    requires: [],
  },
  {
    id: 'bside.later-list',
    label: 'Move it to a later list first.',
    kind: 'plain',
    theme: 'deliberate-pause',
    requires: [],
  },
  {
    id: 'bside.open-file-line',
    label: 'Open the file and write one line.',
    kind: 'plain',
    theme: 'task-start',
    requires: [],
  },
  {
    id: 'bside.quiet-work',
    label: 'Work for two quiet minutes.',
    kind: 'quiet-timer',
    theme: 'task-start',
    requires: ['timer'],
    durationMinutes: 2,
  },
  {
    id: 'bside.first-object',
    label: 'Put the first needed object on the table.',
    kind: 'plain',
    theme: 'task-start',
    requires: [],
  },
  {
    id: 'bside.begin-tiny-part',
    label: 'Begin one tiny part.',
    kind: 'plain',
    theme: 'task-start',
    requires: [],
  },
] as const satisfies readonly ActionDefinition[]

export type BuiltInActionId = (typeof ACTION_DEFINITIONS)[number]['id']

export function findActionDefinition(
  id: string | undefined,
): ActionDefinition | undefined {
  if (id === undefined) {
    return undefined
  }
  return ACTION_DEFINITIONS.find((action) => action.id === id)
}

function normalizeLegacyActionValue(value: string): string {
  return value.trim().replace(/[.]$/u, '').toLocaleLowerCase()
}

/**
 * Maps V1 snapshots that persisted visible copy instead of an action id.
 * New writes must use `ActionDefinition.id`; this is migration-only matching.
 */
export function findActionDefinitionByLegacyValue(
  value: string | undefined,
): ActionDefinition | undefined {
  if (value === undefined) {
    return undefined
  }
  const normalized = normalizeLegacyActionValue(value)
  return ACTION_DEFINITIONS.find(
    (action) => normalizeLegacyActionValue(action.label) === normalized,
  )
}

/** Accepts a stable id first, then falls back to V1 visible-copy matching. */
export function resolveActionDefinition(
  idOrLegacyValue: string | undefined,
): ActionDefinition | undefined {
  return (
    findActionDefinition(idOrLegacyValue) ??
    findActionDefinitionByLegacyValue(idOrLegacyValue)
  )
}

export const CUSTOM_PULL_ACTION_IDS = [
  'bside.step-outside',
  'bside.fill-water',
  'bside.begin-tiny-part',
] as const satisfies readonly BuiltInActionId[]

/** Stable starter choices for a custom Pull; authored free text has no id. */
export const CUSTOM_PULL_ACTIONS: readonly ActionDefinition[] =
  CUSTOM_PULL_ACTION_IDS.map((id) => {
    const action = findActionDefinition(id)
    if (action === undefined) {
      throw new Error(`Custom Pull references unknown Side B action "${id}".`)
    }
    return action
  })
