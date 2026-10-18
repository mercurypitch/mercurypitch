// ============================================================
// The Warm-up's day: where the run stands, and its moves
// ============================================================
//
// Pure: a WarmUpDay in, a WarmUpDay out. The store (warm-up-store.ts)
// keeps the day on the device and runs these moves; the path screen draws
// what they leave. The day's rules (DESIGN-warm-up.md §5.5 to §5.9 and
// the owner's calls of 18 Oct 2026):
//
//   next       the first room stop still waiting; none left is the end
//   finish     a stop's result lights it: "86% lit". Again on a finished
//              stop runs it once more, and the newer line replaces the old
//   skip       a waiting stop stays unsung, marked skipped, and the run
//              goes past it
//   the end    every room stop finished or skipped, with at least one
//              finished: the day counts as warmed up (N11). If every stop
//              was skipped, the run goes back to its start and nothing
//              counts
//   leaving    finished stops keep counting; the stop in progress drops,
//              as leaving a room drops its take (the store never keeps
//              which stop is open). Back the same day, the run picks up
//              where it was: "1 of 4 today", "Next: Long note" (N4)
//   a new day  starts fresh, on the day's own plan
//   again      "Warm up again" starts a fresh run the same day; the day
//              stays warmed up (N5)
//
// The run also carries the note a stop started from (StopResult's
// settledNote), so a later stop starts there and the singer is asked for
// an easy note once (room-kit routine-stop.ts).
//
// A move that does not apply (an index off the plan, a song stop, a skip
// of a finished stop) leaves the day as it was.

import { localDayString } from '@/lib/local-day'
import type { WarmUpPlan } from './warm-up-plan'
import { isRoomStop, isWarmUpPlan } from './warm-up-plan'

/** Where one stop stands in the run. A song stop is always waiting. */
export type StopMark =
  | { readonly state: 'waiting' }
  | {
      readonly state: 'done'
      /** The card's words after the stop's name: "86% lit". */
      readonly line: string
    }
  | { readonly state: 'skipped' }

export interface WarmUpDay {
  /** The singer's local day the run belongs to (YYYY-MM-DD). */
  readonly date: string
  /** The day's plan, kept whole with its run. */
  readonly plan: WarmUpPlan
  /** One mark per stop of the plan, in its order. */
  readonly marks: readonly StopMark[]
  /** The note an earlier stop started from (MIDI), or null. */
  readonly settledNote: number | null
  /** The end was reached today with a stop finished (N11). */
  readonly warmedUp: boolean
  /** When the run last moved, ms since the epoch. */
  readonly lastActiveAt: number
}

const WAITING: StopMark = { state: 'waiting' }

/** A fresh run of `plan` for `date`: every stop waiting. */
export function freshDay(
  plan: WarmUpPlan,
  date: string = localDayString(),
  now: number = Date.now(),
): WarmUpDay {
  return {
    date,
    plan,
    marks: plan.stops.map(() => WAITING),
    settledNote: null,
    warmedUp: false,
    lastActiveAt: now,
  }
}

/**
 * The day as the path opens it: the stored run if it is today's, else a
 * fresh run of today's plan. Reading moves nothing.
 */
export function dayFor(
  stored: WarmUpDay | null,
  today: string,
  plan: () => WarmUpPlan,
): WarmUpDay {
  if (stored !== null && stored.date === today) return stored
  return freshDay(plan(), today)
}

/** The stop the path offers next, or null: the end. */
export function nextStop(day: WarmUpDay): number | null {
  const at = day.plan.stops.findIndex(
    (stop, i) => isRoomStop(stop) && day.marks[i]?.state === 'waiting',
  )
  return at === -1 ? null : at
}

/** Every room stop is finished or skipped: the run has reached its end. */
export function atEnd(day: WarmUpDay): boolean {
  return nextStop(day) === null
}

export interface DayTally {
  /** Room stops finished: the "1" of "1 of 4 today". */
  readonly done: number
  readonly skipped: number
  /** Room stops in the plan: the "4". */
  readonly rooms: number
}

export function tally(day: WarmUpDay): DayTally {
  let done = 0
  let skipped = 0
  let rooms = 0
  day.plan.stops.forEach((stop, i) => {
    if (!isRoomStop(stop)) return
    rooms += 1
    const state = day.marks[i]?.state
    if (state === 'done') done += 1
    if (state === 'skipped') skipped += 1
  })
  return { done, skipped, rooms }
}

/** The room stop's place among the rooms, from 0 ("Warm-up 2 of 4"); -1 for none. */
export function roomIndex(day: WarmUpDay, index: number): number {
  if (!isRoomStop(day.plan.stops[index])) return -1
  return day.plan.stops.slice(0, index).filter(isRoomStop).length
}

/** A stop that can open its room: a room stop, waiting or finished (Again). */
export function canEnter(day: WarmUpDay, index: number): boolean {
  return (
    isRoomStop(day.plan.stops[index]) && day.marks[index]?.state !== 'skipped'
  )
}

function withMark(
  day: WarmUpDay,
  index: number,
  mark: StopMark,
  now: number,
): WarmUpDay {
  return {
    ...day,
    marks: day.marks.map((each, i) => (i === index ? mark : each)),
    lastActiveAt: now,
  }
}

/**
 * The end, once nothing waits: warmed up with a stop finished; back to
 * the start with every stop skipped, the day's mark as it was.
 */
function settle(day: WarmUpDay): WarmUpDay {
  if (!atEnd(day)) return day
  if (tally(day).done > 0) return { ...day, warmedUp: true }
  return { ...day, marks: day.plan.stops.map(() => WAITING) }
}

export interface FinishedStop {
  readonly line: string
  /** The note the stop's run started from, for a later stop; null for none. */
  readonly settledNote: number | null
}

/** A stop's result: it lights, or (Again) its newer line replaces the old. */
export function finishStop(
  day: WarmUpDay,
  index: number,
  result: FinishedStop,
  now: number = Date.now(),
): WarmUpDay {
  if (!canEnter(day, index)) return day
  const moved = withMark(day, index, { state: 'done', line: result.line }, now)
  return settle({
    ...moved,
    settledNote: result.settledNote ?? day.settledNote,
  })
}

/** A waiting stop goes unsung: "Skip stop" in its room, or Skip on the path. */
export function skipStop(
  day: WarmUpDay,
  index: number,
  now: number = Date.now(),
): WarmUpDay {
  const stop = day.plan.stops[index]
  if (!isRoomStop(stop) || day.marks[index]?.state !== 'waiting') return day
  return settle(withMark(day, index, { state: 'skipped' }, now))
}

/** "Warm up again": a fresh run the same day, still warmed up. */
export function restartDay(
  day: WarmUpDay,
  now: number = Date.now(),
): WarmUpDay {
  return {
    ...day,
    marks: day.plan.stops.map(() => WAITING),
    lastActiveAt: now,
  }
}

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/u

function isMark(value: unknown, room: boolean): value is StopMark {
  if (typeof value !== 'object' || value === null) return false
  const mark = value as Record<string, unknown>
  if (mark.state === 'waiting') return true
  if (!room) return false
  if (mark.state === 'skipped') return true
  return mark.state === 'done' && typeof mark.line === 'string'
}

/** A stored day this build can run; anything else reads as no day. */
export function isWarmUpDay(value: unknown): value is WarmUpDay {
  if (typeof value !== 'object' || value === null) return false
  const day = value as Record<string, unknown>
  if (typeof day.date !== 'string' || !DAY_PATTERN.test(day.date)) return false
  if (!isWarmUpPlan(day.plan) || !Array.isArray(day.marks)) return false
  const { stops } = day.plan
  const marks: unknown[] = day.marks
  if (marks.length !== stops.length) return false
  if (!marks.every((mark, i) => isMark(mark, isRoomStop(stops[i])))) {
    return false
  }
  const note = day.settledNote
  if (note !== null && !(typeof note === 'number' && Number.isFinite(note))) {
    return false
  }
  return (
    typeof day.warmedUp === 'boolean' &&
    typeof day.lastActiveAt === 'number' &&
    Number.isFinite(day.lastActiveAt)
  )
}
