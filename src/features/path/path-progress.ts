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
// Stored locally and mirrored to the signed-in account (settings-service
// syncs PATH_PROGRESS_KEY). Sign-in UNIONS the two sides via
// mergePathProgress rather than letting the cloud win — a device that
// practised offline must never lose days to a staler copy.

import type { ExerciseType } from '@/features/exercises/types'
import type { PathWeek } from '@/features/path/path-content'
import { ASCENT_ID, ASCENT_WEEKS, DAYS_PER_WEEK, getWeek, } from '@/features/path/path-content'
import { IS_DEV, IS_TEST } from '@/lib/defaults'
import { createPersistedSignal } from '@/lib/storage'

/** Also the cloud-sync key — see settings-service's INCLUDED_KEYS. */
export const PATH_PROGRESS_KEY = 'mp_path_progress'
const STORAGE_KEY = PATH_PROGRESS_KEY

/** Sentinel for the pre-lit first segment — never collides with a date. */
export const ENDOWED_DAY = 'endowed'

// ── Free-roam ────────────────────────────────────────────────────
// When on, every week is openable and practiceable — no sequential lock,
// so anyone can jump ahead and read/try a later week. When off, weeks
// unlock one at a time as the one before them fills.
//
// DECIDED (owner, 2026-08-02): prod ships LOCKED. Singers walk the
// journey in order, and anyone who wants to roam turns it on themselves
// in Settings › Guided Path. This constant already encodes that — dev is
// unlocked only so the content can be skipped through while authoring it.
//
// It read as an open launch-day question for a while, which cost a round
// of "is this decided?". It is not open. Changing prod to unlocked means
// revisiting the decision, not flipping a default nobody chose.
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

/** Distinct practice days across every week — the "how far in" measure. */
function totalDays(p: PathProgress): number {
  return Object.values(p.weekDays).reduce((sum, days) => sum + days.length, 0)
}

/**
 * Union two copies of the same path — used when a sign-in brings a cloud
 * copy to a device that already has local progress.
 *
 * Practice days are the thing users would grieve losing, so they merge as
 * a set: a day lit on EITHER side stays lit. Everything else follows from
 * the furthest-along side. Two different paths can't be merged (only one
 * runs at a time), so the deeper one wins outright.
 */
export function mergePathProgress(
  a: PathProgress | null,
  b: PathProgress | null,
): PathProgress | null {
  if (a === null) return b
  if (b === null) return a
  if (a.pathId !== b.pathId) return totalDays(b) > totalDays(a) ? b : a

  const weekDays: Record<number, string[]> = {}
  const orders = new Set([
    ...Object.keys(a.weekDays),
    ...Object.keys(b.weekDays),
  ])
  for (const key of orders) {
    const order = Number(key)
    weekDays[order] = [
      ...new Set([...(a.weekDays[order] ?? []), ...(b.weekDays[order] ?? [])]),
    ].sort()
  }

  return {
    pathId: a.pathId,
    // Earliest start: the day they actually began the climb.
    startedAt: a.startedAt <= b.startedAt ? a.startedAt : b.startedAt,
    currentWeek: Math.max(a.currentWeek, b.currentWeek),
    weekDays,
    completedWeeks: [
      ...new Set([...a.completedWeeks, ...b.completedWeeks]),
    ].sort((x, y) => x - y),
  }
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

/**
 * The active week itself, for surfaces that want its title and theme as
 * well as its drills (the jam room's picker). Null when no path is running.
 */
export function activePathWeek(): PathWeek | null {
  const p = progress()
  if (p === null || pathComplete(p)) return null
  return getWeek(p.currentWeek) ?? null
}

/** The active week's warm-up pattern override (null = default rotation). */
export function activePathWarmup(): string | null {
  const p = progress()
  if (p === null || pathComplete(p)) return null
  return getWeek(p.currentWeek)?.warmupPattern ?? null
}
