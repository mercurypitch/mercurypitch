// ============================================================
// User activity — the acts worth telling someone about
// ============================================================
//
// "You made four playlists and sang two of them start to finish" is a
// better reason to come back than "your best score is 92%". Scores come
// from sessionRecords; this records the acts that leave no practice
// session behind.
//
// Recording is FIRE-AND-FORGET by design. Every call site is in the
// middle of something the singer actually cares about — finishing a
// playlist, saving a melody — and none of them should slow down, fail,
// or show an error because a metric did not save. Signed out it is inert:
// there is no account to attribute the act to, and inventing a local
// queue would mean deciding later whose acts these were, which is the
// shared-PC problem voiceprints already had to solve the hard way.

import { getDb } from '@/db'
import type { UserActivity, UserActivityKind } from '@/db/entities'
import { hasValidToken } from '@/db/services/auth-service'
import { getUserId } from '@/db/services/user-service'
import { API_BASE_URL } from '@/lib/defaults'

function cloudActive(): boolean {
  try {
    return API_BASE_URL != null && API_BASE_URL !== '' && hasValidToken()
  } catch {
    return false
  }
}

/**
 * Note that something happened. Never throws, never blocks the caller —
 * await it only when a test needs the write to have landed.
 */
export async function recordActivity(
  kind: UserActivityKind,
  options: { refId?: string; meta?: Record<string, unknown>; at?: string } = {},
): Promise<void> {
  if (!cloudActive()) return
  const ownerId = getUserId()
  try {
    const db = await getDb()
    if (getUserId() !== ownerId) return
    const repo = db.getRepository<UserActivity>('userActivity')
    await repo.create({
      userId: ownerId,
      kind,
      refId: options.refId,
      metaJson:
        options.meta === undefined ? undefined : JSON.stringify(options.meta),
      at: options.at ?? new Date().toISOString(),
    })
  } catch (err) {
    // Audible but harmless: a lost metric must never surface to the
    // singer, and silence is what let the voiceprint routing bug hide.
    console.warn(`[activity] could not record "${kind}"`, err)
  }
}

/** How many times each kind has happened, for the profile. */
export type ActivityCounts = Partial<Record<UserActivityKind, number>>

/**
 * Kinds that count THINGS, not events — the same refId twice is the same
 * thing, seen twice.
 *
 * `melody_created` fires when a melody's note count goes from zero to
 * non-zero, which is the only signal the store has that a blank became a
 * real melody. It is not a create hook: clear a melody and write into it
 * again and it fires a second time for the same melody. "Write 20 melodies
 * of your own" would then be satisfied by one melody and a lot of undo.
 *
 * Everything else counts every row on purpose. Singing a song again is
 * another performance, and splitting a track again is another (paid) job —
 * those are events, and repeating them is the achievement.
 */
const COUNTED_ONCE_PER_REF: ReadonlySet<UserActivityKind> = new Set([
  'melody_created',
])

/**
 * The signed-in singer's activity totals. Empty signed out, and empty
 * rather than thrown on any failure — a profile that cannot reach the
 * account should show what it has, not an error.
 */
export async function loadActivityCounts(): Promise<ActivityCounts> {
  if (!cloudActive()) return {}
  try {
    const db = await getDb()
    const repo = db.getRepository<UserActivity>('userActivity')
    const rows = await repo.findAll({ where: { userId: getUserId() } })
    return countActivity(rows)
  } catch {
    return {}
  }
}

/** Exported for the test that pins the once-per-ref rule. */
export function countActivity(
  rows: ReadonlyArray<Pick<UserActivity, 'kind' | 'refId'>>,
): ActivityCounts {
  const counts: ActivityCounts = {}
  const seen = new Set<string>()
  for (const row of rows) {
    if (COUNTED_ONCE_PER_REF.has(row.kind) && row.refId !== undefined) {
      const key = `${row.kind}:${row.refId}`
      if (seen.has(key)) continue
      seen.add(key)
    }
    counts[row.kind] = (counts[row.kind] ?? 0) + 1
  }
  return counts
}

/** The most recent acts, newest first — the profile's activity strip. */
export async function loadRecentActivity(limit = 20): Promise<UserActivity[]> {
  if (!cloudActive()) return []
  try {
    const db = await getDb()
    const repo = db.getRepository<UserActivity>('userActivity')
    return await repo.findAll({
      where: { userId: getUserId() },
      orderBy: 'at',
      orderDir: 'desc',
      limit,
    })
  } catch {
    return []
  }
}

export interface ProgressActivityRecords {
  records: UserActivity[]
  available: boolean
  complete: boolean
  totalAvailable: number | null
}

/** Audited, bounded activity history for account-level Progress totals. */
export async function loadProgressActivityRecords(
  options: { pageSize?: number; maxRecords?: number } = {},
): Promise<ProgressActivityRecords> {
  const ownerId = getUserId()
  if (!cloudActive()) {
    return { records: [], available: true, complete: true, totalAvailable: 0 }
  }

  const pageSize = Math.min(1000, Math.max(1, options.pageSize ?? 500))
  const maxRecords = Math.max(pageSize, options.maxRecords ?? 5000)
  try {
    const db = await getDb()
    if (getUserId() !== ownerId) throw new Error('identity changed')
    const repo = db.getRepository<UserActivity>('userActivity')
    const where = { userId: ownerId }
    const initialTotal = await repo.count({ where, throwOnError: true })
    const target = Math.min(initialTotal, maxRecords)
    const records: UserActivity[] = []
    const seen = new Set<string>()
    let offset = 0

    while (offset < target) {
      const requested = Math.min(pageSize, target - offset)
      const page = await repo.findAll({
        where,
        orderBy: 'at',
        orderDir: 'desc',
        limit: requested,
        offset,
        throwOnError: true,
      })
      if (getUserId() !== ownerId) throw new Error('identity changed')
      if (page.length === 0) break
      offset += page.length
      for (const record of page) {
        if (seen.has(record.id)) continue
        seen.add(record.id)
        records.push(record)
      }
      if (page.length < requested) break
    }

    records.sort((a, b) => {
      const at = b.at.localeCompare(a.at)
      return at !== 0 ? at : b.id.localeCompare(a.id)
    })
    const finalTotal = await repo.count({ where, throwOnError: true })
    if (getUserId() !== ownerId) throw new Error('identity changed')
    const totalAvailable = finalTotal >= records.length ? finalTotal : null
    return {
      records,
      available: true,
      complete:
        initialTotal === finalTotal &&
        initialTotal <= maxRecords &&
        records.length === initialTotal,
      totalAvailable,
    }
  } catch {
    return {
      records: [],
      available: false,
      complete: false,
      totalAvailable: null,
    }
  }
}
