// ============================================================
// chargeback-alert — the owner hears of each chargeback
// ============================================================
//
// A dispute is a chargeback once the buyer's bank takes the money back.
// Two Stripe events say so: charge.dispute.created, for a dispute that
// opens as a chargeback (not an inquiry), and charge.dispute.funds_withdrawn,
// for any dispute once the money leaves the balance. Stripe sends both at
// once for a dispute that opens as a chargeback, in either order, and may
// deliver either twice.
//
// The first of them whose mail Resend takes tells the owner, and the
// dispute is recorded as told (chargebackAlerts, migration 0067) only
// then. Until then this throws, so the webhook answers 500 and Stripe sends
// the event again, and the sweep applies it if Stripe gives up: a mail may
// go twice rather than not at all. A delivery claims the dispute before
// it mails (chargebackAlertClaims, migration 0069), so of two at once only
// one mails. Another event about the same dispute, while one holds the
// claim, leaves the mail to it; the same event, delivered again while its
// twin holds the claim, throws, so Stripe sends it once more. A claim goes
// back when its mail does not go, so a delivery that finds it gone and the
// dispute not told throws as well. One older than CLAIM_STALE_MS belongs
// to a delivery that died and is taken over.
//
// The mail that tells the owner says all the other event's would: the
// amount, the reason, the evidence due date, where to answer, and the
// credits as the ledger stood at its event's row. So the other event sends
// its own alert only for credits its row moved after that one: the box of
// a purchase whose mail confirmed it in between, say (movedSince).

import type { Env } from './auth'
import type { ChargeState, DisputeState } from './stripe-charge'
import { isInquiry } from './stripe-charge'

/** What became of the chargeback's mail: this event sent it; another
 *  event told the owner, or holds the claim and tells them (or is delivered
 *  again if it cannot), in a mail that shows what this event moved; or one
 *  that does not, because this event moved credits since. */
export type ChargebackTold = 'sent' | 'told' | 'moved-since'

/** The chargeback's mail did not go, so nothing was recorded. */
export class ChargebackNotTold extends Error {
  constructor(disputeId: string) {
    super(`dispute ${disputeId}: the alert about its chargeback did not go`)
    this.name = 'ChargebackNotTold'
  }
}

/** How long a claim on a dispute holds: longer than any delivery takes to
 *  mail and record, so an older one belongs to a delivery that died. */
const CLAIM_STALE_MS = 10 * 60_000

/** Whether the event says the bank took the money: a dispute that opens as
 *  a chargeback, or the money leaving for any dispute. */
function tellsChargeback(
  type: string,
  dispute: DisputeState | null,
): dispute is DisputeState {
  if (dispute === null) return false
  return (
    type === 'charge.dispute.funds_withdrawn' ||
    (type === 'charge.dispute.created' && !isInquiry(dispute))
  )
}

interface Claim {
  disputeId: string
  eventId: string
  at: string
}

/** Claim the dispute to tell the owner of its chargeback: null when it is
 *  told already, or another delivery holds a claim that is not stale. */
async function claim(
  env: Env,
  disputeId: string,
  eventId: string,
): Promise<Claim | null> {
  const mine = { disputeId, eventId, at: new Date().toISOString() }
  const stale = new Date(Date.now() - CLAIM_STALE_MS).toISOString()
  const res = await env.DB.prepare(
    `INSERT INTO chargebackAlertClaims (disputeId, eventId, claimedAt)
     SELECT ?, ?, ?
      WHERE NOT EXISTS (SELECT 1 FROM chargebackAlerts WHERE disputeId = ?)
     ON CONFLICT (disputeId) DO UPDATE
        SET eventId = excluded.eventId, claimedAt = excluded.claimedAt
      WHERE chargebackAlertClaims.claimedAt < ?`,
  )
    .bind(disputeId, eventId, mine.at, disputeId, stale)
    .run()
  return res.meta.changes > 0 ? mine : null
}

/** Give a claim back, if it is still this delivery's. */
function release(env: Env, mine: Claim) {
  return env.DB.prepare(
    'DELETE FROM chargebackAlertClaims WHERE disputeId = ? AND eventId = ? AND claimedAt = ?',
  ).bind(mine.disputeId, mine.eventId, mine.at)
}

/** Whether this event's ledger row moved credits after the row of the
 *  event whose mail tells the owner: that mail shows the ledger as its own
 *  row left it, so a move written later is news of its own. A dispute
 *  event's row is keyed clawback:<event id> (stripe-payments.ts, rowFor);
 *  an event on a payment with no credits on record has none. */
async function movedSince(
  env: Env,
  eventId: string,
  teller: string | null,
): Promise<boolean> {
  const mine = await env.DB.prepare(
    `SELECT delta <> 0 AND rowid > COALESCE(
              (SELECT rowid FROM creditLedger WHERE idempotencyKey = ?), 0) AS since
       FROM creditLedger WHERE idempotencyKey = ?`,
  )
    .bind(`clawback:${teller ?? ''}`, `clawback:${eventId}`)
    .first<{ since: number }>()
  return mine?.since === 1
}

/** What a delivery that did not get the claim answers, once another event
 *  told the owner or holds the claim: 'moved-since' when this one moved
 *  credits that mail cannot show, 'told' otherwise. The same event, held
 *  by its twin, throws, so Stripe sends it once more, and so does any
 *  event that finds the claim given back with the dispute not told: the
 *  holder's mail did not go. */
async function claimedElsewhere(
  env: Env,
  disputeId: string,
  eventId: string,
): Promise<ChargebackTold> {
  const now = await env.DB.prepare(
    `SELECT (SELECT eventId FROM chargebackAlerts WHERE disputeId = ?) AS toldBy,
            (SELECT eventId FROM chargebackAlertClaims WHERE disputeId = ?) AS claimedBy`,
  )
    .bind(disputeId, disputeId)
    .first<{ toldBy: string | null; claimedBy: string | null }>()
  const toldBy = now?.toldBy ?? null
  const claimedBy = now?.claimedBy ?? null
  if (toldBy === null && (claimedBy === eventId || claimedBy === null)) {
    throw new ChargebackNotTold(disputeId)
  }
  const since = await movedSince(env, eventId, toldBy ?? claimedBy)
  return since ? 'moved-since' : 'told'
}

/**
 * Tell the owner of the chargeback the event says the bank made of
 * `dispute`, with `mail`, unless an event told them already or another
 * holds the claim. Null when the event says no such thing. Records the
 * dispute as told once `mail` says Resend took it. Throws ChargebackNotTold
 * when it did not, with nothing recorded, so the caller answers 500 and is
 * called again. Run it after the event's ledger row is written.
 */
export async function tellChargeback(
  env: Env,
  event: { id: string; type: string },
  dispute: DisputeState | null,
  charge: ChargeState,
  mail: () => Promise<boolean>,
): Promise<ChargebackTold | null> {
  if (!tellsChargeback(event.type, dispute)) return null
  const mine = await claim(env, dispute.id, event.id)
  if (mine === null) return claimedElsewhere(env, dispute.id, event.id)
  const sent = await mail().catch(async (error: unknown) => {
    await release(env, mine).run()
    throw error
  })
  if (!sent) {
    await release(env, mine).run()
    throw new ChargebackNotTold(dispute.id)
  }
  await env.DB.batch([
    env.DB.prepare(
      'INSERT OR IGNORE INTO chargebackAlerts (disputeId, paymentIntentId, eventId, alertedAt) VALUES (?, ?, ?, ?)',
    ).bind(
      dispute.id,
      charge.paymentIntentId,
      event.id,
      new Date().toISOString(),
    ),
    release(env, mine),
  ])
  return 'sent'
}
