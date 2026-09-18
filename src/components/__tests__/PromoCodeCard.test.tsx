// ============================================================
// PromoCodeCard component tests
// ============================================================

import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  fetchMe: vi.fn(),
  resendVerificationEmail: vi.fn(),
  fetchBillingMe: vi.fn(),
  redeemPromoCode: vi.fn(),
  showNotification: vi.fn(),
  openAuthModal: vi.fn(),
  isLaunchPromoOpen: vi.fn(() => true),
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

vi.mock('@/components/billing/launch-promo', () => ({
  LAUNCH_PROMO: {
    code: 'PRODUCT_HUNT',
    credits: 5,
    endsAt: '2026-09-30T23:59:59.000Z',
  },
  isLaunchPromoOpen: mocks.isLaunchPromoOpen,
}))

import { PromoCodeCard } from '../billing/PromoCodeCard'

describe('PromoCodeCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.isLaunchPromoOpen.mockReturnValue(true)
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

  it('renders one-click claim button for verified user when PRODUCT_HUNT is unredeemed', async () => {
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
    mocks.redeemPromoCode.mockResolvedValue({
      success: true,
      code: 'PRODUCT_HUNT',
      creditsGranted: 5,
      newBalance: 5,
    })

    render(() => <PromoCodeCard />)

    const claimBtn = await screen.findByTestId('claim-ph-btn')
    expect(claimBtn).toBeInTheDocument()

    fireEvent.click(claimBtn)

    await waitFor(() => {
      expect(mocks.redeemPromoCode).toHaveBeenCalledWith('PRODUCT_HUNT')
      expect(
        screen.getByText(/promo code PRODUCT_HUNT redeemed/i),
      ).toBeInTheDocument()
    })
  })

  it('displays Claimed pill when PRODUCT_HUNT has already been redeemed', async () => {
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

    render(() => <PromoCodeCard />)

    expect(await screen.findByText('Claimed')).toBeInTheDocument()
    expect(screen.queryByTestId('claim-ph-btn')).not.toBeInTheDocument()
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

    const claimBtn = await screen.findByTestId('claim-ph-btn')
    fireEvent.click(claimBtn)

    await waitFor(() => {
      expect(
        screen.getByText('This promo code has expired.'),
      ).toBeInTheDocument()
    })
  })

  it('stops offering the launch gift once the campaign has closed', async () => {
    mocks.isLaunchPromoOpen.mockReturnValue(false)
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

    render(() => <PromoCodeCard />)

    // The manual code entry stays; the one-click gift and its copy go.
    expect(await screen.findByTestId('promo-input')).toBeInTheDocument()
    expect(screen.queryByTestId('claim-ph-btn')).not.toBeInTheDocument()
    expect(screen.queryByText(/launch gift/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/free credits/i)).not.toBeInTheDocument()
    expect(screen.getByText('Promo Codes')).toBeInTheDocument()
  })

  it('tells a signed-out visitor about the gift only while it is open', async () => {
    mocks.isLaunchPromoOpen.mockReturnValue(false)
    mocks.fetchMe.mockResolvedValue(null)
    mocks.fetchBillingMe.mockResolvedValue({
      creditBalance: 0,
      entitlements: [],
      stripeConfigured: true,
    })

    render(() => <PromoCodeCard />)

    expect(await screen.findByText('Account Required')).toBeInTheDocument()
    expect(
      screen.queryByText(/free cloud separation credits/i),
    ).not.toBeInTheDocument()
    expect(screen.getByText(/redeem promo codes/i)).toBeInTheDocument()
  })
})
