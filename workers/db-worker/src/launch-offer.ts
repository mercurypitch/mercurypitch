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

import type { Env } from './auth'
import type { PromoRow } from './promo-claim'
import { claimPromo, PROMO_ROW_COLUMNS } from './promo-claim'
import { promoRefusal } from './promo-rules'
import { isManagedTestEmail } from './testing-account-state'

interface ClaimantRow {
  email: string | null
  emailVerified: number
  authProvider: string
}

/**
 * Claim the featured promo code for `userId`, if the code is open and the
 * account can have it. Never throws.
 *
 * `provenEmail` is for a caller that has just proved the inbox but has not
 * written `emailVerified` yet (the confirm link claims before its flag
 * write). Every other caller passes nothing, and the stored flag decides.
 */
export async function claimLaunchGift(
  env: Env,
  userId: string,
  provenEmail?: string,
): Promise<void> {
  try {
    const account = await env.DB.prepare(
      'SELECT email, emailVerified, authProvider FROM users WHERE id = ?',
    )
      .bind(userId)
      .first<ClaimantRow>()
    const email = claimableEmail(account, provenEmail)
    if (email === null) return

    const promo = await env.DB.prepare(
      `SELECT ${PROMO_ROW_COLUMNS} FROM promoCodes WHERE featured = 1 LIMIT 1`,
    ).first<PromoRow>()
    const now = new Date()
    if (promo === null || promoRefusal(promo, now) !== null) return

    const outcome = await claimPromo(env, promo, { userId, email }, now)
    console.log(`[promo] ${promo.code} on confirmation: ${outcome} (${userId})`)
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
