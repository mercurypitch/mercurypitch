// ============================================================
// The account offer, drawn: the sheet after a Keep, the card in Settings
// ============================================================
//
// 2a and 2b of the S6 mock. Every line comes from the copy module, which is
// where the owner's free-or-paid answer will land, so these read it from
// there rather than spelling it out again. Sign in and Later are the same
// control side by side (REQ-NAM-012); the sheet has no close button, and
// its backdrop answers Later.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setAuthToken } from '@/db/services/user-service'
import { TAB_SINGING } from '@/features/tabs/constants'
import { setPlaybackState } from '@/stores/playback-state-store'
import { clearSingTakes, keepSingTake } from '@/stores/sing-takes-store'
import { setActiveTab } from '@/stores/ui-store'
import { actAsIpad } from '@/tests/helpers/ipad-navigator'
import type { RenderedShell } from '../render-for-test'
import { renderShell } from '../render-for-test'
import { resetRunShell } from '../run-shell-store'
import { ACCOUNT_OFFER, accountPromises, takesStayHere } from './account-copy'
import { forgetAccountOffer, installAccountOffer, OFFER_BEAT_MS, offerCardShown, offerOpen, } from './account-offer'
import { AccountOfferCard, AccountOfferSheet } from './AccountOffer'
import { resetSignIn, signInOpen } from './sign-in-state'

let view: RenderedShell | null = null
let uninstall: (() => void) | null = null

function q(testId: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-testid="${testId}"]`)
}

/** The sheet, raised the way the room raises it: a take kept, then a beat. */
function raise(): void {
  view = renderShell(() => <AccountOfferSheet />)
  uninstall = installAccountOffer()
  keepSingTake({
    id: 'take-1',
    startedAt: 1_000,
    endedAt: 31_000,
    durationMs: 30_000,
    takeNumber: 1,
    lowNote: 'A3',
    highNote: 'E4',
    heldWithinCents: 18,
  })
  vi.advanceTimersByTime(OFFER_BEAT_MS)
}

beforeEach(() => {
  vi.useFakeTimers()
  clearSingTakes()
  setAuthToken(null)
  setPlaybackState('stopped')
  resetRunShell()
  resetSignIn()
  forgetAccountOffer()
  setActiveTab(TAB_SINGING)
})

afterEach(() => {
  uninstall?.()
  uninstall = null
  view?.unmount()
  view = null
  clearSingTakes()
  resetRunShell()
  resetSignIn()
  forgetAccountOffer()
  vi.useRealTimers()
})

describe('the sheet (2a)', () => {
  it('says the take is kept, what an account adds and what stays, in the copy module words', () => {
    raise()

    const words = q('account-offer')?.textContent ?? ''

    expect(offerOpen()).toBe(true)
    expect(words).toContain(ACCOUNT_OFFER.firstTake)
    expect(words).toContain(ACCOUNT_OFFER.title)
    for (const promise of accountPromises()) expect(words).toContain(promise)
    expect(words).toContain(takesStayHere())
  })

  it('gives Sign in and Later the same control, side by side, and no close button (REQ-NAM-012)', () => {
    raise()

    const signIn = q('offer-sign-in')
    const later = q('offer-later')
    const panel = q('sheet-panel')

    expect(signIn?.textContent).toBe(ACCOUNT_OFFER.accept)
    expect(later?.textContent).toBe(ACCOUNT_OFFER.decline)
    expect(signIn?.parentElement).toBe(later?.parentElement)
    expect(signIn?.className).toBe('mp-set-button')
    expect(later?.className).toBe('mp-set-button mp-set-button--secondary')
    expect(panel?.querySelector('[aria-label="Close"]')).toBeNull()
    expect(panel?.querySelectorAll('button')).toHaveLength(2)
  })

  it('opens the sign-in sheet from Sign in', () => {
    raise()

    q('offer-sign-in')?.click()

    expect(offerOpen()).toBe(false)
    expect(signInOpen()).toBe(true)
  })

  it('goes quietly on Later, with the card folded (REQ-NAM-014)', () => {
    raise()
    const up = offerOpen()

    q('offer-later')?.click()

    expect(up).toBe(true)
    expect(offerOpen()).toBe(false)
    expect(signInOpen()).toBe(false)
    expect(offerCardShown()).toBe(false)
    expect(q('account-offer')).toBeNull()
  })

  it('answers Later to a tap on the backdrop', () => {
    raise()
    const up = offerOpen()

    q('sheet-panel')?.parentElement?.click()

    expect(up).toBe(true)
    expect(offerOpen()).toBe(false)
    expect(offerCardShown()).toBe(false)
  })
})

describe('the card (2b)', () => {
  it('says the same lines with smaller answers, and no word about the take', () => {
    view = renderShell(() => <AccountOfferCard />)

    const card = q('offer-card')
    const words = card?.textContent ?? ''

    expect(card?.getAttribute('aria-label')).toBe(ACCOUNT_OFFER.title)
    expect(words).toContain(ACCOUNT_OFFER.title)
    for (const promise of accountPromises()) expect(words).toContain(promise)
    expect(words).toContain(takesStayHere())
    expect(words).not.toContain(ACCOUNT_OFFER.firstTake)
    expect(q('offer-sign-in')?.className).toBe(
      'mp-set-button mp-set-button--small',
    )
    expect(q('offer-later')?.className).toBe(
      'mp-set-button mp-set-button--secondary mp-set-button--small',
    )
  })

  it('opens the sign-in sheet from Sign in, and folds on Later', () => {
    view = renderShell(() => <AccountOfferCard />)

    q('offer-sign-in')?.click()
    const opened = signInOpen()
    q('offer-later')?.click()

    expect(opened).toBe(true)
    expect(offerCardShown()).toBe(false)
  })
})

describe('on an iPad', () => {
  it('says the takes stay on this iPad, and what an account adds to it', () => {
    const restore = actAsIpad()
    try {
      raise()

      const words = q('account-offer')?.textContent ?? ''
      expect(words).toContain('Takes stay on this iPad.')
      expect(words).toContain('On your next iPad, and on the web')
      expect(words).not.toMatch(/\bphones?\b/iu)
    } finally {
      restore()
    }
  })
})
