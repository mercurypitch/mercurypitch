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
  try {
    const db = await getDb()
    const repo = db.getRepository<UserActivity>('userActivity')
    await repo.create({
      userId: getUserId(),
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
    const counts: ActivityCounts = {}
    for (const row of rows) {
      counts[row.kind] = (counts[row.kind] ?? 0) + 1
    }
    return counts
  } catch {
    return {}
  }
}

/** The most recent acts, newest first — the profile's activity strip. */
export async function loadRecentActivity(limit = 20): Promise<UserActivity[]> {
  if (!cloudActive()) return []
  try {
    const db = await getDb()
    const repo = db.getRepository<UserActivity>('userActivity')
    const rows = await repo.findAll({ where: { userId: getUserId() } })
    return [...rows].sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit)
  } catch {
    return []
  }
}
