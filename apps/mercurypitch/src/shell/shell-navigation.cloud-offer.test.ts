// ============================================================
// Back with the Cloud offer up
// ============================================================
//
// The offer (paywall B v2) opens over the Karaoke room, over Settings or
// over the onboarding. Back answers it the way its Not now does: the sheet
// goes, offers nobody asked for stay away for a week, and the screen under
// it is not popped.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/native-build', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  KARAOKE_IMPORT: true,
}))

import { cloudOffer, openCloudOffer, resetCloudOfferForTests, showCloudSubscribed, unaskedRefusal, } from '@/features/karaoke-room/cloud-offer-store'
import { pushed, pushSettingsScreen, resetRunShell } from './run-shell-store'
import { performBack, resolveBack } from './shell-navigation'

const host = () => ({ canGoBack: true, back: vi.fn(), minimize: vi.fn() })

beforeEach(() => {
  resetRunShell()
  resetCloudOfferForTests()
})

afterEach(() => {
  resetRunShell()
  resetCloudOfferForTests()
})

describe('Back with the Cloud offer up', () => {
  it('is for the sheet, over the screen it opened on', () => {
    pushSettingsScreen()
    openCloudOffer('settings')

    expect(resolveBack(true)).toBe('sheet')
  })

  it('answers Not now, and leaves Settings where it was', () => {
    pushSettingsScreen()
    const under = pushed()
    openCloudOffer('settings')
    const back = host()

    const outcome = performBack(back)

    expect(outcome).toBe('sheet')
    expect(cloudOffer()).toBeNull()
    expect(unaskedRefusal()).toBe('not-now')
    expect(pushed()).toEqual(under)
    expect(back.back).not.toHaveBeenCalled()
  })

  it('closes what follows a yes from the store, which is no Not now', () => {
    openCloudOffer('import')
    showCloudSubscribed(false)

    expect(performBack(host())).toBe('sheet')
    expect(cloudOffer()).toBeNull()
    expect(localStorage.getItem('mp:cloud-offer-not-now')).toBeNull()
  })
})
