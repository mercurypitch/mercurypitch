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
import { actAsIpad } from '@/tests/helpers/ipad-navigator'
import type { RenderedShell } from '../render-for-test'
import { renderShell } from '../render-for-test'
import { signInEverywhere } from './account-copy'
import type * as AccountState from './account-state'
import { openSignIn, resetSignIn, signInOpen } from './sign-in-state'
import { SignInSheet } from './SignInSheet'

const stand = vi.hoisted(() => ({
  apple: vi.fn(),
  google: vi.fn(),
  password: vi.fn(),
  twofa: vi.fn(),
  adopt: vi.fn(async () => 0),
  fillDue: vi.fn(),
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
vi.mock('@/db/services/voiceprint-service', () => ({
  adoptDeviceVoiceprints: stand.adopt,
}))
vi.mock('./account-fill', () => ({ markAccountFillDue: stand.fillDue }))
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
  stand.adopt.mockClear()
  stand.fillDue.mockClear()
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
    expect(q('signin-sheet')?.textContent).toContain(signInEverywhere())
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

describe("this phone's takes", () => {
  it('come along into an account made here (REQ-NAM-036, 037)', async () => {
    stand.apple.mockResolvedValue({ ...SESSION, isNew: true })
    openSignIn()

    q('signin-apple')?.click()
    await settle()

    expect(stand.adopt).toHaveBeenCalledTimes(1)
    expect(stand.fillDue).not.toHaveBeenCalled()
  })

  it('stay unclaimed on a sign-in to an account that already existed (REQ-NAM-039)', async () => {
    stand.google.mockResolvedValue(SESSION)
    openSignIn()

    q('signin-google')?.click()
    await settle()

    expect(signInOpen()).toBe(false)
    expect(stand.adopt).not.toHaveBeenCalled()
  })

  it("leave the account's history to be announced on Account (REQ-NAM-043)", async () => {
    stand.google.mockResolvedValue(SESSION)
    openSignIn()

    q('signin-google')?.click()
    await settle()

    expect(stand.fillDue).toHaveBeenCalledWith('user-1')
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

describe('on an iPad', () => {
  it('names the iPad in the lead, a missing way in and a lost connection', async () => {
    view?.unmount()
    const restore = actAsIpad()
    try {
      view = renderShell(() => <SignInSheet onSignedIn={signedIn} />)
      stand.google.mockRejectedValue(
        new NativeSignInError('unavailable', 'The plugin could not start.'),
      )
      stand.apple.mockRejectedValue(
        new NativeSignInError('network', 'Could not reach the server.'),
      )
      openSignIn()
      const lead = q('signin-sheet')?.textContent ?? ''

      q('signin-google')?.click()
      await settle()
      const missing = q('signin-sheet')?.textContent ?? ''
      q('signin-apple')?.click()
      await settle()
      const offline = q('signin-offline')?.textContent ?? ''

      expect(lead).toContain(
        'Use the same way on this iPad, your next one and the web.',
      )
      expect(missing).toContain(
        'Google sign-in is not available on this iPad. Choose another way.',
      )
      expect(offline).toContain('You are still practicing on this iPad.')
      expect(lead + missing + offline).not.toMatch(/\bphones?\b/iu)
    } finally {
      restore()
    }
  })
})
