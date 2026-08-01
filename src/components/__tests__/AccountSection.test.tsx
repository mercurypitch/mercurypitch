// ============================================================
// AccountSection Component Tests — settings account flows
// ============================================================
// The sign-in/register form itself lives in AuthModal (see
// AuthModal.test.tsx); this section shows the account state and opens
// that modal from its CTAs.

import { fireEvent, render, screen } from '@solidjs/testing-library'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type * as Defaults from '@/lib/defaults'

// Spread the real module rather than replacing it: only API_BASE_URL needs
// faking, and a bare object breaks the moment the component pulls in anything
// else from defaults transitively (IS_TEST, via ui-store → test-utils).
vi.mock('@/lib/defaults', async (importOriginal) => ({
  ...(await importOriginal<typeof Defaults>()),
  API_BASE_URL: 'http://api.test',
}))

const mocks = vi.hoisted(() => ({
  restoreAuth: vi.fn(async () => true),
  fetchMe: vi.fn(),
  logout: vi.fn(),
  googleSignInUrl: vi.fn(() => 'http://api.test/api/auth/google/start'),
  openAuthModal: vi.fn(),
  takeGoogleRedirectResult: vi.fn(() => null),
  // Read by the nested VoiceSection (via voiceprint-service) to decide
  // whether a cloud copy of the voiceprints exists. This mock replaces
  // the whole module, so anything the panel reaches transitively has to
  // be listed here or the call throws.
  hasValidToken: vi.fn(() => false),
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

vi.mock('@/db/services/auth-service', () => ({
  restoreAuth: mocks.restoreAuth,
  deleteAccount: vi.fn(async () => undefined),
  fetchMe: mocks.fetchMe,
  logout: mocks.logout,
  googleSignInUrl: mocks.googleSignInUrl,
}))
vi.mock('@/stores/ui-store', () => ({
  openAuthModal: mocks.openAuthModal,
  openFeedbackSurvey: vi.fn(),
}))
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
    expect(screen.getByTestId('google-signin')).toBeTruthy()
    // Opening the section restores an existing session and never provisions.
    expect(mocks.restoreAuth).toHaveBeenCalledOnce()
  })

  it('opens the auth modal on the register pane', async () => {
    mocks.fetchMe.mockResolvedValue(anonymousMe)
    render(() => <AccountSection />)

    fireEvent.click(await screen.findByTestId('show-register'))
    expect(mocks.openAuthModal).toHaveBeenCalledWith('register')
  })

  it('opens the auth modal on the login pane', async () => {
    mocks.fetchMe.mockResolvedValue(anonymousMe)
    render(() => <AccountSection />)

    fireEvent.click(await screen.findByTestId('show-login'))
    expect(mocks.openAuthModal).toHaveBeenCalledWith('login')
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
})
