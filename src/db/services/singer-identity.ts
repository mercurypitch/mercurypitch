// ============================================================
// Singer identity — the anonymous identity, made before the first offer
// ============================================================
//
// The app stopped making an identity at start (billing-service.ts: a visitor
// who only browses gets none). Owner decision E11 (S7b, 5 Oct 2026) allows two
// moments to make one now: the range finishing in the onboarding, or the first
// offer opening. The app uses the second: Keep, the account offer, as it opens
// (account-offer.ts), which is the first offer a new install meets, and the
// Cloud offer and Import (cloud-offer-store.ts, karaoke-songs.ts). Every one
// of them calls this, and nothing else in the offer's path mints an identity
// of its own.
//
// Why before the offer and not at Subscribe: a phone the server cannot name
// is a 401 at /api/billing/me, so nothing about its songs is known. On a
// fresh install that let Import open Files first and show the paywall only
// after a song was picked. And the store is told the server's own user id
// before it sells anything (karaoke-subscription.ts), so that id has to exist.
//
// It is `requireAuth` underneath: a session that exists is reused, a phone
// that signed out of an account is never handed a new anonymous identity,
// and two callers at once share one request. `withinMs` bounds the wait for
// an offer that should not hang on a slow network; the identity is still
// made behind it, and the next caller gets the same request.

import { requireAuth } from '@/db/services/auth-service'

export interface EnsureSingerIdentityOptions {
  /** Stop waiting after this long and answer false; the request carries on. */
  readonly withinMs?: number
}

/**
 * Make sure the server can name this singer, minting the anonymous identity
 * when there is none. True once it can; false offline, without an API, past
 * `withinMs`, or for an account that has to sign in again. Never throws.
 */
export async function ensureSingerIdentity(
  options: EnsureSingerIdentityOptions = {},
): Promise<boolean> {
  const made = requireAuth().catch(() => false)
  const { withinMs } = options
  if (withinMs === undefined) return made
  let timer: ReturnType<typeof setTimeout> | undefined
  const late = new Promise<boolean>((resolve) => {
    timer = setTimeout(() => {
      resolve(false)
    }, withinMs)
  })
  try {
    return await Promise.race([made, late])
  } finally {
    clearTimeout(timer)
  }
}
