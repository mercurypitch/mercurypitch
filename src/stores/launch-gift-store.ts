// ============================================================
// launch-gift-store — the launch gift, as this browser sees it
// ============================================================
//
// The server claims the featured promo code the moment an account's email is
// confirmed (workers/db-worker/src/launch-offer.ts). This store is the app's
// half of that: which codes the signed-in account has claimed, so the header
// pill and the gift lines step aside once it has, and telling the singer, once
// a claim, in a toast:
//
//   - Google, Apple or a mailed code: the email is confirmed as the account
//     is made, so the claim is moments old when the app next reads /me.
//     "5 credits added. Try one in Karaoke Night."
//   - the confirm link: "Email confirmed. 5 credits added."
//   - a password sign-up: the claim waits for the link, and the sign-up
//     says so. "Confirm your email and your 5 credits arrive."
//   - the code ran out between the offer and the claim:
//     "The launch gift has run out. Your account is ready."
//
// No mail says any of it (owner decision D7). The toasts are the only word.
//
// Who has claimed what is read from GET /api/billing/me (`promoClaims`),
// whenever the header or the Karaoke Night chip learns who is signed in. A
// claim is news for half an hour; older than that, the singer has had the
// balance in front of them, and a toast about it would be noise.

import { createSignal } from 'solid-js'
import { currentAccountId, hasValidToken } from '@/db/services/auth-service'
import type { BillingMe, FeaturedPromo, PromoClaim, } from '@/db/services/billing-service'
import { fetchBillingMe, redeemPromoCode } from '@/db/services/billing-service'
import { trackEvent } from '@/lib/analytics'
import { refreshBalance } from './billing-store'
import { showNotification } from './notifications-store'
import { loadFeaturedPromo, offeredPromo } from './promo-store'

/** How long a claim stays news. */
export const FRESH_CLAIM_MS = 30 * 60 * 1000

/** How long a sign-up made beside the gift waits for its claim: long enough
 *  for a confirm link opened days later. */
export const GIFT_EXPECTED_MS = 14 * 24 * 60 * 60 * 1000

const ANNOUNCED_KEY = 'mp.launchGift.announced.v1'
const EXPECTED_KEY = 'mp.launchGift.expected.v1'
/** Announced claims remembered; a claim is once per account and code, so a
 *  short list covers every account this browser has held. */
const ANNOUNCED_KEPT = 20

export const GIFT_RUN_OUT =
  'The launch gift has run out. Your account is ready.'

/** What the store knows about the signed-in account. */
interface AccountClaims {
  accountId: string | null
  verified: boolean
  claims: readonly PromoClaim[]
}

const [known, setKnown] = createSignal<AccountClaims | null>(null)

/** The account `syncPromoClaims` describes, as its caller knows it. */
export interface GiftAccount {
  /** Signed in with a real account, not an anonymous one. */
  upgraded: boolean
  /** Its email is confirmed. */
  verified: boolean
}

// ── Storage ──────────────────────────────────────────────────────

function readJson(key: string): unknown {
  try {
    const raw = localStorage.getItem(key)
    return raw === null ? null : (JSON.parse(raw) as unknown)
  } catch {
    return null
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Blocked storage: a claim may be announced twice, or a run-out missed.
    // Neither is worth an error.
  }
}

function claimKey(claim: PromoClaim): string {
  return `${claim.code}@${claim.claimedAt}`
}

function announcedKeys(): string[] {
  const stored = readJson(ANNOUNCED_KEY)
  return Array.isArray(stored)
    ? stored.filter((key): key is string => typeof key === 'string')
    : []
}

function markAnnounced(claim: PromoClaim): void {
  const keys = announcedKeys().filter((key) => key !== claimKey(claim))
  writeJson(ANNOUNCED_KEY, [...keys, claimKey(claim)].slice(-ANNOUNCED_KEPT))
}

/**
 * Remember that a sign-up started beside the gift, so that if the code runs
 * out before the email is confirmed the app can say so rather than say
 * nothing. Called by every "Create my free account" that shows the gift.
 */
export function rememberGiftOffered(
  promo: FeaturedPromo | null = offeredPromo(),
  now: number = Date.now(),
): void {
  if (promo === null) return
  writeJson(EXPECTED_KEY, { code: promo.code, at: now })
}

/** The code a sign-up here was promised, while the promise is recent. */
function giftExpected(now: number): string | null {
  const stored = readJson(EXPECTED_KEY) as { code?: unknown; at?: unknown }
  if (stored === null || typeof stored !== 'object') return null
  const { code, at } = stored
  if (typeof code !== 'string' || typeof at !== 'number') return null
  return now - at <= GIFT_EXPECTED_MS ? code : null
}

function forgetGiftOffered(): void {
  writeJson(EXPECTED_KEY, null)
}

// ── Reading the account's claims ─────────────────────────────────

/** The claims /me reports. A worker from before `promoClaims` lists the
 *  codes alone; those claims have no date, so none of them is news. */
function claimsOf(me: BillingMe): PromoClaim[] {
  if (me.promoClaims !== undefined) return me.promoClaims
  return (me.redeemedPromos ?? []).map((code) => ({
    code,
    credits: 0,
    claimedAt: '',
  }))
}

/** The newest claim that is still news and that this browser has not
 *  announced, or null. */
function newsworthyClaim(
  claims: readonly PromoClaim[],
  now: number,
): PromoClaim | null {
  const announced = new Set(announcedKeys())
  const fresh = claims.filter((claim) => {
    const at = Date.parse(claim.claimedAt)
    return (
      Number.isFinite(at) &&
      now - at <= FRESH_CLAIM_MS &&
      !announced.has(claimKey(claim))
    )
  })
  return fresh[fresh.length - 1] ?? null
}

/** What the gift has to say after a read of /me: a claim that is news, a
 *  promise that ran out, or nothing. */
type GiftNews = { kind: 'claimed'; claim: PromoClaim } | { kind: 'run-out' }

/**
 * Decide what the gift has to say, and remember that it said it.
 *
 * A claim that is news is counted and marked as said. Failing that, a
 * sign-up made beside the gift whose account is now confirmed without the
 * claim hears that the gift ran out, when it did. Any other reason for no
 * claim (this address claimed it on an account since deleted, or the account
 * is older than the gift and still has its Claim) says nothing.
 */
async function giftNews(
  claims: readonly PromoClaim[],
  verified: boolean,
): Promise<GiftNews | null> {
  const news = newsworthyClaim(claims, Date.now())
  if (news !== null) {
    markAnnounced(news)
    forgetGiftOffered()
    trackEvent('promo_claimed')
    return { kind: 'claimed', claim: news }
  }
  const expected = giftExpected(Date.now())
  if (expected === null || !verified) return null
  forgetGiftOffered()
  if (claims.some((claim) => claim.code === expected)) return null
  await loadFeaturedPromo()
  return offeredPromo() === null ? { kind: 'run-out' } : null
}

/**
 * Whether the account signed in here has claimed the code on offer. False
 * while nobody is signed in, while nothing is on offer, and until /me has
 * answered.
 */
export function giftClaimed(): boolean {
  const promo = offeredPromo()
  const account = known()
  if (promo === null || account === null) return false
  return account.claims.some((claim) => claim.code === promo.code)
}

/**
 * The code on offer, when the signed-in account has a confirmed email and
 * has not claimed it: an account from before the gift was claimed for
 * everyone, which still has the one-tap Claim. Null while /me has not
 * answered, so the line never flashes on and off.
 */
export function giftWaiting(): FeaturedPromo | null {
  const promo = offeredPromo()
  const account = known()
  if (promo === null || account === null || !account.verified) return null
  if (account.accountId !== currentAccountId()) return null
  return account.claims.some((claim) => claim.code === promo.code)
    ? null
    : promo
}

/** True from a good confirm link until its toast has been decided. */
let confirmPending = false

/**
 * Read what the account signed in here has claimed, and say so when a claim
 * is news. Call it whenever the signed-in account may have changed: sign-in,
 * sign-out, a page opened while signed in. `null` is nobody signed in.
 */
export async function syncPromoClaims(
  account: GiftAccount | null,
): Promise<void> {
  // Called without waiting on it: a failed read means no toast, never an
  // unhandled rejection.
  try {
    await readClaims(account)
  } catch (err) {
    console.warn('[launch-gift] could not read the promo claims:', err)
  }
}

async function readClaims(account: GiftAccount | null): Promise<void> {
  if (account === null || !account.upgraded || !hasValidToken()) {
    setKnown(null)
    return
  }
  const accountId = currentAccountId()
  const me = await fetchBillingMe()
  if (me === null || accountId !== currentAccountId()) return
  const claims = claimsOf(me)
  setKnown({ accountId, verified: account.verified, claims })

  // A good confirm link says it itself, in its own words.
  if (confirmPending) return
  const news = await giftNews(claims, account.verified)
  if (news?.kind === 'claimed') {
    showNotification(
      `${news.claim.credits} credits added. Try one in Karaoke Night.`,
      'success',
    )
  } else if (news?.kind === 'run-out') {
    showNotification(GIFT_RUN_OUT, 'info')
  }
}

/**
 * The toast for a good confirm link, when the gift has something to say:
 * "Email confirmed. 5 credits added." when the link claimed it, the run-out
 * line when a sign-up here was promised it and it ran out first. Null
 * otherwise, for the confirm toast the caller already has.
 */
export async function confirmedGiftMessage(): Promise<string | null> {
  confirmPending = true
  try {
    if (!hasValidToken()) return null
    const accountId = currentAccountId()
    const me = await fetchBillingMe()
    if (me === null) return null
    const claims = claimsOf(me)
    setKnown({ accountId, verified: true, claims })
    const news = await giftNews(claims, true)
    if (news?.kind === 'claimed') {
      return `Email confirmed. ${news.claim.credits} credits added.`
    }
    return news?.kind === 'run-out' ? GIFT_RUN_OUT : null
  } catch (err) {
    // The confirm toast still shows, in its plain words.
    console.warn('[launch-gift] could not read the promo claims:', err)
    return null
  } finally {
    confirmPending = false
  }
}

/**
 * The toast for a password sign-up made while the gift is on offer, or null
 * when there is none. Its credits wait for the confirm link, so it says that,
 * and remembers the promise in case the code runs out first.
 */
export function signUpGiftMessage(): string | null {
  const promo = offeredPromo()
  if (promo === null) return null
  rememberGiftOffered(promo)
  return `Confirm your email and your ${promo.credits} credits arrive.`
}

/** A claim made with the Claim button or a typed code: the caller has said
 *  so already, so this records it, and counts it. */
export function recordPromoClaim(claim: PromoClaim): void {
  const account = known()
  setKnown({
    accountId: account?.accountId ?? currentAccountId(),
    verified: true,
    claims: [
      ...(account?.claims ?? []).filter((c) => c.code !== claim.code),
      claim,
    ],
  })
  markAnnounced(claim)
  forgetGiftOffered()
  trackEvent('promo_claimed')
}

let claiming: Promise<void> | null = null

/**
 * Claim the code on offer for the signed-in account, in one tap: the Map's
 * "Claim them", for an account from before the gift was claimed for
 * everyone at confirmation. A second tap while the first is on its way is
 * the same claim.
 */
export function claimGiftNow(): Promise<void> {
  claiming ??= (async () => {
    const promo = offeredPromo()
    if (promo === null) return
    try {
      const claimed = await redeemPromoCode(promo.code)
      recordPromoClaim({
        code: claimed.code,
        credits: claimed.creditsGranted,
        claimedAt: new Date().toISOString(),
      })
      refreshBalance()
      showNotification(
        `${claimed.creditsGranted} credits added. Try one in Karaoke Night.`,
        'success',
      )
    } catch (err) {
      showNotification(
        err instanceof Error ? err.message : 'Could not claim the credits.',
        'error',
      )
    }
  })().finally(() => {
    claiming = null
  })
  return claiming
}
