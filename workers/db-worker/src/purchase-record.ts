// ============================================================
// purchase-record — what settling a refund reads of the purchase behind it
// ============================================================
//
// A refund of the whole price of a purchase with no consent on record
// settles like a withdrawal of it (stripe-payments.ts, settle): it takes back
// only the credits the pack still has unused, and the ones the buyer used
// stay theirs (CRD Art. 14(4)(b)). Both halves come from the modules the
// withdrawal itself reads: the consent through purchaseTerms
// (checkout-consent.ts), and what is unused through packUses
// (withdrawal-rules.ts). A buyer who cancels by mail and one who cancels in
// Settings › Credits then lose the same credits.
//
// Both of those modules import stripe-payments.ts, so it cannot import them:
// billing.ts hands it this record instead.

import type { Env } from './auth'
import { purchaseTerms } from './checkout-consent'
import type { LedgerEntry } from './ledger'
import type { PurchaseRecord } from './stripe-payments'
import { packUses } from './withdrawal-rules'

/** A purchase's consent row, as purchaseTerms reads it. The read takes every
 *  column, so the rule can grow without this read falling behind it. */
type ConsentRow = NonNullable<Parameters<typeof purchaseTerms>[0]>

export const PURCHASE_RECORD: PurchaseRecord = {
  async noConsent(
    env: Env,
    userId: string,
    paymentIntent: string,
  ): Promise<boolean> {
    const consent = await env.DB.prepare(
      'SELECT * FROM checkoutConsents WHERE userId = ? AND paymentIntentId = ? LIMIT 1',
    )
      .bind(userId, paymentIntent)
      .first<ConsentRow>()
    return purchaseTerms(consent) === 'no_consent'
  },

  unused(rows: readonly LedgerEntry[], paymentIntent: string): number {
    const pack = packUses(
      rows.map((row) => ({
        id: row.id ?? '',
        createdAt: row.createdAt ?? '',
        delta: row.delta,
        reason: row.reason,
        jobRef: row.jobRef,
        idempotencyKey: row.idempotencyKey,
        paymentIntentId: row.paymentIntentId ?? null,
      })),
    ).find((use) => use.paymentIntentId === paymentIntent)
    return pack === undefined ? 0 : pack.paidUnused + pack.bonusUnused
  },
}
