// ============================================================
// PricingPanel component tests
// ============================================================

import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library'
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
import { setUvrProcessingMode, setUvrQualityModel } from '@/stores/app-store'

const PRICING: Pricing = {
  currency: 'eur',
  tiers: [
    {
      id: 'tier-ondevice',
      kind: 'tier',
      label: 'On-device',
      description: 'Runs in your browser.',
      unit: 'song',
      amount: 0, // free
      currency: 'eur',
      credits: null,
      badge: 'Free',
      purchasable: false,
    },
    {
      id: 'tier-runpod-cpu',
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
    {
      id: 'tier-runpod-gpu',
      kind: 'tier',
      label: 'Server (GPU)',
      description: 'Fastest',
      unit: 'song',
      amount: null, // priced in credits, not money
      currency: 'eur',
      credits: 1, // base per-song cost (the Basic/mdx tier)
      badge: 'Default',
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
  uvrModelCredits: { mdx: 1, roformer: 2, karaoke: 2, ensemble: 3 },
  stripeConfigured: true,
}

afterEach(() => {
  vi.restoreAllMocks()
  // The picker writes through to the persisted app-store signals — reset so
  // test order can't leak selection state.
  setUvrProcessingMode('local')
  setUvrQualityModel('roformer')
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

  it('prices the GPU card for the selected quality; CPU stays "Soon"', async () => {
    vi.mocked(fetchPricing).mockResolvedValue(PRICING)
    render(() => <PricingPanel />)

    await waitFor(() =>
      expect(screen.getByText('Server (GPU)')).toBeInTheDocument(),
    )
    // Default quality is High Quality (roformer) → the GPU card shows the
    // 2-credit per-song cost, never "Soon".
    const gpuCard = screen.getByTestId('pricing-tier-tier-runpod-gpu')
    expect(gpuCard.textContent).toContain('2 credits')
    expect(gpuCard.textContent).not.toContain('Soon')
    // CPU tier has neither money price nor credit cost → still "Soon",
    // rendered as a disabled (not selectable) card.
    const cpuCard = screen.getByTestId(
      'pricing-tier-tier-runpod-cpu',
    ) as HTMLButtonElement
    expect(cpuCard.textContent).toContain('Soon')
    expect(cpuCard.disabled).toBe(true)
  })

  it('selecting the GPU card reveals quality chips and the card price follows the chip', async () => {
    vi.mocked(fetchPricing).mockResolvedValue(PRICING)
    render(() => <PricingPanel />)
    await waitFor(() =>
      expect(screen.getByText('Server (GPU)')).toBeInTheDocument(),
    )

    // Default mode is on-device: its card is selected, no quality chips.
    expect(
      screen
        .getByTestId('pricing-tier-tier-ondevice')
        .getAttribute('aria-pressed'),
    ).toBe('true')
    expect(screen.queryByTestId('settings-uvr-quality')).not.toBeInTheDocument()

    // Click the GPU card → selection moves, quality chips appear.
    fireEvent.click(screen.getByTestId('pricing-tier-tier-runpod-gpu'))
    expect(
      screen
        .getByTestId('pricing-tier-tier-runpod-gpu')
        .getAttribute('aria-pressed'),
    ).toBe('true')
    const basicChip = screen.getByTestId('settings-uvr-quality-mdx')
    expect(basicChip.textContent).toContain('1 credit')

    // Picking Basic drops the GPU card's per-song price to 1 credit.
    fireEvent.click(basicChip)
    expect(
      screen.getByTestId('pricing-tier-tier-runpod-gpu').textContent,
    ).toContain('1 credit')
    expect(
      screen.getByTestId('pricing-tier-tier-runpod-gpu').textContent,
    ).not.toContain('2 credits')
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
