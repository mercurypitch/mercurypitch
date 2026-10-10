# EARS Specification — Stripe refunds, disputes and the reconciliation sweep

> **EARS** = Easy Approach to Requirements Syntax
> Version: 1.1 | Date: 2026-10-10 | Scope: what a refund, a failed refund and
> a dispute do to the credits a Stripe payment granted; the webhook's answers;
> the sweep that applies what the webhook missed; the owner's alerts; what a
> withdrawal reads of the money.

**Source:** `workers/db-worker/src/stripe-payments.ts`,
`workers/db-worker/src/stripe-events.ts`,
`workers/db-worker/src/stripe-charge.ts`, `workers/db-worker/src/stripe-sweep.ts`,
`workers/db-worker/src/stripe-alerts.ts`, `workers/db-worker/src/purchase-record.ts`,
`workers/db-worker/src/billing.ts`
(`applyStripeEvent`, `handleWebhook`, `reconcileBilling`),
`workers/db-worker/src/withdrawal-rules.ts`, `workers/db-worker/src/withdrawal.ts`,
`workers/db-worker/src/withdrawal-finish.ts`,
`workers/db-worker/src/withdrawal-refund.ts`,
`workers/db-worker/src/withdrawal-refund-failed.ts`,
`workers/db-worker/src/chargeback-alert.ts`,
`workers/db-worker/src/email.ts` (`maskEmail`, `maskAddresses`),
`workers/db-worker/src/auth.ts` (`handleGoogleCallback`),
`workers/db-worker/migrations/0064_stripe_charges.sql`,
`workers/db-worker/migrations/0065_reapply_money_back_events.sql`,
`workers/db-worker/migrations/0067_chargeback_alerts.sql`,
`workers/db-worker/migrations/0068_withdrawal_refund_failure_claims.sql` and
`workers/db-worker/migrations/0069_chargeback_alert_claims.sql`.

**Tests:** `workers/db-worker/node-tests/stripe-money-back-integration.test.ts`,
`workers/db-worker/node-tests/stripe-webhook-hygiene-integration.test.ts`,
`workers/db-worker/node-tests/stripe-sweep-integration.test.ts`,
`workers/db-worker/node-tests/withdrawal-integration.test.ts`,
`workers/db-worker/node-tests/google-return-nonce-integration.test.ts`,
`workers/db-worker/src/stripe-payments.test.ts`,
`workers/db-worker/src/stripe-events.test.ts`,
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
is `disputed` or the event is a dispute's (`charge.dispute.created`,
`charge.dispute.funds_withdrawn`, `charge.dispute.closed`), each with its
status, amount and whether Stripe still lets the payment be refunded
(`is_charge_refundable`). A dispute event whose dispute Stripe's list lacks
shall keep the event's copy of it. **When** a refund or
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
refund that fails or is canceled writes no row: it goes to its statement
(REQ-MB-028).

## 3. What money going back does to the credits

### REQ-MB-020 — Proportional take-back

Refunds and disputes of a payment shall hold `floor(granted × gone / paid)` of
its credits between them, counted in whole cents, where `granted` is the pack
and any launch bonus, and `gone` is the sum of the refunds that did not fail
or get canceled (any other status counts as gone) plus what each open or lost
dispute holds (all of its disputed amount; all of the payment when the
currencies differ), never more than the payment.

### REQ-MB-021 — Chargebacks hold at once; inquiries hold nothing

**When** a chargeback opens (`charge.dispute.created`), or the money leaves
the balance for a dispute (`charge.dispute.funds_withdrawn`, which is how an
inquiry that became a chargeback arrives), the worker shall take back its
share at once and alert the owner with the amount, the reason, the evidence
deadline and a link to answer it. **When** an inquiry opens
(`warning_needs_response`, `warning_under_review`), the worker shall take
nothing, since no money moves unless it becomes a chargeback and Stripe still
lets the payment be refunded, and shall still alert the owner.
`charge.dispute.funds_withdrawn` shall alert whenever the owner was not told
of that dispute's chargeback before: it opened as an inquiry, or its opening
is not on record. That holds whether or not credits moved, and whether or
not any credits are on record for the payment (REQ-MB-026). Of a
chargeback's opening and the money leaving, whichever tells the owner first
says all the other would, the evidence deadline included, so the other shall
send no second alert, in either order, unless its own ledger row moved
credits after the first one's row, which that alert cannot show (a purchase
mail that confirmed the box in between). The worker shall record each
dispute whose chargeback the
owner was told of (`chargebackAlerts`, migration 0067), so the alert goes
once, and shall record it only once Resend has taken that alert. **While**
the alert does not go, the webhook shall answer 500 and leave the event
unrecorded, so Stripe delivers it again, and a delivery that finds the
ledger moved already by an earlier delivery of the event shall still send
it. Stripe sends `charge.dispute.created` and
`charge.dispute.funds_withdrawn` at once for a dispute that opens as a
chargeback, and may deliver either twice, so a delivery shall claim the
dispute before it alerts (`chargebackAlertClaims`, migration 0069), and only
the delivery that claimed it shall alert. Another event about the same
dispute shall leave the alert to the claim and answer 200; the same event,
while its twin holds the claim, shall answer 500. A claim shall go back when
its alert does not go, and one older than 10 minutes belongs to a delivery
that died and shall be taken over. An alert the sweep holds for its
migration 0065 summary (REQ-MB-032) counts as sent once it is held.

### REQ-MB-022 — Closing

**When** a dispute is won, an inquiry closes without a chargeback
(`warning_closed`), or a dispute is `prevented` before it becomes one, the
worker shall give back what the dispute held (an inquiry held nothing), to
the pack it was taken from (REQ-MB-051). **When** a dispute is lost, the
credits shall stay taken back. A status Stripe adds later shall hold. Every
closing shall alert the owner.

### REQ-MB-023 — Failed refunds

**When** a refund fails (`refund.failed`, or `refund.updated` to `failed`) or
is canceled (`refund.updated` to `canceled`), the worker shall give back what
it took, to the pack it was taken from (REQ-MB-051), and alert the owner that the buyer did not get the money, unless the
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
failure is reported once, by `refund.failed`. A `charge.dispute.created`
read as a chargeback, and a `charge.dispute.funds_withdrawn`, alert as
REQ-MB-021 says.

### REQ-MB-027 — A whole-price withdrawal settles the payment

**When** a withdrawal of the payment refunds its price, less any earlier
refund (`withdrawals.refundBasis = 'full'`: a purchase with no consent on
record, CRD Art. 14(4)(b); REQ-MB-052), the worker shall count the
withdrawal's own rows as taken back already (REQ-MB-025), and shall cap what
refunds and disputes hold as for a purchase with no consent on record
(REQ-MB-029), even once a late purchase mail confirms the box: at most what
they hold already plus the pack's credits still unused. So the buyer never
owes for credits they used, and what an earlier refund or dispute took for
money still gone stays taken: an event that may give credits back gives
back only what the money no longer holds. The worker shall look for that
withdrawal again after every read of the ledger, so one that lands between
the read and the write is counted. The alert shall say that refunds and
disputes take back only credits still unused, and how many used credits
stay with the buyer.

### REQ-MB-028 — A withdrawal's own refund that fails

**When** a refund tagged `metadata.withdrawalId` (withdrawal-refund.ts) fails
or is canceled, even after Stripe reported it succeeded, `refund.failed` and
`refund.updated` shall write no ledger row and give no credits back: the
withdrawal took them. The webhook shall hand the refund to its statement
(`markWithdrawalRefundFailed`, withdrawal-refund-failed.ts), which marks the
refund failed and tells the owner to refund by hand, once per statement and
status. The alert shall say the refund failed after it went through only
when the statement records that Stripe had reported it succeeded; a refund
still pending, and one whose statement is gone, it shall report as failed.
**While** the owner's alert does not go, the webhook shall answer 500 and
leave the event unrecorded, so Stripe delivers it again. Stripe sends
`refund.failed` and `refund.updated` for a failure at once, and may deliver
either twice, so a delivery shall claim the statement with a conditional
UPDATE before it alerts (`refundFailureClaimedAt`, `refundFailureClaimedBy`,
migration 0068), and only the delivery that claimed it shall alert. Another
event about the same failure shall leave the owner to the claim and answer
200; the same event, while its twin holds the claim, shall answer 500. A
claim shall go back when its alert does not go, and one older than 10
minutes belongs to a delivery that died and shall be taken over.

### REQ-MB-029 — A purchase with no consent on record

**When** money goes back on a payment whose purchase has no consent on
record, by a refund of any size or a dispute, refunds and disputes shall
hold at most what they hold already plus the credits its pack still has
unused, paid and bonus, as a withdrawal of it counts them (`packUses`,
withdrawal-rules.ts, after their own earlier takes), and never the credits
the buyer used. A purchase counts as having no consent on record as the
withdrawal counts it (`consentTerms` is `no_consent`, checkout-consent.ts):
no ticked box, or a ticked box its purchase mail has not confirmed yet (CRD
Art. 14(4)(b)(iii)). A buyer who cancels by mail and is refunded in the
Dashboard loses what a withdrawal through Settings would take, and no
earlier take leaves them owing. A purchase with a confirmed consent shall
take its share as in REQ-MB-020. Every event shall ask afresh, so once the
purchase mail goes, a later refund or dispute follows the ticked box and
can take the used credits an earlier one left with the buyer. The alert
shall say how many used credits stay with the buyer.

## 4. The sweep

### REQ-MB-030 — What it lists

Every six hours the sweep shall list, from Stripe's Events API, every event
type the webhook handles, created from 30 days ago to ten minutes ago, and
apply each one not yet recorded, oldest first. It shall ask billingEvents
about a whole page of events (100) in one query, and apply at most
`SWEEP_MONEY_BACK_PER_RUN` (25) refund and dispute events in one run,
leaving the rest for the next run and logging that it did, so a run stays
within D1's 1,000 queries per Worker invocation. Purchases are not capped.

### REQ-MB-031 — What it reports

**When** the sweep applied an event, it shall alert the owner that the webhook
missed it. **When** an event fails, the sweep shall go on with the rest, leave
it for the next run, and alert. **When** Stripe will not list the events (two
attempts per page), or the list stops at the page cap, the sweep shall alert
that it failed. An event migration 0065 reopened (REQ-MB-032) is not a
missed delivery: it shall be left out of that alert.

### REQ-MB-032 — Events an older worker skipped

Migration 0065 shall reopen the refund and dispute events an older worker
recorded without applying (`charge.refunded`, `refund.failed`,
`refund.updated`, `charge.dispute.created`, `charge.dispute.closed`) by
giving each the type `reopened:<type>`, so the first sweep after the deploy
applies those Stripe still lists. The webhook and the sweep shall take a
reopened event as not recorded, and recording it shall give it its own type
back. The sweep shall apply reopened events without an alert each and send
one summary instead, "Reapplied N event(s) after migration 0065", listing
each event with the alert it would have sent. An event that fails shall
still alert as in REQ-MB-031. Checkout events shall be left recorded, and
so shall `charge.dispute.funds_withdrawn`, which no older worker handled:
each reopened event reads the disputes Stripe reports now (REQ-MB-012), so
an inquiry that became a chargeback before the deploy is taken back when
its own `charge.dispute.created` is applied.

## 5. What a withdrawal reads of the money

### REQ-MB-050 — Settled follows the money

A pack shall count as settled, and offer no withdrawal, while Stripe holds
its money back: a chargeback open (`needs_response`, `under_review`) or
lost, or refunds that returned the whole amount of its charge; and once it
has been withdrawn. A won dispute, an inquiry, a `prevented` dispute, or a
refund that failed or was canceled shall leave it open, and a partial refund
shall never settle it. The list in Settings › Credits shall read what Stripe
last said of each payment (`stripeCharges`) and ask Stripe nothing, in one
query that binds the account's PaymentIntent ids as one JSON value, so an
account with more packs than D1's 100 bound values a query still gets its
list.

### REQ-MB-051 — Credits given back return to their pack

**When** a won dispute or a refund that ended gives credits back, they shall
return to the pools of the pack they were taken from, paid and bonus, so the
pack can be withdrawn again for what it holds.

### REQ-MB-052 — Never past what the charge holds

A withdrawal shall refund, for a purchase with no consent on record, what
its charge still holds (its amount less the refunds that did not fail or get
canceled), never more than the price; for any other, the unused paid
credits' share of the price, never more than the charge still holds. A pack
whose payment has refund or dispute rows but no kept Stripe state shall be
listed with no amount. The app and the owner's alerts shall call a refund
for a purchase with no consent on record the whole price only when it
equals the price: below it, it is what an earlier refund left of the price,
and with no amount known, the price less any earlier refund.

### REQ-MB-053 — Read afresh before promising, and before refunding

**When** a statement is made, the worker shall read Stripe (the
PaymentIntent, its charge, the refunds and disputes on it) before promising
an amount, and refuse a pack whose money Stripe holds back. It shall read
again on every attempt of the statement's write, since an attempt after the
first runs because a ledger write landed, most often a refund's or a
dispute's take, and the first refund attempt shall work from the read of the
attempt whose write won. **While** Stripe does not answer, the statement
shall stand with its price pending and promise no amount. Before every
refund request the worker shall read Stripe again and lower the refund to
what the charge holds, keep the lower amount on the statement, and tell the
owner both amounts; the buyer is not mailed again.

### REQ-MB-054 — Never refund a payment charged back

The worker shall never ask Stripe to refund a payment a chargeback holds, or
one a dispute says cannot be refunded (`is_charge_refundable` false). The
refund shall become the owner's to settle by hand, with an alert.

## 6. Logs and alerts

### REQ-MB-040 — No personal data

Logs and alerts on these paths shall carry Stripe ids, account ids and
amounts, and never an email address, a card's details or a secret. An email
address a log line must name shall be masked (`maskEmail`). What a provider
answers when it refuses a request (Resend refusing a mail, Google refusing a
sign-in code) shall be logged with every address in it masked
(`maskAddresses`). Letters, marks and digits in any script
(`josé@exämple.com`), every other character RFC 5322 allows in a local part
(`mary.o'brien@example.com` logs as `m***@***.com`), a quoted local part and
an address literal (`user@[192.0.2.1]` logs as `u***@***`) are masked whole:
no character of a local part after its first shows. Punctuation a local part
may hold is masked with the address when it touches it
(`'jane@example.com'` logs as `'***@***.com'`). An unquoted local part shall
be read for at most 64 characters, all RFC 5321 allows, so that masking a
long run with no @ in it (50 KB of base64 in an error text) takes time
linear in its length; a longer local part, which no mail server takes, shows
what comes before its last 64 characters.
