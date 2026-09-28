// ── The month's free song, once per confirmed email address ──
//
// The native app's free song is one a UTC month for a signed-in singer
// without the subscription (songs-allowance.ts, app-songs.ts). Its claim is
// a ledger row, and deleting an account deletes its ledger rows
// (USER_OWNED_TABLES in auth.ts). So a claim also records the account's
// confirmed email for the month, in freeSongEmailClaims (migration 0053),
// written in the batch that writes the claim. The table names no account,
// and deleting one leaves it alone. An account whose email has a record for
// the month, and which has made no claim of its own that month, gets no free
// song until the next.
//
// A record never holds the email. It holds a code of it: HMAC-SHA256 keyed
// with FREE_SONG_EMAIL_SECRET, a secret of its own. A plain digest of an
// email is no secret, as anyone can take the digest of a guess and look it
// up. The email is trimmed and lower-cased first, as registration stores it,
// and nothing more: plus-addressing (singer+1@example.com) makes another
// address to this, a known limit. The month is in the code too, so one
// month's codes say nothing about another's.
//
// Records are for their month only: the cron deletes those of earlier months
// (sweepFreeSongEmails), so an email's code is kept a month at most.
//
// While the secret is unset, or shorter than 32 bytes, the Worker does as it
// did before: no record is read or written, the free song is bounded per
// account only, and the log says so once per isolate. Rotating the secret
// forgets the current month's records.

import type { Env } from './auth'
import { songMonth } from './songs-allowance'

/** The least a key may be, in bytes. A short key can be guessed, and a code
 *  keyed with one is no better than a plain digest. */
const KEY_BYTES = 32

const encoder = new TextEncoder()

/** Whether this isolate has said that there is no key. */
let warned = false

/** The key, or null while there is none worth having. The first time there
 *  is none, the log says so. */
async function emailKey(
  env: Pick<Env, 'FREE_SONG_EMAIL_SECRET'>,
): Promise<CryptoKey | null> {
  const secret = encoder.encode(env.FREE_SONG_EMAIL_SECRET ?? '')
  if (secret.byteLength < KEY_BYTES) {
    if (!warned) {
      warned = true
      console.warn(
        `[billing] free song: FREE_SONG_EMAIL_SECRET is unset or shorter than ${KEY_BYTES} bytes; the month's free song is bounded per account only`,
      )
    }
    return null
  }
  return crypto.subtle.importKey(
    'raw',
    secret,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
}

/** The code an email's record of the month's free song holds: HMAC-SHA256
 *  of the month and the email, trimmed and lower-cased, in hex. Null while
 *  the Worker has no key. */
export async function freeSongEmailCode(
  env: Pick<Env, 'FREE_SONG_EMAIL_SECRET'>,
  email: string,
  month: string,
): Promise<string | null> {
  const key = await emailKey(env)
  if (key === null) return null
  const mac = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(`free-song:${month}:${email.trim().toLowerCase()}`),
  )
  return [...new Uint8Array(mac)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

/** An account's email, as the month's free song reads it. */
export interface FreeSongEmail {
  /** The month the record is for: `YYYY-MM`, in UTC. */
  month: string
  /** The email's code for the month (freeSongEmailCode). */
  code: string
  /** Whether the record was there when read: the email had the month's
   *  free song already, on this account or on another. */
  had: boolean
}

/** The account's email's record of the month's free song, as a claim writes
 *  it, and whether it is there. Null while the Worker has no key. */
export async function readFreeSongEmail(
  env: Env,
  email: string,
  nowMs: number,
): Promise<FreeSongEmail | null> {
  const month = songMonth(nowMs)
  const code = await freeSongEmailCode(env, email, month)
  if (code === null) return null
  const row = await env.DB.prepare(
    'SELECT 1 AS had FROM freeSongEmailClaims WHERE month = ? AND emailHash = ?',
  )
    .bind(month, code)
    .first()
  return { month, code, had: row !== null }
}

/** What a claim's debit asks as it is written, where the read found no
 *  record: there is still none. Binds the month, then the code. */
export const FREE_SONG_EMAIL_UNCLAIMED =
  'NOT EXISTS (SELECT 1 FROM freeSongEmailClaims WHERE month = ? AND emailHash = ?)'

/** The email's record, for the claim's batch: written only if the debit row
 *  `debitId` was, and once, whichever claim of the month writes it. */
export function recordFreeSongEmail(
  db: D1Database,
  email: FreeSongEmail,
  debitId: string,
): D1PreparedStatement {
  return db
    .prepare(
      `INSERT OR IGNORE INTO freeSongEmailClaims (month, emailHash)
       SELECT ?, ? WHERE EXISTS (SELECT 1 FROM creditLedger WHERE id = ?)`,
    )
    .bind(email.month, email.code, debitId)
}

/** The cron's sweep: the records of months before this one, which nothing
 *  asks about again. Returns how many went. */
export async function sweepFreeSongEmails(
  db: D1Database,
  nowMs: number,
): Promise<number> {
  const result = await db
    .prepare('DELETE FROM freeSongEmailClaims WHERE month < ?')
    .bind(songMonth(nowMs))
    .run()
  return result.meta.changes
}
