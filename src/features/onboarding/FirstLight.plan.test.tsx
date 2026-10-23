// ============================================================
// First Light: the four questions and the plan, inside the walk
// ============================================================
//
// While the person's plan is due (not answered, not turned down) the four
// questions are the last stop before the Map. What is pinned here is the
// beat's place in the flow: that it stands directly in the frame, with the
// plain sky receding behind it and the star field out of Merc's way; where
// each way out of the questions and the plan lands (Home, the Map, a stop
// with or without its tour); how the beats before it name it (the twin's line
// and the Prints button); and that the walk it is on does not shorten as the
// questions are answered. The screens and the rulebook have tests of their
// own, and BeatPlan.test.tsx pins the box. This file was split from
// FirstLight.test.tsx when the plan's cases took it past 600 lines
// (TESTING.md 3.5).

import { cleanup, fireEvent, render, screen, waitFor, within, } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as OnboardingFunnelModule from '@/features/onboarding/funnel'
import type * as GpuGateModule from '@/lib/merc/gpu-gate'
import type { MirrorResult } from '@/lib/mirror/metrics'
import type * as AppStoreModule from '@/stores/app-store'

const mocks = vi.hoisted(() => ({
  trackOnboarding: vi.fn(),
  startPageTour: vi.fn(),
  /** What the star field was last told about being paused. */
  starFieldPaused: null as boolean | null,
}))

// jsdom cannot draw: the star field's canvas is stubbed out. What it is told
// about stepping aside is kept, since that is the one thing it is asked.
vi.mock('./StarField', async () => {
  const { createEffect } = await import('solid-js')
  return {
    StarField: (props: { paused?: boolean }) => {
      createEffect(() => {
        mocks.starFieldPaused = props.paused ?? false
      })
      return null
    },
  }
})

// The prints' cards are canvases, which jsdom cannot draw.
vi.mock('@/features/mirror/voiceprint-share', () => ({
  renderVoiceprintCard: async () => null,
}))

vi.mock('@/features/onboarding/funnel', async (importOriginal) => {
  const actual = await importOriginal<typeof OnboardingFunnelModule>()
  return { ...actual, trackOnboarding: mocks.trackOnboarding }
})

vi.mock('@/stores/promo-store', async () => {
  const { createSignal } = await import('solid-js')
  const [offer] = createSignal(null)
  return { offeredPromo: offer, loadFeaturedPromo: async () => {} }
})

vi.mock('@/stores/launch-gift-store', () => ({
  giftWaiting: () => null,
  rememberGiftOffered: () => {},
  claimGiftNow: async () => {},
}))

// The questions' Merc asks the browser for WebGL, which jsdom cannot give.
vi.mock('@/lib/merc/gpu-gate', async (importOriginal) => ({
  ...(await importOriginal<typeof GpuGateModule>()),
  canRunLiveMerc: (): boolean => false,
}))

// Starting a page tour opens a real walkthrough; the flow only has to ask.
vi.mock('@/stores/app-store', async (importOriginal) => ({
  ...(await importOriginal<typeof AppStoreModule>()),
  startPageTour: mocks.startPageTour,
}))

import { buildPlan } from '@/features/plan/build-plan'
import { PLAN_OPENED_KEY, PLAN_RECORD_KEY } from '@/features/plan/plan-keys'
import { markPlanShown, planRecord, savePlanAnswers, } from '@/features/plan/plan-store'
import { next, passTo, quiet, tap } from '@/features/plan/PlanQuestions.fixture'
import type { PlanChoices } from '@/features/plan/questions'
import { q2Options } from '@/features/plan/questions'
import { GUIDE_FUNNEL_STORAGE_KEY } from '@/lib/guide-funnel'
import { applyPersistedValue } from '@/lib/storage'
import { currentBeat, flowOpen, onboardingBeads, openBeat, recordVoiceprint, resetOnboarding, savedVoiceprints, } from '@/stores/onboarding-store'
import { activeTab, setActiveTab } from '@/stores/ui-store'
import * as COPY from './copy'
import { pickFirstStop } from './first-stop'
import { FirstLight } from './FirstLight'
import type { Beat } from './flow'
import styles from './onboarding.module.css'

const VOICEPRINT: MirrorResult = {
  range: {
    lowMidi: 40,
    highMidi: 67,
    lowNote: 'E2',
    highNote: 'G4',
    semitones: 27,
    qualifyingMidis: [40, 52, 67],
    voiceHint: 'baritone',
  },
  accuracy: null,
  steadiness: null,
}

/** One voiceprint already on this device, for the Prints beat. */
const SAVED_PRINT = {
  id: 'saved-1',
  takenAt: '2026-10-10T10:00:00.000Z',
  twin: null,
  source: 'mirror',
  summary: { lowMidi: 43, highMidi: 72, semitones: 29 },
}

function beat(name: Beat): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-beat="${name}"]`)
}

async function at(name: Beat): Promise<HTMLElement> {
  render(() => <FirstLight />)
  openBeat(name)
  await waitFor(() => expect(beat(name)).not.toBeNull())
  return beat(name) as HTMLElement
}

/** The flow's buttons outside the beat itself: the rail's way out. */
function railExits(): HTMLElement[] {
  const flow = document.querySelector('[data-onboarding-flow]')
  return [...(flow?.querySelectorAll<HTMLElement>('button') ?? [])].filter(
    (button) => button.closest('[data-beat]') === null,
  )
}

function tracked(): string[] {
  return mocks.trackOnboarding.mock.calls.map(([event]) => String(event))
}

/** What the plan sent to the guide funnel, in order. */
function planEvents(): string[] {
  const raw = localStorage.getItem(GUIDE_FUNNEL_STORAGE_KEY) ?? '[]'
  return (JSON.parse(raw) as { event: string }[])
    .map((entry) => entry.event)
    .filter((event) => event.startsWith('plan_'))
}

/** The plan record and the stops opened live in module signals that `localStorage.clear()` does not reach. */
function forgetThePlan(): void {
  applyPersistedValue(PLAN_RECORD_KEY, 'null', { persist: false })
  applyPersistedValue(PLAN_OPENED_KEY, '[]', { persist: false })
}

/** A plan that has been answered: the questions are not due. */
function answerThePlan(): void {
  savePlanAnswers(
    { q1: 'singing', q2: null, q3: [], q4: [] },
    { q3other: '', q4app: '' },
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.starFieldPaused = null
  localStorage.clear()
  forgetThePlan()
  setActiveTab('home')
  vi.spyOn(console, 'info').mockImplementation(() => undefined)
  resetOnboarding()
  // jsdom ships no matchMedia; the star field and the plates ask it.
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  forgetThePlan()
  resetOnboarding()
})

describe('Skip the intro', () => {
  it('marks Skip the intro so the app never takes over later', async () => {
    // Arrange
    await at('sky')

    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Skip the intro' }))

    // Assert: the plan was met here, as a skip, and nothing asks again.
    expect(planRecord()?.status).toBe('shown')
    expect(planRecord()?.via).toBe('welcome-skip')
    expect(tracked()).toContain('onboarding_skipped')
    expect(flowOpen()).toBe(false)
  })
})

describe('the four questions and the plan in the flow', () => {
  const shown = (host: HTMLElement, name: string): Promise<HTMLElement> =>
    waitFor(() => within(host).getByRole('button', { name }))

  /** Answers nothing: every question passed, and the plan on screen. */
  async function toThePlan(): Promise<HTMLElement> {
    const host = await at('questions')
    passTo(4)
    next()
    await shown(host, 'See every room')
    return host
  }

  /** Answers Q1 and Q2, passes Q3 and Q4, and waits for the plan. */
  async function toThePlanOf(
    q1: 'Singing' | 'Guitar',
    q2: 'song' | 'audition' | null,
  ): Promise<HTMLElement> {
    const host = await at('questions')
    tap(q1)
    fireEvent.click(quiet())
    if (q2 !== null) {
      const id = q1 === 'Singing' ? 'singing' : 'guitar'
      const label = q2Options(id).find((o) => o.id === q2)?.label ?? ''
      tap(label)
      fireEvent.click(quiet())
    } else {
      tap('Skip')
    }
    next()
    next()
    await shown(host, 'See every room')
    return host
  }

  it('carries its own way out, and the rail adds none', async () => {
    // Arrange + Act
    const host = await at('questions')

    // Assert: Not now is the screen's, inside the beat; the rail has none.
    expect(railExits()).toHaveLength(0)
    expect(within(host).getByRole('button', { name: 'Not now' })).toBeTruthy()
  })

  it("stands directly in the frame, which the phone's padding rule reads and the screens' corners need", async () => {
    // Arrange + Act
    const host = await at('questions')

    // Assert: a child of the scrolling frame itself, not inside a beat's
    // animated wrapper (a transform would hand the corners to the frame)
    expect(styles.frame).toBeTruthy()
    expect(styles.beat).toBeTruthy()
    expect(host.parentElement?.classList.contains(styles.frame)).toBe(true)
    expect(host.classList.contains(styles.beat)).toBe(false)
  })

  it('leads the plan with what the voiceprint found, as the Map names its first stop', async () => {
    // Arrange: a voiceprint made in this run, and the plan it leads
    recordVoiceprint(VOICEPRINT)
    const answers: PlanChoices = {
      q1: 'singing',
      q2: 'audition',
      q3: [],
      q4: [],
    }
    const led = buildPlan(answers, { voiceprint: pickFirstStop(VOICEPRINT) })
    // The finding must change the plan, or this case reads nothing.
    expect(led.start.dest).not.toBe(buildPlan(answers).start.dest)

    // Act
    const host = await toThePlanOf('Singing', 'audition')

    // Assert
    expect(host.querySelector('[data-kind="start"]')).toHaveAttribute(
      'data-dest',
      led.start.dest,
    )
  })

  it('lets the sky step back behind the questions, as it does behind Keep and the Map', async () => {
    // Arrange + Act
    await at('questions')

    // Assert: the plain sky, receding, so its lines do not run through the words
    const plate = document.querySelector('[data-plate]')
    expect(plate).toHaveAttribute('data-plate', 'plain')
    expect(plate).toHaveClass(styles.plateRecede)
  })

  it('turns the plan down from Not now on a question, and leaves First Light for the app', async () => {
    // Arrange
    const host = await at('questions')

    // Act
    fireEvent.click(within(host).getByRole('button', { name: 'Not now' }))

    // Assert
    expect(planRecord()?.status).toBe('declined')
    expect(planEvents()).toEqual(['plan_shown_new', 'plan_declined_q1'])
    expect(flowOpen()).toBe(false)
  })

  it('opens the room grid from See every room', async () => {
    // Arrange
    const host = await toThePlan()

    // Act
    fireEvent.click(
      within(host).getByRole('button', { name: 'See every room' }),
    )

    // Assert
    await waitFor(() => expect(currentBeat()).toBe('map'))
    expect(beat('map')).not.toBeNull()
    expect(flowOpen()).toBe(true)
    expect(planEvents()).toContain('plan_rooms')
  })

  it("leaves First Light for the app from the plan's Not now, with the answers kept", async () => {
    // Arrange
    const host = await toThePlan()

    // Act
    fireEvent.click(within(host).getByRole('button', { name: 'Not now' }))

    // Assert
    expect(flowOpen()).toBe(false)
    expect(planEvents()).toContain('plan_skipped_plan')
    expect(planRecord()?.status).toBe('answered')
  })

  it('enters Start here and closes First Light, without a tour where the room has none', async () => {
    // Arrange: nothing answered, so Start here is the Sing room, which has
    // no spotlight tour.
    const host = await toThePlan()

    // Act
    fireEvent.click(
      within(host).getByRole('button', { name: 'Show me around' }),
    )

    // Assert
    expect(activeTab()).toBe('singing')
    expect(flowOpen()).toBe(false)
    expect(mocks.startPageTour).not.toHaveBeenCalled()
  })

  it('starts the tour of Start here when the room has one', async () => {
    // Arrange: a guitar player's Start here is the Guitar room, which does.
    const host = await toThePlanOf('Guitar', null)

    // Act
    fireEvent.click(
      within(host).getByRole('button', { name: 'Show me around' }),
    )

    // Assert
    expect(activeTab()).toBe('guitar')
    expect(flowOpen()).toBe(false)
    expect(mocks.startPageTour).toHaveBeenCalledWith('guitar')
  })

  it("enters a card's stop, closes First Light, and starts no tour", async () => {
    // Arrange: the same guitar player; the card is tapped, not toured.
    const host = await toThePlanOf('Guitar', null)

    // Act
    fireEvent.click(host.querySelector('[data-dest="guitar"]') as HTMLElement)

    // Assert
    expect(activeTab()).toBe('guitar')
    expect(flowOpen()).toBe(false)
    expect(mocks.startPageTour).not.toHaveBeenCalled()
    expect(planEvents()).toContain('plan_stop_start')
  })

  it('opens a page stop by closing First Light and going to the page', async () => {
    // Arrange: a singer working toward an audition gets Karaoke Night, which
    // is a page of its own. jsdom cannot navigate.
    const location = { href: '' }
    vi.stubGlobal('location', location)
    const host = await toThePlanOf('Singing', 'audition')

    // Act
    fireEvent.click(
      host.querySelector('[data-dest="karaokeNight"]') as HTMLElement,
    )

    // Assert
    expect(location.href).toBe('/karaoke')
    expect(flowOpen()).toBe(false)
    expect(planEvents()).toContain('plan_stop_play')
  })

  it("walks on to the questions after the account ask's Not now", async () => {
    // Arrange: Keep, on the full track.
    recordVoiceprint(VOICEPRINT)
    await at('keep')

    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Not now' }))

    // Assert
    await waitFor(() => expect(currentBeat()).toBe('questions'))
    expect(beat('questions')).not.toBeNull()
  })

  it('opens on the Map when it was left on the questions and the plan has since been answered', async () => {
    // Arrange: a Google sign-up resumed on the questions, after the answers
    // were given in another tab.
    answerThePlan()
    openBeat('questions')

    // Act
    render(() => <FirstLight />)

    // Assert
    await waitFor(() => expect(beat('map')).not.toBeNull())
    expect(currentBeat()).toBe('map')
    expect(beat('questions')).toBeNull()
  })

  it.each<[string, () => void]>([
    ['nothing was recorded', () => undefined],
    [
      'the plan was shown and never answered',
      () => markPlanShown('first-light'),
    ],
  ])(
    'stays on the questions when it was left there and the plan is still due: %s',
    async (_why, record) => {
      // Arrange
      record()
      openBeat('questions')

      // Act
      render(() => <FirstLight />)

      // Assert
      await waitFor(() => expect(beat('questions')).not.toBeNull())
      expect(currentBeat()).toBe('questions')
    },
  )
})

describe('the beats before the plan name it', () => {
  /** The Prints beat, with one take saved on this device to show. */
  async function atPrints(): Promise<HTMLElement> {
    localStorage.setItem(
      'mercurypitch.voiceprints.v1',
      JSON.stringify([SAVED_PRINT]),
    )
    render(() => <FirstLight />)
    await waitFor(() => expect(savedVoiceprints()).toHaveLength(1))
    cleanup()
    return at('prints')
  }

  it.each<[string, () => void, string, string, Beat]>([
    ['is due', () => undefined, 'Make my plan', 'See my map', 'questions'],
    ['is answered', answerThePlan, 'See my map', 'Make my plan', 'map'],
  ])(
    "calls the Prints beat's way on by where it leads, as the plan %s",
    async (_why, setUp, label, other, lands) => {
      // Arrange
      setUp()
      const prints = await atPrints()

      // Assert: the label, and not the other one
      const labels = within(prints)
        .getAllByRole('button')
        .map((button) => button.textContent?.trim())
      expect(labels).toContain(label)
      expect(labels).not.toContain(other)

      // Act + Assert: and it leads there
      fireEvent.click(within(prints).getByRole('button', { name: label }))
      await waitFor(() => expect(beat(lands)).not.toBeNull())
      expect(currentBeat()).toBe(lands)
    },
  )

  it.each<[string, () => void, string, string]>([
    ['is due', () => undefined, COPY.TWIN_NEXT_PLAN, COPY.TWIN_NEXT],
    ['is answered', answerThePlan, COPY.TWIN_NEXT, COPY.TWIN_NEXT_PLAN],
  ])(
    "says the twin's next stop, as the plan %s",
    async (_why, setUp, line, other) => {
      // Arrange
      setUp()
      recordVoiceprint(VOICEPRINT)

      // Act
      const twin = await at('twin')

      // Assert
      expect(twin).toHaveTextContent(line)
      expect(twin).not.toHaveTextContent(other)
    },
  )
})

describe("the questions' place in the walk", () => {
  it('stays on the walk once the questions are answered, so the hairline and the beads keep their place', async () => {
    // Arrange: on the questions, which are due, so on the walk
    const host = await at('questions')
    const walk = onboardingBeads()
    expect(walk.index).toBeGreaterThanOrEqual(0)

    // Act: answer them all, which turns the plan into an answered one
    passTo(4)
    next()
    await waitFor(() =>
      expect(
        within(host).getByRole('button', { name: 'See every room' }),
      ).toBeTruthy(),
    )

    // Assert: still the same walk, still standing on the same bead
    expect(planRecord()?.status).toBe('answered')
    expect(onboardingBeads()).toEqual(walk)
  })
})

describe('the star field behind the beats', () => {
  const field = (): HTMLElement | null =>
    document.querySelector<HTMLElement>(`.${styles.field}`)

  it.each<[string, Beat, boolean]>([
    [
      'steps away behind the questions, which draw Merc where its arc runs',
      'questions',
      true,
    ],
    ['steps away behind a plate that paints Merc', 'map', true],
    ['stays behind a beat that draws no Merc', 'keep', false],
  ])('%s', async (_what, name, away) => {
    // Arrange
    recordVoiceprint(VOICEPRINT)

    // Act
    await at(name)

    // Assert: out of sight, and not drawing either
    expect(styles.fieldAway).toBeTruthy()
    expect(field()?.classList.contains(styles.fieldAway)).toBe(away)
    expect(mocks.starFieldPaused).toBe(away)
  })
})
