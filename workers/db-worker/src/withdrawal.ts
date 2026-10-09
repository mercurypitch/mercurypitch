// ============================================================
// withdrawal — "Withdraw from contract here" for a credit pack (CRD Art. 11a)
// ============================================================
//
//   GET  /api/billing/withdrawals — auth; the packs bought in the last 14
//        days that still hold unused paid credits, what each would refund,
//        the statements already made, and the account's email to prefill.
//   POST /api/billing/withdrawals — auth; { purchaseId, name, email }: the
//        withdrawal statement for one pack.
//
// Only under WITHDRAWAL_MODE refund_unused. In waiver mode the list is empty
// and a statement is refused.
//
// One statement per pack (withdrawals.purchaseId is UNIQUE): sending it again
// answers with the first, and finishes what the first left undone. It is
// written in one batch with the ledger rows that take away the pack's unused
// paid credits and its unused bonus (withdrawal-rules.ts), and the batch
// holds only if the ledger is still the one the rule counted (ledger.ts,
// LEDGER_VERSION): a spend in between makes it count again.
//
// Then the refund: a partial Stripe refund of the unused credits' share of
// the price, keyed on the statement so Stripe makes it once. The statement
// stands whatever Stripe says, because one made inside the 14 days counts
// (Art. 11a(5)). A refund Stripe refuses, or one with no PaymentIntent on
// record (a pack bought before migration 0058), is recorded and the owner is
// alerted to refund it by hand; it is never asked for again, so a hand
// refund and a retry cannot both go out. Last, the acknowledgement mail
// (email-withdrawal.ts), with the statement and the time it reached us. The
// owner is alerted whenever a request moves the refund or the mail.
//
// The refund comes back as charge.refunded: stripe-payments.ts counts the
// withdrawal's ledger rows as taken back already, so nothing goes twice.

import type { AuthUser, Env } from './auth'
import { checkRateLimit, fallbackAppOrigin, getAuth } from './auth'
import { traderDetails, withdrawalMode } from './checkout-consent'
import { formatMoney, sendBillingAlert } from './email'
import type { WithdrawalRefundState } from './email-withdrawal'
import { sendWithdrawalMail } from './email-withdrawal'
import { LEDGER_ATTEMPTS, LEDGER_VERSION, LedgerBusy, readNamedLedger, } from './ledger'
import { isStripeConfigured, stripeGet, stripeRequest } from './stripe-api'
import { WITHDRAWAL_BONUS, WITHDRAWAL_PAID } from './stripe-payments'
import type { PackUse } from './withdrawal-rules'
import { canWithdraw, packUses, refundMinor, withdrawalBonusKey, withdrawalDeadline, withdrawalKey, withdrawalOpen, } from './withdrawal-rules'

type Respond = (body: object | null, init?: ResponseInit) => Response

/** A statement as withdrawals stores it. */
interface StatementRow {
  id: string
  userId: string
  purchaseId: string
  paymentIntentId: string | null
  submittedAt: string
  name: string
  email: string
  packLabel: string
  purchasedAt: string
  paidCredits: number
  unusedCredits: number
  bonusCredits: number
  amountMinor: number
  refundMinor: number
  currency: string
  refundStatus: WithdrawalRefundState
  stripeRefundId: string | null
  refundError: string | null
  mailStatus: string | null
}

/** A pack's price and name, as the list and the statement need them. */
interface PackFacts {
  label: string
  amountMinor: number | null
  currency: string
}

interface PlanRow {
  id: string
  label: string | null
  amount: number | null
  currency: string | null
}

interface ConsentPrice {
  eventId: string
  amountMinor: number
  currency: string
}

const MAX_NAME = 200
const MAX_EMAIL = 254
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// ── Reading ──────────────────────────────────────────────────────────

/** The price paid and the pack's name for each pack: the checkout's own
 *  record (checkout-consent.ts), else the plan's list price, for a pack
 *  bought before the record existed. */
async function packFacts(
  env: Env,
  userId: string,
): Promise<(pack: PackUse) => PackFacts> {
  const [{ results: plans }, { results: prices }] = await Promise.all([
    env.DB.prepare(
      'SELECT id, label, amount, currency FROM pricingPlans',
    ).all<PlanRow>(),
    env.DB.prepare(
      'SELECT eventId, amountMinor, currency FROM checkoutConsents WHERE userId = ?',
    )
      .bind(userId)
      .all<ConsentPrice>(),
  ])
  const plan = new Map(plans.map((row) => [row.id, row]))
  const paid = new Map(prices.map((row) => [row.eventId, row]))
  return (pack) => {
    const listed = plan.get(pack.planId ?? '')
    const recorded = paid.get(pack.eventId ?? '')
    return {
      label: listed?.label ?? 'Credit',
      amountMinor: recorded?.amountMinor ?? listed?.amount ?? null,
      currency: recorded?.currency ?? listed?.currency ?? 'eur',
    }
  }
}

async function statementsOf(env: Env, userId: string): Promise<StatementRow[]> {
  const { results } = await env.DB.prepare(
    'SELECT * FROM withdrawals WHERE userId = ? ORDER BY submittedAt DESC LIMIT 20',
  )
    .bind(userId)
    .all<StatementRow>()
  return results
}

async function statementFor(
  env: Env,
  purchaseId: string,
): Promise<StatementRow | null> {
  return env.DB.prepare('SELECT * FROM withdrawals WHERE purchaseId = ?')
    .bind(purchaseId)
    .first<StatementRow>()
}

/** What the app shows of a statement. */
function statementView(row: StatementRow) {
  return {
    id: row.id,
    purchaseId: row.purchaseId,
    packLabel: row.packLabel,
    submittedAt: row.submittedAt,
    email: row.email,
    unusedCredits: row.unusedCredits,
    bonusCredits: row.bonusCredits,
    refundMinor: row.refundMinor,
    currency: row.currency,
    refundStatus: row.refundStatus,
  }
}

function packView(pack: PackUse, facts: PackFacts) {
  return {
    purchaseId: pack.purchaseId,
    packLabel: facts.label,
    purchasedAt: pack.purchasedAt,
    deadline: withdrawalDeadline(pack.purchasedAt),
    paidCredits: pack.paid,
    unusedCredits: pack.paidUnused,
    bonusCredits: pack.bonusUnused,
    refund:
      facts.amountMinor === null
        ? null
        : {
            amountMinor: refundMinor(facts.amountMinor, pack),
            currency: facts.currency,
          },
  }
}

async function handleList(
  request: Request,
  env: Env,
  respond: Respond,
): Promise<Response> {
  const auth = await getAuth(request, env)
  if (!auth) return respond({ error: 'Unauthorized' }, { status: 401 })
  const mode = withdrawalMode(env)
  if (mode !== 'refund_unused' || auth.isTestAccount) {
    return respond({ mode, email: null, packs: [], statements: [] })
  }
  const [ledger, facts, statements, user] = await Promise.all([
    readNamedLedger(env, auth.userId),
    packFacts(env, auth.userId),
    statementsOf(env, auth.userId),
    env.DB.prepare('SELECT email FROM users WHERE id = ?')
      .bind(auth.userId)
      .first<{ email: string | null }>(),
  ])
  const now = Date.now()
  const packs = packUses(ledger.rows)
    .filter((pack) => canWithdraw(mode, pack, now))
    .map((pack) => packView(pack, facts(pack)))
  return respond({
    mode,
    email: user?.email ?? null,
    packs,
    statements: statements.map(statementView),
  })
}

// ── The statement ────────────────────────────────────────────────────

interface StatementBody {
  purchaseId: string
  name: string
  email: string
}

function readBody(raw: unknown): StatementBody | string {
  const body = (raw ?? {}) as Record<string, unknown>
  const purchaseId =
    typeof body.purchaseId === 'string' ? body.purchaseId.trim() : ''
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const email = typeof body.email === 'string' ? body.email.trim() : ''
  if (purchaseId === '' || purchaseId.length > 100) {
    return 'Choose the purchase to cancel.'
  }
  if (name === '' || name.length > MAX_NAME) return 'Enter your name.'
  if (email.length > MAX_EMAIL || !EMAIL_SHAPE.test(email)) {
    return 'Enter the email address for the confirmation.'
  }
  return { purchaseId, name, email }
}

/** Why a pack cannot be withdrawn now, or null when it can. */
function refusal(pack: PackUse, now: number): string | null {
  if (!withdrawalOpen(pack.purchasedAt, now)) {
    return 'The 14 days to cancel this purchase have ended.'
  }
  if (pack.settled)
    return 'This purchase has been cancelled or refunded already.'
  if (pack.paidUnused <= 0) {
    return "You've used every credit from this purchase, so it can no longer be cancelled."
  }
  return null
}

/** The statement's row, before anything is written. */
function draftStatement(
  auth: AuthUser,
  body: StatementBody,
  pack: PackUse,
  facts: PackFacts,
  submittedAt: string,
  id: string,
): StatementRow {
  const amountMinor = facts.amountMinor ?? 0
  return {
    id,
    userId: auth.userId,
    purchaseId: pack.purchaseId,
    paymentIntentId: pack.paymentIntentId,
    submittedAt,
    name: body.name,
    email: body.email,
    packLabel: facts.label,
    purchasedAt: pack.purchasedAt,
    paidCredits: pack.paid,
    unusedCredits: pack.paidUnused,
    bonusCredits: pack.bonusUnused,
    amountMinor,
    refundMinor: refundMinor(amountMinor, pack),
    currency: facts.currency,
    refundStatus: 'pending',
    stripeRefundId: null,
    refundError: null,
    mailStatus: null,
  }
}

/** A ledger row the statement writes, only alongside the statement itself. */
function takeRow(
  env: Env,
  row: StatementRow,
  reason: string,
  key: string,
  credits: number,
): D1PreparedStatement {
  return env.DB.prepare(
    `INSERT OR IGNORE INTO creditLedger (id, createdAt, userId, delta, reason, jobRef, idempotencyKey)
     SELECT ?, ?, ?, ?, ?, ?, ?
      WHERE EXISTS (SELECT 1 FROM withdrawals WHERE id = ?)`,
  ).bind(
    crypto.randomUUID(),
    new Date().toISOString(),
    row.userId,
    -credits,
    reason,
    row.paymentIntentId ?? row.purchaseId,
    key,
    row.id,
  )
}

/**
 * Write the statement and its ledger rows, in one batch that holds only if
 * the ledger is still `version`. Returns the statement that stands for the
 * pack: this one, another that got there first, or null when the ledger
 * moved and the rule has to count again.
 */
async function writeStatement(
  env: Env,
  row: StatementRow,
  version: string,
): Promise<StatementRow | null> {
  const insert = env.DB.prepare(
    `INSERT OR IGNORE INTO withdrawals
       (id, userId, purchaseId, paymentIntentId, submittedAt, name, email, packLabel, purchasedAt,
        paidCredits, unusedCredits, bonusCredits, amountMinor, refundMinor, currency, refundStatus)
     SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending'
      WHERE ${LEDGER_VERSION} = ?`,
  ).bind(
    row.id,
    row.userId,
    row.purchaseId,
    row.paymentIntentId,
    row.submittedAt,
    row.name,
    row.email,
    row.packLabel,
    row.purchasedAt,
    row.paidCredits,
    row.unusedCredits,
    row.bonusCredits,
    row.amountMinor,
    row.refundMinor,
    row.currency,
    row.userId,
    version,
  )
  const takes = [
    takeRow(
      env,
      row,
      WITHDRAWAL_PAID,
      withdrawalKey(row.purchaseId),
      row.unusedCredits,
    ),
    ...(row.bonusCredits > 0
      ? [
          takeRow(
            env,
            row,
            WITHDRAWAL_BONUS,
            withdrawalBonusKey(row.purchaseId),
            row.bonusCredits,
          ),
        ]
      : []),
  ]
  await env.DB.batch([insert, ...takes])
  return statementFor(env, row.purchaseId)
}

type Placed =
  | { kind: 'placed'; row: StatementRow; duplicate: boolean }
  | { kind: 'refused'; status: number; error: string }

/** Count the pack, and write the statement on the ledger counted. */
async function placeStatement(
  env: Env,
  auth: AuthUser,
  body: StatementBody,
): Promise<Placed> {
  const submittedAt = new Date().toISOString()
  const id = crypto.randomUUID()
  const facts = await packFacts(env, auth.userId)
  for (let attempt = 0; attempt < LEDGER_ATTEMPTS; attempt += 1) {
    const ledger = await readNamedLedger(env, auth.userId)
    const pack = packUses(ledger.rows).find(
      (use) => use.purchaseId === body.purchaseId,
    )
    if (pack === undefined) {
      return { kind: 'refused', status: 404, error: 'Purchase not found.' }
    }
    const refused = refusal(pack, Date.parse(submittedAt))
    if (refused !== null)
      return { kind: 'refused', status: 409, error: refused }
    const draft = draftStatement(auth, body, pack, facts(pack), submittedAt, id)
    const stands = await writeStatement(env, draft, ledger.version)
    if (stands !== null) {
      return { kind: 'placed', row: stands, duplicate: stands.id !== id }
    }
  }
  throw new LedgerBusy(
    `withdrawal ${body.purchaseId}: the ledger kept changing`,
  )
}

// ── After the statement: the refund, the mail, the alert ─────────────

interface RefundOutcome {
  status: WithdrawalRefundState
  refundId: string | null
  error: string | null
}

/** Another request for this statement is talking to Stripe right now. */
const IN_FLIGHT: RefundOutcome = {
  status: 'pending',
  refundId: null,
  error: null,
}

function stripeError(data: Record<string, unknown>, status: number): string {
  const error = data.error as { message?: unknown } | undefined
  return typeof error?.message === 'string'
    ? error.message
    : `Stripe answered ${status}`
}

/** A refund this statement already has at Stripe: for a retry more than a
 *  day later, once Stripe has forgotten the idempotency key. */
async function refundOnRecord(
  env: Env,
  row: StatementRow,
): Promise<string | null> {
  const listed = await stripeGet(
    env,
    `/refunds?payment_intent=${encodeURIComponent(row.paymentIntentId ?? '')}&limit=100`,
  )
  const refunds = Array.isArray(listed.data.data)
    ? (listed.data.data as Array<Record<string, unknown>>)
    : []
  const ours = refunds.find(
    (refund) =>
      (refund.metadata as Record<string, unknown> | undefined)?.withdrawalId ===
      row.id,
  )
  return typeof ours?.id === 'string' ? ours.id : null
}

/** What Stripe's answer to the refund means for the statement. */
function refundAnswer(res: {
  ok: boolean
  status: number
  data: Record<string, unknown>
}): RefundOutcome {
  // 409: the same idempotency key is still being worked on.
  if (res.status === 409) return IN_FLIGHT
  const state = typeof res.data.status === 'string' ? res.data.status : ''
  if (
    res.ok &&
    typeof res.data.id === 'string' &&
    state !== 'failed' &&
    state !== 'canceled'
  ) {
    return { status: 'refunded', refundId: res.data.id, error: null }
  }
  return {
    status: 'failed',
    refundId: null,
    error: stripeError(res.data, res.status),
  }
}

/** Ask Stripe to refund the statement's amount, once. Never throws. */
async function refundAtStripe(
  env: Env,
  row: StatementRow,
  retry: boolean,
): Promise<RefundOutcome> {
  if (row.refundMinor <= 0) {
    return { status: 'none', refundId: null, error: null }
  }
  if (row.paymentIntentId === null) {
    return {
      status: 'manual',
      refundId: null,
      error: 'No PaymentIntent on record for this purchase',
    }
  }
  if (!isStripeConfigured(env)) {
    return {
      status: 'manual',
      refundId: null,
      error: 'Stripe is not configured',
    }
  }
  try {
    const earlier = retry ? await refundOnRecord(env, row) : null
    if (earlier !== null) {
      return { status: 'refunded', refundId: earlier, error: null }
    }
    return refundAnswer(
      await stripeRequest(
        env,
        '/refunds',
        {
          payment_intent: row.paymentIntentId,
          amount: String(row.refundMinor),
          reason: 'requested_by_customer',
          'metadata[withdrawalId]': row.id,
          'metadata[purchaseId]': row.purchaseId,
          'metadata[userId]': row.userId,
        },
        `withdrawal-${row.id}`,
      ),
    )
  } catch (err) {
    return { status: 'failed', refundId: null, error: String(err) }
  }
}

/** Keep what Stripe answered. Only a pending statement takes it, so a
 *  late answer never overwrites a refund already recorded. Returns false
 *  when another request recorded it first. */
async function recordRefund(
  env: Env,
  row: StatementRow,
  outcome: RefundOutcome,
): Promise<boolean> {
  const res = await env.DB.prepare(
    `UPDATE withdrawals
        SET refundStatus = ?, stripeRefundId = ?, refundError = ?, refundedAt = ?
      WHERE id = ? AND refundStatus = 'pending'`,
  )
    .bind(
      outcome.status,
      outcome.refundId,
      outcome.error,
      outcome.status === 'refunded' ? new Date().toISOString() : null,
      row.id,
    )
    .run()
  return res.meta.changes > 0
}

/** A mail claimed this long ago and never marked sent or failed was cut off
 *  mid-send, and may be sent again. */
const MAIL_CLAIM_MS = 10 * 60_000

/** Take the acknowledgement for this request, so two requests never both
 *  send it: one not yet sent, one that failed, or a claim gone stale. */
async function claimMail(env: Env, row: StatementRow): Promise<boolean> {
  const now = Date.now()
  const res = await env.DB.prepare(
    `UPDATE withdrawals SET mailStatus = 'sending', mailAt = ?
      WHERE id = ?
        AND (mailStatus IS NULL OR mailStatus = 'failed'
             OR (mailStatus = 'sending' AND mailAt < ?))`,
  )
    .bind(
      new Date(now).toISOString(),
      row.id,
      new Date(now - MAIL_CLAIM_MS).toISOString(),
    )
    .run()
  return res.meta.changes > 0
}

/** Send the acknowledgement and record whether it went. Never throws. */
async function acknowledge(env: Env, row: StatementRow): Promise<string> {
  let status = 'not-configured'
  if (env.RESEND_API_KEY) {
    const app = fallbackAppOrigin(env)
    const sent = await sendWithdrawalMail(
      { apiKey: env.RESEND_API_KEY, from: env.EMAIL_FROM },
      {
        appOrigin: app,
        assetOrigin: app,
        name: row.name,
        email: row.email,
        packLabel: row.packLabel,
        paidCredits: row.paidCredits,
        purchasedAtIso: row.purchasedAt,
        amountMinor: row.amountMinor,
        currency: row.currency,
        submittedAtIso: row.submittedAt,
        unusedCredits: row.unusedCredits,
        bonusCredits: row.bonusCredits,
        refundMinor: row.refundMinor,
        refundState: row.refundStatus,
        trader: traderDetails(env),
      },
      `withdrawal-${row.id}`,
    ).catch(() => false)
    status = sent ? 'sent' : 'failed'
  }
  await env.DB.prepare(
    'UPDATE withdrawals SET mailStatus = ?, mailAt = ? WHERE id = ?',
  )
    .bind(status, new Date().toISOString(), row.id)
    .run()
    .catch((err: unknown) => {
      console.error(
        `[billing] withdrawal ${row.id}: mail record FAILED: ${String(err)}`,
      )
    })
  return status
}

function alertSubject(row: StatementRow): string {
  const money = formatMoney(row.refundMinor, row.currency)
  switch (row.refundStatus) {
    case 'refunded':
      return `Withdrawal: refunded ${money}`
    case 'none':
      return 'Withdrawal: nothing to refund'
    case 'pending':
      return `Withdrawal: refund of ${money} still open`
    case 'failed':
      return `Withdrawal: refund FAILED, refund ${money} by hand`
    default:
      return `Withdrawal: refund ${money} by hand`
  }
}

function alertLines(row: StatementRow, mail: string): string[] {
  const byHand = row.refundStatus === 'failed' || row.refundStatus === 'manual'
  return [
    `Statement: ${row.id}, submitted ${row.submittedAt}`,
    `Account: ${row.userId}`,
    `Purchase: ${row.purchaseId} (${row.packLabel}, ${row.paidCredits} credits, bought ${row.purchasedAt})`,
    `PaymentIntent: ${row.paymentIntentId ?? 'none on record'}`,
    `Credits removed: ${row.unusedCredits} paid, ${row.bonusCredits} bonus`,
    `Refund: ${formatMoney(row.refundMinor, row.currency)} of ${formatMoney(row.amountMinor, row.currency)}, ${row.refundStatus}`,
    ...(row.stripeRefundId === null
      ? []
      : [`Stripe refund: ${row.stripeRefundId}`]),
    ...(row.refundError === null ? [] : [`Why not: ${row.refundError}`]),
    `Acknowledgement mail: ${mail}`,
    ...(byHand
      ? [
          '',
          'The statement stands: refund this amount in the Stripe dashboard',
          'within 14 days of the statement. That refund takes no more',
          'credits; the withdrawal took them already.',
        ]
      : []),
  ]
}

/**
 * Everything after the statement is written, or whatever an earlier request
 * left undone: the refund while it is still pending, and the
 * acknowledgement until it is sent. A refund Stripe refused is never asked
 * for again: the owner refunds it by hand, and a second request could
 * refund it twice. Alerts the owner whenever this request moved either.
 * Never throws.
 */
async function finish(
  env: Env,
  row: StatementRow,
  retry: boolean,
): Promise<StatementRow> {
  let done = row
  try {
    let moved = false
    if (row.refundStatus === 'pending') {
      const outcome = await refundAtStripe(env, row, retry)
      if (
        outcome.status !== 'pending' &&
        (await recordRefund(env, row, outcome))
      ) {
        moved = true
        done = {
          ...row,
          refundStatus: outcome.status,
          stripeRefundId: outcome.refundId,
          refundError: outcome.error,
        }
      }
    }
    if (await claimMail(env, done)) {
      done = { ...done, mailStatus: await acknowledge(env, done) }
      moved = true
    }
    if (moved) {
      await sendBillingAlert(
        { apiKey: env.RESEND_API_KEY, from: env.EMAIL_FROM },
        env.BILLING_ALERT_EMAIL ?? '',
        alertSubject(done),
        alertLines(done, done.mailStatus ?? 'not sent yet'),
      )
    }
  } catch (err) {
    console.error(
      `[billing] withdrawal ${row.id}: finishing failed: ${String(err)}`,
    )
  }
  return done
}

async function handleStatement(
  request: Request,
  env: Env,
  respond: Respond,
): Promise<Response> {
  const auth = await getAuth(request, env)
  if (!auth) return respond({ error: 'Unauthorized' }, { status: 401 })
  if (withdrawalMode(env) !== 'refund_unused' || auth.isTestAccount) {
    return respond(
      { error: 'Purchases cannot be cancelled here.' },
      { status: 403 },
    )
  }
  const limit = await checkRateLimit(
    env.DB,
    `user:${auth.userId}`,
    'billing-withdrawal',
  )
  if (!limit.allowed) {
    const after = limit.retryAfter ?? 60
    return respond(
      { error: `Too many attempts. Try again in ${after} seconds.` },
      { status: 429, headers: { 'Retry-After': String(after) } },
    )
  }
  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return respond({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const body = readBody(raw)
  if (typeof body === 'string') return respond({ error: body }, { status: 400 })

  const earlier = await statementFor(env, body.purchaseId)
  if (earlier !== null) {
    if (earlier.userId !== auth.userId) {
      return respond({ error: 'Purchase not found.' }, { status: 404 })
    }
    const row = await finish(env, earlier, true)
    return respond({
      received: true,
      duplicate: true,
      statement: statementView(row),
    })
  }
  let placed: Placed
  try {
    placed = await placeStatement(env, auth, body)
  } catch (error) {
    if (!(error instanceof LedgerBusy)) throw error
    console.warn(`[billing] ${error.message}`)
    return respond(
      { error: 'Billing is busy. Try again.', retryable: true },
      { status: 503, headers: { 'Retry-After': '1' } },
    )
  }
  if (placed.kind === 'refused') {
    return respond({ error: placed.error }, { status: placed.status })
  }
  const row = await finish(env, placed.row, placed.duplicate)
  console.log(
    `[billing] withdrawal ${row.id}: user=${row.userId} purchase=${row.purchaseId} -${row.unusedCredits} paid -${row.bonusCredits} bonus, refund ${row.refundMinor} ${row.refundStatus}`,
  )
  return respond({
    received: true,
    duplicate: placed.duplicate,
    statement: statementView(row),
  })
}

/** Route /api/billing/withdrawals; null for a method it does not answer. */
export async function handleWithdrawals(
  request: Request,
  env: Env,
  respond: Respond,
): Promise<Response | null> {
  if (request.method === 'GET') return handleList(request, env, respond)
  if (request.method === 'POST') return handleStatement(request, env, respond)
  return null
}
