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
import { CloudRequestError } from '@/db/adapters/server-adapter'
import type * as AuthService from '@/db/services/auth-service'
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
    findById: vi.fn(
      async (): Promise<{ id: string } | null> => ({ id: 'existing-profile' }),
    ),
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

vi.mock('@/db/services/auth-service', async (importOriginal) => ({
  // The real predicate: which providers count as an account is the
  // behaviour these tests are about.
  isRegisteredProvider: (await importOriginal<typeof AuthService>())
    .isRegisteredProvider,
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

import { getUserId, setAuthToken } from '@/db/services/user-service'
import { AccountSection } from '../account/AccountSection'

const anonymousMe = {
  user: { authProvider: 'anonymous', email: null },
  profile: { displayName: 'Singer-1234' },
}

const passwordMe = {
  user: { authProvider: 'password', email: 'maff@example.com' },
  profile: { displayName: 'Maff' },
}

/** Sign in with Apple, under the private relay address Apple hands out. */
const appleMe = {
  user: {
    authProvider: 'apple',
    email: 'x7qk2m9vtd@privaterelay.appleid.com',
  },
  profile: { displayName: 'Ada Lovelace' },
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

  // The words a singer agreed to are the record of their consent, so Settings
  // says what the sign-up sheet says. The owner dropped the "never more than
  // once a month" promise on 2026-10-11: nobody can say yet how often there
  // will be news, so neither box promises anything about it.
  it('offers product updates in the sign-up sheet words, with no promise of how often', async () => {
    mocks.fetchMe.mockResolvedValue(passwordMe)
    render(() => <AccountSection />)

    await screen.findByTestId('newsletter-optin')
    const words = document.body.textContent ?? ''
    expect(words).toContain('Email me product updates')
    expect(words).toContain('Unsubscribe anytime')
    expect(words).not.toMatch(/once a month|milestones only/i)
  })

  // Every provider but the device identity is an account. An allow-list of
  // the two that existed filed a Sign in with Apple account under anonymous
  // and offered its owner an account they already had.
  it('shows a Sign in with Apple account as signed in', async () => {
    mocks.fetchMe.mockResolvedValue(appleMe)
    render(() => <AccountSection />)

    expect(await screen.findByText('Signed in with Apple')).toBeTruthy()
    expect(screen.getByTestId('account-display-name').textContent).toBe(
      'Ada Lovelace',
    )
    expect(screen.getByTestId('account-email').textContent).toBe(
      'x7qk2m9vtd@privaterelay.appleid.com',
    )
    expect(screen.queryByTestId('show-login')).toBeNull()
    expect(
      screen.queryByText('You are practicing on an anonymous account.'),
    ).toBeNull()
  })

  // Apple minted the relay address and the singer never typed it, yet it is
  // the address an emailed code goes to — the only way into this account
  // from the web or Android, where there is no Apple sheet.
  it('tells the owner of a relay address to keep a note of it', async () => {
    mocks.fetchMe.mockResolvedValue(appleMe)
    render(() => <AccountSection />)

    expect((await screen.findByTestId('account-relay-note')).textContent).toBe(
      'Your private Apple address. Keep a note of it: it signs you in with an email code on the web or Android.',
    )
  })

  it('says nothing of the kind about an address the singer chose', async () => {
    mocks.fetchMe.mockResolvedValue({
      ...appleMe,
      user: { authProvider: 'apple', email: 'ada@example.com' },
    })
    render(() => <AccountSection />)

    expect((await screen.findByTestId('account-email')).textContent).toBe(
      'ada@example.com',
    )
    expect(screen.queryByTestId('account-relay-note')).toBeNull()
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

  it('saves the first name on the profile created during provisioning', async () => {
    let storedName = 'Maff'
    mocks.fetchMe.mockImplementation(async () => ({
      ...passwordMe,
      profile: { displayName: storedName },
    }))
    dbMocks.profileRepo.findById.mockResolvedValueOnce(null)
    dbMocks.profileRepo.create.mockRejectedValueOnce(
      new CloudRequestError(409, 'Profile already exists'),
    )
    dbMocks.profileRepo.update.mockImplementationOnce(async () => {
      storedName = 'First chosen name'
      return {}
    })
    const userId = getUserId()
    render(() => <AccountSection />)

    fireEvent.click(
      await screen.findByRole('button', { name: 'Edit display name' }),
    )
    fireEvent.input(screen.getByRole('textbox', { name: 'Display name' }), {
      target: { value: '  First chosen name  ' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save display name' }))

    expect(
      await screen.findByText('First chosen name', { selector: 'span' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('textbox', { name: 'Display name' }),
    ).not.toBeInTheDocument()
    expect(dbMocks.profileRepo.create).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ displayName: 'First chosen name' }),
    )
    expect(dbMocks.profileRepo.update).toHaveBeenCalledExactlyOnceWith(userId, {
      displayName: 'First chosen name',
    })
    expect(dbMocks.leaderboardRepo.update).not.toHaveBeenCalled()
  })

  it.each([
    { createStatus: 500, updateFails: false },
    { createStatus: 409, updateFails: true },
  ])(
    'retains the draft when first name save fails (create=$createStatus, updateFails=$updateFails)',
    async ({ createStatus, updateFails }) => {
      mocks.fetchMe.mockResolvedValue(passwordMe)
      dbMocks.profileRepo.findById.mockResolvedValueOnce(null)
      dbMocks.profileRepo.create.mockRejectedValueOnce(
        new CloudRequestError(createStatus, 'Profile create failed'),
      )
      if (updateFails)
        dbMocks.profileRepo.update.mockRejectedValueOnce(
          new Error('Profile update failed'),
        )
      render(() => <AccountSection />)

      fireEvent.click(
        await screen.findByRole('button', { name: 'Edit display name' }),
      )
      fireEvent.input(screen.getByRole('textbox', { name: 'Display name' }), {
        target: { value: 'Keep this draft' },
      })
      fireEvent.click(screen.getByRole('button', { name: 'Save display name' }))

      expect(
        await screen.findByText(
          updateFails ? 'Profile update failed' : 'Profile create failed',
        ),
      ).toBeInTheDocument()
      expect(screen.getByRole('textbox', { name: 'Display name' })).toHaveValue(
        'Keep this draft',
      )
      expect(
        screen.getByRole('button', { name: 'Save display name' }),
      ).toBeEnabled()
      expect(dbMocks.profileRepo.update).toHaveBeenCalledTimes(
        updateFails ? 1 : 0,
      )
      expect(mocks.fetchMe).toHaveBeenCalledOnce()
    },
  )

  it.each(['profile read', 'conflicting create', 'successful update'])(
    'does not finish a name save for an account selected during %s',
    async (boundary) => {
      setAuthToken(
        `header.${btoa(JSON.stringify({ sub: 'initial-account' }))}.signature`,
      )
      mocks.fetchMe.mockResolvedValue(passwordMe)
      const switchAccount = () =>
        setAuthToken(
          `header.${btoa(JSON.stringify({ sub: 'different-account' }))}.signature`,
        )
      if (boundary === 'profile read') {
        dbMocks.profileRepo.findById.mockImplementationOnce(async () => {
          switchAccount()
          return null
        })
      } else if (boundary === 'conflicting create') {
        dbMocks.profileRepo.findById.mockResolvedValueOnce(null)
        dbMocks.profileRepo.create.mockImplementationOnce(async () => {
          switchAccount()
          throw new CloudRequestError(409, 'Profile already exists')
        })
      } else {
        dbMocks.profileRepo.update.mockImplementationOnce(async () => {
          switchAccount()
          return {}
        })
      }
      render(() => <AccountSection />)

      fireEvent.click(
        await screen.findByRole('button', { name: 'Edit display name' }),
      )
      fireEvent.input(screen.getByRole('textbox', { name: 'Display name' }), {
        target: { value: 'Previous account draft' },
      })
      fireEvent.click(screen.getByRole('button', { name: 'Save display name' }))

      expect(
        await screen.findByText(
          'Your account changed. Check the current profile before saving a name.',
        ),
      ).toBeInTheDocument()
      expect(screen.getByRole('textbox', { name: 'Display name' })).toHaveValue(
        'Previous account draft',
      )
      expect(dbMocks.profileRepo.update).toHaveBeenCalledTimes(
        boundary === 'successful update' ? 1 : 0,
      )
      expect(dbMocks.profileRepo.create).toHaveBeenCalledTimes(
        boundary === 'conflicting create' ? 1 : 0,
      )
    },
  )

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

  // Keyboard users are the ones who feel an editor that opens and closes:
  // the caret has to land in the field on the way in, and come back to the
  // control that opened it on the way out, or they are dropped at the top of
  // the document with no idea where they were.
  it('moves the caret into the field and back to the pencil', async () => {
    mocks.fetchMe.mockResolvedValue(passwordMe)
    render(() => <AccountSection />)

    const input = await openEditor()
    await vi.waitFor(() => expect(document.activeElement).toBe(input))

    fireEvent.click(screen.getByTestId('display-name-cancel'))
    await vi.waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByTestId('display-name-edit'),
      ),
    )
  })

  it('closes on Enter when there is nothing to save', async () => {
    // The checkmark is disabled for an unchanged name, which is honest — but
    // Enter has to resolve the editor either way, or it reads as stuck.
    mocks.fetchMe.mockResolvedValue(passwordMe)
    render(() => <AccountSection />)

    const input = await openEditor()
    fireEvent.keyDown(input, { key: 'Enter' })

    await vi.waitFor(() =>
      expect(screen.queryByTestId('display-name-input')).toBeNull(),
    )
    expect(dbMocks.profileRepo.update).not.toHaveBeenCalled()
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

  it('says a refused name in a sentence, not as the transport error', async () => {
    // The worker's word filter answers 400 with JSON; ServerAdapter puts the
    // status, the URL and that JSON into its message. None of it is for the
    // singer.
    const body = '{"error":"displayName uses a word that is not allowed"}'
    mocks.fetchMe.mockResolvedValue(passwordMe)
    dbMocks.profileRepo.update.mockRejectedValueOnce(
      new CloudRequestError(
        400,
        `ServerAdapter: 400 Bad Request on https://api.test/api/userProfiles/u — ${body}`,
        body,
      ),
    )
    render(() => <AccountSection />)

    const input = await openEditor()
    fireEvent.input(input, { target: { value: 'Maffy' } })
    fireEvent.click(screen.getByTestId('display-name-save'))

    await vi.waitFor(() =>
      expect(screen.getByTestId('auth-error').textContent).toBe(
        "That name uses a word we don't allow. Try another.",
      ),
    )
    // Still open, so the singer can try another straight away.
    expect(screen.getByTestId('display-name-input')).toBeTruthy()
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
