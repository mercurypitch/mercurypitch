// ============================================================
// HomePlanCard — what a tap on a row does
// ============================================================
//
// A row opens its stop the way the plan layer does, and no differently: the
// funnel is told, the stop is marked opened, a menu that hides the stop's room
// is made whole (and the person told), and the stop is entered. This file holds
// what the main-path case in HomePlanCard.test.tsx (a Learn row opens and is
// ticked) leaves out: the other kinds of row, the tick that follows an opening
// and the focus it keeps, the menu made whole, and the Start here row that is
// Home's own session.
//
// The stores are the real ones, put back between cases
// (plan-choices.fixture.ts). Only the edges are faked: enterStop, which would
// move the app and the browser (enter-stop.test.ts has its own cases, with
// widenMenuFor's), the toast, and the funnel's console.

import { cleanup, fireEvent, render, within } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as NotificationsStoreModule from '@/stores/notifications-store'
import { practiceScope, setPracticeScope, setUiMode, uiMode, } from '@/stores/settings-store'
import type { PlanStop } from './build-plan'
import { buildPlan, planStops } from './build-plan'
import type * as EnterStopModule from './enter-stop'
import { enterStop } from './enter-stop'
import { HomePlanCard } from './HomePlanCard'
import { answeredAgo, AUDITION, fresh, seeFirstValue, sent, SHORT_ON_TIME, STARTING, } from './plan-choices.fixture'
import { MENU_WHOLE } from './plan-copy'
import { PLAN_OPENED_KEY } from './plan-keys'
import { stopOpened } from './plan-store'

const mocks = vi.hoisted(() => ({
  showNotification: vi.fn<(message: string) => void>(),
  /** What Home does for its own session: HomePage's, which this file never renders. */
  onHomeSession: vi.fn<() => void>(),
}))

vi.mock('./enter-stop', async (importOriginal) => ({
  ...(await importOriginal<typeof EnterStopModule>()),
  enterStop: vi.fn(),
}))

vi.mock('@/stores/notifications-store', async (importOriginal) => ({
  ...(await importOriginal<typeof NotificationsStoreModule>()),
  showNotification: mocks.showNotification,
}))

// ── Fixtures ───────────────────────────────────────────────────────────

const [START, LEARN, PLAY] = planStops(buildPlan(AUDITION))
const STOPS: Record<PlanStop['kind'], PlanStop> = {
  start: START,
  learn: LEARN,
  play: PLAY,
}

const mount = (): HTMLElement =>
  render(() => <HomePlanCard onHomeSession={mocks.onHomeSession} />).container

/** The row for a kind of stop, wherever it stands on the page. */
function row(kind: PlanStop['kind']): HTMLElement {
  const el = document.querySelector<HTMLElement>(`[data-kind="${kind}"]`)
  if (el === null) throw new Error(`No ${kind} row is on screen`)
  return el
}
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

// ── Opening a stop ─────────────────────────────────────────────────────

describe('opening a stop', () => {
  // Learn is the main-path case, in HomePlanCard.test.tsx.
  it.each(['start', 'play'] as const)(
    'the %s row tells the funnel its own kind, marks its stop opened and enters it',
    (kind) => {
      answeredAgo(1)
      mount()

      tap(row(kind))

      expect(sent()).toEqual([`plan_stop_${kind}`])
      expect(stopOpened(STOPS[kind].dest)).toBe(true)
      expect(JSON.parse(localStorage.getItem(PLAN_OPENED_KEY) ?? '[]')).toEqual(
        [STOPS[kind].dest],
      )
      expect(enterStop).toHaveBeenCalledExactlyOnceWith(STOPS[kind])
    },
  )

  it('does not tick a room that finishes on a first value just because it was opened', () => {
    answeredAgo(1)
    mount()

    tap(row('start'))

    expect(stopOpened('sing')).toBe(true)
    expect(tick(row('start'))).toBeNull()
  })

  it('keeps the row, and the focus on it, when its tick lands', () => {
    answeredAgo(1)
    mount()
    const learn = row('learn')
    learn.focus()
    expect(document.activeElement).toBe(learn)

    tap(learn)

    expect(tick(learn)).not.toBeNull()
    expect(row('learn')).toBe(learn)
    expect(document.activeElement).toBe(learn)
  })

  it('goes away when the stop that was left is opened', () => {
    seeFirstValue('sing')
    answeredAgo(1, STARTING)
    const container = mount()
    expect(row('learn').querySelector('[data-part="room"]')?.textContent).toBe(
      'Lesson 1',
    )
    expect(tick(row('start'))).not.toBeNull()

    tap(row('learn'))

    expect(enterStop).toHaveBeenCalledTimes(1)
    expect(container).toBeEmptyDOMElement()
  })
})

// ── A menu that hides the room ─────────────────────────────────────────

describe('opening a stop the menu hides', () => {
  // The menu is piano's and Start here is the Sing room: the row is on Home
  // (Start here is never dropped by the menu), and the room is not in the menu.
  it('shows every room again first, says so once, and only then enters the stop', () => {
    setPracticeScope('piano')
    answeredAgo(1)
    mount()
    const asWhenEntered: { scope: string; told: unknown[][] }[] = []
    vi.mocked(enterStop).mockImplementationOnce(() => {
      asWhenEntered.push({
        scope: practiceScope(),
        told: [...mocks.showNotification.mock.calls],
      })
    })

    tap(row('start'))

    expect(asWhenEntered).toEqual([{ scope: 'all', told: [[MENU_WHOLE]] }])
    expect(mocks.showNotification).toHaveBeenCalledTimes(1)
    expect(enterStop).toHaveBeenCalledExactlyOnceWith(START)
  })

  it('leaves a menu that shows the room as it is, and says nothing', () => {
    setPracticeScope('singing')
    answeredAgo(1)
    mount()

    tap(row('start'))

    expect(practiceScope()).toBe('singing')
    expect(mocks.showNotification).not.toHaveBeenCalled()
    expect(enterStop).toHaveBeenCalledExactlyOnceWith(START)
  })

  it('changes nothing, and says nothing, in Simple mode', () => {
    setUiMode('simple')
    answeredAgo(1)
    mount()

    tap(row('start'))

    expect([practiceScope(), uiMode()]).toEqual(['all', 'simple'])
    expect(mocks.showNotification).not.toHaveBeenCalled()
    expect(enterStop).toHaveBeenCalledExactlyOnceWith(START)
  })

  it('changes nothing, and says nothing, for a stop that is a page', () => {
    setPracticeScope('piano')
    answeredAgo(1)
    mount()

    tap(row('play'))

    expect(practiceScope()).toBe('piano')
    expect(mocks.showNotification).not.toHaveBeenCalled()
    expect(enterStop).toHaveBeenCalledExactlyOnceWith(PLAY)
  })
})

// ── Today's session, which is Home's own ───────────────────────────────

describe("the Start here row that is today's session", () => {
  // Short on time, the first stop is Home's session, and the card is on Home:
  // entering the Home tab would go nowhere. The card hands the session to Home.
  it('hands the session to Home, which starts it, and enters no stop', () => {
    answeredAgo(1, SHORT_ON_TIME)
    mount()
    expect(row('start').dataset.dest).toBe('homeSession')

    tap(row('start'))

    expect(mocks.onHomeSession).toHaveBeenCalledTimes(1)
    expect(enterStop).not.toHaveBeenCalled()
  })

  it('still tells the funnel and marks the stop opened, as any row does', () => {
    answeredAgo(1, SHORT_ON_TIME)
    mount()

    tap(row('start'))

    expect(sent()).toEqual(['plan_stop_start'])
    expect(stopOpened('homeSession')).toBe(true)
  })

  it('is the only row that asks Home for anything: another Start here row enters its stop', () => {
    answeredAgo(1)
    mount()

    tap(row('start'))

    expect(mocks.onHomeSession).not.toHaveBeenCalled()
    expect(enterStop).toHaveBeenCalledExactlyOnceWith(START)
  })
})
