// ============================================================
// The Cloud offer as the shell mounts it: which sheet each ask opens
// ============================================================
//
// Paywall B v2's free account opens Keep, the account offer. Its Sign in
// after a purchase opens the sign-in sheet and never Keep: the singer has
// paid, and what they need is to sign in.

import { fireEvent, screen, waitFor, within } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as AuthService from '@/db/services/auth-service'
import { cloudOffer, openCloudOffer, resetCloudOfferForTests, } from '@/features/karaoke-room/cloud-offer-store'
import type * as Songs from '@/features/karaoke-room/karaoke-songs'
import type { KaraokeSongs } from '@/features/karaoke-room/karaoke-songs'
import { resetKaraokeSongsForTests } from '@/features/karaoke-room/karaoke-songs'
import type { RenderedShell } from './render-for-test'
import { renderShell } from './render-for-test'
import { forgetAccountOffer, offerOpen } from './settings/account-offer'
import { resetSignIn, signInOpen } from './settings/sign-in-state'
import { ShellCloudOffer } from './ShellCloudOffer'

vi.mock('@/features/karaoke-room/karaoke-songs', async (importOriginal) => {
  const actual = await importOriginal<typeof Songs>()
  return {
    ...actual,
    refreshKaraokeSongs: vi.fn(async () =>
      Promise.resolve(actual.karaokeSongs()),
    ),
  }
})

vi.mock('@/db/services/auth-service', async (importOriginal) => ({
  ...(await importOriginal<typeof AuthService>()),
  accountHeld: () => false,
}))

const noSongs: KaraokeSongs = {
  left: 0,
  subscribed: false,
  renewsAt: null,
  perPeriod: 20,
}

const subscriber: KaraokeSongs = {
  left: 20,
  subscribed: true,
  renewsAt: '2026-11-16T10:00:00.000Z',
  perPeriod: 20,
}

let view: RenderedShell | null = null

beforeEach(() => {
  resetKaraokeSongsForTests(noSongs)
  resetCloudOfferForTests()
  forgetAccountOffer()
  resetSignIn()
})

afterEach(() => {
  view?.unmount()
  view = null
  resetCloudOfferForTests()
  forgetAccountOffer()
  resetSignIn()
})

describe('the Cloud offer in the shell', () => {
  it('opens Keep from the free account, and not the sign-in sheet', async () => {
    view = renderShell(() => <ShellCloudOffer />)
    openCloudOffer('import')
    const offer = await waitFor(() =>
      screen.getByRole('dialog', { name: 'Sing your own songs' }),
    )

    fireEvent.click(
      within(offer).getByRole('button', {
        name: 'Get 1 free song with a free account',
      }),
    )

    expect(cloudOffer()).toBeNull()
    expect(offerOpen()).toBe(true)
    expect(signInOpen()).toBe(false)
  })

  it('opens the sign-in sheet from Sign in after a purchase, and not Keep', async () => {
    resetKaraokeSongsForTests(subscriber)
    view = renderShell(() => <ShellCloudOffer />)
    openCloudOffer('settings', 'subscribed')
    const bought = await waitFor(() =>
      screen.getByRole('dialog', { name: "You're subscribed" }),
    )

    fireEvent.click(within(bought).getByRole('button', { name: 'Sign in' }))

    expect(cloudOffer()).toBeNull()
    expect(signInOpen()).toBe(true)
    expect(offerOpen()).toBe(false)
  })
})
