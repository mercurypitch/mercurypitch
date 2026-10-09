// ============================================================
// AuthModal: the line that says what a new account agrees to
// ============================================================

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/db/services/auth-service', () => ({
  loginWithPassword: vi.fn(),
  registerWithPassword: vi.fn(),
  requestPasswordReset: vi.fn(),
  isTwofaChallenge: () => false,
  takeGoogleTwofaChallenge: () => null,
  takeNativeTwofaChallenge: () => null,
}))

import { closeAuthModal, openAuthModal } from '@/stores/ui-store'
import { AuthModal } from './AuthModal'

afterEach(() => {
  closeAuthModal()
  cleanup()
})

describe('AuthModal sign-up line', () => {
  it('states the Terms and the Privacy Notice under Create account', async () => {
    render(() => <AuthModal />)
    openAuthModal('register')
    await screen.findByTestId('auth-email')

    const line = screen.getByTestId('signup-legal-line')
    const submit = screen.getByTestId('auth-submit')

    expect(submit.textContent).toBe('Create account')
    // Under the button: the line follows it in document order.
    expect(
      submit.compareDocumentPosition(line) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(line.querySelector('a[href$="/terms"]')).not.toBeNull()
    expect(line.querySelector('a[href$="/privacy"]')).not.toBeNull()
  })

  it('keeps the line off the sign-in form', async () => {
    render(() => <AuthModal />)
    openAuthModal('login')
    await screen.findByTestId('auth-email')

    expect(screen.queryByTestId('signup-legal-line')).not.toBeInTheDocument()

    fireEvent.click(screen.getByTestId('auth-switch-register'))
    expect(screen.getByTestId('signup-legal-line')).toBeInTheDocument()
  })
})
