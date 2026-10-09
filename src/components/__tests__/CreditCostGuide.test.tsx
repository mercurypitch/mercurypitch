// ============================================================
// CreditCostGuide — what a song costs, from the live pricing
// ============================================================
import { fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { creditCosts, FULL_BAND_SPLIT_MODEL, } from '@/components/billing/credit-cost-model'
import { CreditCostGuide } from '@/components/billing/CreditCostGuide'
import type { Pricing } from '@/db/services/billing-service'
import { UVR_DEFAULT_MULTI_STEM_MODEL } from '@/lib/uvr-api'
import { creditCostGuideRequested, setCreditCostGuideRequested, } from '@/stores/ui-store'
import { uvrJobCost } from '../../../workers/db-worker/src/billing-core'

/** Today's prices: the GPU tier's base of 1 credit times each model's
 *  multiplier, as /api/billing/pricing serves them. */
const TODAY = { roformer: 1, mdx: 1, 'demucs-6s': 2, demucs: 2, 'demucs-ft': 4 }

const pricing = (uvrModelCredits?: Record<string, number>): Pricing => ({
  currency: 'eur',
  tiers: [],
  packs: [],
  uvrModelCredits,
  stripeConfigured: true,
})

describe('creditCosts', () => {
  it('prices the full band with the model the upload really chains', () => {
    expect(FULL_BAND_SPLIT_MODEL).toBe(UVR_DEFAULT_MULTI_STEM_MODEL)
  })

  it('prices 2 stems and the full band from the live model credits', () => {
    expect(creditCosts(pricing(TODAY))).toMatchObject({
      twoStems: 1,
      fullBand: 3,
      includedMinutes: 12,
      extraBlockMinutes: 6,
    })
  })

  it('works its example the way the worker bills a long song', () => {
    expect(creditCosts(pricing(TODAY))?.example).toEqual({
      minutes: 15,
      times: 2,
      twoStems: 2,
      fullBand: 6,
    })
  })

  it('bills the example song exactly as the worker would', () => {
    // GPU tier base 1 credit; the full band is the split plus the band split.
    const example = creditCosts(pricing(TODAY))?.example
    const seconds = (example?.minutes ?? 0) * 60
    const twoStems = uvrJobCost(1, 'roformer', seconds)
    expect(example?.twoStems).toBe(twoStems)
    expect(example?.fullBand).toBe(
      twoStems + uvrJobCost(1, FULL_BAND_SPLIT_MODEL, seconds),
    )
  })

  it('follows the server when a price changes', () => {
    expect(creditCosts(pricing({ roformer: 2, 'demucs-6s': 4 }))).toMatchObject(
      {
        twoStems: 2,
        fullBand: 6,
        example: { twoStems: 4, fullBand: 12 },
      },
    )
  })

  it('claims nothing while the split has no price', () => {
    expect(creditCosts(pricing(undefined))).toBeNull()
    expect(creditCosts(pricing({ roformer: 0, 'demucs-6s': 2 }))).toBeNull()
  })

  it('leaves the full band out when the band split has no price', () => {
    expect(creditCosts(pricing({ roformer: 1 }))).toMatchObject({
      fullBand: null,
      example: { fullBand: null },
    })
  })
})

describe('CreditCostGuide', () => {
  it('is one closed chip until it is tapped', () => {
    render(() => <CreditCostGuide pricing={pricing(TODAY)} />)
    const chip = screen.getByTestId('credit-cost-chip')
    expect(chip.textContent).toContain('How credits are spent')
    expect(chip.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByTestId('credit-cost-guide')).toBeNull()
  })

  it('opens to what one song costs, and closes again', () => {
    render(() => <CreditCostGuide pricing={pricing(TODAY)} />)
    const chip = screen.getByTestId('credit-cost-chip')
    fireEvent.click(chip)

    expect(chip.getAttribute('aria-expanded')).toBe('true')
    const guide = screen.getByTestId('credit-cost-guide')
    expect(chip.getAttribute('aria-controls')).toBe(guide.id)
    const text = (guide.textContent ?? '').replace(/\s+/g, ' ')
    expect(text).toContain('2 stems1 credit')
    expect(text).toContain('Full band3 credits')
    expect(text).toContain(
      'Up to 12 minutes, a song counts once. Every 6 minutes past that, even part of it, counts again.',
    )
    expect(text).toContain('On this deviceFree')
    expect(
      screen.getByTestId('credit-cost-example').closest('li')?.textContent,
    ).toContain('Long songs')
    expect(text).toContain(
      'If a Cloud GPU split fails, or you cancel it before it starts, the credits come back.',
    )
    expect(
      screen
        .getByTestId('credit-cost-example')
        .textContent?.replace(/\s+/g, ' '),
    ).toBe(
      'A 15-minute song counts twice: 2 credits as 2 stems, 6 as the full band.',
    )

    fireEvent.click(chip)
    expect(chip.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByTestId('credit-cost-guide')).toBeNull()
  })

  it('drops the full band where it has no price', () => {
    render(() => <CreditCostGuide pricing={pricing({ roformer: 1 })} />)
    fireEvent.click(screen.getByTestId('credit-cost-chip'))
    expect(screen.getByTestId('credit-cost-guide').textContent).not.toContain(
      'Full band',
    )
    expect(
      screen
        .getByTestId('credit-cost-example')
        .textContent?.replace(/\s+/g, ' '),
    ).toBe('A 15-minute song counts twice: 2 credits as 2 stems.')
  })

  it('shows nothing while the split has no price', () => {
    render(() => <CreditCostGuide pricing={pricing(undefined)} />)
    expect(screen.queryByTestId('credit-cost-chip')).toBeNull()
  })
})

// "what a song costs" on the Karaoke Night rail promises this guide. The
// router turns that link into a request (use-hash-router.test.tsx); here the
// guide answers it.
describe('CreditCostGuide, reached by its link', () => {
  const originalScrollIntoView = Object.getOwnPropertyDescriptor(
    Element.prototype,
    'scrollIntoView',
  )
  const scrollIntoView = vi.fn()
  /** Frames asked for. setup.ts stubs requestAnimationFrame to never call
   *  back, which would swallow the deferred scroll these tests assert. */
  let frames: FrameRequestCallback[] = []

  const paintFrame = (): void => {
    const due = frames
    frames = []
    for (const callback of due) callback(performance.now())
  }

  /** prefers-reduced-motion, as the media query reports it. */
  const reduceMotion = (reduce: boolean): void => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: reduce && query === '(prefers-reduced-motion: reduce)',
      addEventListener: () => {},
      removeEventListener: () => {},
    }))
  }

  beforeEach(() => {
    // jsdom has no layout, so it has no scrollIntoView either.
    Element.prototype.scrollIntoView = scrollIntoView
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      frames.push(callback)
      return frames.length
    })
    reduceMotion(false)
  })

  afterEach(() => {
    frames = []
    scrollIntoView.mockReset()
    setCreditCostGuideRequested(false)
    vi.unstubAllGlobals()
    if (originalScrollIntoView === undefined) {
      Reflect.deleteProperty(Element.prototype, 'scrollIntoView')
    } else {
      Object.defineProperty(
        Element.prototype,
        'scrollIntoView',
        originalScrollIntoView,
      )
    }
  })

  it('arrives open, then scrolls itself into view', () => {
    setCreditCostGuideRequested(true)
    render(() => <CreditCostGuide pricing={pricing(TODAY)} />)

    const chip = screen.getByTestId('credit-cost-chip')
    const guide = screen.getByTestId('credit-cost-guide')
    expect(chip.getAttribute('aria-expanded')).toBe('true')
    expect(chip.getAttribute('aria-controls')).toBe(guide.id)
    // Not before the open panel has been laid out.
    expect(scrollIntoView).not.toHaveBeenCalled()

    paintFrame()

    expect(scrollIntoView).toHaveBeenCalledTimes(1)
    expect(scrollIntoView).toHaveBeenCalledWith({
      block: 'start',
      behavior: 'smooth',
    })
    // The chip and what it opened arrive together, the chip on top.
    const scrolled = scrollIntoView.mock.contexts[0] as Element
    expect(scrolled.contains(chip)).toBe(true)
    expect(scrolled.contains(guide)).toBe(true)
    // Taken, so the next visit to Credits is a plain one.
    expect(creditCostGuideRequested()).toBe(false)
  })

  it('jumps rather than glides under prefers-reduced-motion', () => {
    reduceMotion(true)
    setCreditCostGuideRequested(true)
    render(() => <CreditCostGuide pricing={pricing(TODAY)} />)

    paintFrame()

    expect(scrollIntoView).toHaveBeenCalledTimes(1)
    expect(scrollIntoView).toHaveBeenCalledWith({
      block: 'start',
      behavior: 'auto',
    })
  })

  it('stays a closed chip, and moves nothing, on a plain visit', () => {
    render(() => <CreditCostGuide pricing={pricing(TODAY)} />)

    paintFrame()

    expect(
      screen.getByTestId('credit-cost-chip').getAttribute('aria-expanded'),
    ).toBe('false')
    expect(screen.queryByTestId('credit-cost-guide')).toBeNull()
    expect(scrollIntoView).not.toHaveBeenCalled()
  })

  it('answers a link followed while it is already on screen', () => {
    render(() => <CreditCostGuide pricing={pricing(TODAY)} />)
    const chip = screen.getByTestId('credit-cost-chip')
    expect(chip.getAttribute('aria-expanded')).toBe('false')

    setCreditCostGuideRequested(true)
    paintFrame()

    expect(chip.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByTestId('credit-cost-guide')).not.toBeNull()
    expect(scrollIntoView).toHaveBeenCalledTimes(1)
    expect(creditCostGuideRequested()).toBe(false)
  })

  it('folds again on a tap after arriving open', () => {
    setCreditCostGuideRequested(true)
    render(() => <CreditCostGuide pricing={pricing(TODAY)} />)
    paintFrame()
    const chip = screen.getByTestId('credit-cost-chip')

    fireEvent.click(chip)

    expect(chip.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByTestId('credit-cost-guide')).toBeNull()
  })
})
