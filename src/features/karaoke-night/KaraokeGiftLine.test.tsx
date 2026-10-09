// ============================================================
// Karaoke Night's launch gift, signed out
// ============================================================
//
// While a promo code is featured, the signed-out line under "Add a song"
// stops calling studio separation "a paid option" and offers the gift; its
// button opens the account chip's form on "Create your account", where a
// sign-up from this page carries `signupSource: 'karaoke'`. Without a code,
// the line is the one it always was.

import { cleanup, fireEvent, render, screen, waitFor, } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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
  trackKaraoke: vi.fn(),
  rememberGiftOffered: vi.fn(),
  syncPromoClaims: vi.fn(async () => {}),
  loadFeaturedPromo: vi.fn(async () => {}),
  setOffer: (_offer: Offer | null): void => {},
}))

vi.mock('./funnel', () => ({ trackKaraoke: mocks.trackKaraoke }))

vi.mock('@/stores/promo-store', async () => {
  const { createSignal } = await import('solid-js')
  const [offer, setOffer] = createSignal<Offer | null>(null)
  mocks.setOffer = (next) => setOffer(() => next)
  return { offeredPromo: offer, loadFeaturedPromo: mocks.loadFeaturedPromo }
})

vi.mock('@/stores/launch-gift-store', () => ({
  rememberGiftOffered: mocks.rememberGiftOffered,
  signUpGiftMessage: () => null,
  syncPromoClaims: mocks.syncPromoClaims,
}))

vi.mock('@/lib/standalone-account', () => ({
  account: () => null,
  credits: () => null,
  refreshAccount: async () => {},
  signedIn: () => false,
  signOutStandalone: () => {},
}))

vi.mock('@/db/services/auth-service', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  takeGoogleRedirectResult: () => null,
}))

vi.mock('@/stores/notifications-store', () => ({ showNotification: vi.fn() }))

import { KaraokeAccount } from './KaraokeAccount'
import { KaraokeGiftLine } from './KaraokeGiftLine'
import { answerSignUpAsk, signUpAsked } from './sign-up-ask'

beforeEach(() => {
  vi.clearAllMocks()
  answerSignUpAsk()
  mocks.setOffer(LAUNCH)
})

afterEach(cleanup)

describe('the signed-out line under Add a song', () => {
  it('offers the gift while a code is on offer', () => {
    render(() => <KaraokeGiftLine />)

    const gift = screen.getByTestId('kn-launch-gift')
    expect(gift).toHaveTextContent(
      'Splitting on this device is free. For studio quality, get 5 free credits with a free account.',
    )
    expect(gift).not.toHaveTextContent('paid option')
    expect(mocks.loadFeaturedPromo).toHaveBeenCalled()
  })

  it('asks the account chip for its sign-up form, and counts the tap', () => {
    render(() => <KaraokeGiftLine />)

    fireEvent.click(
      screen.getByRole('button', { name: 'Create my free account' }),
    )

    expect(mocks.trackKaraoke).toHaveBeenCalledWith('karaoke_gift_signup_tap')
    expect(mocks.rememberGiftOffered).toHaveBeenCalledWith(LAUNCH)
    expect(signUpAsked()).toBe(true)
  })

  it('says what it always said when no code is on offer', () => {
    mocks.setOffer(null)
    const { container } = render(() => <KaraokeGiftLine />)

    expect(screen.queryByTestId('kn-launch-gift')).toBeNull()
    expect(container).toHaveTextContent(
      'Higher-quality separation is available as a paid option — sign in to use it.',
    )
  })
})

describe('the account chip', () => {
  it('opens its form on "Create your account" when the rail asks', async () => {
    render(() => <KaraokeAccount />)
    expect(
      screen.queryByRole('heading', { name: 'Create your account' }),
    ).toBeNull()

    render(() => <KaraokeGiftLine />)
    fireEvent.click(
      screen.getByRole('button', { name: 'Create my free account' }),
    )

    expect(
      await screen.findByRole('heading', { name: 'Create your account' }),
    ).toBeInTheDocument()
    await waitFor(() => expect(signUpAsked()).toBe(false))
  })

  it('reads the claims of nobody while nobody is signed in', () => {
    render(() => <KaraokeAccount />)
    expect(mocks.syncPromoClaims).toHaveBeenCalledWith(null)
  })
})
