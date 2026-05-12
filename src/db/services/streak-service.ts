// ============================================================
// Streak Service — consecutive daily practice tracking
// ============================================================

import { getDb } from '@/db'
import type { UserProfile } from '@/db/entities'

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10)
}

function yesterdayDateString(): string {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return d.toISOString().slice(0, 10)
}

/**
 * Compute and persist the current practice streak.
 * - First session ever: streak = 1
 * - Already practiced today: streak unchanged
 * - Practiced yesterday: streak += 1
 * - Missed one or more days: streak = 1 (reset)
 *
 * Returns the new streak value.
 */
export async function updatePracticeStreak(): Promise<number> {
  try {
    const db = await getDb()
    const repo = db.getRepository<UserProfile>('userProfiles')
    const profiles = await repo.findAll()
    const profile = profiles[0]

    const today = todayDateString()
    const yesterday = yesterdayDateString()
    const lastDate = profile?.lastPracticeDate ?? null

    let newStreak: number

    if (lastDate === null || lastDate === '') {
      newStreak = 1
    } else if (lastDate === today) {
      newStreak = profile?.currentStreak ?? 1
    } else if (lastDate === yesterday) {
      newStreak = (profile?.currentStreak ?? 0) + 1
    } else {
      newStreak = 1
    }

    if (profile !== undefined) {
      await repo.update(profile.id, {
        lastPracticeDate: today,
        currentStreak: newStreak,
      })
    }

    return newStreak
  } catch {
    return 0
  }
}

/**
 * Get the current streak without modifying it.
 */
export async function getCurrentStreak(): Promise<number> {
  try {
    const db = await getDb()
    const repo = db.getRepository<UserProfile>('userProfiles')
    const profiles = await repo.findAll()
    const profile = profiles[0]

    if (
      profile === undefined ||
      profile.lastPracticeDate === null ||
      profile.lastPracticeDate === ''
    )
      return 0

    const today = todayDateString()
    const yesterday = yesterdayDateString()

    if (
      profile.lastPracticeDate === today ||
      profile.lastPracticeDate === yesterday
    ) {
      return profile.currentStreak
    }
    return 0
  } catch {
    return 0
  }
}
