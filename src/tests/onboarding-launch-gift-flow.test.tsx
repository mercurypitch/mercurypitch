// ============================================================
// First Light: who is offered the launch gift, and what the exits do
// ============================================================
//
// The gift appears only while the server features a code. Keep has one
// button; "Not now" is in the rail at the top right, advances to the Map
// and silences the ask for a week. The welcome beat has one button and a
// close button. A declined microphone hears no offer in onboarding.
//
// Launch offer plan, sections 4.1 to 4.5; owner decisions D5 and D6.

import { cleanup, fireEvent, render, screen, waitFor, } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as OnboardingFunnelModule from '@/features/onboarding/funnel'
import type { MirrorResult } from '@/lib/mirror/metrics'
import type { OpenResult, ProbeResult, VoiceSession } from '@/lib/voice-session'
import type * as UiStore from '@/stores/ui-store'

interface Offer {
  code: string
  credits: number
  expiresAt: string | null
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

import { nudgeState } from '@/features/onboarding/account-nudge'
import { FirstLight } from '@/features/onboarding/FirstLight'
import { chooseTrack, currentBeat, markMicDenied, openBeat, recordVoiceprint, resetOnboarding, } from '@/stores/onboarding-store'

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
    resetOnboarding()
  })

  it('asks for the featured code when the flow opens', () => {
    render(() => <FirstLight />)
    expect(mocks.loadFeaturedPromo).toHaveBeenCalled()
  })

  it('shows Keep with the gift while a code is on offer, and counts it once', async () => {
    const keep = await atKeep()

    expect(keep).toHaveAttribute('data-gift', 'offered')
    expect(keep).toHaveTextContent('5 free Karaoke Night credits')
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
    expect(keep).not.toHaveTextContent('Karaoke Night credits')
    expect(mocks.trackOnboarding).toHaveBeenCalledWith('onboarding_keep')
    expect(mocks.trackOnboarding).not.toHaveBeenCalledWith(
      'onboarding_keep_gift',
    )
  })

  it('"Not now" sits in the rail, moves on to the Map and quiets the ask', async () => {
    await atKeep()
    const notNow = screen.getByRole('button', { name: 'Not now' })
    // In the rail at the top, in place of Skip: never two exits.
    expect(notNow.closest('[data-beat="keep"]')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Skip' })).toBeNull()

    fireEvent.click(notNow)

    await waitFor(() => expect(currentBeat()).toBe('map'))
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
    await waitFor(() => expect(currentBeat()).toBe('map'))
  })

  it('offers the gift on the Map to a visitor who took the short track', async () => {
    render(() => <FirstLight />)
    chooseTrack('short')
    openBeat('map')
    await waitFor(() => expect(beat('map')).not.toBeNull())

    expect(
      beat('map')?.querySelector('[data-room="karaoke"]'),
    ).toHaveTextContent('5 free credits')
    fireEvent.click(screen.getByRole('button', { name: 'Get my 5 credits' }))

    expect(mocks.trackOnboarding).toHaveBeenCalledWith(
      'onboarding_map_gift_tap',
    )
    expect(mocks.rememberGiftOffered).toHaveBeenCalledOnce()
    expect(mocks.openAuthModal).toHaveBeenCalledWith('register', {
      signupSource: 'karaoke',
    })
  })

  it('offers nothing in onboarding to a visitor who declined the microphone', async () => {
    render(() => <FirstLight />)
    markMicDenied()
    openBeat('map')
    await waitFor(() => expect(beat('map')).not.toBeNull())

    expect(beat('map')).not.toHaveTextContent('Launch gift')
    expect(beat('map')).not.toHaveTextContent('free credits')
  })

  it('carries the gift on the way back to Keep for a voiceprint', async () => {
    render(() => <FirstLight />)
    recordVoiceprint(VOICEPRINT)
    openBeat('map')
    await waitFor(() => expect(beat('map')).not.toBeNull())

    fireEvent.click(
      screen.getByRole('button', { name: 'Save it and get 5 free credits' }),
    )

    expect(mocks.trackOnboarding).toHaveBeenCalledWith(
      'onboarding_map_gift_tap',
    )
    expect(mocks.trackOnboarding).toHaveBeenCalledWith(
      'onboarding_account_created',
    )
    expect(mocks.openAuthModal).toHaveBeenCalledWith('register')
  })
})

describe('the welcome beat', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
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
    expect(mocks.trackOnboarding).toHaveBeenCalledWith('onboarding_skipped')
  })
})
