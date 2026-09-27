// ============================================================
// The sign-in sheet: the ways in, and how a failure reads
// ============================================================
//
// The ceremonies are the existing services, stood in for here; what is
// pinned is the sheet's side of them. Apple comes first where there is an
// Apple sheet, a dismissed sheet says nothing, a lost connection is named as
// one and says the practice on the phone is safe (REQ-NAM-016, 049), a
// refused token never reads as the singer's mistake, and the television's
// phone row and the passkey button are not on the phone at all (audit D2).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as AuthService from '@/db/services/auth-service'
import type * as NativeSignIn from '@/features/account/native-sign-in'
import { NativeSignInError } from '@/features/account/native-sign-in'
import type { RenderedShell } from '../render-for-test'
import { renderShell } from '../render-for-test'
import { SIGN_IN_EVERYWHERE } from './account-copy'
import type * as AccountState from './account-state'
import { openSignIn, resetSignIn, signInOpen } from './sign-in-state'
import { SignInSheet } from './SignInSheet'

const stand = vi.hoisted(() => ({
  apple: vi.fn(),
  google: vi.fn(),
  password: vi.fn(),
  twofa: vi.fn(),
  appleOffered: true,
  googleOffered: true,
  owed: null as string | null,
}))

vi.mock('@/features/account/native-sign-in', async (importOriginal) => ({
  ...(await importOriginal<typeof NativeSignIn>()),
  signInWithApple: stand.apple,
  signInWithGoogle: stand.google,
}))
vi.mock('@/features/account/sign-in-methods', () => ({
  appleSignInOffered: () => stand.appleOffered,
  nativeGoogleSignInOffered: () => stand.googleOffered,
  webGoogleSignInOffered: () => false,
}))
vi.mock('@/db/services/auth-service', async (importOriginal) => ({
  ...(await importOriginal<typeof AuthService>()),
  loginWithPassword: stand.password,
  takeNativeTwofaChallenge: () => {
    const owed = stand.owed
    stand.owed = null
    return owed
  },
}))
vi.mock('@/db/services/auth-mfa-service', () => ({ verifyTwofa: stand.twofa }))
vi.mock('./account-state', async (importOriginal) => ({
  ...(await importOriginal<typeof AccountState>()),
  refreshAccount: vi.fn(async () => undefined),
}))

const SESSION = {
  token: 'header.body.signature',
  userId: 'user-1',
  isNew: false,
  user: {},
}

let view: RenderedShell | null = null
const signedIn = vi.fn()

function q(testId: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-testid="${testId}"]`)
}

function pane(): string | undefined {
  return q('signin-sheet')?.dataset.pane
}

/** Let the stood-in ceremonies settle, and Solid after them. */
async function settle(): Promise<void> {
  for (let i = 0; i < 4; i += 1) {
    await new Promise((resolve) => {
      setTimeout(resolve, 0)
    })
  }
}

function type(testId: string, value: string): void {
  const input = q(testId) as HTMLInputElement
  input.value = value
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

beforeEach(() => {
  stand.apple.mockReset()
  stand.google.mockReset()
  stand.password.mockReset()
  stand.twofa.mockReset()
  stand.appleOffered = true
  stand.googleOffered = true
  stand.owed = null
  signedIn.mockReset()
  resetSignIn()
  view = renderShell(() => <SignInSheet onSignedIn={signedIn} />)
})

afterEach(() => {
  resetSignIn()
  view?.unmount()
  view = null
})

describe('the ways in', () => {
  it('offers Apple first, then Google, then a code by email', () => {
    openSignIn()

    const ways = [
      ...document.querySelectorAll<HTMLElement>('.mp-signin__ways button'),
    ].map((button) => button.dataset.testid)

    expect(ways).toEqual(['signin-apple', 'signin-google', 'signin-email'])
    expect(q('signin-sheet')?.textContent).toContain(SIGN_IN_EVERYWHERE)
  })

  it('offers no Apple on a phone that has no Apple sheet', () => {
    stand.appleOffered = false

    openSignIn()

    expect(q('signin-apple')).toBeNull()
    expect(q('signin-google')).not.toBeNull()
  })

  it('has no television row and no passkey button (D2)', () => {
    openSignIn()

    const text = q('signin-sheet')?.textContent ?? ''

    expect(text).not.toContain('Sign in with your phone')
    expect(text.toLowerCase()).not.toContain('passkey')
  })

  it('signs in with Apple and closes', async () => {
    stand.apple.mockResolvedValue(SESSION)
    openSignIn()

    q('signin-apple')?.click()
    await settle()

    expect(signInOpen()).toBe(false)
    expect(signedIn).toHaveBeenCalledWith(SESSION)
  })

  it('keeps the password behind a link, and signs in with it', async () => {
    stand.password.mockResolvedValue(SESSION)
    openSignIn()
    q('signin-use-password')?.click()
    type('signin-password-email', 'singer@example.test')
    type('signin-password-input', 'correct horse')

    q('signin-password-submit')?.click()
    await settle()

    expect(stand.password).toHaveBeenCalledWith(
      'singer@example.test',
      'correct horse',
      '',
    )
    expect(signInOpen()).toBe(false)
  })
})

describe('when a way in does not end in a session', () => {
  it('says nothing when the Apple sheet is dismissed', async () => {
    stand.apple.mockRejectedValue(
      new NativeSignInError('cancelled', 'Sign-in was cancelled.'),
    )
    openSignIn()

    q('signin-apple')?.click()
    await settle()

    expect(q('signin-error')).toBeNull()
    expect(q('signin-offline')).toBeNull()
    expect(pane()).toBe('methods')
    expect(signInOpen()).toBe(true)
  })

  it('names a lost connection, and says the practice on the phone is safe', async () => {
    stand.google.mockRejectedValue(
      new NativeSignInError('network', 'Could not reach the server.'),
    )
    openSignIn()

    q('signin-google')?.click()
    await settle()

    const note = q('signin-offline')?.textContent ?? ''
    expect(note).toContain('MercuryPitch could not reach your account.')
    expect(note).toContain('You are still practicing on this phone.')
  })

  it("never words a refused token as the singer's mistake", async () => {
    stand.apple.mockRejectedValue(
      new NativeSignInError('invalid_token', 'Invalid identity token'),
    )
    openSignIn()

    q('signin-apple')?.click()
    await settle()

    const said = q('signin-error')?.textContent ?? ''
    expect(said).toContain('could not finish signing in with Apple')
    expect(said).not.toContain('Invalid identity token')
  })

  it('drops a way in the phone turns out not to have', async () => {
    stand.google.mockRejectedValue(
      new NativeSignInError('unavailable', 'The plugin could not start.'),
    )
    openSignIn()

    q('signin-google')?.click()
    await settle()

    expect(q('signin-google')).toBeNull()
    expect(q('signin-email')).not.toBeNull()
  })
})

describe('a second factor', () => {
  it('is asked for when the account has one', async () => {
    stand.apple.mockResolvedValue({ twofaRequired: true, ceremony: 'owed-1' })
    stand.twofa.mockResolvedValue(SESSION)
    openSignIn()
    q('signin-apple')?.click()
    await settle()

    type('signin-twofa-input', '123456')
    q('signin-twofa-submit')?.click()
    await settle()

    expect(stand.twofa).toHaveBeenCalledWith('owed-1', '123456')
    expect(signInOpen()).toBe(false)
  })

  it('takes a recovery code as plain text', async () => {
    stand.apple.mockResolvedValue({ twofaRequired: true, ceremony: 'owed-1' })
    openSignIn()
    q('signin-apple')?.click()
    await settle()

    type('signin-twofa-input', 'ABCDE-FGHIJ')

    expect(document.querySelector('.mp-code__boxes')).toBeNull()
    expect((q('signin-twofa-input') as HTMLInputElement).value).toBe(
      'ABCDE-FGHIJ',
    )
    expect((q('signin-twofa-submit') as HTMLButtonElement).disabled).toBe(false)
  })

  it('is finished here when another surface left one owed', () => {
    stand.owed = 'owed-elsewhere'

    openSignIn()

    expect(pane()).toBe('twofa')
  })

  it('says a wrong code is wrong and keeps the digits', async () => {
    stand.apple.mockResolvedValue({ twofaRequired: true, ceremony: 'owed-1' })
    stand.twofa.mockRejectedValue(new Error('That code did not match'))
    openSignIn()
    q('signin-apple')?.click()
    await settle()
    type('signin-twofa-input', '654321')

    q('signin-twofa-submit')?.click()
    await settle()

    expect(q('signin-error')?.textContent).toBe('That code did not match')
    expect((q('signin-twofa-input') as HTMLInputElement).value).toBe('654321')
  })
})
