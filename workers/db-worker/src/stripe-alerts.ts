// ============================================================
// stripe-alerts — what the owner is told when money goes back
// ============================================================
//
// The words of the billing alerts for refunds and disputes. Pure: each
// builder takes the facts and returns a subject and lines, and
// stripe-payments.ts sends them through sendBillingAlert (email.ts), the
// one path every billing alert takes.
//
// An alert carries what the owner needs to act without opening anything
// else first: the amount, the dispute's reason and evidence deadline with a
// link to answer it, the account, the credits moved and the balance after.
// It never carries the buyer's email or card details: the account id and
// the Stripe ids find them in the Dashboard.

import { formatDate, formatMoney } from './email'
import type { ChargeState, DisputeState } from './stripe-charge'
import { anyDisputeHolds, disputeHolds, isInquiry } from './stripe-charge'

export interface BillingAlert {
  subject: string
  lines: string[]
}

/** The Stripe event an alert is about. */
export interface EventRef {
  id: string
  type: string
  livemode: boolean
}

/** What a money-back event is about, besides its charge: the dispute it
 *  carries, or the refund it says ended with the money still ours. */
export interface MoneyBackFacts {
  dispute: DisputeState | null
  refundEnded: 'failed' | 'canceled' | null
}

/** What applying a money-back event did to the payment's credits. */
export interface CreditsMoved {
  userId: string
  /** The row it wrote: negative took credits back, positive gave them. */
  delta: number
  /** What the payment granted: its pack and any launch bonus. */
  granted: number
  /** What refunds and disputes hold of it now. */
  held: number
  /** What anything else took back from it: a withdrawal of the pack. */
  takenOtherwise: number
  /** A withdrawal refunded its whole price (refundBasis 'full'): no refund
   *  or dispute takes anything more from it. */
  settledWhole: boolean
  /** No consent on record: credits the buyer used that the money gone
   *  back would hold, and that stay theirs. */
  keptUsed: number
  /** The account's balance after the row. */
  balance: number
}

function money(minor: number, currency: string): string {
  return formatMoney(minor, currency === '' ? 'eur' : currency)
}

function dueText(dueBy: number | null): string {
  if (dueBy === null) return 'not given'
  const iso = new Date(dueBy * 1000).toISOString()
  return `${formatDate(iso)}, ${iso.slice(11, 16)} UTC`
}

function dashboardLink(event: EventRef, dispute: DisputeState): string {
  const mode = event.livemode ? '' : 'test/'
  return `https://dashboard.stripe.com/${mode}disputes/${dispute.id}`
}

function references(event: EventRef, charge: ChargeState | null): string[] {
  return [
    `Stripe event: ${event.id} (${event.type})`,
    ...(charge === null
      ? []
      : [
          `Charge: ${charge.chargeId}`,
          `PaymentIntent: ${charge.paymentIntentId ?? 'none'}`,
        ]),
  ]
}

/** The balance after a take, and the debt it left when the credits were
 *  spent already. */
function balanceLine(moved: CreditsMoved): string {
  const taken = Math.max(0, -moved.delta)
  const owed = Math.min(taken, Math.max(0, -moved.balance))
  const line = `Balance after: ${moved.balance} credit(s).`
  return owed === 0
    ? line
    : `${line} ${owed} of them were already spent, so the account owes them and cannot spend until its balance is back above zero.`
}

function creditLines(moved: CreditsMoved): string[] {
  const moving =
    moved.delta < 0
      ? `Taken back now: ${-moved.delta} credit(s) of the ${moved.granted} the payment granted (its pack and any launch bonus).`
      : moved.delta > 0
        ? `Given back now: ${moved.delta} credit(s).`
        : `No credits moved now. Refunds and disputes hold ${moved.held} of the ${moved.granted} the payment granted.`
  const whole = moved.settledWhole
    ? [
        "A withdrawal refunded this payment's price, less any earlier refund (no consent on record): the credits the buyer used stay theirs, so no refund or dispute takes any back.",
      ]
    : moved.keptUsed > 0
      ? [
          `This purchase has no consent on record, or its purchase mail has not confirmed one yet, so refunds and disputes take back only credits still unused: ${moved.keptUsed} credit(s) the buyer used stay theirs.`,
        ]
      : []
  return [`Account: ${moved.userId}`, moving, ...whole, balanceLine(moved)]
}

/** The dispute's facts, with where to answer it. */
export function disputeLines(
  event: EventRef,
  charge: ChargeState | null,
  dispute: DisputeState,
): string[] {
  const of =
    charge === null
      ? ''
      : ` of a ${money(charge.amount, charge.currency)} payment`
  return [
    `Amount: ${money(dispute.amount, dispute.currency)}${of}`,
    `Reason: ${dispute.reason ?? 'not given'}`,
    `Status: ${dispute.status}`,
    `Evidence due: ${dueText(dispute.dueBy)}`,
    `Respond in Stripe: ${dashboardLink(event, dispute)}`,
  ]
}

/** Statuses a dispute ends in. */
const CLOSED = new Set(['won', 'lost', 'warning_closed', 'prevented'])

function openedSubject(dispute: DisputeState): string {
  const what = isInquiry(dispute) ? 'Inquiry' : 'Dispute'
  const amount = money(dispute.amount, dispute.currency)
  // Read late, after the bank already decided: its closing said the rest.
  if (CLOSED.has(dispute.status)) {
    return `${what} opened: ${amount}, closed since as ${dispute.status}`
  }
  const due =
    dispute.dueBy === null
      ? ''
      : `, evidence due ${formatDate(new Date(dispute.dueBy * 1000).toISOString())}`
  return `${what} opened: ${amount}${due}`
}

function openedIntro(dispute: DisputeState): string {
  return isInquiry(dispute)
    ? "A buyer's bank opened an inquiry on this payment. No money has moved yet; left unanswered, an inquiry can become a chargeback."
    : "A buyer's bank opened a dispute on this payment and took the disputed amount back from your Stripe balance."
}

function closedSubject(
  dispute: DisputeState,
  moved: CreditsMoved | null,
): string {
  const given =
    moved === null
      ? ''
      : moved.delta > 0
        ? `: gave back ${moved.delta} credit(s)`
        : ': no credits to give back'
  if (dispute.status === 'won') return `Dispute won${given}`
  if (dispute.status === 'warning_closed') return `Inquiry closed${given}`
  if (dispute.status === 'prevented') return `Dispute prevented${given}`
  const kept = moved === null ? '' : `, ${moved.held} credit(s) stay taken back`
  if (dispute.status === 'lost') {
    return `Dispute lost: ${money(dispute.amount, dispute.currency)} gone${kept}`
  }
  return `Dispute closed as ${dispute.status}${kept}`
}

function closedIntro(dispute: DisputeState): string {
  if (dispute.status === 'won') {
    return 'The bank decided the dispute in your favor: Stripe returns the disputed amount, and the account gets back the credits the dispute held.'
  }
  if (dispute.status === 'warning_closed') {
    return 'The inquiry closed without becoming a chargeback: no money moved, and an inquiry holds no credits.'
  }
  if (dispute.status === 'prevented') {
    return 'The dispute was stopped before it became a chargeback, so it holds no credits. If the buyer got the money back as a refund, the refund holds its share.'
  }
  return disputeHolds(dispute)
    ? 'The bank decided the dispute for the buyer. The money stays with them, and the credits stay taken back.'
    : 'The dispute closed.'
}

function disputeClosingHint(dispute: DisputeState): string[] {
  if (CLOSED.has(dispute.status)) return []
  return [
    '',
    isInquiry(dispute)
      ? 'No credits are taken back while it stays an inquiry. If it becomes a chargeback, they are taken back then.'
      : 'If you win, the credits come back by themselves. If you lose, they stay taken back.',
  ]
}

function refundSummary(charge: ChargeState): string {
  return `Refunded so far: ${money(charge.amountRefunded, charge.currency)} of a ${money(charge.amount, charge.currency)} payment.`
}

/** What a failed refund leaves taken that it cannot give back itself. */
function takenOtherwiseLines(moved: CreditsMoved): string[] {
  return moved.takenOtherwise > 0
    ? [
        `${moved.takenOtherwise} credit(s) of this payment were taken back by a withdrawal, not by the refund, and stay taken: refund that money again, or give the credits back by hand.`,
      ]
    : []
}

function refundEndedIntro(ended: 'failed' | 'canceled'): string {
  return ended === 'failed'
    ? 'A refund on this payment failed: the money came back to your Stripe balance, and the buyer has not received it. Pay them back another way, or refund the payment again.'
    : 'A refund on this payment was canceled before it reached the buyer: the money stayed in your Stripe balance.'
}

function refundEndedSubject(
  ended: 'failed' | 'canceled',
  moved: CreditsMoved | null,
): string {
  const given =
    moved === null
      ? ' (no credits on record)'
      : moved.delta > 0
        ? `: gave back ${moved.delta} credit(s)`
        : ': no credits to give back'
  return `Refund ${ended}${given}`
}

/**
 * The alert for a money-back event applied to a purchase's credits, or
 * null when it needs none: a refund event that moved nothing (the refund of
 * a withdrawal that took its credits itself, or a refund update that ended
 * nothing). Disputes, and refunds that failed or were canceled, always
 * alert.
 */
export function moneyBackAlert(
  event: EventRef,
  charge: ChargeState,
  moved: CreditsMoved,
  facts: MoneyBackFacts,
): BillingAlert | null {
  const dispute = facts.dispute
  if (event.type === 'charge.dispute.created' && dispute !== null) {
    return {
      subject: openedSubject(dispute),
      lines: [
        openedIntro(dispute),
        '',
        ...disputeLines(event, charge, dispute),
        '',
        ...creditLines(moved),
        ...disputeClosingHint(dispute),
        '',
        ...references(event, charge),
      ],
    }
  }
  // The money left the balance: news when it took credits, so an inquiry
  // that became a chargeback; a chargeback's opening said it already.
  if (event.type === 'charge.dispute.funds_withdrawn' && dispute !== null) {
    if (moved.delta === 0) return null
    return {
      subject: `Chargeback: ${money(dispute.amount, dispute.currency)} taken from your Stripe balance`,
      lines: [
        "The buyer's bank turned this payment's inquiry into a chargeback and took the disputed amount back from your Stripe balance.",
        '',
        ...disputeLines(event, charge, dispute),
        '',
        ...creditLines(moved),
        ...disputeClosingHint(dispute),
        '',
        ...references(event, charge),
      ],
    }
  }
  if (event.type === 'charge.dispute.closed' && dispute !== null) {
    return {
      subject: closedSubject(dispute, moved),
      lines: [
        closedIntro(dispute),
        '',
        ...disputeLines(event, charge, dispute),
        '',
        ...creditLines(moved),
        '',
        ...references(event, charge),
      ],
    }
  }
  if (facts.refundEnded !== null) {
    return {
      subject: refundEndedSubject(facts.refundEnded, moved),
      lines: [
        refundEndedIntro(facts.refundEnded),
        refundSummary(charge),
        '',
        ...creditLines(moved),
        ...takenOtherwiseLines(moved),
        '',
        ...references(event, charge),
      ],
    }
  }
  if (moved.delta === 0) return null
  return {
    subject: `Refund: took back ${-moved.delta} credit(s)`,
    lines: [
      refundSummary(charge),
      `The payment granted ${moved.granted} credit(s), its pack and any launch bonus.`,
      '',
      ...creditLines(moved),
      '',
      ...references(event, charge),
    ],
  }
}

/** Who a payment with no credits on record belonged to, when it was a
 *  donation: its audit row names the account. */
export interface DonationOnRecord {
  userId: string
}

function nothingOnRecordLines(
  donation: DonationOnRecord | null,
  moved: 'taken' | 'given',
): string[] {
  return donation === null
    ? [
        `No credits on record name this payment, so none were ${moved} back.`,
        'It is a purchase from before PaymentIntent ids were stored (migration',
        '0058), or one whose webhook has not arrived yet. If it arrives later,',
        'any credits still due are taken back then, with another alert.',
      ]
    : [
        `This payment was a donation from account ${donation.userId}, so no credits`,
        'were taken back. Its supporter badge stays: remove it by hand if it',
        'should go.',
      ]
}

/** The alert for a money-back event whose payment granted no credits we
 *  know of: a donation, an old purchase, or one still on its way. */
export function nothingOnRecordAlert(
  event: EventRef,
  charge: ChargeState,
  donation: DonationOnRecord | null,
  facts: MoneyBackFacts,
): BillingAlert {
  const dispute = facts.dispute
  const isDispute = event.type.startsWith('charge.dispute.') && dispute !== null
  const subject = isDispute
    ? event.type === 'charge.dispute.created'
      ? openedSubject(dispute)
      : closedSubject(dispute, null)
    : facts.refundEnded !== null
      ? refundEndedSubject(facts.refundEnded, null)
      : 'Refund with no credits on record'
  return {
    subject,
    lines: [
      ...(isDispute
        ? [
            event.type === 'charge.dispute.created'
              ? openedIntro(dispute)
              : closedIntro(dispute),
            '',
            ...disputeLines(event, charge, dispute),
          ]
        : [
            ...(facts.refundEnded === null
              ? []
              : [refundEndedIntro(facts.refundEnded)]),
            refundSummary(charge),
          ]),
      '',
      ...nothingOnRecordLines(
        donation,
        facts.refundEnded === null ? 'taken' : 'given',
      ),
      '',
      ...references(event, charge),
    ],
  }
}

/** The alert for a money-back event acknowledged without changing any
 *  credits, because it never can: no charge on it, or none Stripe knows. */
export function notAppliedAlert(
  event: EventRef,
  why: string,
  dispute: DisputeState | null,
): BillingAlert {
  const what =
    event.type === 'refund.failed'
      ? 'Failed refund'
      : event.type === 'refund.updated'
        ? 'Refund update'
        : event.type.startsWith('charge.dispute.')
          ? 'Dispute'
          : 'Refund'
  return {
    subject: `${what} that could not be applied`,
    lines: [
      `Stripe event ${event.id} (${event.type}) was acknowledged, and changed`,
      `no credits: ${why}. Check the payment in the Stripe Dashboard, and`,
      'change the credits by hand if they should move.',
      ...(dispute === null ? [] : ['', ...disputeLines(event, null, dispute)]),
    ],
  }
}

/** The alert for a purchase that landed after its own refund or dispute,
 *  and gave the credits back at once. */
export function earlyMoneyBackAlert(
  purchaseEventId: string,
  charge: ChargeState,
  moved: CreditsMoved,
): BillingAlert {
  const what = anyDisputeHolds(charge) ? 'Dispute' : 'Refund'
  return {
    subject: `${what} before its purchase: took back ${-moved.delta} credit(s)`,
    lines: [
      `A ${what.toLowerCase()} on this payment reached us before its purchase`,
      'did. The purchase has landed now, and its credits were taken back to',
      'match the money that went back.',
      refundSummary(charge),
      ...charge.disputes.map(
        (dispute) => `Dispute ${dispute.id}: ${dispute.status}`,
      ),
      '',
      ...creditLines(moved),
      '',
      `Purchase event: ${purchaseEventId}`,
      `Charge: ${charge.chargeId}`,
      `PaymentIntent: ${charge.paymentIntentId ?? 'none'}`,
    ],
  }
}
