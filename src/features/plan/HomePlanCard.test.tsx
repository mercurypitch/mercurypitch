// ============================================================
// HomePlanCard — what Home's "Your plan" draws, from what the plan says
// ============================================================
//
// When the card shows, and which stops it ticks, are plan-progress.test.ts's.
// What is pinned here is what the card draws from them: the words, the rows in
// the plan's order, the ticks and what a screen reader hears of them, the ask
// for a skipper, the nothing when there is nothing to say (eight days on, the
// clock has taken the card away), and that it follows the record, the menu and
// the rooms as they change under it. One case for each way in is here too, as
// the main path: a row opens its stop and ticks it (opens a stop and ticks it
// once opened), and Start opens the four taps (opens the four taps for a
// skipper). What else a tap does is HomePlanCard.open.test.tsx's, and the X is
// HomePlanCard.hide.test.tsx's.
//
// The stores are the real ones, put back between cases
// (plan-choices.fixture.ts). Only the edges are faked: enterStop, which would
// move the app and the browser (enter-stop.test.ts has its own cases), and the
// funnel's console. A card's parts have no role to query by, so the markup
// carries `data-part` hooks, as the plan's screen does, and `data-kind` and
// `data-dest` for the stop a row is.

import { cleanup, fireEvent, render, screen, within, } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setPracticeScope, setUiMode } from '@/stores/settings-store'
import type { PlanStop } from './build-plan'
import { buildPlan, planStops } from './build-plan'
import type * as EnterStopModule from './enter-stop'
import { enterStop } from './enter-stop'
import { HomePlanCard } from './HomePlanCard'
import { ago, answeredAgo, AUDITION, fresh, NO_TEXTS, seeFirstValue, sent, SINGING_ONLY, STARTING, TOGETHER, } from './plan-choices.fixture'
import { PLAN_OPENED_KEY } from './plan-keys'
import { declinePlan, markPlanShown, markStopOpened, planLayerMode, savePlanAnswers, stopOpened, } from './plan-store'
import { EMPTY_CHOICES, MERC_INTRO } from './questions'

vi.mock('./enter-stop', async (importOriginal) => ({
  ...(await importOriginal<typeof EnterStopModule>()),
  enterStop: vi.fn(),
}))

// ── Fixtures ───────────────────────────────────────────────────────────

const [START, LEARN, PLAY] = planStops(buildPlan(AUDITION))
const STOPS: Record<PlanStop['kind'], PlanStop> = {
  start: START,
  learn: LEARN,
  play: PLAY,
}
const KINDS = ['start', 'learn', 'play'] as const
/** What the card is called when it asks for the four questions. */
const ASK_TITLE = 'Your plan, in four taps'

const keysInStorage = (): (string | null)[] =>
  Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i))

/** Home's own session is HomePlanCard.open.test.tsx's: here the handler is nothing. */
const mount = (): HTMLElement =>
  render(() => <HomePlanCard onHomeSession={() => undefined} />).container

/** The row for a kind of stop, wherever it stands on the page. */
function row(kind: PlanStop['kind']): HTMLElement {
  const el = document.querySelector<HTMLElement>(`[data-kind="${kind}"]`)
  if (el === null) throw new Error(`No ${kind} row is on screen`)
  return el
}
const rowsOnScreen = (container: HTMLElement): string[] =>
  [...container.querySelectorAll<HTMLElement>('[data-kind]')].map(
    (el) => el.dataset.dest ?? '',
  )
const part = (el: HTMLElement, name: string): string | null | undefined =>
  el.querySelector(`[data-part="${name}"]`)?.textContent
const tick = (el: HTMLElement): HTMLElement | null =>
  within(el).queryByRole('img', { name: 'Done' })
const tap = (el: HTMLElement): void => {
  fireEvent.click(el)
}

beforeEach(() => {
  vi.clearAllMocks()
  // The funnel logs each event it is told about.
  vi.spyOn(console, 'info').mockImplementation(() => undefined)
  fresh()
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

// ── The plan ───────────────────────────────────────────────────────────

describe('the plan', () => {
  it('is one region called Your plan, with a row for each stop in the order Start here, Learn, Play', () => {
    answeredAgo(1)

    const container = mount()

    expect(screen.getByRole('region', { name: 'Your plan' })).toBe(
      container.firstElementChild,
    )
    expect(
      screen.getByRole('heading', { level: 2, name: 'Your plan' }),
    ).toHaveTextContent('Your plan')
    expect(rowsOnScreen(container)).toEqual([
      'sing',
      'hearYourself',
      'karaokeNight',
    ])
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
  })

  it.each([
    ['start', 'Start here', 'Sing'],
    ['learn', 'Learn', 'Hear Yourself'],
    ['play', 'Play', 'Karaoke Night'],
  ] as const)(
    'shows the %s row as %s over %s, with the title the plan gave it',
    (kind, words, room) => {
      answeredAgo(1)

      mount()

      expect([
        part(row(kind), 'kind'),
        part(row(kind), 'room'),
        part(row(kind), 'title'),
      ]).toEqual([words, room, STOPS[kind].title])
    },
  )

  it('shows one row for a plan of one stop', () => {
    answeredAgo(1, SINGING_ONLY)

    const container = mount()

    expect(rowsOnScreen(container)).toEqual(['sing'])
    expect(part(row('start'), 'room')).toBe('Sing')
  })

  it('ticks no row for someone whose rooms have given them nothing yet', () => {
    answeredAgo(1)

    mount()

    expect(KINDS.map((k) => tick(row(k)))).toEqual([null, null, null])
  })

  it('ticks the rows whose rooms have already given a first value', () => {
    seeFirstValue('sing')
    answeredAgo(1)

    mount()

    expect(KINDS.map((k) => tick(row(k)) !== null)).toEqual([
      true,
      false,
      false,
    ])
    // The sheet dims a done row's title by this hook.
    expect(KINDS.map((k) => row(k).hasAttribute('data-done'))).toEqual([
      true,
      false,
      false,
    ])
  })

  it('names the tick for a screen reader, so a row done is not just a row with a picture', () => {
    seeFirstValue('sing')
    answeredAgo(1)

    mount()

    // The dot between the kind and the room is for the eye, not the ear.
    expect(row('start')).toHaveAccessibleName(
      `Start here Sing ${START.title} Done`,
    )
    expect(row('learn')).not.toHaveAccessibleName(/Done/)
    expect(row('play')).not.toHaveAccessibleName(/Done/)
  })

  it('opens a stop and ticks it once opened', () => {
    answeredAgo(1)
    mount()
    expect(tick(row('learn'))).toBeNull()
    expect(stopOpened('hearYourself')).toBe(false)

    tap(row('learn'))

    expect(enterStop).toHaveBeenCalledExactlyOnceWith(LEARN)
    expect(sent()).toEqual(['plan_stop_learn'])
    expect(stopOpened('hearYourself')).toBe(true)
    expect(KINDS.map((k) => tick(row(k)) !== null)).toEqual([
      false,
      true,
      false,
    ])
  })

  it('draws the plan as it is stored, so Start here follows the voiceprint the record kept', () => {
    savePlanAnswers(
      EMPTY_CHOICES,
      NO_TEXTS,
      { room: 'exercises', detail: 'Steady the wobble' },
      ago(1),
    )

    mount()

    expect(part(row('start'), 'room')).toBe('Exercises')
    expect(part(row('start'), 'title')).toBe('Steady the wobble')
  })
})

// ── The four taps ──────────────────────────────────────────────────────

describe('the ask', () => {
  const asks: [string, () => void][] = [
    ['skipped', () => markPlanShown('welcome-skip', ago(2))],
    ['turned it down', () => declinePlan(EMPTY_CHOICES, ago(2))],
  ]

  it.each(asks)(
    'invites someone who %s to answer the four questions',
    (_, setUp) => {
      setUp()

      const container = mount()

      expect(screen.getByRole('region', { name: ASK_TITLE })).toBe(
        container.firstElementChild,
      )
      expect(
        screen.getByRole('heading', {
          level: 2,
          name: ASK_TITLE,
        }),
      ).toHaveTextContent(ASK_TITLE)
      expect(within(container).getByText(MERC_INTRO.q1)).toHaveTextContent(
        "Four quick questions, then I'll make you a plan.",
      )
      expect(screen.getByRole('button', { name: 'Start' })).toHaveTextContent(
        'Start',
      )
      expect(rowsOnScreen(container)).toEqual([])
    },
  )

  it('opens the four taps for a skipper', () => {
    markPlanShown('welcome-skip', ago(2))
    mount()
    expect(planLayerMode()).toBeNull()

    tap(screen.getByRole('button', { name: 'Start' }))

    expect(planLayerMode()).toBe('skipper')
  })

  it('opens the same four taps for someone who turned them down', () => {
    declinePlan(EMPTY_CHOICES, ago(2))
    mount()
    expect(planLayerMode()).toBeNull()

    tap(screen.getByRole('button', { name: 'Start' }))

    expect(planLayerMode()).toBe('skipper')
  })

  it('opens only the layer: no stop is entered, and the funnel is the layer own to tell', () => {
    markPlanShown('layer', ago(1))
    mount()

    tap(screen.getByRole('button', { name: 'Start' }))

    expect(enterStop).not.toHaveBeenCalled()
    expect(sent()).toEqual([])
    expect(keysInStorage()).not.toContain(PLAN_OPENED_KEY)
  })

  it('stays on Home behind the layer, and turns into the plan when the questions are answered', () => {
    markPlanShown('layer', ago(1))
    const container = mount()
    tap(screen.getByRole('button', { name: 'Start' }))
    expect(rowsOnScreen(container)).toEqual([])

    answeredAgo(0)

    expect(screen.getByRole('region', { name: 'Your plan' })).toBe(
      container.firstElementChild,
    )
    expect(rowsOnScreen(container)).toEqual([
      'sing',
      'hearYourself',
      'karaokeNight',
    ])
    expect(screen.queryByRole('button', { name: 'Start' })).toBeNull()
  })
})

// ── When there is nothing to say ───────────────────────────────────────

describe('no card', () => {
  // The rules (the week, hiding, what is done) are plan-progress.test.ts's. These
  // show the card draws a null state as nothing: no region, no empty list. The
  // last is the card's own clock reaching the week: a card whose clock stopped
  // at the record's date would draw the plan for good, and every other case on
  // this page is a day old.
  const nothing: [string, () => void][] = [
    ['before the plan has been shown', () => undefined],
    [
      'once every stop is done',
      () => {
        seeFirstValue('sing')
        answeredAgo(1, SINGING_ONLY)
      },
    ],
    ['on day 8, when the week is over', () => answeredAgo(8)],
  ]

  it.each(nothing)('draws nothing %s', (_, setUp) => {
    setUp()

    const container = mount()

    expect(container).toBeEmptyDOMElement()
  })
})

// ── What it follows ────────────────────────────────────────────────────

describe('following the app', () => {
  it('follows the menu: a room the menu hides loses its row, and gets it back', () => {
    answeredAgo(1, TOGETHER)
    const container = mount()
    expect(rowsOnScreen(container)).toEqual(['sing', 'jam'])

    setPracticeScope('guitar')
    expect(rowsOnScreen(container)).toEqual(['sing'])

    setPracticeScope('all')
    expect(rowsOnScreen(container)).toEqual(['sing', 'jam'])

    setUiMode('simple')
    expect(rowsOnScreen(container)).toEqual(['sing'])
  })

  it('follows the stops opened by something else: a lesson opened elsewhere is ticked', () => {
    answeredAgo(1, STARTING)
    mount()
    expect(tick(row('learn'))).toBeNull()

    markStopOpened('lesson1')

    expect(tick(row('learn'))).not.toBeNull()
  })

  it('reads the rooms as it opens: a first value from before shows as a tick', () => {
    answeredAgo(1)
    mount()
    expect(tick(row('play'))).toBeNull()
    cleanup()

    seeFirstValue('karaoke')
    mount()

    expect(tick(row('play'))).not.toBeNull()
  })
})
