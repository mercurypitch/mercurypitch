import { fireEvent, render, screen } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { LaunchOffer } from '@/db/services/billing-service'
import type * as LaunchOfferModule from '@/lib/launch-offer'

const mocks = vi.hoisted(() => ({
  trackEvent: vi.fn(),
  countProgressView: vi.fn(),
  askForPacks: vi.fn(),
}))

vi.mock('@/lib/analytics', () => ({ trackEvent: mocks.trackEvent }))
vi.mock('@/db/services/auth-service', () => ({
  currentAccountId: () => 'user-1',
}))
// Once a page session is the module's business (launch-offer.test.ts); here,
// only whether the block counts itself when it shows.
vi.mock('@/lib/launch-offer', async (importOriginal) => ({
  ...(await importOriginal<typeof LaunchOfferModule>()),
  countProgressView: mocks.countProgressView,
  askForPacks: mocks.askForPacks,
}))

const { LaunchOfferProgress } = await import('./LaunchOfferProgress')

function offer(overrides: Partial<LaunchOffer> = {}): LaunchOffer {
  return {
    state: 'counting',
    used: 2,
    goal: 5,
    deadline: '2026-10-23T23:59:59.999Z',
    bonusCredits: 30,
    ...overrides,
  }
}

const block = (): HTMLElement | null =>
  screen.queryByTestId('launch-offer-progress')

const coins = (): string[] =>
  Array.from(document.querySelectorAll('[data-coin]')).map(
    (coin) => coin.getAttribute('data-coin') ?? '',
  )

beforeEach(() => {
  mocks.trackEvent.mockClear()
  mocks.countProgressView.mockClear()
  mocks.askForPacks.mockClear()
})

describe('LaunchOfferProgress', () => {
  it('counts the used credits, one coin each, and says what all of them earn', () => {
    render(() => <LaunchOfferProgress offer={offer()} />)
    expect(block()?.dataset.state).toBe('counting')
    expect(block()?.textContent).toContain('Launch credits')
    expect(block()?.textContent).toContain('2 of 5 used')
    expect(coins()).toEqual(['spent', 'spent', 'credit', 'credit', 'credit'])
    expect(
      screen.getByText(
        'Use all 5 by 23 October and your next pack comes with 30 extra credits.',
      ),
    ).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'See the packs' })).toBeNull()
  })

  it('says the reward once all of them are used, with the way to the packs', () => {
    const onSeePacks = vi.fn()
    render(() => (
      <LaunchOfferProgress
        offer={offer({ state: 'unlocked', used: 5 })}
        onSeePacks={onSeePacks}
      />
    ))
    expect(block()?.dataset.state).toBe('unlocked')
    expect(block()?.textContent).toContain('All 5 used')
    expect(coins()).toEqual(['spent', 'spent', 'spent', 'spent', 'spent'])
    expect(block()?.textContent).toContain(
      'Your next pack comes with 30 extra credits.',
    )
    expect(block()?.textContent).not.toContain('23 October')

    fireEvent.click(screen.getByRole('button', { name: 'See the packs' }))
    expect(onSeePacks).toHaveBeenCalledTimes(1)
    expect(mocks.trackEvent).toHaveBeenCalledWith('offer_packs_tap')
    // Settings › Credits is asked to open at the packs.
    expect(mocks.askForPacks).toHaveBeenCalledTimes(1)
  })

  it('leaves the way to the packs out where the packs are already shown', () => {
    render(() => (
      <LaunchOfferProgress offer={offer({ state: 'unlocked', used: 5 })} />
    ))
    expect(block()).not.toBeNull()
    expect(screen.queryByRole('button', { name: 'See the packs' })).toBeNull()
  })

  it('shows nothing of a used or lapsed offer, or of none', () => {
    const [current, setCurrent] = createSignal<LaunchOffer | null>(
      offer({ state: 'used', used: 5 }),
    )
    render(() => <LaunchOfferProgress offer={current()} />)
    expect(block()).toBeNull()
    setCurrent(offer({ state: 'lapsed', used: 3 }))
    expect(block()).toBeNull()
    setCurrent(null)
    expect(block()).toBeNull()
    expect(mocks.countProgressView).not.toHaveBeenCalled()
  })

  it('shows only the states it is asked for', () => {
    const [current, setCurrent] = createSignal<LaunchOffer>(
      offer({ state: 'unlocked', used: 5 }),
    )
    render(() => (
      <LaunchOfferProgress offer={current()} states={['counting']} />
    ))
    expect(block()).toBeNull()
    expect(mocks.countProgressView).not.toHaveBeenCalled()
    setCurrent(offer())
    expect(block()?.dataset.state).toBe('counting')
    expect(mocks.countProgressView).toHaveBeenCalled()
  })

  it('follows the count as credits are used', () => {
    const [current, setCurrent] = createSignal<LaunchOffer>(offer())
    render(() => <LaunchOfferProgress offer={current()} />)
    setCurrent(offer({ used: 4 }))
    expect(block()?.textContent).toContain('4 of 5 used')
    expect(coins().filter((coin) => coin === 'spent')).toHaveLength(4)
    setCurrent(offer({ state: 'unlocked', used: 5 }))
    expect(block()?.textContent).toContain('All 5 used')
  })

  it('draws smaller coins in the compact header', () => {
    render(() => <LaunchOfferProgress offer={offer()} compact />)
    const first = document.querySelector<HTMLElement>('[data-coin]')
    expect(first?.style.getPropertyValue('--coin-size')).toBe('14px')
  })

  it('draws full-size coins elsewhere', () => {
    render(() => <LaunchOfferProgress offer={offer()} />)
    const first = document.querySelector<HTMLElement>('[data-coin]')
    expect(first?.style.getPropertyValue('--coin-size')).toBe('22px')
  })

  it('lets the words carry a count too long for a row of coins', () => {
    render(() => <LaunchOfferProgress offer={offer({ goal: 12, used: 3 })} />)
    expect(block()?.textContent).toContain('3 of 12 used')
    expect(coins()).toEqual([])
  })

  it('counts itself as seen when it shows', () => {
    render(() => <LaunchOfferProgress offer={offer()} />)
    expect(mocks.countProgressView).toHaveBeenCalled()
  })
})

describe('LaunchOfferProgress in the desk header', () => {
  it('fits the count on one row, with the line for hover and screen readers', () => {
    render(() => <LaunchOfferProgress offer={offer()} inline />)
    const row = block()
    const line =
      'Use all 5 by 23 October and your next pack comes with 30 extra credits.'
    expect(row?.dataset.state).toBe('counting')
    expect(row?.getAttribute('title')).toBe(line)
    expect(row?.textContent).toContain('Launch credits')
    expect(row?.textContent).toContain('2 of 5 used')
    expect(row?.textContent).toContain(line)
    expect(row?.querySelector('p')).toBeNull()
    expect(coins()).toEqual(['spent', 'spent', 'credit', 'credit', 'credit'])
    const first = document.querySelector<HTMLElement>('[data-coin]')
    expect(first?.style.getPropertyValue('--coin-size')).toBe('10px')
  })

  it('says the reward in the row once it is earned, with the way to the packs', () => {
    const onSeePacks = vi.fn()
    render(() => (
      <LaunchOfferProgress
        offer={offer({ state: 'unlocked', used: 5 })}
        inline
        onSeePacks={onSeePacks}
      />
    ))
    expect(block()?.dataset.state).toBe('unlocked')
    expect(block()?.textContent).toContain('30 extra credits on your next pack')
    expect(block()?.getAttribute('title')).toBe(
      'Your next pack comes with 30 extra credits.',
    )
    fireEvent.click(screen.getByRole('button', { name: 'See the packs' }))
    expect(onSeePacks).toHaveBeenCalledTimes(1)
    expect(mocks.trackEvent).toHaveBeenCalledWith('offer_packs_tap')
    expect(mocks.askForPacks).toHaveBeenCalledTimes(1)
  })

  it('shows nothing of a used offer', () => {
    render(() => (
      <LaunchOfferProgress offer={offer({ state: 'used', used: 5 })} inline />
    ))
    expect(block()).toBeNull()
  })
})
