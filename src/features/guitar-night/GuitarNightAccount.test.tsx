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
}))

vi.mock('@/db/services/auth-service', () => ({
  accountHeld: () => accountState.held,
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
})

describe('GuitarNightAccount', () => {
  it('uses a disclosure and returns focus when Escape closes it', async () => {
    render(() => <GuitarNightAccount />)

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

  it('keeps sign-in actionable when the compact rail hides its text', () => {
    accountState.account = { email: null, provider: 'anonymous' }
    accountState.credits = null
    accountState.held = false

    render(() => <GuitarNightAccount />)

    expect(
      screen.getByRole('link', { name: 'Sign in to MercuryPitch' }),
    ).toHaveAttribute('href', '/#/settings/account')
  })

  it('shows held-account access before profile details finish loading', () => {
    accountState.account = null
    accountState.ready = false
    accountState.credits = null

    render(() => <GuitarNightAccount />)

    expect(
      screen.getByRole('button', { name: 'Open account options' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: 'Sign in to MercuryPitch' }),
    ).not.toBeInTheDocument()
  })
})
