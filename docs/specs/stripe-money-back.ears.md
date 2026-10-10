# EARS Specification — Stripe refunds, disputes and the reconciliation sweep

> **EARS** = Easy Approach to Requirements Syntax
> Version: 1.0 | Date: 2026-10-09 | Scope: what a refund, a failed refund and
> a dispute do to the credits a Stripe payment granted; the webhook's answers;
> the sweep that applies what the webhook missed; the owner's alerts.

**Source:** `workers/db-worker/src/stripe-payments.ts`,
`workers/db-worker/src/stripe-charge.ts`, `workers/db-worker/src/stripe-sweep.ts`,
`workers/db-worker/src/stripe-alerts.ts`, `workers/db-worker/src/purchase-record.ts`,
`workers/db-worker/src/billing.ts`
(`applyStripeEvent`, `handleWebhook`, `reconcileBilling`),
`workers/db-worker/migrations/0064_stripe_charges.sql` and
`workers/db-worker/migrations/0065_reapply_money_back_events.sql`.

**Tests:** `workers/db-worker/node-tests/stripe-money-back-integration.test.ts`,
`workers/db-worker/node-tests/stripe-webhook-hygiene-integration.test.ts`,
`workers/db-worker/node-tests/stripe-sweep-integration.test.ts`,
`workers/db-worker/node-tests/withdrawal-integration.test.ts`,
`workers/db-worker/src/stripe-payments.test.ts`,
`workers/db-worker/src/stripe-charge.test.ts`,
`workers/db-worker/src/stripe-sweep.test.ts`,
`workers/db-worker/src/stripe-alerts.test.ts`,
`workers/db-worker/src/withdrawal-rules.test.ts` and
`workers/db-worker/src/email.test.ts`.

---

## 1. The webhook's answers

### REQ-MB-001 — Signature first

**When** a request reaches `POST /api/billing/webhook`, the worker shall verify
its `Stripe-Signature` (HMAC-SHA256 over `t.payload`, compared in constant
time, any `v1` of the header) before parsing the body, and shall answer 400 to
a signature that does not verify or whose timestamp is more than five minutes
from now. **While** `STRIPE_WEBHOOK_SECRET` is unset, it shall answer 503.

### REQ-MB-002 — Final answers end the retries

**When** a signed body cannot be parsed, has no event id, or carries an event
type the worker does not handle, the worker shall answer 200 with
`{ received: true, ignored: <why> }` without touching D1. **When** a refund or
dispute names a charge Stripe answers 404 for, or names no charge, the worker
shall record the event, alert the owner and answer 200.

### REQ-MB-003 — Transient failures are retried

**When** D1 fails, Stripe cannot say what a charge is (any non-2xx other than
404 for the charge, any non-2xx for its refunds or disputes, or no answer),
or the ledger keeps changing under a write, the worker shall answer 500 with
no detail of the error and leave the event unrecorded, so Stripe delivers it
again.

## 2. One code path, exactly once

### REQ-MB-010 — Webhook and sweep share the handler

The webhook and the sweep shall apply an event through the same function,
`applyStripeEvent`, which skips an event `billingEvents` has recorded and
records an event only after it is applied.

### REQ-MB-011 — Exactly once

**When** the same event arrives more than once, from Stripe, from the sweep,
or from both at the same moment, its effect on the ledger shall be one row
keyed `clawback:<event id>`, and its alert shall be sent once. **When** a
refund fails or is canceled, its `refund.failed` and its `refund.updated`
shall share one row keyed `clawback:refund-ended:<refund id>`, and one
alert. **When** a `refund.updated` that ends nothing moves no credits (a
trace number arriving, say), the worker shall still write its row, moving
nothing, and send no alert (REQ-MB-013).

### REQ-MB-012 — Any order

Every refund and dispute event shall be applied from what Stripe reports,
read after the ledger on every attempt of its write, never from the copy in
the event, so events read late or out of order land on the same balance: the
charge (`GET /v1/charges/:id`), its
refunds (`GET /v1/refunds?charge=`) when the charge or the event says there
is one, and its disputes (`GET /v1/disputes?charge=`) when the charge says it
is `disputed` or the event is a dispute's. A dispute event whose dispute
Stripe's list lacks shall keep the event's copy of it. **When** a refund or
dispute arrives before the purchase it is about, the worker shall leave word
of it (`stripeCharges`, never replacing what is kept there), and the purchase
shall read Stripe again and take back what is due when it lands.

### REQ-MB-013 — The newest read decides

Each attempt to write an event's row shall read the ledger, then Stripe, then
the consent and withdrawal terms, and write under the ledger's version
check, so a row never lands on a ledger another event wrote after this one
read Stripe. Every refund and dispute event applied to a purchase on record
shall write its row, moving nothing when nothing is due, so a write that
holds an older read of Stripe always loses and reads again. What Stripe said
(`stripeCharges`) shall be kept with the row, in the same batch and under the
same check, so an older read never replaces a newer one. A withdrawal's own
refund that fails or is canceled writes no row (REQ-MB-028): it reads
nothing and decides nothing.

## 3. What money going back does to the credits

### REQ-MB-020 — Proportional take-back

Refunds and disputes of a payment shall hold `floor(granted × gone / paid)` of
its credits between them, counted in whole cents, where `granted` is the pack
and any launch bonus, and `gone` is the sum of the refunds that did not fail
or get canceled (any other status counts as gone) plus what each open or lost
dispute holds (all of its disputed amount; all of the payment when the
currencies differ), never more than the payment.

### REQ-MB-021 — Disputes hold at once

**When** a dispute or an inquiry opens, the worker shall take back its share
at once and alert the owner with the amount, the reason, the evidence deadline
and a link to answer it.

### REQ-MB-022 — Closing

**When** a dispute is won, an inquiry closes without a chargeback
(`warning_closed`), or a dispute is `prevented` before it becomes one, the
worker shall give back what the dispute held. **When** a dispute is lost, the
credits shall stay taken back. A status Stripe adds later shall hold. Every
closing shall alert the owner.

### REQ-MB-023 — Failed refunds

**When** a refund fails (`refund.failed`, or `refund.updated` to `failed`) or
is canceled (`refund.updated` to `canceled`), the worker shall give back what
it took and alert the owner that the buyer did not get the money, unless the
refund is a withdrawal's own (REQ-MB-028). Only a dispute closing or a
refund ending shall ever give credits back. The deprecated
`charge.refund.updated` is not handled.

### REQ-MB-024 — Spent credits are owed

**When** the credits to take back are already spent, the worker shall take
them anyway: the balance goes below zero, the debit's `SUM(delta) >= cost`
check blocks spending, and the alert says how many were already spent. The
exceptions are a payment a withdrawal refunded whole (REQ-MB-027) and any
purchase with no consent on record (REQ-MB-029): the credits the buyer used
there stay theirs.

### REQ-MB-025 — Withdrawals count as taken

`withdrawal` and `withdrawal-bonus` rows whose jobRef is the PaymentIntent
shall count as credits already taken back from that payment, so the
withdrawal's own `charge.refunded`, or a hand refund for a withdrawal Stripe
refused, takes nothing a second time.

### REQ-MB-026 — Nothing on record

**When** no credits on record name the payment, the worker shall take nothing
and alert the owner, naming the donor when the payment was a donation. Of
the `refund.updated` events, only a cancellation shall send that alert: a
failure is reported once, by `refund.failed`.

### REQ-MB-027 — A whole-price withdrawal settles the payment

**When** a withdrawal of the payment refunds its whole price
(`withdrawals.refundBasis = 'full'`: a purchase with no consent on record,
CRD Art. 14(4)(b)), the worker shall count everything the payment granted as
taken back already, so no refund or dispute of it takes any more credits and
the buyer never owes for credits they used. The worker shall look for that
withdrawal again after every read of the ledger, so one that lands between
the read and the write is counted. The alert shall say why nothing was
taken.

### REQ-MB-028 — A withdrawal's own refund that fails

**When** a refund tagged `metadata.withdrawalId` (withdrawal-refund.ts) fails
or is canceled, `refund.failed` and `refund.updated` shall write no ledger
row and send no alert: the withdrawal sweep follows that refund, marks the
statement failed and alerts the owner (withdrawal-finish.ts). The webhook
shall acknowledge both events.

### REQ-MB-029 — A purchase with no consent on record

**When** money goes back on a payment whose purchase has no consent on
record (`purchaseTerms` is `no_consent`, checkout-consent.ts), by a refund of
any size, a dispute or an inquiry, refunds and disputes shall hold at most
what they hold already plus the credits its pack still has unused, paid and
bonus, as a withdrawal of it counts them (`packUses`, withdrawal-rules.ts,
after their own earlier takes), and never the credits the buyer used. A buyer
who cancels by mail and is refunded in the Dashboard loses what a withdrawal
through Settings would take, and no earlier take leaves them owing. A
purchase with a consent on record shall take its share as in REQ-MB-020.
Every event shall ask whether the purchase has a consent on record, and the
alert shall say how many used credits stay with the buyer.

## 4. The sweep

### REQ-MB-030 — What it lists

Every six hours the sweep shall list, from Stripe's Events API, every event
type the webhook handles, created from 30 days ago to ten minutes ago, and
apply each one not yet recorded, oldest first.

### REQ-MB-031 — What it reports

**When** the sweep applied an event, it shall alert the owner that the webhook
missed it. **When** an event fails, the sweep shall go on with the rest, leave
it for the next run, and alert. **When** Stripe will not list the events (two
attempts per page), or the list stops at the page cap, the sweep shall alert
that it failed.

### REQ-MB-032 — Events an older worker skipped

Migration 0065 shall forget the refund and dispute events an older worker
recorded without applying (`charge.refunded`, `refund.failed`,
`refund.updated`, `charge.dispute.created`, `charge.dispute.closed`), so the
first sweep after the deploy applies those Stripe still lists. Checkout
events shall be left recorded.

## 5. Logs and alerts

### REQ-MB-040 — No personal data

Logs and alerts on these paths shall carry Stripe ids, account ids and
amounts, and never an email address, a card's details or a secret. An email
address a log line must name shall be masked (`maskEmail`).
