// ============================================================
// The Ascent — path progress (the orb-ring fill engine)
// ============================================================
//
// One orb = one week; its 7-segment ring fills once per DAY the user meets
// the daily practice goal (the same signal that keeps the streak — see
// practice-minutes.ts, which calls recordPathPracticeDay on every goal-met
// day). Seven distinct days complete the week and unlock the next orb.
//
// Forgiving by design: missing a day never empties a ring, and days are
// deduped by local date so retries can't double-fill. The very first week
// starts with one segment already lit (the endowed-progress head start —
// partly-filled rings get finished far more often than empty ones).
//
// Device-local for v1 (like the daily session); the streak stays the
// cloud-synced signal.

import type { ExerciseType } from '@/features/exercises/types'
import { ASCENT_ID, ASCENT_WEEKS, DAYS_PER_WEEK, getWeek, } from '@/features/path/path-content'
import { IS_DEV, IS_TEST } from '@/lib/defaults'
import { createPersistedSignal } from '@/lib/storage'

const STORAGE_KEY = 'mp_path_progress'

/** Sentinel for the pre-lit first segment — never collides with a date. */
export const ENDOWED_DAY = 'endowed'

// ── Free-roam ────────────────────────────────────────────────────
// When on, every week is openable and practiceable — no sequential lock,
// so anyone can jump ahead and read/try a later week. When off, weeks
// unlock one at a time as the one before them fills.
//
// Default follows the build: unlocked in dev (so we can skip through all
// the content while authoring it), locked in prod. LAUNCH-DAY DECISION —
// flip this one constant to ship prod unlocked, and/or leave the Settings
// toggle (Settings › Guided Path) for users to choose per-device.
export const FREE_ROAM_DEFAULT = IS_DEV && !IS_TEST

const [freeRoam, setFreeRoam] = createPersistedSignal<boolean>(
  'mp_path_free_roam',
  FREE_ROAM_DEFAULT,
)

/** Reactive: are all weeks unlocked for free exploration? */
export const pathFreeRoam = freeRoam
export const setPathFreeRoam = setFreeRoam

export interface PathProgress {
  pathId: string
  startedAt: string // ISO
  /** 1-based order of the week currently being filled. */
  currentWeek: number
  /** week order -> distinct day stamps (YYYY-MM-DD, plus ENDOWED_DAY). */
  weekDays: Record<number, string[]>
  completedWeeks: number[]
}

export type WeekState = 'locked' | 'available' | 'active' | 'complete'

const [progress, setProgress] = createPersistedSignal<PathProgress | null>(
  STORAGE_KEY,
  null,
)

export const pathProgress = progress

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

/** Begin The Ascent — week 1 active with the endowed segment pre-lit. */
export function startAscent(): PathProgress {
  const existing = progress()
  if (existing !== null && existing.pathId === ASCENT_ID) return existing
  const fresh: PathProgress = {
    pathId: ASCENT_ID,
    startedAt: new Date().toISOString(),
    currentWeek: 1,
    weekDays: { 1: [ENDOWED_DAY] },
    completedWeeks: [],
  }
  setProgress(fresh)
  return fresh
}

/** Wipe path progress (dev/reset affordance). */
export function resetAscent(): void {
  setProgress(null)
}

/**
 * Dev-only: count one more distinct day toward the active week so we can
 * watch rings light and weeks advance without waiting for real days. Uses
 * a unique synthetic stamp, so repeated calls always add a segment.
 */
export function devMarkPracticeDay(): void {
  if (progress() === null) startAscent()
  recordPathPracticeDay(`dev-${Date.now()}-${Math.floor(Math.random() * 1e6)}`)
}

/** True once every week of the path is complete. */
export function pathComplete(p: PathProgress | null = progress()): boolean {
  return p !== null && p.completedWeeks.length >= ASCENT_WEEKS.length
}

/** Days filled for a week (0..DAYS_PER_WEEK), endowed segment included. */
export function ringFill(
  order: number,
  p: PathProgress | null = progress(),
): number {
  if (p === null) return 0
  return Math.min(DAYS_PER_WEEK, (p.weekDays[order] ?? []).length)
}

export function weekState(
  order: number,
  p: PathProgress | null = progress(),
  freeRoam: boolean = pathFreeRoam(),
): WeekState {
  // A week that isn't yet reached is 'locked' under the sequential rule,
  // but 'available' (openable + practiceable) when free-roam is on.
  const unreached: WeekState = freeRoam ? 'available' : 'locked'
  if (p === null) return order === 1 ? 'available' : unreached
  if (p.completedWeeks.includes(order)) return 'complete'
  if (pathComplete(p)) return 'complete'
  if (order === p.currentWeek) return 'active'
  return order < p.currentWeek ? 'complete' : unreached
}

/**
 * Count today toward the active week. Called by the daily-goal accumulator
 * on every goal-met day; idempotent per local date, no-op until the user
 * has started the path (or after they finish it).
 */
export function recordPathPracticeDay(date = todayStr()): void {
  const p = progress()
  if (p === null || pathComplete(p)) return

  const days = p.weekDays[p.currentWeek] ?? []
  if (days.includes(date)) return

  const nextDays = [...days, date]
  let { currentWeek } = p
  const completedWeeks = [...p.completedWeeks]

  if (nextDays.length >= DAYS_PER_WEEK) {
    if (!completedWeeks.includes(currentWeek)) completedWeeks.push(currentWeek)
    if (currentWeek < ASCENT_WEEKS.length) currentWeek += 1
  }

  setProgress({
    ...p,
    currentWeek,
    completedWeeks,
    weekDays: { ...p.weekDays, [p.currentWeek]: nextDays },
  })
}

/**
 * The active week's bound exercises — used to bias the daily session's
 * skill slots toward the current theme. Null when no path is running.
 */
export function activePathExercises(): ExerciseType[] | null {
  const p = progress()
  if (p === null || pathComplete(p)) return null
  return getWeek(p.currentWeek)?.exercises ?? null
}

/** The active week's warm-up pattern override (null = default rotation). */
export function activePathWarmup(): string | null {
  const p = progress()
  if (p === null || pathComplete(p)) return null
  return getWeek(p.currentWeek)?.warmupPattern ?? null
}
