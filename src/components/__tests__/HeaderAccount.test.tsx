// ============================================================
// HeaderAccount component tests
// ============================================================

import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type * as AuthService from '@/db/services/auth-service'

vi.mock('@/lib/defaults', () => ({ API_BASE_URL: 'http://api.test' }))

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
  restoreAuth: vi.fn(async () => true),
  fetchMe: vi.fn(),
  logout: vi.fn(),
  openAuthModal: vi.fn(),
  loadFeaturedPromo: vi.fn(async () => {}),
  // Replaced by the promo-store mock below with a real signal's setter.
  setOffer: (_offer: Offer | null): void => {},
}))
vi.mock('@/db/services/auth-service', async (importOriginal) => ({
  // Real, because which providers count as an account is under test here.
  isRegisteredProvider: (await importOriginal<typeof AuthService>())
    .isRegisteredProvider,
  restoreAuth: mocks.restoreAuth,
  fetchMe: mocks.fetchMe,
  logout: mocks.logout,
}))
vi.mock('@/stores/promo-store', async () => {
  // A real signal, so a test can change the offer after the first render.
  const { createSignal } = await import('solid-js')
  const [offer, setOffer] = createSignal<Offer | null>(null)
  mocks.setOffer = (next) => setOffer(() => next)
  return { offeredPromo: offer, loadFeaturedPromo: mocks.loadFeaturedPromo }
})
// Mocked so the component doesn't pull the full ui-store import chain
// (which reads more of @/lib/defaults than the stub above provides).
vi.mock('@/stores/ui-store', () => ({ openAuthModal: mocks.openAuthModal }))

import { HeaderAccount } from '../account/HeaderAccount'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.setOffer(LAUNCH)
})

describe('HeaderAccount', () => {
  it('shows the username and a sign-out control when signed in', async () => {
    mocks.fetchMe.mockResolvedValue({
      user: { authProvider: 'password', email: 'a@b.com' },
      profile: { displayName: 'Maff' },
    })
    render(() => <HeaderAccount />)

    expect(await screen.findByText('Maff')).toBeInTheDocument()
    expect(screen.getByTestId('header-logout')).toBeInTheDocument()
  })

  it('shows a Sign in with Apple account as signed in', async () => {
    mocks.fetchMe.mockResolvedValue({
      user: {
        authProvider: 'apple',
        email: 'x7qk2m9vtd@privaterelay.appleid.com',
      },
      profile: { displayName: 'Ada Lovelace' },
    })
    render(() => <HeaderAccount />)

    // The account pill, carrying the name the account has: the same header
    // any other account gets.
    const pill = await screen.findByTestId('header-account')
    expect(pill).toHaveTextContent('Ada Lovelace')
    expect(screen.getByTestId('header-logout')).toBeInTheDocument()
    expect(screen.queryByTestId('header-signin')).not.toBeInTheDocument()
  })

  // Sign-out sits a thumb's width from the button people press to check who
  // they are signed in as, and it drops them out of a session mid-practice.
  it('asks before it signs anyone out', async () => {
    mocks.fetchMe.mockResolvedValue({
      user: { authProvider: 'password', email: 'a@b.com' },
      profile: { displayName: 'Maff' },
    })
    render(() => <HeaderAccount />)

    fireEvent.click(await screen.findByTestId('header-logout'))
    expect(mocks.logout).not.toHaveBeenCalled()
    expect(screen.getByText('Sign out?')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('confirm-delete'))
    expect(mocks.logout).toHaveBeenCalledOnce()
    expect(screen.queryByText('Sign out?')).not.toBeInTheDocument()
  })

  it('keeps them signed in when they back out of the confirmation', async () => {
    mocks.fetchMe.mockResolvedValue({
      user: { authProvider: 'password', email: 'a@b.com' },
      profile: { displayName: 'Maff' },
    })
    render(() => <HeaderAccount />)

    fireEvent.click(await screen.findByTestId('header-logout'))
    fireEvent.click(screen.getByTestId('confirm-cancel'))

    expect(mocks.logout).not.toHaveBeenCalled()
    expect(screen.queryByText('Sign out?')).not.toBeInTheDocument()
  })

  it('shows a Sign in pill for anonymous users', async () => {
    mocks.fetchMe.mockResolvedValue({
      user: { authProvider: 'anonymous', email: null },
      profile: { displayName: 'Singer-1' },
    })
    render(() => <HeaderAccount />)

    expect(await screen.findByTestId('header-signin')).toBeInTheDocument()
    expect(screen.queryByTestId('header-account')).not.toBeInTheDocument()
  })

  // The chip reads the same for everyone on purpose. It cannot know whether
  // an account is waiting — only that this device signed in once — and a
  // greeting there was read as a passkey having been detected, which no
  // browser will report. The Home strip carries that message instead, where
  // there is room to name the method being offered.
  it('says the same thing whether or not this device has signed in before', async () => {
    mocks.fetchMe.mockResolvedValue({
      user: { authProvider: 'anonymous', email: null },
      profile: { displayName: 'Singer-1' },
    })
    render(() => <HeaderAccount />)

    const pill = await screen.findByTestId('header-signin')
    expect(pill).toHaveTextContent('Sign in')
    expect(pill.getAttribute('title')).toBe('Sign in')
  })

  it('opens the sign-in modal from the signed-out pill', async () => {
    mocks.fetchMe.mockResolvedValue({
      user: { authProvider: 'anonymous', email: null },
      profile: { displayName: 'Singer-1' },
    })
    render(() => <HeaderAccount />)

    fireEvent.click(await screen.findByTestId('header-signin'))
    expect(mocks.openAuthModal).toHaveBeenCalledWith('login')
  })

  it('offers the promo pill while a code is on offer', async () => {
    mocks.fetchMe.mockResolvedValue({
      user: { authProvider: 'anonymous', email: null },
      profile: null,
    })
    render(() => <HeaderAccount />)

    expect(await screen.findByTestId('header-signin')).toBeInTheDocument()
    expect(screen.getByTestId('header-promo-pill')).toHaveAttribute(
      'href',
      '#/settings/credits',
    )
    expect(mocks.loadFeaturedPromo).toHaveBeenCalled()
  })

  it('wraps the offer as a gift: the icon leads, the label stays Promo', async () => {
    mocks.fetchMe.mockResolvedValue({
      user: { authProvider: 'anonymous', email: null },
      profile: null,
    })
    render(() => <HeaderAccount />)

    const pill = await screen.findByTestId('header-promo-pill')
    const icon = pill.firstElementChild
    expect(icon?.tagName.toLowerCase()).toBe('svg')
    expect(icon).toHaveAttribute('data-icon', 'gift')
    // Decoration only: a screen reader still hears the pill say Promo.
    expect(icon).toHaveAttribute('aria-hidden', 'true')
    expect(pill).toHaveTextContent(/^Promo$/)
  })

  it('names the credits the offer gives, not a fixed number', async () => {
    mocks.setOffer({ code: 'WINTER', credits: 8, expiresAt: null })
    mocks.fetchMe.mockResolvedValue({
      user: { authProvider: 'anonymous', email: null },
      profile: null,
    })
    render(() => <HeaderAccount />)

    const pill = await screen.findByTestId('header-promo-pill')
    expect(pill.getAttribute('title')).toMatch(/\b8 free\b/)
  })

  it('drops the promo pill when the offer goes away', async () => {
    mocks.fetchMe.mockResolvedValue({
      user: { authProvider: 'anonymous', email: null },
      profile: null,
    })
    render(() => <HeaderAccount />)
    expect(await screen.findByTestId('header-promo-pill')).toHaveAttribute(
      'href',
      '#/settings/credits',
    )

    mocks.setOffer(null)
    await waitFor(() => {
      expect(screen.queryByTestId('header-promo-pill')).toBeNull()
    })
    expect(screen.getByTestId('header-signin')).toHaveTextContent('Sign in')
  })

  it('shows the pill when the offer arrives after the header has rendered', async () => {
    mocks.setOffer(null)
    mocks.fetchMe.mockResolvedValue({
      user: { authProvider: 'anonymous', email: null },
      profile: null,
    })
    render(() => <HeaderAccount />)
    expect(await screen.findByTestId('header-signin')).toBeInTheDocument()
    expect(screen.queryByTestId('header-promo-pill')).toBeNull()

    mocks.setOffer(LAUNCH)
    const pill = await screen.findByTestId('header-promo-pill')
    expect(pill.getAttribute('title')).toMatch(/\b5 free\b/)
  })
})
