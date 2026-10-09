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
// Art. 8(7)) and records whether that mail went. A paid pack without the
// box (a session opened before this shipped), a mail that did not go, and a
// record that could not be written each alert the owner
// (BILLING_ALERT_EMAIL). None of it ever undoes the credits: they landed
// first.
//
// Stripe refuses to open a session that asks for the box until the account
// has a Terms of service URL (Dashboard › Settings › Public details), in
// test mode and live mode alike.

import type { Env } from './auth'
import { fallbackAppOrigin } from './auth'
import { sendBillingAlert } from './email'
import { sendPurchaseMail } from './email-purchase'
import { paymentIntentOf } from './stripe-payments'
import type { TraderDetails, WithdrawalMode } from './withdrawal-wording'
import { CHECKOUT_CHECKBOX, CHECKOUT_SUBMIT_LINE, isKnownWithdrawalMode, parseWithdrawalMode, WITHDRAWAL_TEXT_VERSION, } from './withdrawal-wording'

/** The withdrawal model this environment sells under (WITHDRAWAL_MODE). */
export function withdrawalMode(env: Env): WithdrawalMode {
  if (!isKnownWithdrawalMode(env.WITHDRAWAL_MODE)) {
    console.warn(
      `[billing] WITHDRAWAL_MODE "${String(env.WITHDRAWAL_MODE)}" is not refund_unused or waiver: using refund_unused`,
    )
  }
  return parseWithdrawalMode(env.WITHDRAWAL_MODE)
}

/** Shown in place of a trader detail the owner has not set yet. */
const TRADER_PLACEHOLDERS: Readonly<TraderDetails> = {
  name: '[TRADER_NAME]',
  address: '[TRADER_ADDRESS]',
  email: '[TRADER_EMAIL]',
  vatId: '[TRADER_VAT_ID]',
}

/** Who sells the credits, from the TRADER_* vars. An unset one shows as
 *  its own name in brackets, and the log says which. */
export function traderDetails(env: Env): TraderDetails {
  const read = (value: string | undefined, key: keyof TraderDetails) => {
    const set = (value ?? '').trim()
    return set === '' ? TRADER_PLACEHOLDERS[key] : set
  }
  const trader: TraderDetails = {
    name: read(env.TRADER_NAME, 'name'),
    address: read(env.TRADER_ADDRESS, 'address'),
    email: read(env.TRADER_EMAIL, 'email'),
    vatId: read(env.TRADER_VAT_ID, 'vatId'),
  }
  const unset = Object.entries(trader)
    .filter(([, value]) => value.startsWith('[TRADER_'))
    .map(([, value]) => value.slice(1, -1))
  if (unset.length > 0) {
    console.warn(`[billing] trader details not set: ${unset.join(', ')}`)
  }
  return trader
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

/** What the purchase mail says was paid: the session's own total and
 *  currency, which already carry any Stripe discount, else the plan's list
 *  price. */
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
  /** When the pack's ledger row was written. */
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

function grantFacts(grant: PackGrant, sessionId: string): string[] {
  return [
    `Stripe event: ${grant.eventId}`,
    `Checkout Session: ${sessionId}`,
    `PaymentIntent: ${paymentIntentOf(grant.session) ?? 'none'}`,
    `Account: ${grant.userId}`,
    `Pack: ${grant.planId ?? 'unknown'}, ${grant.credits} credit(s)`,
  ]
}

/** Write what the session says of the consent. Never throws. */
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
  try {
    await env.DB.prepare(
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
  } catch (err) {
    console.error(
      `[billing] checkout ${grant.eventId}: consent record FAILED: ${String(err)}`,
    )
    await alert(env, 'Consent record not written', [
      ...grantFacts(grant, sessionId),
      `Error: ${String(err)}`,
      '',
      'The credits landed. The consent is still on the Checkout Session in',
      'Stripe; the row in checkoutConsents is missing.',
    ])
  }
  if (!consent.accepted) {
    console.error(
      `[billing] checkout ${grant.eventId}: paid pack WITHOUT the withdrawal consent (session ${sessionId})`,
    )
    await alert(env, 'Paid pack without the withdrawal consent', [
      ...grantFacts(grant, sessionId),
      `Consent on the session: ${consent.termsOfService ?? 'none'}`,
      '',
      'This buyer never ticked the checkbox: a session opened before the',
      'checkbox shipped, or one created outside POST /api/billing/checkout.',
      'Without that consent, a cancellation within 14 days may owe them the',
      'whole price, used credits included (CRD Art. 14(4)(b)). Ask before',
      'refusing one.',
    ])
  }
}

interface MailInfo {
  email: string | null
  planLabel: string | null
  amountMinor: number | null
  currency: string | null
  balance: number
}

type MailStatus = 'sent' | 'failed' | 'no-email' | 'not-configured'

async function readMailInfo(
  env: Env,
  grant: PackGrant,
): Promise<MailInfo | null> {
  return env.DB.prepare(
    `SELECT u.email       AS email,
            pp.label      AS planLabel,
            pp.amount     AS amountMinor,
            pp.currency   AS currency,
            (SELECT COALESCE(SUM(delta), 0) FROM creditLedger WHERE userId = ?) AS balance
       FROM users u
       LEFT JOIN pricingPlans pp ON pp.id = ?
      WHERE u.id = ?`,
  )
    .bind(grant.userId, grant.planId, grant.userId)
    .first<MailInfo>()
}

/** Send the purchase mail; say what happened to it. Never throws. */
async function sendConfirmation(
  env: Env,
  grant: PackGrant,
  info: MailInfo | null,
  mode: WithdrawalMode,
): Promise<MailStatus> {
  if (!env.RESEND_API_KEY) {
    console.log(
      `[billing] checkout ${grant.eventId}: RESEND_API_KEY unset, purchase mail not sent`,
    )
    return 'not-configured'
  }
  if (info?.email == null || info.email === '') return 'no-email'
  try {
    // A webhook has no page behind it: links and pictures go to this
    // environment's own app.
    const app = fallbackAppOrigin(env)
    const paid = paidPrice(grant.session, info)
    const sent = await sendPurchaseMail(
      { apiKey: env.RESEND_API_KEY, from: env.EMAIL_FROM },
      info.email,
      {
        appOrigin: app,
        assetOrigin: app,
        packLabel: info.planLabel ?? 'credit',
        credits: grant.credits,
        bonusCredits: grant.bonus,
        balance: info.balance,
        amountMinor: paid.amountMinor,
        currency: paid.currency,
        orderDateIso: grant.grantedAt,
        withdrawalMode: mode,
        trader: traderDetails(env),
      },
    )
    return sent ? 'sent' : 'failed'
  } catch (err) {
    console.error(`[billing] purchase mail failed: ${String(err)}`)
    return 'failed'
  }
}

async function recordMail(
  env: Env,
  grant: PackGrant,
  status: MailStatus,
): Promise<void> {
  const sessionId = sessionIdOf(grant)
  try {
    await env.DB.prepare(
      'UPDATE checkoutConsents SET mailStatus = ?, mailAt = ? WHERE sessionId = ?',
    )
      .bind(status, new Date().toISOString(), sessionId)
      .run()
  } catch (err) {
    console.error(
      `[billing] checkout ${grant.eventId}: mail record FAILED: ${String(err)}`,
    )
  }
  if (status === 'failed' || status === 'no-email') {
    console.error(
      `[billing] checkout ${grant.eventId}: purchase mail ${status}, the buyer has no confirmation`,
    )
    await alert(env, 'Purchase confirmation not sent', [
      ...grantFacts(grant, sessionId),
      `Mail: ${status === 'no-email' ? 'no email address on the account' : 'Resend did not take it'}`,
      '',
      'This mail is the legal confirmation of the purchase and of the',
      'withdrawal consent. Send the buyer a confirmation by hand.',
    ])
  }
}

/**
 * After a pack's credits land: keep the consent, send the mail that
 * confirms it, and record that mail. Only for a real grant, never a
 * redelivery. Never throws.
 */
export async function confirmPurchase(
  env: Env,
  grant: PackGrant,
): Promise<void> {
  const consent = consentOf(grant.session)
  let info: MailInfo | null = null
  try {
    info = await readMailInfo(env, grant)
  } catch (err) {
    console.error(
      `[billing] checkout ${grant.eventId}: could not read the buyer: ${String(err)}`,
    )
  }
  await recordConsent(env, grant, consent, paidPrice(grant.session, info))
  const mode = consent.mode ?? withdrawalMode(env)
  await recordMail(env, grant, await sendConfirmation(env, grant, info, mode))
}
