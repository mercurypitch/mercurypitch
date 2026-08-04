// ============================================================
// Grant flush — evaluate now, persist later
// ============================================================
//
// Finishing a run used to await up to fifty serial PATCHes before the result
// card appeared. Three runs inside a minute cleared the worker's 120/min
// write cap and the retries turned a slow save into a ten-second one.
//
// Evaluation and persistence were conflated, and only one of them is urgent.
// Working out that a singer just earned "Ten Days In" takes microseconds from
// data already in memory; writing the new progress percentage of a goal they
// are 34% of the way through can wait a minute. So the engine evaluates on
// every run and queues the rows here; this module writes them at most once a
// window, in one request.
//
// The buffer is also what keeps the toasts honest. A pass that reloads its
// context from the server before the flush would see stale rows and announce
// the same unlock a second time, so the engine overlays what is pending on
// what it read (see `pendingAchievement` / `isBadgePending`).
//
// What a hard close between flushes costs: up to a window of PROGRESS
// percentages. Unlocks are recomputed from session records on the next pass,
// so nothing is permanently lost — and the flush on hide covers the ordinary
// way a tab goes away.

import { getDb } from '@/db'
import type { UserAchievement, UserBadge } from '@/db/entities'
import { getUserId } from '@/db/seed'
import { hasValidToken } from '@/db/services/auth-service'
import { getAuthHeaders } from '@/db/services/user-service'
import { API_BASE_URL } from '@/lib/defaults'

export interface PendingAchievement {
  achievementId: string
  progress: number
  unlocked: boolean
  unlockedAt?: string
}

/** How long changes may sit unwritten. */
const FLUSH_WINDOW_MS = 60_000

const pendingAchievements = new Map<string, PendingAchievement>()
const pendingBadges = new Map<string, string>() // badgeId → earnedAt

let flushTimer: ReturnType<typeof setTimeout> | undefined
let inFlight: Promise<void> | undefined
let listenersBound = false
/**
 * Bumped whenever the buffer is deliberately abandoned (sign-out). A flush
 * that fails after the identity changed must NOT put its rows back — they
 * belong to whoever earned them, and re-queuing would write them to the
 * account that signed in next.
 */
let epoch = 0

function cloudActive(): boolean {
  try {
    return API_BASE_URL != null && API_BASE_URL !== '' && hasValidToken()
  } catch {
    return false
  }
}

/** What is queued for this achievement, if anything. */
export function pendingAchievement(
  achievementId: string,
): PendingAchievement | undefined {
  return pendingAchievements.get(achievementId)
}

export function isBadgePending(badgeId: string): boolean {
  return pendingBadges.has(badgeId)
}

/** Queue a changed achievement row and arm the flush. */
export function queueAchievement(row: PendingAchievement): void {
  pendingAchievements.set(row.achievementId, row)
  armFlush()
}

/** Queue a newly-earned badge and arm the flush. */
export function queueBadge(badgeId: string, earnedAt: string): void {
  pendingBadges.set(badgeId, earnedAt)
  armFlush()
}

export function pendingCount(): number {
  return pendingAchievements.size + pendingBadges.size
}

function armFlush(): void {
  bindLifecycleListeners()
  if (flushTimer !== undefined) return
  flushTimer = setTimeout(() => {
    flushTimer = undefined
    void flushGrants()
  }, FLUSH_WINDOW_MS)
}

/**
 * A tab going away is the one moment a pending write has to make it out, and
 * an ordinary fetch is cancelled when the document unloads. `keepalive` is
 * what survives it — and unlike sendBeacon it can carry the Authorization
 * header the endpoint needs, which is the whole reason the write is a fetch
 * and not a beacon.
 */
function bindLifecycleListeners(): void {
  if (listenersBound || typeof document === 'undefined') return
  listenersBound = true
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void flushGrants(true)
  })
  // Safari does not always fire visibilitychange on a real navigation away.
  window.addEventListener('pagehide', () => void flushGrants(true))
}

/**
 * Write everything queued, in one request when signed in to the cloud.
 *
 * Failures put the rows back rather than dropping them: a flush that loses
 * the buffer would silently reset a singer's visible progress bars to
 * whatever was last stored.
 */
export async function flushGrants(unloading = false): Promise<void> {
  if (inFlight) return inFlight
  if (pendingAchievements.size === 0 && pendingBadges.size === 0) return

  if (flushTimer !== undefined) {
    clearTimeout(flushTimer)
    flushTimer = undefined
  }

  const achievements = [...pendingAchievements.values()]
  const badges = [...pendingBadges.entries()]
  pendingAchievements.clear()
  pendingBadges.clear()

  // Snapshotted here, synchronously, rather than read inside the request.
  // logout() flushes and then clears the token in the same tick; resolving
  // the identity later would send the write with no credentials.
  const cloud = cloudActive()
  const headers = { 'Content-Type': 'application/json', ...getAuthHeaders() }
  const userId = getUserId()
  const startedAt = epoch

  const restore = (): void => {
    if (epoch !== startedAt) return
    // Re-queue only what is still absent: a pass that ran while this was in
    // flight holds a fresher number, and putting the stale one back would
    // undo it.
    for (const row of achievements) {
      if (!pendingAchievements.has(row.achievementId)) {
        pendingAchievements.set(row.achievementId, row)
      }
    }
    for (const [badgeId, earnedAt] of badges) {
      if (!pendingBadges.has(badgeId)) pendingBadges.set(badgeId, earnedAt)
    }
    armFlush()
  }

  inFlight = (async () => {
    try {
      if (cloud) {
        await writeCloud(achievements, badges, { headers, unloading })
      } else {
        await writeLocal(achievements, badges, userId)
      }
    } catch {
      restore()
    } finally {
      inFlight = undefined
    }
  })()
  return inFlight
}

interface CloudWriteOptions {
  headers: Record<string, string>
  /** No userId: both endpoints take the caller's identity from the token, and
   *  a userId in the body would be a claim rather than a fact. */
  unloading: boolean
}

/**
 * Both halves of the write, each one request, each one checked.
 *
 * Both endpoints are idempotent upserts keyed on (userId, definitionId), which
 * is what makes the retry in {@link flushGrants} safe: re-sending a batch that
 * partly landed rewrites the rows that landed with the same values and inserts
 * the ones that did not. So this does not track which half succeeded — it
 * throws, and the whole batch goes back on the queue. Getting that wrong is
 * how the badge loop this replaced ended up writing a once-only badge twice.
 */
async function writeCloud(
  achievements: PendingAchievement[],
  badges: Array<[string, string]>,
  opts: CloudWriteOptions,
): Promise<void> {
  if (achievements.length > 0) {
    const res = await fetch(`${API_BASE_URL}/api/userAchievements/bulk`, {
      method: 'POST',
      headers: opts.headers,
      body: JSON.stringify({ rows: achievements }),
      keepalive: opts.unloading,
    })
    if (!res.ok) throw new Error(`bulk achievements: ${res.status}`)
  }
  if (badges.length > 0) {
    const res = await fetch(`${API_BASE_URL}/api/userBadges/bulk`, {
      method: 'POST',
      headers: opts.headers,
      body: JSON.stringify({
        rows: badges.map(([badgeId, earnedAt]) => ({ badgeId, earnedAt })),
      }),
      keepalive: opts.unloading,
    })
    if (!res.ok) throw new Error(`bulk badges: ${res.status}`)
  }
}

async function writeLocal(
  achievements: PendingAchievement[],
  badges: Array<[string, string]>,
  userId: string,
): Promise<void> {
  const db = await getDb()

  if (achievements.length > 0) {
    const repo = db.getRepository<UserAchievement>('userAchievements')
    const existing = await repo.findAll({ where: { userId } })
    const byDef = new Map(existing.map((r) => [r.achievementId, r]))
    for (const row of achievements) {
      const found = byDef.get(row.achievementId)
      const fields = {
        progress: row.progress,
        unlocked: row.unlocked,
        ...(row.unlocked
          ? { unlockedAt: row.unlockedAt ?? new Date().toISOString() }
          : {}),
      }
      if (found) await repo.update(found.id, fields)
      else
        await repo.create({
          userId,
          achievementId: row.achievementId,
          ...fields,
        })
    }
  }

  if (badges.length > 0) {
    const repo = db.getRepository<UserBadge>('userBadges')
    for (const [badgeId, earnedAt] of badges) {
      await repo.create({ userId, badgeId, earnedAt })
    }
  }
}

/**
 * Drop everything queued without writing it.
 *
 * Sign-out only, and only AFTER a flush: the rows belong to the identity that
 * earned them, and carrying them into the next session would write one
 * singer's progress onto another's account.
 */
export function discardPendingGrants(): void {
  epoch += 1
  pendingAchievements.clear()
  pendingBadges.clear()
  if (flushTimer !== undefined) {
    clearTimeout(flushTimer)
    flushTimer = undefined
  }
}
