// Guitar Night account disclosure tests protect keyboard dismissal and focus recovery.
// ============================================================

import { cleanup, fireEvent, render, screen, waitFor, } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GuitarNightAccount } from './GuitarNightAccount'

vi.mock('@/lib/standalone-account', () => ({
  account: () => ({ email: 'player@example.com', provider: 'password' }),
  accountReady: () => true,
  credits: () => 12,
  refreshAccount: vi.fn(async () => undefined),
  signedIn: () => true,
  signOutStandalone: vi.fn(),
}))

afterEach(() => cleanup())

describe('GuitarNightAccount', () => {
  it('uses a disclosure and returns focus when Escape closes it', async () => {
    render(() => <GuitarNightAccount />)

    const trigger = screen.getByRole('button', { name: /player/i })
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
})
