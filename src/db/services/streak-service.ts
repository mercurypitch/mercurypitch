// ============================================================
// Streak Service — consecutive daily practice with forgiveness
// ============================================================
//
// A day counts once the user has practiced ~5 scored minutes (the gate lives
// in practice-minutes.ts, which calls updatePracticeStreak). Forgiveness:
//   - Freezes: a short gap auto-consumes freezes instead of resetting. You
//     earn one each time the streak crosses a multiple of 7 (cap 2).
//   - Repair: a recently-broken streak can be restored once, free, within a
//     72h window (once per 30 days).
//
// The date math and state transitions are pure functions (exported for tests);
// the async wrappers just load/persist the profile row.

import { getDb } from '@/db'
import type { UserProfile } from '@/db/entities'
import { findOwnProfile } from '@/db/services/user-service'

export const MAX_FREEZES = 2
const FREEZE_EARN_EVERY = 7
const REPAIR_WINDOW_DAYS = 3 // ~72h
const REPAIR_COOLDOWN_DAYS = 30

/** The streak-relevant subset of a profile, defaulted for older/absent rows. */
export interface StreakFields {
  currentStreak: number
  longestStreak: number
  streakFreezes: number
  lastPracticeDate: string | null
  lastFreezeUsedDate: string | null
  previousStreak: number
  streakResetDate: string | null
  lastRepairDate: string | null
}

/** What the Home streak card renders. */
export interface StreakState {
  currentStreak: number
  longestStreak: number
  freezes: number
  maxFreezes: number
  /** Practiced today already (streak is safe for today). */
  practicedToday: boolean
  /** Streak is alive but needs practice today to continue. */
  atRisk: boolean
  canRepair: boolean
  /** Streak value the repair would restore to (0 when !canRepair). */
  repairableStreak: number
}

export function todayDateString(): string {
  return new Date().toISOString().slice(0, 10)
}

/** Whole-day difference b - a for two YYYY-MM-DD strings (UTC-safe). */
export function daysBetween(a: string, b: string): number {
  const ta = Date.parse(`${a}T00:00:00Z`)
  const tb = Date.parse(`${b}T00:00:00Z`)
  if (Number.isNaN(ta) || Number.isNaN(tb)) return NaN
  return Math.round((tb - ta) / 86_400_000)
}

export function streakFieldsOf(
  p: Partial<UserProfile> | undefined,
): StreakFields {
  return {
    currentStreak: p?.currentStreak ?? 0,
    longestStreak: p?.longestStreak ?? p?.currentStreak ?? 0,
    streakFreezes: p?.streakFreezes ?? 0,
    lastPracticeDate: p?.lastPracticeDate ?? null,
    lastFreezeUsedDate: p?.lastFreezeUsedDate ?? null,
    previousStreak: p?.previousStreak ?? 0,
    streakResetDate: p?.streakResetDate ?? null,
    lastRepairDate: p?.lastRepairDate ?? null,
  }
}

function earnFreezeIfMilestone(streak: number, freezes: number): number {
  if (streak > 0 && streak % FREEZE_EARN_EVERY === 0) {
    return Math.min(MAX_FREEZES, freezes + 1)
  }
  return freezes
}

/**
 * Advance the streak for a practice that happened today. Pure — returns the
 * next StreakFields. Handles first-ever, same-day (idempotent), yesterday,
 * and gap (freeze-bridge or reset-with-snapshot).
 */
export function advanceStreak(f: StreakFields, today: string): StreakFields {
  const last = f.lastPracticeDate
  if (last === null || last === '') {
    const currentStreak = 1
    return {
      ...f,
      currentStreak,
      longestStreak: Math.max(f.longestStreak, currentStreak),
      lastPracticeDate: today,
    }
  }

  const gap = daysBetween(last, today)

  // Already counted today — idempotent.
  if (gap <= 0) return f

  if (gap === 1) {
    const currentStreak = f.currentStreak + 1
    return {
      ...f,
      currentStreak,
      streakFreezes: earnFreezeIfMilestone(currentStreak, f.streakFreezes),
      longestStreak: Math.max(f.longestStreak, currentStreak),
      lastPracticeDate: today,
    }
  }

  // gap >= 2: missed (gap - 1) whole days.
  const missedDays = gap - 1
  if (f.streakFreezes >= missedDays) {
    // Freezes bridge the gap — streak survives, freezes consumed.
    const currentStreak = f.currentStreak + 1
    const afterConsume = f.streakFreezes - missedDays
    return {
      ...f,
      currentStreak,
      streakFreezes: earnFreezeIfMilestone(currentStreak, afterConsume),
      lastFreezeUsedDate: today,
      longestStreak: Math.max(f.longestStreak, currentStreak),
      lastPracticeDate: today,
    }
  }

  // Not enough freezes — reset, snapshotting the old streak for repair.
  return {
    ...f,
    previousStreak: f.currentStreak,
    streakResetDate: today,
    currentStreak: 1,
    lastPracticeDate: today,
  }
}

/** Pure read model for the streak card — never mutates. */
export function computeStreakState(
  f: StreakFields,
  today: string,
): StreakState {
  const last = f.lastPracticeDate
  const gap = last !== null && last !== '' ? daysBetween(last, today) : null

  let displayStreak: number
  let practicedToday = false
  let atRisk = false
  if (gap === null) {
    displayStreak = 0
  } else if (gap <= 0) {
    displayStreak = f.currentStreak
    practicedToday = true
  } else if (gap === 1) {
    displayStreak = f.currentStreak
    atRisk = true
  } else {
    const missedDays = gap - 1
    if (f.streakFreezes >= missedDays) {
      displayStreak = f.currentStreak // freezes will bridge on next practice
      atRisk = true
    } else {
      displayStreak = 0 // broken
    }
  }

  const cooldownOk =
    f.lastRepairDate === null ||
    f.lastRepairDate === '' ||
    daysBetween(f.lastRepairDate, today) >= REPAIR_COOLDOWN_DAYS

  const hasRecordedReset =
    f.previousStreak > 0 &&
    f.streakResetDate !== null &&
    f.streakResetDate !== '' &&
    daysBetween(f.streakResetDate, today) <= REPAIR_WINDOW_DAYS

  const hasPendingBreak =
    gap !== null &&
    gap >= 2 &&
    gap - 1 > f.streakFreezes &&
    gap - 1 <= REPAIR_WINDOW_DAYS &&
    f.currentStreak >= 2

  const repairableStreak =
    (hasRecordedReset ? f.previousStreak : f.currentStreak) + 1
  const canRepair =
    cooldownOk &&
    (hasRecordedReset || hasPendingBreak) &&
    repairableStreak > displayStreak

  return {
    currentStreak: displayStreak,
    longestStreak: Math.max(f.longestStreak, displayStreak),
    freezes: f.streakFreezes,
    maxFreezes: MAX_FREEZES,
    practicedToday,
    atRisk,
    canRepair,
    repairableStreak: canRepair ? repairableStreak : 0,
  }
}

/** Pure repair transition — restores the streak and counts today. */
export function applyRepair(f: StreakFields, today: string): StreakFields {
  const state = computeStreakState(f, today)
  if (!state.canRepair) return f
  const currentStreak = state.repairableStreak
  return {
    ...f,
    currentStreak,
    longestStreak: Math.max(f.longestStreak, currentStreak),
    lastPracticeDate: today,
    previousStreak: 0,
    streakResetDate: null,
    lastRepairDate: today,
  }
}

/** Columns we persist back — only the streak subset. */
function streakPatch(f: StreakFields): Partial<UserProfile> {
  return {
    currentStreak: f.currentStreak,
    longestStreak: f.longestStreak,
    streakFreezes: f.streakFreezes,
    lastPracticeDate: f.lastPracticeDate,
    lastFreezeUsedDate: f.lastFreezeUsedDate,
    previousStreak: f.previousStreak,
    streakResetDate: f.streakResetDate,
    lastRepairDate: f.lastRepairDate,
  }
}

/**
 * Record a practice for today and persist the advanced streak.
 * Returns the new streak value (0 if no profile / on error).
 */
export async function updatePracticeStreak(): Promise<number> {
  try {
    const db = await getDb()
    const repo = db.getRepository<UserProfile>('userProfiles')
    const profile = await findOwnProfile(repo)
    if (profile === undefined) return 0

    const today = todayDateString()
    const next = advanceStreak(streakFieldsOf(profile), today)
    await repo.update(profile.id, streakPatch(next))
    return next.currentStreak
  } catch {
    return 0
  }
}

/** Read the full streak state for the Home card (no mutation). */
export async function getStreakState(): Promise<StreakState> {
  const empty = computeStreakState(streakFieldsOf(undefined), todayDateString())
  try {
    const db = await getDb()
    const repo = db.getRepository<UserProfile>('userProfiles')
    const profile = await findOwnProfile(repo)
    return computeStreakState(streakFieldsOf(profile), todayDateString())
  } catch {
    return empty
  }
}

/** Repair a recently-broken streak. Returns the restored streak, or 0. */
export async function repairStreak(): Promise<number> {
  try {
    const db = await getDb()
    const repo = db.getRepository<UserProfile>('userProfiles')
    const profile = await findOwnProfile(repo)
    if (profile === undefined) return 0

    const today = todayDateString()
    const fields = streakFieldsOf(profile)
    if (!computeStreakState(fields, today).canRepair) return 0
    const next = applyRepair(fields, today)
    await repo.update(profile.id, streakPatch(next))
    return next.currentStreak
  } catch {
    return 0
  }
}

/**
 * Get the current streak without modifying it. Kept for existing callers
 * (badge engine, leaderboard); now accounts for freezes via the read model.
 */
export async function getCurrentStreak(): Promise<number> {
  try {
    const db = await getDb()
    const repo = db.getRepository<UserProfile>('userProfiles')
    const profile = await findOwnProfile(repo)
    return computeStreakState(streakFieldsOf(profile), todayDateString())
      .currentStreak
  } catch {
    return 0
  }
}
