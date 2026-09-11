// ============================================================
// Native sign-in — the phone's own Apple and Google ceremonies
// ============================================================
//
// On the web, Google sign-in is a full-page redirect (the app's
// `COOP: same-origin` header severs `window.opener`, which breaks the GIS
// popup). Inside a WebView there is no page to redirect: the platform runs
// the ceremony itself and hands back an identity token. This module is the
// two steps between that token and a session — nonce, mapping, error kinds —
// and nothing else.
//
// **The plugin is not imported here.** `@capgo/capacitor-social-login` is a
// dependency of `apps/mercurypitch` alone, and the whole point of the thin
// alias is that this same source tree also builds the web app. So the native
// entry registers a loader (`registerSocialLoginBridge`) whose dynamic import
// lives in the package that actually depends on the plugin, and the web bundle
// cannot contain it — not "is tree-shaken of it", cannot contain it. A build
// where nobody registered a loader answers `unavailable`, which is exactly
// what the web build should say.
//
// The bridge speaks `unknown` on purpose. What comes back really is untyped
// JSON across a native bridge, and the reading of it belongs here, next to the
// request bodies it has to fill, rather than in the shell.
//
// ── The Apple nonce, and what the worker has to do with it ──
//
// The nonce generated below is sent RAW in two directions: to the plugin,
// which assigns it to `ASAuthorizationAppleIDRequest.nonce` verbatim (no
// hashing — see the plugin's AppleProvider.swift), and to the worker in the
// request body. Apple echoes that exact string into the identity token's
// `nonce` claim, so the worker's check is a plain equality against the body
// value. It is deliberately NOT the SHA-256 convention Firebase documents:
// that exists so a raw nonce never reaches a third party, and here there is
// no third party — the token goes straight to our own worker over TLS.

import type { SignInOutcome } from '@/db/services/auth-service'
import { loginWithApple, loginWithGoogle } from '@/db/services/auth-service'
import { IS_NATIVE_BUILD } from '@/lib/native-build'

/**
 * Why a sign-in did not produce a session.
 *
 * Four kinds, because the caller does four different things:
 *   cancelled      say nothing — dismissing a system sheet is an answer
 *   unavailable    the platform cannot offer this at all; hide the button
 *   network        offer to try again
 *   invalid_token  the ceremony worked and the server refused it; this is a
 *                  configuration fault (audience, team id, bundle id) and it
 *                  must not read as the singer's mistake
 */
export type NativeSignInFailure =
  | 'cancelled'
  | 'unavailable'
  | 'network'
  | 'invalid_token'

export class NativeSignInError extends Error {
  constructor(
    readonly kind: NativeSignInFailure,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options)
    this.name = 'NativeSignInError'
  }
}

/** The narrowest shape of the plugin this module needs. */
export interface SocialLoginBridge {
  /** Idempotent: the shell calls it once, this calls it again if it did not. */
  initialize(): Promise<void>
  login(
    provider: 'apple' | 'google',
    options: Record<string, unknown>,
  ): Promise<unknown>
}

let loader: (() => Promise<SocialLoginBridge>) | null = null
let bridge: Promise<SocialLoginBridge> | null = null

/**
 * Wire the platform plugin in. Called by the native entry point, once.
 *
 * The loader is invoked lazily, on the first sign-in press, so a shell that
 * never signs anybody in never pays for the plugin's module graph.
 */
export function registerSocialLoginBridge(
  next: () => Promise<SocialLoginBridge>,
): void {
  loader = next
  bridge = null
}

/** Test seam, and what a fresh document starts as. */
export function resetSocialLoginBridge(): void {
  loader = null
  bridge = null
}

/** True where a sign-in button has something behind it. */
export function nativeSignInAvailable(): boolean {
  return IS_NATIVE_BUILD && loader !== null
}

async function requireBridge(): Promise<SocialLoginBridge> {
  if (!IS_NATIVE_BUILD || loader === null) {
    throw new NativeSignInError(
      'unavailable',
      'Native sign-in is not available in this build.',
    )
  }
  const load = loader
  bridge ??= (async () => {
    const resolved = await load()
    await resolved.initialize()
    return resolved
  })().catch((error: unknown) => {
    // A failed load must not poison every later press: the next one gets a
    // fresh attempt rather than the same rejected promise forever.
    bridge = null
    throw new NativeSignInError(
      'unavailable',
      'The sign-in plugin could not start.',
      { cause: error },
    )
  })
  return bridge
}

/** 256 bits, url-safe, the same shape the device secret uses. */
function randomNonce(): string {
  const bytes = window.crypto.getRandomValues(new Uint8Array(32))
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

/** One field of an untyped bridge answer, when it really is a string. */
function readString(source: unknown, key: string): string | undefined {
  if (typeof source !== 'object' || source === null) return undefined
  const value = (source as Record<string, unknown>)[key]
  return typeof value === 'string' && value !== '' ? value : undefined
}

function readObject(source: unknown, key: string): unknown {
  if (typeof source !== 'object' || source === null) return undefined
  return (source as Record<string, unknown>)[key]
}

/**
 * The result payload, whichever way the plugin nests it.
 *
 * `login()` answers `{ provider, result }`, and reading `idToken` off the
 * outer object instead of `result` is the mistake the plugin's own README
 * calls out. Accepting both shapes costs one line and removes a whole class
 * of "it returns null on device" report.
 */
function payloadOf(answer: unknown): unknown {
  const nested = readObject(answer, 'result')
  return nested === undefined ? answer : nested
}

/** Anything the bridge threw, as one of the four kinds. */
function asFailure(error: unknown): NativeSignInError {
  if (error instanceof NativeSignInError) return error
  const code = readString(error, 'code')
  const message = readString(error, 'message') ?? String(error)
  if (code === 'USER_CANCELLED') {
    return new NativeSignInError('cancelled', 'Sign-in was cancelled.', {
      cause: error,
    })
  }
  // The plugin reports a dismissal as a message on some platforms and as a
  // code on others; both mean the same thing and neither is worth a toast.
  if (/cancel|access[_ ]denied/i.test(message)) {
    return new NativeSignInError('cancelled', 'Sign-in was cancelled.', {
      cause: error,
    })
  }
  if (/network|offline|timed? ?out|connection/i.test(message)) {
    return new NativeSignInError(
      'network',
      'Could not reach the network. Try again.',
      { cause: error },
    )
  }
  return new NativeSignInError('unavailable', message, { cause: error })
}

/** What the worker said, as one of the four kinds. */
function asServerFailure(error: unknown): NativeSignInError {
  if (error instanceof NativeSignInError) return error
  const status = (error as { status?: unknown } | null)?.status
  if (status === 401 || status === 400) {
    return new NativeSignInError(
      'invalid_token',
      readString(error, 'message') ?? 'The sign-in token was rejected.',
      { cause: error },
    )
  }
  if (typeof status === 'number') {
    return new NativeSignInError(
      'network',
      readString(error, 'message') ?? 'Sign-in failed. Try again.',
      { cause: error },
    )
  }
  // No status at all: fetch itself failed, so nothing reached the worker.
  return new NativeSignInError(
    'network',
    'Could not reach the server. Try again.',
    { cause: error },
  )
}

/**
 * Sign in with Apple, and adopt the session.
 *
 * `name` and `email` arrive on the FIRST authorisation for this Apple ID and
 * never again — Apple hands them to whoever asks first — so they are
 * forwarded to the worker in the same request rather than stored for a later
 * one that will come back empty.
 */
export async function signInWithApple(): Promise<SignInOutcome> {
  const plugin = await requireBridge()
  const nonce = randomNonce()
  let answer: unknown
  try {
    answer = await plugin.login('apple', { scopes: ['name', 'email'], nonce })
  } catch (error) {
    throw asFailure(error)
  }

  const payload = payloadOf(answer)
  const identityToken = readString(payload, 'idToken')
  if (identityToken === undefined) {
    throw new NativeSignInError(
      'invalid_token',
      'Apple returned no identity token.',
    )
  }
  const profile = readObject(payload, 'profile')
  const givenName = readString(profile, 'givenName')
  const familyName = readString(profile, 'familyName')
  const email = readString(profile, 'email')

  try {
    return await loginWithApple({
      identityToken,
      authorizationCode: readString(payload, 'authorizationCode'),
      nonce,
      user:
        givenName === undefined &&
        familyName === undefined &&
        email === undefined
          ? undefined
          : {
              name:
                givenName === undefined && familyName === undefined
                  ? undefined
                  : { firstName: givenName, lastName: familyName },
              email,
            },
    })
  } catch (error) {
    throw asServerFailure(error)
  }
}

/**
 * Sign in with Google, and adopt the session.
 *
 * The nonce goes to Google as well, for the same replay reason, and Google
 * echoes it into the id token's `nonce` claim. The worker verifies the token
 * through Google's tokeninfo endpoint, which returns that claim, so the check
 * is available to it whether or not it makes it today.
 *
 * Like the Apple path, this returns the OUTCOME rather than a session: an
 * account holding a second factor answers with a challenge, and the caller
 * shows the code pane. What shipped first did not — `loginWithGoogle` went
 * through `postAuth`, which turns a challenge into a synthetic 409, and
 * `asServerFailure` maps an unrecognised numeric status to `network`. A
 * singer with 2FA on was told the phone was offline, every time, with
 * nowhere to type a code.
 */
export async function signInWithGoogle(): Promise<SignInOutcome> {
  const plugin = await requireBridge()
  const nonce = randomNonce()
  let answer: unknown
  try {
    answer = await plugin.login('google', {
      scopes: ['email', 'profile'],
      nonce,
    })
  } catch (error) {
    throw asFailure(error)
  }

  const idToken = readString(payloadOf(answer), 'idToken')
  if (idToken === undefined) {
    throw new NativeSignInError(
      'invalid_token',
      'Google returned no identity token.',
    )
  }

  try {
    return await loginWithGoogle(idToken)
  } catch (error) {
    throw asServerFailure(error)
  }
}
