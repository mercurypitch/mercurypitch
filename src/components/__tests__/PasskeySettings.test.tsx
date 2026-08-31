import { cleanup, fireEvent, render, screen, waitFor, } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'

// The error class lives in the hoisted block with the mocks: `vi.mock` factories
// run before top-level declarations, so a class declared beside them is still in
// its temporal dead zone when the factory reads it.
const mocks = vi.hoisted(() => {
  class PasskeyReauthRequired extends Error {
    readonly accepts: string[]
    constructor(message: string, accepts: string[] = []) {
      super(message)
      this.name = 'PasskeyReauthRequired'
      this.accepts = accepts
    }
  }
  return {
    PasskeyReauthRequired,
    passkeysAvailable: vi.fn(async () => true),
    fetchPasskeys: vi.fn(),
    addPasskey: vi.fn(),
    removePasskey: vi.fn(),
    platformAuthenticatorAvailable: vi.fn(async () => true),
  }
})

const { PasskeyReauthRequired } = mocks

vi.mock('@/db/services/auth-passkey-service', () => ({
  passkeysAvailable: () => mocks.passkeysAvailable(),
  fetchPasskeys: (...a: unknown[]) => mocks.fetchPasskeys(...a),
  addPasskey: (...a: unknown[]) => mocks.addPasskey(...a),
  removePasskey: (...a: unknown[]) => mocks.removePasskey(...a),
  PasskeyReauthRequired: mocks.PasskeyReauthRequired,
}))

vi.mock('@/lib/webauthn', () => ({
  platformAuthenticatorAvailable: () => mocks.platformAuthenticatorAvailable(),
  describeWebAuthnError: (err: unknown) =>
    err instanceof Error ? err.message : 'That did not work.',
}))

vi.mock('@/stores/notifications-store', () => ({ showNotification: vi.fn() }))

import { PasskeySettings } from '@/components/account/PasskeySettings'

function passkey(overrides: Record<string, unknown> = {}): unknown {
  return {
    id: 'cred-1',
    name: 'Passkey on iPhone',
    backedUp: true,
    createdAt: '2026-08-30 10:00:00',
    lastUsedAt: null,
    ...overrides,
  }
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  mocks.passkeysAvailable.mockResolvedValue(true)
  mocks.platformAuthenticatorAvailable.mockResolvedValue(true)
})

describe('PasskeySettings', () => {
  it('renders nothing where the deployment has no relying-party id', async () => {
    // A PR preview on workers.dev: the browser is willing, the domain cannot.
    mocks.passkeysAvailable.mockResolvedValue(false)
    render(() => <PasskeySettings />)

    await waitFor(() => expect(mocks.passkeysAvailable).toHaveBeenCalled())
    expect(screen.queryByTestId('passkey-settings')).toBeNull()
    // And it never asks the server for a list it could not act on.
    expect(mocks.fetchPasskeys).not.toHaveBeenCalled()
  })

  it('renders nothing where the browser has no authenticator', async () => {
    mocks.platformAuthenticatorAvailable.mockResolvedValue(false)
    render(() => <PasskeySettings />)

    await waitFor(() =>
      expect(mocks.platformAuthenticatorAvailable).toHaveBeenCalled(),
    )
    expect(screen.queryByTestId('passkey-settings')).toBeNull()
  })

  it('says which passkeys would survive losing the device', async () => {
    // Somebody choosing their only way in should know whether it syncs.
    mocks.fetchPasskeys.mockResolvedValue([
      passkey({ id: 'a', name: 'Passkey on iPhone', backedUp: true }),
      passkey({ id: 'b', name: 'Passkey on Windows', backedUp: false }),
    ])
    render(() => <PasskeySettings />)

    await waitFor(() =>
      expect(screen.getByText('Passkey on iPhone')).toBeTruthy(),
    )
    expect(screen.getByText(/synced/)).toBeTruthy()
    expect(screen.getByText(/this device only/)).toBeTruthy()
  })

  it('asks for a code when the session is too old to add one', async () => {
    // Sudo mode: the 403 must become a field, not a dead end.
    mocks.fetchPasskeys.mockResolvedValue([])
    mocks.addPasskey.mockRejectedValueOnce(
      new PasskeyReauthRequired('Confirm it is you before adding a passkey', [
        'code',
      ]),
    )
    render(() => <PasskeySettings />)

    fireEvent.click(await screen.findByTestId('passkey-add'))

    const field = (await screen.findByTestId(
      'passkey-proof',
    )) as HTMLInputElement
    expect(field.type).toBe('text')
    expect(screen.getByTestId('passkey-error').textContent).toBe(
      'Confirm it is you before adding a passkey',
    )

    // And the retry carries the code.
    mocks.addPasskey.mockResolvedValueOnce([passkey()])
    fireEvent.input(field, { target: { value: '123456' } })
    fireEvent.click(screen.getByTestId('passkey-add'))

    await waitFor(() =>
      expect(mocks.addPasskey).toHaveBeenLastCalledWith('123456'),
    )
    await waitFor(() =>
      expect(screen.queryByTestId('passkey-proof')).toBeNull(),
    )
  })

  it('asks for the password when that is all the account has', async () => {
    // The common case: no authenticator enrolled. A code field here would be
    // a box nobody can fill.
    mocks.fetchPasskeys.mockResolvedValue([])
    mocks.addPasskey.mockRejectedValueOnce(
      new PasskeyReauthRequired('Confirm it is you before adding a passkey', [
        'password',
      ]),
    )
    render(() => <PasskeySettings />)

    fireEvent.click(await screen.findByTestId('passkey-add'))

    const field = (await screen.findByTestId(
      'passkey-proof',
    )) as HTMLInputElement
    expect(field.type).toBe('password')
    expect(field.autocomplete).toBe('current-password')
  })

  it('sends someone with nothing to present back to sign-in', async () => {
    // A Google identity with no second factor. There is no proof it could
    // give, so the honest answer is the one thing that does work.
    mocks.fetchPasskeys.mockResolvedValue([])
    mocks.addPasskey.mockRejectedValue(
      new PasskeyReauthRequired('Sign in again before adding a passkey', []),
    )
    render(() => <PasskeySettings />)

    fireEvent.click(await screen.findByTestId('passkey-add'))

    await waitFor(() =>
      expect(screen.getByTestId('passkey-reauth-only')).toBeTruthy(),
    )
    // No field, and the button stops offering a retry that cannot succeed.
    expect(screen.queryByTestId('passkey-proof')).toBeNull()
    expect(
      (screen.getByTestId('passkey-add') as HTMLButtonElement).disabled,
    ).toBe(true)
  })

  it('reads a cancelled dialog as cancelled, not as a failure', async () => {
    mocks.fetchPasskeys.mockResolvedValue([])
    mocks.addPasskey.mockRejectedValue(new Error('That was cancelled.'))
    render(() => <PasskeySettings />)

    fireEvent.click(await screen.findByTestId('passkey-add'))

    await waitFor(() =>
      expect(screen.getByTestId('passkey-error').textContent).toBe(
        'That was cancelled.',
      ),
    )
  })

  it('removes one and shows what is left', async () => {
    mocks.fetchPasskeys.mockResolvedValue([
      passkey({ id: 'a', name: 'Passkey on iPhone' }),
      passkey({ id: 'b', name: 'Passkey on Windows' }),
    ])
    mocks.removePasskey.mockResolvedValue([
      passkey({ id: 'b', name: 'Passkey on Windows' }),
    ])
    render(() => <PasskeySettings />)

    fireEvent.click(await screen.findByTestId('passkey-remove-a'))

    await waitFor(() => expect(mocks.removePasskey).toHaveBeenCalledWith('a'))
    await waitFor(() =>
      expect(screen.queryByText('Passkey on iPhone')).toBeNull(),
    )
    expect(screen.getByText('Passkey on Windows')).toBeTruthy()
  })
})
