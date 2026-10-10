// ============================================================
// purchase-record — what settling a refund reads of the purchase behind it
// ============================================================
//
// Money that goes back on a purchase with no consent on record, by any
// refund or dispute, takes back at most the credits its pack still has
// unused (stripe-payments.ts, settle): the ones the buyer used stay theirs
// (CRD Art. 14(4)(b)). Both halves come from the modules the withdrawal
// itself reads: the consent through consentTerms (checkout-consent.ts), and
// what is unused through packUses (withdrawal-rules.ts). A buyer who cancels
// by mail and one who cancels in Settings › Credits then lose the same
// credits.
//
// consentTerms counts a ticked box only once the purchase mail confirmed
// it (Art. 14(4)(b)(iii)), so a purchase whose mail has not gone counts as
// having no consent: its refunds and disputes leave the used credits with
// the buyer. Once the mail goes, what comes after follows the box: the next
// refund or dispute can take the used credits an earlier one left.
//
// Both of those modules import stripe-payments.ts, so it cannot import them:
// billing.ts hands it this record instead.

import type { Env } from './auth'
import { consentTerms } from './checkout-consent'
import type { LedgerEntry } from './ledger'
import type { PurchaseRecord } from './stripe-payments'
import { packUses } from './withdrawal-rules'

/** A purchase's consent row, as consentTerms reads it. The read takes every
 *  column, so the rule can grow without this read falling behind it. */
type ConsentRow = NonNullable<Parameters<typeof consentTerms>[0]>

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
    return consentTerms(consent) === 'no_consent'
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
