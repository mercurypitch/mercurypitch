// Guitar Night account disclosure tests protect keyboard dismissal and focus recovery.
// ============================================================

import { cleanup, fireEvent, render, screen, waitFor, } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GuitarNightAccount } from './GuitarNightAccount'

const accountState = vi.hoisted(() => ({
  account: { email: 'player@example.com', provider: 'password' } as {
    email: string | null
    provider: 'anonymous' | 'password' | 'google'
  } | null,
  ready: true,
  credits: 12 as number | null,
  held: true,
  googleResult: null as { ok: true } | { ok: false; error: string } | null,
}))

const notifications = vi.hoisted(() => ({ show: vi.fn() }))

vi.mock('@/db/services/auth-service', () => ({
  accountHeld: () => accountState.held,
  takeGoogleRedirectResult: () => {
    const result = accountState.googleResult
    accountState.googleResult = null
    return result
  },
}))

vi.mock('@/stores/notifications-store', () => ({
  showNotification: notifications.show,
}))

vi.mock('@/lib/standalone-account', () => ({
  account: () => accountState.account,
  accountReady: () => accountState.ready,
  credits: () => accountState.credits,
  refreshAccount: vi.fn(async () => undefined),
  signOutStandalone: vi.fn(),
}))

afterEach(() => {
  cleanup()
  accountState.account = {
    email: 'player@example.com',
    provider: 'password',
  }
  accountState.ready = true
  accountState.credits = 12
  accountState.held = true
  accountState.googleResult = null
  notifications.show.mockClear()
})

describe('GuitarNightAccount', () => {
  it('uses a disclosure and returns focus when Escape closes it', async () => {
    render(() => <GuitarNightAccount onSignIn={vi.fn()} />)

    const trigger = screen.getByRole('button', {
      name: 'Account for player, 12 credits remaining',
    })
    fireEvent.click(trigger)

    expect(
      screen.getByRole('group', { name: 'Account options' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()

    fireEvent.keyDown(window, { key: 'Escape' })

    expect(
      screen.queryByRole('group', { name: 'Account options' }),
    ).not.toBeInTheDocument()
    await waitFor(() => expect(trigger).toHaveFocus())
  })

  it('opens sign-in in the room when the compact rail hides its text', () => {
    accountState.account = { email: null, provider: 'anonymous' }
    accountState.credits = null
    accountState.held = false
    const onSignIn = vi.fn()

    render(() => <GuitarNightAccount onSignIn={onSignIn} />)

    const trigger = screen.getByRole('button', {
      name: 'Sign in to MercuryPitch',
    })
    fireEvent.click(trigger)

    expect(onSignIn).toHaveBeenCalledTimes(1)
    expect(
      screen.queryByRole('link', { name: 'Sign in to MercuryPitch' }),
    ).not.toBeInTheDocument()
  })

  it('shows held-account access before profile details finish loading', () => {
    accountState.account = null
    accountState.ready = false
    accountState.credits = null

    render(() => <GuitarNightAccount onSignIn={vi.fn()} />)

    expect(
      screen.getByRole('button', { name: 'Open account options' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Sign in to MercuryPitch' }),
    ).not.toBeInTheDocument()
  })

  it('surfaces a failed Google return in the standalone room', () => {
    accountState.googleResult = { ok: false, error: 'access_denied' }

    render(() => <GuitarNightAccount onSignIn={vi.fn()} />)

    expect(notifications.show).toHaveBeenCalledWith(
      'Google sign-in failed: access_denied',
      'error',
    )
  })

  it('forwards a successful Google return to the room host once', () => {
    const onGoogleRedirectResult = vi.fn()
    accountState.googleResult = { ok: true }

    render(() => (
      <GuitarNightAccount
        onSignIn={vi.fn()}
        onGoogleRedirectResult={onGoogleRedirectResult}
      />
    ))

    expect(onGoogleRedirectResult).toHaveBeenCalledOnce()
    expect(onGoogleRedirectResult).toHaveBeenCalledWith({ ok: true })
    expect(accountState.googleResult).toBeNull()
  })
})
