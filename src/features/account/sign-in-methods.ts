// ============================================================
// Which ways in this platform actually offers
// ============================================================
//
// One answer per method, in one module, because the list differs by platform
// and a sign-in surface that computes it inline drifts from the next one. A
// button that opens a dialog saying no reads as the site being broken — that
// is the standard this repository already holds passkeys to, and it is the
// standard the two native providers are held to here.
//
// Passkeys are deliberately NOT in this file. `passkeysSupported()` in
// `src/lib/webauthn.ts` is the gate for those, it already answers false in
// both shells, and every passkey surface already asks it (directly, or
// through `platformAuthenticatorAvailable` / `conditionalMediationAvailable`).
// A second gate beside it would be a second thing to keep true.
//
// Apple on iOS, Google on both. Note the tension worth knowing about:
// App Store guideline 4.8 wants an equivalent privacy-preserving login as
// soon as a third-party one sets up the primary account — Sign in with Apple
// shipping alongside Google on iOS is what satisfies it. Dropping Google from
// iOS instead is the owner's call (checklist M-D3) and is one predicate here
// when it is made.

import { isAppleTouchDevice } from '@/lib/device-tier'
import { IS_NATIVE_BUILD } from '@/lib/native-build'
import { nativeSignInAvailable } from './native-sign-in'

/** Sign in with Apple, through the system sheet. iOS only. */
export function appleSignInOffered(): boolean {
  return nativeSignInAvailable() && isAppleTouchDevice()
}

/**
 * Google through the platform plugin rather than the web redirect.
 *
 * The web app's Google button is a full-page redirect back to an origin the
 * worker knows. A WebView has no such page to come back to, so inside a shell
 * the plugin path replaces it rather than joining it.
 */
export function nativeGoogleSignInOffered(): boolean {
  return nativeSignInAvailable()
}

/** True where the web redirect is still the way Google sign-in happens. */
export function webGoogleSignInOffered(): boolean {
  return !IS_NATIVE_BUILD
}
