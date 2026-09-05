// ============================================================
// Premium Pulls — additional cast, not a paywall around the free cue loop
// ============================================================

import type { BuiltInActionId } from './actions'
import { findActionDefinition } from './actions'
import type { BuiltInPullOption } from './pulls'
import { CANONICAL_VOICE_LINES } from './voice-lines'

export const PREMIUM_PULL_IDS = [
  'the-thimble',
  'the-tab',
  'the-bookmark',
  'the-match',
  'the-pillow',
  'the-kettle',
  'the-ticker',
  'the-tape',
] as const

interface PremiumPullDefinition {
  readonly id: (typeof PREMIUM_PULL_IDS)[number]
  readonly name: string
  readonly label: string
  readonly moment: string
  readonly sideA: string
  readonly anchors: readonly [string, string, string]
  readonly actions: readonly BuiltInActionId[]
}

export const PREMIUM_PULL_DEFINITIONS: readonly PremiumPullDefinition[] = [
  {
    id: 'the-thimble',
    name: 'The Thimble',
    label: 'Putting my guard up',
    moment: 'When feedback makes me close up before I can listen.',
    sideA: 'Put my guard up',
    anchors: [
      'When someone offers feedback.',
      'When I feel myself getting defensive.',
      'After a difficult conversation.',
    ],
    actions: [
      'bside.six-breaths',
      'bside.open-window-pause',
      'bside.send-message',
    ],
  },
  {
    id: 'the-tab',
    name: 'The Tab',
    label: 'Too many tabs',
    moment: 'When switching tasks takes over from doing one thing.',
    sideA: 'Open another tab',
    anchors: [
      'When I open another browser tab.',
      'When I switch tasks without finishing.',
      'At the start of a work session.',
    ],
    actions: ['bside.phone-away', 'bside.quiet-work', 'bside.open-file-line'],
  },
  {
    id: 'the-bookmark',
    name: 'The Bookmark',
    label: 'Just one more minute',
    moment: 'When leaving feels like losing my place.',
    sideA: 'Stay a little longer',
    anchors: [
      'When I reach a good stopping point.',
      'When I keep saying one more minute.',
      'When it is time to move on.',
    ],
    actions: [
      'bside.begin-tiny-part',
      'bside.open-window-pause',
      'bside.step-outside',
    ],
  },
  {
    id: 'the-match',
    name: 'The Match',
    label: 'Going all out',
    moment: 'When a burst of effort leaves no room to pause.',
    sideA: 'Keep pushing without a break',
    anchors: [
      'When I skip a break to keep working.',
      'When I start several things at once.',
      'When a new idea takes over.',
    ],
    actions: ['bside.fill-water', 'bside.six-breaths', 'bside.quiet-work'],
  },
  {
    id: 'the-pillow',
    name: 'The Pillow',
    label: 'Putting off sleep',
    moment: 'When I stay up even though I am tired.',
    sideA: 'Stay up past tiredness',
    anchors: [
      'When I take my phone to bed.',
      'When I notice I am tired.',
      'When I finish the last thing tonight.',
    ],
    actions: [
      'bside.phone-away',
      'bside.six-breaths',
      'bside.open-window-pause',
    ],
  },
  {
    id: 'the-kettle',
    name: 'The Kettle',
    label: 'Reacting in a rush',
    moment: 'When urgency gets ahead of a considered response.',
    sideA: 'React before pausing',
    anchors: [
      'When a message feels urgent.',
      'When I want to answer immediately.',
      'When plans change unexpectedly.',
    ],
    actions: ['bside.make-tea', 'bside.six-breaths', 'bside.step-outside'],
  },
  {
    id: 'the-ticker',
    name: 'The Ticker',
    label: 'Always rushing',
    moment: 'When feeling behind makes me rush through the moment.',
    sideA: 'Rush to the next thing',
    anchors: [
      'When I check the time again.',
      'Between two tasks.',
      'When I feel behind schedule.',
    ],
    actions: ['bside.six-breaths', 'bside.quiet-work', 'bside.pour-water'],
  },
  {
    id: 'the-tape',
    name: 'The Tape',
    label: 'Another quick fix',
    moment: 'When I patch something quickly without giving it time.',
    sideA: 'Reach for another quick fix',
    anchors: [
      'When the same problem returns.',
      'When I want to fix everything at once.',
      'Before I reach for a temporary solution.',
    ],
    actions: ['bside.begin-tiny-part', 'bside.quiet-work', 'bside.six-breaths'],
  },
]

export const PREMIUM_PULL_OPTIONS: readonly BuiltInPullOption[] =
  PREMIUM_PULL_DEFINITIONS.map((definition) => {
    const bSideSuggestions = definition.actions.map((id) => {
      const action = findActionDefinition(id)
      if (action === undefined) throw new Error(`Unknown premium Side B: ${id}`)
      return action
    })
    return {
      id: definition.id,
      access: 'pro',
      label: definition.label,
      moment: definition.moment,
      defaultSideAText: definition.sideA,
      previewLineId: `pull.${definition.id}.meet`,
      anchorSuggestions: definition.anchors.map((text, index) => ({
        id: `anchor.${definition.id}.${index + 1}`,
        kind: 'transition',
        text,
      })),
      bSideSuggestions,
      suggestions: bSideSuggestions.map((action) => action.label),
    }
  })

// A view of the canonical registry, never a second caption authority.
export const PREMIUM_PULL_LINES = CANONICAL_VOICE_LINES.filter((line) =>
  PREMIUM_PULL_IDS.some((id) => line.id.startsWith(`pull.${id}.`)),
)
