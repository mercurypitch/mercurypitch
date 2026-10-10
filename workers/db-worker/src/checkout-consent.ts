// ============================================================
// checkout-consent — the withdrawal checkbox, asked at checkout, kept at grant
// ============================================================
//
// A pack's Checkout Session carries a required checkbox (Stripe's terms of
// service consent) in which the buyer asks for the credits straight away and
// accepts what that does to the 14-day right to cancel, in the words of
// WITHDRAWAL_MODE (withdrawal-wording.ts). Donations never carry it.
//
// When the paid session comes back (billing.ts, grantCheckoutCredits), this
// writes what Stripe reports of the box to checkoutConsents (migration
// 0060), with the mode and wording version the session was opened with and
// the price paid, then sends the purchase mail that confirms it (CRD
// Art. 8(7)) and records whether that mail went. Every delivery of the
// event does both, so a delivery cut off after the credits landed loses
// neither: the row is written once per session, and the mail goes only
// while it has not. A row that cannot be written throws, so the webhook
// answers 500 and Stripe delivers the event again. The 6-hourly sweep
// (withdrawal.ts, sweepWithdrawals) sends a mail that did not go again, the
// longest untried first, for as long as Resend's answer leaves it unknown
// and the pack can be cancelled (mail-answer.ts), and tells the owner once
// if it has still not gone after 3 days. A mail Resend refuses for good
// (its recipient or its content, never our key, domain or quota) is never
// sent again: the owner is told to send it by hand, and it counts as given
// up only once Resend has taken that alert.
//
// The row is also what the purchase keeps of its terms (purchaseTerms): a
// pack's right to cancel follows the box its buyer ticked, whatever
// WITHDRAWAL_MODE says later, and a pack with no ticked box on record keeps
// the whole right (withdrawal-rules.ts). The box counts only once the
// purchase mail confirmed it (consentTerms): until then the buyer keeps the
// whole right too.
//
// A paid pack without the box (a session opened before this shipped), a
// mail that did not go, and a record that could not be written each alert
// the owner (BILLING_ALERT_EMAIL). None of it ever undoes the credits: they
// landed first.
//
// Stripe refuses to open a session that asks for the box until the account
// has a Terms of service URL (Dashboard › Settings › Public details), in
// test mode and live mode alike.

import type { Env } from './auth'
import { fallbackAppOrigin } from './auth'
import { sendBillingAlert } from './email'
import { sendPurchaseMail } from './email-purchase'
import type { MailAnswer } from './mail-answer'
import { GAVE_UP, mailAnswer, mayHaveGone, REFUSED, statusAfter, WARN_AFTER_MS, } from './mail-answer'
import { paymentIntentOf } from './stripe-payments'
import { DEFAULT_GRACE_WEEKDAYS, withdrawalOpen } from './withdrawal-rules'
import type { PurchaseTerms, TraderDetails, WithdrawalMode, } from './withdrawal-wording'
import { CHECKOUT_CHECKBOX, CHECKOUT_SUBMIT_LINE, isKnownWithdrawalMode, parseWithdrawalMode, WITHDRAWAL_TEXT_VERSION, } from './withdrawal-wording'

/** The launch offer's bonus rows (launch-finisher.ts, OFFER_BONUS). */
const PACK_BONUS = 'offer-bonus'

/** The withdrawal model this environment sells new packs under
 *  (WITHDRAWAL_MODE). A purchase keeps its own (purchaseTerms). */
export function withdrawalMode(env: Env): WithdrawalMode {
  if (!isKnownWithdrawalMode(env.WITHDRAWAL_MODE)) {
    console.warn(
      `[billing] WITHDRAWAL_MODE "${String(env.WITHDRAWAL_MODE)}" is not refund_unused or waiver: using refund_unused`,
    )
  }
  return parseWithdrawalMode(env.WITHDRAWAL_MODE)
}

/** Weekdays the withdrawal function stays open past the 14th day
 *  (WITHDRAWAL_GRACE_WEEKDAYS, withdrawal-rules.ts). Unset is the default;
 *  anything but a whole number from 0 to 20 is the default too, logged. */
export function withdrawalGraceWeekdays(env: Env): number {
  const raw = (env.WITHDRAWAL_GRACE_WEEKDAYS ?? '').trim()
  if (raw === '') return DEFAULT_GRACE_WEEKDAYS
  const days = Number(raw)
  if (Number.isInteger(days) && days >= 0 && days <= 20) return days
  console.warn(
    `[billing] WITHDRAWAL_GRACE_WEEKDAYS "${raw}" is not a whole number from 0 to 20: using ${DEFAULT_GRACE_WEEKDAYS}`,
  )
  return DEFAULT_GRACE_WEEKDAYS
}

/** Shown in place of a trader detail the owner has not set yet. */
const TRADER_PLACEHOLDERS = {
  name: '[TRADER_NAME]',
  address: '[TRADER_ADDRESS]',
  email: '[TRADER_EMAIL]',
} as const

/**
 * Who sells the credits, from the TRADER_* vars. An unset name, address or
 * email shows as its own name in brackets, and the log says which; a
 * production deploy refuses to go out without a name and an address
 * (scripts/assert-prod-trader-details.mjs). The VAT ID is optional: a sole
 * trader outside the VAT system has none, and the mails leave it out.
 */
export function traderDetails(env: Env): TraderDetails {
  const unset: string[] = []
  const read = (
    value: string | undefined,
    key: keyof typeof TRADER_PLACEHOLDERS,
  ): string => {
    const set = (value ?? '').trim()
    if (set !== '') return set
    unset.push(TRADER_PLACEHOLDERS[key].slice(1, -1))
    return TRADER_PLACEHOLDERS[key]
  }
  const trader: TraderDetails = {
    name: read(env.TRADER_NAME, 'name'),
    address: read(env.TRADER_ADDRESS, 'address'),
    email: read(env.TRADER_EMAIL, 'email'),
    vatId: (env.TRADER_VAT_ID ?? '').trim(),
  }
  if (unset.length > 0) {
    console.warn(`[billing] trader details not set: ${unset.join(', ')}`)
  }
  return trader
}

/** What a purchase's buyer agreed to, from its consent row: the mode the
 *  box they ticked was worded in. No row, or no ticked box on it, is
 *  no_consent. */
export function purchaseTerms(
  consent:
    | { mode: string | null; termsOfService: string | null }
    | null
    | undefined,
): PurchaseTerms {
  if (
    consent == null ||
    consent.termsOfService !== 'accepted' ||
    consent.mode === null
  ) {
    return 'no_consent'
  }
  return parseWithdrawalMode(consent.mode)
}

/**
 * The terms a purchase's withdrawal follows now: the box its buyer ticked
 * (purchaseTerms) once the purchase mail has confirmed it, else
 * no_consent. The exception that ends or limits the right to cancel holds
 * only once that confirmation has reached the buyer (CRD Art. 16(m) and
 * 8(7)); until then they bear no cost for what they used (Art.
 * 14(4)(b)(iii)), so the whole price comes back. The ticked box counts
 * again the moment the mail goes.
 */
export function consentTerms(
  consent:
    | {
        mode: string | null
        termsOfService: string | null
        mailStatus: string | null
      }
    | null
    | undefined,
): PurchaseTerms {
  if (consent == null || consent.mailStatus !== 'sent') return 'no_consent'
  return purchaseTerms(consent)
}

/**
 * The Checkout Session parameters that ask a pack's buyer for the consent,
 * and nothing for anything else. `offerLine` is the launch offer's line
 * above the pay button (launch-finisher.ts), kept after ours.
 */
export function consentCheckoutParams(
  env: Env,
  planKind: string,
  offerLine?: string,
): Record<string, string> {
  if (planKind !== 'pack') return {}
  const mode = withdrawalMode(env)
  return {
    'consent_collection[terms_of_service]': 'required',
    'custom_text[terms_of_service_acceptance][message]':
      CHECKOUT_CHECKBOX[mode],
    'custom_text[submit][message]': [CHECKOUT_SUBMIT_LINE, offerLine]
      .filter((line) => line !== undefined && line !== '')
      .join(' '),
    'metadata[withdrawalMode]': mode,
    'metadata[withdrawalText]': WITHDRAWAL_TEXT_VERSION,
  }
}

/** What was paid: the session's own total and currency, which already
 *  carry any Stripe discount, else the plan's list price. A paid session in
 *  payment mode always carries its total. */
export function paidPrice(
  session: Record<string, unknown>,
  plan: { amountMinor: number | null; currency: string | null } | null,
): { amountMinor: number; currency: string } {
  const total =
    typeof session.amount_total === 'number' ? session.amount_total : null
  const currency =
    typeof session.currency === 'string' && session.currency !== ''
      ? session.currency
      : null
  return total !== null
    ? { amountMinor: total, currency: currency ?? plan?.currency ?? 'eur' }
    : {
        amountMinor: plan?.amountMinor ?? 0,
        currency: plan?.currency ?? 'eur',
      }
}

/** One pack's paid checkout, as the grant saw it. */
export interface PackGrant {
  eventId: string
  /** The Stripe event's `created`, in seconds, when known. */
  eventCreated?: number
  session: Record<string, unknown>
  userId: string
  planId: string | null
  credits: number
  /** The launch offer's credits added beside the pack, or 0. */
  bonus: number
  /** When this delivery of the event reached us. */
  grantedAt: string
}

/** What the session says of the checkbox and the wording it showed. */
interface SessionConsent {
  accepted: boolean
  termsOfService: string | null
  mode: WithdrawalMode | null
  textVersion: string | null
}

function consentOf(session: Record<string, unknown>): SessionConsent {
  const consent = session.consent as { terms_of_service?: unknown } | null
  const terms =
    typeof consent?.terms_of_service === 'string'
      ? consent.terms_of_service
      : null
  const metadata =
    (session.metadata as Record<string, unknown> | undefined) ?? {}
  return {
    accepted: terms === 'accepted',
    termsOfService: terms,
    mode:
      typeof metadata.withdrawalMode === 'string'
        ? parseWithdrawalMode(metadata.withdrawalMode)
        : null,
    textVersion:
      typeof metadata.withdrawalText === 'string'
        ? metadata.withdrawalText
        : null,
  }
}

function sessionIdOf(grant: PackGrant): string {
  return typeof grant.session.id === 'string' && grant.session.id !== ''
    ? grant.session.id
    : `evt:${grant.eventId}`
}

function alert(env: Env, subject: string, lines: string[]): Promise<boolean> {
  return sendBillingAlert(
    { apiKey: env.RESEND_API_KEY, from: env.EMAIL_FROM },
    env.BILLING_ALERT_EMAIL ?? '',
    subject,
    lines,
  )
}

function iso(ms: number): string {
  return new Date(ms).toISOString()
}

function grantFacts(grant: PackGrant, sessionId: string): string[] {
  return [
    `Stripe event: ${grant.eventId}`,
    `Checkout Session: ${sessionId}`,
    `PaymentIntent: ${paymentIntentOf(grant.session) ?? 'none'}`,
    `Account: ${grant.userId}`,
    `Pack: ${grant.planId ?? 'unknown'}, ${grant.credits} credit(s)`,
  ]
}

async function planPrice(
  env: Env,
  planId: string | null,
): Promise<{ amountMinor: number | null; currency: string | null } | null> {
  if (planId === null) return null
  return env.DB.prepare(
    'SELECT amount AS amountMinor, currency FROM pricingPlans WHERE id = ?',
  )
    .bind(planId)
    .first<{ amountMinor: number | null; currency: string | null }>()
    .catch(() => null)
}

/** Write what the session says of the consent, once per session: a later
 *  delivery of the event finds the row and leaves it. Throws when the row
 *  cannot be written, after telling the owner: the webhook answers 500, so
 *  Stripe delivers the event again and the reconciliation sweep leaves it
 *  for later, and the next delivery writes the row. */
async function recordConsent(
  env: Env,
  grant: PackGrant,
  consent: SessionConsent,
  price: { amountMinor: number; currency: string },
): Promise<void> {
  const sessionId = sessionIdOf(grant)
  const acceptedAt = consent.accepted
    ? new Date(
        grant.eventCreated === undefined
          ? Date.parse(grant.grantedAt)
          : grant.eventCreated * 1000,
      ).toISOString()
    : null
  let fresh: boolean
  try {
    const res = await env.DB.prepare(
      `INSERT OR IGNORE INTO checkoutConsents
         (sessionId, userId, eventId, paymentIntentId, mode, textVersion, termsOfService, acceptedAt, amountMinor, currency, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        sessionId,
        grant.userId,
        grant.eventId,
        paymentIntentOf(grant.session),
        consent.mode,
        consent.textVersion,
        consent.termsOfService,
        acceptedAt,
        price.amountMinor,
        price.currency,
        grant.grantedAt,
      )
      .run()
    fresh = res.meta.changes > 0
  } catch (err) {
    console.error(
      `[billing] checkout ${grant.eventId}: consent record FAILED: ${String(err)}`,
    )
    await alert(env, 'Consent record not written', [
      ...grantFacts(grant, sessionId),
      `Error: ${String(err)}`,
      '',
      'The credits landed. The webhook answered 500, so Stripe delivers the',
      'event again, and the 6-hourly reconciliation tries it too: the next',
      'delivery writes the row and sends the purchase mail. Until then the',
      'consent is only on the Checkout Session in Stripe, and Settings ›',
      'Credits treats the pack as bought without it.',
    ])
    throw err
  }
  if (fresh && !consent.accepted) {
    console.error(
      `[billing] checkout ${grant.eventId}: paid pack WITHOUT the withdrawal consent (session ${sessionId})`,
    )
    await alert(env, 'Paid pack without the withdrawal consent', [
      ...grantFacts(grant, sessionId),
      `Consent on the session: ${consent.termsOfService ?? 'none'}`,
      '',
      'This buyer never ticked the checkbox: a session opened before the',
      'checkbox shipped, or one created outside POST /api/billing/checkout.',
      'Without that consent they bear no cost for what they used (CRD',
      'Art. 14(4)(b)), so Settings › Credits lets them cancel for 14 days',
      'even with every credit used, and refunds the whole price.',
    ])
  }
}

// ── The purchase mail ────────────────────────────────────────────────

/** A mail claimed this long ago and never marked sent or failed was cut
 *  off mid-send, and may be sent again. Also how long the sweep leaves a
 *  fresh purchase or statement to the request that made it. */
export const UNFINISHED_AFTER_MS = 10 * 60_000
/** Rows of each kind one sweep takes on. */
export const SWEEP_BATCH = 10

/** A purchase's consent row, and what its mail says. */
interface PurchaseMailRow {
  sessionId: string
  userId: string
  eventId: string
  paymentIntentId: string | null
  mode: string | null
  termsOfService: string | null
  amountMinor: number
  currency: string
  createdAt: string
  mailStatus: string | null
  mailAt: string | null
  mailError: string | null
  mailWarnedAt: string | null
  mailAttempts: number
  email: string | null
  credits: number | null
  planId: string | null
  planLabel: string | null
  purchasedAt: string | null
  bonus: number
  balance: number
}

async function readPurchaseMail(
  env: Env,
  sessionId: string,
): Promise<PurchaseMailRow | null> {
  return env.DB.prepare(
    `SELECT c.sessionId, c.userId, c.eventId, c.paymentIntentId, c.mode, c.termsOfService,
            c.amountMinor, c.currency, c.createdAt, c.mailStatus, c.mailAt, c.mailError,
            c.mailWarnedAt, c.mailAttempts,
            u.email AS email,
            p.delta AS credits, p.jobRef AS planId, p.createdAt AS purchasedAt,
            pp.label AS planLabel,
            (SELECT COALESCE(SUM(b.delta), 0) FROM creditLedger b
              WHERE b.userId = c.userId AND b.reason = ?
                AND b.paymentIntentId = c.paymentIntentId) AS bonus,
            (SELECT COALESCE(SUM(l.delta), 0) FROM creditLedger l
              WHERE l.userId = c.userId) AS balance
       FROM checkoutConsents c
       LEFT JOIN users u ON u.id = c.userId
       LEFT JOIN creditLedger p ON p.idempotencyKey = 'evt:' || c.eventId
       LEFT JOIN pricingPlans pp ON pp.id = p.jobRef
      WHERE c.sessionId = ?`,
  )
    .bind(PACK_BONUS, sessionId)
    .first<PurchaseMailRow>()
}

function purchaseFacts(row: PurchaseMailRow): string[] {
  return [
    `Stripe event: ${row.eventId}`,
    `Checkout Session: ${row.sessionId}`,
    `PaymentIntent: ${row.paymentIntentId ?? 'none'}`,
    `Account: ${row.userId}`,
    `Pack: ${row.planId ?? 'unknown'}, ${row.credits ?? 0} credit(s)`,
  ]
}

/** Take the purchase mail for this request, so two never both send it:
 *  one not yet sent, one whose last try ended unknown or never reached
 *  Resend, or a claim gone stale. Only while it stands as `row` read it,
 *  so the try knows what the one before it ended in. */
async function claimPurchaseMail(
  env: Env,
  row: PurchaseMailRow,
  nowMs: number,
): Promise<boolean> {
  const res = await env.DB.prepare(
    `UPDATE checkoutConsents
        SET mailStatus = 'sending', mailAt = ?, mailAttempts = mailAttempts + 1
      WHERE sessionId = ? AND mailStatus IS ?
        AND (mailStatus IS NULL OR mailStatus IN ('failed', 'no-email', 'not-configured')
             OR (mailStatus = 'sending' AND mailAt < ?))`,
  )
    .bind(
      iso(nowMs),
      row.sessionId,
      row.mailStatus,
      iso(nowMs - UNFINISHED_AFTER_MS),
    )
    .run()
  return res.meta.changes > 0
}

/** Send the purchase mail for the row: what Resend's answer says of it, or
 *  null when Resend is not configured here. `earlierMayHaveGone`: Resend
 *  may have taken the try before this one (mayHaveGone). Never throws. */
async function deliverPurchaseMail(
  env: Env,
  row: PurchaseMailRow,
  earlierMayHaveGone: boolean,
): Promise<MailAnswer | null> {
  if (!env.RESEND_API_KEY) {
    console.log(
      `[billing] checkout ${row.eventId}: RESEND_API_KEY unset, purchase mail not sent`,
    )
    return null
  }
  if (row.email == null || row.email === '') {
    return { kind: 'refused', why: 'no email address on the account' }
  }
  try {
    // A webhook or a cron has no page behind it: links and pictures go to
    // this environment's own app.
    const app = fallbackAppOrigin(env)
    const result = await sendPurchaseMail(
      { apiKey: env.RESEND_API_KEY, from: env.EMAIL_FROM },
      row.email,
      {
        appOrigin: app,
        assetOrigin: app,
        packLabel: row.planLabel ?? 'credit',
        credits: row.credits ?? 0,
        bonusCredits: row.bonus,
        balance: row.balance,
        amountMinor: row.amountMinor,
        currency: row.currency,
        orderDateIso: row.purchasedAt ?? row.createdAt,
        terms: purchaseTerms(row),
        graceWeekdays: withdrawalGraceWeekdays(env),
        trader: traderDetails(env),
      },
      `purchase-${row.sessionId}`,
    )
    return mailAnswer(result, earlierMayHaveGone)
  } catch (err) {
    console.error(`[billing] purchase mail failed: ${String(err)}`)
    return {
      kind: 'unknown',
      why: `the mail could not be sent: ${String(err)}`,
    }
  }
}

/** Keep what the try ended in, unless another request took the mail
 *  since. A record that fails leaves the claim to go stale, and the sweep
 *  tries again. */
async function recordPurchaseMail(
  env: Env,
  row: PurchaseMailRow,
  status: string,
  why: string | null,
): Promise<void> {
  await env.DB.prepare(
    `UPDATE checkoutConsents SET mailStatus = ?, mailAt = ?, mailError = ?
      WHERE sessionId = ? AND mailStatus = 'sending'`,
  )
    .bind(status, new Date().toISOString(), why, row.sessionId)
    .run()
    .catch((err: unknown) => {
      console.error(
        `[billing] checkout ${row.eventId}: mail record FAILED: ${String(err)}`,
      )
    })
}

/** What the sweep does with a purchase mail that has not gone. */
const SCHEDULE = [
  'The sweep sends it again every 6 hours until Resend takes it, and tells',
  'you if it has still not gone 3 days after the purchase. Once the pack',
  'can no longer be cancelled, it stops, and tells you so.',
]

/** The first try did not go, and nothing says it never will: the owner
 *  hears once, and the sweep keeps sending it. */
async function alertMailNotSent(
  env: Env,
  row: PurchaseMailRow,
  why: string,
): Promise<void> {
  console.error(
    `[billing] checkout ${row.eventId}: purchase mail not sent (${why}), the buyer has no confirmation yet`,
  )
  await alert(env, 'Purchase confirmation not sent', [
    ...purchaseFacts(row),
    `Mail: Resend did not take it (${why})`,
    '',
    'This mail is the legal confirmation of the purchase and of the',
    'withdrawal consent. Until it goes, Settings › Credits lets the buyer',
    'cancel for the whole price, used credits too.',
    ...SCHEDULE,
  ])
}

/** Why a purchase mail stops: Resend refused it for good, or the pack can
 *  no longer be cancelled and it still never went. */
type GiveUpReason = 'refused' | 'closed'

function givenUpLines(row: PurchaseMailRow, reason: GiveUpReason): string[] {
  const why = row.mailError ?? 'no answer kept'
  const story =
    reason === 'refused'
      ? [`Resend refused it for good: ${why}`, '', 'Nothing sends it again.']
      : [
          `Tries: ${row.mailAttempts}, the last at ${row.mailAt ?? 'none'}: ${why}`,
          '',
          'The pack can no longer be cancelled, and the mail never went: the',
          'sweep has stopped sending it.',
        ]
  return [
    ...purchaseFacts(row),
    `Buyer: ${row.email ?? 'no email address on the account'}`,
    ...story,
    'It is the legal confirmation of the purchase and of the withdrawal',
    'consent (CRD Art. 8(7)): send the buyer one by hand. Nothing records a',
    'mail sent by hand, so Settings › Credits keeps letting the buyer',
    'cancel for the whole price, used credits too, while cancelling is open.',
  ]
}

/**
 * Tell the owner to send the purchase mail by hand, and stop sending it.
 * It is given up only once Resend has taken that alert; until then it
 * stays as it is, and the next sweep tells again.
 */
async function giveUpPurchaseMail(
  env: Env,
  row: PurchaseMailRow,
  reason: GiveUpReason,
  nowMs: number,
): Promise<void> {
  const lines = givenUpLines(row, reason)
  if (!(await alert(env, 'Purchase confirmation given up', lines))) {
    // Last in the sweep's line, so a refused alert never holds back others.
    await env.DB.prepare(
      `UPDATE checkoutConsents SET mailAt = ?
        WHERE sessionId = ? AND mailStatus IN ('failed', 'refused')`,
    )
      .bind(iso(nowMs), row.sessionId)
      .run()
      .catch(() => undefined)
    return
  }
  await env.DB.prepare(
    `UPDATE checkoutConsents SET mailStatus = ?, mailAt = ?
      WHERE sessionId = ?
        AND (mailStatus IS NULL OR mailStatus IN ('failed', 'refused')
             OR (mailStatus = 'sending' AND mailAt < ?))`,
  )
    .bind(GAVE_UP, iso(nowMs), row.sessionId, iso(nowMs - UNFINISHED_AFTER_MS))
    .run()
}

/** One try at a claimed purchase mail, recorded; the owner hears of a
 *  refusal, and of a first try that did not go. */
async function tryPurchaseMail(
  env: Env,
  row: PurchaseMailRow,
  nowMs: number,
): Promise<void> {
  const before = row.mailStatus
  const answer = await deliverPurchaseMail(
    env,
    row,
    mayHaveGone(before, row.mailError),
  )
  const status = answer === null ? 'not-configured' : statusAfter(answer)
  const why = answer === null || answer.kind === 'sent' ? null : answer.why
  await recordPurchaseMail(env, row, status, why)
  if (status === REFUSED) {
    await giveUpPurchaseMail(env, { ...row, mailError: why }, 'refused', nowMs)
  } else if (status === 'failed' && (before === null || before === 'sending')) {
    await alertMailNotSent(env, row, why ?? 'no answer kept')
  }
}

/** Send the purchase mail unless it went, or Resend refused it; tell the
 *  owner again of one refused and not yet given up. Never throws. */
async function confirmByMail(
  env: Env,
  sessionId: string,
  nowMs: number,
): Promise<void> {
  try {
    const row = await readPurchaseMail(env, sessionId)
    if (row === null || row.mailStatus === 'sent' || row.mailStatus === GAVE_UP)
      return
    if (row.mailStatus === REFUSED) {
      await giveUpPurchaseMail(env, row, 'refused', nowMs)
      return
    }
    if (await claimPurchaseMail(env, row, nowMs)) {
      await tryPurchaseMail(env, row, nowMs)
    }
  } catch (err) {
    console.error(
      `[billing] purchase mail for ${sessionId} FAILED: ${String(err)}`,
    )
  }
}

/** Tell the owner, once, of a purchase mail still not sent WARN_AFTER_MS
 *  after the purchase, while the sweep keeps sending it. Recorded only once
 *  Resend has taken the alert. */
async function warnPurchaseMail(
  env: Env,
  sessionId: string,
  nowMs: number,
): Promise<void> {
  const row = await readPurchaseMail(env, sessionId)
  if (row === null || row.mailWarnedAt !== null) return
  if (row.mailStatus !== 'failed' && row.mailStatus !== 'sending') return
  if (Date.parse(row.createdAt) > nowMs - WARN_AFTER_MS) return
  const told = await alert(
    env,
    'Purchase confirmation still not sent after 3 days',
    [
      ...purchaseFacts(row),
      `Buyer: ${row.email ?? 'no email address on the account'}`,
      `Tries: ${row.mailAttempts}, the last at ${row.mailAt ?? 'none'}: ${row.mailError ?? 'no answer kept'}`,
      '',
      'Resend has not taken the purchase mail in 3 days, and nothing it',
      'answered says the mail itself cannot go. If its last answer above is',
      'about our key, its permissions, the sending domain or the quota, fix',
      'that and the next sweep sends it. Until Resend takes it or the pack',
      'can no longer be cancelled, the sweep keeps sending it every 6 hours',
      'under the same key; you hear again only then, or if Resend refuses',
      'the mail itself. Until it goes, Settings › Credits lets the buyer',
      'cancel for the whole price, used credits too.',
    ],
  )
  if (!told) return
  await env.DB.prepare(
    'UPDATE checkoutConsents SET mailWarnedAt = ? WHERE sessionId = ? AND mailWarnedAt IS NULL',
  )
    .bind(iso(nowMs), sessionId)
    .run()
}

/**
 * The purchase mails the sweep may still have to send or give up, the
 * longest untried first: one never tried (no mailAt), then by its last try,
 * so mails that keep failing never hold back a later one. The first
 * condition repeats the WHERE of idx_checkoutConsents_open (migration 0066)
 * word for word: SQLite uses a partial index only for a query that states
 * its condition, and without it every run would read every purchase.
 * Binds: the cut-off twice, then the batch size.
 */
export const UNSENT_PURCHASE_MAILS_SQL = `SELECT sessionId, createdAt, mailStatus FROM checkoutConsents
      WHERE (mailStatus IS NULL OR mailStatus IN ('failed', 'sending', 'refused'))
        AND createdAt < ?
        AND (mailStatus IS NULL OR mailStatus IN ('failed', 'refused')
             OR (mailStatus = 'sending' AND mailAt < ?))
      ORDER BY mailAt, createdAt LIMIT ?`

/** One purchase mail the sweep took: sent again while the pack can still
 *  be cancelled, with the 3-day alert when it is due; told of again when
 *  refused; given up once the pack cannot be cancelled any more. */
async function sweepPurchaseMail(
  env: Env,
  row: { sessionId: string; createdAt: string; mailStatus: string | null },
  nowMs: number,
  graceWeekdays: number,
): Promise<void> {
  if (
    row.mailStatus === REFUSED ||
    withdrawalOpen(row.createdAt, nowMs, graceWeekdays)
  ) {
    await confirmByMail(env, row.sessionId, nowMs)
    await warnPurchaseMail(env, row.sessionId, nowMs)
    return
  }
  const full = await readPurchaseMail(env, row.sessionId)
  if (full !== null) await giveUpPurchaseMail(env, full, 'closed', nowMs)
}

/**
 * The purchase mails a request left unsent: each older than
 * UNFINISHED_AFTER_MS that did not go, or whose send was cut off, goes
 * again for as long as the pack can be cancelled; one Resend refused for
 * good is given up once the owner has heard. At most SWEEP_BATCH a run
 * (withdrawal.ts, sweepWithdrawals).
 */
export async function sweepPurchaseMails(
  env: Env,
  nowMs: number,
): Promise<void> {
  const before = iso(nowMs - UNFINISHED_AFTER_MS)
  const { results } = await env.DB.prepare(UNSENT_PURCHASE_MAILS_SQL)
    .bind(before, before, SWEEP_BATCH)
    .all<{ sessionId: string; createdAt: string; mailStatus: string | null }>()
  const grace = withdrawalGraceWeekdays(env)
  for (const row of results) {
    try {
      await sweepPurchaseMail(env, row, nowMs, grace)
    } catch (err) {
      console.error(
        `[cron] purchase mail ${row.sessionId}: sweep FAILED: ${String(err)}`,
      )
    }
  }
}

/**
 * On every delivery of a pack's paid event: keep the consent, once per
 * session, and send the mail that confirms it unless it went already.
 * Throws only when the consent row cannot be written (recordConsent), so
 * the event comes again; the mail never throws.
 */
export async function confirmPurchase(
  env: Env,
  grant: PackGrant,
): Promise<void> {
  const consent = consentOf(grant.session)
  const price = paidPrice(grant.session, await planPrice(env, grant.planId))
  await recordConsent(env, grant, consent, price)
  await confirmByMail(env, sessionIdOf(grant), Date.now())
}
