// ============================================================
// Karaoke Night's account form: what a new account agrees to
// ============================================================
//
// Karaoke Night creates accounts with its own form, not the studio's
// AuthModal, so the sign-up line is pinned here as well.

import { fireEvent, render, screen } from '@solidjs/testing-library'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/db/services/auth-service', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  registerWithPassword: vi.fn(),
  loginWithPassword: vi.fn(),
  takeGoogleRedirectResult: () => null,
}))

vi.mock('@/lib/standalone-account', () => ({
  account: () => null,
  credits: () => null,
  refreshAccount: async () => {},
  signedIn: () => false,
  signOutStandalone: () => {},
}))

vi.mock('@/stores/notifications-store', () => ({ showNotification: vi.fn() }))

import { KaraokeAccount } from '@/features/karaoke-night/KaraokeAccount'

describe('Karaoke Night sign-up line', () => {
  it('appears on the create-account form and not on sign-in', () => {
    render(() => <KaraokeAccount />)
    fireEvent.click(screen.getByText('Sign in'))
    expect(screen.queryByTestId('signup-legal-line')).not.toBeInTheDocument()

    fireEvent.click(screen.getByText('New here? Create an account'))

    const line = screen.getByTestId('signup-legal-line')
    expect(line.querySelector('a[href$="/terms"]')).not.toBeNull()
    expect(line.querySelector('a[href$="/privacy"]')).not.toBeNull()
  })
})
