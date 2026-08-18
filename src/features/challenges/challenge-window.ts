// ============================================================
// When a challenge runs, in weeks you can count
// ============================================================
//
// The admin form asked for `startsAt` and `endsAt` as raw ISO strings, which
// meant setting a month-long challenge was arithmetic done in your head and
// typed in by hand. The dates are the only thing the model has — there is no
// "weekly" or "monthly" field anywhere, and there never was — so a period is
// just a distance between two Mondays.
//
// That is the whole reason this can move from a week to a month without a
// migration: nothing in the schema believes in weeks. Only the copy did, and
// the copy is being fixed separately.
//
// Everything here is UTC and pure. `Date` in a local timezone would put the
// boundary in a different week for half the planet.

const DAY_MS = 86_400_000
const WEEK_MS = 7 * DAY_MS

/** A challenge's run, as the admin thinks of it: from one Monday to another. */
export interface ChallengeWindow {
  /** ISO instant of the opening Monday, 00:00 UTC. */
  startsAt: string
  /** ISO instant of the closing Monday, 00:00 UTC — exclusive. */
  endsAt: string
}

/** The Monday at or before `iso`, at 00:00 UTC. */
export function mondayOf(iso: string): string {
  const date = new Date(Date.parse(iso))
  const monday = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    // getUTCDay() is 0 for Sunday, so rotate to make Monday 0.
    date.getUTCDate() - ((date.getUTCDay() + 6) % 7),
  )
  return new Date(monday).toISOString()
}

/**
 * ISO-8601 week number, 1-53.
 *
 * The ISO rule is "the week containing the year's first Thursday is week 1",
 * which is why this hops to Thursday before counting rather than dividing the
 * day-of-year by seven. Late December can be week 1 of the next year and
 * early January can be week 52 of the last, and both are correct.
 */
export function isoWeekNumber(iso: string): number {
  const date = new Date(Date.parse(iso))
  const thursday = new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate() - ((date.getUTCDay() + 6) % 7) + 3,
    ),
  )
  const firstThursday = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 4))
  const firstThursdayMonday =
    firstThursday.getTime() -
    ((firstThursday.getUTCDay() + 6) % 7) * DAY_MS +
    3 * DAY_MS
  return 1 + Math.round((thursday.getTime() - firstThursdayMonday) / WEEK_MS)
}

/** The year the ISO week belongs to, which is not always the calendar year. */
export function isoWeekYear(iso: string): number {
  const date = new Date(Date.parse(iso))
  const thursday = new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate() - ((date.getUTCDay() + 6) % 7) + 3,
    ),
  )
  return thursday.getUTCFullYear()
}

/** "W20 · 2026" — what the stepper shows above an arrow. */
export function formatIsoWeek(iso: string): string {
  return `W${isoWeekNumber(iso)} · ${isoWeekYear(iso)}`
}

/** `iso` moved by whole weeks, snapped to Monday 00:00 UTC. */
export function shiftWeeks(iso: string, weeks: number): string {
  return new Date(Date.parse(mondayOf(iso)) + weeks * WEEK_MS).toISOString()
}

/** Whole weeks from `from` to `to`, both snapped to their Mondays. */
export function weeksBetween(from: string, to: string): number {
  return Math.round(
    (Date.parse(mondayOf(to)) - Date.parse(mondayOf(from))) / WEEK_MS,
  )
}

/** The Monday of the week containing `now` (defaults to today). */
export function currentWeekStart(now: number = Date.now()): string {
  return mondayOf(new Date(now).toISOString())
}

/**
 * How long a challenge runs, in weeks.
 *
 * Named rather than numeric everywhere it is shown, because "4 weeks" is the
 * honest description of a month and "monthly" is not — a month is 4.35 weeks
 * and the boundary would drift off Monday within a year.
 */
export const CHALLENGE_PERIODS = [
  { weeks: 1, label: 'One week' },
  { weeks: 2, label: 'Two weeks' },
  { weeks: 4, label: 'Four weeks' },
  { weeks: 8, label: 'Eight weeks' },
] as const

/** The period MercuryPitch runs by default. Four weeks, not "a month". */
export const DEFAULT_PERIOD_WEEKS = 4

/**
 * A window `weeks` long starting from the Monday of `startIso`.
 *
 * Clamped to at least one week: a zero-length challenge is live for no time
 * at all, and a negative one is live forever because `now < endsAt` fails
 * closed the other way.
 */
export function windowFrom(startIso: string, weeks: number): ChallengeWindow {
  const startsAt = mondayOf(startIso)
  return {
    startsAt,
    endsAt: shiftWeeks(startsAt, Math.max(1, Math.round(weeks))),
  }
}

/** The window's length in weeks, as the stepper needs to display it. */
export function windowWeeks(window: ChallengeWindow): number {
  return Math.max(1, weeksBetween(window.startsAt, window.endsAt))
}

// ============================================================
// Re-dating the queue behind the live one
// ============================================================
//
// Changing when the current challenge runs used to mean editing every
// challenge behind it by hand, one ISO string at a time, in the right order,
// without leaving a gap or an overlap.
//
// The queue's order IS its dates — the admin list is sorted by `startsAt` —
// so reordering and re-dating are the same operation. Drag the list into the
// order you want, press the button, and the dates follow. Nothing is written
// until the button is pressed: an automatic reflow on every edit would move
// a live challenge out from under whoever is attempting it.

export interface QueuedChallengeWindow extends ChallengeWindow {
  id: string
}

export interface ReflowInput {
  /** When the live challenge closes — the queue starts there. */
  liveEndsAt: string
  /** Challenge ids in the order they should run. */
  order: readonly string[]
  /** How long each queued challenge runs. */
  periodWeeks: number
}

/**
 * New windows for the queued challenges, back to back after the live one.
 *
 * Pure and total: it never writes, and it returns one entry per id in the
 * order given, so the caller can diff against what is stored and PATCH only
 * what actually moved.
 */
export function reflowQueue(input: ReflowInput): QueuedChallengeWindow[] {
  const weeks = Math.max(1, Math.round(input.periodWeeks))
  let cursor = mondayOf(input.liveEndsAt)
  const out: QueuedChallengeWindow[] = []
  for (const id of input.order) {
    const window = windowFrom(cursor, weeks)
    out.push({ id, ...window })
    cursor = window.endsAt
  }
  return out
}

/** Only the entries whose dates actually differ from what is stored. */
export function reflowChanges(
  planned: readonly QueuedChallengeWindow[],
  stored: ReadonlyMap<string, ChallengeWindow>,
): QueuedChallengeWindow[] {
  return planned.filter((row) => {
    const current = stored.get(row.id)
    if (current === undefined) return true
    return (
      mondayOf(current.startsAt) !== row.startsAt ||
      mondayOf(current.endsAt) !== row.endsAt
    )
  })
}

/** Move `id` to `toIndex` in `order`, returning a new array. */
export function reorder(
  order: readonly string[],
  id: string,
  toIndex: number,
): string[] {
  const from = order.indexOf(id)
  if (from === -1) return [...order]
  const next = [...order]
  next.splice(from, 1)
  // Clamp rather than throw: a drag can end past either end of the list.
  next.splice(Math.min(Math.max(0, toIndex), next.length), 0, id)
  return next
}
