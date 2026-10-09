// ============================================================
// promo-claim — the writes that make a promo claim, and the route that asks for one
// ============================================================
//
// Two callers claim a code. POST /api/billing/promo/redeem is a singer typing
// or tapping one; the launch gift (launch-offer.ts) claims the featured code
// the moment an account's email is confirmed. Both go through claimPromo, so a
// claim is the same writes whichever way it came: the account's slot, the
// campaign counter, the credits, and a record of the confirmed email
// (migration 0057).
//
// That last record is what deleting an account leaves behind. The slot and
// the credits go with the account (USER_OWNED_TABLES in auth.ts), so without
// it the same address could claim the same code again on a new account. It
// holds a keyed code of the address, never the address (free-song-email.ts
// explains the key), and while the key is unset nothing is read or written:
// a claim is then bounded per account only, as it always was.
//
// Moved out of billing.ts with the launch gift, so that file stays under the
// size ratchet.

import type { Env } from './auth'
import { checkRateLimit, getAuth } from './auth'
import { creditBalance } from './billing-core'
import { emailRecordCode } from './free-song-email'
import type { PromoWindow } from './promo-rules'
import { PROMO_REFUSALS, promoRefusal } from './promo-rules'

type Respond = (body: object | null, init?: ResponseInit) => Response

/** A promo code as a claim reads it. */
export interface PromoRow extends PromoWindow {
  id: string
  code: string
  credits: number
}

/** The columns a PromoRow is read from. */
export const PROMO_ROW_COLUMNS =
  'id, code, credits, maxRedemptions, redemptionCount, startsAt, expiresAt, active'

/**
 * What became of a claim. `email-taken` means the account's confirmed email
 * claimed this code already, on an account that has since been deleted.
 */
export type ClaimOutcome = 'claimed' | 'taken' | 'email-taken' | 'full'

/** What an email record is a record of. */
export type EmailRecordKind = 'claim' | 'offer-bonus'

/** The code a promo record of `email` holds, or null while there is no key. */
export function promoEmailCode(
  env: Pick<Env, 'FREE_SONG_EMAIL_SECRET'>,
  promoCodeId: string,
  kind: EmailRecordKind,
  email: string,
): Promise<string | null> {
  return emailRecordCode(env, `promo:${promoCodeId}:${kind}`, email)
}

/** Whether a record with this code exists. */
export async function promoEmailRecorded(
  db: D1Database,
  promoCodeId: string,
  kind: EmailRecordKind,
  emailHash: string,
): Promise<boolean> {
  const row = await db
    .prepare(
      'SELECT 1 AS had FROM promoEmailClaims WHERE promoCodeId = ? AND kind = ? AND emailHash = ?',
    )
    .bind(promoCodeId, kind, emailHash)
    .first()
  return row !== null
}

/** The record's INSERT, written only once the row `existsSql` names exists. */
export function recordPromoEmail(
  db: D1Database,
  record: { promoCodeId: string; kind: EmailRecordKind; emailHash: string },
  createdAt: string,
  existsSql: string,
  ...existsBindings: string[]
): D1PreparedStatement {
  return db
    .prepare(
      `INSERT OR IGNORE INTO promoEmailClaims (promoCodeId, kind, emailHash, createdAt)
       SELECT ?, ?, ?, ? WHERE EXISTS (${existsSql})`,
    )
    .bind(
      record.promoCodeId,
      record.kind,
      record.emailHash,
      createdAt,
      ...existsBindings,
    )
}

/**
 * Claim `promo` for an account, in one transaction.
 *
 * D1 runs a batch atomically, so a slot can never exist without its credits.
 * The cap is claimed by the slot INSERT itself, guarded by the counter it is
 * about to move: two callers racing for the last slot serialise on the write
 * lock, and the second one's INSERT lands nothing. UNIQUE(promoCodeId,
 * userId) drops a second slot for the same account the same way, and the
 * email record drops a slot for an address that claimed this code before.
 *
 * The caller has already checked that the code is open (promoRefusal); this
 * re-checks only what can change between that read and these writes.
 */
export async function claimPromo(
  env: Env,
  promo: PromoRow,
  account: { userId: string; email: string },
  now: Date,
): Promise<ClaimOutcome> {
  const nowIso = now.toISOString()
  const emailHash = await promoEmailCode(env, promo.id, 'claim', account.email)
  const redemptionId = crypto.randomUUID()
  const slotGuard =
    emailHash === null
      ? ''
      : `AND NOT EXISTS (SELECT 1 FROM promoEmailClaims
                          WHERE promoCodeId = ? AND kind = 'claim' AND emailHash = ?)`
  const slotBindings = emailHash === null ? [] : [promo.id, emailHash]
  const redeemed = 'SELECT 1 FROM promoRedemptions WHERE id = ?'

  const statements = [
    env.DB.prepare(
      `INSERT OR IGNORE INTO promoRedemptions (id, promoCodeId, userId, redeemedAt)
       SELECT ?, ?, ?, ?
        WHERE EXISTS (
          SELECT 1 FROM promoCodes
           WHERE id = ? AND active = 1
             AND (maxRedemptions IS NULL OR redemptionCount < maxRedemptions))
          ${slotGuard}`,
    ).bind(
      redemptionId,
      promo.id,
      account.userId,
      nowIso,
      promo.id,
      ...slotBindings,
    ),
    env.DB.prepare(
      `UPDATE promoCodes SET redemptionCount = redemptionCount + 1, updatedAt = ?
        WHERE id = ? AND EXISTS (${redeemed})`,
    ).bind(nowIso, promo.id, redemptionId),
    env.DB.prepare(
      `INSERT OR IGNORE INTO creditLedger (id, createdAt, userId, delta, reason, jobRef, idempotencyKey)
       SELECT ?, ?, ?, ?, 'promo', ?, ?
        WHERE EXISTS (${redeemed})`,
    ).bind(
      crypto.randomUUID(),
      nowIso,
      account.userId,
      promo.credits,
      promo.code,
      `promo:${promo.id}:${account.userId}`,
      redemptionId,
    ),
  ]
  if (emailHash !== null) {
    statements.push(
      recordPromoEmail(
        env.DB,
        { promoCodeId: promo.id, kind: 'claim', emailHash },
        nowIso,
        redeemed,
        redemptionId,
      ),
    )
  }
  const [slot, , credited] = await env.DB.batch(statements)

  if (slot.meta.changes === 0) {
    return whyNoSlot(env.DB, promo.id, account.userId, emailHash)
  }
  if (credited.meta.changes === 0) {
    // The slot is new but the ledger already had this key. Nothing here
    // writes one without the other; logged rather than failed, because the
    // redemption did land.
    console.error(
      `[billing] promo ${promo.code}: slot ${redemptionId} landed on an existing ledger key`,
    )
  }
  return 'claimed'
}

/** Nothing landed: say which of the guards stopped it. */
async function whyNoSlot(
  db: D1Database,
  promoCodeId: string,
  userId: string,
  emailHash: string | null,
): Promise<ClaimOutcome> {
  const taken = await db
    .prepare(
      'SELECT 1 FROM promoRedemptions WHERE promoCodeId = ? AND userId = ?',
    )
    .bind(promoCodeId, userId)
    .first()
  if (taken !== null) return 'taken'
  if (
    emailHash !== null &&
    (await promoEmailRecorded(db, promoCodeId, 'claim', emailHash))
  ) {
    return 'email-taken'
  }
  return 'full'
}

/** A code the account claimed, as GET /api/billing/me reports it. */
export interface PromoClaim {
  code: string
  credits: number
  claimedAt: string
}

/** The account's claims, oldest first. An empty list when the read fails:
 *  /me reports a balance whether or not this side table answers. */
export async function readPromoClaims(
  env: Env,
  userId: string,
): Promise<PromoClaim[]> {
  try {
    const { results } = await env.DB.prepare(
      `SELECT p.code AS code, p.credits AS credits, r.redeemedAt AS claimedAt
         FROM promoRedemptions r
         JOIN promoCodes p ON p.id = r.promoCodeId
        WHERE r.userId = ?
        ORDER BY r.redeemedAt`,
    )
      .bind(userId)
      .all<PromoClaim>()
    return results
  } catch {
    return []
  }
}

const CLAIM_REFUSALS: Record<Exclude<ClaimOutcome, 'claimed'>, string> = {
  taken: 'You have already redeemed this promo code.',
  'email-taken': 'This email address has already claimed this promo code.',
  full: 'This promo code has reached its maximum redemption limit.',
}

/** POST /api/billing/promo/redeem — auth + verified email; { code } → credits. */
export async function handlePromoRedeem(
  request: Request,
  env: Env,
  respond: Respond,
): Promise<Response> {
  const auth = await getAuth(request, env)
  if (!auth) return respond({ error: 'Unauthorized' }, { status: 401 })

  if (auth.isTestAccount) {
    return respond(
      { error: 'Promo codes are disabled for managed testing accounts' },
      { status: 403 },
    )
  }

  if (auth.provider === 'anonymous') {
    return respond(
      { error: 'Please create an account to redeem promo codes' },
      { status: 403 },
    )
  }

  const rl = await checkRateLimit(env.DB, `user:${auth.userId}`, 'promo-redeem')
  if (!rl.allowed) {
    const after = rl.retryAfter ?? 60
    return respond(
      { error: `Too many attempts. Try again in ${after} seconds.` },
      { status: 429, headers: { 'Retry-After': String(after) } },
    )
  }

  const user = await env.DB.prepare(
    'SELECT email, emailVerified FROM users WHERE id = ?',
  )
    .bind(auth.userId)
    .first<{ email: string | null; emailVerified: number }>()

  if (!user || user.email == null || user.emailVerified !== 1) {
    return respond(
      { error: 'Please verify your email address to redeem promo codes.' },
      { status: 403 },
    )
  }

  let body: { code?: string }
  try {
    body = (await request.json()) as { code?: string }
  } catch {
    return respond({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const rawCode = typeof body?.code === 'string' ? body.code.trim() : ''
  if (rawCode === '') {
    return respond({ error: 'Promo code is required.' }, { status: 400 })
  }

  const promo = await env.DB.prepare(
    `SELECT ${PROMO_ROW_COLUMNS} FROM promoCodes WHERE UPPER(code) = ? AND active = 1`,
  )
    .bind(rawCode.toUpperCase())
    .first<PromoRow>()

  if (!promo) {
    return respond(
      { error: 'Invalid or inactive promo code.' },
      { status: 404 },
    )
  }

  const now = new Date()
  const refusal = promoRefusal(promo, now)
  if (refusal !== null) {
    const { error, status } = PROMO_REFUSALS[refusal]
    return respond({ error }, { status })
  }

  const outcome = await claimPromo(
    env,
    promo,
    { userId: auth.userId, email: user.email },
    now,
  )
  if (outcome !== 'claimed') {
    return respond({ error: CLAIM_REFUSALS[outcome] }, { status: 400 })
  }

  const ledger = await env.DB.prepare(
    'SELECT delta FROM creditLedger WHERE userId = ?',
  )
    .bind(auth.userId)
    .all<{ delta: number }>()

  return respond({
    success: true,
    code: promo.code,
    creditsGranted: promo.credits,
    newBalance: creditBalance(ledger.results),
  })
}
