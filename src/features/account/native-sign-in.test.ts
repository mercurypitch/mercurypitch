// The two things this module exists to get right.
//
// The nonce: it has to be the SAME string in the plugin request and in the
// worker body. Apple echoes what it is given into the identity token's
// `nonce` claim, so a mismatch is not a weaker check, it is a sign-in that
// always fails — on device, after the sheet, where nobody can read a log.
//
// The error kind: a dismissed system sheet must not print an error under the
// form, and a token the worker refuses must not read as the singer's mistake.
// Those are different consequences from the same `catch`.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/native-build', () => ({
  IS_NATIVE_BUILD: true,
  CAN_TAKE_PAYMENT: false,
}))

const mocks = vi.hoisted(() => ({
  loginWithApple: vi.fn(),
  loginWithGoogle: vi.fn(),
}))

vi.mock('@/db/services/auth-service', () => ({
  loginWithApple: (...args: unknown[]) => mocks.loginWithApple(...args),
  loginWithGoogle: (...args: unknown[]) => mocks.loginWithGoogle(...args),
}))

import { nativeSignInAvailable, NativeSignInError, registerSocialLoginBridge, resetSocialLoginBridge, signInWithApple, signInWithGoogle, } from '@/features/account/native-sign-in'

const SESSION = {
  token: 'jwt',
  userId: 'u-1',
  isNew: false,
  user: { authProvider: 'apple' },
}

/** A bridge that answers with whatever the test hands it. */
function bridgeReturning(answer: unknown) {
  const login = vi.fn(() => Promise.resolve(answer))
  registerSocialLoginBridge(() =>
    Promise.resolve({ initialize: () => Promise.resolve(), login }),
  )
  return login
}

function bridgeRejecting(error: unknown) {
  const login = vi.fn(() => Promise.reject(error))
  registerSocialLoginBridge(() =>
    Promise.resolve({ initialize: () => Promise.resolve(), login }),
  )
  return login
}

beforeEach(() => {
  resetSocialLoginBridge()
  mocks.loginWithApple.mockResolvedValue(SESSION)
  mocks.loginWithGoogle.mockResolvedValue(SESSION)
})

afterEach(() => {
  resetSocialLoginBridge()
  vi.clearAllMocks()
})

describe('without a registered bridge', () => {
  it('reports itself unavailable rather than throwing something opaque', async () => {
    expect(nativeSignInAvailable()).toBe(false)
    await expect(signInWithApple()).rejects.toMatchObject({
      kind: 'unavailable',
    })
  })
})

describe('signInWithApple', () => {
  it('sends the plugin and the worker the same nonce', async () => {
    const login = bridgeReturning({
      result: { idToken: 'apple-jwt', profile: { user: 'a' } },
    })

    await signInWithApple()

    const sent = login.mock.calls[0] as unknown as [
      string,
      { nonce?: string; scopes?: string[] },
    ]
    const posted = mocks.loginWithApple.mock.calls[0][0] as { nonce?: string }
    expect(sent[0]).toBe('apple')
    expect(sent[1].nonce).toMatch(/^[A-Za-z0-9_-]{43}$/)
    // Not "both present" — the SAME string. Apple puts the plugin's value in
    // the token and the worker compares it to the body's.
    expect(posted.nonce).toBe(sent[1].nonce)
  })

  it('forwards the name and email Apple only ever sends once', async () => {
    bridgeReturning({
      result: {
        idToken: 'apple-jwt',
        authorizationCode: 'code-1',
        profile: {
          user: 'a',
          givenName: 'Ada',
          familyName: 'Lovelace',
          email: 'ada@example.com',
        },
      },
    })

    await signInWithApple()

    expect(mocks.loginWithApple.mock.calls[0][0]).toMatchObject({
      identityToken: 'apple-jwt',
      authorizationCode: 'code-1',
      user: {
        name: { firstName: 'Ada', lastName: 'Lovelace' },
        email: 'ada@example.com',
      },
    })
  })

  it('omits the user block entirely on a later sign-in', async () => {
    // Apple sends nothing the second time. An empty name object would ask the
    // worker to overwrite a real display name with undefined.
    bridgeReturning({
      result: { idToken: 'apple-jwt', profile: { user: 'a' } },
    })

    await signInWithApple()

    expect(mocks.loginWithApple.mock.calls[0][0]).toMatchObject({
      user: undefined,
    })
  })

  it('calls a dismissed sheet cancelled, not a failure', async () => {
    bridgeRejecting({ code: 'USER_CANCELLED', message: 'The user cancelled' })

    await expect(signInWithApple()).rejects.toMatchObject({
      kind: 'cancelled',
    })
  })

  it('calls a missing identity token what it is', async () => {
    bridgeReturning({ result: { idToken: null, profile: { user: 'a' } } })

    await expect(signInWithApple()).rejects.toMatchObject({
      kind: 'invalid_token',
    })
    expect(mocks.loginWithApple).not.toHaveBeenCalled()
  })

  it('calls a refused token a configuration fault, not a network one', async () => {
    bridgeReturning({
      result: { idToken: 'apple-jwt', profile: { user: 'a' } },
    })
    mocks.loginWithApple.mockRejectedValue(
      Object.assign(new Error('invalid_token'), { status: 401 }),
    )

    const error = await signInWithApple().catch((e: unknown) => e)

    expect(error).toBeInstanceOf(NativeSignInError)
    expect(error).toMatchObject({ kind: 'invalid_token' })
  })

  it('calls a fetch that never reached the worker a network failure', async () => {
    bridgeReturning({
      result: { idToken: 'apple-jwt', profile: { user: 'a' } },
    })
    mocks.loginWithApple.mockRejectedValue(new TypeError('Failed to fetch'))

    await expect(signInWithApple()).rejects.toMatchObject({ kind: 'network' })
  })
})

describe('signInWithGoogle', () => {
  it('reads the token out of `result`, which is where the plugin puts it', async () => {
    bridgeReturning({ provider: 'google', result: { idToken: 'google-jwt' } })

    await signInWithGoogle()

    expect(mocks.loginWithGoogle).toHaveBeenCalledWith('google-jwt')
  })

  it('still reads a flat answer, in case a platform does not nest it', async () => {
    bridgeReturning({ idToken: 'google-jwt' })

    await signInWithGoogle()

    expect(mocks.loginWithGoogle).toHaveBeenCalledWith('google-jwt')
  })

  it('lets the next press try again after a failed plugin load', async () => {
    let attempts = 0
    registerSocialLoginBridge(() => {
      attempts += 1
      return attempts === 1
        ? Promise.reject(new Error('bridge gone'))
        : Promise.resolve({
            initialize: () => Promise.resolve(),
            login: () => Promise.resolve({ result: { idToken: 'google-jwt' } }),
          })
    })

    await expect(signInWithGoogle()).rejects.toMatchObject({
      kind: 'unavailable',
    })
    // A cached rejected promise would make every later press fail forever.
    await expect(signInWithGoogle()).resolves.toMatchObject({ userId: 'u-1' })
  })
})
