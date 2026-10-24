// ============================================================
// Plan precedence — which plan record stands when a device meets the account
// ============================================================
//
// The settings sync asks this when this device's unsent plan record and the
// account's differ (App registers it for PLAN_RECORD_KEY before the first
// pull), so a 'shown' or a 'declined' written before a pull never replaces
// a plan the person answered on another device.
//
// App loads this on every visit, so it takes no runtime import: the rule
// reads a record by its shape (version, status, dates) and never asks
// isPlanRecordV1, which would bring the questions' tables and copy into
// every first paint. Ranking needs nothing more. app-plan-pause.test.ts
// holds it to no runtime import.

import type { PlanStatus } from './plan-record'

/**
 * How far along a stored value is: a plan only ever moves forward. A value
 * no record can be read from (a newer client's, or damage) sits below an
 * answer and above the rest: it gives way only to an answer, as the store's
 * writers do.
 */
const STATUS_RANK: Record<PlanStatus, number> = {
  shown: 0,
  declined: 1,
  answered: 3,
}
const UNREADABLE_RANK = 2

/** What the rule reads of a record. */
interface Ranked {
  status: PlanStatus
  at: string
  syncedAt: string | undefined
}

/**
 * A stored value read by its shape, or null when it is unreadable: version 1,
 * a status the rank knows, a text `at`, and a `syncedAt` that is absent or
 * text. The choices are not looked at: they do not rank.
 */
function readRanked(serialized: string): Ranked | null {
  let val: unknown
  try {
    val = JSON.parse(serialized)
  } catch {
    return null
  }
  if (typeof val !== 'object' || val === null) return null
  const { v, status, at, syncedAt } = val as Record<string, unknown>
  if (v !== 1 || typeof at !== 'string') return null
  if (syncedAt !== undefined && typeof syncedAt !== 'string') return null
  if (typeof status !== 'string' || !Object.hasOwn(STATUS_RANK, status))
    return null
  return { status: status as PlanStatus, at, syncedAt }
}

function rankOf(record: Ranked | null): number {
  return record === null ? UNREADABLE_RANK : STATUS_RANK[record.status]
}

/**
 * Which of two stored records stands when this device's value meets the
 * account's. Both are the values as stored and synced. The further along
 * wins (STATUS_RANK); then the later `at` (both come from toISOString, so
 * text order is time order); then the one the account has received. A tie
 * leaves the account's value standing.
 */
export function preferPlanRecord(
  local: string,
  remote: string,
): 'local' | 'remote' {
  if (local === remote) return 'remote'
  const mine = readRanked(local)
  const theirs = readRanked(remote)
  const rank = rankOf(mine) - rankOf(theirs)
  if (rank !== 0) return rank > 0 ? 'local' : 'remote'
  // The same rank with one side unreadable is both unreadable.
  if (mine === null || theirs === null) return 'remote'
  if (mine.at !== theirs.at) return mine.at > theirs.at ? 'local' : 'remote'
  const mineSynced = mine.syncedAt !== undefined
  if (mineSynced === (theirs.syncedAt !== undefined)) return 'remote'
  return mineSynced ? 'local' : 'remote'
}
