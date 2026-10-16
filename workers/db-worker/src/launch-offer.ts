// ============================================================
// launch-offer — the launch gift claimed on confirmation
// ============================================================
//
// While a promo code is featured (GET /api/billing/promo/featured), an
// account claims it the moment its email is confirmed: nobody has to find the
// Promo pill, open Settings and press Claim (owner decision D2, 9 Oct 2026).
// claimLaunchGift is called wherever `users.emailVerified` becomes 1 in
// auth.ts:
//
//   - the emailed confirm link (handleVerifyEmail);
//   - a mailed sign-in code typed by an unconfirmed account
//     (handleEmailCodeVerify);
//   - a sign-up code, which creates a confirmed account (finishSignUpCode);
//   - the password-reset link, which proves the inbox too
//     (handleResetPassword);
//   - Google and Apple, when they create or upgrade an account with a
//     verified address (resolveFederatedUser, steps 3 and 4).
//
// Not on Apple's "email-enabled" notification: that turns relay forwarding
// back on for an address confirmed long before, and is no sign-up.
//
// Accounts confirmed before this shipped keep the one-click Claim card in
// Settings › Credits; nothing here reaches back for them.
//
// Best-effort and silent, like the welcome mail: a claim that fails must
// never fail the sign-in it rides on. The singer learns about it in the app
// (an in-app message, never a mail: D7), which reads the claim from
// GET /api/billing/me.
//
// ── The native app's launch gift (S7b E6) ──
//
// An account made in the native app gets songs the app can spend, besides
// the code's credits, which are the web's (S7 D9). They ride on this claim,
// in its own batch (claimPromo), so the gift is once per account and once
// per address, even after the account is deleted, and ends with the code:
// when it closes or fills up, nobody gets it. Never through a code anybody
// types (App Review 3.1.1): POST /api/billing/promo/redeem never passes it.
//
// "Made in the app" is the request that makes the account coming from the
// app's own origin (signUpFrom): a sign-up code typed there, or Apple or
// Google creating the account, or upgrading the phone's anonymous identity.
// Confirming or signing in to an account made elsewhere is no sign-up, and
// the confirm link, the reset link and an existing account's sign-in code
// never pass it. APP_GIFT_SONGS says how many songs (appGiftSongs); unset,
// the gift is off, and GET /api/billing/promo/featured says so (appGiftView)
// so the app only offers what an account would get.

import type { Env } from './auth'
import { spenderOf } from './app-songs'
import type { PromoRow } from './promo-claim'
import { claimPromo, PROMO_ROW_COLUMNS } from './promo-claim'
import type { FeaturedPromoView } from './promo-rules'
import { promoRefusal } from './promo-rules'
import { isManagedTestEmail } from './testing-account-state'

/** Where the request making an account came from. */
export type SignUpFrom = 'app' | 'web'

/** The native app, by its origin (the test the app's songs use), else the
 *  web. Only the request that creates the account asks. */
export function signUpFrom(request: Request): SignUpFrom {
  return spenderOf(request) === 'app' ? 'app' : 'web'
}

/** The most APP_GIFT_SONGS can grant: a guard against a typo, not a price. */
const APP_GIFT_MOST = 10

/** The songs the app's launch gift grants: APP_GIFT_SONGS, a whole number
 *  from 1 to 10. Anything else, unset included, is 0, and the gift is off. */
export function appGiftSongs(env: Pick<Env, 'APP_GIFT_SONGS'>): number {
  const raw = env.APP_GIFT_SONGS?.trim() ?? ''
  if (!/^\d+$/.test(raw)) return 0
  const songs = Number(raw)
  return songs <= APP_GIFT_MOST ? songs : 0
}

/** The app's launch gift as GET /api/billing/promo/featured reports it. */
export interface AppGiftView {
  /** The songs a new account made in the app gets. */
  songs: number
  /** When the featured code, and so the gift, ends; null when it never does. */
  endsAt: string | null
}

/** The gift while it is on and the featured code is open (`featured`, as
 *  featuredPromoView reads it), else null. */
export function appGiftView(
  env: Pick<Env, 'APP_GIFT_SONGS'>,
  featured: FeaturedPromoView | null,
): AppGiftView | null {
  const songs = appGiftSongs(env)
  if (songs === 0 || featured === null) return null
  return { songs, endsAt: featured.expiresAt }
}

/** What a caller of claimLaunchGift knows about the claim. */
export interface LaunchGiftClaim {
  /** An inbox just proved, before `emailVerified` is written (the confirm
   *  link claims before its flag write). Every other caller leaves it out,
   *  and the stored flag decides. */
  provenEmail?: string
  /** Set by the routes that create an account: `app` adds the app's launch
   *  gift to the claim. Left out, the claim is the web's alone. */
  signUpFrom?: SignUpFrom
}

interface ClaimantRow {
  email: string | null
  emailVerified: number
  authProvider: string
}

/**
 * Claim the featured promo code for `userId`, if the code is open and the
 * account can have it, with the app's launch gift when the account was just
 * made in the app (`claim.signUpFrom`). Never throws.
 */
export async function claimLaunchGift(
  env: Env,
  userId: string,
  claim: LaunchGiftClaim = {},
): Promise<void> {
  try {
    const account = await env.DB.prepare(
      'SELECT email, emailVerified, authProvider FROM users WHERE id = ?',
    )
      .bind(userId)
      .first<ClaimantRow>()
    const email = claimableEmail(account, claim.provenEmail)
    if (email === null) return

    const promo = await env.DB.prepare(
      `SELECT ${PROMO_ROW_COLUMNS} FROM promoCodes WHERE featured = 1 LIMIT 1`,
    ).first<PromoRow>()
    const now = new Date()
    if (promo === null || promoRefusal(promo, now) !== null) return

    const gift = claim.signUpFrom === 'app' ? appGiftSongs(env) : 0
    const outcome = await claimPromo(env, promo, { userId, email }, now, gift)
    const giftNote = gift > 0 ? `, app gift ${gift}` : ''
    console.log(
      `[promo] ${promo.code} on confirmation: ${outcome}${giftNote} (${userId})`,
    )
  } catch (err) {
    console.error(
      `[promo] claim on confirmation failed (non-fatal): ${String(err)}`,
    )
  }
}

/** The confirmed address a claim may be made for, or null when there is
 *  none: no account, an anonymous one, a managed tester, or an address
 *  nobody has confirmed. */
function claimableEmail(
  account: ClaimantRow | null,
  provenEmail: string | undefined,
): string | null {
  if (account === null || account.email === null) return null
  if (account.authProvider === 'anonymous') return null
  if (isManagedTestEmail(account.email)) return null
  const proven =
    provenEmail !== undefined &&
    provenEmail.toLowerCase() === account.email.toLowerCase()
  return account.emailVerified === 1 || proven ? account.email : null
}
