// ============================================================
// PricingPanel component tests
// ============================================================

import { render, screen, waitFor } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/db/services/billing-service', async (importOriginal) => {
  // Keep formatPrice real; stub the network calls.
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    fetchPricing: vi.fn(),
    startCheckout: vi.fn(),
    fetchBillingMe: vi.fn(),
  }
})

import { PricingPanel } from '@/components/billing/PricingPanel'
import type { Pricing } from '@/db/services/billing-service'
import { fetchBillingMe, fetchPricing } from '@/db/services/billing-service'

const PRICING: Pricing = {
  currency: 'eur',
  tiers: [
    {
      id: 't-gpu',
      kind: 'tier',
      label: 'Server (GPU)',
      description: 'Fastest',
      unit: 'song',
      amount: null, // priced in credits, not money
      currency: 'eur',
      credits: 1, // → "1 credit / song" (live, not "Soon")
      badge: 'Default',
      purchasable: false,
    },
    {
      id: 't-cpu',
      kind: 'tier',
      label: 'Server (CPU)',
      description: 'Cheaper',
      unit: 'song',
      amount: null, // no money price and…
      currency: 'eur',
      credits: null, // …no credit cost → genuinely "Soon"
      badge: null,
      purchasable: false,
    },
  ],
  packs: [
    {
      id: 'p-soon',
      kind: 'pack',
      label: 'Starter',
      description: null,
      unit: null,
      amount: null, // → "Soon", Buy disabled
      currency: 'eur',
      credits: null,
      badge: null,
      purchasable: false,
    },
    {
      id: 'p-buy',
      kind: 'pack',
      label: 'Plus',
      description: null,
      unit: null,
      amount: 800,
      currency: 'eur',
      credits: 50,
      badge: null,
      purchasable: true,
    },
  ],
  stripeConfigured: true,
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('PricingPanel', () => {
  it('shows the credit balance chip when billing info is available', async () => {
    vi.mocked(fetchPricing).mockResolvedValue(PRICING)
    vi.mocked(fetchBillingMe).mockResolvedValue({
      creditBalance: 30,
      entitlements: [],
      stripeConfigured: true,
    })
    render(() => <PricingPanel />)
    await waitFor(() =>
      expect(screen.getByTestId('credit-balance')).toBeInTheDocument(),
    )
    expect(screen.getByTestId('credit-balance').textContent).toContain('30')
  })

  it('hides the balance chip when logged out (me is null)', async () => {
    vi.mocked(fetchPricing).mockResolvedValue(PRICING)
    vi.mocked(fetchBillingMe).mockResolvedValue(null)
    render(() => <PricingPanel />)
    await waitFor(() =>
      expect(screen.getByText('Server (GPU)')).toBeInTheDocument(),
    )
    expect(screen.queryByTestId('credit-balance')).not.toBeInTheDocument()
  })

  it('shows a credit-priced tier as its per-song cost, not "Soon"', async () => {
    vi.mocked(fetchPricing).mockResolvedValue(PRICING)
    render(() => <PricingPanel />)

    await waitFor(() =>
      expect(screen.getByText('Server (GPU)')).toBeInTheDocument(),
    )
    // GPU tier is live (credits set) → shows "1 credit / song".
    expect(screen.getByText('1 credit')).toBeInTheDocument()
    // CPU tier has neither money price nor credit cost → still "Soon".
    const gpuCard = screen
      .getByText('Server (GPU)')
      .closest('[data-testid="pricing-tier"]')
    expect(gpuCard?.textContent).not.toContain('Soon')
    const cpuCard = screen
      .getByText('Server (CPU)')
      .closest('[data-testid="pricing-tier"]')
    expect(cpuCard?.textContent).toContain('Soon')
  })

  it('renders tiers/packs with Soon tags and a buyable pack', async () => {
    vi.mocked(fetchPricing).mockResolvedValue(PRICING)
    render(() => <PricingPanel />)

    await waitFor(() =>
      expect(screen.getByText('Server (GPU)')).toBeInTheDocument(),
    )
    // Unset prices render as "Soon" (CPU tier, pack price, pack button).
    expect(screen.getAllByText('Soon').length).toBeGreaterThan(0)

    const buyButtons = screen.getAllByTestId('pricing-buy')
    const labels = buyButtons.map((b) => b.textContent)
    expect(labels).toContain('Buy')
    expect(labels).toContain('Soon')

    const soonBtn = buyButtons.find((b) => b.textContent === 'Soon')
    const buyBtn = buyButtons.find((b) => b.textContent === 'Buy')
    expect(soonBtn).toBeDisabled()
    expect(buyBtn).not.toBeDisabled()
  })

  it('shows a "coming soon" note when there is no API', async () => {
    vi.mocked(fetchPricing).mockResolvedValue(null)
    render(() => <PricingPanel />)
    await waitFor(() =>
      expect(
        screen.getByText('Credit packs are coming soon.'),
      ).toBeInTheDocument(),
    )
  })
})
