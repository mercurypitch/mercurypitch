// ============================================================
// withdrawal — "Withdraw from contract here" for a credit pack (CRD Art. 11a)
// ============================================================
//
//   GET  /api/billing/withdrawals — auth; the packs that can still be
//        cancelled, what each would refund, the statements already made,
//        and the account's email to prefill.
//   POST /api/billing/withdrawals — auth; { purchaseId, name, email }: the
//        withdrawal statement for one pack.
//
// A pack keeps the terms its own checkout recorded (checkout-consent.ts,
// consentTerms), whatever WITHDRAWAL_MODE says now: one sold under the
// waiver has no withdrawal function; one sold under refund_unused can be
// cancelled while it holds unused paid credits, for the unused share of the
// price; one with no ticked box on record (every pack bought before the box
// shipped) can be cancelled with every credit used, for the whole price
// (withdrawal-rules.ts). A ticked box counts only once the purchase mail
// confirmed it: until then the pack is one with no consent. A statement
// already made is always finished.
//
// One statement per pack (withdrawals.purchaseId is UNIQUE): sending it again
// answers with the first, and finishes what the first left undone. It is
// written in one batch with the ledger rows that take away what is left of
// the pack's paid credits and its bonus, and the batch holds only if the
// ledger is still the one the rule counted (ledger.ts, LEDGER_VERSION): a
// spend in between makes it count again.
//
// The refund is worked out from the price paid: the checkout's own record,
// else what the PaymentIntent received at Stripe, never the catalogue's.
// When neither knows it, the statement stands and the owner refunds by
// hand. The statement stands whatever Stripe says, because one made inside
// the 14 days counts (Art. 11a(5)). The refund, its acknowledgement mail and
// the owner's alert follow in withdrawal-finish.ts; what a request leaves
// undone, the 6-hourly sweep finishes (sweepWithdrawals).
//
// What the money says decides as much as the credits (withdrawal-rules.ts):
// the list reads what Stripe last said of each payment (stripeCharges),
// and asks Stripe nothing. A statement reads Stripe afresh before it
// promises an amount (paymentAtStripe): a pack whose money Stripe holds
// back (a chargeback, or refunds of all of it) is refused, and the refund
// is never more than the charge still holds. When Stripe does not answer,
// the statement stands with its price pending, and no amount is promised
// until it does.
//
// The refund comes back as charge.refunded: stripe-payments.ts counts the
// withdrawal's ledger rows as taken back already, so nothing goes twice.

import type { AuthUser, Env } from './auth'
import { checkRateLimit, getAuth } from './auth'
import { consentTerms, sweepPurchaseMails, withdrawalGraceWeekdays, withdrawalMode, } from './checkout-consent'
import { LEDGER_ATTEMPTS, LEDGER_VERSION, LedgerBusy, readNamedLedger, } from './ledger'
import type { ChargeState } from './stripe-charge'
import { loadCharge, loadCharges } from './stripe-charge'
import { WITHDRAWAL_BONUS, WITHDRAWAL_PAID } from './stripe-payments'
import { finish, sweepStatements } from './withdrawal-finish'
import type { PaymentAnswer, Price } from './withdrawal-refund'
import { paymentAtStripe } from './withdrawal-refund'
import type { StatementRow } from './withdrawal-row'
import { priceKnown } from './withdrawal-row'
import type { PackUse, PaymentMoney, RefundBasis } from './withdrawal-rules'
import { canWithdraw, deadlineToShow, moneyOf, packUses, refundBasis, refundFor, refundOwed, withdrawalBonusKey, withdrawalKey, withdrawalOpen, withMoney, } from './withdrawal-rules'
import type { PurchaseTerms } from './withdrawal-wording'

type Respond = (body: object | null, init?: ResponseInit) => Response

/** A pack's name, the terms it was sold under, and its price as the
 *  checkout recorded it (null when it did not: never the catalogue's). */
interface PurchaseFacts {
  label: string
  terms: PurchaseTerms
  price: Price | null
}

interface ConsentRow {
  eventId: string
  mode: string | null
  termsOfService: string | null
  amountMinor: number
  currency: string
  mailStatus: string | null
}

const MAX_NAME = 200
const MAX_EMAIL = 254
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
/** A link or an address where only a name belongs: "@", a scheme, "www.",
 *  a host with a path ("evil.example/restore"), or a host of two or more
 *  characters on a common top-level domain ("evil.com"). The
 *  acknowledgement goes out from our domain with the name in it, so it can
 *  carry neither. A dot between names is a name ("J.Smith", "Dr.Ana
 *  Horvat"), and so is an initial before one, whatever follows ("A.Dev
 *  Patel", "K.App"); a link dressed up past this gets through, which one
 *  statement per paid pack and the rate limit keep rare. */
const NOT_A_NAME =
  /@|:\/\/|\bwww\.|\.[a-z]{2,}\/|\b[a-z0-9-]{2,}\.(?:com|net|org|info|biz|io|app|dev|xyz|top|site|online|link|click|shop|ru|cn)\b/i

// ── Reading ──────────────────────────────────────────────────────────

/** What each of the account's packs was sold under, from its checkout's
 *  consent row and whether its purchase mail confirmed it
 *  (checkout-consent.ts). */
async function purchaseFacts(
  env: Env,
  userId: string,
): Promise<(pack: PackUse) => PurchaseFacts> {
  const [{ results: plans }, { results: consents }] = await Promise.all([
    env.DB.prepare('SELECT id, label FROM pricingPlans').all<{
      id: string
      label: string | null
    }>(),
    env.DB.prepare(
      'SELECT eventId, mode, termsOfService, amountMinor, currency, mailStatus FROM checkoutConsents WHERE userId = ?',
    )
      .bind(userId)
      .all<ConsentRow>(),
  ])
  const labels = new Map(plans.map((row) => [row.id, row.label]))
  const byEvent = new Map(consents.map((row) => [row.eventId, row]))
  return (pack) => {
    const consent = byEvent.get(pack.eventId ?? '')
    return {
      label: labels.get(pack.planId ?? '') ?? 'Credit',
      terms: consentTerms(consent),
      price:
        consent === undefined
          ? null
          : { amountMinor: consent.amountMinor, currency: consent.currency },
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

/** What the app shows of a statement. The refund is null while the price
 *  paid is not known; `stripeRefundStatus` says whether a refund Stripe
 *  took has finished ('succeeded'). `mailStatus` is the acknowledgement's:
 *  'sent' once it went, 'refused' or 'gave-up' when it never will. */
function statementView(row: StatementRow) {
  return {
    id: row.id,
    purchaseId: row.purchaseId,
    packLabel: row.packLabel,
    submittedAt: row.submittedAt,
    email: row.email,
    unusedCredits: row.unusedCredits,
    bonusCredits: row.bonusCredits,
    basis: row.refundBasis ?? 'unused',
    refundMinor: priceKnown(row) ? row.refundMinor : null,
    currency: row.currency,
    refundStatus: row.refundStatus,
    stripeRefundStatus: row.stripeRefundStatus,
    mailStatus: row.mailStatus,
  }
}

/** The refund the list shows: by what Stripe last said of the payment;
 *  with nothing kept, by the rule alone, unless money went back on the
 *  payment before Stripe's word was kept: then none, and the statement
 *  reads Stripe. */
function listedRefund(
  basis: RefundBasis,
  price: Price,
  pack: PackUse,
  money: PaymentMoney | null,
): number | null {
  if (money !== null) return refundOwed(basis, price.amountMinor, pack, money)
  return pack.moneyBack ? null : refundFor(basis, price.amountMinor, pack)
}

function packView(
  pack: PackUse,
  facts: PurchaseFacts,
  money: PaymentMoney | null,
  nowMs: number,
  graceWeekdays: number,
) {
  const basis = refundBasis(facts.terms)
  const refund =
    facts.price === null ? null : listedRefund(basis, facts.price, pack, money)
  return {
    purchaseId: pack.purchaseId,
    packLabel: facts.label,
    purchasedAt: pack.purchasedAt,
    deadline: deadlineToShow(pack.purchasedAt, nowMs, graceWeekdays),
    basis,
    paidCredits: pack.paid,
    unusedCredits: pack.paidUnused,
    bonusCredits: pack.bonusUnused,
    refund:
      facts.price === null || refund === null
        ? null
        : { amountMinor: refund, currency: facts.price.currency },
  }
}

/** What Stripe last said of a pack's payment, or null when nothing is kept. */
function keptMoney(
  kept: ReadonlyMap<string, ChargeState>,
  pack: PackUse,
): PaymentMoney | null {
  const charge =
    pack.paymentIntentId === null ? undefined : kept.get(pack.paymentIntentId)
  return charge === undefined ? null : moneyOf(charge)
}

async function handleList(
  request: Request,
  env: Env,
  respond: Respond,
): Promise<Response> {
  const auth = await getAuth(request, env)
  if (!auth) return respond({ error: 'Unauthorized' }, { status: 401 })
  const mode = withdrawalMode(env)
  if (auth.isTestAccount) {
    return respond({ mode, email: null, packs: [], statements: [] })
  }
  const [ledger, facts, statements, user] = await Promise.all([
    readNamedLedger(env, auth.userId),
    purchaseFacts(env, auth.userId),
    statementsOf(env, auth.userId),
    env.DB.prepare('SELECT email FROM users WHERE id = ?')
      .bind(auth.userId)
      .first<{ email: string | null }>(),
  ])
  const now = Date.now()
  const grace = withdrawalGraceWeekdays(env)
  const uses = packUses(ledger.rows)
  const kept = await loadCharges(
    env,
    uses.flatMap((use) =>
      use.paymentIntentId === null ? [] : [use.paymentIntentId],
    ),
  )
  const packs = uses.flatMap((use) => {
    const money = keptMoney(kept, use)
    const pack = withMoney(use, money)
    const fact = facts(pack)
    return canWithdraw(fact.terms, pack, now, grace)
      ? [packView(pack, fact, money, now, grace)]
      : []
  })
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
  if (NOT_A_NAME.test(name)) {
    return 'Enter just your name, without a link or an email address.'
  }
  if (email.length > MAX_EMAIL || !EMAIL_SHAPE.test(email)) {
    return 'Enter the email address for the confirmation.'
  }
  return { purchaseId, name, email }
}

/** Why a pack cannot be withdrawn now, or null when it can. */
function refusal(
  pack: PackUse,
  terms: PurchaseTerms,
  nowMs: number,
  graceWeekdays: number,
): string | null {
  if (terms === 'waiver') {
    return 'You gave up the right to cancel this purchase at checkout.'
  }
  if (!withdrawalOpen(pack.purchasedAt, nowMs, graceWeekdays)) {
    return 'The 14 days to cancel this purchase have ended.'
  }
  if (pack.settled)
    return 'This purchase has been cancelled or refunded already.'
  if (terms === 'refund_unused' && pack.paidUnused <= 0) {
    return "You've used every credit from this purchase, so it can no longer be cancelled."
  }
  return null
}

/** The refund a statement promises, and the price it is worked out from:
 *  the checkout's record, else what Stripe says the payment received. Capped
 *  at what the charge holds, by Stripe's word just read. None while Stripe
 *  has not answered, or no price is known: the price is pending, and the
 *  refund step asks again (withdrawal-finish.ts). */
function promised(
  basis: RefundBasis,
  pack: PackUse,
  facts: PurchaseFacts,
  read: PaymentAnswer,
): {
  price: Price | null
  refundMinor: number
  source: StatementRow['priceSource']
} {
  const price = facts.price ?? (read.kind === 'paid' ? read.price : null)
  if (price === null || read.kind === 'no-answer') {
    return { price, refundMinor: 0, source: 'pending' }
  }
  return {
    price,
    refundMinor:
      read.kind === 'paid'
        ? refundOwed(basis, price.amountMinor, pack, moneyOf(read.charge))
        : refundFor(basis, price.amountMinor, pack),
    source: facts.price === null ? 'stripe' : 'checkout',
  }
}

/** The statement's row, before anything is written. */
function draftStatement(
  auth: AuthUser,
  body: StatementBody,
  pack: PackUse,
  facts: PurchaseFacts,
  read: PaymentAnswer,
  submittedAt: string,
  id: string,
): StatementRow {
  const basis = refundBasis(facts.terms)
  const { price, refundMinor, source } = promised(basis, pack, facts, read)
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
    amountMinor: price?.amountMinor ?? 0,
    refundMinor,
    currency: price?.currency ?? 'eur',
    refundStatus: 'pending',
    stripeRefundId: null,
    refundError: read.kind === 'no-answer' ? read.why : null,
    mailStatus: null,
    mailAt: null,
    refundBasis: basis,
    priceSource: source,
    stripeRefundStatus: null,
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
 * the ledger is still `version`. The paid row is written even when nothing
 * paid is left (a pack with no consent on record, used up): it is what
 * marks the pack settled. Returns the statement that stands for the pack:
 * this one, another that got there first, or null when the ledger moved
 * and the rule has to count again.
 */
async function writeStatement(
  env: Env,
  row: StatementRow,
  version: string,
): Promise<StatementRow | null> {
  const insert = env.DB.prepare(
    `INSERT OR IGNORE INTO withdrawals
       (id, userId, purchaseId, paymentIntentId, submittedAt, name, email, packLabel, purchasedAt,
        paidCredits, unusedCredits, bonusCredits, amountMinor, refundMinor, currency, refundStatus,
        refundError, refundBasis, priceSource)
     SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
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
    row.refundStatus,
    row.refundError,
    row.refundBasis,
    row.priceSource,
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
  | {
      kind: 'placed'
      row: StatementRow
      duplicate: boolean
      /** What Stripe said of the payment as the statement was made. */
      read: PaymentAnswer
    }
  | { kind: 'refused'; status: number; error: string }

/** What Stripe last said of the pack's payment, kept (stripeCharges). */
async function keptMoneyOf(
  env: Env,
  pack: PackUse,
): Promise<PaymentMoney | null> {
  if (pack.paymentIntentId === null) return null
  const charge = await loadCharge(env, pack.paymentIntentId)
  return charge === null ? null : moneyOf(charge)
}

/**
 * Count the pack, and write the statement on the ledger counted. The pack
 * is checked against what Stripe last said of its payment, then against
 * what Stripe says now, read once per request before any amount is
 * promised.
 */
async function placeStatement(
  env: Env,
  auth: AuthUser,
  body: StatementBody,
): Promise<Placed> {
  const submittedAt = new Date().toISOString()
  const now = Date.parse(submittedAt)
  const id = crypto.randomUUID()
  const grace = withdrawalGraceWeekdays(env)
  const facts = await purchaseFacts(env, auth.userId)
  let read: PaymentAnswer | null = null
  for (let attempt = 0; attempt < LEDGER_ATTEMPTS; attempt += 1) {
    const ledger = await readNamedLedger(env, auth.userId)
    const use = packUses(ledger.rows).find(
      (entry) => entry.purchaseId === body.purchaseId,
    )
    if (use === undefined) {
      return { kind: 'refused', status: 404, error: 'Purchase not found.' }
    }
    const fact = facts(use)
    const kept = withMoney(use, await keptMoneyOf(env, use))
    const refusedKept = refusal(kept, fact.terms, now, grace)
    if (refusedKept !== null) {
      return { kind: 'refused', status: 409, error: refusedKept }
    }
    read ??= await paymentAtStripe(env, use.paymentIntentId)
    const pack =
      read.kind === 'paid' ? withMoney(use, moneyOf(read.charge)) : kept
    const refused = refusal(pack, fact.terms, now, grace)
    if (refused !== null)
      return { kind: 'refused', status: 409, error: refused }
    const draft = draftStatement(auth, body, pack, fact, read, submittedAt, id)
    const stands = await writeStatement(env, draft, ledger.version)
    if (stands !== null) {
      return { kind: 'placed', row: stands, duplicate: stands.id !== id, read }
    }
  }
  throw new LedgerBusy(
    `withdrawal ${body.purchaseId}: the ledger kept changing`,
  )
}

async function handleStatement(
  request: Request,
  env: Env,
  respond: Respond,
): Promise<Response> {
  const auth = await getAuth(request, env)
  if (!auth) return respond({ error: 'Unauthorized' }, { status: 401 })
  if (auth.isTestAccount) {
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
  // The request that made the statement read Stripe already: its refund
  // step works from that read.
  const row = await finish(
    env,
    placed.row,
    placed.duplicate,
    placed.duplicate ? undefined : placed.read,
  )
  console.log(
    `[billing] withdrawal ${row.id}: user=${row.userId} purchase=${row.purchaseId} -${row.unusedCredits} paid -${row.bonusCredits} bonus, refund ${row.refundMinor} ${row.refundStatus} (${row.refundBasis ?? 'unused'}, price ${row.priceSource ?? 'checkout'})`,
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

/**
 * The cron's part (index.ts, scheduled): purchase mails that did not go
 * (checkout-consent.ts), then statements a request left unfinished
 * (withdrawal-finish.ts). Each on its own, so one never starves the other.
 */
export async function sweepWithdrawals(
  env: Env,
  nowMs: number = Date.now(),
): Promise<void> {
  try {
    await sweepPurchaseMails(env, nowMs)
  } catch (err) {
    console.error(`[cron] purchase mail sweep failed: ${String(err)}`)
  }
  try {
    await sweepStatements(env, nowMs)
  } catch (err) {
    console.error(`[cron] withdrawal sweep failed: ${String(err)}`)
  }
}
