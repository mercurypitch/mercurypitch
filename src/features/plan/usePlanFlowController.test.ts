// ============================================================
// usePlanFlowController: what one run of the plan does, wherever it is hosted
// ============================================================
//
// The controller is the whole rulebook of a run, so these tests drive it the
// way a host does (the screens' callbacks, then the person's taps) and read
// what a host would see: the phase, the plan, the record in storage, what
// the guide funnel was told (the ring buffer, as in Plan 0) and where the
// run exited to.
//
// Only the edges are faked: the notice (a toast), the account and billing
// calls, the one write that sends the plan to the account, and the promo the
// server features. The plan store, the plan sync, the settings store and the
// funnel are the real ones, so a finished plan is seen to go, or not, the way
// it would. The sync is loaded on demand, only for a singer with an account
// (R84), so a case that waits for it waits for the module to arrive;
// usePlanFlowController.sync.test.ts holds who loads it.
//
// The plan record, the stops opened and the menu are module signals that
// `localStorage.clear()` does not reach, so each case puts them back.
//
// Over 600 lines on purpose (TESTING.md 3.5): the controller is one rulebook
// and this is its table, in describe blocks of one to nine short cases that
// share one harness (the hosted run, the faked edges, the funnel's ring
// buffer). Splitting it would copy that harness into every part. It is under
// three times the controller's own length, not the 4x that would mean testing
// a copy.

import { createRoot } from 'solid-js'
import type { Mock } from 'vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as AuthServiceModule from '@/db/services/auth-service'
import type * as BillingServiceModule from '@/db/services/billing-service'
import type { Pricing, PricingPlan } from '@/db/services/billing-service'
import { formatPrice } from '@/db/services/billing-service'
import type * as SurveyServiceModule from '@/db/services/survey-service'
import { GUIDE_FUNNEL_STORAGE_KEY } from '@/lib/guide-funnel'
import { answerHomeSessionAsks } from '@/lib/home-session-ask'
import { applyPersistedValue } from '@/lib/storage'
import type * as NotificationsStoreModule from '@/stores/notifications-store'
import { practiceScope, setPracticeScope, setUiMode, uiMode, } from '@/stores/settings-store'
import { buildPlan } from './build-plan'
import { answeredElsewhere } from './plan-choices.fixture'
import { planCreditsLine } from './plan-credits'
import { planDeclinedEvents, planDoneEvents } from './plan-events'
import { PLAN_OPENED_KEY, PLAN_RECORD_KEY } from './plan-keys'
import type { PlanRecordV1, PlanTexts } from './plan-record'
import { markPlanShown, planRecord, savePlanAnswers, stopOpened, } from './plan-store'
import type { PlanChoices } from './questions'
import type { PlanExit, PlanFlowController, PlanFlowMode, PlanFlowOptions, } from './usePlanFlowController'
import { usePlanFlowController } from './usePlanFlowController'

const mocks = vi.hoisted(() => ({
  showNotification: vi.fn(),
  signedIn: false,
  upgraded: vi.fn(() => false),
  submitPlanResponse: vi.fn(async () => {}),
  fetchBillingMe: vi.fn(),
  fetchPricing: vi.fn(),
  loadFeaturedPromo: vi.fn(async () => {}),
  promo: null as { credits: number } | null,
}))

vi.mock('@/stores/notifications-store', async (importOriginal) => ({
  ...(await importOriginal<typeof NotificationsStoreModule>()),
  showNotification: mocks.showNotification,
}))

vi.mock('@/db/services/auth-service', async (importOriginal) => ({
  ...(await importOriginal<typeof AuthServiceModule>()),
  accountHeld: (): boolean => mocks.signedIn,
  hasUpgradedAccount: (): boolean => mocks.upgraded(),
}))

vi.mock('@/db/services/survey-service', async (importOriginal) => ({
  ...(await importOriginal<typeof SurveyServiceModule>()),
  submitPlanResponse: mocks.submitPlanResponse,
}))

vi.mock('@/db/services/billing-service', async (importOriginal) => ({
  ...(await importOriginal<typeof BillingServiceModule>()),
  fetchBillingMe: mocks.fetchBillingMe,
  fetchPricing: mocks.fetchPricing,
}))

vi.mock('@/stores/promo-store', () => ({
  offeredPromo: () => mocks.promo,
  loadFeaturedPromo: mocks.loadFeaturedPromo,
}))

// ── Fixtures ───────────────────────────────────────────────────────────

/** Singing, for an audition: Start here Sing, Learn Hear Yourself, Play Karaoke Night, and the menu switch. */
const AUDITION: PlanChoices = {
  q1: 'singing',
  q2: 'audition',
  q3: ['progress', 'tune'],
  q4: ['teacher'],
}
/** A guitar player: Guitar, and Guitar Night, which is not Karaoke Night. */
const GUITAR: PlanChoices = {
  q1: 'guitar',
  q2: 'song',
  q3: ['time'],
  q4: ['app'],
}
/** Everything, with friends, short of time: Start here is today's session, Home's own. */
const HABIT: PlanChoices = {
  q1: 'everything',
  q2: 'together',
  q3: ['time'],
  q4: ['starting'],
}
const NO_TEXTS: PlanTexts = { q3other: '', q4app: '' }
const NO_PILLS: ReadonlyMap<string, DOMRect> = new Map()

const NOTICE =
  'Your menu shows every room again. You can change it in Settings, App Mode.'

/** What the guide funnel was told since the case began, in order. */
function sent(): string[] {
  const raw = localStorage.getItem(GUIDE_FUNNEL_STORAGE_KEY) ?? '[]'
  return (JSON.parse(raw) as { event: string }[]).map((entry) => entry.event)
}

interface Exit {
  exit: PlanExit
  /** The menu's scope at the moment the run handed over. */
  scope: string
}

const disposers: (() => void)[] = []

/** A run, hosted: its exits are collected with the menu as it stood on each. */
function start(
  mode: PlanFlowMode,
  more: Partial<PlanFlowOptions> = {},
): { c: PlanFlowController; exits: Exit[] } {
  const exits: Exit[] = []
  let c!: PlanFlowController
  createRoot((dispose) => {
    disposers.push(dispose)
    c = usePlanFlowController({
      mode,
      onExit: (exit) => exits.push({ exit, scope: practiceScope() }),
      ...more,
    })
  })
  return { c, exits }
}

const settle = (): Promise<void> => new Promise((r) => setTimeout(r, 0))

/**
 * Home, answering asks for today's session until the case ends. An ask an
 * earlier case left waiting is drained first, so only this case's count.
 */
async function homeAnswering(): Promise<Mock<() => void>> {
  const answer = vi.fn<() => void>()
  disposers.push(answerHomeSessionAsks(answer))
  await Promise.resolve()
  answer.mockClear()
  return answer
}

/** A pack of credits as the server lists it. */
function pack(amount: number | null, purchasable = true): PricingPlan {
  return {
    id: `pack-${amount}`,
    kind: 'pack',
    label: 'Pack',
    description: null,
    unit: null,
    amount,
    currency: 'usd',
    credits: 10,
    badge: null,
    purchasable,
  }
}

const pricing = (packs: PricingPlan[]): Pricing => ({
  currency: 'usd',
  tiers: [],
  packs,
  stripeConfigured: true,
})

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  applyPersistedValue(PLAN_RECORD_KEY, 'null', { persist: false })
  applyPersistedValue(PLAN_OPENED_KEY, '[]', { persist: false })
  setPracticeScope('all')
  setUiMode('advanced')
  mocks.signedIn = false
  mocks.upgraded.mockReset()
  mocks.submitPlanResponse.mockReset()
  mocks.promo = null
  mocks.fetchBillingMe.mockResolvedValue(null)
  mocks.fetchPricing.mockResolvedValue(null)
  vi.spyOn(console, 'info').mockImplementation(() => undefined)
})

afterEach(() => {
  for (const dispose of disposers.splice(0)) dispose()
  vi.restoreAllMocks()
})

// ── How a run begins ───────────────────────────────────────────────────

describe('when a run begins', () => {
  it.each<[PlanFlowMode, string, string]>([
    ['new', 'first-light', 'plan_shown_new'],
    ['existing', 'layer', 'plan_shown_existing'],
    ['skipper', 'layer', 'plan_shown_skipper'],
  ])(
    'records the plan as shown the way %s opens it, and says so',
    (mode, via, event) => {
      const { c } = start(mode)

      expect(planRecord()).toMatchObject({ status: 'shown', via })
      expect(sent()).toEqual([event])
      expect(c.phase()).toBe('questions')
      expect(c.plan()).toBeNull()
    },
  )

  it('counts a new visitor once: a run that opens on the shown record says nothing', () => {
    // Arrange: the questions were shown, then the beat was mounted again
    // (behind the auth modal, or after a Google resume).
    start('new')
    expect(sent()).toEqual(['plan_shown_new'])

    // Act
    const { c } = start('new')

    // Assert
    expect(sent()).toEqual(['plan_shown_new'])
    expect(planRecord()).toMatchObject({ status: 'shown', via: 'first-light' })
    expect(c.phase()).toBe('questions')
  })

  it('says nothing for a new visitor whose stored record cannot be read: nothing was written', () => {
    // Arrange: a newer client's record, which this one reads as no plan and
    // never writes over.
    localStorage.setItem(PLAN_RECORD_KEY, JSON.stringify({ v: 99 }))

    // Act
    start('new')

    // Assert
    expect(planRecord()).toBeNull()
    expect(sent()).toEqual([])
  })

  it('says skipper every time it opens, whatever the record: the skip at the welcome leaves one', () => {
    // Arrange: somebody who skipped the intro was marked as shown.
    markPlanShown('welcome-skip')

    // Act: Home or the Guide opens the four taps, twice.
    start('skipper')
    start('skipper')

    // Assert: each opening is a tap, and each is counted.
    expect(sent()).toEqual(['plan_shown_skipper', 'plan_shown_skipper'])
  })

  it('counts an existing user once, as a new visitor is: a run that opens on the shown record says nothing', () => {
    // Arrange: the takeover was shown, then mounted again (behind the auth
    // modal, after a Google resume, or by a reload in the middle of it).
    start('existing')
    expect(sent()).toEqual(['plan_shown_existing'])

    // Act
    const { c } = start('existing')

    // Assert
    expect(sent()).toEqual(['plan_shown_existing'])
    expect(planRecord()).toMatchObject({ status: 'shown', via: 'layer' })
    expect(c.phase()).toBe('questions')
  })

  it('says nothing for an existing user who already has a record: only the run that writes the first one counts', () => {
    // Arrange: somebody who skipped the intro was marked as shown.
    markPlanShown('welcome-skip')

    // Act
    start('existing')

    // Assert
    expect(sent()).toEqual([])
  })

  it('says nothing for an existing user whose stored record cannot be read: nothing was written', () => {
    // Arrange: a newer client's record, which this one reads as no plan and
    // never writes over.
    localStorage.setItem(PLAN_RECORD_KEY, JSON.stringify({ v: 99 }))

    // Act
    start('existing')

    // Assert
    expect(planRecord()).toBeNull()
    expect(sent()).toEqual([])
  })

  it('opens a review on the plan, built from the answers stored, and sends nothing', () => {
    // Arrange: an answered plan, kept with the finding it was led by.
    savePlanAnswers(AUDITION, NO_TEXTS, {
      room: 'exercises',
      detail: 'Long Note',
    })
    const before = planRecord()

    // Act
    const { c } = start('review')

    // Assert
    expect(c.phase()).toBe('plan')
    expect(c.choices()).toEqual(AUDITION)
    expect(c.plan()).toEqual(
      buildPlan(AUDITION, {
        voiceprint: { room: 'exercises', detail: 'Long Note' },
      }),
    )
    expect(sent()).toEqual([])
    expect(planRecord()).toEqual(before)
  })

  it('opens a review built for the menu as it stands, which has no switch to offer a menu already narrowed', () => {
    // Arrange: an answered plan whose answers offer the switch, and a menu
    // already narrowed to what that switch would narrow it to.
    savePlanAnswers(AUDITION, NO_TEXTS)
    const offer = buildPlan(AUDITION).scope
    expect(offer).not.toBeNull()
    setPracticeScope(offer!.scope)

    // Act
    const { c } = start('review')

    // Assert
    expect(c.plan()?.scope).toBeNull()
  })

  it('opens a review that has no answered plan on the questions', () => {
    const { c } = start('review')

    expect(c.phase()).toBe('questions')
    expect(c.plan()).toBeNull()
    expect(sent()).toEqual([])
    expect(planRecord()).toBeNull()
  })

  it('opens the questions on the answers last given, with the lines typed under them', () => {
    // Arrange
    const typed: PlanChoices = { ...AUDITION, q3: ['other'], q4: ['app'] }
    savePlanAnswers(typed, { q3other: 'My neighbours', q4app: 'Smule' })

    // Act
    const { c } = start('review')
    c.changeAnswers()

    // Assert
    expect(c.phase()).toBe('questions')
    expect(c.choices()).toEqual(typed)
    expect(c.texts()).toEqual({ q3other: 'My neighbours', q4app: 'Smule' })
  })
})

// ── The answers ────────────────────────────────────────────────────────

describe('when the answers are in', () => {
  it('saves the answers, builds the plan from them and moves to it', () => {
    const { c } = start('new')
    const rect = { left: 1, top: 2, width: 3, height: 4 } as DOMRect
    const pills = new Map([['A teacher', rect]])
    const texts: PlanTexts = { q3other: 'My hands get tired', q4app: '' }

    c.done(AUDITION, texts, pills)

    expect(planRecord()).toMatchObject({
      status: 'answered',
      via: 'first-light',
      choices: AUDITION,
    })
    expect(c.phase()).toBe('plan')
    expect(c.choices()).toEqual(AUDITION)
    expect(c.texts()).toEqual(texts)
    expect(c.plan()).toEqual(buildPlan(AUDITION))
    expect(c.pills()).toBe(pills)
  })

  it('sends the answers once, then plan_done', () => {
    const { c } = start('new')

    c.done(AUDITION, NO_TEXTS, NO_PILLS)

    expect(sent()).toEqual(['plan_shown_new', ...planDoneEvents(AUDITION)])
  })

  it('sends the answers once, even after Change my answers and Done again', () => {
    // Arrange
    const { c } = start('new')
    c.done(AUDITION, NO_TEXTS, NO_PILLS)

    // Act
    c.changeAnswers()
    c.done({ ...AUDITION, q2: 'song' }, NO_TEXTS, NO_PILLS)

    // Assert: one plan_done, and every answer as it was first given.
    expect(sent().filter((event) => event === 'plan_done')).toHaveLength(1)
    expect(sent()).toEqual(['plan_shown_new', ...planDoneEvents(AUDITION)])
    // The plan itself follows the answers now given.
    expect(c.plan()).toEqual(buildPlan({ ...AUDITION, q2: 'song' }))
    expect(planRecord()?.choices.q2).toBe('song')
  })

  it('sends nothing for the answers of a review', () => {
    // Arrange
    savePlanAnswers(AUDITION, NO_TEXTS)
    const { c } = start('review')

    // Act
    c.changeAnswers()
    c.done({ ...AUDITION, q2: 'song' }, NO_TEXTS, NO_PILLS)

    // Assert: the record changed, and nobody was told twice.
    expect(planRecord()?.choices.q2).toBe('song')
    expect(c.phase()).toBe('plan')
    expect(sent()).toEqual([])
  })

  it('keeps the finding a reviewed plan was led by, unless the host has a live one', () => {
    // Arrange
    savePlanAnswers(AUDITION, NO_TEXTS, {
      room: 'exercises',
      detail: 'Long Note',
    })
    const { c } = start('review')

    // Act
    c.changeAnswers()
    c.done({ ...AUDITION, q4: [] }, NO_TEXTS, NO_PILLS)

    // Assert
    expect(planRecord()?.voiceprint).toEqual({
      room: 'exercises',
      detail: 'Long Note',
    })
  })

  it('takes the voiceprint from the host, as it stands when the answers are in', () => {
    // Arrange: a finding the host learns of after the run has begun.
    let found: { room: 'ascent'; detail: string } | null = null
    const { c } = start('new', { voiceprint: () => found })
    found = { room: 'ascent', detail: 'Range week' }

    // Act
    c.done({ q1: 'singing', q2: null, q3: [], q4: [] }, NO_TEXTS, NO_PILLS)

    // Assert
    expect(planRecord()?.voiceprint).toEqual({
      room: 'ascent',
      detail: 'Range week',
    })
    expect(c.plan()?.start.dest).toBe('ascent')
  })

  it('holds the pose the screens ask for', () => {
    const { c } = start('new')

    c.setMercState('listen')

    expect(c.mercState()).toBe('listen')
  })
})

describe('when the answers are in and the singer holds an account', () => {
  it('sends the plan to the account at once, answered and not yet marked', async () => {
    // The record the sync sees, at the moment it writes.
    const seen: (PlanRecordV1 | null)[] = []
    mocks.upgraded.mockReturnValue(true)
    mocks.submitPlanResponse.mockImplementation(async () => {
      seen.push(planRecord())
    })
    const { c } = start('new')

    c.done(AUDITION, NO_TEXTS, NO_PILLS)
    // The sync is loaded on demand (R84), which takes more than a turn.
    await vi.waitFor(() => {
      expect(planRecord()?.syncedAt).toBeDefined()
    })

    const at = planRecord()?.at
    expect(mocks.submitPlanResponse).toHaveBeenCalledTimes(1)
    expect(mocks.submitPlanResponse).toHaveBeenCalledWith({
      kind: 'plan',
      v: 1,
      status: 'answered',
      choices: AUDITION,
      texts: NO_TEXTS,
      at,
    })
    expect(seen).toHaveLength(1)
    expect(seen[0]).toMatchObject({ status: 'answered', choices: AUDITION, at })
    expect(seen[0]?.syncedAt).toBeUndefined()
    // Once the write has landed the record says so.
    expect(planRecord()?.syncedAt).toBeDefined()
  })

  it('sends nothing for a singer with no account', async () => {
    const { c } = start('new')

    c.done(AUDITION, NO_TEXTS, NO_PILLS)
    await settle()

    expect(mocks.submitPlanResponse).not.toHaveBeenCalled()
    expect(planRecord()?.syncedAt).toBeUndefined()
  })

  it.each<[string, () => void]>([
    [
      'the write fails',
      () => {
        mocks.upgraded.mockReturnValue(true)
        mocks.submitPlanResponse.mockRejectedValue(new Error('offline'))
      },
    ],
    [
      'the account check throws',
      () => {
        mocks.upgraded.mockImplementation(() => {
          throw new Error('storage is gone')
        })
      },
    ],
  ])('still reaches the plan when %s', async (_, breakIt) => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    breakIt()
    const { c } = start('new')

    c.done(AUDITION, NO_TEXTS, NO_PILLS)
    // The gate, or the sync it loads on demand (R84), says it went wrong.
    await vi.waitFor(() => {
      expect(console.warn).toHaveBeenCalled()
    })

    expect(c.phase()).toBe('plan')
    expect(planRecord()).toMatchObject({
      status: 'answered',
      choices: AUDITION,
    })
    expect(planRecord()?.syncedAt).toBeUndefined()
    // The gate (sync-for-account.ts) contained it and said so: nothing was
    // left to reject unheard.
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('[plan-sync]'),
      expect.any(Error),
    )
  })
})

// ── Not now ────────────────────────────────────────────────────────────

// ── A plan answered on another device ──────────────────────────────────

describe('when an answered plan comes from the account', () => {
  it('opens on it when it is there as the run begins, as a review does, and tells nobody', () => {
    // Arrange: the pull landed after First Light read the plan as due.
    answeredElsewhere(HABIT)

    // Act
    const { c } = start('new')

    // Assert
    expect(c.phase()).toBe('plan')
    expect(c.plan()).toEqual(buildPlan(HABIT))
    expect(sent()).toEqual([])
  })

  it('moves to it when it lands before the person starts answering, and tells nobody of the answers', () => {
    // Arrange
    const { c } = start('new')
    const told = sent()

    // Act: the pull after a sign-in lands while the first question is up.
    answeredElsewhere(HABIT)

    // Assert
    expect(c.phase()).toBe('plan')
    expect(c.choices()).toEqual(HABIT)
    expect(c.plan()).toEqual(buildPlan(HABIT))
    expect(sent()).toEqual(told)
  })

  it('leaves the questions to a person who has started answering, whose answers then replace it', () => {
    // Arrange
    const { c } = start('new')
    c.answering()

    // Act
    answeredElsewhere(HABIT)

    // Assert
    expect(c.phase()).toBe('questions')
    c.done(AUDITION, NO_TEXTS, NO_PILLS)
    expect(c.plan()).toEqual(buildPlan(AUDITION))
    expect(planRecord()?.choices).toEqual(AUDITION)
    expect(sent().at(-1)).toBe('plan_done')
  })
})

describe('when the person says Not now on a question', () => {
  it('sends plan_declined with its question and goes Home', () => {
    // Arrange
    const { c, exits } = start('new')
    const soFar: PlanChoices = { ...AUDITION, q3: [], q4: [] }

    // Act
    c.decline('q3', soFar)

    // Assert
    expect(sent()).toEqual([
      'plan_shown_new',
      ...planDeclinedEvents(soFar, 'q3'),
    ])
    expect(sent().at(-1)).toBe('plan_declined_q3')
    expect(planRecord()).toMatchObject({
      status: 'declined',
      via: 'first-light',
    })
    expect(exits.map((e) => e.exit)).toEqual([{ to: 'home' }])
  })

  it.each<PlanFlowMode>(['existing', 'skipper'])(
    'does the same in the %s mode',
    (mode) => {
      const { c, exits } = start(mode)

      c.decline('q1', { q1: null, q2: null, q3: [], q4: [] })

      expect(planRecord()?.status).toBe('declined')
      expect(sent().at(-1)).toBe('plan_declined_q1')
      expect(exits.map((e) => e.exit)).toEqual([{ to: 'home' }])
    },
  )

  it('keeps an answered plan when Not now comes from Change my answers', () => {
    // Arrange: a review, changing the answers.
    savePlanAnswers(AUDITION, NO_TEXTS)
    const answered = planRecord()
    const { c, exits } = start('review')
    c.changeAnswers()

    // Act
    c.decline('q2', { ...AUDITION, q2: null, q3: [], q4: [] })

    // Assert: back on the plan as it was, with nothing sent and nowhere left.
    expect(c.phase()).toBe('plan')
    expect(planRecord()).toEqual(answered)
    expect(exits).toEqual([])
    expect(sent()).toEqual([])
  })

  it('never turns an answered plan into a declined one, and tells nobody the answers twice', () => {
    // Arrange: the answers were given, then changed, then turned down.
    const { c, exits } = start('new')
    c.done(AUDITION, NO_TEXTS, NO_PILLS)
    const answered = planRecord()
    c.changeAnswers()

    // Act
    c.decline('q3', { ...AUDITION, q3: [], q4: [] })

    // Assert
    expect(planRecord()).toEqual(answered)
    expect(sent().filter((event) => event === 'plan_q1_singing')).toHaveLength(
      1,
    )
    expect(sent().at(-1)).toBe('plan_declined_q3')
    expect(exits.map((e) => e.exit)).toEqual([{ to: 'home' }])
  })
})

// ── The menu switch ────────────────────────────────────────────────────

describe('the menu switch', () => {
  it("narrows the menu to the plan's instrument, and says so once", () => {
    // Arrange
    const { c } = start('new')
    c.done(AUDITION, NO_TEXTS, NO_PILLS)

    // Act
    c.setScope(true)

    // Assert
    expect(practiceScope()).toBe('singing')
    expect(c.scopeOn()).toBe(true)
    expect(sent().filter((event) => event === 'scope_offer_accept')).toEqual([
      'scope_offer_accept',
    ])
  })

  it('puts the menu back the way it was when the switch goes off', () => {
    // Arrange: a menu that is neither the whole app nor the plan's.
    setPracticeScope('piano')
    const { c } = start('new')
    c.done(AUDITION, NO_TEXTS, NO_PILLS)

    // Act
    c.setScope(true)
    expect(practiceScope()).toBe('singing')
    c.setScope(false)

    // Assert
    expect(practiceScope()).toBe('piano')
    expect(c.scopeOn()).toBe(false)
  })

  it('counts the switch once, however often it is flipped', () => {
    const { c } = start('new')
    c.done(AUDITION, NO_TEXTS, NO_PILLS)

    c.setScope(true)
    c.setScope(false)
    c.setScope(true)

    expect(
      sent().filter((event) => event === 'scope_offer_accept'),
    ).toHaveLength(1)
    expect(practiceScope()).toBe('singing')
  })

  it('remembers the menu from before the first turn-on, however often the switch is turned on', () => {
    // Arrange: a menu that is neither the whole app nor the plan's.
    setPracticeScope('piano')
    const { c } = start('new')
    c.done(AUDITION, NO_TEXTS, NO_PILLS)

    // Act: a second "on" must not take the narrowed menu for the old one.
    c.setScope(true)
    c.setScope(true)
    c.setScope(false)

    // Assert
    expect(practiceScope()).toBe('piano')
  })

  it('leaves a menu alone that the switch never changed', () => {
    // Arrange: the person narrowed their menu themselves, in Settings.
    setPracticeScope('piano')
    const { c } = start('new')
    c.done(AUDITION, NO_TEXTS, NO_PILLS)

    // Act: off while it is off
    c.setScope(false)

    // Assert
    expect(practiceScope()).toBe('piano')
    expect(c.scopeOn()).toBe(false)
  })

  it('does nothing when the plan offers no switch', () => {
    // Arrange: the menu is already singing's, so nothing is offered.
    setPracticeScope('singing')
    const { c } = start('new')
    c.done(AUDITION, NO_TEXTS, NO_PILLS)
    expect(c.plan()?.scope).toBeNull()

    // Act
    c.setScope(true)

    // Assert
    expect(practiceScope()).toBe('singing')
    expect(c.scopeOn()).toBe(false)
    expect(sent()).not.toContain('scope_offer_accept')
  })

  it('keeps offering the switch, on, when the answers are changed with it on', () => {
    // Arrange: the switch is on, so the menu is already singing's.
    setPracticeScope('piano')
    const { c } = start('new')
    c.done(AUDITION, NO_TEXTS, NO_PILLS)
    c.setScope(true)

    // Act
    c.changeAnswers()
    c.done({ ...AUDITION, q4: [] }, NO_TEXTS, NO_PILLS)

    // Assert: the plan is built for the menu the person had, so the switch
    // is still there to turn off, and it is on.
    expect(c.plan()?.scope).toEqual({
      scope: 'singing',
      label: 'Show only singing in the menu',
    })
    expect(c.scopeOn()).toBe(true)
    c.setScope(false)
    expect(practiceScope()).toBe('piano')
  })
})

// ── The ways on ────────────────────────────────────────────────────────

describe('opening a stop', () => {
  it('says which card it was, remembers it and exits to the stop', () => {
    // Arrange
    const { c, exits } = start('new')
    c.done(AUDITION, NO_TEXTS, NO_PILLS)
    const learn = c.plan()?.learn
    if (learn === null || learn === undefined) throw new Error('a Learn card')

    // Act
    c.openStop(learn)

    // Assert
    expect(sent().at(-1)).toBe('plan_stop_learn')
    expect(stopOpened(learn.dest)).toBe(true)
    expect(exits.map((e) => e.exit)).toEqual([
      { to: 'stop', stop: learn, tour: false },
    ])
  })

  it('shows every room again before opening a stop the menu hides', () => {
    // Arrange: the menu is piano's, and Start here is the Sing room.
    setPracticeScope('piano')
    const { c, exits } = start('new')
    c.done(AUDITION, NO_TEXTS, NO_PILLS)
    const sing = c.plan()?.start
    if (sing === undefined) throw new Error('a Start here card')
    expect(sing.dest).toBe('sing')

    // Act
    c.openStop(sing)

    // Assert: the menu was whole by the time the host heard.
    expect(exits).toEqual([
      { exit: { to: 'stop', stop: sing, tour: false }, scope: 'all' },
    ])
    expect(practiceScope()).toBe('all')
    expect(mocks.showNotification).toHaveBeenCalledOnce()
    expect(mocks.showNotification.mock.calls[0][0]).toBe(NOTICE)
  })

  it('leaves the menu alone when it shows the stop', () => {
    // Arrange: singing's menu has the Sing room.
    setPracticeScope('singing')
    const { c, exits } = start('new')
    c.done(AUDITION, NO_TEXTS, NO_PILLS)

    // Act
    c.openStop(c.plan()!.start)

    // Assert
    expect(practiceScope()).toBe('singing')
    expect(mocks.showNotification).not.toHaveBeenCalled()
    expect(exits).toHaveLength(1)
  })

  it('does not touch the menu for a stop that is a page', () => {
    // Arrange: Karaoke Night is a page of its own, whatever the menu shows.
    setPracticeScope('piano')
    const { c, exits } = start('new')
    c.done(AUDITION, NO_TEXTS, NO_PILLS)
    const play = c.plan()?.play
    if (play === null || play === undefined) throw new Error('a Play card')
    expect(play.dest).toBe('karaokeNight')

    // Act
    c.openStop(play)

    // Assert
    expect(practiceScope()).toBe('piano')
    expect(mocks.showNotification).not.toHaveBeenCalled()
    expect(exits.map((e) => e.exit)).toEqual([
      { to: 'stop', stop: play, tour: false },
    ])
    expect(sent().at(-1)).toBe('plan_stop_play')
  })

  it('does not blame the scope for a room that only Simple mode hides', () => {
    // Arrange: showing every room would not bring Jam back in Simple mode,
    // so there is nothing to widen, and nothing to say.
    setUiMode('simple')
    const { c } = start('new')
    c.done(AUDITION, NO_TEXTS, NO_PILLS)
    const jam = {
      kind: 'play',
      dest: 'jam',
      title: '',
      why: '',
      chips: [],
    } as const

    // Act
    c.openStop({ ...jam, chips: [] })

    // Assert
    expect(mocks.showNotification).not.toHaveBeenCalled()
    expect(practiceScope()).toBe('all')
    expect(uiMode()).toBe('simple')
  })

  it("asks Home for today's session when the stop is Home's own, which the host only switches to", async () => {
    // Arrange
    const home = await homeAnswering()
    const { c, exits } = start('new')
    c.done(HABIT, NO_TEXTS, NO_PILLS)
    const today = c.plan()?.start
    if (today === undefined) throw new Error('a Start here card')
    expect(today.dest).toBe('homeSession')

    // Act
    c.openStop(today)
    await Promise.resolve()

    // Assert
    expect(home).toHaveBeenCalledOnce()
    expect(exits.map((e) => e.exit)).toEqual([
      { to: 'stop', stop: today, tour: false },
    ])
  })

  it('asks Home nothing for a stop that is not its own', async () => {
    // Arrange
    const home = await homeAnswering()
    const { c } = start('new')
    c.done(HABIT, NO_TEXTS, NO_PILLS)
    const learn = c.plan()?.learn
    if (learn === null || learn === undefined) throw new Error('a Learn card')

    // Act
    c.openStop(learn)
    await Promise.resolve()

    // Assert
    expect(home).not.toHaveBeenCalled()
  })
})

describe('Show me around', () => {
  it('goes to Start here with the tour, until the tour is built', () => {
    const { c, exits } = start('new')
    c.done(AUDITION, NO_TEXTS, NO_PILLS)
    const here = c.plan()?.start
    if (here === undefined) throw new Error('a Start here card')

    c.showMeAround()

    expect(exits.map((e) => e.exit)).toEqual([
      { to: 'stop', stop: here, tour: true },
    ])
    // It starts the stop as the card does: counted, and marked opened.
    expect(sent().at(-1)).toBe('plan_stop_start')
    expect(stopOpened(here.dest)).toBe(true)
  })

  it("asks Home nothing when Start here is today's session: the room's tour leads", async () => {
    // Arrange
    const home = await homeAnswering()
    const { c, exits } = start('new')
    c.done(HABIT, NO_TEXTS, NO_PILLS)
    const today = c.plan()?.start
    if (today === undefined) throw new Error('a Start here card')

    // Act
    c.showMeAround()
    await Promise.resolve()

    // Assert
    expect(home).not.toHaveBeenCalled()
    expect(exits.map((e) => e.exit)).toEqual([
      { to: 'stop', stop: today, tour: true },
    ])
  })

  it('shows every room again first when the menu hides Start here', () => {
    // Arrange
    setPracticeScope('piano')
    const { c, exits } = start('new')
    c.done(AUDITION, NO_TEXTS, NO_PILLS)

    // Act
    c.showMeAround()

    // Assert
    expect(exits[0].scope).toBe('all')
    expect(mocks.showNotification.mock.calls[0][0]).toBe(NOTICE)
  })
})

describe('See every room', () => {
  it('says so and exits to the rooms', () => {
    const { c, exits } = start('new')
    c.done(AUDITION, NO_TEXTS, NO_PILLS)

    c.seeEveryRoom()

    expect(sent().at(-1)).toBe('plan_rooms')
    expect(exits.map((e) => e.exit)).toEqual([{ to: 'rooms' }])
  })
})

describe('Not now on the plan', () => {
  it('says so, keeps the answers, and exits Home', () => {
    const { c, exits } = start('new')
    c.done(AUDITION, NO_TEXTS, NO_PILLS)

    c.notNow()

    expect(sent().at(-1)).toBe('plan_skipped_plan')
    expect(planRecord()?.status).toBe('answered')
    expect(exits.map((e) => e.exit)).toEqual([{ to: 'home' }])
  })
})

// ── The credits line ───────────────────────────────────────────────────

describe('the credits line on the plan', () => {
  it('names the launch gift to a visitor with no account, from the promo on offer', () => {
    // Arrange
    mocks.promo = { credits: 5 }
    const { c } = start('new')

    // Act
    c.done(AUDITION, NO_TEXTS, NO_PILLS)

    // Assert
    expect(c.credits()).toEqual(
      planCreditsLine({
        canTakePayment: true,
        signedIn: false,
        gift: { credits: 5 },
        balance: null,
        cheapestPack: null,
      }),
    )
    expect(c.credits()?.kind).toBe('gift')
    expect(mocks.fetchBillingMe).not.toHaveBeenCalled()
    expect(mocks.loadFeaturedPromo).toHaveBeenCalled()
  })

  it("takes the gift from the host when it has its own (First Light's refused microphone has none)", () => {
    // Arrange
    mocks.promo = { credits: 5 }
    const { c } = start('new', { gift: () => null })

    // Act
    c.done(AUDITION, NO_TEXTS, NO_PILLS)

    // Assert
    expect(c.credits()).toBeNull()
  })

  it("names the host's gift, not the promo store's, and leaves loading the promo to the host", () => {
    // Arrange: the store holds one gift, the host another.
    mocks.promo = { credits: 5 }
    const { c } = start('new', { gift: () => ({ credits: 3 }) })

    // Act
    c.done(AUDITION, NO_TEXTS, NO_PILLS)

    // Assert
    expect(c.credits()).toEqual(
      planCreditsLine({
        canTakePayment: true,
        signedIn: false,
        gift: { credits: 3 },
        balance: null,
        cheapestPack: null,
      }),
    )
    expect(mocks.loadFeaturedPromo).not.toHaveBeenCalled()
  })

  it('asks for no promo at all when the host has none to give', () => {
    const { c } = start('new', { gift: () => null })

    c.done(AUDITION, NO_TEXTS, NO_PILLS)

    expect(mocks.loadFeaturedPromo).not.toHaveBeenCalled()
  })

  it('says nothing when no stop is Karaoke Night, and asks nobody anything', async () => {
    // Arrange
    mocks.signedIn = true
    mocks.promo = { credits: 5 }
    const { c } = start('new')

    // Act
    c.done(GUITAR, NO_TEXTS, NO_PILLS)
    await settle()

    // Assert
    expect(c.plan()?.play?.dest).toBe('guitarNight')
    expect(c.credits()).toBeNull()
    expect(mocks.fetchBillingMe).not.toHaveBeenCalled()
    expect(mocks.fetchPricing).not.toHaveBeenCalled()
  })

  it('says what a signed-in singer holds', async () => {
    // Arrange
    mocks.signedIn = true
    mocks.fetchBillingMe.mockResolvedValue({
      creditBalance: 3,
      entitlements: [],
      stripeConfigured: true,
    })
    const { c } = start('new')

    // Act
    c.done(AUDITION, NO_TEXTS, NO_PILLS)

    // Assert
    await vi.waitFor(() => expect(c.credits()?.kind).toBe('balance'))
    expect(c.credits()).toEqual(
      planCreditsLine({
        canTakePayment: true,
        signedIn: true,
        gift: null,
        balance: 3,
        cheapestPack: null,
      }),
    )
    expect(mocks.fetchPricing).not.toHaveBeenCalled()
  })

  it('names the cheapest pack on sale to a signed-in singer with none left', async () => {
    // Arrange: the dearer pack, one not on sale, one with no price, the cheap one.
    mocks.signedIn = true
    mocks.fetchBillingMe.mockResolvedValue({
      creditBalance: 0,
      entitlements: [],
      stripeConfigured: true,
    })
    mocks.fetchPricing.mockResolvedValue(
      pricing([pack(1900), pack(100, false), pack(null), pack(900), pack(0)]),
    )
    const { c } = start('new')

    // Act
    c.done(AUDITION, NO_TEXTS, NO_PILLS)

    // Assert
    await vi.waitFor(() => expect(c.credits()?.kind).toBe('price'))
    expect(c.credits()?.title).toBe(`Credits from ${formatPrice(900, 'usd')}`)
  })

  it('keeps the balance the newer ask found when an older ask answers last', async () => {
    // Arrange: two asks in flight. The first goes out for a Karaoke Night
    // plan, the answers are changed to a plan with none, and changed back:
    // the second ask is the one the screen is waiting on.
    mocks.signedIn = true
    const reply = (balance: number) => ({
      creditBalance: balance,
      entitlements: [],
      stripeConfigured: true,
    })
    let answerOlder: (value: ReturnType<typeof reply>) => void = () => {}
    let answerNewer: (value: ReturnType<typeof reply>) => void = () => {}
    mocks.fetchBillingMe
      .mockReturnValueOnce(new Promise((r) => (answerOlder = r)))
      .mockReturnValueOnce(new Promise((r) => (answerNewer = r)))
    const { c } = start('new')
    c.done(AUDITION, NO_TEXTS, NO_PILLS)
    c.changeAnswers()
    c.done(GUITAR, NO_TEXTS, NO_PILLS)
    c.changeAnswers()
    c.done(AUDITION, NO_TEXTS, NO_PILLS)
    expect(mocks.fetchBillingMe).toHaveBeenCalledTimes(2)

    // Act: the newer answers first, then the older one, late
    answerNewer(reply(7))
    await vi.waitFor(() => expect(c.credits()?.kind).toBe('balance'))
    const shown = c.credits()
    answerOlder(reply(3))
    await settle()

    // Assert
    expect(shown?.title).toContain('7')
    expect(c.credits()).toEqual(shown)
  })

  it('says nothing when the prices cannot be had', async () => {
    // Arrange
    mocks.signedIn = true
    mocks.fetchBillingMe.mockResolvedValue({
      creditBalance: 0,
      entitlements: [],
      stripeConfigured: true,
    })
    mocks.fetchPricing.mockRejectedValue(new Error('Failed to load pricing'))
    const { c } = start('new')

    // Act
    c.done(AUDITION, NO_TEXTS, NO_PILLS)
    await vi.waitFor(() => expect(mocks.fetchPricing).toHaveBeenCalled())
    await settle()

    // Assert
    expect(c.credits()).toBeNull()
  })

  it('says nothing about a balance it could not read', async () => {
    mocks.signedIn = true
    mocks.fetchBillingMe.mockResolvedValue(null)
    const { c } = start('new')

    c.done(AUDITION, NO_TEXTS, NO_PILLS)
    await vi.waitFor(() => expect(mocks.fetchBillingMe).toHaveBeenCalled())
    await settle()

    expect(c.credits()).toBeNull()
  })

  it('shows the line of a reviewed plan as soon as it opens', async () => {
    // Arrange
    mocks.promo = { credits: 5 }
    savePlanAnswers(AUDITION, NO_TEXTS)

    // Act
    const { c } = start('review')

    // Assert
    expect(c.credits()?.kind).toBe('gift')
  })
})
