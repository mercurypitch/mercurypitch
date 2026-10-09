// ============================================================
// PricingPanel component tests
// ============================================================

import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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

// accountHeld decodes the stored token, which no test has. Stub just that
// predicate — the rest of the module stays real because the nested
// DonatePanel imports restoreAuth/fetchMe from it.
let held = true
vi.mock('@/db/services/auth-service', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    accountHeld: () => held,
    fetchMe: vi.fn().mockResolvedValue(null),
    restoreAuth: vi.fn().mockResolvedValue(false),
  }
})

import { PricingPanel } from '@/components/billing/PricingPanel'
import type { Pricing } from '@/db/services/billing-service'
import { fetchBillingMe, fetchPricing } from '@/db/services/billing-service'
import { askForPacks, packsAsked, packsShown } from '@/lib/launch-offer'
import { setUvrProcessingMode } from '@/stores/app-store'
import { authModalMode, closeAuthModal, creditCostGuideRequested, setCreditCostGuideRequested, } from '@/stores/ui-store'

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
      label: 'Cloud CPU',
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
      label: 'Cloud GPU',
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
  uvrModelCredits: { mdx: 1, roformer: 1, karaoke: 1, ensemble: 2 },
  stripeConfigured: true,
}

afterEach(() => {
  vi.resetAllMocks()
  // The picker writes through to the persisted app-store signal — reset so
  // test order can't leak selection state.
  setUvrProcessingMode('local')
  // Both are module-level: an account state or an open dialog left behind
  // would decide the next test's Buy label for it.
  held = true
  closeAuthModal()
  setCreditCostGuideRequested(false)
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
      expect(screen.getByText('Cloud GPU')).toBeInTheDocument(),
    )
    expect(screen.queryByTestId('credit-balance')).not.toBeInTheDocument()
  })

  it('does not offer checkout when billing is unavailable for the account', async () => {
    vi.mocked(fetchPricing).mockResolvedValue(PRICING)
    vi.mocked(fetchBillingMe).mockResolvedValue({
      creditBalance: 30,
      entitlements: [],
      stripeConfigured: false,
    })
    render(() => <PricingPanel />)

    const button = await screen.findByRole('button', { name: 'Unavailable' })
    expect(button).toBeDisabled()
  })

  it('prices the GPU card at the tier base; CPU stays "Soon"', async () => {
    vi.mocked(fetchPricing).mockResolvedValue(PRICING)
    render(() => <PricingPanel />)

    await waitFor(() =>
      expect(screen.getByText('Cloud GPU')).toBeInTheDocument(),
    )
    // Single server quality → the card shows the tier's 1-credit per-song
    // cost, never "Soon".
    const gpuCard = screen.getByTestId('pricing-tier-tier-runpod-gpu')
    expect(gpuCard.textContent).toContain('from 1 credit / song')
    expect(gpuCard.textContent).not.toContain('Soon')
    // CPU tier has neither money price nor credit cost → still "Soon",
    // rendered as a disabled (not selectable) card.
    const cpuCard = screen.getByTestId(
      'pricing-tier-tier-runpod-cpu',
    ) as HTMLButtonElement
    expect(cpuCard.textContent).toContain('Soon')
    expect(cpuCard.disabled).toBe(true)
  })

  it('explains what a song costs under the processing cards', async () => {
    vi.mocked(fetchPricing).mockResolvedValue(PRICING)
    render(() => <PricingPanel />)

    fireEvent.click(await screen.findByTestId('credit-cost-chip'))
    const guide = screen.getByTestId('credit-cost-guide')
    expect(guide.textContent?.replace(/\s+/g, ' ')).toContain('2 stems1 credit')
    // This fixture prices no band split, so the guide claims no full band.
    expect(guide.textContent).not.toContain('Full band')
  })

  it('clicking a tier card moves the processing selection', async () => {
    vi.mocked(fetchPricing).mockResolvedValue(PRICING)
    render(() => <PricingPanel />)
    await waitFor(() =>
      expect(screen.getByText('Cloud GPU')).toBeInTheDocument(),
    )

    // Default mode is on-device: its card is selected.
    expect(
      screen
        .getByTestId('pricing-tier-tier-ondevice')
        .getAttribute('aria-pressed'),
    ).toBe('true')

    // Click the GPU card → selection moves; no quality chips exist anymore
    // (single server quality).
    fireEvent.click(screen.getByTestId('pricing-tier-tier-runpod-gpu'))
    expect(
      screen
        .getByTestId('pricing-tier-tier-runpod-gpu')
        .getAttribute('aria-pressed'),
    ).toBe('true')
    expect(
      screen.queryByTestId('settings-uvr-quality-mdx'),
    ).not.toBeInTheDocument()
  })

  it('renders tiers/packs with Soon tags and a buyable pack', async () => {
    vi.mocked(fetchPricing).mockResolvedValue(PRICING)
    render(() => <PricingPanel />)

    await waitFor(() =>
      expect(screen.getByText('Cloud GPU')).toBeInTheDocument(),
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

  // Checkout needs a real account (the worker 403s an anonymous token), so a
  // signed-out visitor got a Buy button that could only fail. Offer the
  // account instead, and open the dialog on the spot.
  it('offers an account instead of Buy when nobody is signed in', async () => {
    held = false
    vi.mocked(fetchPricing).mockResolvedValue(PRICING)
    vi.mocked(fetchBillingMe).mockResolvedValue(null)
    render(() => <PricingPanel />)

    const cta = await screen.findByRole('button', { name: 'Create account' })
    expect(cta).not.toBeDisabled()
    // The unpriced pack still reads "Soon" — there is nothing to sign up for.
    expect(
      screen.getAllByTestId('pricing-buy').map((b) => b.textContent),
    ).toEqual(expect.arrayContaining(['Soon', 'Create account']))
    expect(
      screen.queryByRole('button', { name: 'Buy' }),
    ).not.toBeInTheDocument()

    expect(authModalMode()).toBeNull()
    fireEvent.click(cta)
    expect(authModalMode()).toBe('register')
  })

  // Billing being unavailable for the account outranks the account offer:
  // there is no checkout to send them to either way.
  it('still says Unavailable when checkout is off, signed out or not', async () => {
    held = false
    vi.mocked(fetchPricing).mockResolvedValue(PRICING)
    vi.mocked(fetchBillingMe).mockResolvedValue({
      creditBalance: 0,
      entitlements: [],
      stripeConfigured: false,
    })
    render(() => <PricingPanel />)

    const button = await screen.findByRole('button', { name: 'Unavailable' })
    expect(button).toBeDisabled()
  })

  describe('the launch offer', () => {
    const OFFER = {
      used: 2,
      goal: 5,
      deadline: '2026-10-23T23:59:59.999Z',
      bonusCredits: 30,
    }
    const meWith = (offer: unknown) => ({
      creditBalance: 3,
      entitlements: [],
      stripeConfigured: true,
      offer,
    })
    const packLines = () =>
      screen
        .getAllByTestId('pricing-pack')
        .map((card) => card.querySelector('p')?.textContent?.trim())

    it('adds the earned credits to every pack', async () => {
      vi.mocked(fetchPricing).mockResolvedValue(PRICING)
      vi.mocked(fetchBillingMe).mockResolvedValue(
        meWith({ ...OFFER, state: 'unlocked', used: 5 }) as never,
      )
      render(() => <PricingPanel />)

      const banner = await screen.findByTestId('offer-banner')
      expect(banner.textContent).toBe('30 extra credits on your next pack')
      expect(packLines()).toEqual(['Credits: Soon', '50 + 30 credits'])
      // The packs are right here: no progress block pointing at them.
      expect(screen.queryByTestId('launch-offer-progress')).toBeNull()
    })

    it('shows the count while the window is open, and no extra credits yet', async () => {
      vi.mocked(fetchPricing).mockResolvedValue(PRICING)
      vi.mocked(fetchBillingMe).mockResolvedValue(
        meWith({ ...OFFER, state: 'counting' }) as never,
      )
      render(() => <PricingPanel />)

      const progress = await screen.findByTestId('launch-offer-progress')
      expect(progress.textContent).toContain('2 of 5 used')
      expect(progress.textContent).toContain('Use all 5 by 23 October')
      await screen.findAllByTestId('pricing-pack')
      expect(screen.queryByTestId('offer-banner')).toBeNull()
      expect(packLines()).toEqual(['Credits: Soon', '50 credits'])
    })

    describe('"See the packs"', () => {
      const scrollIntoView = vi.fn()
      beforeEach(() => {
        scrollIntoView.mockReset()
        // jsdom lays nothing out, so it has neither of these.
        Element.prototype.scrollIntoView = scrollIntoView
        vi.stubGlobal('requestAnimationFrame', (run: FrameRequestCallback) => {
          run(0)
          return 0
        })
      })
      afterEach(() => {
        packsShown()
        vi.unstubAllGlobals()
        delete (Element.prototype as Partial<Element>).scrollIntoView
      })

      it('opens Credits at the packs, once they are in', async () => {
        askForPacks()
        vi.mocked(fetchPricing).mockResolvedValue(PRICING)
        vi.mocked(fetchBillingMe).mockResolvedValue(
          meWith({ ...OFFER, state: 'unlocked', used: 5 }) as never,
        )
        render(() => <PricingPanel />)

        await waitFor(() => expect(scrollIntoView).toHaveBeenCalledTimes(1))
        const heading = scrollIntoView.mock.contexts[0] as HTMLElement
        expect(heading.textContent?.trim()).toBe('Credit packs')
        expect(scrollIntoView.mock.calls[0][0]).toMatchObject({
          block: 'start',
        })
        // Answered: opening Credits again starts at the top.
        expect(packsAsked()).toBe(false)
      })

      it('opens Credits at the top when nobody asked for the packs', async () => {
        vi.mocked(fetchPricing).mockResolvedValue(PRICING)
        vi.mocked(fetchBillingMe).mockResolvedValue(
          meWith({ ...OFFER, state: 'unlocked', used: 5 }) as never,
        )
        render(() => <PricingPanel />)

        await screen.findAllByTestId('pricing-pack')
        await screen.findByTestId('offer-banner')
        expect(scrollIntoView).not.toHaveBeenCalled()
      })
    })

    it('says nothing of an offer that is used, lapsed or absent', async () => {
      vi.mocked(fetchPricing).mockResolvedValue(PRICING)
      for (const offer of [
        { ...OFFER, state: 'used', used: 5 },
        { ...OFFER, state: 'lapsed' },
        null,
      ]) {
        vi.mocked(fetchBillingMe).mockResolvedValue(meWith(offer) as never)
        const { unmount } = render(() => <PricingPanel />)
        await waitFor(() =>
          expect(screen.getByTestId('credit-balance')).toBeInTheDocument(),
        )
        await screen.findAllByTestId('pricing-pack')
        expect(screen.queryByTestId('offer-banner')).toBeNull()
        expect(screen.queryByTestId('launch-offer-progress')).toBeNull()
        expect(packLines()).toEqual(['Credits: Soon', '50 credits'])
        unmount()
      }
    })
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

  // Karaoke Night's "what a song costs" asks for the cost guide open. The
  // ask is made before pricing loads; the guide answers it once it renders.
  it('opens the cost guide once pricing arrives, when a link asked for it', async () => {
    vi.mocked(fetchPricing).mockResolvedValue(PRICING)
    setCreditCostGuideRequested(true)
    render(() => <PricingPanel />)

    const chip = await screen.findByTestId('credit-cost-chip')
    expect(chip.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByTestId('credit-cost-guide')).toBeInTheDocument()
    expect(creditCostGuideRequested()).toBe(false)
  })

  it('drops an ask the guide never got to when Credits closes', async () => {
    vi.mocked(fetchPricing).mockRejectedValue(new Error('offline'))
    setCreditCostGuideRequested(true)
    const { unmount } = render(() => <PricingPanel />)
    await screen.findByText('Credit options are unavailable right now.')
    expect(creditCostGuideRequested()).toBe(true)

    unmount()

    // A later, plain visit must find the guide folded.
    expect(creditCostGuideRequested()).toBe(false)
  })

  describe('the footnote under the packs', () => {
    const footnote = async (): Promise<HTMLElement> => {
      await screen.findAllByTestId('pricing-pack')
      return screen.getByTestId('pricing-footnote')
    }

    it('says a credit purchase can be cancelled for its unused credits', async () => {
      vi.mocked(fetchPricing).mockResolvedValue({
        ...PRICING,
        withdrawal: { mode: 'refund_unused', days: 14 },
      })
      vi.mocked(fetchBillingMe).mockResolvedValue(null)
      render(() => <PricingPanel />)

      const note = await footnote()
      expect(note.textContent).toBe(
        "Credits are prepaid and spent per server-side separation. You can cancel a credit purchase within 14 days and get back the price of credits you haven't used. Donations are voluntary and not refundable. See our Terms.",
      )
      expect(note.querySelector('a')?.getAttribute('href')).toBe(
        'https://about.mercurypitch.com/terms/#withdrawal',
      )
    })

    it('says the right to cancel ends at checkout under waiver', async () => {
      vi.mocked(fetchPricing).mockResolvedValue({
        ...PRICING,
        withdrawal: { mode: 'waiver', days: 14 },
      })
      vi.mocked(fetchBillingMe).mockResolvedValue(null)
      render(() => <PricingPanel />)

      await waitFor(async () =>
        expect((await footnote()).textContent).toContain(
          "They're added the moment you pay, and at checkout you confirm that you then lose your 14-day right to cancel.",
        ),
      )
    })

    it('keeps the default words with an older db-worker', async () => {
      vi.mocked(fetchPricing).mockResolvedValue(PRICING)
      vi.mocked(fetchBillingMe).mockResolvedValue(null)
      render(() => <PricingPanel />)

      expect((await footnote()).textContent).toContain(
        'You can cancel a credit purchase within 14 days',
      )
    })
  })
})
