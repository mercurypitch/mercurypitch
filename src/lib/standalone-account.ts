// Account + credits state for the standalone pages (Karaoke Night, Guitar
// Night). A leaf module (only the app-store-free auth/billing services) so
// every lazy chunk on those pages — the topbar account chip, a rail's
// processing toggle — shares one source of truth without threading props or
// pulling the app shell. One module, because two copies would be two signals
// and the pages would disagree about who is signed in.

import { createEffect, createRoot, createSignal } from 'solid-js'
import { readMe } from '@/db/services/auth-me-service'
import type { AuthUserInfo } from '@/db/services/auth-service'
import { hasValidToken, logout as authLogout } from '@/db/services/auth-service'
import type { LaunchOffer } from '@/db/services/billing-service'
import { fetchBillingMe } from '@/db/services/billing-service'
import { authVersion } from '@/db/services/user-service'
import { NO_ANSWER_TEXT } from '@/lib/no-answer-copy'

export interface StandaloneAccount {
  email: string | null
  provider: AuthUserInfo['authProvider']
}

const [account, setAccount] = createSignal<StandaloneAccount | null>(null)
const [credits, setCredits] = createSignal<number | null>(null)
/** The launch offer as the last /me said it, read with the credits. */
const [offer, setOffer] = createSignal<LaunchOffer | null>(null)
/**
 * Whether this page knows who is signed in: the server answered its last
 * read of the account, or there was no token to ask with. False before the
 * first read, and again after a read that got no answer.
 */
const [accountReady, setAccountReady] = createSignal(false)

export { account, accountReady, credits, offer }

/** A real (non-anonymous) sign-in — the gate for server-side processing. */
export function signedIn(): boolean {
  const a = account()
  return a !== null && a.provider !== 'anonymous'
}

/** Nobody is signed in here: no account, so no offer either. */
function signedOutHere(): void {
  setAccount(null)
  setOffer(null)
}

/**
 * Reconcile the account signal with the stored token (call at boot and after
 * any auth change). A read that got no answer (offline, refused while the
 * API is out of reach, no backend configured) is not a signed-out answer: it
 * leaves the account as this page last knew it, and unknown, so the next
 * look asks again. `options.userAction`: a person pressed for this read.
 */
export async function refreshAccount(
  options: { userAction?: boolean } = {},
): Promise<void> {
  if (!hasValidToken()) {
    signedOutHere()
    setAccountReady(true)
    return
  }
  const read = await readMe(options)
  if (read.status === 'unreachable') {
    setAccountReady(false)
    return
  }
  if (read.status === 'ok') {
    const { user } = read.me
    setAccount({ email: user.email, provider: user.authProvider })
    if (user.authProvider !== 'anonymous') void refreshCredits()
  } else {
    signedOutHere()
  }
  setAccountReady(true)
}

/**
 * Know who is signed in before a press that decides on it (the band split's
 * preflight). Asks as the press while the account is unknown, and throws when
 * it still is: a guess of "signed out" would send a signed-in singer to sign
 * in.
 */
export async function ensureAccountKnown(): Promise<void> {
  if (!accountReady()) await refreshAccount({ userAction: true })
  if (!accountReady()) throw new Error(NO_ANSWER_TEXT)
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
    setOffer(b?.offer ?? null)
  } catch {
    setCredits(null)
    setOffer(null)
  }
}

export function signOutStandalone(): void {
  authLogout()
  setAccount(null)
  setCredits(null)
  setOffer(null)
}
