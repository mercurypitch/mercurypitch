// ============================================================
// AccountSection Component Tests — settings account flows
// ============================================================
// The sign-in/register form itself lives in AuthModal (see
// AuthModal.test.tsx); this section shows the account state and opens that
// modal from a single chip. Google is deliberately not tested here any more:
// the panel has no button of its own, and the shared helper is covered
// directly in src/tests/google-sign-in.test.ts.

import { fireEvent, render, screen } from '@solidjs/testing-library'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type * as BillingService from '@/db/services/billing-service'
import type * as BackgroundAccess from '@/lib/backgrounds/background-access'
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
  openAuthModal: vi.fn(),
  takeGoogleRedirectResult: vi.fn(() => null),
  // Read by the nested VoiceSection (via voiceprint-service) to decide
  // whether a cloud copy of the voiceprints exists. This mock replaces
  // the whole module, so anything the panel reaches transitively has to
  // be listed here or the call throws.
  hasValidToken: vi.fn(() => false),
  fetchBillingMe: vi.fn(async () => null),
  fetchPerksMe: vi.fn(async () => null),
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
}))
vi.mock('@/db/services/billing-service', async (importOriginal) => ({
  ...(await importOriginal<typeof BillingService>()),
  fetchBillingMe: mocks.fetchBillingMe,
}))
vi.mock('@/lib/backgrounds/background-access', async (importOriginal) => ({
  ...(await importOriginal<typeof BackgroundAccess>()),
  fetchPerksMe: mocks.fetchPerksMe,
}))
vi.mock('@/stores/ui-store', () => ({
  openAuthModal: mocks.openAuthModal,
  openFeedbackSurvey: vi.fn(),
}))
vi.mock('@/db', () => ({ getDb: dbMocks.getDb }))

import { setAuthToken } from '@/db/services/user-service'
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
  // One door, not three. Register and Google both live inside the modal, so
  // a second copy of them here could only drift from it.
  it('offers one way in to anonymous users', async () => {
    mocks.fetchMe.mockResolvedValue(anonymousMe)
    render(() => <AccountSection />)

    expect(await screen.findByTestId('show-login')).toBeTruthy()
    expect(screen.queryByTestId('show-register')).toBeNull()
    expect(screen.queryByTestId('google-signin')).toBeNull()
    // Opening the section restores an existing session and never provisions.
    expect(mocks.restoreAuth).toHaveBeenCalledOnce()
  })

  it('opens the auth modal from the one chip', async () => {
    mocks.fetchMe.mockResolvedValue(anonymousMe)
    render(() => <AccountSection />)

    fireEvent.click(await screen.findByTestId('show-login'))
    expect(mocks.openAuthModal).toHaveBeenCalledWith('login')
  })

  it('shows the signed-in state', async () => {
    mocks.fetchMe.mockResolvedValue(passwordMe)
    render(() => <AccountSection />)

    const email = await screen.findByTestId('account-email')
    expect(email.textContent).toBe('maff@example.com')
    expect(screen.getByTestId('account-display-name').textContent).toBe('Maff')
  })

  // Sign-out sits beside the line that says who you are, and it ends a
  // session mid-practice. The header pill has always asked first; this did
  // not, which meant the same gesture had two different consequences.
  it('asks before it signs anyone out', async () => {
    mocks.fetchMe.mockResolvedValue(passwordMe)
    render(() => <AccountSection />)

    fireEvent.click(await screen.findByTestId('logout-button'))
    expect(mocks.logout).not.toHaveBeenCalled()
    expect(screen.getByText('Sign out?')).toBeTruthy()

    fireEvent.click(screen.getByTestId('confirm-delete'))
    expect(mocks.logout).toHaveBeenCalledOnce()
    // Back to the way in
    expect(await screen.findByTestId('show-login')).toBeTruthy()
  })

  it('keeps them signed in when they back out', async () => {
    mocks.fetchMe.mockResolvedValue(passwordMe)
    render(() => <AccountSection />)

    fireEvent.click(await screen.findByTestId('logout-button'))
    fireEvent.click(screen.getByTestId('confirm-cancel'))

    expect(mocks.logout).not.toHaveBeenCalled()
    expect(screen.getByTestId('account-email')).toBeTruthy()
  })

  it('labels a managed test account and its expiry', async () => {
    mocks.fetchMe.mockResolvedValue({
      user: {
        authProvider: 'password',
        email: 'mc-test-demo@testing.mercurypitch.com',
        isTestAccount: true,
        testAccountExpiresAt: '2026-08-30T12:00:00.000Z',
      },
      profile: { displayName: 'Campaign Tester' },
    })
    render(() => <AccountSection />)

    expect(await screen.findByTestId('test-account-pill')).toBeTruthy()
    expect(screen.getByText(/Purchases are disabled/)).toBeTruthy()
  })
})

// ── The name is a pill until somebody asks to change it ──────────────
//
// The panel used to carry a labelled text field and a Save button for a value
// that is changed once and then read for years. It is the pill itself now,
// edited in place — which means the states worth pinning are the ones a
// standing field never had: opening, cancelling, and what the editor does
// with a profile refresh that lands while somebody is typing.

describe('the display name editor', () => {
  const googleMe = {
    user: { authProvider: 'google', email: 'maff@gmail.com' },
    profile: { displayName: 'Matija K' },
  }

  /** Press the pencil and hand back the field it opens. */
  async function openEditor(): Promise<HTMLInputElement> {
    fireEvent.click(await screen.findByTestId('display-name-edit'))
    return screen.getByTestId('display-name-input') as HTMLInputElement
  }

  it('shows no field until the pencil is pressed', async () => {
    mocks.fetchMe.mockResolvedValue(passwordMe)
    render(() => <AccountSection />)

    expect(await screen.findByTestId('account-display-name')).toBeTruthy()
    expect(screen.queryByTestId('display-name-input')).toBeNull()

    const input = await openEditor()
    // Seeded from the profile, so the common edit is a small correction
    // rather than retyping the whole name.
    expect(input.value).toBe('Maff')
    expect(screen.queryByTestId('account-display-name')).toBeNull()
  })

  it('saves the new name to the profile', async () => {
    mocks.fetchMe.mockResolvedValue(googleMe)
    render(() => <AccountSection />)

    const input = await openEditor()
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
    // And the editor closes behind a save that worked.
    await vi.waitFor(() =>
      expect(screen.queryByTestId('display-name-input')).toBeNull(),
    )
  })

  it('saves on Enter, so the checkmark is not the only way', async () => {
    mocks.fetchMe.mockResolvedValue(passwordMe)
    render(() => <AccountSection />)

    const input = await openEditor()
    fireEvent.input(input, { target: { value: 'Maffy' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await vi.waitFor(() =>
      expect(dbMocks.profileRepo.update).toHaveBeenCalledWith(
        expect.any(String),
        { displayName: 'Maffy' },
      ),
    )
  })

  it('throws away the edit on cancel, and on Escape', async () => {
    mocks.fetchMe.mockResolvedValue(passwordMe)
    render(() => <AccountSection />)

    const first = await openEditor()
    fireEvent.input(first, { target: { value: 'Discarded' } })
    fireEvent.click(screen.getByTestId('display-name-cancel'))

    expect(dbMocks.profileRepo.update).not.toHaveBeenCalled()
    expect(screen.getByTestId('account-display-name').textContent).toBe('Maff')

    // Reopening starts from the saved name, not from the abandoned edit.
    const second = await openEditor()
    expect(second.value).toBe('Maff')

    fireEvent.input(second, { target: { value: 'Also discarded' } })
    fireEvent.keyDown(second, { key: 'Escape' })
    expect(dbMocks.profileRepo.update).not.toHaveBeenCalled()
    expect(screen.getByTestId('account-display-name').textContent).toBe('Maff')
  })

  it('refuses an empty name, visibly', async () => {
    mocks.fetchMe.mockResolvedValue(passwordMe)
    render(() => <AccountSection />)

    const input = await openEditor()
    const save = screen.getByTestId('display-name-save') as HTMLButtonElement
    expect(save.disabled).toBe(true) // unchanged

    fireEvent.input(input, { target: { value: '   ' } })
    expect(save.disabled).toBe(true)
    // Not just a dead button: the field says it is wrong, the way a form
    // field would, and says why.
    expect(input.getAttribute('aria-invalid')).toBe('true')
    expect(screen.getByTestId('display-name-hint').textContent).toContain(
      'cannot be empty',
    )

    fireEvent.input(input, { target: { value: 'New Name' } })
    expect(save.disabled).toBe(false)
    expect(input.getAttribute('aria-invalid')).toBeNull()
  })

  it('keeps the editor open when the save fails', async () => {
    // The error line is useless if the field it refers to has already gone.
    mocks.fetchMe.mockResolvedValue(passwordMe)
    dbMocks.profileRepo.update.mockRejectedValueOnce(new Error('offline'))
    render(() => <AccountSection />)

    const input = await openEditor()
    fireEvent.input(input, { target: { value: 'Maffy' } })
    fireEvent.click(screen.getByTestId('display-name-save'))

    await vi.waitFor(() =>
      expect(screen.getByTestId('auth-error')).toBeTruthy(),
    )
    const still = screen.getByTestId('display-name-input') as HTMLInputElement
    expect(still.value).toBe('Maffy')
  })

  it('does not rewrite the field under the caret when the profile reloads', async () => {
    // refreshMe() runs on its own schedule. Before the editor existed this
    // could not be noticed; now a badly timed one would erase what somebody
    // is halfway through typing.
    mocks.fetchMe.mockResolvedValue(passwordMe)
    const { unmount } = render(() => <AccountSection />)

    const input = await openEditor()
    fireEvent.input(input, { target: { value: 'Half-typed na' } })

    mocks.fetchMe.mockResolvedValue({
      ...passwordMe,
      profile: { displayName: 'Server Name' },
    })
    // setAuthToken is what every real sign-in transition goes through, and
    // bumping authVersion is exactly how the panel learns to refetch.
    setAuthToken('another-token')

    await vi.waitFor(() =>
      expect(mocks.fetchMe.mock.calls.length).toBeGreaterThan(1),
    )
    expect(
      (screen.getByTestId('display-name-input') as HTMLInputElement).value,
    ).toBe('Half-typed na')
    unmount()
  })
})
