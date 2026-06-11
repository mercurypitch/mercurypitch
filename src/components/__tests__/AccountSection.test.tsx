// ============================================================
// AccountSection Component Tests — settings account flows
// ============================================================

import { fireEvent, render, screen } from '@solidjs/testing-library'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/defaults', () => ({
  API_BASE_URL: 'http://api.test',
  GOOGLE_CLIENT_ID: '', // disables the GIS script in tests
}))

const mocks = vi.hoisted(() => ({
  ensureAuth: vi.fn(async () => true),
  fetchMe: vi.fn(),
  loginWithPassword: vi.fn(),
  registerWithPassword: vi.fn(),
  loginWithGoogle: vi.fn(),
  logout: vi.fn(),
}))

vi.mock('@/db/services/auth-service', () => mocks)

import { AccountSection } from '../account/AccountSection'

const anonymousMe = {
  user: { authProvider: 'anonymous', email: null },
  profile: { displayName: 'Singer-1234' },
}

const passwordMe = {
  user: { authProvider: 'password', email: 'maff@example.com' },
  profile: { displayName: 'Maff' },
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('AccountSection', () => {
  it('offers account creation to anonymous users', async () => {
    mocks.fetchMe.mockResolvedValue(anonymousMe)
    render(() => <AccountSection />)

    expect(await screen.findByTestId('show-register')).toBeTruthy()
    expect(screen.getByTestId('show-login')).toBeTruthy()
    expect(mocks.ensureAuth).toHaveBeenCalledOnce()
  })

  it('registers with email, password and display name', async () => {
    mocks.fetchMe.mockResolvedValue(anonymousMe)
    mocks.registerWithPassword.mockResolvedValue({})
    render(() => <AccountSection />)

    fireEvent.click(await screen.findByTestId('show-register'))

    fireEvent.input(screen.getByTestId('auth-display-name'), {
      target: { value: 'Maff' },
    })
    fireEvent.input(screen.getByTestId('auth-email'), {
      target: { value: 'maff@example.com' },
    })
    fireEvent.input(screen.getByTestId('auth-password'), {
      target: { value: 'secret123' },
    })
    fireEvent.click(screen.getByTestId('auth-submit'))

    expect(mocks.registerWithPassword).toHaveBeenCalledWith(
      'maff@example.com',
      'secret123',
      'Maff',
    )
  })

  it('logs in with email and password', async () => {
    mocks.fetchMe.mockResolvedValue(anonymousMe)
    mocks.loginWithPassword.mockResolvedValue({})
    render(() => <AccountSection />)

    fireEvent.click(await screen.findByTestId('show-login'))
    fireEvent.input(screen.getByTestId('auth-email'), {
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
  })

  it('shows the signed-in state and supports sign out', async () => {
    mocks.fetchMe.mockResolvedValue(passwordMe)
    render(() => <AccountSection />)

    const email = await screen.findByTestId('account-email')
    expect(email.textContent).toBe('maff@example.com')

    fireEvent.click(screen.getByTestId('logout-button'))
    expect(mocks.logout).toHaveBeenCalledOnce()
    // Back to the sign-up call to action
    expect(await screen.findByTestId('show-register')).toBeTruthy()
  })

  it('surfaces auth errors in the form', async () => {
    mocks.fetchMe.mockResolvedValue(anonymousMe)
    mocks.loginWithPassword.mockRejectedValue(
      new Error('auth login failed: 401'),
    )
    render(() => <AccountSection />)

    fireEvent.click(await screen.findByTestId('show-login'))
    fireEvent.input(screen.getByTestId('auth-email'), {
      target: { value: 'maff@example.com' },
    })
    fireEvent.input(screen.getByTestId('auth-password'), {
      target: { value: 'wrong-pass' },
    })
    fireEvent.click(screen.getByTestId('auth-submit'))

    const error = await screen.findByTestId('auth-error')
    expect(error.textContent).toContain('401')
  })
})
