// ============================================================
// Has this browser met a real account?
// ============================================================
//
// For an offer that only makes sense to somebody without an account, such as
// the Voice Mirror's "Create my free account" (src/features/mirror). Signing
// out does not make a person a stranger, and three notes on this device say
// an account was here:
//
//   - how the last sign-in happened (lib/last-sign-in). Kept through a
//     sign-out on purpose; only deleting the account clears it.
//   - the signed-out flag behind `needsSignIn`, set when a real account signs
//     out here or its session is rejected.
//   - a stored token whose provider names a real account, valid or not. An
//     expired one is never cleared, so it still says who issued it.
//
// Any one is enough. None says WHO, so a shared browser that met somebody's
// account answers true for the next person too: they miss an offer they can
// still find in the app, which is the cheaper mistake.

import { lastSignInMethod } from '@/lib/last-sign-in'
import { isRegisteredProvider, needsSignIn, storedTokenProvider, } from './auth-service'
import { authVersion } from './user-service'

/**
 * True when a real account is signed in here, or was and has signed out or
 * let its session run out. Reactive like `accountHeld`: a sign-in or a
 * sign-out on the page re-runs whatever reads it.
 */
export function accountKnownHere(): boolean {
  authVersion()
  if (lastSignInMethod() !== '') return true
  if (isRegisteredProvider(storedTokenProvider())) return true
  try {
    return needsSignIn()
  } catch {
    // Storage that refuses to be read holds no note either.
    return false
  }
}
