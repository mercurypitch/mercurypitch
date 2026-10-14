// Drum Night account chip tests: the launch gift hears who is signed in here.
// ============================================================

import { cleanup, render } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DrumNightAccount, drumNightGiftLine } from './DrumNightAccount'

const accountState = vi.hoisted(() => ({
  account: { email: 'drummer@example.com', provider: 'google' } as {
    email: string | null
    provider: 'anonymous' | 'password' | 'google'
  } | null,
  held: true,
}))

const gift = vi.hoisted(() => ({ sync: vi.fn(async () => undefined) }))

vi.mock('@/db/services/auth-service', () => ({
  accountHeld: () => accountState.held,
  takeGoogleRedirectResult: () => null,
}))

vi.mock('@/stores/notifications-store', () => ({
  showNotification: vi.fn(),
}))

vi.mock('@/stores/launch-gift-store', () => ({
  syncPromoClaims: gift.sync,
}))

vi.mock('@/lib/standalone-account', () => ({
  account: () => accountState.account,
  credits: () => 5,
  refreshAccount: vi.fn(async () => undefined),
  signOutStandalone: vi.fn(),
}))

afterEach(() => {
  cleanup()
  accountState.account = { email: 'drummer@example.com', provider: 'google' }
  accountState.held = true
  gift.sync.mockClear()
})

describe('DrumNightAccount and the launch gift', () => {
  // A Google sign-up started here comes back here, with the launch gift
  // already claimed. The player is in the room, so the room has to say
  // it landed, as Karaoke Night does (launch-gift-store).
  it('tells the launch gift who is signed in, so a gift a Google sign-up claimed is said here', () => {
    render(() => <DrumNightAccount onSignIn={vi.fn()} />)

    expect(gift.sync).toHaveBeenCalledWith(
      { upgraded: true, verified: true },
      drumNightGiftLine,
    )
  })

  it('leaves a password account confirmation to its link', () => {
    accountState.account = {
      email: 'drummer@example.com',
      provider: 'password',
    }

    render(() => <DrumNightAccount onSignIn={vi.fn()} />)

    expect(gift.sync).toHaveBeenCalledWith(
      { upgraded: true, verified: false },
      drumNightGiftLine,
    )
  })

  it('tells the launch gift when nobody is signed in', () => {
    accountState.account = null
    accountState.held = false

    render(() => <DrumNightAccount onSignIn={vi.fn()} />)

    expect(gift.sync).toHaveBeenCalledWith(null, drumNightGiftLine)
  })

  // A credit here pays for "Separate drums + band", the cloud split that
  // lifts the drums out of a song (drum-night-music-actions.ts). That split
  // costs more than one credit, so a lone credit goes toward it.
  it.each([
    [5, 'Use them to separate the drums from a song.'],
    [1, 'Put it toward separating the drums from a song.'],
  ])('says what %i credits do in Drum Night', (credits, says) => {
    expect(drumNightGiftLine(credits)).toBe(says)
  })
})
