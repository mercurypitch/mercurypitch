// ── Mailed sign-in codes ─────────────────────────────────────────────
//
// A password nobody has to remember. The account gets a six-digit code by
// email; typing it back proves control of the inbox, which is the same proof
// the "confirm your address" link asks for and the same proof a password
// reset ultimately rests on.
//
// Six digits is 10^6, which is not a lot. What makes it defensible is that
// guessing is never open-ended:
//
//   1. A ceremony token addresses exactly ONE row. Verification asks whether
//      the code matches THAT row — not whether it matches any live code for
//      the address. Somebody who fires /request at a stranger's address holds
//      a token for a code they cannot read.
//   2. Five wrong guesses burn the row permanently.
//   3. Ten minutes, single use, claimed by an atomic UPDATE.
//   4. Rate limits per address and per IP, on top of all of that.
//
// Deliberately free of any auth.ts import: this is data and arithmetic, so it
// can be tested against a real SQLite without a Request in sight.

/** Ten minutes. Long enough for a slow inbox, short enough to be worth little. */
export const LOGIN_CODE_TTL_MS = 10 * 60 * 1000

/** Five wrong guesses and the row stops matching, forever. */
export const LOGIN_CODE_MAX_ATTEMPTS = 5

/**
 * How many unspent codes one address may hold.
 *
 * A new request deliberately does NOT invalidate the codes already in flight:
 * that would let anyone kill the code somebody is halfway through typing just
 * by firing /request at their address. Capping the live set and pruning the
 * oldest gets the same bound without the denial of service.
 */
export const LOGIN_CODE_MAX_LIVE = 3

export interface LoginCodeClaim {
  userId: string
  email: string
}

export type ClaimOutcome =
  | { ok: true; claim: LoginCodeClaim }
  /** Wrong, expired, spent, unknown, or out of attempts — one answer for all. */
  | { ok: false }

interface LoginCodeRow {
  userId: string
  email: string
  codeHash: string
  attempts: number
  expiresAt: string
  usedAt: string | null
}

/**
 * Six digits, uniformly.
 *
 * `random % 1_000_000` is biased — 2^32 is not a multiple of 10^6, so the low
 * codes come up marginally more often. It is a small edge and it is free to
 * remove, which is the whole argument for removing it.
 */
export function generateLoginCode(): string {
  const limit = Math.floor(0x1_0000_0000 / 1_000_000) * 1_000_000
  const buf = new Uint32Array(1)
  let draw = limit
  while (draw >= limit) {
    crypto.getRandomValues(buf)
    draw = buf[0] as number
  }
  return String(draw % 1_000_000).padStart(6, '0')
}

/** SHA-256 hex. The readable code lives in the email and nowhere else. */
export async function hashLoginCode(code: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(code),
  )
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Compare without leaking where the mismatch was.
 *
 * Both operands are fixed-length hex here, so this is close to belt and
 * braces — but a `===` on a secret comparison is the kind of line that gets
 * copied somewhere the lengths are not fixed.
 */
function sameHash(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i += 1)
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/**
 * Keep the newest `LOGIN_CODE_MAX_LIVE` unspent codes for an address and
 * expire the rest. Called before minting, so the cap holds including the row
 * about to be written.
 */
export async function pruneLoginCodes(
  db: D1Database,
  email: string,
  nowMs: number,
): Promise<void> {
  await db
    .prepare(
      `UPDATE loginCodes SET usedAt = ?
        WHERE email = ? AND usedAt IS NULL AND expiresAt > ?
          AND id NOT IN (
            SELECT id FROM loginCodes
             WHERE email = ? AND usedAt IS NULL AND expiresAt > ?
             ORDER BY id DESC LIMIT ?
          )`,
    )
    .bind(
      new Date(nowMs).toISOString(),
      email,
      new Date(nowMs).toISOString(),
      email,
      new Date(nowMs).toISOString(),
      LOGIN_CODE_MAX_LIVE - 1,
    )
    .run()
}

/**
 * Mint a code for one address. Returns the row id the ceremony token will
 * carry, and the readable code for the email — the only place it exists.
 */
export async function mintLoginCode(
  db: D1Database,
  userId: string,
  email: string,
  nowMs: number,
): Promise<{ id: number; code: string }> {
  await pruneLoginCodes(db, email, nowMs)
  const code = generateLoginCode()
  // RETURNING rather than meta.last_row_id: the id is the whole point of the
  // call, and asking the INSERT for it directly does not depend on which
  // driver-specific corner of `meta` a given runtime happens to fill in.
  const row = await db
    .prepare(
      `INSERT INTO loginCodes (userId, email, codeHash, expiresAt, createdAt)
       VALUES (?, ?, ?, ?, ?) RETURNING id`,
    )
    .bind(
      userId,
      email,
      await hashLoginCode(code),
      new Date(nowMs + LOGIN_CODE_TTL_MS).toISOString(),
      new Date(nowMs).toISOString(),
    )
    .first<{ id: number }>()
  return { id: Number(row?.id ?? 0), code }
}

/**
 * Spend a code against the one row the ceremony token names.
 *
 * Every failure answers the same `{ ok: false }`. Telling "wrong code" apart
 * from "out of attempts" or "expired" would hand an attacker a progress bar,
 * and there is nothing an honest caller could do differently with the detail.
 *
 * The claiming UPDATE is the gate, not the SELECT above it: two submits of the
 * same correct code race, and only one of them may come back with a session.
 */
export async function claimLoginCode(
  db: D1Database,
  id: number,
  code: string,
  nowMs: number,
): Promise<ClaimOutcome> {
  // id 0 is the decoy the unknown-address branch signs: AUTOINCREMENT starts
  // at 1, so it can never name a real row.
  if (!Number.isInteger(id) || id <= 0) return { ok: false }

  const row = await db
    .prepare(
      'SELECT userId, email, codeHash, attempts, expiresAt, usedAt FROM loginCodes WHERE id = ?',
    )
    .bind(id)
    .first<LoginCodeRow>()
  if (!row) return { ok: false }
  if (row.usedAt !== null) return { ok: false }
  if (Date.parse(row.expiresAt) <= nowMs) return { ok: false }
  if (row.attempts >= LOGIN_CODE_MAX_ATTEMPTS) return { ok: false }

  if (!sameHash(row.codeHash, await hashLoginCode(code))) {
    await db
      .prepare('UPDATE loginCodes SET attempts = attempts + 1 WHERE id = ?')
      .bind(id)
      .run()
    return { ok: false }
  }

  const claimed = await db
    .prepare('UPDATE loginCodes SET usedAt = ? WHERE id = ? AND usedAt IS NULL')
    .bind(new Date(nowMs).toISOString(), id)
    .run()
  if ((claimed.meta.changes ?? 0) !== 1) return { ok: false }

  return { ok: true, claim: { userId: row.userId, email: row.email } }
}
