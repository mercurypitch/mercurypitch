// ============================================================
// AccountSection Component Tests — settings account flows
// ============================================================

import { fireEvent, render, screen } from '@solidjs/testing-library'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/defaults', () => ({
  API_BASE_URL: 'http://api.test',
}))

const mocks = vi.hoisted(() => ({
  ensureAuth: vi.fn(async () => true),
  fetchMe: vi.fn(),
  loginWithPassword: vi.fn(),
  registerWithPassword: vi.fn(),
  loginWithGoogle: vi.fn(),
  logout: vi.fn(),
  googleSignInUrl: vi.fn(() => 'http://api.test/api/auth/google/start'),
  takeGoogleRedirectResult: vi.fn(() => null),
}))

const dbMocks = vi.hoisted(() => {
  const profileRepo = {
    findById: vi.fn(async () => ({ id: 'existing-profile' })),
    update: vi.fn(async () => ({})),
    create: vi.fn(async () => ({})),
  }
  const leaderboardRepo = {
    findAll: vi.fn(async () => [{ id: 'lb1' }]),
    update: vi.fn(async () => ({})),
  }
  return {
    profileRepo,
    leaderboardRepo,
    getDb: vi.fn(async () => ({
      getRepository: (name: string) =>
        name === 'userProfiles' ? profileRepo : leaderboardRepo,
    })),
  }
})

vi.mock('@/db/services/auth-service', () => mocks)
vi.mock('@/db', () => ({ getDb: dbMocks.getDb }))

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
    expect(screen.getByTestId('account-display-name').textContent).toBe('Maff')

    fireEvent.click(screen.getByTestId('logout-button'))
    expect(mocks.logout).toHaveBeenCalledOnce()
    // Back to the sign-up call to action
    expect(await screen.findByTestId('show-register')).toBeTruthy()
  })

  it('lets a signed-in (e.g. Google) user pick a display name', async () => {
    mocks.fetchMe.mockResolvedValue({
      user: { authProvider: 'google', email: 'maff@gmail.com' },
      profile: { displayName: 'Matija K' },
    })
    render(() => <AccountSection />)

    const input = (await screen.findByTestId(
      'display-name-input',
    )) as HTMLInputElement
    // Prefilled with the current profile name (Google's name by default)
    expect(input.value).toBe('Matija K')

    fireEvent.input(input, { target: { value: 'MercuryMaff' } })
    fireEvent.click(screen.getByTestId('display-name-save'))

    await vi.waitFor(() => {
      expect(dbMocks.profileRepo.update).toHaveBeenCalledWith(
        expect.any(String),
        { displayName: 'MercuryMaff' },
      )
    })
    // The leaderboard is server-derived from the profile, so the client must
    // not touch the (no-longer-exposed) leaderboardEntries table.
    expect(dbMocks.leaderboardRepo.update).not.toHaveBeenCalled()
  })

  it('disables saving an unchanged or empty display name', async () => {
    mocks.fetchMe.mockResolvedValue(passwordMe)
    render(() => <AccountSection />)

    const save = (await screen.findByTestId(
      'display-name-save',
    )) as HTMLButtonElement
    expect(save.disabled).toBe(true) // unchanged

    const input = screen.getByTestId('display-name-input') as HTMLInputElement
    fireEvent.input(input, { target: { value: '   ' } })
    expect(save.disabled).toBe(true) // empty

    fireEvent.input(input, { target: { value: 'New Name' } })
    expect(save.disabled).toBe(false)
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
