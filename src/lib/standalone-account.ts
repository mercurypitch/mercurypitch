// Account + credits state for the standalone pages (Karaoke Night, Guitar
// Night). A leaf module (only the app-store-free auth/billing services) so
// every lazy chunk on those pages — the topbar account chip, a rail's
// processing toggle — shares one source of truth without threading props or
// pulling the app shell. One module, because two copies would be two signals
// and the pages would disagree about who is signed in.

import { createEffect, createRoot, createSignal } from 'solid-js'
import { fetchMe, hasValidToken, logout as authLogout, } from '@/db/services/auth-service'
import { fetchBillingMe } from '@/db/services/billing-service'
import { authVersion } from '@/db/services/user-service'

export interface StandaloneAccount {
  email: string | null
  provider: 'anonymous' | 'password' | 'google'
}

const [account, setAccount] = createSignal<StandaloneAccount | null>(null)
const [credits, setCredits] = createSignal<number | null>(null)
const [accountReady, setAccountReady] = createSignal(false)

export { account, accountReady, credits }

/** A real (non-anonymous) sign-in — the gate for server-side processing. */
export function signedIn(): boolean {
  const a = account()
  return a !== null && a.provider !== 'anonymous'
}

/** Reconcile the account signal with the stored token (call at boot and after
 *  any auth change). Tolerant of no-backend builds — fetchMe returns null. */
export async function refreshAccount(): Promise<void> {
  try {
    if (!hasValidToken()) {
      setAccount(null)
      return
    }
    const me = await fetchMe()
    if (me !== null) {
      setAccount({ email: me.user.email, provider: me.user.authProvider })
      if (me.user.authProvider !== 'anonymous') void refreshCredits()
    } else {
      setAccount(null)
    }
  } catch {
    setAccount(null)
  } finally {
    setAccountReady(true)
  }
}

// Signing in through the SHARED AuthModal (or out from anywhere) bumps
// authVersion but never told this module — so the standalone surfaces kept
// their stale account until the widget remounted, and a fresh sign-in
// still read "signed out": the stem-result view went on offering sign-in
// instead of the server-side split, and only a manual reload fixed it
// (owner testing). One app-lifetime subscriber, owned by createRoot so
// it is never torn down with whichever component happened to mount it.
createRoot(() => {
  createEffect(() => {
    authVersion()
    void refreshAccount()
  })
})

export async function refreshCredits(): Promise<void> {
  try {
    const b = await fetchBillingMe()
    setCredits(b !== null ? b.creditBalance : null)
  } catch {
    setCredits(null)
  }
}

export function signOutStandalone(): void {
  authLogout()
  setAccount(null)
  setCredits(null)
}
