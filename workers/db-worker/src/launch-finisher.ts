// ============================================================
// launch-finisher — the launch offer, read and written
// ============================================================
//
// offer-rules.ts decides who has earned what; this reads the facts from D1
// and writes what follows from them:
//
//   - readFinisherOffer, for GET /api/billing/me: where the signed-in
//     account stands, writing the unlock the moment it is earned
//     (offerUnlocks, migration 0059).
//   - finisherCheckoutParams, for POST /api/billing/checkout: a pack bought
//     with the reward unlocked carries the bonus in its session metadata,
//     and Stripe Checkout says so above the pay button. Nothing is created
//     in Stripe: the price is the pack's own.
//   - grantFinisherBonus, for the webhook: the bonus row beside the pack's,
//     on the same PaymentIntent, so a refund of the pack takes it back too
//     (stripe-payments.ts). Once per account, by its idempotency key, and
//     once per confirmed address (promoEmailClaims, kind 'offer-bonus'), so
//     deleting the account and starting again does not earn it twice.
//
// Off while OFFER_START_AT is unset, and before that day.

import type { Env } from './auth'
import type { FinisherOffer } from './offer-rules'
import { FINISHER_CAMPAIGN, finisherConfig, finisherPromoId, finisherState, } from './offer-rules'
import { promoEmailCode, promoEmailRecorded, recordPromoEmail, } from './promo-claim'
import type { LedgerRow } from './songs-allowance'
import { SEPARATION_REFUND, WEB_SEPARATION } from './songs-allowance'
import { paymentIntentOf, PURCHASE_DISPUTE, PURCHASE_REFUND, WITHDRAWAL_PAID, } from './stripe-payments'

/** The ledger reason of the bonus credits. */
export const OFFER_BONUS = 'offer-bonus'

/** A bonus the metadata may name, at most: anything past it is not ours. */
const MAX_BONUS = 1000

/** The bonus row's idempotency key: one bonus per account. */
export function finisherBonusKey(userId: string): string {
  return `offer:${FINISHER_CAMPAIGN}:${userId}`
}

interface ClaimRow {
  claimedAt: string
  goal: number
  email: string | null
}

/** Whether the account's confirmed address had the bonus on an account
 *  since deleted. False while the Worker has no FREE_SONG_EMAIL_SECRET. */
async function bonusHadElsewhere(
  env: Env,
  promoId: string,
  email: string | null,
): Promise<boolean> {
  if (email === null) return false
  const emailHash = await promoEmailCode(env, promoId, 'offer-bonus', email)
  return (
    emailHash !== null &&
    (await promoEmailRecorded(env.DB, promoId, 'offer-bonus', emailHash))
  )
}

/**
 * Where the account stands in the launch offer, or null when it has none:
 * the offer is off, the account never claimed the launch code, or its
 * address had the bonus on another account. Writes the unlock when this
 * read finds it earned. Never throws: the offer must not break /me.
 */
export async function readFinisherOffer(
  env: Env,
  userId: string,
  now: number = Date.now(),
): Promise<FinisherOffer | null> {
  const config = finisherConfig(env)
  if (config === null || now < config.startsAt) return null
  try {
    const claim = await env.DB.prepare(
      `SELECT r.redeemedAt AS claimedAt, p.credits AS goal, u.email AS email
         FROM promoRedemptions r
         JOIN promoCodes p ON p.id = r.promoCodeId
         JOIN users u ON u.id = r.userId
        WHERE r.promoCodeId = ? AND r.userId = ?`,
    )
      .bind(config.promoId, userId)
      .first<ClaimRow>()
    const claimedAt = Date.parse(claim?.claimedAt ?? '')
    if (claim === null || !Number.isFinite(claimedAt) || !(claim.goal > 0)) {
      return null
    }

    const [{ results: rows }, unlock, bonus] = await Promise.all([
      env.DB.prepare(
        `SELECT createdAt, delta, reason, jobRef, idempotencyKey
           FROM creditLedger WHERE userId = ? AND reason IN (?, ?)`,
      )
        .bind(userId, WEB_SEPARATION, SEPARATION_REFUND)
        .all<LedgerRow>(),
      env.DB.prepare(
        'SELECT 1 AS had FROM offerUnlocks WHERE userId = ? AND campaign = ?',
      )
        .bind(userId, FINISHER_CAMPAIGN)
        .first(),
      env.DB.prepare(
        'SELECT 1 AS had FROM creditLedger WHERE idempotencyKey = ?',
      )
        .bind(finisherBonusKey(userId))
        .first(),
    ])
    if (
      bonus === null &&
      (await bonusHadElsewhere(env, config.promoId, claim.email))
    ) {
      return null
    }

    const offer = finisherState(
      {
        claimedAt,
        goal: claim.goal,
        rows,
        unlocked: unlock !== null,
        bonusGranted: bonus !== null,
      },
      config,
      now,
    )
    if (offer.state === 'unlocked' && unlock === null) {
      await env.DB.prepare(
        'INSERT OR IGNORE INTO offerUnlocks (userId, campaign, unlockedAt) VALUES (?, ?, ?)',
      )
        .bind(userId, FINISHER_CAMPAIGN, new Date(now).toISOString())
        .run()
      console.log(`[offer] ${FINISHER_CAMPAIGN} unlocked: user=${userId}`)
    }
    return offer
  } catch (err) {
    console.error(
      `[offer] could not read the launch offer (non-fatal): ${String(err)}`,
    )
    return null
  }
}

/**
 * The Checkout Session parameters a pack gets while the account has the
 * reward unlocked: the bonus in the metadata, for the webhook, and one line
 * above the pay button. Empty for anything else.
 */
export async function finisherCheckoutParams(
  env: Env,
  userId: string,
  planKind: string,
): Promise<Record<string, string>> {
  if (planKind !== 'pack') return {}
  const offer = await readFinisherOffer(env, userId)
  if (offer?.state !== 'unlocked') return {}
  return {
    'metadata[offer]': FINISHER_CAMPAIGN,
    'metadata[bonusCredits]': String(offer.bonusCredits),
    'custom_text[submit][message]': `Your launch offer adds ${offer.bonusCredits} extra credits to this pack.`,
  }
}

/**
 * Write the bonus a paid pack was bought with, beside the pack's own row.
 * Returns the credits this call added: 0 for a session without the offer,
 * for an account that had its bonus already, and for a payment that went
 * back before the bonus landed. Throws when D1 does, so the webhook answers
 * 500 and Stripe delivers the event again; the pack's row is then a
 * duplicate, and this writes the bonus.
 *
 * A delivery that lands late, after the buyer withdrew from the pack
 * (withdrawal.ts) or the payment was refunded or disputed
 * (stripe-payments.ts), writes nothing: the same statement checks for those
 * rows, so a bonus can never outlive the money it came with.
 */
export async function grantFinisherBonus(
  env: Env,
  session: Record<string, unknown>,
  userId: string,
): Promise<number> {
  const metadata =
    (session.metadata as Record<string, unknown> | undefined) ?? {}
  if (metadata.offer !== FINISHER_CAMPAIGN) return 0
  const bonus = Number(metadata.bonusCredits)
  if (!Number.isInteger(bonus) || bonus <= 0 || bonus > MAX_BONUS) {
    console.error(
      `[offer] bonus metadata unusable (${String(metadata.bonusCredits)}): user=${userId}, nothing added`,
    )
    return 0
  }

  // Under the campaign's code even when the offer has been switched off
  // since: Checkout promised the bonus, and the payment keeps the promise.
  const promoId = finisherPromoId(env)
  const key = finisherBonusKey(userId)
  const now = new Date().toISOString()
  const user = await env.DB.prepare('SELECT email FROM users WHERE id = ?')
    .bind(userId)
    .first<{ email: string | null }>()
  const emailHash =
    user?.email == null
      ? null
      : await promoEmailCode(env, promoId, 'offer-bonus', user.email)

  const paymentIntent = paymentIntentOf(session)
  const write = env.DB.prepare(
    `INSERT OR IGNORE INTO creditLedger (id, createdAt, userId, delta, reason, jobRef, idempotencyKey, paymentIntentId)
     SELECT ?, ?, ?, ?, ?, ?, ?, ?
      WHERE NOT EXISTS (
        SELECT 1 FROM creditLedger
         WHERE userId = ? AND jobRef = ? AND reason IN (?, ?, ?))`,
  ).bind(
    crypto.randomUUID(),
    now,
    userId,
    bonus,
    OFFER_BONUS,
    FINISHER_CAMPAIGN,
    key,
    paymentIntent,
    userId,
    paymentIntent,
    WITHDRAWAL_PAID,
    PURCHASE_REFUND,
    PURCHASE_DISPUTE,
  )
  const [written] = await env.DB.batch(
    emailHash === null
      ? [write]
      : [
          write,
          recordPromoEmail(
            env.DB,
            { promoCodeId: promoId, kind: 'offer-bonus', emailHash },
            now,
            'SELECT 1 FROM creditLedger WHERE idempotencyKey = ?',
            key,
          ),
        ],
  )
  const added = written.meta.changes > 0 ? bonus : 0
  console.log(
    `[offer] ${FINISHER_CAMPAIGN} bonus: +${added} user=${userId}` +
      (added === 0
        ? ' [had it already, or the payment went back, skipped]'
        : ''),
  )
  return added
}
