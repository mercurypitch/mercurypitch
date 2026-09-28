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
 *  again, and a separation the app could not pay for is cancelled. */
export const LEDGER_ATTEMPTS = 5

export async function readLedger(env: Env, userId: string): Promise<Ledger> {
  const { results } = await env.DB.prepare(
    `SELECT rowid AS seq, delta, reason, jobRef, idempotencyKey
       FROM creditLedger WHERE userId = ? ORDER BY rowid`,
  )
    .bind(userId)
    .all<LedgerRow & { seq: number }>()
  const balance = results.reduce((sum, row) => sum + Number(row.delta), 0)
  const last = results.length === 0 ? 0 : results[results.length - 1].seq
  return { rows: results, version: `${results.length}:${last}:${balance}` }
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
  throw new Error(`${key}: the ledger kept changing under the write`)
}
