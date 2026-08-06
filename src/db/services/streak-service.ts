// ============================================================
// Streak Service — consecutive daily practice with forgiveness
// ============================================================
//
// A day counts once the user has practiced ~5 scored minutes (the gate lives
// in practice-minutes.ts, which calls updatePracticeStreak). Forgiveness comes
// in two currencies, and the card shows one at a time:
//   - Freezes: a short gap auto-consumes freezes instead of resetting. You
//     start with two and accrue one per thirty days waited, capped at three.
//     Nothing the singer clicks spends one.
//   - Repair: a streak the freezes could NOT save can be restored once, free,
//     within a 72h window (once per 30 days). It never touches the freeze
//     count — that separation is why both used to be on screen together, and
//     why `computeStreakState` now keeps them apart.
//
// Accrual used to be "one per seven days of streak", which gave forgiveness to
// whoever was already keeping a streak and none to whoever had just lost one.
// It is now a clock, so an idle month accrues too — which is what
// `lastFreezeEarnedDate` exists for.
//
// The date math and state transitions are pure functions (exported for tests);
// the async wrappers just load/persist the profile row.

import { getDb } from '@/db'
import type { UserProfile } from '@/db/entities'
import { findOwnProfile } from '@/db/services/user-service'

export const MAX_FREEZES = 3
/**
 * What a new singer starts with. Two, because a beginner who breaks on day
 * three is exactly the person who never comes back, and the old rule handed
 * them nothing: freezes accrued at streak multiples of seven, so forgiveness
 * went to whoever was already doing well and none to whoever needed it.
 *
 * Handed out by `accrueFreezes` when a profile has no accrual anchor yet, so
 * an account that predates the rule picks it up on its next read. It used to
 * be spelled as a default in `streakFieldsOf` — see the note there for why
 * that quietly gave it to nobody. `scripts/grant-starting-freezes.sql` was
 * written to top those accounts up by hand and is no longer needed.
 */
export const STARTING_FREEZES = 2
/** One freeze per whole thirty days waited, banked or not. */
const FREEZE_ACCRUAL_DAYS = 30
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
  /**
   * When the accrual clock last ticked — NOT when a freeze was last spent.
   * Its own field precisely because accrual has to survive an idle month: a
   * count derived from practice dates would only ever grow for people who
   * practise, which is the bias this replaced.
   */
  lastFreezeEarnedDate: string | null
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
    // Mirror the column default (0) rather than defaulting to
    // `STARTING_FREEZES` here. Granting the opening balance is `accrueFreezes`'
    // job and only its job — doing it at read time looked equivalent and was
    // not, because a stored `0` is not nullish, so the fallback only ever fired
    // for a profile that did not exist.
    streakFreezes: p?.streakFreezes ?? 0,
    lastPracticeDate: p?.lastPracticeDate ?? null,
    lastFreezeUsedDate: p?.lastFreezeUsedDate ?? null,
    previousStreak: p?.previousStreak ?? 0,
    streakResetDate: p?.streakResetDate ?? null,
    lastRepairDate: p?.lastRepairDate ?? null,
    lastFreezeEarnedDate: p?.lastFreezeEarnedDate ?? null,
  }
}

/** `days` after a YYYY-MM-DD date, as YYYY-MM-DD. */
function addDays(date: string, days: number): string {
  const t = Date.parse(`${date}T00:00:00Z`)
  if (Number.isNaN(t)) return date
  return new Date(t + days * 86_400_000).toISOString().slice(0, 10)
}

/**
 * Bank whatever the clock owes. Pure, and safe to call on every read: it is
 * a function of the stored anchor and today, so calling it twice in a day
 * grants nothing the second time.
 *
 * Time spent at the cap is spent, not banked — the anchor advances by the
 * periods that elapsed whether or not the count could take them. Otherwise a
 * singer sitting at three for half a year would spend one and be handed six
 * back, which is not a cap.
 */
export function accrueFreezes(f: StreakFields, today: string): StreakFields {
  const anchor = f.lastFreezeEarnedDate
  // No clock yet: start it, and hand over the opening balance.
  //
  // This is the ONLY place `STARTING_FREEZES` is granted, and it has to be a
  // grant rather than a read-time default. `streakFieldsOf` used to spell it
  // `p?.streakFreezes ?? STARTING_FREEZES`, which never fired for a real
  // account: `streakFreezes` is `INTEGER NOT NULL DEFAULT 0`, so every stored
  // profile holds a literal 0 and `0 ?? 2` is 0. The constant only applied to
  // `streakFieldsOf(undefined)` — no profile at all — which is exactly what
  // the unit test asserted, so the test passed while no user on dev or prod
  // had ever received a starting freeze.
  //
  // A null anchor is precisely "this profile has never taken part in the
  // freeze economy", so it is the right moment to seed. `lastFreezeUsedDate`
  // guards it: somebody who has already spent their two must not be handed
  // two more the next time the anchor happens to be missing. `Math.max`
  // rather than assignment so an older balance earned under the milestone
  // rules is never taken away.
  if (anchor === null || anchor === '') {
    return {
      ...f,
      streakFreezes:
        f.lastFreezeUsedDate === null
          ? Math.max(f.streakFreezes, STARTING_FREEZES)
          : f.streakFreezes,
      lastFreezeEarnedDate: today,
    }
  }
  const elapsed = daysBetween(anchor, today)
  if (!Number.isFinite(elapsed) || elapsed < FREEZE_ACCRUAL_DAYS) return f
  const periods = Math.floor(elapsed / FREEZE_ACCRUAL_DAYS)
  return {
    ...f,
    streakFreezes: Math.min(MAX_FREEZES, f.streakFreezes + periods),
    lastFreezeEarnedDate: addDays(anchor, periods * FREEZE_ACCRUAL_DAYS),
  }
}

/**
 * Advance the streak for a practice that happened today. Pure — returns the
 * next StreakFields. Handles first-ever, same-day (idempotent), yesterday,
 * and gap (freeze-bridge or reset-with-snapshot).
 */
export function advanceStreak(
  fields: StreakFields,
  today: string,
): StreakFields {
  // Accrue FIRST, deliberately. The gap being bridged is itself time waited,
  // so a singer coming back after five weeks should spend the freeze that
  // waiting earned them — settling up afterwards would let the same absence
  // break the streak and then pay for it.
  const f = accrueFreezes(fields, today)
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

  // Already counted today — idempotent for the streak, though an accrual that
  // came due today still has to be kept.
  if (gap <= 0) return f

  if (gap === 1) {
    const currentStreak = f.currentStreak + 1
    return {
      ...f,
      currentStreak,
      longestStreak: Math.max(f.longestStreak, currentStreak),
      lastPracticeDate: today,
    }
  }

  // gap >= 2: missed (gap - 1) whole days.
  const missedDays = gap - 1
  if (f.streakFreezes >= missedDays) {
    // Freezes bridge the gap — streak survives, freezes consumed.
    const currentStreak = f.currentStreak + 1
    return {
      ...f,
      currentStreak,
      streakFreezes: f.streakFreezes - missedDays,
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
  fields: StreakFields,
  today: string,
): StreakState {
  // The card must show what the singer HAS, and an accrual that came due
  // while they were away is theirs before they next practise. Pure: this
  // reports the number, `advanceStreak` is what persists it.
  const f = accrueFreezes(fields, today)
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

  // ONE forgiveness path at a time. Two of them on screen together is what
  // made this confusing: freezes are spent for you, repair is a button, and a
  // card offering both invited the reasonable guess that the button spends a
  // freeze — it does not, and `applyRepair` never touches the count.
  //
  // The dividing line is whether the freezes can still save THIS streak, not
  // whether the singer happens to hold any. `hasPendingBreak` already requires
  // `gap - 1 > streakFreezes`, so it only fires on a gap the freezes cannot
  // bridge; `atRisk` covers the case where they can. What is added here is the
  // same exclusivity for a break already recorded.
  //
  // Note this is NOT "offer repair only when freezes are empty", which is the
  // shorter rule and the wrong one: two freezes cannot bridge three missed
  // days, so a literal reading would strand a broken streak next to two
  // freezes that can no longer help it — and with a start of two and monthly
  // accrual, most singers hold one most of the time, which would delete
  // repair rather than sequence it.
  const freezesProtectStreak = atRisk && f.streakFreezes > 0
  const canRepair =
    cooldownOk &&
    !freezesProtectStreak &&
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

/**
 * Pure repair transition — restores the streak and counts today.
 *
 * Deliberately does NOT spend a freeze. Repair is the other path, not a
 * second way to spend the same currency; `computeStreakState` is what keeps
 * the two from being offered at once.
 */
export function applyRepair(fields: StreakFields, today: string): StreakFields {
  // Same accrual the card just showed, so a repair does not silently discard
  // a freeze that came due today.
  const f = accrueFreezes(fields, today)
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
    lastFreezeEarnedDate: f.lastFreezeEarnedDate,
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

/**
 * Why a repair did not happen, when it did not.
 *
 * It used to return `0` for all three of "no profile", "not repairable" and
 * "the write threw", which the caller could not tell apart from each other or
 * from a genuinely repaired streak of zero — so a click that did nothing
 * looked exactly like one that worked. A repair is offered once every thirty
 * days; failing it silently is the worst place to be quiet.
 */
export type RepairResult =
  | { ok: true; streak: number }
  | { ok: false; reason: 'no-profile' | 'not-repairable' | 'error' }

/** Repair a recently-broken streak. */
export async function repairStreak(): Promise<RepairResult> {
  try {
    const db = await getDb()
    const repo = db.getRepository<UserProfile>('userProfiles')
    const profile = await findOwnProfile(repo)
    if (profile === undefined) return { ok: false, reason: 'no-profile' }

    const today = todayDateString()
    const fields = streakFieldsOf(profile)
    if (!computeStreakState(fields, today).canRepair) {
      return { ok: false, reason: 'not-repairable' }
    }
    const next = applyRepair(fields, today)
    await repo.update(profile.id, streakPatch(next))
    return { ok: true, streak: next.currentStreak }
  } catch {
    return { ok: false, reason: 'error' }
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
