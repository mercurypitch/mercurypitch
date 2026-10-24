// ============================================================
// First Light: who is offered the launch gift, and what the exits do
// ============================================================
//
// The gift appears only while the server features a code. Keep has one
// button; "Not now" is in the rail at the top right, advances to the next
// beat (the four questions while the plan is due, else the Map) and
// silences the ask for a week. The welcome beat has one button and a close
// button. A declined microphone hears no offer in onboarding. The plan inside
// the flow follows the Map's rule for the gift (the same offer on its Karaoke
// Night card, none for a declined microphone), and Keep's sign-up detour (the
// questions behind the modal, Google's return) tells the funnel the plan was
// shown once.
//
// Launch offer plan, sections 4.1 to 4.5; owner decisions D5 and D6.

import { cleanup, fireEvent, render, screen, waitFor, } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as OnboardingFunnelModule from '@/features/onboarding/funnel'
import type * as GpuGateModule from '@/lib/merc/gpu-gate'
import type { MirrorResult } from '@/lib/mirror/metrics'
import type { OpenResult, ProbeResult, VoiceSession } from '@/lib/voice-session'
import type * as UiStore from '@/stores/ui-store'

interface Offer {
  code: string
  credits: number
  expiresAt: string | null
  offer?: { goal: number; deadline: string; bonusCredits: number } | null
}

const LAUNCH: Offer = {
  code: 'LAUNCH',
  credits: 5,
  expiresAt: '2027-01-01T23:59:59.000Z',
}

const mocks = vi.hoisted(() => ({
  trackOnboarding: vi.fn(),
  openAuthModal: vi.fn(),
  loadFeaturedPromo: vi.fn(async () => {}),
  rememberGiftOffered: vi.fn(),
  claimGiftNow: vi.fn(async () => {}),
  setOffer: (_offer: Offer | null): void => {},
}))

vi.mock('@/lib/jam/media-errors', () => ({
  micPermissionState: (): Promise<string> => Promise.resolve('granted'),
}))

vi.mock('@/lib/voice-session', () => ({
  createVoiceSession: (): VoiceSession =>
    ({
      open: (): Promise<OpenResult> =>
        Promise.resolve({ ok: true } as OpenResult),
      probe: (): Promise<ProbeResult> => Promise.resolve('ok' as ProbeResult),
      arm: (): void => {},
      record: () => Promise.resolve([]),
      latest: () => null,
      latestSmoothed: () => null,
      level: (): number => 0,
      context: () => null,
      isOpen: (): boolean => false,
      devices: (): Promise<MediaDeviceInfo[]> => Promise.resolve([]),
      useDevice: (): Promise<ProbeResult> =>
        Promise.resolve('ok' as ProbeResult),
      close: (): void => {},
    }) as unknown as VoiceSession,
}))

vi.mock('@/features/onboarding/funnel', async (importOriginal) => {
  const actual = await importOriginal<typeof OnboardingFunnelModule>()
  return { ...actual, trackOnboarding: mocks.trackOnboarding }
})

vi.mock('@/stores/ui-store', async (importOriginal) => ({
  ...(await importOriginal<typeof UiStore>()),
  openAuthModal: mocks.openAuthModal,
}))

vi.mock('@/stores/promo-store', async () => {
  const { createSignal } = await import('solid-js')
  const [offer, setOffer] = createSignal<Offer | null>(null)
  mocks.setOffer = (next) => setOffer(() => next)
  return { offeredPromo: offer, loadFeaturedPromo: mocks.loadFeaturedPromo }
})

vi.mock('@/stores/launch-gift-store', () => ({
  giftWaiting: () => null,
  rememberGiftOffered: mocks.rememberGiftOffered,
  claimGiftNow: mocks.claimGiftNow,
}))

// jsdom cannot draw: the star field's canvas is stubbed out, which also keeps
// its "getContext not implemented" probe out of the output.
vi.mock('@/features/onboarding/StarField', () => ({ StarField: () => null }))

// The questions' Merc asks the browser for WebGL, which jsdom cannot give.
vi.mock('@/lib/merc/gpu-gate', async (importOriginal) => ({
  ...(await importOriginal<typeof GpuGateModule>()),
  canRunLiveMerc: (): boolean => false,
}))

import { nudgeState } from '@/features/onboarding/account-nudge'
import { FirstLight } from '@/features/onboarding/FirstLight'
import { PLAN_RECORD_KEY } from '@/features/plan/plan-keys'
import { savePlanAnswers } from '@/features/plan/plan-store'
import { next, q2Label, quiet, tap, } from '@/features/plan/PlanQuestions.fixture'
import { GUIDE_FUNNEL_STORAGE_KEY } from '@/lib/guide-funnel'
import { applyPersistedValue } from '@/lib/storage'
import { armOnboardingResume, chooseTrack, currentBeat, markMicDenied, openBeat, recordVoiceprint, resetOnboarding, startOrResumeOnboarding, } from '@/stores/onboarding-store'

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

function beat(name: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-beat="${name}"]`)
}

/** The plan record is a module signal that `localStorage.clear()` does not reach. */
function forgetThePlan(): void {
  applyPersistedValue(PLAN_RECORD_KEY, 'null', { persist: false })
}

/** What the plan told the guide funnel about being shown, in order. */
function planShown(): string[] {
  const raw = localStorage.getItem(GUIDE_FUNNEL_STORAGE_KEY) ?? '[]'
  return (JSON.parse(raw) as { event: string }[])
    .map((entry) => entry.event)
    .filter((event) => event.startsWith('plan_shown'))
}

/** The questions, answered for singing toward an audition: the plan's Karaoke Night card carries the credits line. */
async function toTheAuditionPlan(): Promise<HTMLElement> {
  render(() => <FirstLight />)
  openBeat('questions')
  await waitFor(() => expect(beat('questions')).not.toBeNull())
  const host = beat('questions') as HTMLElement
  tap('Singing')
  fireEvent.click(quiet())
  tap(q2Label('audition'))
  fireEvent.click(quiet())
  next()
  next()
  await waitFor(() =>
    expect(host.querySelector('[data-kind="play"]')).not.toBeNull(),
  )
  return host
}

async function atKeep(): Promise<HTMLElement> {
  render(() => <FirstLight />)
  recordVoiceprint(VOICEPRINT)
  openBeat('keep')
  await waitFor(() => expect(beat('keep')).not.toBeNull())
  return beat('keep') as HTMLElement
}

describe('First Light and the launch gift', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    forgetThePlan()
    resetOnboarding()
    mocks.setOffer(LAUNCH)
    // jsdom ships no matchMedia; the star field asks for reduced-motion.
    vi.stubGlobal('matchMedia', () => ({
      matches: false,
      addEventListener: () => {},
      removeEventListener: () => {},
    }))
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    forgetThePlan()
    resetOnboarding()
  })

  it('asks for the featured code when the flow opens', () => {
    render(() => <FirstLight />)
    expect(mocks.loadFeaturedPromo).toHaveBeenCalled()
  })

  it('shows Keep with the gift while a code is on offer, and counts it once', async () => {
    const keep = await atKeep()

    expect(keep).toHaveAttribute('data-gift', 'offered')
    expect(keep).toHaveTextContent('Up to 5 free song separations')
    await waitFor(() =>
      expect(mocks.trackOnboarding).toHaveBeenCalledWith(
        'onboarding_keep_gift',
      ),
    )
    expect(
      mocks.trackOnboarding.mock.calls.filter(
        ([event]) => event === 'onboarding_keep_gift',
      ),
    ).toHaveLength(1)
    expect(mocks.trackOnboarding).toHaveBeenCalledWith('onboarding_keep')
  })

  it('shows Keep without the gift, and counts no gift, when nothing is on offer', async () => {
    mocks.setOffer(null)
    const keep = await atKeep()

    expect(keep).toHaveAttribute('data-gift', 'none')
    expect(keep).not.toHaveTextContent('song separations')
    expect(mocks.trackOnboarding).toHaveBeenCalledWith('onboarding_keep')
    expect(mocks.trackOnboarding).not.toHaveBeenCalledWith(
      'onboarding_keep_gift',
    )
  })

  it('"Not now" sits in the rail, moves on to the questions and quiets the ask', async () => {
    const keep = await atKeep()
    const notNow = screen.getByRole('button', { name: 'Not now' })
    // In the rail at the top, and the only way out: every button outside
    // the beat is this one, and the beat itself offers none.
    const flow = document.querySelector('[data-onboarding-flow]')
    const outsideBeat = [...(flow?.querySelectorAll('button') ?? [])].filter(
      (button) => button.closest('[data-beat]') === null,
    )
    expect(outsideBeat).toEqual([notNow])
    expect(keep).not.toHaveTextContent(/Not now|Skip/)

    fireEvent.click(notNow)

    await waitFor(() => expect(currentBeat()).toBe('questions'))
    expect(mocks.trackOnboarding).toHaveBeenCalledWith(
      'onboarding_account_dismissed',
    )
    expect(nudgeState('onboarding-twin').dismissedAt).not.toBeNull()
    expect(mocks.openAuthModal).not.toHaveBeenCalled()
  })

  it('"Create my free account" opens the sign-up and remembers the gift', async () => {
    await atKeep()

    fireEvent.click(
      screen.getByRole('button', { name: 'Create my free account' }),
    )

    expect(mocks.openAuthModal).toHaveBeenCalledWith('register')
    expect(mocks.rememberGiftOffered).toHaveBeenCalledOnce()
    expect(mocks.trackOnboarding).toHaveBeenCalledWith(
      'onboarding_account_created',
    )
    // Underneath the modal the flow has moved on, so closing it lands on
    // the questions, which is also where a Google sign-up resumes.
    await waitFor(() => expect(currentBeat()).toBe('questions'))
  })

  it.each<[string, () => void]>([
    ['mounted again where it stands', () => undefined],
    [
      'resumed where Google sent the person back',
      () => {
        armOnboardingResume()
        startOrResumeOnboarding()
      },
    ],
  ])(
    'counts the plan as shown once, behind the sign-up and with the flow %s',
    async (_how, comeBack) => {
      // Arrange: Keep's sign-up leaves the flow on the questions, behind the modal.
      await atKeep()
      fireEvent.click(
        screen.getByRole('button', { name: 'Create my free account' }),
      )
      await waitFor(() => expect(beat('questions')).not.toBeNull())
      expect(planShown()).toEqual(['plan_shown_new'])
      cleanup()

      // Act: the flow is back on the questions, the plan already shown.
      comeBack()
      render(() => <FirstLight />)
      await waitFor(() => expect(beat('questions')).not.toBeNull())

      // Assert
      expect(planShown()).toEqual(['plan_shown_new'])
    },
  )

  it("names the launch gift on the plan's Karaoke Night card, as the Map does", async () => {
    const host = await toTheAuditionPlan()

    expect(
      host.querySelector('[data-kind="play"] [data-part="credits"]'),
    ).toHaveTextContent('Up to 5 free song separations')
  })

  it('names no gift on the plan to a visitor who declined the microphone, as the Map does not', async () => {
    markMicDenied()
    const host = await toTheAuditionPlan()

    expect(
      host.querySelector('[data-kind="play"] [data-part="credits"]'),
    ).toBeNull()
    expect(host).not.toHaveTextContent('separations')
  })

  it('offers the gift on the Map to a visitor who took the short track', async () => {
    render(() => <FirstLight />)
    chooseTrack('short')
    openBeat('map')
    await waitFor(() => expect(beat('map')).not.toBeNull())

    expect(
      beat('map')?.querySelector('[data-room="karaoke"]'),
    ).toHaveTextContent('Launch gift')
    fireEvent.click(screen.getByRole('button', { name: 'Get my gift' }))

    expect(mocks.trackOnboarding).toHaveBeenCalledWith(
      'onboarding_map_gift_tap',
    )
    expect(mocks.rememberGiftOffered).toHaveBeenCalledOnce()
    expect(mocks.openAuthModal).toHaveBeenCalledWith('register', {
      signupSource: 'karaoke',
    })
  })

  it('says what using the gift earns, from the featured code, on Keep and the Map', async () => {
    mocks.setOffer({
      ...LAUNCH,
      offer: {
        goal: 5,
        deadline: '2099-10-28T23:59:59.999Z',
        bonusCredits: 30,
      },
    })
    const line =
      'Use all 5 by 28 October and your next credit pack comes with 30 extra credits.'

    const keep = await atKeep()
    expect(
      keep.querySelector('[data-testid="gift-offer-line"]'),
    ).toHaveTextContent(line)

    cleanup()
    resetOnboarding()
    render(() => <FirstLight />)
    chooseTrack('short')
    openBeat('map')
    await waitFor(() => expect(beat('map')).not.toBeNull())
    expect(screen.getByTestId('gift-offer-line')).toHaveTextContent(line)
  })

  it('offers nothing in onboarding to a visitor who declined the microphone', async () => {
    render(() => <FirstLight />)
    markMicDenied()
    openBeat('map')
    await waitFor(() => expect(beat('map')).not.toBeNull())

    expect(beat('map')).not.toHaveTextContent('Launch gift')
    expect(beat('map')).not.toHaveTextContent('separations')
  })

  it('carries the gift on the way back to Keep for a voiceprint', async () => {
    render(() => <FirstLight />)
    recordVoiceprint(VOICEPRINT)
    openBeat('map')
    await waitFor(() => expect(beat('map')).not.toBeNull())

    fireEvent.click(
      screen.getByRole('button', { name: 'Save it and get the launch gift' }),
    )

    expect(mocks.trackOnboarding).toHaveBeenCalledWith(
      'onboarding_map_gift_tap',
    )
    expect(mocks.trackOnboarding).toHaveBeenCalledWith(
      'onboarding_account_created',
    )
    expect(mocks.openAuthModal).toHaveBeenCalledWith('register')
  })

  it('leaves the twin by "Not now" for a Map that offers to keep the voiceprint, with the gift', async () => {
    // Owner decision V9: the twin's "Not now" goes past the Keep beat, and
    // once the plan is answered it lands on the Map. The voiceprint was
    // saved on this device the moment it was made, so the Map's way back to
    // the account offer carries it, and the gift rides on that line rather
    // than on a second one.
    savePlanAnswers(
      { q1: 'singing', q2: null, q3: [], q4: [] },
      { q3other: '', q4app: '' },
    )
    render(() => <FirstLight />)
    recordVoiceprint(VOICEPRINT)
    openBeat('twin')
    await waitFor(() => expect(beat('twin')).not.toBeNull())

    fireEvent.click(screen.getByRole('button', { name: 'Not now' }))

    await waitFor(() => expect(beat('map')).not.toBeNull())
    expect(beat('keep')).toBeNull()
    expect(beat('map')).toHaveTextContent(
      'Your voiceprint is saved in this browser only.',
    )
    expect(
      screen.getByRole('button', { name: 'Save it and get the launch gift' }),
    ).toBeTruthy()
    expect(beat('map')).not.toHaveTextContent('Launch gift:')
    expect(mocks.trackOnboarding).toHaveBeenCalledWith('onboarding_skipped')
    expect(mocks.trackOnboarding).not.toHaveBeenCalledWith('onboarding_keep')
  })
})

describe('the welcome beat', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    forgetThePlan()
    resetOnboarding()
    vi.stubGlobal('matchMedia', () => ({
      matches: false,
      addEventListener: () => {},
      removeEventListener: () => {},
    }))
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    forgetThePlan()
    resetOnboarding()
  })

  it('carries one button, and the way out is a close button at the top', async () => {
    render(() => <FirstLight />)
    await waitFor(() => expect(beat('sky')).not.toBeNull())

    const buttons = beat('sky')?.querySelectorAll('button') ?? []
    expect([...buttons].map((b) => b.textContent)).toEqual(['Sing one note'])

    const close = screen.getByRole('button', { name: 'Skip the intro' })
    expect(close.closest('[data-beat]')).toBeNull()
    fireEvent.click(close)
    // It asks first (skip-confirm.tsx); Yes, skip is the skip.
    expect(mocks.trackOnboarding).not.toHaveBeenCalledWith('onboarding_skipped')
    fireEvent.click(screen.getByRole('button', { name: 'Yes, skip' }))
    expect(mocks.trackOnboarding).toHaveBeenCalledWith('onboarding_skipped')
  })
})
