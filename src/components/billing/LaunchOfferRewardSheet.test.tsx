import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { LaunchOffer } from '@/db/services/billing-service'

const mocks = vi.hoisted(() => ({
  accountId: 'user-1' as string | null,
  trackEvent: vi.fn(),
}))

vi.mock('@/lib/analytics', () => ({ trackEvent: mocks.trackEvent }))
vi.mock('@/db/services/auth-service', () => ({
  currentAccountId: () => mocks.accountId,
}))

const { LaunchOfferRewardSheet } = await import('./LaunchOfferRewardSheet')

const SEEN_KEY = 'mp.launchOffer.rewardSeen.v1'
const PACKS_KEY = 'mp.launchOffer.showPacks.v1'

function offer(overrides: Partial<LaunchOffer> = {}): LaunchOffer {
  return {
    state: 'unlocked',
    used: 5,
    goal: 5,
    deadline: '2026-10-23T23:59:59.999Z',
    bonusCredits: 30,
    ...overrides,
  }
}

const sheet = (): HTMLElement | null =>
  screen.queryByTestId('launch-offer-reward')

const trackedTimes = (event: string): number =>
  mocks.trackEvent.mock.calls.filter(([name]) => name === event).length

/** The sheet over a page whose /me answer can change. */
function mount(initial: LaunchOffer | null = offer()) {
  const [current, setCurrent] = createSignal<LaunchOffer | null>(initial)
  const onSeePacks = vi.fn()
  render(() => (
    <LaunchOfferRewardSheet offer={current()} onSeePacks={onSeePacks} />
  ))
  return { setCurrent, onSeePacks }
}

beforeEach(() => {
  mocks.accountId = 'user-1'
  mocks.trackEvent.mockClear()
  localStorage.clear()
  sessionStorage.clear()
})

describe('LaunchOfferRewardSheet', () => {
  it('opens once the reward is earned, and names no end for it', async () => {
    mount()
    const dialog = screen.getByRole('dialog', { name: 'All 5 used' })
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(dialog.textContent).toContain(
      'Your next pack comes with 30 extra credits.',
    )
    expect(dialog.textContent).not.toMatch(/October|until/)
    expect(dialog.querySelector('img')?.getAttribute('alt')).toBe('')
    expect(trackedTimes('offer_unlocked_view')).toBe(1)
    // Focus starts on the title, so the sheet is read from the top and the
    // button does not open wearing a focus ring.
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole('heading', { name: 'All 5 used' }),
      ),
    )
  })

  it('stays shut while the offer is counting, used or lapsed', () => {
    const { setCurrent } = mount(offer({ state: 'counting', used: 4 }))
    expect(sheet()).toBeNull()
    setCurrent(offer({ state: 'used' }))
    expect(sheet()).toBeNull()
    setCurrent(offer({ state: 'lapsed', used: 2 }))
    expect(sheet()).toBeNull()
    setCurrent(null)
    expect(sheet()).toBeNull()
    expect(trackedTimes('offer_unlocked_view')).toBe(0)
  })

  it('opens when the fifth credit is used on the page', () => {
    const { setCurrent } = mount(offer({ state: 'counting', used: 4 }))
    expect(sheet()).toBeNull()
    setCurrent(offer())
    expect(sheet()).not.toBeNull()
    expect(trackedTimes('offer_unlocked_view')).toBe(1)
  })

  it('"Not now" closes it for good on this account', () => {
    const { setCurrent, onSeePacks } = mount()
    fireEvent.click(screen.getByRole('button', { name: 'Not now' }))
    expect(sheet()).toBeNull()
    expect(onSeePacks).not.toHaveBeenCalled()
    expect(JSON.parse(localStorage.getItem(SEEN_KEY) ?? '[]')).toEqual([
      'user-1',
    ])
    // The next /me answer says the same: the sheet stays shut.
    setCurrent(offer())
    expect(sheet()).toBeNull()
    expect(trackedTimes('offer_unlocked_view')).toBe(1)
    expect(trackedTimes('offer_packs_tap')).toBe(0)
    expect(sessionStorage.getItem(PACKS_KEY)).toBeNull()
  })

  it('"See the packs" goes to the packs and closes it for good', () => {
    const { onSeePacks } = mount()
    fireEvent.click(screen.getByRole('button', { name: 'See the packs' }))
    expect(onSeePacks).toHaveBeenCalledTimes(1)
    expect(trackedTimes('offer_packs_tap')).toBe(1)
    // Settings › Credits is asked to open at the packs.
    expect(sessionStorage.getItem(PACKS_KEY)).toBe('1')
    expect(sheet()).toBeNull()
    expect(JSON.parse(localStorage.getItem(SEEN_KEY) ?? '[]')).toEqual([
      'user-1',
    ])
  })

  it('closes on Escape and on the backdrop, not on the sheet itself', () => {
    mount()
    const dialog = screen.getByRole('dialog')
    fireEvent.click(dialog)
    expect(sheet()).not.toBeNull()
    fireEvent.keyDown(dialog, { key: 'Escape' })
    expect(sheet()).toBeNull()

    localStorage.clear()
    mocks.accountId = 'user-2'
    mount()
    const backdrop = screen.getByRole('dialog').parentElement
    expect(backdrop).not.toBeNull()
    fireEvent.click(backdrop as HTMLElement)
    expect(sheet()).toBeNull()
  })

  it('does not open again on a later page for the same account', () => {
    localStorage.setItem(SEEN_KEY, JSON.stringify(['user-1']))
    mount()
    expect(sheet()).toBeNull()
    expect(trackedTimes('offer_unlocked_view')).toBe(0)
  })

  it('opens for another account that signs in here', () => {
    const { setCurrent } = mount()
    fireEvent.click(screen.getByRole('button', { name: 'Not now' }))
    expect(sheet()).toBeNull()
    mocks.accountId = 'user-2'
    setCurrent(offer())
    expect(sheet()).not.toBeNull()
  })

  it('closes for an account it cannot name, for the rest of the page', () => {
    mocks.accountId = null
    const { setCurrent } = mount()
    fireEvent.click(screen.getByRole('button', { name: 'Not now' }))
    expect(sheet()).toBeNull()
    setCurrent(offer())
    expect(sheet()).toBeNull()
  })

  it('stays shut for the rest of the page when storage is blocked', () => {
    const getItem = vi.spyOn(localStorage, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    const setItem = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    try {
      const { setCurrent } = mount()
      fireEvent.click(screen.getByRole('button', { name: 'Not now' }))
      expect(sheet()).toBeNull()
      setCurrent(offer())
      expect(sheet()).toBeNull()
    } finally {
      getItem.mockRestore()
      setItem.mockRestore()
    }
  })
})
