// ============================================================
// Back with the account offer up
// ============================================================
//
// The offer rises over the Sing room a beat after a Keep (S6 2a). It has no
// close button, so Back answers it the way Later does: the sheet goes
// quietly, the room stays as it was, and nothing under it is popped.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setAuthToken } from '@/db/services/user-service'
import { TAB_SINGING } from '@/features/tabs/constants'
import { setPlaybackState } from '@/stores/playback-state-store'
import { clearSingTakes, keepSingTake } from '@/stores/sing-takes-store'
import { setActiveTab } from '@/stores/ui-store'
import { pushed, resetRunShell } from './run-shell-store'
import { forgetAccountOffer, installAccountOffer, OFFER_BEAT_MS, offerCardShown, offerOpen, } from './settings/account-offer'
import { resetSignIn, signInOpen } from './settings/sign-in-state'
import { performBack, resolveBack } from './shell-navigation'

const host = () => ({ canGoBack: true, back: vi.fn(), minimize: vi.fn() })

let uninstall: (() => void) | null = null

function raise(): void {
  uninstall = installAccountOffer()
  keepSingTake({
    id: 'take-1',
    startedAt: 1_000,
    endedAt: 31_000,
    durationMs: 30_000,
    takeNumber: 1,
    lowNote: null,
    highNote: null,
    heldWithinCents: 20,
  })
  vi.advanceTimersByTime(OFFER_BEAT_MS)
}

beforeEach(() => {
  vi.useFakeTimers()
  clearSingTakes()
  setAuthToken(null)
  setPlaybackState('stopped')
  setActiveTab(TAB_SINGING)
  resetRunShell()
  resetSignIn()
  forgetAccountOffer()
})

afterEach(() => {
  uninstall?.()
  uninstall = null
  clearSingTakes()
  resetRunShell()
  resetSignIn()
  forgetAccountOffer()
  vi.useRealTimers()
})

describe('Back with the account offer up', () => {
  it('is for the sheet', () => {
    raise()

    expect(offerOpen()).toBe(true)
    expect(resolveBack(true)).toBe('sheet')
  })

  it('answers Later, and leaves the room as it was', () => {
    raise()
    const back = host()

    const outcome = performBack(back)

    expect(outcome).toBe('sheet')
    expect(offerOpen()).toBe(false)
    expect(offerCardShown()).toBe(false)
    expect(signInOpen()).toBe(false)
    expect(pushed()).toBeNull()
    expect(back.back).not.toHaveBeenCalled()
  })
})
