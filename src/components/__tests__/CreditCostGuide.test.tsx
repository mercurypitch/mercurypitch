// ============================================================
// CreditCostGuide — what a song costs, from the live pricing
// ============================================================
import { fireEvent, render, screen } from '@solidjs/testing-library'
import { describe, expect, it } from 'vitest'
import { creditCosts, FULL_BAND_SPLIT_MODEL, } from '@/components/billing/credit-cost-model'
import { CreditCostGuide } from '@/components/billing/CreditCostGuide'
import type { Pricing } from '@/db/services/billing-service'
import { UVR_DEFAULT_MULTI_STEM_MODEL } from '@/lib/uvr-api'
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
