// ============================================================
// The Warm-up's store: today's run, on this device
// ============================================================
//
// The path screen is gone while a room is up (ShellScreens draws only the
// top screen), so what the run needs lives here, never in the path
// component (DESIGN-warm-up.md §9): today's run (routine.ts) and the stop
// whose room is open.
//
// The run is kept in `mp_warm_up_today`, on this device only: the `mp_`
// prefix keeps it out of the settings sync (settings-service.ts syncs
// `pitchperfect_` keys). It is written at every stop, and synced it would
// race a second device mid-run; a run picks up on the device it was left
// on (§7). The days warmed up are synced on their own, with the week's
// dots (PR 13e).
//
// The open stop is never stored: when the app goes, the stop in progress
// drops, and the run picks up at the next stop (N4).
//
// A room in the Warm-up is handed its stop (routineStopFor) by its screen
// wrapper, which also pops the room once the stop is finished or skipped.
//
// Built on first read, not on import, as the last exercise is
// (premium-exercises/last-exercise.ts).

import type { Signal } from 'solid-js'
import { createSignal } from 'solid-js'
import type { RoutineStop, StopResult, } from '@/components/room-kit/routine-stop'
import { localDayString } from '@/lib/local-day'
import { createPersistedSignal } from '@/lib/storage'
import type { WarmUpDay } from './routine'
import { canEnter, dayFor, finishStop, isWarmUpDay, nextStop, restartDay, roomIndex, skipStop, tally, } from './routine'
import type { WarmUpRoomId } from './warm-up-plan'
import { isRoomStop, planWarmUp } from './warm-up-plan'

export const WARM_UP_TODAY_KEY = 'mp_warm_up_today'

let record: Signal<WarmUpDay | null> | undefined

function stored(): Signal<WarmUpDay | null> {
  record ??= createPersistedSignal<WarmUpDay | null>(WARM_UP_TODAY_KEY, null, {
    validator: (value): value is WarmUpDay | null =>
      value === null || isWarmUpDay(value),
  })
  return record
}

function keep(day: WarmUpDay): void {
  stored()[1](day)
}

/** The stop whose room is open: an index into the plan's stops. */
const [open, setOpen] = createSignal<number | null>(null)

/**
 * Today's run, as the path draws it: the stored run if it is today's,
 * else a fresh one. Reading writes nothing; a new day's run is kept from
 * its first stop.
 */
export function warmUpDay(): WarmUpDay {
  return dayFor(stored()[0](), localDayString(), planWarmUp)
}

/** The stop whose room is open, or null. */
export function openStop(): number | null {
  return open()
}

/**
 * Open a stop's room: the path's Start or Next, or Again on a finished
 * stop. False for a stop that cannot open (a skipped one, the song).
 */
export function enterStop(index: number): boolean {
  const day = warmUpDay()
  if (!canEnter(day, index)) return false
  if (stored()[0]() !== day) keep(day)
  setOpen(index)
  return true
}

/**
 * The run the open stop belongs to: the one kept when it opened, even
 * past midnight, and only while that stop is still the open one.
 */
function openRun(index: number): WarmUpDay | null {
  if (open() !== index) return null
  return stored()[0]()
}

function finishOpen(index: number, result: StopResult): void {
  const day = openRun(index)
  if (day === null) return
  const stop = day.plan.stops[index]
  if (!isRoomStop(stop) || stop.id !== result.id) return
  keep(finishStop(day, index, result))
  setOpen(null)
}

function skipOpen(index: number): void {
  const day = openRun(index)
  if (day === null) return
  keep(skipStop(day, index))
  setOpen(null)
}

/**
 * The stop room `id` is, while the Warm-up has it open; undefined
 * otherwise, and the room runs as shipped.
 */
export function routineStopFor(id: WarmUpRoomId): RoutineStop | undefined {
  const index = open()
  const day = stored()[0]()
  if (index === null || day === null) return undefined
  const stop = day.plan.stops[index]
  if (!isRoomStop(stop) || stop.id !== id) return undefined
  return {
    index: roomIndex(day, index),
    count: tally(day).rooms,
    settledNote: day.settledNote,
    finish: (result) => finishOpen(index, result),
    skip: () => skipOpen(index),
  }
}

/** Back from a room before its result: the stop in progress drops. */
export function leaveStop(): void {
  setOpen(null)
}

/** Skip on the path, beside Next: the next stop goes unsung. */
export function skipNextStop(): void {
  const day = warmUpDay()
  const next = nextStop(day)
  if (next !== null) keep(skipStop(day, next))
}

/** "Warm up again": a fresh run today; the day stays warmed up. */
export function warmUpAgain(): void {
  setOpen(null)
  keep(restartDay(warmUpDay()))
}

/**
 * Whether the singer may start a warm-up. The Warm-up gets one free run of
 * its own, then Premium (N3, owner's call pw-free "own"); that gate lands
 * with the store flip, for every exercise at once. Until then, every
 * build may.
 */
export function canStartWarmUp(): boolean {
  return true
}

/** Drop the run read so far and the open stop: the next read takes storage as it is now. */
export function resetWarmUpForTests(): void {
  record = undefined
  setOpen(null)
}
