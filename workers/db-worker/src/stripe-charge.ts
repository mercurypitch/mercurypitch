// ============================================================
// stripe-charge — what Stripe says a charge is now
// ============================================================
//
// A refund or dispute event says that something changed; Stripe's API says
// what is true now. Stripe sends events more than once and in any order, so
// every money-back event is applied from what Stripe reports at that moment,
// not from the copy the event carries: the charge (GET /v1/charges/:id), its
// refunds (GET /v1/refunds?charge=) and its disputes (GET
// /v1/disputes?charge=). An old event read late, a failed refund, a dispute
// whose closing is read before its opening: each lands on the same answer.
//
// The refunds are added up one by one instead of trusting the charge's
// amount_refunded: a refund that failed or was canceled sent no money back,
// and summing the ones that did not is right whether or not Stripe takes a
// failed refund out of amount_refunded. A Charge has no dispute on it, only
// `disputed: true`, so its disputes come from their own list. Each list is
// read only when the charge or the event says there is something on it.
//
// What Stripe said is kept per PaymentIntent (stripeCharges, migration
// 0064). The read a ledger row was worked out from is kept with that row, in
// the same batch and under the same check (ledger.ts, LedgerGuard), so an
// older read never replaces a newer one. An event whose purchase has not
// landed yet leaves its read only where there is none: the purchase reads
// Stripe again when it lands (stripe-payments.ts, settleEarlyMoneyBack).
//
// Only ids, amounts, statuses and the dispute's reason code are read out of
// what Stripe sends. A charge also carries the buyer's email and card
// details: nothing here copies them anywhere, and nothing logs a charge.

import type { Env } from './auth'
import type { LedgerGuard } from './ledger'

/** Stripe's REST GET, as billing.ts makes it: injected, so the webhook and
 *  the sweep read through the same one and tests read from a fake. */
export type StripeGet = (pathWithQuery: string) => Promise<{
  ok: boolean
  status: number
  data: Record<string, unknown>
}>

/** A dispute, as far as the credits are concerned. */
export interface DisputeState {
  id: string
  /** Stripe's word for it: warning_needs_response, warning_under_review,
   *  warning_closed, needs_response, under_review, won, lost, prevented. */
  status: string
  /** The disputed amount, in the dispute's currency's minor units. */
  amount: number
  currency: string
  /** Stripe's reason code: fraudulent, product_not_received, ... */
  reason: string | null
  /** When the evidence is due, in seconds since 1970, if Stripe says. */
  dueBy: number | null
  /** Stripe's is_charge_refundable: whether the disputed payment can still
   *  be refunded (true through an inquiry, false once it is charged back).
   *  Null when Stripe did not say, or the dispute was kept before it was
   *  read. */
  refundable: boolean | null
}

/** A charge, as far as the credits are concerned. */
export interface ChargeState {
  chargeId: string
  paymentIntentId: string | null
  /** What the charge took, in minor units. */
  amount: number
  /** Refunded so far, in minor units: the refunds that have not failed or
   *  been canceled. */
  amountRefunded: number
  currency: string
  /** Its disputes: almost always none or one. */
  disputes: DisputeState[]
}

/** What the event a charge is read for is about, so the read covers it even
 *  when the charge does not say so yet. */
export interface ReadFor {
  /** A refund: read the refunds even when the charge says none were made. */
  refund: boolean
  /** The dispute the event carries: read the disputes even when the charge
   *  does not say it is disputed, and keep this one if Stripe's list lacks
   *  it. */
  dispute: DisputeState | null
}

/** Thrown when Stripe could not say what a charge is: an outage, a rate
 *  limit, a key that does not work. The event is tried again later. */
export class StripeUnavailable extends Error {
  override name = 'StripeUnavailable'
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function whole(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.trunc(value)
    : null
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null
}

function flag(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null
}

/** The id an expandable Stripe field holds: the id itself, as a webhook
 *  sends it, or the id of the object a caller expanded. */
export function expandableId(value: unknown): string | null {
  if (typeof value === 'string') return text(value)
  return isRecord(value) ? text(value.id) : null
}

/** Ids that can go into a URL as they are. */
const STRIPE_ID = /^[A-Za-z0-9_]{1,255}$/

export function disputeFrom(value: unknown): DisputeState | null {
  if (!isRecord(value)) return null
  const id = text(value.id)
  const status = text(value.status)
  if (id === null || status === null) return null
  const evidence = isRecord(value.evidence_details)
    ? value.evidence_details
    : {}
  return {
    id,
    status,
    amount: whole(value.amount) ?? 0,
    currency: text(value.currency) ?? '',
    reason: text(value.reason),
    dueBy: whole(evidence.due_by),
    refundable: flag(value.is_charge_refundable),
  }
}

/** The charge itself, before its refunds and disputes are read:
 *  amountRefunded is what the charge reports, and there are no disputes. */
export function chargeFrom(value: unknown): ChargeState | null {
  if (!isRecord(value)) return null
  const chargeId = text(value.id)
  const amount = whole(value.amount)
  if (chargeId === null || amount === null) return null
  return {
    chargeId,
    paymentIntentId: expandableId(value.payment_intent),
    amount,
    amountRefunded: Math.max(0, whole(value.amount_refunded) ?? 0),
    currency: text(value.currency) ?? '',
    disputes: [],
  }
}

/** The charge a money-back event is about: the charge itself for
 *  charge.refunded, the charge its refund or dispute names otherwise. Null
 *  when there is none, or none that can go into a URL. */
export function chargeIdOf(
  type: string,
  object: Record<string, unknown>,
): string | null {
  const id =
    type === 'charge.refunded' ? text(object.id) : expandableId(object.charge)
  return id !== null && STRIPE_ID.test(id) ? id : null
}

/** Pages read from one list before the read gives up: 500 refunds or
 *  disputes on one charge, where a pack's charge carries a handful. */
const LIST_PAGES = 5

/** Every refund or dispute Stripe lists for the charge. */
async function listFor(
  get: StripeGet,
  what: 'refunds' | 'disputes',
  chargeId: string,
): Promise<Array<Record<string, unknown>>> {
  const items: Array<Record<string, unknown>> = []
  let after: string | null = null
  for (let page = 0; page < LIST_PAGES; page += 1) {
    const query = new URLSearchParams({ charge: chargeId, limit: '100' })
    if (after !== null) query.set('starting_after', after)
    const res = await get(`/${what}?${query.toString()}`)
    if (!res.ok) {
      throw new StripeUnavailable(
        `Stripe answered ${res.status} for the ${what} of ${chargeId}`,
      )
    }
    if (!Array.isArray(res.data.data)) {
      throw new StripeUnavailable(
        `Stripe sent the ${what} of ${chargeId} in a shape not read`,
      )
    }
    const listed = res.data.data.filter(isRecord)
    items.push(...listed)
    after = text(listed.at(-1)?.id)
    if (res.data.has_more !== true || after === null) return items
  }
  throw new StripeUnavailable(
    `${chargeId} lists more ${what} than ${LIST_PAGES * 100}`,
  )
}

/** Refund statuses whose money stayed with us. Any other status counts as
 *  gone: pending, requires_action and succeeded are on their way or there,
 *  and a status Stripe adds later is not worth giving credits back for
 *  until a refund says it failed. */
const REFUND_ENDED = new Set(['failed', 'canceled'])

export function refundEnded(status: unknown): boolean {
  return typeof status === 'string' && REFUND_ENDED.has(status)
}

function refundedBy(refunds: Array<Record<string, unknown>>): number {
  return refunds
    .filter((refund) => !refundEnded(refund.status))
    .reduce((sum, refund) => sum + Math.max(0, whole(refund.amount) ?? 0), 0)
}

/** The disputes Stripe lists, and the event's own when the list lacks it. */
function disputesWith(
  listed: Array<Record<string, unknown>>,
  fromEvent: DisputeState | null,
): DisputeState[] {
  const disputes = listed
    .map(disputeFrom)
    .filter((dispute): dispute is DisputeState => dispute !== null)
  return fromEvent === null ||
    disputes.some((dispute) => dispute.id === fromEvent.id)
    ? disputes
    : [...disputes, fromEvent]
}

/**
 * What Stripe says the charge is now, with its refunds added up and its
 * disputes listed, or `missing` when Stripe knows no such charge (404):
 * that never changes, and is not worth a retry. Throws StripeUnavailable
 * for any other answer that is not a charge.
 */
export async function readCharge(
  get: StripeGet,
  chargeId: string,
  readFor: ReadFor,
): Promise<ChargeState | 'missing'> {
  const res = await get(`/charges/${chargeId}`)
  if (res.status === 404) return 'missing'
  if (!res.ok) {
    throw new StripeUnavailable(`Stripe answered ${res.status} for ${chargeId}`)
  }
  const charge = chargeFrom(res.data)
  if (charge === null) {
    throw new StripeUnavailable(`Stripe sent ${chargeId} in a shape not read`)
  }
  const anyRefund =
    charge.amountRefunded > 0 || res.data.refunded === true || readFor.refund
  const disputed = res.data.disputed === true || readFor.dispute !== null
  return {
    ...charge,
    amountRefunded: anyRefund
      ? refundedBy(await listFor(get, 'refunds', chargeId))
      : 0,
    disputes: disputed
      ? disputesWith(await listFor(get, 'disputes', chargeId), readFor.dispute)
      : [],
  }
}

/** Dispute statuses that hold nothing: won, an inquiry closed without a
 *  chargeback, and a dispute prevented before it became one. */
const RELEASED = new Set(['won', 'warning_closed', 'prevented'])

/** Whether the dispute is an inquiry (warning_needs_response,
 *  warning_under_review, warning_closed): the bank asks about the payment,
 *  and no money moves unless it becomes a chargeback. Stripe still lets the
 *  payment be refunded, and a full refund closes the inquiry. */
export function isInquiry(dispute: DisputeState): boolean {
  return dispute.status.startsWith('warning_')
}

/** Whether a dispute holds its share of the payment: from the moment the
 *  bank takes the money back (a chargeback: needs_response, under_review)
 *  until it ends in the merchant's favor, and for good once it is lost. An
 *  inquiry holds nothing: no money has moved. A status Stripe adds later
 *  holds too: a hold given back by mistake cannot be taken again once the
 *  credits are spent. */
export function disputeHolds(dispute: DisputeState): boolean {
  return !RELEASED.has(dispute.status) && !isInquiry(dispute)
}

/** Whether any dispute of the charge holds its share. */
export function anyDisputeHolds(charge: ChargeState): boolean {
  return charge.disputes.some(disputeHolds)
}

/** Whether Stripe refuses to refund the payment because of a dispute on
 *  it: one whose is_charge_refundable is false. A refund asked for then is
 *  answered charge_disputed; the dispute decides where the money goes. */
export function refundBarredByDispute(charge: ChargeState): boolean {
  return charge.disputes.some((dispute) => dispute.refundable === false)
}

/** How much of the payment has gone back, in minor units: `gone` of
 *  `paid`. Refunded so far, plus what each dispute that holds holds (its
 *  amount, or all of the payment when the two currencies differ), never
 *  more than the payment. Whole numbers, so the credits it decides are
 *  exact: a third of 30 credits is 10, not 9.999. */
export function moneyGoneBack(charge: ChargeState): {
  gone: number
  paid: number
} {
  const paid = Math.max(0, charge.amount)
  const held = charge.disputes.filter(disputeHolds).reduce((sum, dispute) => {
    const comparable =
      dispute.currency.toLowerCase() === charge.currency.toLowerCase() &&
      dispute.amount > 0
    return sum + (comparable ? dispute.amount : paid)
  }, 0)
  return {
    gone: Math.min(paid, Math.max(0, charge.amountRefunded) + held),
    paid,
  }
}

interface ChargeRow {
  chargeId: string
  currency: string
  amount: number
  amountRefunded: number
  disputes: string
}

const CHARGE_COLUMNS =
  'paymentIntentId, chargeId, currency, amount, amountRefunded, disputes, updatedAt'

function chargeValues(paymentIntentId: string, charge: ChargeState): unknown[] {
  return [
    paymentIntentId,
    charge.chargeId,
    charge.currency,
    charge.amount,
    charge.amountRefunded,
    JSON.stringify(charge.disputes),
    new Date().toISOString(),
  ]
}

/** Leave word that money went back on the payment, for a purchase that
 *  lands later (loadCharge). Never replaces what is kept: the purchase
 *  reads Stripe again, and a newer read may be kept already. */
export async function markCharge(
  env: Env,
  paymentIntentId: string,
  charge: ChargeState,
): Promise<void> {
  await env.DB.prepare(
    `INSERT OR IGNORE INTO stripeCharges (${CHARGE_COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(...chargeValues(paymentIntentId, charge))
    .run()
}

/** Keep what Stripe said about the payment's charge, with the ledger row
 *  worked out from it (ledger.ts, LedgerWrite.alongside): only while
 *  `guard` holds, so a read older than one kept already never replaces it. */
export function keepCharge(
  env: Env,
  paymentIntentId: string,
  charge: ChargeState,
  guard: LedgerGuard,
): D1PreparedStatement {
  return env.DB.prepare(
    `INSERT INTO stripeCharges (${CHARGE_COLUMNS})
     SELECT ?, ?, ?, ?, ?, ?, ?
      WHERE ${guard.sql}
     ON CONFLICT(paymentIntentId) DO UPDATE SET
       chargeId = excluded.chargeId,
       currency = excluded.currency,
       amount = excluded.amount,
       amountRefunded = excluded.amountRefunded,
       disputes = excluded.disputes,
       updatedAt = excluded.updatedAt`,
  ).bind(...chargeValues(paymentIntentId, charge), ...guard.values)
}

/** A dispute as it is kept: DisputeState, not Stripe's shape. */
function storedDispute(entry: unknown): DisputeState | null {
  if (!isRecord(entry)) return null
  const id = text(entry.id)
  const status = text(entry.status)
  if (id === null || status === null) return null
  return {
    id,
    status,
    amount: whole(entry.amount) ?? 0,
    currency: text(entry.currency) ?? '',
    reason: text(entry.reason),
    dueBy: whole(entry.dueBy),
    refundable: flag(entry.refundable),
  }
}

/** The disputes a stripeCharges row keeps. A row that cannot be read
 *  throws: reading it as no disputes would give back credits one holds. */
function storedDisputes(json: string, paymentIntentId: string): DisputeState[] {
  let value: unknown
  try {
    value = JSON.parse(json)
  } catch {
    value = null
  }
  const stored: unknown[] = Array.isArray(value) ? value : [null]
  const disputes = stored
    .map(storedDispute)
    .filter((dispute): dispute is DisputeState => dispute !== null)
  if (disputes.length !== stored.length) {
    throw new Error(`stripeCharges ${paymentIntentId}: disputes not readable`)
  }
  return disputes
}

/** What Stripe last said about the payment's charge, or null when no
 *  money ever went back on it. */
export async function loadCharge(
  env: Env,
  paymentIntentId: string,
): Promise<ChargeState | null> {
  const row = await env.DB.prepare(
    `SELECT chargeId, currency, amount, amountRefunded, disputes
       FROM stripeCharges WHERE paymentIntentId = ?`,
  )
    .bind(paymentIntentId)
    .first<ChargeRow>()
  if (row === null) return null
  return {
    chargeId: row.chargeId,
    paymentIntentId,
    amount: row.amount,
    amountRefunded: row.amountRefunded,
    currency: row.currency,
    disputes: storedDisputes(row.disputes, paymentIntentId),
  }
}
