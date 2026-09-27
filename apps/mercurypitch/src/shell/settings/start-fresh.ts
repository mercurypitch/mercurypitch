// ============================================================
// Start fresh — a new identity for this phone (REQ-NAM-023)
// ============================================================
//
// The device id is rotated and its secret dropped, which is what
// `resetUserId` already does after a deletion, and the old identity's
// session goes with it: a token left behind would keep the phone wearing
// the identity it was asked to leave. The history made under the old one
// cannot be reached from this phone again, and the Storage screen says so
// before it happens. Then the app starts again, so nothing in memory still
// belongs to the old identity.
//
// Offered only with no account signed in: an account is left by signing
// out, and its history stays reachable by signing in again.

import { resetUserId, setAuthToken } from '@/db/services/user-service'
import { restartApp } from './app-restart'

export function startFresh(): void {
  setAuthToken(null)
  resetUserId()
  restartApp()
}
