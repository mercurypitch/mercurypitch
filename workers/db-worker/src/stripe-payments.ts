// ============================================================
// stripe-payments — what a Stripe payment does to the credits ledger
// ============================================================
//
// Only paid money grants. A checkout grants when its session is paid: at
// `checkout.session.completed` for a card, and at
// `checkout.session.async_payment_succeeded` for a delayed payment method,
// which completes the session before the money arrives (billing.ts,
// grantForCheckout). Both write the session's PaymentIntent id on the rows
// they grant: a pack's credits, and the launch offer's bonus credits on the
// same payment.
//
// And money that goes back takes its credits back. Refunds and disputes of
// a payment hold floor(granted x gone / paid) of its credits between them,
// where `gone` is the money refunded so far plus what an open or lost
// dispute holds (stripe-charge.ts, moneyGoneBack):
//
//   - charge.refunded: the refunded share. Half the money, half the
//     credits, rounded down.
//   - charge.dispute.created: the disputed share, all of it for a full
//     dispute, inquiries included. The bank pulls the money the moment a
//     chargeback opens, and the credits stop with it.
//   - charge.dispute.closed: won (or an inquiry closed without a chargeback)
//     gives back what the dispute held; lost keeps it taken.
//   - refund.failed, or refund.updated to failed or canceled: the refund's
//     money stayed with us, so what it took comes back. Any other
//     refund.updated is applied like charge.refunded.
//
// Each event is applied from the charge as Stripe reports it (stripe-
// charge.ts, readCharge), read after the ledger on every attempt of the
// write, so the order events arrive in does not matter. Each writes one
// ledger row, `purchase-refund` or `purchase-dispute`, keyed `clawback:<event
// id>` with the PaymentIntent in jobRef: the row moves what refunds and
// disputes hold to what is due now, and is written even when that moves
// nothing (a refund.updated for a refund's trace number, say). Writing it is
// what makes any write that read Stripe before this event read again
// (ledger.ts, the version check), so the last row always comes from the
// newest read. A refund that ended writes its row under
// `clawback:refund-ended:<refund id>` instead, so refund.failed and the
// refund.updated Stripe sends with it give back once. A redelivered event
// writes nothing. An event that arrives before its purchase leaves word of
// it (stripeCharges), and the purchase reads Stripe and takes back what is
// due when it lands (settleEarlyMoneyBack). Only a dispute closing or a
// refund ending gives credits back, so an old event read late never does.
//
// A withdrawal (withdrawal.ts) takes a pack's unused credits itself, as
// `withdrawal` and `withdrawal-bonus` rows with the PaymentIntent in jobRef,
// and then refunds the unused credits' share of the price. Refunds and
// disputes count those rows as taken already (takenFrom, in settle): the
// share a withdrawal refunds never adds up to more credits than they
// removed, so its own charge.refunded takes nothing more, and neither does a
// refund made by hand for a withdrawal Stripe refused. A dispute of the
// whole payment takes the rest. A withdrawal that refunds the whole price (a
// purchase with no consent on record, refundBasis 'full') settles the
// payment outright: what the buyer used stays theirs (CRD Art. 14(4)(b)), so
// no refund or dispute of it takes anything more (settledWhole). A refund
// of the whole price made by hand for such a purchase (a buyer who cancelled
// by mail) settles the same way: it takes back only the credits the pack
// still has unused, as the withdrawal would have (keptUsed). A withdrawal's
// own refund that fails or is canceled is the withdrawal sweep's to follow
// and report (withdrawal-finish.ts): it writes no row here.
//
// Credits already spent are owed: the balance goes below zero, and the
// debit's own check (billing.ts, `SUM(delta) >= cost`) blocks spending until
// a purchase brings it back above zero. The payment's ledger rows then net
// to what was really paid for, whatever order the spending, the refund and
// the webhook came in. Taking only what was left would hand a buyer who
// spends fast, or a webhook that arrives late, credits nobody paid for.
//
// Every refund that moves credits, every dispute, and every payment with
// nothing on record to take (a donation, a purchase from before migration
// 0058) sends the billing alert (BILLING_ALERT_EMAIL; wording in
// stripe-alerts.ts). The 6-hourly sweep (stripe-sweep.ts) applies any of
// these events the webhook missed, through this same path.

import type { BillingAlert, CreditsMoved, EventRef, MoneyBackFacts, } from './stripe-alerts'
import { earlyMoneyBackAlert, moneyBackAlert, nothingOnRecordAlert, notAppliedAlert, } from './stripe-alerts'
import type { ChargeState, DisputeState, ReadFor, StripeGet, } from './stripe-charge'
import { anyDisputeHolds, chargeIdOf, disputeFrom, isRecord, keepCharge, loadCharge, markCharge, moneyGoneBack, readCharge, refundEnded, StripeUnavailable, } from './stripe-charge'
import type { Env } from './auth'
import type { ResendConfig } from './email'
import { sendBillingAlert } from './email'
import type { Ledger, LedgerEntry } from './ledger'
import { readLedger, writeOnLedgerOnce } from './ledger'

/** The ledger reason of a pack's credits, granted when its checkout is paid
 *  (billing.ts, grantCheckoutCredits). */
export const PACK_PURCHASE = 'purchase'
/** The ledger reason of the credits a refund takes back. */
export const PURCHASE_REFUND = 'purchase-refund'
/** The ledger reason of the credits a dispute takes back. */
export const PURCHASE_DISPUTE = 'purchase-dispute'
/** The ledger reasons of what a withdrawal removes (withdrawal.ts): the
 *  pack's unused paid credits, and the unused bonus that came with it. The
 *  refund the withdrawal asks Stripe for comes back as charge.refunded, and
 *  these rows are what that event finds already taken. */
export const WITHDRAWAL_PAID = 'withdrawal'
export const WITHDRAWAL_BONUS = 'withdrawal-bonus'

/** Rows that took a payment's credits back: refunds, disputes and
 *  withdrawals. Each names the PaymentIntent in its jobRef. */
const TAKEN_BACK: ReadonlySet<string | null> = new Set([
  PURCHASE_REFUND,
  PURCHASE_DISPUTE,
  WITHDRAWAL_PAID,
  WITHDRAWAL_BONUS,
])

/** The checkout events whose session may be paid: the webhook and the
 *  reconciliation sweep grant from both. */
export const CHECKOUT_PAID_EVENTS = [
  'checkout.session.completed',
  'checkout.session.async_payment_succeeded',
] as const

export function isCheckoutPaidEvent(type: unknown): boolean {
  return (CHECKOUT_PAID_EVENTS as readonly unknown[]).includes(type)
}

/** The Stripe events that move money back to the buyer, or end a move: a
 *  refund and what becomes of it, a dispute opening and closing.
 *  charge.refund.updated is not one: Stripe deprecated it for
 *  refund.updated. */
export const MONEY_BACK_EVENTS = [
  'charge.refunded',
  'refund.updated',
  'refund.failed',
  'charge.dispute.created',
  'charge.dispute.closed',
] as const

export type MoneyBackEvent = (typeof MONEY_BACK_EVENTS)[number]

export function isMoneyBackEvent(type: unknown): type is MoneyBackEvent {
  return (MONEY_BACK_EVENTS as readonly unknown[]).includes(type)
}

/** Every event type the webhook and the sweep apply. Any other type is
 *  acknowledged without a write. */
export const HANDLED_EVENTS: readonly string[] = [
  ...CHECKOUT_PAID_EVENTS,
  ...MONEY_BACK_EVENTS,
]

export function isHandledEvent(type: unknown): boolean {
  return isCheckoutPaidEvent(type) || isMoneyBackEvent(type)
}

/** The PaymentIntent a Checkout Session, a Charge or a Dispute names: an id
 *  in a webhook, an object when a caller expanded it. */
export function paymentIntentOf(
  object: Record<string, unknown>,
): string | null {
  const value = object.payment_intent
  if (typeof value === 'string' && value !== '') return value
  if (value !== null && typeof value === 'object') {
    const id = (value as { id?: unknown }).id
    if (typeof id === 'string' && id !== '') return id
  }
  return null
}

export interface Settlement {
  /** The row the event writes: negative takes credits back, positive gives
   *  them back. */
  delta: number
  /** What refunds and disputes hold of the payment once it is written. */
  held: number
}

/**
 * What one money-back event writes. Refunds and disputes of a payment hold
 * floor(granted x gone / paid) of its credits, less what anything else took
 * back from the same payment (a withdrawal, which takes its own credits).
 * The row moves what they hold to that. Only an event that can end a hold
 * may give credits back: a dispute closing, a refund ending. Any other
 * event that finds more held than is due leaves it, so an older event read
 * late never gives back what a newer one took. The balance plays no part:
 * credits already spent are owed.
 */
export function settlement(input: {
  /** What the payment granted: its pack and any launch bonus. */
  granted: number
  /** Money gone back, and money paid, in minor units (moneyGoneBack). */
  gone: number
  paid: number
  /** What refunds and disputes hold now. */
  heldByMoneyBack: number
  /** What anything else took back from the same payment. */
  takenOtherwise: number
  mayGiveBack: boolean
}): Settlement {
  const share =
    input.paid > 0
      ? Math.floor(
          (input.granted * Math.min(Math.max(0, input.gone), input.paid)) /
            input.paid,
        )
      : 0
  const held = Math.max(0, share - Math.max(0, input.takenOtherwise))
  const delta = input.heldByMoneyBack - held
  return delta > 0 && !input.mayGiveBack
    ? { delta: 0, held: input.heldByMoneyBack }
    : { delta, held }
}

/** Credits already taken back from the payment `paymentIntent` names: by
 *  earlier refunds and disputes, and by a withdrawal, whose own refund must
 *  not take its credits a second time. */
function takenFrom(ledger: Ledger, paymentIntent: string): number {
  return ledger.rows
    .filter((row) => TAKEN_BACK.has(row.reason) && row.jobRef === paymentIntent)
    .reduce((sum, row) => sum - Number(row.delta), 0)
}

function balanceOf(ledger: Ledger): number {
  return ledger.rows.reduce((sum, row) => sum + Number(row.delta), 0)
}

/** What refunds and disputes of the payment hold now: their rows, net of
 *  what they gave back. */
function heldByMoneyBack(ledger: Ledger, paymentIntent: string): number {
  return ledger.rows
    .filter(
      (row) =>
        (row.reason === PURCHASE_REFUND || row.reason === PURCHASE_DISPUTE) &&
        row.jobRef === paymentIntent,
    )
    .reduce((sum, row) => sum - Number(row.delta), 0)
}

/** What the payment granted: its pack and the launch bonus that came with
 *  it, the rows that carry its PaymentIntent (migration 0058). */
function grantedBy(ledger: Ledger, paymentIntent: string): number {
  return ledger.rows
    .filter(
      (row) => row.paymentIntentId === paymentIntent && Number(row.delta) > 0,
    )
    .reduce((sum, row) => sum + Number(row.delta), 0)
}

/** Whether a withdrawal refunds the whole price of the payment
 *  `paymentIntent` names (withdrawals.refundBasis, migration 0061): a
 *  purchase with no consent on record, settled outright. */
async function settledWhole(env: Env, paymentIntent: string): Promise<boolean> {
  const row = await env.DB.prepare(
    "SELECT 1 AS hit FROM withdrawals WHERE paymentIntentId = ? AND refundBasis = 'full' LIMIT 1",
  )
    .bind(paymentIntent)
    .first()
  return row !== null
}

/**
 * What settling a payment reads of the purchase behind it, which this module
 * cannot read for itself: checkout-consent.ts and withdrawal-rules.ts both
 * import it. billing.ts hands it in (PURCHASE_RECORD).
 */
export interface PurchaseRecord {
  /** Whether the purchase the payment made has no consent on record:
   *  purchaseTerms 'no_consent' (checkout-consent.ts). */
  noConsent(env: Env, userId: string, paymentIntent: string): Promise<boolean>
  /** The credits of the payment's pack still unused, paid and bonus, as a
   *  withdrawal of it counts them (withdrawal-rules.ts, packUses). */
  unused(rows: readonly LedgerEntry[], paymentIntent: string): number
}

/** What else settling a payment depends on: whether the event may give
 *  credits back, whether a withdrawal settled the payment whole, and, for a
 *  purchase with no consent on record, its pack's credits still unused. */
export interface SettleTerms {
  mayGiveBack: boolean
  settledWhole: boolean
  /** PurchaseRecord.unused for a purchase with no consent on record; null
   *  for one with a consent. */
  unusedWithoutConsent: number | null
}

export interface Settle {
  delta: number
  granted: number
  held: number
  /** What a withdrawal's own rows took back. */
  takenOtherwise: number
  settledWhole: boolean
  /** Refunded whole with no consent on record: the credits the buyer used
   *  stayed theirs. */
  keptUsed: boolean
}

/** Every cent of the charge went back by refund. */
function refundedWhole(charge: ChargeState): boolean {
  return charge.amount > 0 && charge.amountRefunded >= charge.amount
}

/**
 * What settling the payment against `ledger` writes. Anything else that took
 * the payment's credits back (takenFrom, less what refunds and disputes
 * hold) counts as taken already.
 *
 * A payment settled like a withdrawal of its whole price leaves what the
 * buyer used theirs (CRD Art. 14(4)(b)), so no refund or dispute of it ever
 * leaves them owing for it. One a withdrawal refunded whole counts as having
 * taken back everything it granted. One refunded whole by hand, for a
 * purchase with no consent on record (a buyer who cancelled by mail), takes
 * back only the credits its pack still has unused, as a withdrawal of it
 * would have.
 */
export function settle(
  ledger: Ledger,
  paymentIntent: string,
  charge: ChargeState,
  terms: SettleTerms,
): Settle {
  const granted = grantedBy(ledger, paymentIntent)
  const held = heldByMoneyBack(ledger, paymentIntent)
  const takenOtherwise = Math.max(0, takenFrom(ledger, paymentIntent) - held)
  const { gone, paid } = moneyGoneBack(charge)
  const unused = terms.unusedWithoutConsent
  const keptUsed =
    !terms.settledWhole && unused !== null && refundedWhole(charge)
  const counted = terms.settledWhole
    ? granted
    : keptUsed
      ? Math.max(0, granted - held - Math.max(0, unused ?? 0))
      : takenOtherwise
  const next = settlement({
    granted,
    gone,
    paid,
    heldByMoneyBack: held,
    takenOtherwise: counted,
    mayGiveBack: terms.mayGiveBack,
  })
  return {
    delta: next.delta,
    granted,
    held: next.held,
    takenOtherwise,
    settledWhole: terms.settledWhole,
    keptUsed,
  }
}

/**
 * The terms of settling the payment `paymentIntent` names against `ledger`
 * and `charge`, both as just read. A withdrawal is looked for after every
 * read of the ledger: it writes its statement and its rows in one batch, so
 * a statement a read missed comes with rows that make the write lose and
 * read again. Whether the purchase has a consent on record is asked only of
 * a charge refunded whole.
 */
async function termsOf(
  env: Env,
  record: PurchaseRecord,
  userId: string,
  paymentIntent: string,
  charge: ChargeState,
  ledger: Ledger,
  mayGiveBack: boolean,
): Promise<SettleTerms> {
  const whole = await settledWhole(env, paymentIntent)
  const noConsent =
    !whole &&
    refundedWhole(charge) &&
    (await record.noConsent(env, userId, paymentIntent))
  return {
    mayGiveBack,
    settledWhole: whole,
    unusedWithoutConsent: noConsent
      ? record.unused(ledger.rows, paymentIntent)
      : null,
  }
}

/** The row one event writes: its key, its reason, and whether it may give
 *  credits back. */
interface SettleRow {
  key: string
  reason: string
  mayGiveBack: boolean
}

interface Settled extends CreditsMoved {
  /** False when an earlier or a concurrent delivery wrote the row. */
  wrote: boolean
  /** The charge as Stripe reported it to the read the row came from. */
  charge: ChargeState
}

/** Everything settling one payment reads, on every attempt of its write. */
interface SettleInput {
  userId: string
  paymentIntent: string
  row: SettleRow
  record: PurchaseRecord
  /** Stripe's charge, read afresh. */
  readCharge: () => Promise<ChargeState>
  /** The row's reason, when it depends on the charge as read. */
  reasonFor?: (charge: ChargeState) => string
}

/**
 * Write the payment's settlement on its owner's ledger, once per key. Each
 * attempt reads the ledger, then Stripe, then the terms, and writes under
 * the ledger's version check with the charge it read (keepCharge), so a
 * write never lands on a ledger another event wrote after its read of
 * Stripe.
 */
async function settlePayment(env: Env, input: SettleInput): Promise<Settled> {
  let after: Omit<Settled, 'userId' | 'delta' | 'wrote'> | null = null
  const written = await writeOnLedgerOnce(
    env,
    input.userId,
    input.row.key,
    input.row.reason,
    async (ledger) => {
      const charge = await input.readCharge()
      const terms = await termsOf(
        env,
        input.record,
        input.userId,
        input.paymentIntent,
        charge,
        ledger,
        input.row.mayGiveBack,
      )
      const next = settle(ledger, input.paymentIntent, charge, terms)
      after = {
        charge,
        granted: next.granted,
        held: next.held,
        takenOtherwise: next.takenOtherwise,
        settledWhole: next.settledWhole,
        keptUsed: next.keptUsed,
        balance: balanceOf(ledger) + next.delta,
      }
      return {
        delta: next.delta,
        jobRef: input.paymentIntent,
        reason: input.reasonFor?.(charge),
        alongside: (guard) => [
          keepCharge(env, input.paymentIntent, charge, guard),
        ],
      }
    },
  )
  if (after === null) throw new Error(`${input.row.key}: never read`)
  return {
    userId: input.userId,
    delta: written.delta,
    wrote: written.wrote,
    ...(after as Omit<Settled, 'userId' | 'delta' | 'wrote'>),
  }
}

/** Stripe's charge again, for an attempt of a write. Stripe knew it a
 *  moment ago; if it no longer does, the event is tried again later. */
function chargeReader(
  get: StripeGet,
  chargeId: string,
  readFor: ReadFor,
): () => Promise<ChargeState> {
  return async () => {
    const charge = await readCharge(get, chargeId, readFor)
    if (charge === 'missing') {
      throw new StripeUnavailable(`Stripe no longer knows ${chargeId}`)
    }
    return charge
  }
}

function movedText(delta: number): string {
  if (delta < 0) return `took back ${-delta} credit(s)`
  return delta > 0 ? `gave back ${delta} credit(s)` : 'moved no credits'
}

function logSettled(
  label: string,
  paymentIntent: string,
  moved: Settled,
): void {
  console.log(
    `[billing] ${label}: ${paymentIntent} ${movedText(moved.delta)} for user=${moved.userId}; refunds and disputes hold ${moved.held} of ${moved.granted}, balance ${moved.balance}`,
  )
}

function alertConfig(env: Env): ResendConfig {
  return { apiKey: env.RESEND_API_KEY, from: env.EMAIL_FROM }
}

async function sendAlert(env: Env, alert: BillingAlert | null): Promise<void> {
  if (alert === null) return
  await sendBillingAlert(
    alertConfig(env),
    env.BILLING_ALERT_EMAIL ?? '',
    alert.subject,
    alert.lines,
  )
}

/** A Stripe event, as the webhook reads it from its body and the sweep from
 *  the events list. */
export interface StripeEventInput {
  id: string
  type: string
  livemode: boolean
  /** When Stripe created it, in seconds since 1970; 0 when it did not say. */
  created: number
  object: Record<string, unknown>
}

/** The event a parsed webhook body or events-list item holds, or why it
 *  holds none. */
export function parseStripeEvent(
  value: unknown,
): StripeEventInput | { ignored: 'malformed payload' | 'missing event id' } {
  if (!isRecord(value)) return { ignored: 'malformed payload' }
  if (typeof value.id !== 'string' || value.id === '') {
    return { ignored: 'missing event id' }
  }
  const data = isRecord(value.data) ? value.data : {}
  return {
    id: value.id,
    type: typeof value.type === 'string' ? value.type : '',
    livemode: value.livemode === true,
    created:
      typeof value.created === 'number' && Number.isFinite(value.created)
        ? value.created
        : 0,
    object: isRecord(data.object) ? data.object : {},
  }
}

/**
 * The event in a webhook body Stripe signed, or why it is acknowledged
 * without being applied: a body nobody can read, an event with no id, or a
 * type nothing here handles. Each of those is final, so the webhook answers
 * 200 and Stripe stops sending it; none of them touches D1.
 */
export function readWebhookEvent(
  payload: string,
): StripeEventInput | { ignored: string } {
  let body: unknown
  try {
    body = JSON.parse(payload)
  } catch {
    body = null
  }
  const event = parseStripeEvent(body)
  if ('ignored' in event) {
    console.warn(`[billing] webhook: ${event.ignored}, acknowledged unread`)
    return event
  }
  return isHandledEvent(event.type)
    ? event
    : { ignored: 'unhandled event type' }
}

function refOf(event: StripeEventInput): EventRef {
  return { id: event.id, type: event.type, livemode: event.livemode }
}

function isDisputeEvent(type: string): boolean {
  return type.startsWith('charge.dispute.')
}

function isRefundEvent(type: string): boolean {
  return type === 'charge.refunded' || type.startsWith('refund.')
}

/** How the refund an event is about ended with its money still ours, or
 *  null when it did not: refund.failed says so by its type, refund.updated
 *  by the refund's status. */
function refundEndOf(event: StripeEventInput): 'failed' | 'canceled' | null {
  const status = event.object.status
  if (event.type === 'refund.failed') {
    return status === 'canceled' ? 'canceled' : 'failed'
  }
  if (event.type !== 'refund.updated' || !refundEnded(status)) return null
  return status === 'canceled' ? 'canceled' : 'failed'
}

/** The withdrawal a refund event's refund was made for: withdrawal-refund.ts
 *  tags each refund it asks for with metadata.withdrawalId. Null for any
 *  other refund, and for a charge or a dispute. */
function withdrawalOf(event: StripeEventInput): string | null {
  if (!event.type.startsWith('refund.')) return null
  const metadata = event.object.metadata
  if (!isRecord(metadata)) return null
  const id = metadata.withdrawalId
  return typeof id === 'string' && id !== '' ? id : null
}

/** The dispute a dispute event carries, as the event saw it. */
function eventDispute(event: StripeEventInput): DisputeState | null {
  return isDisputeEvent(event.type) ? disputeFrom(event.object) : null
}

/** What the event is about, with its dispute as Stripe reports it now. */
function factsOf(event: StripeEventInput, charge: ChargeState): MoneyBackFacts {
  const carried = eventDispute(event)
  return {
    dispute:
      carried === null
        ? null
        : (charge.disputes.find((dispute) => dispute.id === carried.id) ??
          carried),
    refundEnded: refundEndOf(event),
  }
}

/** The row the event writes. A dispute closing, or a refund ending, may
 *  give credits back; a refund that ended is keyed by the refund, which
 *  refund.failed and refund.updated both name. */
function rowFor(event: StripeEventInput): SettleRow {
  const ended = refundEndOf(event)
  const refundId = typeof event.object.id === 'string' ? event.object.id : ''
  return {
    key:
      ended !== null && refundId !== ''
        ? `clawback:refund-ended:${refundId}`
        : `clawback:${event.id}`,
    reason: isDisputeEvent(event.type) ? PURCHASE_DISPUTE : PURCHASE_REFUND,
    mayGiveBack: event.type === 'charge.dispute.closed' || ended !== null,
  }
}

/** The account a payment's credits went to, or null when no credits on
 *  record name the payment. */
async function creditOwner(
  env: Env,
  paymentIntent: string,
): Promise<string | null> {
  const row = await env.DB.prepare(
    'SELECT userId FROM creditLedger WHERE paymentIntentId = ? AND delta > 0 LIMIT 1',
  )
    .bind(paymentIntent)
    .first<{ userId: string }>()
  return row?.userId ?? null
}

/** The account a donation came from, when the payment was one: its audit
 *  row (billing.ts, grantSupporterEntitlement) names it. */
async function donor(env: Env, paymentIntent: string): Promise<string | null> {
  const row = await env.DB.prepare(
    "SELECT userId FROM creditLedger WHERE paymentIntentId = ? AND reason = 'donation' LIMIT 1",
  )
    .bind(paymentIntent)
    .first<{ userId: string }>()
  return row?.userId ?? null
}

/** What applying one Stripe event came to (billing.ts, applyStripeEvent):
 *  what the webhook answers, and what the sweep reports. */
export type StripeEventResult =
  /** Applied now, and recorded. */
  | { kind: 'applied'; detail?: string }
  /** Final, and nothing could be applied: acknowledged, recorded when the
   *  type is handled, and never tried again. */
  | { kind: 'ignored'; reason: string }
  /** Recorded before, or another delivery holds it right now. */
  | { kind: 'duplicate' }
  /** A checkout not paid yet: recorded, nothing granted. */
  | { kind: 'unpaid' }

/** What applying a money-back event came to. */
export type MoneyBackResult = Extract<
  StripeEventResult,
  { kind: 'applied' | 'ignored' }
>

async function notApplied(
  env: Env,
  event: StripeEventInput,
  why: string,
  reason: string,
): Promise<MoneyBackResult> {
  console.warn(`[billing] ${event.type} ${event.id}: ${why}, nothing applied`)
  await sendAlert(env, notAppliedAlert(refOf(event), why, eventDispute(event)))
  return { kind: 'ignored', reason }
}

async function nothingOnRecord(
  env: Env,
  event: StripeEventInput,
  charge: ChargeState,
): Promise<void> {
  const paymentIntent = charge.paymentIntentId
  console.warn(
    `[billing] ${event.type} ${event.id}: no credits on record for ${paymentIntent ?? `${charge.chargeId}, which names no PaymentIntent`}, none taken back`,
  )
  const facts = factsOf(event, charge)
  // A refund update is news only when it canceled the refund: a failure is
  // refund.failed's to report, so the owner hears of it once.
  if (event.type === 'refund.updated' && facts.refundEnded !== 'canceled') {
    return
  }
  const userId = paymentIntent === null ? null : await donor(env, paymentIntent)
  await sendAlert(
    env,
    nothingOnRecordAlert(
      refOf(event),
      charge,
      userId === null ? null : { userId },
      facts,
    ),
  )
}

/**
 * Apply a refund or dispute event (MONEY_BACK_EVENTS) to the credits of the
 * payment it is about, from what Stripe reports now: the charge, its refunds
 * and its disputes. Safe to call again for the same event: its row is keyed
 * on it, or on the refund it ended. Throws when D1 or Stripe fails, so the
 * caller tries again later (the webhook answers 500, the sweep leaves the
 * event for its next run).
 */
export async function applyMoneyBack(
  env: Env,
  get: StripeGet,
  event: StripeEventInput,
  record: PurchaseRecord,
): Promise<MoneyBackResult> {
  // A withdrawal's own refund that failed or was canceled is the withdrawal
  // sweep's (withdrawal-finish.ts): it follows the refund, marks the
  // statement failed and alerts the owner. Nothing here took credits for
  // it, so nothing comes back, and the owner hears of it once.
  const ended = refundEndOf(event)
  const withdrawal = ended === null ? null : withdrawalOf(event)
  if (withdrawal !== null) {
    console.log(
      `[billing] ${event.type} ${event.id}: the refund of withdrawal ${withdrawal} ${ended}, left to the withdrawal sweep`,
    )
    return {
      kind: 'ignored',
      reason: 'a withdrawal refund, which the withdrawal sweep follows',
    }
  }
  const chargeId = chargeIdOf(event.type, event.object)
  if (chargeId === null) {
    return notApplied(
      env,
      event,
      'it names no charge',
      'no charge on the event',
    )
  }
  const readFor: ReadFor = {
    refund: isRefundEvent(event.type),
    dispute: eventDispute(event),
  }
  const charge = await readCharge(get, chargeId, readFor)
  if (charge === 'missing') {
    return notApplied(
      env,
      event,
      `Stripe knows no charge ${chargeId}`,
      'charge not found',
    )
  }
  const paymentIntent = charge.paymentIntentId
  // Left before the grant is looked for: a purchase landing at the same
  // moment then finds it, if this does not find the purchase.
  if (paymentIntent !== null) await markCharge(env, paymentIntent, charge)
  const owner =
    paymentIntent === null ? null : await creditOwner(env, paymentIntent)
  if (owner === null || paymentIntent === null) {
    await nothingOnRecord(env, event, charge)
    return { kind: 'applied' }
  }
  const moved = await settlePayment(env, {
    userId: owner,
    paymentIntent,
    row: rowFor(event),
    record,
    readCharge: chargeReader(get, chargeId, readFor),
  })
  if (moved.wrote) {
    logSettled(`${event.type} ${event.id}`, paymentIntent, moved)
    await sendAlert(
      env,
      moneyBackAlert(
        refOf(event),
        moved.charge,
        moved,
        factsOf(event, moved.charge),
      ),
    )
  }
  return { kind: 'applied' }
}

/**
 * After a purchase lands, take back what its refunds and disputes make due
 * when one of them arrived first and found no credits to take: it left word
 * (stripeCharges). Reads Stripe again, since what was kept may be older than
 * what Stripe says now. Runs on every delivery of the purchase, and writes
 * one row per payment at most, moving nothing when nothing is due.
 */
export async function settleEarlyMoneyBack(
  env: Env,
  get: StripeGet,
  purchaseEventId: string,
  session: Record<string, unknown>,
  userId: string,
  record: PurchaseRecord,
): Promise<void> {
  const paymentIntent = paymentIntentOf(session)
  if (paymentIntent === null) return
  const kept = await loadCharge(env, paymentIntent)
  if (kept === null) return
  const moved = await settlePayment(env, {
    userId,
    paymentIntent,
    row: {
      key: `clawback:early:${paymentIntent}`,
      reason: PURCHASE_REFUND,
      mayGiveBack: false,
    },
    record,
    readCharge: chargeReader(get, kept.chargeId, {
      refund: true,
      dispute: null,
    }),
    reasonFor: (charge) =>
      anyDisputeHolds(charge) ? PURCHASE_DISPUTE : PURCHASE_REFUND,
  })
  if (!moved.wrote || moved.delta === 0) return
  logSettled(
    `purchase ${purchaseEventId}, after its money went back`,
    paymentIntent,
    moved,
  )
  await sendAlert(
    env,
    earlyMoneyBackAlert(purchaseEventId, moved.charge, moved),
  )
}
