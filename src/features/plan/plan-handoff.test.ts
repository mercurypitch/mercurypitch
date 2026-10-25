// ============================================================
// planHandoff — what a finished Merc tour offers next
// ============================================================
//
// The plan's first stop not done yet, in the order Start here, Learn, Play,
// and never the room the tour just showed. It is built as Home's card builds
// the plan (the voiceprint the record kept, the menu as it stands: R19), and
// offered only while Home's card would show the plan. Go opens the stop as a
// row of that card does.
//
// The stores are the real ones, put back between cases
// (plan-choices.fixture.ts). enterStop is faked: it would move the app and the
// browser, and enter-stop.test.ts has its own cases.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as NotificationsStoreModule from '@/stores/notifications-store'
import { setPracticeScope, setUiMode } from '@/stores/settings-store'
import type { PlanView } from './build-plan'
import { buildPlan, planStops } from './build-plan'
import type * as EnterStopModule from './enter-stop'
import { enterStop } from './enter-stop'
import { answeredAgo, AUDITION, fresh, seeFirstValue, sent, SHORT_ON_TIME, TOGETHER, } from './plan-choices.fixture'
import { planHandoff, tabHandoff } from './plan-handoff'
import { PLAN_CARD_DISMISSED_KEY } from './plan-keys'
import { declinePlan, markPlanShown, markStopOpened, stopOpened, } from './plan-store'

vi.mock('./enter-stop', async (importOriginal) => ({
  ...(await importOriginal<typeof EnterStopModule>()),
  enterStop: vi.fn(),
}))

vi.mock('@/stores/notifications-store', async (importOriginal) => ({
  ...(await importOriginal<typeof NotificationsStoreModule>()),
  showNotification: vi.fn(),
}))

/** The whole menu, as a first visit has it. */
const WHOLE: PlanView = { scope: 'all', mode: 'advanced' }

// Audition: Start here Sing, Learn Hear Yourself, Play Karaoke Night.
const [START, LEARN, PLAY] = planStops(buildPlan(AUDITION))

beforeEach(() => {
  vi.clearAllMocks()
  // The funnel logs each event it is told about.
  vi.spyOn(console, 'info').mockImplementation(() => undefined)
  fresh()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('planHandoff', () => {
  it('offers the next unfinished stop and never the room just toured', () => {
    answeredAgo(1)

    // Start here is the room just toured, so Learn is next.
    expect(planHandoff('sing', WHOLE)).toMatchObject({
      title: 'Next on your plan',
      body: `Hear Yourself: ${LEARN?.title}`,
    })
    // Toured from elsewhere, Start here is still next.
    expect(planHandoff('hearYourself', WHOLE)).toMatchObject({
      body: `Sing: ${START?.title}`,
    })
  })

  it('passes a stop that is done', () => {
    answeredAgo(1)
    markStopOpened('hearYourself')

    expect(planHandoff('sing', WHOLE)?.body).toBe(
      `Karaoke Night: ${PLAY?.title}`,
    )
  })

  it('offers nothing once every other stop is done', () => {
    answeredAgo(1)
    markStopOpened('hearYourself')
    seeFirstValue('karaoke')

    expect(planHandoff('sing', WHOLE)).toBeNull()
  })

  it('offers nothing without an answered plan', () => {
    expect(planHandoff('sing', WHOLE)).toBeNull()

    markPlanShown('layer')
    expect(planHandoff('sing', WHOLE)).toBeNull()

    declinePlan(AUDITION)
    expect(planHandoff('sing', WHOLE)).toBeNull()
  })

  it('offers nothing for a plan Home no longer shows', () => {
    answeredAgo(8)
    expect(planHandoff('sing', WHOLE)).toBeNull()

    fresh()
    answeredAgo(1)
    localStorage.setItem(PLAN_CARD_DISMISSED_KEY, 'true')
    expect(planHandoff('sing', WHOLE)).toBeNull()
  })

  it('never offers a room the menu hides', () => {
    // Together: Start here Sing, Play Jam, which Simple mode hides.
    answeredAgo(1, TOGETHER)

    expect(planHandoff('sing', WHOLE)?.body).toMatch(/^Jam: /)
    expect(planHandoff('sing', { scope: 'all', mode: 'simple' })).toBeNull()
  })

  it('opens the stop as a row of Home’s card does, with no tour', () => {
    answeredAgo(1)

    planHandoff('sing', WHOLE)?.go()

    expect(sent()).toEqual(['plan_stop_learn'])
    expect(stopOpened('hearYourself')).toBe(true)
    expect(enterStop).toHaveBeenCalledExactlyOnceWith(LEARN)
  })

  it('opens Home for its session and leaves the counting to Home’s card', () => {
    // Short on time: Start here is today's session, on Home.
    answeredAgo(1, SHORT_ON_TIME)
    const [session] = planStops(buildPlan(SHORT_ON_TIME))

    planHandoff('sing', WHOLE)?.go()

    expect(sent()).toEqual([])
    expect(enterStop).toHaveBeenCalledExactlyOnceWith(session)
  })
})

describe('tabHandoff', () => {
  it('names the tab’s own room as the one toured, and reads the menu as it stands', () => {
    answeredAgo(1, TOGETHER)

    expect(tabHandoff('singing')?.body).toMatch(/^Jam: /)

    setUiMode('simple')
    expect(tabHandoff('singing')).toBeNull()
    setUiMode('advanced')
    setPracticeScope('guitar')
    // A guitar menu hides Jam too; Start here (Sing) was the room toured.
    expect(tabHandoff('singing')).toBeNull()
  })

  it('offers Start here after the tour of a tab that is no stop of the plan', () => {
    answeredAgo(1)

    expect(tabHandoff('karaoke')?.body).toBe(`Sing: ${START?.title}`)
  })
})
