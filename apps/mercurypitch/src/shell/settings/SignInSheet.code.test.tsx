// ============================================================
// The sign-in sheet: a code by email, and the six boxes
// ============================================================
//
// "Email me a code" signs in, or sets up an account when the address has
// none (S6 decision 05 A), so the request asks for a sign-up code and the
// verify brings this phone's anonymous practice along. The pane never says
// whether the address had an account. The boxes are one real field, so the
// keyboard's code suggestion fills them in one go.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RenderedShell } from '../render-for-test'
import { renderShell } from '../render-for-test'
import type * as AccountState from './account-state'
import { openSignIn, resetSignIn, signInOpen } from './sign-in-state'
import { SignInSheet } from './SignInSheet'

const stand = vi.hoisted(() => ({
  request: vi.fn(),
  verify: vi.fn(),
  adopt: vi.fn(async () => 0),
}))

vi.mock('@/db/services/auth-email-code-service', () => ({
  requestLoginCode: stand.request,
  verifyLoginCode: stand.verify,
}))
vi.mock('@/db/services/voiceprint-service', () => ({
  adoptDeviceVoiceprints: stand.adopt,
}))
vi.mock('@/features/account/sign-in-methods', () => ({
  appleSignInOffered: () => false,
  nativeGoogleSignInOffered: () => false,
  webGoogleSignInOffered: () => false,
}))
vi.mock('./account-state', async (importOriginal) => ({
  ...(await importOriginal<typeof AccountState>()),
  refreshAccount: vi.fn(async () => undefined),
}))

const SESSION = { token: 'h.b.s', userId: 'user-1', isNew: true, user: {} }

let view: RenderedShell | null = null

function q(testId: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-testid="${testId}"]`)
}

function pane(): string | undefined {
  return q('signin-sheet')?.dataset.pane
}

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

/** Open the sheet, ask for a code for `address`, and land on the code pane. */
async function codeSentTo(address: string): Promise<void> {
  openSignIn()
  q('signin-email')?.click()
  type('signin-email-input', address)
  q('signin-send-code')?.click()
  await settle()
}

beforeEach(() => {
  stand.request.mockReset()
  stand.verify.mockReset()
  stand.adopt.mockClear()
  stand.request.mockResolvedValue('ceremony-1')
  resetSignIn()
  view = renderShell(() => <SignInSheet />)
})

afterEach(() => {
  resetSignIn()
  view?.unmount()
  view = null
})

describe('a code by email', () => {
  it('asks for a code that can set an account up', async () => {
    await codeSentTo('New@Example.test ')

    expect(stand.request).toHaveBeenCalledWith('new@example.test', '', {
      signUp: true,
    })
    expect(pane()).toBe('code')
    expect(q('signin-sheet')?.textContent).toContain(
      'A six-digit code is on its way to new@example.test',
    )
  })

  it('never says whether the address had an account', async () => {
    await codeSentTo('new@example.test')

    const text = q('signin-sheet')?.textContent ?? ''

    expect(text).not.toContain('If an account exists')
    expect(text.toLowerCase()).not.toContain('no account')
  })

  it('wakes the Sign in button at six digits', async () => {
    await codeSentTo('new@example.test')

    type('signin-code-input', '12345')
    const atFive = (q('signin-code-submit') as HTMLButtonElement).disabled
    type('signin-code-input', '123456')
    const atSix = (q('signin-code-submit') as HTMLButtonElement).disabled

    expect(atFive).toBe(true)
    expect(atSix).toBe(false)
  })

  it("signs in with the code, bringing this phone's practice along", async () => {
    stand.verify.mockResolvedValue(SESSION)
    await codeSentTo('new@example.test')
    type('signin-code-input', '123456')

    q('signin-code-submit')?.click()
    await settle()

    expect(stand.verify).toHaveBeenCalledWith('ceremony-1', '123456', {
      proveDevice: true,
    })
    expect(signInOpen()).toBe(false)
    // The code made the account (isNew), so the phone's takes join it.
    expect(stand.adopt).toHaveBeenCalledTimes(1)
  })

  it('says a wrong code is wrong and keeps the digits', async () => {
    stand.verify.mockRejectedValue(
      new Error('That code is not valid or has expired'),
    )
    await codeSentTo('new@example.test')
    type('signin-code-input', '111111')

    q('signin-code-submit')?.click()
    await settle()

    expect(q('signin-error')?.textContent).toBe(
      'That code is not valid or has expired',
    )
    expect((q('signin-code-input') as HTMLInputElement).value).toBe('111111')
  })

  it('sends another code to the same address', async () => {
    stand.request.mockResolvedValueOnce('ceremony-1')
    stand.request.mockResolvedValueOnce('ceremony-2')
    stand.verify.mockResolvedValue(SESSION)
    await codeSentTo('new@example.test')

    q('signin-resend')?.click()
    await settle()
    type('signin-code-input', '222222')
    q('signin-code-submit')?.click()
    await settle()

    expect(stand.request).toHaveBeenLastCalledWith('new@example.test', '', {
      signUp: true,
    })
    expect(stand.verify).toHaveBeenCalledWith('ceremony-2', '222222', {
      proveDevice: true,
    })
  })

  it('steps back from the code to the address, keeping it', async () => {
    await codeSentTo('new@example.test')

    q('signin-back')?.click()

    expect(pane()).toBe('email')
    expect((q('signin-email-input') as HTMLInputElement).value).toBe(
      'new@example.test',
    )
  })

  it('names a lost connection when the code cannot be sent', async () => {
    stand.request.mockRejectedValue(new TypeError('Failed to fetch'))

    await codeSentTo('new@example.test')

    expect(pane()).toBe('email')
    expect(q('signin-offline')?.textContent).toContain(
      'You are still practicing on this phone.',
    )
  })
})

describe('the six boxes', () => {
  it('keep digits only, six of them', async () => {
    await codeSentTo('new@example.test')

    type('signin-code-input', 'a1b2c3d4e5f6g7')

    expect((q('signin-code-input') as HTMLInputElement).value).toBe('123456')
    expect(
      [...document.querySelectorAll('.mp-code__box')].map((b) => b.textContent),
    ).toEqual(['1', '2', '3', '4', '5', '6'])
  })

  it('are one field the keyboard can fill in one go', async () => {
    await codeSentTo('new@example.test')

    const field = q('signin-code-input') as HTMLInputElement

    expect(field.getAttribute('autocomplete')).toBe('one-time-code')
    expect(field.getAttribute('inputmode')).toBe('numeric')
    expect(document.querySelectorAll('.mp-code input')).toHaveLength(1)
  })
})
