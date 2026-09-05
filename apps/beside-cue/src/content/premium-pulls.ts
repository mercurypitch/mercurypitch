// ============================================================
// Premium Pulls — additional cast, not a paywall around the free cue loop
// ============================================================

import type { BuiltInActionId } from './actions'
import { findActionDefinition } from './actions'
import type { BuiltInPullOption } from './pulls'

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
  readonly meet: string
  readonly present: string
  readonly recede: string
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
    meet: 'I’m The Thimble. I put a little armour around words that might sting.',
    present: 'A little armour feels safer. We could stay inside it.',
    recede: 'All right. I can leave a little room.',
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
    meet: 'I’m The Tab. I keep opening possibilities before the last one’s finished.',
    present: 'One more tab. We might need all of these.',
    recede: 'All right. The other tabs can wait.',
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
    meet: 'I’m The Bookmark. I make leaving feel like losing your place.',
    present: 'Just one more minute. What if we lose our place?',
    recede: 'I’ll keep the place. This bit can wait.',
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
    meet: 'I’m The Match. I turn a little spark into doing everything at once.',
    present: 'We have a spark. Let’s do it all right now.',
    recede: 'All right. I’ll leave the rest for later.',
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
    meet: 'I’m The Pillow. I make staying up feel like getting a little time back.',
    present: 'The day was busy. A little longer just for us?',
    recede: 'All right. I can let tonight be enough.',
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
    meet: 'I’m The Kettle. I make an answer feel urgent before it’s ready.',
    present: 'It feels urgent. Shall we answer straight away?',
    recede: 'All right. This answer can wait a moment.',
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
    meet: 'I’m The Ticker. I make the next thing feel late before we get there.',
    present: 'We might be late. Better hurry through this bit.',
    recede: 'All right. I’ll leave this moment to you.',
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
    meet: 'I’m The Tape. I make a quick patch feel like the whole repair.',
    present: 'A little patch will do. We can look underneath later.',
    recede: 'All right. I can stay on the roll for now.',
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

// Caption-only by design. No recording or voice-play control is invented.
export const PREMIUM_PULL_LINES = PREMIUM_PULL_DEFINITIONS.flatMap(
  (definition) => [
    { id: `pull.${definition.id}.meet`, text: definition.meet },
    { id: `pull.${definition.id}.present`, text: definition.present },
    {
      id: `pull.${definition.id}.recede`,
      text: definition.recede,
    },
  ],
)
