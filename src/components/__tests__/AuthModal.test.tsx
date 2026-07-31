// ============================================================
// AuthModal Component Tests — sign-in / register / forgot flows
// ============================================================
// Drives the real ui-store open/close signals; the auth-service calls
// are mocked.

import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  loginWithPassword: vi.fn(),
  registerWithPassword: vi.fn(),
  requestPasswordReset: vi.fn(),
  googleSignInUrl: vi.fn(() => 'http://api.test/api/auth/google/start'),
}))

vi.mock('@/db/services/auth-service', () => mocks)

import { closeAuthModal, openAuthModal } from '@/stores/ui-store'
import { AuthModal } from '../account/AuthModal'

beforeEach(() => {
  vi.clearAllMocks()
  closeAuthModal()
})

describe('AuthModal', () => {
  it('stays hidden until opened', () => {
    render(() => <AuthModal />)
    expect(screen.queryByTestId('auth-modal-overlay')).not.toBeInTheDocument()
  })

  it('signs in with email and password, then closes', async () => {
    mocks.loginWithPassword.mockResolvedValue({})
    render(() => <AuthModal />)

    openAuthModal('login')
    fireEvent.input(await screen.findByTestId('auth-email'), {
      target: { value: 'maff@example.com' },
    })
    fireEvent.input(screen.getByTestId('auth-password'), {
      target: { value: 'secret123' },
    })
    fireEvent.click(screen.getByTestId('auth-submit'))

    expect(mocks.loginWithPassword).toHaveBeenCalledWith(
      'maff@example.com',
      'secret123',
    )
    await waitFor(() =>
      expect(
        screen.queryByTestId('auth-modal-overlay'),
      ).not.toBeInTheDocument(),
    )
  })

  it('registers with email, password and display name', async () => {
    mocks.registerWithPassword.mockResolvedValue({})
    render(() => <AuthModal />)

    openAuthModal('register')
    fireEvent.input(await screen.findByTestId('auth-display-name'), {
      target: { value: 'Maff' },
    })
    fireEvent.input(screen.getByTestId('auth-email'), {
      target: { value: 'maff@example.com' },
    })
    fireEvent.input(screen.getByTestId('auth-password'), {
      target: { value: 'secret123' },
    })
    fireEvent.click(screen.getByTestId('auth-submit'))

    await waitFor(() =>
      expect(mocks.registerWithPassword).toHaveBeenCalledWith(
        'maff@example.com',
        'secret123',
        'Maff',
      ),
    )
  })

  it('blocks registration while the password fails the policy', async () => {
    render(() => <AuthModal />)

    openAuthModal('register')
    fireEvent.input(await screen.findByTestId('auth-email'), {
      target: { value: 'maff@example.com' },
    })
    // No digit — fails the letter+number policy
    fireEvent.input(screen.getByTestId('auth-password'), {
      target: { value: 'onlyletters' },
    })
    fireEvent.click(screen.getByTestId('auth-submit'))

    expect(await screen.findByTestId('auth-error')).toBeInTheDocument()
    expect(mocks.registerWithPassword).not.toHaveBeenCalled()
  })

  it('sends a reset link from the forgot pane', async () => {
    mocks.requestPasswordReset.mockResolvedValue(undefined)
    render(() => <AuthModal />)

    openAuthModal('login')
    fireEvent.click(await screen.findByTestId('auth-forgot-link'))

    // Forgot pane: email only, no password field
    expect(screen.queryByTestId('auth-password')).not.toBeInTheDocument()
    fireEvent.input(screen.getByTestId('auth-email'), {
      target: { value: 'maff@example.com' },
    })
    fireEvent.click(screen.getByTestId('auth-submit'))

    await waitFor(() =>
      expect(mocks.requestPasswordReset).toHaveBeenCalledWith(
        'maff@example.com',
      ),
    )
    expect(await screen.findByTestId('auth-forgot-sent')).toBeInTheDocument()
  })

  it('surfaces server errors in the form', async () => {
    mocks.loginWithPassword.mockRejectedValue(
      new Error('Invalid email or password'),
    )
    render(() => <AuthModal />)

    openAuthModal('login')
    fireEvent.input(await screen.findByTestId('auth-email'), {
      target: { value: 'maff@example.com' },
    })
    fireEvent.input(screen.getByTestId('auth-password'), {
      target: { value: 'wrong-pass1' },
    })
    fireEvent.click(screen.getByTestId('auth-submit'))

    const error = await screen.findByTestId('auth-error')
    expect(error.textContent).toContain('Invalid email or password')
    // Still open so the user can retry
    expect(screen.getByTestId('auth-modal-overlay')).toBeInTheDocument()
  })

  it('closes from the header button', async () => {
    render(() => <AuthModal />)

    openAuthModal('login')
    fireEvent.click(await screen.findByTestId('auth-modal-close'))
    await waitFor(() =>
      expect(
        screen.queryByTestId('auth-modal-overlay'),
      ).not.toBeInTheDocument(),
    )
  })
})
