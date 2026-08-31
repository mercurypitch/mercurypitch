// Guitar Night separation auth tests keep sign-in on the page and resume only the blocked song.
// ============================================================

import { cleanup, fireEvent, render, screen, waitFor, } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { GuitarNightBandPreparationPort } from '@/features/guitar-night/band-preparation-port'
import { GUITAR_NIGHT_GOOGLE_SEPARATION_INTENT_TTL_MS, takeGuitarNightGoogleSeparationIntent, } from '@/features/guitar-night/guitar-night-google-separation-intent'
import { GuitarNightApp } from '@/features/guitar-night/GuitarNightApp'
import type { GuitarNightOpenBackingResult, GuitarNightSongPort, } from '@/features/guitar-night/song-port'
import { closeAuthModal } from '@/stores/ui-store'

const accountState = vi.hoisted(() => ({
  ready: true,
  signedIn: false,
  balance: null as number | null,
  balanceAfterRefresh: null as number | null,
  refreshAccount: vi.fn<() => Promise<void>>(async () => undefined),
  refreshCredits: vi.fn<() => Promise<void>>(async () => undefined),
  googleResult: null as { ok: true } | { ok: false; error: string } | null,
}))

vi.mock('@/db/services/auth-service', () => ({
  accountHeld: () => accountState.signedIn,
  takeGoogleRedirectResult: () => {
    const result = accountState.googleResult
    accountState.googleResult = null
    return result
  },
}))

vi.mock('@/lib/standalone-account', () => ({
  account: () =>
    accountState.signedIn
      ? { email: 'guitarist@example.com', provider: 'password' as const }
      : null,
  accountReady: () => accountState.ready,
  credits: () => accountState.balance,
  refreshAccount: accountState.refreshAccount,
  refreshCredits: accountState.refreshCredits,
  signedIn: () => accountState.signedIn,
  signOutStandalone: vi.fn(),
}))

vi.mock('@/components/account/AuthModal', () => ({
  AuthModal: (props: {
    tone?: 'default' | 'guitar-night'
    onAuthenticated?: () => void
    prepareGoogleRedirect?: () => (() => void) | undefined
  }) => (
    <div role="dialog" aria-label="Guitar Night sign in" data-tone={props.tone}>
      <button
        type="button"
        onClick={() => {
          accountState.signedIn = true
          accountState.balance = accountState.balanceAfterRefresh
          props.onAuthenticated?.()
        }}
      >
        Complete sign in
      </button>
      <button type="button" onClick={() => props.prepareGoogleRedirect?.()}>
        Start Google redirect
      </button>
    </div>
  ),
}))

function mixedSongPort(
  sessionId: string,
  instrumentalSizeBytes = 128,
): GuitarNightSongPort {
  return {
    initialize: vi.fn(async () => undefined),
    completedSongs: () => [
      {
        sessionId,
        title: 'Night Drive.wav',
        createdAt: Date.UTC(2026, 7, 25),
      },
    ],
    openSession: vi.fn(
      async (): Promise<GuitarNightOpenBackingResult> => ({
        ok: true,
        lease: {
          sessionId,
          title: 'Night Drive.wav',
          stems: [
            {
              kind: 'instrumental',
              url: 'blob:night-drive-instrumental',
              sizeBytes: instrumentalSizeBytes,
            },
          ],
          defaultMix: {
            kind: 'mixed-instrumental',
            audible: ['instrumental'],
            muted: [],
          },
          release: vi.fn(),
        },
      }),
    ),
  }
}

async function openMixedSong(): Promise<void> {
  fireEvent.click(screen.getByRole('button', { name: 'Load a song' }))
  fireEvent.click(
    await screen.findByRole('button', { name: /Night Drive\.wav/ }),
  )
  await screen.findByRole('button', { name: 'Separate guitar' })
}

function deferred(): {
  promise: Promise<void>
  resolve: () => void
} {
  let resolve = (): void => undefined
  const promise = new Promise<void>((settle) => {
    resolve = settle
  })
  return { promise, resolve }
}

describe('Guitar Night separation account gate', () => {
  beforeEach(() => {
    accountState.ready = true
    accountState.signedIn = false
    accountState.balance = null
    accountState.balanceAfterRefresh = 4
    accountState.googleResult = null
    accountState.refreshAccount.mockReset().mockResolvedValue(undefined)
    accountState.refreshCredits.mockReset().mockImplementation(async () => {
      accountState.balance = accountState.balanceAfterRefresh
    })
  })

  afterEach(() => {
    cleanup()
    closeAuthModal()
    vi.restoreAllMocks()
    localStorage.clear()
    window.history.replaceState(null, '', '/guitar-night')
  })

  it('opens one in-room sign-in action and resumes the exact blocked song', async () => {
    const prepareBand = vi.fn<GuitarNightBandPreparationPort['prepareBand']>(
      async () => ({ saved: ['drums', 'bass', 'guitar'] }),
    )
    const songPort = mixedSongPort('session-auth-intent')

    render(() => (
      <GuitarNightApp
        loadSongPort={() => Promise.resolve(songPort)}
        loadBandPreparationPort={() => Promise.resolve({ prepareBand })}
      />
    ))
    await openMixedSong()

    fireEvent.click(screen.getByRole('button', { name: 'Separate guitar' }))

    const signIn = await screen.findByRole('button', {
      name: /^Sign in$/,
    })
    expect(screen.getAllByRole('button', { name: /^Sign in$/ })).toHaveLength(1)
    expect(screen.queryByText('Open Account')).not.toBeInTheDocument()
    expect(prepareBand).not.toHaveBeenCalled()

    fireEvent.click(signIn)
    expect(
      await screen.findByRole('dialog', { name: 'Guitar Night sign in' }),
    ).toHaveAttribute('data-tone', 'guitar-night')
    fireEvent.click(screen.getByRole('button', { name: 'Complete sign in' }))

    await waitFor(() =>
      expect(prepareBand).toHaveBeenCalledWith(
        'session-auth-intent',
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      ),
    )
    expect(accountState.refreshAccount).toHaveBeenCalled()
    expect(accountState.refreshCredits).toHaveBeenCalled()
  })

  it('does not turn a topbar sign-in into a separation request', async () => {
    const prepareBand = vi.fn<GuitarNightBandPreparationPort['prepareBand']>()

    render(() => (
      <GuitarNightApp
        loadSongPort={() => Promise.resolve(mixedSongPort('session-topbar'))}
        loadBandPreparationPort={() => Promise.resolve({ prepareBand })}
      />
    ))

    fireEvent.click(
      await screen.findByRole('button', { name: 'Sign in to MercuryPitch' }),
    )
    fireEvent.click(
      await screen.findByRole('button', { name: 'Complete sign in' }),
    )

    await waitFor(() => expect(accountState.refreshCredits).toHaveBeenCalled())
    expect(prepareBand).not.toHaveBeenCalled()
  })

  it('does not resume separation after Back clears the blocked song during account refresh', async () => {
    const accountRefresh = deferred()
    const creditsRefresh = deferred()
    accountState.refreshAccount.mockReturnValueOnce(accountRefresh.promise)
    accountState.refreshCredits.mockReturnValueOnce(creditsRefresh.promise)
    const prepareBand = vi.fn<GuitarNightBandPreparationPort['prepareBand']>(
      async () => ({ saved: ['drums', 'bass', 'guitar'] }),
    )

    render(() => (
      <GuitarNightApp
        loadSongPort={() =>
          Promise.resolve(mixedSongPort('session-cancelled-auth-intent'))
        }
        loadBandPreparationPort={() => Promise.resolve({ prepareBand })}
      />
    ))
    await openMixedSong()
    fireEvent.click(screen.getByRole('button', { name: 'Separate guitar' }))
    fireEvent.click(await screen.findByRole('button', { name: /^Sign in$/ }))

    fireEvent.click(
      await screen.findByRole('button', { name: 'Complete sign in' }),
    )
    await waitFor(() => expect(accountState.refreshAccount).toHaveBeenCalled())
    // The way out of the staged panel is the chevron on its heading now.
    fireEvent.click(
      screen.getByRole('button', { name: 'Back to Guitar Night' }),
    )
    accountRefresh.resolve()
    await waitFor(() => expect(accountState.refreshCredits).toHaveBeenCalled())
    creditsRefresh.resolve()
    await creditsRefresh.promise
    await new Promise<void>((resolve) => setTimeout(resolve, 0))

    expect(prepareBand).not.toHaveBeenCalled()
  })

  it('waits for an unknown signed-in balance before starting paid work', async () => {
    accountState.signedIn = true
    accountState.balance = null
    accountState.balanceAfterRefresh = 0
    const prepareBand = vi.fn<GuitarNightBandPreparationPort['prepareBand']>()

    render(() => (
      <GuitarNightApp
        loadSongPort={() => Promise.resolve(mixedSongPort('session-empty'))}
        loadBandPreparationPort={() => Promise.resolve({ prepareBand })}
      />
    ))
    await openMixedSong()

    fireEvent.click(screen.getByRole('button', { name: 'Separate guitar' }))

    const creditsLink = await screen.findByRole('link', {
      name: 'Get credits',
    })
    expect(creditsLink).toHaveAttribute('href', '/#/settings/credits')
    expect(accountState.refreshCredits).toHaveBeenCalled()
    expect(prepareBand).not.toHaveBeenCalled()
  })

  it('resumes the exact blocked song after a successful Google return', async () => {
    const prepareBand = vi.fn<GuitarNightBandPreparationPort['prepareBand']>(
      async () => ({ saved: ['drums', 'bass', 'guitar'] }),
    )
    const songPort = mixedSongPort('session-google-intent')

    render(() => (
      <GuitarNightApp
        loadSongPort={() => Promise.resolve(songPort)}
        loadBandPreparationPort={() => Promise.resolve({ prepareBand })}
      />
    ))
    await openMixedSong()
    fireEvent.click(screen.getByRole('button', { name: 'Separate guitar' }))
    fireEvent.click(await screen.findByRole('button', { name: /^Sign in$/ }))
    fireEvent.click(
      await screen.findByRole('button', { name: 'Start Google redirect' }),
    )

    cleanup()
    closeAuthModal()
    accountState.signedIn = false
    accountState.balance = null
    accountState.refreshAccount.mockImplementation(async () => {
      accountState.signedIn = true
    })
    accountState.googleResult = { ok: true }

    render(() => (
      <GuitarNightApp
        loadSongPort={() => Promise.resolve(songPort)}
        loadBandPreparationPort={() => Promise.resolve({ prepareBand })}
      />
    ))

    await waitFor(() =>
      expect(prepareBand).toHaveBeenCalledWith(
        'session-google-intent',
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      ),
    )
  })

  it('consumes a failed Google return without replaying separation', async () => {
    const prepareBand = vi.fn<GuitarNightBandPreparationPort['prepareBand']>()
    const songPort = mixedSongPort('session-google-failure')

    render(() => (
      <GuitarNightApp
        loadSongPort={() => Promise.resolve(songPort)}
        loadBandPreparationPort={() => Promise.resolve({ prepareBand })}
      />
    ))
    await openMixedSong()
    fireEvent.click(screen.getByRole('button', { name: 'Separate guitar' }))
    fireEvent.click(await screen.findByRole('button', { name: /^Sign in$/ }))
    fireEvent.click(
      await screen.findByRole('button', { name: 'Start Google redirect' }),
    )

    cleanup()
    closeAuthModal()
    accountState.googleResult = { ok: false, error: 'access_denied' }
    render(() => (
      <GuitarNightApp
        loadSongPort={() => Promise.resolve(songPort)}
        loadBandPreparationPort={() => Promise.resolve({ prepareBand })}
      />
    ))

    await waitFor(() => expect(accountState.googleResult).toBeNull())
    expect(takeGuitarNightGoogleSeparationIntent()).toBeNull()
    expect(prepareBand).not.toHaveBeenCalled()
  })

  it('does not retry when the reopened backing no longer matches', async () => {
    const prepareBand = vi.fn<GuitarNightBandPreparationPort['prepareBand']>()
    const originalPort = mixedSongPort('session-google-mismatch')

    render(() => (
      <GuitarNightApp
        loadSongPort={() => Promise.resolve(originalPort)}
        loadBandPreparationPort={() => Promise.resolve({ prepareBand })}
      />
    ))
    await openMixedSong()
    fireEvent.click(screen.getByRole('button', { name: 'Separate guitar' }))
    fireEvent.click(await screen.findByRole('button', { name: /^Sign in$/ }))
    fireEvent.click(
      await screen.findByRole('button', { name: 'Start Google redirect' }),
    )

    cleanup()
    closeAuthModal()
    accountState.signedIn = true
    accountState.balance = 4
    accountState.googleResult = { ok: true }
    render(() => (
      <GuitarNightApp
        loadSongPort={() =>
          Promise.resolve(mixedSongPort('session-google-mismatch', 129))
        }
        loadBandPreparationPort={() => Promise.resolve({ prepareBand })}
      />
    ))

    await screen.findByRole('button', { name: 'Separate guitar' })
    await new Promise<void>((resolve) => setTimeout(resolve, 0))
    expect(prepareBand).not.toHaveBeenCalled()
  })

  it('does not retry an expired Google separation intent', async () => {
    const now = Date.UTC(2026, 7, 25, 12)
    const clock = vi.spyOn(Date, 'now').mockReturnValue(now)
    const prepareBand = vi.fn<GuitarNightBandPreparationPort['prepareBand']>()
    const songPort = mixedSongPort('session-google-expired')

    render(() => (
      <GuitarNightApp
        loadSongPort={() => Promise.resolve(songPort)}
        loadBandPreparationPort={() => Promise.resolve({ prepareBand })}
      />
    ))
    await openMixedSong()
    fireEvent.click(screen.getByRole('button', { name: 'Separate guitar' }))
    fireEvent.click(await screen.findByRole('button', { name: /^Sign in$/ }))
    fireEvent.click(
      await screen.findByRole('button', { name: 'Start Google redirect' }),
    )

    cleanup()
    closeAuthModal()
    clock.mockReturnValue(now + GUITAR_NIGHT_GOOGLE_SEPARATION_INTENT_TTL_MS)
    accountState.signedIn = true
    accountState.balance = 4
    accountState.googleResult = { ok: true }
    render(() => (
      <GuitarNightApp
        loadSongPort={() => Promise.resolve(songPort)}
        loadBandPreparationPort={() => Promise.resolve({ prepareBand })}
      />
    ))

    await screen.findByRole('button', { name: 'Separate guitar' })
    await new Promise<void>((resolve) => setTimeout(resolve, 0))
    expect(prepareBand).not.toHaveBeenCalled()
    expect(takeGuitarNightGoogleSeparationIntent()).toBeNull()
  })

  it('clears an abandoned separation intent when Google starts from the topbar', async () => {
    const prepareBand = vi.fn<GuitarNightBandPreparationPort['prepareBand']>()

    render(() => (
      <GuitarNightApp
        loadSongPort={() =>
          Promise.resolve(mixedSongPort('session-google-superseded'))
        }
        loadBandPreparationPort={() => Promise.resolve({ prepareBand })}
      />
    ))
    await openMixedSong()
    fireEvent.click(screen.getByRole('button', { name: 'Separate guitar' }))
    fireEvent.click(await screen.findByRole('button', { name: /^Sign in$/ }))
    fireEvent.click(
      await screen.findByRole('button', { name: 'Start Google redirect' }),
    )

    closeAuthModal()
    fireEvent.click(
      screen.getByRole('button', { name: 'Sign in to MercuryPitch' }),
    )
    fireEvent.click(
      await screen.findByRole('button', { name: 'Start Google redirect' }),
    )

    expect(takeGuitarNightGoogleSeparationIntent()).toBeNull()
    expect(prepareBand).not.toHaveBeenCalled()
  })
})
