// ============================================================
// HomePlanCard — the toast the X raises, and its Undo
// ============================================================
//
// The X hides the card at once (HomePlanCard.hide.test.tsx), and then a toast
// says where the plan still is, with Undo. One toast at a time: a second X
// replaces the first rather than standing above it. Undo shows the card again
// where it was, clears the hide, and puts the focus on the card's X, which is
// where it was when the card went. Neither tells the funnel anything.
//
// The stores are the real ones, and so is the toast region
// (Notifications.tsx), drawn beside Home as App draws it. The plan's
// stores are put back between cases (plan-choices.fixture.ts) and the toasts
// with them. Only the funnel's console is faked.

import { cleanup, fireEvent, render, screen, within, } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Notifications } from '@/components/Notifications'
import { resetNotifications } from '@/stores/notifications-store'
import { HomePlanCard } from './HomePlanCard'
import { ago, answeredAgo, fresh, sent } from './plan-choices.fixture'
import { PLAN_PLACES } from './plan-copy'
import { PLAN_CARD_DISMISSED_KEY } from './plan-keys'
import { markPlanShown, planCardHidden, showPlanCard } from './plan-store'

// ── Fixtures ───────────────────────────────────────────────────────────

/** Home's grid with the card in it. The app's toast region is drawn beside it, for every case. */
function mount(): { grid: HTMLElement; unmount: () => void } {
  const { container, unmount } = render(() => (
    <div data-testid="grid">
      <HomePlanCard onHomeSession={() => undefined} />
      <div data-testid="next-card" />
    </div>
  ))
  return { grid: within(container).getByTestId('grid'), unmount }
}

const hide = (): HTMLElement =>
  screen.getByRole('button', { name: 'Hide your plan' })
const toasts = (): HTMLElement[] =>
  within(screen.getByRole('region', { name: 'Notifications' })).queryAllByRole(
    'status',
  )
const undo = (): HTMLElement =>
  within(screen.getByRole('region', { name: 'Notifications' })).getByRole(
    'button',
    { name: PLAN_PLACES.undo },
  )
const tap = (el: HTMLElement): void => {
  fireEvent.click(el)
}

/** The two things the card can be: the plan, or the ask for the four taps. */
const states: [string, () => void][] = [
  ['the plan', () => answeredAgo(1)],
  ['the ask', () => markPlanShown('layer', ago(1))],
]

beforeEach(() => {
  vi.clearAllMocks()
  // The funnel logs each event it is told about.
  vi.spyOn(console, 'info').mockImplementation(() => undefined)
  fresh()
  resetNotifications()
  render(() => <Notifications />)
})

afterEach(() => {
  cleanup()
  resetNotifications()
  vi.restoreAllMocks()
})

// ── The toast ──────────────────────────────────────────────────────────

describe('the toast the X raises', () => {
  it.each(states)(
    'says where the plan is now, with Undo, when the X hides %s',
    (_, setUp) => {
      setUp()
      mount()

      tap(hide())

      expect(toasts()).toHaveLength(1)
      expect(toasts()[0]).toHaveTextContent(PLAN_PLACES.offHome)
      expect(undo()).toBeInTheDocument()
    },
  )

  it('is one toast however often the X hides the card', () => {
    answeredAgo(1)
    mount()
    tap(hide())
    showPlanCard()

    tap(hide())

    expect(toasts()).toHaveLength(1)
  })
})

// ── Undo ───────────────────────────────────────────────────────────────

describe('Undo', () => {
  it.each(states)(
    'shows %s again where it was, first in the grid',
    (_, setUp) => {
      setUp()
      const { grid } = mount()
      tap(hide())
      expect(grid.firstElementChild).toBe(screen.getByTestId('next-card'))

      tap(undo())

      expect(grid.firstElementChild).toBe(screen.getByTestId('home-plan-card'))
      expect(toasts()).toEqual([])
    },
  )

  it('clears the hide, on the device too', () => {
    answeredAgo(1)
    mount()
    tap(hide())

    tap(undo())

    expect(planCardHidden()).toBe(false)
    expect(localStorage.getItem(PLAN_CARD_DISMISSED_KEY)).toBeNull()
  })

  it.each(states)(
    'puts the focus on the X of %s, where it was when the card went',
    (_, setUp) => {
      setUp()
      mount()
      hide().focus()
      tap(hide())

      tap(undo())

      expect(document.activeElement).toBe(hide())
    },
  )

  it('tells the funnel nothing, and nor does the X', () => {
    answeredAgo(1)
    mount()
    tap(hide())

    tap(undo())

    expect(sent()).toEqual([])
  })

  it('after Home has gone, clears the hide, and the next Home shows the card', () => {
    answeredAgo(1)
    const first = mount()
    tap(hide())
    first.unmount()

    tap(undo())
    const { grid } = mount()

    expect(planCardHidden()).toBe(false)
    expect(grid.firstElementChild).toBe(screen.getByTestId('home-plan-card'))
  })
})
