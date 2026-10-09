// ── The credits ledger, read and written as one version of it ──
//
// A write that is computed from the ledger (a subscription period's grant,
// a refund's clawback, the native app's debit) must land only on the ledger
// it was computed from. readLedger() reads every row with a fingerprint of
// the whole ledger: its row count, its last row and its balance. A guarded
// INSERT ... SELECT re-takes that fingerprint as it writes (LEDGER_VERSION)
// and writes nothing if anything was written in between, and the writer
// reads again. The ledger is append-only, so the fingerprint only ever
// changes by a new row.
//
// Extracted from revenuecat.ts, where the subscription's grants first
// needed it, when the app's debit (app-songs.ts) needed it too.

import type { Env } from './auth'
import type { LedgerRow } from './songs-allowance'

export interface Ledger {
  rows: LedgerRow[]
  /** What a write checks the ledger still is: its rows, its last row and its
   *  balance. */
  version: string
}

/** The same fingerprint as Ledger.version, taken by the write itself. */
export const LEDGER_VERSION = `(SELECT COUNT(*) || ':' || COALESCE(MAX(rowid), 0) || ':' || COALESCE(SUM(delta), 0)
    FROM creditLedger WHERE userId = ?)`

/** Reads before a write that loses to a concurrent one, before giving up
 *  and leaving it to the caller's retry: RevenueCat delivers the event
 *  again, and the main worker asks for the app's debit again, once
 *  (billing.ts answers LedgerBusy with a 503 that says so). */
export const LEDGER_ATTEMPTS = 5

/** The ledger kept changing under a write, LEDGER_ATTEMPTS times: nothing
 *  was written, and the same write may be tried again. */
export class LedgerBusy extends Error {
  override name = 'LedgerBusy'
}

/** Ledger.version, from the rows as read: what LEDGER_VERSION computes. */
function versionOf(
  rows: ReadonlyArray<{ seq: number; delta: number }>,
): string {
  const balance = rows.reduce((sum, row) => sum + Number(row.delta), 0)
  const last = rows.length === 0 ? 0 : rows[rows.length - 1].seq
  return `${rows.length}:${last}:${balance}`
}

export async function readLedger(env: Env, userId: string): Promise<Ledger> {
  const { results } = await env.DB.prepare(
    `SELECT rowid AS seq, createdAt, delta, reason, jobRef, idempotencyKey
       FROM creditLedger WHERE userId = ? ORDER BY rowid`,
  )
    .bind(userId)
    .all<LedgerRow & { seq: number }>()
  return { rows: results, version: versionOf(results) }
}

/** A row with what names it: its own id, and the Stripe payment behind it. */
export type NamedLedgerRow = LedgerRow & {
  id: string
  createdAt: string
  paymentIntentId: string | null
}

/** readLedger, with each row's id and PaymentIntent too: what a withdrawal
 *  counts a pack by (withdrawal.ts). Same version. */
export async function readNamedLedger(
  env: Env,
  userId: string,
): Promise<{ rows: NamedLedgerRow[]; version: string }> {
  const { results } = await env.DB.prepare(
    `SELECT rowid AS seq, id, createdAt, delta, reason, jobRef, idempotencyKey, paymentIntentId
       FROM creditLedger WHERE userId = ? ORDER BY rowid`,
  )
    .bind(userId)
    .all<NamedLedgerRow & { seq: number }>()
  return { rows: results, version: versionOf(results) }
}

/** Write the row `key` names, as `rowFor` computes it from the ledger as
 *  read, only if the ledger is still what was read; else read it again.
 *  Returns the row's delta, also when an earlier delivery wrote it. */
export async function writeOnLedger(
  env: Env,
  userId: string,
  key: string,
  reason: string,
  rowFor: (ledger: Ledger) => { delta: number; jobRef: string | null },
): Promise<number> {
  for (let attempt = 0; attempt < LEDGER_ATTEMPTS; attempt += 1) {
    const ledger = await readLedger(env, userId)
    const { delta, jobRef } = rowFor(ledger)
    await env.DB.prepare(
      `INSERT OR IGNORE INTO creditLedger (id, createdAt, userId, delta, reason, jobRef, idempotencyKey)
       SELECT ?, ?, ?, ?, ?, ?, ?
        WHERE ${LEDGER_VERSION} = ?`,
    )
      .bind(
        crypto.randomUUID(),
        new Date().toISOString(),
        userId,
        delta,
        reason,
        jobRef,
        key,
        userId,
        ledger.version,
      )
      .run()
    const row = await env.DB.prepare(
      'SELECT delta FROM creditLedger WHERE idempotencyKey = ?',
    )
      .bind(key)
      .first<{ delta: number }>()
    if (row !== null) return row.delta
  }
  throw new LedgerBusy(`${key}: the ledger kept changing under the write`)
}
