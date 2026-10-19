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
// on (§7).
//
// The days warmed up are synced on their own (`pitchperfect_warm_up_days`,
// src/lib/warm-up-days.ts): whenever a run that counts is kept, its date
// joins them, so the card, the Sing room's pill and the path's week dots
// read the same days on every device the singer signs in on (N5). Today's
// own run counts too before its date has landed there.
//
// The open stop is never stored: when the app goes, the stop in progress
// drops, and the run picks up at the next stop (N4).
//
// A room in the Warm-up is handed its stop (routineStopFor) by its screen
// wrapper, which also pops the room once the stop is finished or skipped.
//
// Two things the path draws live in memory only, never in storage:
//
//   the last move   the stop just finished or skipped, for the path's card
//                   ("Lip roll: 86% lit") and its countdown to the next
//                   stop. After a restart there is none: the path opens on
//                   the run as it was left (N4), not on a card
//   the unlocks     the badges the routine earned while the path was open.
//                   A room in warm-up mode does not claim its unlocks
//                   (RoomShell.tsx), so they come here while a stop is
//                   open, and to the path's own claim while it is on
//                   screen; the path says what the routine unlocked
//                   (decision (a), 13a review). Leaving the path lets go
//                   of both
//
// Built on first read, not on import, as the last exercise is
// (premium-exercises/last-exercise.ts).

import type { Accessor, Signal } from 'solid-js'
import { createSignal, untrack } from 'solid-js'
import type { RoutineStop, StopResult, } from '@/components/room-kit/routine-stop'
import { localDayString } from '@/lib/local-day'
import { createPersistedSignal } from '@/lib/storage'
import type { WarmUpDays, WeekDot } from '@/lib/warm-up-days'
import { isWarmUpDays, WARM_UP_DAYS_KEY, weekDots, withDay, } from '@/lib/warm-up-days'
import type { UnlockItem } from '@/stores/notifications-store'
import { claimUnlocks } from '@/stores/notifications-store'
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

let daysRecord: Signal<WarmUpDays> | undefined

/** The days warmed up, synced with the account (N5). */
function daysSignal(): Signal<WarmUpDays> {
  daysRecord ??= createPersistedSignal<WarmUpDays>(WARM_UP_DAYS_KEY, [], {
    validator: isWarmUpDays,
  })
  return daysRecord
}

/**
 * The day the path last opened on this device, under its own `mp_` key:
 * device-local like the run, and kept apart from it, because opening the
 * path is not a run (a new day's run is kept from its first stop).
 */
export const WARM_UP_OPENED_KEY = 'mp_warm_up_opened'

let openedRecord: Signal<string> | undefined

function openedSignal(): Signal<string> {
  openedRecord ??= createPersistedSignal<string>(WARM_UP_OPENED_KEY, '', {
    validator: (value): value is string => typeof value === 'string',
  })
  return openedRecord
}

/**
 * The path is opening: true the first time today on this device, when it
 * draws itself in (DESIGN-warm-up.md §5.2, §10); every later open that day
 * arrives settled. The day is written as it is asked, so a restart the same
 * day does not draw the path in again.
 */
export function firstPathOpenToday(): boolean {
  const [opened, setOpened] = openedSignal()
  const today = localDayString()
  if (untrack(opened) === today) return false
  setOpened(today)
  return true
}

/** The run's day joins the days warmed up: written once, never on a read. */
function markWarmedUp(date: string): void {
  const [days, setDays] = daysSignal()
  const before = untrack(days)
  const after = withDay(before, date)
  if (after !== before) setDays(after)
}

function keep(day: WarmUpDay): void {
  stored()[1](day)
  if (day.warmedUp) markWarmedUp(day.date)
}

/** The stop whose room is open: an index into the plan's stops. */
const [open, setOpenSignal] = createSignal<number | null>(null)

/** The stop the path's card is about: the one just finished or skipped. */
export interface LastMove {
  readonly index: number
  readonly state: 'done' | 'skipped'
}

const [lastMove, setLastMove] = createSignal<LastMove | null>(null)

/** What the routine unlocked while the path was open, in the order earned. */
const [unlocked, setUnlocked] = createSignal<readonly UnlockItem[]>([])

/** Take an unlock into the routine's list: a badge, said on the path. */
function receive(item: UnlockItem): void {
  setUnlocked((list) => [...list, item])
}

let roomClaim: (() => void) | null = null

/**
 * The open stop, and with it the routine's claim on the unlocks: held for
 * as long as a stop's room is open, so a room's badges reach the path
 * rather than a notice over the room.
 */
function setOpen(index: number | null): void {
  setOpenSignal(index)
  if (index !== null) {
    roomClaim ??= claimUnlocks((claimed) => {
      receive(claimed.unlock)
    })
    return
  }
  roomClaim?.()
  roomClaim = null
}

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
 * The days warmed up: the synced ones, and today's if this device's run
 * counts and its date has not landed in them yet.
 */
export function warmUpDays(): WarmUpDays {
  const days = daysSignal()[0]()
  const day = warmUpDay()
  return day.warmedUp ? withDay(days, day.date) : days
}

/**
 * Today counts as warmed up (N11): a run reached its end with a stop
 * finished, on this device or on another the singer is signed in on. The
 * picker card's and the Sing room pill's "Warmed up today".
 */
export function warmedUpToday(): boolean {
  return warmUpDays().includes(localDayString())
}

/**
 * This week's dots for the picker card and the Sing room's pill, or null
 * before a day of the week is warmed up (pw-mark "dots").
 */
export function warmUpWeek(): readonly WeekDot[] | null {
  return weekDots(warmUpDays(), localDayString())
}

/**
 * The room the path opens next, or null at the end: the tap that opens
 * the Warm-up starts loading its art too (premium-exercise-wiring.ts).
 */
export function nextWarmUpRoom(): WarmUpRoomId | null {
  const day = warmUpDay()
  const next = nextStop(day)
  if (next === null) return null
  const stop = day.plan.stops[next]
  return isRoomStop(stop) ? stop.id : null
}

/**
 * Open a stop's room: the path's Start or Next, or Again on a finished
 * stop. False for a stop that cannot open (a skipped one, the song).
 */
export function enterStop(index: number): boolean {
  const day = warmUpDay()
  if (!canEnter(day, index)) return false
  if (stored()[0]() !== day) keep(day)
  setLastMove(null)
  setOpen(index)
  return true
}

/** The stop the path's card is about, or null: none since the path opened. */
export function warmUpLastMove(): LastMove | null {
  return lastMove()
}

/** What the routine unlocked while the path was open. */
export const routineUnlocks: Accessor<readonly UnlockItem[]> = unlocked

/**
 * The path's own claim on the unlocks, for as long as it is on screen: a
 * grant pass that lands after its room has gone is said on the path too.
 * Returns the release.
 */
export function claimPathUnlocks(): () => void {
  return claimUnlocks((claimed) => {
    receive(claimed.unlock)
  })
}

/**
 * Leaving the path, not for a room: Back, Done, Sing a song. Its card and
 * what it said was unlocked go with it.
 */
export function leavePath(): void {
  setLastMove(null)
  setUnlocked([])
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
  setLastMove({ index, state: 'done' })
  setOpen(null)
}

function skipOpen(index: number): void {
  const day = openRun(index)
  if (day === null) return
  keep(skipStop(day, index))
  setLastMove({ index, state: 'skipped' })
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
  if (next === null) return
  keep(skipStop(day, next))
  setLastMove({ index: next, state: 'skipped' })
}

/** "Warm up again": a fresh run today; the day stays warmed up. */
export function warmUpAgain(): void {
  setOpen(null)
  setLastMove(null)
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

/** Drop the run and the days read so far and the open stop: the next read takes storage as it is now. */
export function resetWarmUpForTests(): void {
  record = undefined
  daysRecord = undefined
  openedRecord = undefined
  setOpen(null)
  leavePath()
}
