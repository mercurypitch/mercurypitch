// ============================================================
// Voice Mirror: the account ask under the results
// ============================================================
//
// What the visitor sees, and what the funnel hears. The rule itself is pinned
// in account-ask.test.ts; this covers the card: on screen only for a browser
// with no account, gone the moment an account holds, one event per tap and
// none for being looked at, the launch gift named while one is featured, and
// the dialog's chunk loaded only once somebody needs it.

import { cleanup, fireEvent, render, screen, waitFor, } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FeaturedPromo } from '@/db/services/billing-service'
import { setAuthToken } from '@/db/services/user-service'
import { forgetSignInMethod, rememberSignInMethod } from '@/lib/last-sign-in'
import { askForAccount, hostDidNotLoad, hostWanted, resetAccountAskForTests, } from './account-ask'
import { trackFunnel } from './funnel'
import { MirrorAccountAsk, MirrorAccountHostSlot, offerEndDay, } from './MirrorAccountAsk'

const promo = vi.hoisted(() => ({
  offered: null as FeaturedPromo | null,
  loads: 0,
}))

vi.mock('./funnel', () => ({ trackFunnel: vi.fn() }))
vi.mock('@/stores/promo-store', () => ({
  loadFeaturedPromo: async () => {
    promo.loads += 1
  },
  offeredPromo: () => promo.offered,
}))
vi.mock('./MirrorAccountHost', () => ({
  default: () => <p data-testid="mirror-account-host">dialog host</p>,
}))

const trackFunnelMock = vi.mocked(trackFunnel)

/** A worker-shaped session token for a real account. */
function accountToken(): string {
  const exp = Math.floor(Date.now() / 1000) + 3600
  const body = btoa(JSON.stringify({ sub: 'user-1', provider: 'google', exp }))
  return `h.${body}.s`
}

beforeEach(() => {
  localStorage.clear()
  setAuthToken(null)
  forgetSignInMethod()
  trackFunnelMock.mockClear()
  promo.offered = null
  promo.loads = 0
})

afterEach(() => {
  cleanup()
  // The ask's state is module-wide: leave it as a fresh page would.
  resetAccountAskForTests()
})

const ASK = 'mirror-account-ask'

describe('the account ask', () => {
  it('asks a browser with no account, and counts nothing for being seen', () => {
    render(() => <MirrorAccountAsk />)

    expect(
      screen.getByRole('heading', { level: 2, name: 'Keep your voiceprints' }),
    ).toHaveTextContent('Keep your voiceprints')
    expect(
      screen.getByRole('button', { name: 'Create my free account' }),
    ).toHaveProperty('disabled', false)
    expect(trackFunnelMock).not.toHaveBeenCalled()
  })

  it('shows nothing to an account that is signed in', () => {
    setAuthToken(accountToken())
    render(() => <MirrorAccountAsk />)
    expect(screen.queryByTestId(ASK)).toBeNull()
  })

  it('shows nothing to a signed-out account holder this browser remembers', () => {
    rememberSignInMethod('password')
    render(() => <MirrorAccountAsk />)
    expect(screen.queryByTestId(ASK)).toBeNull()
  })

  it('goes away the moment an account signs in with it on screen', () => {
    render(() => <MirrorAccountAsk />)
    expect(screen.getByTestId(ASK)).toHaveAttribute('aria-labelledby')

    setAuthToken(accountToken())

    expect(screen.queryByTestId(ASK)).toBeNull()
  })

  it('counts the tap, once, and asks for the dialog', () => {
    render(() => <MirrorAccountAsk />)

    fireEvent.click(
      screen.getByRole('button', { name: 'Create my free account' }),
    )

    expect(trackFunnelMock).toHaveBeenCalledTimes(1)
    expect(trackFunnelMock).toHaveBeenCalledWith('cta_account_click')
    expect(hostWanted()).toBe(true)
    // Until the dialog opens, the button says it is on its way. It keeps
    // focus (aria-disabled, not disabled), so closing the dialog returns it.
    const button = screen.getByRole('button', { name: 'Opening…' })
    expect(button).toHaveAttribute('aria-disabled', 'true')
    expect(button).toHaveProperty('disabled', false)
  })

  it('counts a double tap once', () => {
    render(() => <MirrorAccountAsk />)
    const button = screen.getByRole('button', {
      name: 'Create my free account',
    })

    fireEvent.click(button)
    fireEvent.click(button)

    expect(trackFunnelMock).toHaveBeenCalledTimes(1)
  })

  it('names the launch gift while one is featured', async () => {
    promo.offered = {
      code: 'LAUNCH',
      credits: 5,
      expiresAt: '2027-01-01T00:00:00.000Z',
    }
    render(() => <MirrorAccountAsk />)

    const gift = await screen.findByTestId('mirror-account-gift')
    expect(gift).toHaveTextContent('Launch gift · until 1 January')
    expect(gift).toHaveTextContent('Up to 5 free song separations')
    expect(gift).toHaveTextContent(
      'Sing your favorite songs at Karaoke Night and see how you score.',
    )
    expect(screen.getByTestId(ASK)).toHaveTextContent(
      'Your gift arrives when your email is confirmed.',
    )
  })

  it('names a one-credit gift in the singular', async () => {
    promo.offered = { code: 'ONE', credits: 1, expiresAt: null }
    render(() => <MirrorAccountAsk />)

    const gift = await screen.findByTestId('mirror-account-gift')
    expect(gift).toHaveTextContent('1 free song separation')
    expect(gift).not.toHaveTextContent('separations')
    expect(gift).not.toHaveTextContent('Up to')
  })

  it('says nothing of a gift when none is featured', async () => {
    render(() => <MirrorAccountAsk />)

    await waitFor(() => expect(promo.loads).toBe(1))
    expect(screen.queryByTestId('mirror-account-gift')).toBeNull()
    expect(screen.getByTestId(ASK)).not.toHaveTextContent('Your gift arrives')
  })

  it('says so when the dialog could not load', () => {
    render(() => <MirrorAccountAsk />)
    askForAccount()

    hostDidNotLoad()

    expect(screen.getByRole('status')).toHaveTextContent(
      "The sign-up form didn't load.",
    )
    expect(
      screen.getByRole('button', { name: 'Create my free account' }),
    ).toHaveProperty('disabled', false)
  })
})

describe("the dialog's chunk", () => {
  it('loads only once something asks for it', async () => {
    render(() => <MirrorAccountHostSlot />)
    expect(screen.queryByTestId('mirror-account-host')).toBeNull()

    askForAccount()

    expect(await screen.findByTestId('mirror-account-host')).toHaveTextContent(
      'dialog host',
    )
  })
})

describe('the offer end day', () => {
  it('names the UTC day the server ends the offer', () => {
    expect(offerEndDay('2027-01-01T00:00:00.000Z')).toBe('1 January')
    expect(offerEndDay('2026-12-31T23:30:00.000Z')).toBe('31 December')
  })

  it('names nothing for an open-ended or unreadable date', () => {
    expect(offerEndDay(null)).toBeNull()
    expect(offerEndDay('soon')).toBeNull()
  })
})
