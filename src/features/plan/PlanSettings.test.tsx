// ============================================================
// PlanSettings — "Your plan" in Settings
// ============================================================
//
// What the section offers for each state of the plan, where each way in
// opens the layer (and that it tells the funnel nothing a review or the
// skipper's Start does not), and Show on Home: offered only while Home's card
// is hidden on this device and would otherwise show, and bringing back a card
// Home has drawn at once. How Settings reaches the section, and that the native
// build has none of it, is settings-plan-mount.test.ts's; what the layer does
// in each mode is PlanLayer.test.tsx's.
//
// The stores are the real ones, put back between cases
// (plan-choices.fixture.ts). Only the funnel's console is faked.

import { cleanup, fireEvent, render, screen, within, } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HomePlanCard } from './HomePlanCard'
import { ago, answeredAgo, fresh, seeFirstValue, sent, SINGING_ONLY, } from './plan-choices.fixture'
import { PLAN_PLACES } from './plan-copy'
import { PLAN_CARD_DISMISSED_KEY } from './plan-keys'
import { declinePlan, hidePlanCard, markPlanShown, planCardHidden, planLayerMode, } from './plan-store'
import { PlanSettings } from './PlanSettings'
import { EMPTY_CHOICES } from './questions'

// ── Fixtures ───────────────────────────────────────────────────────────

const mount = (): HTMLElement => render(() => <PlanSettings />).container
const section = (): HTMLElement => screen.getByTestId('settings-plan')
/** The section's buttons, by name, in their order. */
const ways = (): string[] =>
  within(section())
    .queryAllByRole('button')
    .map((b) => b.textContent ?? '')
const way = (name: string): HTMLElement =>
  within(section()).getByRole('button', { name })
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

// ── An answered plan ───────────────────────────────────────────────────

describe('with an answered plan', () => {
  it('says what the plan is and offers it and its answers', () => {
    answeredAgo(1)

    mount()

    expect(
      within(section()).getByRole('heading', { level: 3 }),
    ).toHaveTextContent(PLAN_PLACES.title)
    expect(section()).toHaveTextContent(PLAN_PLACES.answeredLine)
    expect(ways()).toEqual([PLAN_PLACES.seePlan, PLAN_PLACES.changeAnswers])
  })

  it('offers them for a plan out of its week too, which Home no longer shows', () => {
    answeredAgo(8)

    mount()

    expect(ways()).toEqual([PLAN_PLACES.seePlan, PLAN_PLACES.changeAnswers])
  })

  it('opens the plan for See my plan, as the Guide’s row does, and tells the funnel nothing', () => {
    answeredAgo(1)
    mount()

    tap(way(PLAN_PLACES.seePlan))

    expect(planLayerMode()).toBe('review')
    expect(sent()).toEqual([])
  })

  it('opens the questions for Change my answers, and tells the funnel nothing', () => {
    answeredAgo(1)
    mount()

    tap(way(PLAN_PLACES.changeAnswers))

    expect(planLayerMode()).toBe('change')
    expect(sent()).toEqual([])
  })
})

// ── No answered plan ───────────────────────────────────────────────────

describe('with no answered plan', () => {
  const unanswered: [string, () => void][] = [
    ['none', () => undefined],
    ['shown', () => markPlanShown('layer', ago(1))],
    ['skipped at the welcome', () => markPlanShown('welcome-skip', ago(1))],
    ['turned down', () => declinePlan(EMPTY_CHOICES, ago(1))],
  ]

  it.each(unanswered)(
    'offers the four questions for a plan that is %s',
    (_, setUp) => {
      setUp()

      mount()

      expect(section()).toHaveTextContent(PLAN_PLACES.askLine)
      expect(ways()).toEqual([PLAN_PLACES.answer])
    },
  )

  it('opens the four taps as the skipper’s Start does', () => {
    mount()

    tap(way(PLAN_PLACES.answer))

    expect(planLayerMode()).toBe('skipper')
    expect(sent()).toEqual([])
  })
})

// ── Show on Home ───────────────────────────────────────────────────────

describe('Show on Home', () => {
  it('is offered while the card is hidden and would otherwise show', () => {
    answeredAgo(1)
    hidePlanCard()

    mount()

    expect(ways()).toEqual([
      PLAN_PLACES.seePlan,
      PLAN_PLACES.changeAnswers,
      PLAN_PLACES.showOnHome,
    ])
  })

  it('is offered for a hidden ask in its week', () => {
    markPlanShown('layer', ago(1))
    hidePlanCard()

    mount()

    expect(ways()).toEqual([PLAN_PLACES.answer, PLAN_PLACES.showOnHome])
  })

  it('is not offered while the card shows', () => {
    answeredAgo(1)

    mount()

    expect(ways()).not.toContain(PLAN_PLACES.showOnHome)
  })

  it('is not offered for a hidden plan out of its week', () => {
    answeredAgo(8)
    hidePlanCard()

    mount()

    expect(ways()).not.toContain(PLAN_PLACES.showOnHome)
  })

  it('is not offered for a hidden plan whose every stop is done', () => {
    answeredAgo(1, SINGING_ONLY)
    seeFirstValue('sing')
    hidePlanCard()

    mount()

    expect(ways()).not.toContain(PLAN_PLACES.showOnHome)
  })

  it('clears the hide, on the device too, and goes with it', () => {
    answeredAgo(1)
    hidePlanCard()
    mount()

    tap(way(PLAN_PLACES.showOnHome))

    expect(planCardHidden()).toBe(false)
    expect(localStorage.getItem(PLAN_CARD_DISMISSED_KEY)).toBeNull()
    expect(ways()).not.toContain(PLAN_PLACES.showOnHome)
    expect(sent()).toEqual([])
  })

  it('brings back a card Home has drawn, at once', () => {
    answeredAgo(1)
    const home = render(() => (
      <HomePlanCard onHomeSession={() => undefined} />
    )).container
    fireEvent.click(screen.getByRole('button', { name: 'Hide your plan' }))
    expect(home).toBeEmptyDOMElement()
    mount()

    tap(way(PLAN_PLACES.showOnHome))

    // The card, with a row for each of the plan's three stops.
    expect(home.querySelectorAll('[data-kind]')).toHaveLength(3)
  })

  it('gives the focus it had to the first way in, so it stays in the section', () => {
    answeredAgo(1)
    hidePlanCard()
    mount()
    way(PLAN_PLACES.showOnHome).focus()

    tap(way(PLAN_PLACES.showOnHome))

    expect(document.activeElement).toBe(way(PLAN_PLACES.seePlan))
  })
})
