// ============================================================
// First Light: the "are you sure?" before a way out skips something
// ============================================================
//
// Owner request, 23 Oct 2026. The welcome's close, the Not now that skips the
// voiceprint (First light, the Fork, the voiceprint run) and the questions'
// Not now ask first, and say what staying gets. Keep going leaves the visitor
// where they were; Yes, skip does what the tap did before, and only then
// count its events. The twin, the prints, Keep and a replay ask nothing. The
// copy and the list rules live in skip-confirm.tsx.

import { cleanup, fireEvent, render, screen, waitFor, within, } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ONBOARDING_FUNNEL_EVENTS } from '@/lib/funnel-event-catalog'
import type { F0Frame } from '@/lib/mirror/metrics'

vi.mock('@/lib/jam/media-errors', async () =>
  (await import('./FirstLight.fixture')).fake.micPermission(),
)
vi.mock('@/lib/voice-session', async () =>
  (await import('./FirstLight.fixture')).fake.voiceSession(),
)
vi.mock('./StarField', async () =>
  (await import('./FirstLight.fixture')).fake.starField(),
)
vi.mock('@/features/mirror/TaskDemo', async () =>
  (await import('./FirstLight.fixture')).fake.taskDemo(),
)
vi.mock('@/features/mirror/LiveViz', async () =>
  (await import('./FirstLight.fixture')).fake.liveViz(),
)
vi.mock('@/features/mic-check/MicCheckStage', async () =>
  (await import('./FirstLight.fixture')).fake.micStage(),
)
vi.mock('@/features/mirror/voiceprint-share', async () =>
  (await import('./FirstLight.fixture')).fake.voiceprintCard(),
)
vi.mock('@/features/onboarding/funnel', async (importOriginal) =>
  (await import('./FirstLight.fixture')).fake.funnel(importOriginal),
)
vi.mock('@/stores/promo-store', async () =>
  (await import('./FirstLight.fixture')).fake.promoStore(),
)
vi.mock('@/stores/launch-gift-store', async () =>
  (await import('./FirstLight.fixture')).fake.giftStore(),
)
vi.mock('@/lib/merc/gpu-gate', async (importOriginal) =>
  (await import('./FirstLight.fixture')).fake.gpuGate(importOriginal),
)
vi.mock('@/stores/app-store', async (importOriginal) =>
  (await import('./FirstLight.fixture')).fake.appStore(importOriginal),
)

import { PLAN_SKIP_ASK } from '@/features/plan/BeatPlan'
import { answeredElsewhere, AUDITION, } from '@/features/plan/plan-choices.fixture'
import { PLAN_OPENED_KEY, PLAN_RECORD_KEY } from '@/features/plan/plan-keys'
import { planRecord, savePlanAnswers } from '@/features/plan/plan-store'
import { GUIDE_FUNNEL_STORAGE_KEY } from '@/lib/guide-funnel'
import { applyPersistedValue } from '@/lib/storage'
import { currentBeat, flowOpen, markMicDenied, openBeat, recordVoiceprint, resetOnboarding, savedVoiceprints, track, } from '@/stores/onboarding-store'
import { setActiveTab } from '@/stores/ui-store'
import { overheard, press, stopOverhearing } from '@/tests/utils/trap-keys'
import { FirstLight } from './FirstLight'
import { mocks, SAVED_PRINT, skipAnyway, VOICEPRINT, } from './FirstLight.fixture'
import type { Beat } from './flow'
import { SKIP_COPY } from './skip-confirm'

/** A launch gift with a launch offer that ends well after this test runs. */
const GIFT = {
  code: 'LAUNCH',
  credits: 5,
  expiresAt: '2099-01-01T23:59:59.000Z',
  offer: { goal: 5, deadline: '2099-01-01T23:59:59.000Z', bonusCredits: 10 },
}
const GIFT_LINE = 'Up to 5 free song separations with a free account'

function beat(name: Beat): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-beat="${name}"]`)
}

async function at(name: Beat, replay = false): Promise<HTMLElement> {
  render(() => <FirstLight replay={replay} />)
  openBeat(name)
  await waitFor(() => expect(beat(name)).not.toBeNull())
  return beat(name) as HTMLElement
}

/** The rail's way out: the flow's one button outside the beat. */
function railExit(): HTMLElement {
  const flow = document.querySelector('[data-onboarding-flow]')
  const [exit] = [
    ...(flow?.querySelectorAll<HTMLElement>('button') ?? []),
  ].filter((button) => button.closest('[data-beat]') === null)
  return exit
}

const confirm = (): HTMLElement | null =>
  document.querySelector<HTMLElement>('[role="alertdialog"]')

/** The confirm's Keep going. Scoped: First light's own button after a heard
 *  note has the same name, under the backdrop. */
const keepGoing = (): HTMLElement =>
  within(confirm() as HTMLElement).getByRole('button', { name: 'Keep going' })

/** One voiceprint already on this device, read by First Light as it opens. */
async function withSavedPrint(): Promise<void> {
  localStorage.setItem(
    'mercurypitch.voiceprints.v1',
    JSON.stringify([SAVED_PRINT]),
  )
  render(() => <FirstLight />)
  await waitFor(() => expect(savedVoiceprints()).toHaveLength(1))
  cleanup()
}

/** What staying gets, as the welcome's confirm lists it. */
const listed = (): string[] =>
  within(confirm() as HTMLElement)
    .queryAllByRole('listitem')
    .map((item) => item.textContent ?? '')

function tracked(): string[] {
  return mocks.trackOnboarding.mock.calls.map(([event]) => String(event))
}

const count = (event: string): number =>
  tracked().filter((name) => name === event).length

function planEvents(): string[] {
  const raw = localStorage.getItem(GUIDE_FUNNEL_STORAGE_KEY) ?? '[]'
  return (JSON.parse(raw) as { event: string }[])
    .map((entry) => entry.event)
    .filter((event) => event.startsWith('plan_'))
}

function forgetThePlan(): void {
  applyPersistedValue(PLAN_RECORD_KEY, 'null', { persist: false })
  applyPersistedValue(PLAN_OPENED_KEY, '[]', { persist: false })
}

function answerThePlan(): void {
  savePlanAnswers(
    { q1: 'singing', q2: null, q3: [], q4: [] },
    { q3other: '', q4app: '' },
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.setOffer(null)
  localStorage.clear()
  forgetThePlan()
  setActiveTab('home')
  vi.spyOn(console, 'info').mockImplementation(() => undefined)
  resetOnboarding()
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
})

afterEach(() => {
  cleanup()
  mocks.setOffer(null)
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  forgetThePlan()
  resetOnboarding()
  stopOverhearing()
})

describe("the welcome's close", () => {
  it('asks first, says what staying gets, and opens on Keep going', async () => {
    await at('sky')

    fireEvent.click(screen.getByRole('button', { name: 'Skip the intro' }))

    expect(confirm()).toHaveTextContent(SKIP_COPY.intro.title)
    expect(confirm()).toHaveTextContent(SKIP_COPY.intro.body)
    expect(listed()).toEqual([SKIP_COPY.gainVoiceprint, SKIP_COPY.gainPlan])
    await waitFor(() => expect(keepGoing()).toHaveFocus())
    expect(flowOpen()).toBe(true)
    expect(count('onboarding_skip_asked_intro')).toBe(1)
    expect(tracked()).not.toContain('onboarding_skipped')
    expect(planRecord()).toBeNull()
  })

  it('stays on the welcome on Keep going', async () => {
    await at('sky')
    fireEvent.click(screen.getByRole('button', { name: 'Skip the intro' }))

    fireEvent.click(keepGoing())

    expect(confirm()).toBeNull()
    expect(currentBeat()).toBe('sky')
    expect(flowOpen()).toBe(true)
    expect(count('onboarding_skip_kept_intro')).toBe(1)
    expect(tracked()).not.toContain('onboarding_skipped')
    expect(planRecord()).toBeNull()
  })

  it('leaves on Yes, skip, and the plan is never offered again', async () => {
    await at('sky')
    fireEvent.click(screen.getByRole('button', { name: 'Skip the intro' }))

    skipAnyway()

    expect(confirm()).toBeNull()
    expect(flowOpen()).toBe(false)
    expect(planRecord()?.via).toBe('welcome-skip')
    expect(count('onboarding_skipped')).toBe(1)
    expect(tracked()).not.toContain('onboarding_skip_kept_intro')
    expect(ONBOARDING_FUNNEL_EVENTS).toEqual(expect.arrayContaining(tracked()))
  })

  it('leaves at once on a replay', async () => {
    await at('sky', true)

    fireEvent.click(screen.getByRole('button', { name: 'Skip the intro' }))

    expect(confirm()).toBeNull()
    expect(flowOpen()).toBe(false)
    expect(tracked()).not.toContain('onboarding_skip_asked_intro')
  })

  it('lists the plan only while it is due', async () => {
    answerThePlan()
    await at('sky')

    fireEvent.click(screen.getByRole('button', { name: 'Skip the intro' }))

    expect(listed()).toEqual([SKIP_COPY.gainVoiceprint])
  })

  it('lists the launch offer while a gift is on offer', async () => {
    mocks.setOffer(GIFT)
    await at('sky')

    fireEvent.click(screen.getByRole('button', { name: 'Skip the intro' }))

    expect(listed()).toEqual([
      SKIP_COPY.gainVoiceprint,
      SKIP_COPY.gainPlan,
      GIFT_LINE,
    ])
  })

  it('lists only the plan and the gift for someone with a voiceprint saved on this device', async () => {
    await withSavedPrint()
    mocks.setOffer(GIFT)
    await at('sky')

    fireEvent.click(screen.getByRole('button', { name: 'Skip the intro' }))

    expect(listed()).toEqual([SKIP_COPY.gainPlan, GIFT_LINE])
  })

  it('leaves at once when there is nothing left to list', async () => {
    answerThePlan()
    await at('sky')
    markMicDenied()

    fireEvent.click(screen.getByRole('button', { name: 'Skip the intro' }))

    expect(confirm()).toBeNull()
    expect(flowOpen()).toBe(false)
    expect(planRecord()?.status).toBe('answered')
    expect(count('onboarding_skipped')).toBe(1)
  })
})

describe('Not now before the voiceprint', () => {
  it('asks on First light, and Yes, skip lands on the questions while the plan is due', async () => {
    await at('first-light')

    fireEvent.click(railExit())

    expect(confirm()).toHaveTextContent(SKIP_COPY.voiceprint.title)
    expect(confirm()).toHaveTextContent(SKIP_COPY.voiceprint.body)
    expect(listed()).toEqual([])
    expect(tracked()).not.toContain('onboarding_skipped')
    skipAnyway()
    await waitFor(() => expect(currentBeat()).toBe('questions'))
    expect(count('onboarding_skipped')).toBe(1)
  })

  it('lands on the Map on Yes, skip once the plan is answered', async () => {
    answerThePlan()
    await at('first-light')
    fireEvent.click(railExit())

    skipAnyway()

    await waitFor(() => expect(currentBeat()).toBe('map'))
  })

  it('stays on First light on Keep going', async () => {
    await at('first-light')
    fireEvent.click(railExit())

    fireEvent.click(keepGoing())

    expect(confirm()).toBeNull()
    expect(beat('first-light')).not.toBeNull()
    expect(count('onboarding_skip_asked_voiceprint')).toBe(1)
    expect(count('onboarding_skip_kept_voiceprint')).toBe(1)
    expect(tracked()).not.toContain('onboarding_skipped')
  })

  it('asks on the voiceprint run', async () => {
    await at('voiceprint')

    fireEvent.click(railExit())

    expect(confirm()).toHaveTextContent(SKIP_COPY.voiceprint.title)
  })

  it('closes by itself when the voiceprint finishes underneath, counted as neither', async () => {
    await at('voiceprint')
    fireEvent.click(railExit())

    recordVoiceprint(VOICEPRINT)
    openBeat('twin')

    await waitFor(() => expect(confirm()).toBeNull())
    expect(beat('twin')).not.toBeNull()
    expect(tracked()).not.toContain('onboarding_skip_kept_voiceprint')
    expect(tracked()).not.toContain('onboarding_skipped')
  })

  // The confirm's trap hands the focus back to the Not now that opened it as it
  // closes, a pass after First Light has put it on the twin's heading, and a
  // screen reader then said "Not now" instead of where the person landed.
  it("leaves the focus on the twin's heading when it closes by itself", async () => {
    await at('voiceprint')
    const notNow = railExit()
    notNow.focus()
    fireEvent.click(notNow)
    await Promise.resolve()
    expect(keepGoing()).toHaveFocus()

    recordVoiceprint(VOICEPRINT)
    openBeat('twin')
    await waitFor(() => expect(confirm()).toBeNull())
    await Promise.resolve()

    expect(beat('twin')?.querySelector('h1')).toHaveFocus()
  })

  it('asks on the Fork, and Yes, skip takes the short track', async () => {
    await at('fork')

    fireEvent.click(railExit())

    expect(confirm()).toHaveTextContent(SKIP_COPY.voiceprint.title)
    expect(tracked()).not.toContain('onboarding_track_short')
    skipAnyway()
    await waitFor(() => expect(currentBeat()).toBe('questions'))
    expect(track()).toBe('short')
    expect(count('onboarding_track_short')).toBe(1)
  })

  it('goes straight to the questions from the twin, with no confirm', async () => {
    recordVoiceprint(VOICEPRINT)
    await at('twin')

    fireEvent.click(railExit())

    expect(confirm()).toBeNull()
    await waitFor(() => expect(currentBeat()).toBe('questions'))
    expect(tracked()).not.toContain('onboarding_skip_asked_voiceprint')
  })

  it('keeps the microphone while it asks, and lets it go on Yes, skip during the voiceprint run', async () => {
    await at('voiceprint')
    fireEvent.click(railExit())
    expect(mocks.sessionClose).not.toHaveBeenCalled()

    skipAnyway()

    await waitFor(() => expect(currentBeat()).toBe('questions'))
    expect(mocks.sessionClose).toHaveBeenCalled()
  })

  it.each<Beat>(['first-light', 'fork'])(
    'leaves the %s beat at once for someone with a voiceprint saved on this device',
    async (name) => {
      await withSavedPrint()
      await at(name)

      fireEvent.click(railExit())

      expect(confirm()).toBeNull()
      await waitFor(() => expect(currentBeat()).toBe('questions'))
      expect(tracked()).not.toContain('onboarding_skip_asked_voiceprint')
    },
  )

  it('asks nothing on a replay', async () => {
    await at('first-light', true)

    fireEvent.click(railExit())

    expect(confirm()).toBeNull()
    await waitFor(() => expect(currentBeat()).toBe('questions'))
  })
})

describe("the questions' Not now in First Light", () => {
  it('asks first, and turns the plan down on Yes, skip', async () => {
    const host = await at('questions')

    fireEvent.click(within(host).getByRole('button', { name: 'Not now' }))

    expect(confirm()).toHaveTextContent(PLAN_SKIP_ASK.title)
    expect(confirm()).toHaveTextContent(PLAN_SKIP_ASK.body)
    expect(count('onboarding_skip_asked_plan')).toBe(1)
    expect(planRecord()?.status).not.toBe('declined')
    skipAnyway()
    expect(planRecord()?.status).toBe('declined')
    expect(planEvents()).toEqual(['plan_shown_new', 'plan_declined_q1'])
    expect(flowOpen()).toBe(false)
  })

  it('stays on the question on Keep going', async () => {
    const host = await at('questions')
    fireEvent.click(within(host).getByRole('button', { name: 'Not now' }))

    fireEvent.click(keepGoing())

    expect(confirm()).toBeNull()
    expect(screen.getByText('Question 1 of 4')).toBeTruthy()
    expect(planRecord()?.status).not.toBe('declined')
    expect(flowOpen()).toBe(true)
    expect(count('onboarding_skip_kept_plan')).toBe(1)
  })

  // The account's plan can land while the question is open. The questions it
  // asks about are gone, and Yes, skip turned down a plan that was answered.
  it('closes by itself when the account plan lands in place of the questions, counted as neither', async () => {
    const host = await at('questions')
    fireEvent.click(within(host).getByRole('button', { name: 'Not now' }))
    expect(confirm()).toHaveTextContent(PLAN_SKIP_ASK.title)

    answeredElsewhere(AUDITION)

    await waitFor(() => expect(confirm()).toBeNull())
    await Promise.resolve()
    expect(beat('questions')?.dataset.phase).toBe('plan')
    expect(beat('questions')?.querySelector('h1')).toHaveFocus()
    expect(tracked()).not.toContain('onboarding_skip_kept_plan')
    expect(planRecord()?.status).toBe('answered')
    expect(planEvents()).toEqual(['plan_shown_new'])
    expect(flowOpen()).toBe(true)
  })
})

/** A steady tone at `hz`, one frame every 16 ms: a note First light can name. */
function tone(hz: number, count: number): F0Frame[] {
  return Array.from({ length: count }, (_, i) => ({
    t: i * 0.016,
    f0: hz,
    conf: 0.95,
  }))
}

describe('the confirm keeps the flow', () => {
  // Keep going has to hand back a beat that still works. A take that ends
  // while the confirm is open lands under it, and once the confirm is gone
  // the beat's own Keep going goes on.
  it('hands back a working beat: a note heard under it, then the beat goes on', async () => {
    await at('first-light')
    const allow = screen.queryByRole('button', {
      name: /Start listening|Allow microphone/,
    })
    if (allow !== null) fireEvent.click(allow)
    let finish: (frames: F0Frame[]) => void = () => undefined
    mocks.record.mockImplementationOnce(
      () =>
        new Promise<F0Frame[]>((resolve) => {
          finish = resolve
        }),
    )
    fireEvent.click(
      await screen.findByRole('button', { name: /Start the take/ }),
    )
    fireEvent.click(railExit())
    expect(confirm()).not.toBeNull()

    finish(tone(220, 120))

    const firstLight = beat('first-light') as HTMLElement
    await waitFor(() =>
      expect(within(firstLight).getByRole('heading')).toHaveTextContent(
        "That's an A3",
      ),
    )
    // The beat did not move, so the confirm is still asking.
    expect(confirm()).not.toBeNull()

    fireEvent.click(keepGoing())

    expect(confirm()).toBeNull()
    fireEvent.click(
      within(firstLight).getByRole('button', { name: 'Keep going' }),
    )
    await waitFor(() => expect(currentBeat()).not.toBe('first-light'))
    expect(count('onboarding_skip_kept_voiceprint')).toBe(1)
  })

  it('keeps going on Escape and on the backdrop, counted each time', async () => {
    await at('sky')
    const close = screen.getByRole('button', { name: 'Skip the intro' })

    fireEvent.click(close)
    fireEvent.keyDown(confirm() as HTMLElement, { key: 'Escape' })
    expect(confirm()).toBeNull()
    fireEvent.click(close)
    fireEvent.click(screen.getByTestId('confirm-overlay'))

    expect(confirm()).toBeNull()
    expect(flowOpen()).toBe(true)
    expect(count('onboarding_skip_asked_intro')).toBe(2)
    expect(count('onboarding_skip_kept_intro')).toBe(2)
    expect(tracked()).not.toContain('onboarding_skipped')
  })

  it('keeps its keys from the app behind', async () => {
    const heard = vi.fn()
    await at('first-light')
    fireEvent.click(railExit())
    window.addEventListener('keydown', heard)

    fireEvent.keyDown(keepGoing(), { key: 'm', code: 'KeyM' })

    window.removeEventListener('keydown', heard)
    expect(heard).not.toHaveBeenCalled()
  })

  it("keeps its keys after a press on the confirm's words, and Escape still keeps going", async () => {
    await at('first-light')
    fireEvent.click(railExit())
    const heard = overheard()

    press(within(confirm() as HTMLElement).getByText('Skip your voiceprint?'))
    fireEvent.keyDown(document.activeElement as Element, {
      key: 'm',
      code: 'KeyM',
    })
    fireEvent.keyDown(document.activeElement as Element, {
      key: 'Escape',
      code: 'Escape',
    })

    expect(heard).toEqual([])
    expect(confirm()).toBeNull()
    expect(count('onboarding_skip_kept_voiceprint')).toBe(1)
    expect(beat('first-light')).not.toBeNull()
  })

  it('asks once while a confirm is open, whatever is tapped under it', async () => {
    await at('first-light')
    const notNow = railExit()
    fireEvent.click(notNow)

    fireEvent.click(notNow)

    expect(count('onboarding_skip_asked_voiceprint')).toBe(1)
    expect(document.querySelectorAll('[role="alertdialog"]')).toHaveLength(1)
  })
})

describe("the owner's words", () => {
  it('says exactly what maff wrote, on each of the three confirms', async () => {
    mocks.setOffer(GIFT)
    const buttons = (): string[] =>
      within(confirm() as HTMLElement)
        .getAllByRole('button')
        .map((button) => button.textContent ?? '')
    await at('sky')

    fireEvent.click(screen.getByRole('button', { name: 'Skip the intro' }))
    expect(confirm()?.querySelector('h4')).toHaveTextContent('Skip the intro?')
    expect(confirm()?.querySelector('p')).toHaveTextContent(
      'Stay, and you get:',
    )
    expect(listed()).toEqual([
      'Your range, your voiceprint and your legend twin, from about 90 seconds of singing',
      'A plan from four quick questions: where to start, what to learn and what to play',
      'Up to 5 free song separations with a free account',
    ])
    expect(buttons()).toEqual(['Keep going', 'Yes, skip'])
    fireEvent.click(keepGoing())

    openBeat('first-light')
    await waitFor(() => expect(beat('first-light')).not.toBeNull())
    fireEvent.click(railExit())
    expect(confirm()?.querySelector('h4')).toHaveTextContent(
      'Skip your voiceprint?',
    )
    expect(confirm()?.querySelector('p')).toHaveTextContent(
      'About 90 seconds of singing gets you your range, your voiceprint and your legend twin. You can make one later in the Voice Mirror.',
    )
    expect(buttons()).toEqual(['Keep going', 'Yes, skip'])
    fireEvent.click(keepGoing())

    openBeat('questions')
    await waitFor(() => expect(beat('questions')).not.toBeNull())
    fireEvent.click(
      within(beat('questions') as HTMLElement).getByRole('button', {
        name: 'Not now',
      }),
    )
    expect(confirm()?.querySelector('h4')).toHaveTextContent('Skip your plan?')
    expect(confirm()?.querySelector('p')).toHaveTextContent(
      'Four quick questions, and Merc lays out where to start, what to learn and what to play.',
    )
    expect(buttons()).toEqual(['Keep going', 'Yes, skip'])
  })
})
