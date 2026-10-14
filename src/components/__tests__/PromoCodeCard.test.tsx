// ============================================================
// PromoCodeCard component tests
// ============================================================

import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library'
import { beforeEach, describe, expect, it, vi } from 'vitest'

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

const VERIFIED = {
  user: {
    id: 'user-1',
    authProvider: 'password',
    email: 'test@example.com',
    emailVerified: true,
  },
}

const mocks = vi.hoisted(() => ({
  fetchMe: vi.fn(),
  resendVerificationEmail: vi.fn(),
  fetchBillingMe: vi.fn(),
  redeemPromoCode: vi.fn(),
  showNotification: vi.fn(),
  openAuthModal: vi.fn(),
  loadFeaturedPromo: vi.fn(async () => {}),
  recordPromoClaim: vi.fn(),
  // Replaced by the promo-store mock below with a real signal's setter.
  setOffer: (_offer: Offer | null): void => {},
}))

vi.mock('@/db/services/auth-service', () => ({
  fetchMe: mocks.fetchMe,
  resendVerificationEmail: mocks.resendVerificationEmail,
}))

vi.mock('@/db/services/billing-service', () => ({
  fetchBillingMe: mocks.fetchBillingMe,
  redeemPromoCode: mocks.redeemPromoCode,
}))

vi.mock('@/stores/notifications-store', () => ({
  showNotification: mocks.showNotification,
}))

vi.mock('@/stores/ui-store', () => ({
  openAuthModal: mocks.openAuthModal,
}))

vi.mock('@/stores/theme-store', () => ({
  theme: () => 'dark',
}))

vi.mock('@/stores/promo-store', async () => {
  // A real signal, so a test can change the offer after the first render.
  const { createSignal } = await import('solid-js')
  const [offer, setOffer] = createSignal<Offer | null>(null)
  mocks.setOffer = (next) => setOffer(() => next)
  return { offeredPromo: offer, loadFeaturedPromo: mocks.loadFeaturedPromo }
})

vi.mock('@/stores/launch-gift-store', () => ({
  recordPromoClaim: mocks.recordPromoClaim,
}))

import { PromoCodeCard } from '../billing/PromoCodeCard'

describe('PromoCodeCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.setOffer(LAUNCH)
  })

  it('renders account required banner when signed out', async () => {
    mocks.fetchMe.mockResolvedValue(null)
    mocks.fetchBillingMe.mockResolvedValue({
      creditBalance: 0,
      entitlements: [],
      stripeConfigured: true,
    })

    render(() => <PromoCodeCard />)

    expect(await screen.findByText('Account Required')).toBeInTheDocument()
    const loginBtn = screen.getByRole('button', { name: /sign up or log in/i })
    fireEvent.click(loginBtn)
    expect(mocks.openAuthModal).toHaveBeenCalledWith('register')
  })

  it('tells a signed-out visitor what using the gift earns', async () => {
    mocks.setOffer({
      ...LAUNCH,
      offer: {
        goal: 5,
        deadline: '2099-10-28T23:59:59.999Z',
        bonusCredits: 30,
      },
    })
    mocks.fetchMe.mockResolvedValue(null)
    mocks.fetchBillingMe.mockResolvedValue(null)

    render(() => <PromoCodeCard />)

    expect(await screen.findByTestId('gift-offer-line')).toHaveTextContent(
      'Use all 5 by 28 October and your next credit pack comes with 30 extra credits.',
    )
  })

  it('says it on the claim card until the code is claimed', async () => {
    mocks.setOffer({
      ...LAUNCH,
      offer: {
        goal: 5,
        deadline: '2099-10-28T23:59:59.999Z',
        bonusCredits: 30,
      },
    })
    mocks.fetchMe.mockResolvedValue(VERIFIED)
    mocks.fetchBillingMe.mockResolvedValue({
      creditBalance: 0,
      entitlements: [],
      redeemedPromos: [],
      stripeConfigured: true,
    })

    const view = render(() => <PromoCodeCard />)
    await screen.findByTestId('claim-promo-btn')
    expect(screen.getByTestId('gift-offer-line')).toHaveTextContent(
      'Use all 5 by 28 October and your next credit pack comes with 30 extra credits.',
    )
    view.unmount()

    // Claimed, the progress block in Settings › Credits takes over.
    mocks.fetchBillingMe.mockResolvedValue({
      creditBalance: 5,
      entitlements: [],
      redeemedPromos: ['LAUNCH'],
      stripeConfigured: true,
    })
    render(() => <PromoCodeCard />)
    await screen.findByText('Claimed')
    expect(screen.queryByTestId('gift-offer-line')).toBeNull()
  })

  it('says nothing of an offer the server does not state', async () => {
    mocks.setOffer({ ...LAUNCH, offer: null })
    mocks.fetchMe.mockResolvedValue(null)
    mocks.fetchBillingMe.mockResolvedValue(null)

    render(() => <PromoCodeCard />)

    expect(await screen.findByText('Account Required')).toBeInTheDocument()
    expect(screen.queryByTestId('gift-offer-line')).toBeNull()
  })

  it('renders email verification required banner when unverified', async () => {
    mocks.fetchMe.mockResolvedValue({
      user: {
        id: 'user-1',
        authProvider: 'password',
        email: 'test@example.com',
        emailVerified: false,
      },
    })
    mocks.fetchBillingMe.mockResolvedValue({
      creditBalance: 0,
      entitlements: [],
      stripeConfigured: true,
    })

    render(() => <PromoCodeCard />)

    expect(
      await screen.findByText('Email Verification Required'),
    ).toBeInTheDocument()

    const resendBtn = screen.getByRole('button', {
      name: /resend verification link/i,
    })
    fireEvent.click(resendBtn)
    expect(mocks.resendVerificationEmail).toHaveBeenCalled()
  })

  it('claims the code on offer in one click for a verified account', async () => {
    mocks.fetchMe.mockResolvedValue(VERIFIED)
    mocks.fetchBillingMe.mockResolvedValue({
      creditBalance: 0,
      entitlements: [],
      redeemedPromos: [],
      stripeConfigured: true,
    })
    mocks.redeemPromoCode.mockResolvedValue({
      success: true,
      code: 'LAUNCH',
      creditsGranted: 5,
      newBalance: 5,
    })

    render(() => <PromoCodeCard />)

    const claimBtn = await screen.findByTestId('claim-promo-btn')
    expect(claimBtn).toBeInTheDocument()
    expect(mocks.loadFeaturedPromo).toHaveBeenCalled()

    fireEvent.click(claimBtn)

    await waitFor(() => {
      expect(mocks.redeemPromoCode).toHaveBeenCalledWith('LAUNCH')
      expect(
        screen.getByText(/promo code LAUNCH redeemed/i),
      ).toBeInTheDocument()
    })
    // The header pill steps aside, and the claim is counted.
    expect(mocks.recordPromoClaim).toHaveBeenCalledWith({
      code: 'LAUNCH',
      credits: 5,
      claimedAt: expect.any(String),
    })
  })

  it('says when the code on offer was claimed', async () => {
    mocks.fetchMe.mockResolvedValue(VERIFIED)
    const claimedAt = new Date(new Date().getFullYear(), 9, 9, 12).toISOString()
    mocks.fetchBillingMe.mockResolvedValue({
      creditBalance: 5,
      entitlements: [],
      redeemedPromos: ['LAUNCH'],
      promoClaims: [{ code: 'LAUNCH', credits: 5, claimedAt }],
      stripeConfigured: true,
    })

    render(() => <PromoCodeCard />)

    const day = new Date(claimedAt).toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'short',
    })
    const claimed = await screen.findByText(`Claimed on ${day}`)
    expect(claimed.parentElement).toHaveTextContent('5 free credits')
    expect(screen.queryByTestId('claim-promo-btn')).toBeNull()
  })

  it('shows Claimed once the code on offer has been redeemed', async () => {
    mocks.fetchMe.mockResolvedValue(VERIFIED)
    mocks.fetchBillingMe.mockResolvedValue({
      creditBalance: 5,
      entitlements: [],
      redeemedPromos: ['LAUNCH'],
      stripeConfigured: true,
    })

    render(() => <PromoCodeCard />)

    // The pill sits on the card for the code on offer, in place of its button.
    const claimed = await screen.findByText('Claimed')
    expect(claimed.parentElement).toHaveTextContent('5 free credits')
    expect(screen.queryByTestId('claim-promo-btn')).toBeNull()
  })

  it('still offers the current code to someone who claimed an earlier one', async () => {
    mocks.fetchMe.mockResolvedValue(VERIFIED)
    mocks.fetchBillingMe.mockResolvedValue({
      creditBalance: 5,
      entitlements: [],
      redeemedPromos: ['PRODUCT_HUNT'],
      stripeConfigured: true,
    })

    render(() => <PromoCodeCard />)

    const claimBtn = await screen.findByTestId('claim-promo-btn')
    expect(claimBtn).toHaveTextContent('Claim 5 free credits')
    expect(screen.queryByText('Claimed')).toBeNull()
    fireEvent.click(claimBtn)
    await waitFor(() => {
      expect(mocks.redeemPromoCode).toHaveBeenCalledWith('LAUNCH')
    })
  })

  it('offers the credits the server names, under the code it names', async () => {
    mocks.setOffer({ code: 'WINTER', credits: 8, expiresAt: null })
    mocks.fetchMe.mockResolvedValue(VERIFIED)
    mocks.fetchBillingMe.mockResolvedValue({
      creditBalance: 0,
      entitlements: [],
      redeemedPromos: [],
      stripeConfigured: true,
    })

    render(() => <PromoCodeCard />)

    const claimBtn = await screen.findByTestId('claim-promo-btn')
    expect(claimBtn).toHaveTextContent('Claim 8 free credits')
    expect(screen.getByText('WINTER')).toBeInTheDocument()
    fireEvent.click(claimBtn)
    await waitFor(() => {
      expect(mocks.redeemPromoCode).toHaveBeenCalledWith('WINTER')
    })
  })

  it('shows the offer when it arrives after the card has opened', async () => {
    mocks.setOffer(null)
    mocks.fetchMe.mockResolvedValue(VERIFIED)
    mocks.fetchBillingMe.mockResolvedValue({
      creditBalance: 0,
      entitlements: [],
      redeemedPromos: [],
      stripeConfigured: true,
    })

    render(() => <PromoCodeCard />)
    expect(await screen.findByTestId('promo-input')).toBeInTheDocument()
    expect(screen.queryByTestId('claim-promo-btn')).toBeNull()

    mocks.setOffer(LAUNCH)
    expect(await screen.findByTestId('claim-promo-btn')).toHaveTextContent(
      'Claim 5 free credits',
    )
  })

  it('allows manual entry of promo codes', async () => {
    mocks.fetchMe.mockResolvedValue({
      user: {
        id: 'user-1',
        authProvider: 'password',
        email: 'test@example.com',
        emailVerified: true,
      },
    })
    mocks.fetchBillingMe.mockResolvedValue({
      creditBalance: 5,
      entitlements: [],
      redeemedPromos: ['PRODUCT_HUNT'],
      stripeConfigured: true,
    })
    mocks.redeemPromoCode.mockResolvedValue({
      success: true,
      code: 'SUMMER_DEAL',
      creditsGranted: 10,
      newBalance: 15,
    })

    render(() => <PromoCodeCard />)

    const input = await screen.findByTestId('promo-input')
    const submitBtn = screen.getByTestId('promo-submit-btn')

    fireEvent.input(input, { target: { value: 'SUMMER_DEAL' } })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(mocks.redeemPromoCode).toHaveBeenCalledWith('SUMMER_DEAL')
      expect(
        screen.getByText(/promo code SUMMER_DEAL redeemed/i),
      ).toBeInTheDocument()
    })
  })

  it('shows error feedback when redemption fails', async () => {
    mocks.fetchMe.mockResolvedValue({
      user: {
        id: 'user-1',
        authProvider: 'password',
        email: 'test@example.com',
        emailVerified: true,
      },
    })
    mocks.fetchBillingMe.mockResolvedValue({
      creditBalance: 0,
      entitlements: [],
      redeemedPromos: [],
      stripeConfigured: true,
    })
    mocks.redeemPromoCode.mockRejectedValue(
      new Error('This promo code has expired.'),
    )

    render(() => <PromoCodeCard />)

    const claimBtn = await screen.findByTestId('claim-promo-btn')
    fireEvent.click(claimBtn)

    await waitFor(() => {
      expect(
        screen.getByText('This promo code has expired.'),
      ).toBeInTheDocument()
    })
  })

  it('stops offering free credits when nothing is on offer', async () => {
    mocks.setOffer(null)
    mocks.fetchMe.mockResolvedValue(VERIFIED)
    mocks.fetchBillingMe.mockResolvedValue({
      creditBalance: 0,
      entitlements: [],
      redeemedPromos: [],
      stripeConfigured: true,
    })

    render(() => <PromoCodeCard />)

    // The manual code entry stays; the one-click offer and its copy go.
    expect(await screen.findByTestId('promo-input')).toBeInTheDocument()
    expect(screen.queryByTestId('claim-promo-btn')).toBeNull()
    expect(screen.queryByText(/free credits/i)).toBeNull()
    expect(screen.getByText(/^Redeem a promotional code/)).toHaveTextContent(
      'Redeem a promotional code for cloud vocal separation credits.',
    )
  })

  it('tells a signed-out visitor how many song separations an account would get', async () => {
    mocks.fetchMe.mockResolvedValue(null)
    mocks.fetchBillingMe.mockResolvedValue({
      creditBalance: 0,
      entitlements: [],
      stripeConfigured: true,
    })

    render(() => <PromoCodeCard />)

    // Someone without an account has not met a credit yet, so the gift is
    // named by what it buys, as onboarding and Karaoke Night name it.
    expect(await screen.findByText('Account Required')).toBeInTheDocument()
    expect(
      screen.getByText(/verify your email to claim up to 5/i),
    ).toHaveTextContent(
      'Create a free account and verify your email to claim up to 5 free song separations.',
    )
    expect(screen.getByText(/^Claim up to 5/)).toHaveTextContent(
      'Claim up to 5 free song separations on the Cloud GPU, or redeem a code you were given.',
    )
    expect(screen.queryByText(/free credits/i)).toBeNull()
  })

  it('names the credits on offer, and what they buy, to a signed-in account', async () => {
    mocks.fetchMe.mockResolvedValue(VERIFIED)
    mocks.fetchBillingMe.mockResolvedValue({
      creditBalance: 0,
      entitlements: [],
      redeemedPromos: [],
      stripeConfigured: true,
    })

    render(() => <PromoCodeCard />)

    // Settings > Credits is about the balance, so the card keeps "credits".
    expect(await screen.findByTestId('claim-promo-btn')).toBeInTheDocument()
    expect(screen.getByText('5 free credits')).toBeInTheDocument()
    expect(
      screen.getByText('Up to 5 song separations on the Cloud GPU'),
    ).toBeInTheDocument()
    expect(screen.getByText(/^Claim 5 free credits for/)).toHaveTextContent(
      'Claim 5 free credits for separating songs on the Cloud GPU, or redeem a code you were given.',
    )
  })

  it('says one credit, not "1 free credits", for a code worth one', async () => {
    mocks.setOffer({ ...LAUNCH, credits: 1 })
    mocks.fetchMe.mockResolvedValue(VERIFIED)
    mocks.fetchBillingMe.mockResolvedValue({
      creditBalance: 0,
      entitlements: [],
      redeemedPromos: [],
      stripeConfigured: true,
    })

    render(() => <PromoCodeCard />)

    const title = await screen.findByText('1 free credit')
    expect(title.parentElement).toHaveTextContent(
      '1 free credit1 song separation on the Cloud GPU',
    )
    expect(screen.queryByText(/1 free credits/)).toBeNull()
  })

  // The button, the line under the form and the toast: every place the
  // card counts credits says "1 credit", never "1 credits".
  for (const [credits, words] of [
    [1, '1 free credit'],
    [5, '5 free credits'],
  ] as const) {
    it(`counts ${credits} on the claim button and in what the claim says back`, async () => {
      mocks.setOffer({ ...LAUNCH, credits })
      mocks.fetchMe.mockResolvedValue(VERIFIED)
      mocks.fetchBillingMe.mockResolvedValue({
        creditBalance: 0,
        entitlements: [],
        redeemedPromos: [],
        stripeConfigured: true,
      })
      mocks.redeemPromoCode.mockResolvedValue({
        success: true,
        code: 'LAUNCH',
        creditsGranted: credits,
        newBalance: credits,
      })

      render(() => <PromoCodeCard />)

      const claimBtn = await screen.findByTestId('claim-promo-btn')
      expect(claimBtn.textContent).toBe(`Claim ${words}`)
      fireEvent.click(claimBtn)

      expect(
        (await screen.findByText(/promo code LAUNCH redeemed/i)).textContent,
      ).toBe(`Promo code LAUNCH redeemed! +${words} added.`)
      expect(mocks.showNotification).toHaveBeenCalledWith(
        `+${words} added to your account!`,
        'info',
      )
    })
  }

  it('tells a signed-out visitor about free credits only while some are on offer', async () => {
    mocks.setOffer(null)
    mocks.fetchMe.mockResolvedValue(null)
    mocks.fetchBillingMe.mockResolvedValue({
      creditBalance: 0,
      entitlements: [],
      stripeConfigured: true,
    })

    render(() => <PromoCodeCard />)

    expect(await screen.findByText('Account Required')).toBeInTheDocument()
    expect(screen.queryByText(/song separation/i)).toBeNull()
    expect(screen.getByText(/redeem promo codes/i)).toHaveTextContent(
      'Create a free account and verify your email to redeem promo codes.',
    )
  })
})
