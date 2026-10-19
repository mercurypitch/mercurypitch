// ============================================================
// The days warmed up: a synced list, a union on pull, the week's dots
// ============================================================
//
// The Warm-up counts a day once a run reaches its end with a stop
// finished (DESIGN-warm-up.md N11). The run itself stays on the device
// that sang it (`mp_warm_up_today`, the Warm-up's store); the dates follow
// the account (N5, the owner's pw-mark "dots"), so a second phone shows
// "Warmed up today" and the day's dot, though not the first phone's
// results.
//
// The dates are progress, not a preference: a pull merges the two lists
// as a union (MERGE_ON_PULL, settings-progress.ts), so a day sung on one
// phone is never lost to another phone's newer copy. The newest 90 are
// kept: a date costs 13 bytes against the settings row's 8 KB, and the
// dots look back one week.
//
// Here in lib, not in the Warm-up's feature, because the settings sync
// (src/db) names the merge, and a build without the premium exercises
// folds the key and the merge away with it.
//
// The week runs Monday to Sunday, as the app's league and trends weeks
// do. Its dots say which of this week's days were warmed up and ring
// today. There is no streak, and nothing marks a day that was missed.

/** Where the dates live, and the settings row they sync as. */
export const WARM_UP_DAYS_KEY = 'pitchperfect_warm_up_days'

/** How many dates a list keeps: the newest. */
export const WARM_UP_DAYS_KEPT = 90

/** Dates warmed up, `YYYY-MM-DD` in the singer's calendar, oldest first. */
export type WarmUpDays = readonly string[]

const DAY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/u
const DAY_MS = 86_400_000

/** A day's midnight as a UTC timestamp: calendar arithmetic without DST. */
function dayStamp(day: string): number | null {
  const parts = DAY_PATTERN.exec(day)
  if (parts === null) return null
  const [year, month, date] = [parts[1], parts[2], parts[3]].map(Number) as [
    number,
    number,
    number,
  ]
  const stamp = Date.UTC(year, month - 1, date)
  const back = new Date(stamp)
  // 2026-02-30 rolls over to March: not a day anyone lived.
  if (back.getUTCMonth() !== month - 1 || back.getUTCDate() !== date) {
    return null
  }
  return stamp
}

const pad = (n: number): string => String(n).padStart(2, '0')

function dayOf(stamp: number): string {
  const date = new Date(stamp)
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`
}

/** A real calendar day, written `YYYY-MM-DD`. */
export function isDay(value: unknown): value is string {
  return typeof value === 'string' && dayStamp(value) !== null
}

/** A stored list this build can read: real days, in any order. */
export function isWarmUpDays(value: unknown): value is WarmUpDays {
  return Array.isArray(value) && value.every(isDay)
}

/** The list as it is kept: each day once, oldest first, the newest 90. */
export function keptDays(days: Iterable<string>): WarmUpDays {
  return [...new Set(days)].sort().slice(-WARM_UP_DAYS_KEPT)
}

/** Whether two lists hold the same days in the same order. */
function sameDays(a: WarmUpDays, b: WarmUpDays): boolean {
  return a.length === b.length && a.every((day, i) => day === b[i])
}

/**
 * The list with `day` in it. The list itself when it already holds the
 * day, or when the day is older than the 90 it keeps: nothing to write.
 */
export function withDay(days: WarmUpDays, day: string): WarmUpDays {
  if (!isDay(day) || days.includes(day)) return days
  const next = keptDays([...days, day])
  return sameDays(next, days) ? days : next
}

/** Every day from either list, as a list keeps them: the same either way round. */
export function mergeWarmUpDays(a: WarmUpDays, b: WarmUpDays): WarmUpDays {
  return keptDays([...a, ...b])
}

function readDays(raw: string | null): WarmUpDays | null {
  if (raw === null) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    return isWarmUpDays(parsed) ? parsed : null
  } catch {
    return null
  }
}

/**
 * The settings pull's resolver (MERGE_ON_PULL): the device's and the
 * account's raw values in, the one both should hold out. A side that does
 * not read gives way to the other, the account's when neither reads; a
 * side that already holds the union comes back as its own string, so
 * nothing is rewritten.
 */
export function mergeWarmUpDaysOnPull(
  local: string | null,
  cloud: string,
): string {
  const mine = readDays(local)
  const theirs = readDays(cloud)
  if (mine === null || local === null) return cloud
  if (theirs === null) return local
  const merged = mergeWarmUpDays(mine, theirs)
  if (sameDays(merged, theirs)) return cloud
  if (sameDays(merged, mine)) return local
  return JSON.stringify(merged)
}

/** The seven days of `day`'s week, Monday first; none for a day that is not one. */
export function weekOf(day: string): readonly string[] {
  const stamp = dayStamp(day)
  if (stamp === null) return []
  // getUTCDay counts from Sunday; the week starts on Monday.
  const monday = stamp - ((new Date(stamp).getUTCDay() + 6) % 7) * DAY_MS
  return Array.from({ length: 7 }, (_, i) => dayOf(monday + i * DAY_MS))
}

/** One of the week's dots. */
export interface WeekDot {
  readonly day: string
  /** Warmed up that day: a filled dot. */
  readonly warmed: boolean
  /** Today: a ringed dot. */
  readonly today: boolean
}

/**
 * This week's seven dots, Monday first, or null while no day of the week
 * is warmed up: the dots show once there is a day in them (pw-mark).
 */
export function weekDots(
  days: WarmUpDays,
  today: string,
): readonly WeekDot[] | null {
  const warmed = new Set(days)
  const dots = weekOf(today).map((day) => ({
    day,
    warmed: warmed.has(day),
    today: day === today,
  }))
  return dots.some((dot) => dot.warmed) ? dots : null
}

const WEEKDAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const

/**
 * What a screen reader hears for the dots: the days warmed up, by name,
 * today as "today" ("Warmed up this week: Monday, Tuesday and today").
 * Only the days that were: nothing names a day without one.
 */
export function weekSaid(dots: readonly WeekDot[]): string {
  const names = dots.flatMap((dot, i) =>
    dot.warmed ? [dot.today ? 'today' : (WEEKDAYS[i] ?? dot.day)] : [],
  )
  const list =
    names.length < 2
      ? (names[0] ?? '')
      : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`
  return `Warmed up this week: ${list}`
}
