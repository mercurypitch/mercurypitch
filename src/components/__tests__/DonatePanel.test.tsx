// ============================================================
// DonatePanel component tests
// ============================================================

import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/db/services/billing-service', async (importOriginal) => {
  // Keep the formatters real; stub the network calls.
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    fetchPricing: vi.fn(),
    fetchBillingMe: vi.fn(),
    startCheckout: vi.fn(),
  }
})

vi.mock('@/db/services/auth-service', () => ({
  restoreAuth: vi.fn().mockResolvedValue(true),
  fetchMe: vi.fn(),
}))

import { DonatePanel } from '@/components/billing/DonatePanel'
import { fetchMe } from '@/db/services/auth-service'
import type { Pricing, PricingPlan } from '@/db/services/billing-service'
import { fetchBillingMe, fetchPricing } from '@/db/services/billing-service'
import { authModalMode, closeAuthModal } from '@/stores/ui-store'

const plan = (over: Partial<PricingPlan>): PricingPlan => ({
  id: 'sup-fund',
  kind: 'donation',
  label: 'Fund',
  description: null,
  unit: null,
  amount: 500,
  currency: 'eur',
  credits: null,
  badge: null,
  purchasable: true,
  customAmount: false,
  entitlementDays: 30,
  perks: ['Supporter badge', 'MercuryPitch Lab: beta and development features'],
  ...over,
})

const pricing = (donations: PricingPlan[]): Pricing => ({
  currency: 'eur',
  tiers: [],
  packs: [],
  donations,
  stripeConfigured: true,
})

/** Signed-in with a real (non-anonymous) account. */
const upgraded = { user: { authProvider: 'password' } }

afterEach(() => {
  vi.resetAllMocks()
  // The auth modal is a module-level signal shared across tests.
  closeAuthModal()
})

describe('DonatePanel', () => {
  it('renders a card per donation tier with its perk bullets', async () => {
    vi.mocked(fetchPricing).mockResolvedValue(
      pricing([
        plan({ id: 'sup-fund', label: 'Fund' }),
        plan({
          id: 'sup-extras',
          label: 'Extras',
          amount: 1000,
          entitlementDays: 90,
          perks: ['Everything in Fund', 'Mascot costumes (coming)'],
        }),
      ]),
    )
    vi.mocked(fetchBillingMe).mockResolvedValue(null)
    vi.mocked(fetchMe).mockResolvedValue(upgraded as never)

    render(() => <DonatePanel />)
    await waitFor(() =>
      expect(screen.getAllByTestId('donate-tier')).toHaveLength(2),
    )
    expect(screen.getByText('Mascot costumes (coming)')).toBeInTheDocument()
    expect(
      screen.getAllByText('MercuryPitch Lab: beta and development features'),
    ).toHaveLength(1)
    expect(
      screen.getByText(/Core singing and practice tools stay free/i),
    ).toBeInTheDocument()
    // 90 days reads as months, not a day count.
    expect(screen.getByText('3 months of perks')).toBeInTheDocument()
  })

  it('shows "You choose" for the custom-amount tier instead of a price', async () => {
    vi.mocked(fetchPricing).mockResolvedValue(
      pricing([
        plan({
          id: 'sup-custom',
          label: 'Other amount',
          amount: null,
          customAmount: true,
          purchasable: true,
        }),
      ]),
    )
    vi.mocked(fetchBillingMe).mockResolvedValue(null)
    vi.mocked(fetchMe).mockResolvedValue(upgraded as never)

    render(() => <DonatePanel />)
    // Wait on the button, not the price: the account resource settles after
    // the pricing one, and the button only replaces the sign-in CTA then.
    await waitFor(() =>
      expect(screen.getByTestId('donate-button')).toBeInTheDocument(),
    )
    expect(screen.getByText('You choose')).toBeInTheDocument()
    expect(screen.getByTestId('donate-button')).not.toBeDisabled()
  })

  // Prices are wired per environment; until then the row must not look buyable.
  it('disables an unwired tier and labels it Soon', async () => {
    vi.mocked(fetchPricing).mockResolvedValue(
      pricing([plan({ amount: null, purchasable: false })]),
    )
    vi.mocked(fetchBillingMe).mockResolvedValue(null)
    vi.mocked(fetchMe).mockResolvedValue(upgraded as never)

    render(() => <DonatePanel />)
    await waitFor(() =>
      expect(screen.getByTestId('donate-button')).toBeInTheDocument(),
    )
    expect(screen.getByTestId('donate-button')).toBeDisabled()
    expect(screen.getByTestId('donate-button').textContent).toContain('Soon')
  })

  // The worker 403s anonymous checkouts, so never show them a live button.
  it('asks anonymous users to create an account first', async () => {
    vi.mocked(fetchPricing).mockResolvedValue(pricing([plan({})]))
    vi.mocked(fetchBillingMe).mockResolvedValue(null)
    vi.mocked(fetchMe).mockResolvedValue({
      user: { authProvider: 'anonymous' },
    } as never)

    render(() => <DonatePanel />)
    await waitFor(() =>
      expect(screen.getByTestId('donate-signin')).toBeInTheDocument(),
    )
    expect(screen.queryByTestId('donate-button')).not.toBeInTheDocument()
  })

  // It used to link to #/settings/account, which is the panel this card is
  // already inside: the click looked like it did nothing, and the visitor had
  // to find the sign-in button themselves. Open the dialog instead.
  it('opens the sign-up dialog instead of navigating to the account panel', async () => {
    vi.mocked(fetchPricing).mockResolvedValue(pricing([plan({})]))
    vi.mocked(fetchBillingMe).mockResolvedValue(null)
    vi.mocked(fetchMe).mockResolvedValue({
      user: { authProvider: 'anonymous' },
    } as never)

    render(() => <DonatePanel />)
    const cta = await screen.findByTestId('donate-signin')
    expect(cta).not.toHaveAttribute('href')
    expect(authModalMode()).toBeNull()

    fireEvent.click(cta)
    expect(authModalMode()).toBe('register')
  })

  it('does not offer donations to managed testing accounts', async () => {
    vi.mocked(fetchPricing).mockResolvedValue(pricing([plan({})]))
    vi.mocked(fetchBillingMe).mockResolvedValue({
      creditBalance: 10,
      entitlements: [],
      stripeConfigured: false,
    })
    vi.mocked(fetchMe).mockResolvedValue({
      user: { authProvider: 'password', isTestAccount: true },
    } as never)

    render(() => <DonatePanel />)
    const button = await screen.findByRole('button', {
      name: 'Managed account',
    })
    expect(button).toBeDisabled()
  })

  it('greets a current supporter with their expiry', async () => {
    vi.mocked(fetchPricing).mockResolvedValue(pricing([plan({})]))
    vi.mocked(fetchBillingMe).mockResolvedValue({
      creditBalance: 0,
      entitlements: [
        {
          feature: 'supporter',
          source: 'donation:sup-fund',
          expiresAt: '2099-10-12T00:00:00.000Z',
        },
      ],
      stripeConfigured: true,
    })
    vi.mocked(fetchMe).mockResolvedValue(upgraded as never)

    render(() => <DonatePanel />)
    await waitFor(() =>
      expect(screen.getByTestId('donate-supporter-note')).toBeInTheDocument(),
    )
  })

  it('ignores a lapsed supporter grant', async () => {
    vi.mocked(fetchPricing).mockResolvedValue(pricing([plan({})]))
    vi.mocked(fetchBillingMe).mockResolvedValue({
      creditBalance: 0,
      entitlements: [
        {
          feature: 'supporter',
          source: 'donation:sup-fund',
          expiresAt: '2020-01-01T00:00:00.000Z',
        },
      ],
      stripeConfigured: true,
    })
    vi.mocked(fetchMe).mockResolvedValue(upgraded as never)

    render(() => <DonatePanel />)
    await waitFor(() =>
      expect(screen.getByTestId('donate-tier')).toBeInTheDocument(),
    )
    expect(
      screen.queryByTestId('donate-supporter-note'),
    ).not.toBeInTheDocument()
  })
})
