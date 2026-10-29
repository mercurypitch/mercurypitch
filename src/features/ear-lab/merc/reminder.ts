// ============================================================
// "Remind me tomorrow at 8:30": the day's close can ask the phone to
// say, each morning from tomorrow, that today's three are waiting. The
// phone shows each one by itself (a local notification): nothing of the
// app runs for it, and nothing leaves the phone.
//
// One reminder per date, never one that repeats. A repeating one set
// before 8:30 would speak today, about a day whose three are done, and
// could not keep quiet on a later day done before its 8:30. So the next
// four weeks are laid out, and laid out again whenever the Ear Lab
// opens: a day finished before 8:30 loses its reminder, and one already
// in the shade goes as the day's three are done. Four weeks without the
// Ear Lab, and Merc stops asking.
//
// Off until asked, and off again where the phone refuses: the switch
// never says on while the phone would show nothing. The answer is this
// phone's own (an `mp_` key, which no account carries to another).
// ============================================================

import { createSignal } from 'solid-js'
import { createPersistedSignal } from '@/lib/storage'
import type { NativeReminder, NativeReminders, } from '@/stores/native-shell-store'
import { nativeDeviceApi } from '@/stores/native-shell-store'
import { REMINDER } from './merc-lines'

export const REMINDER_KEY = 'mp_ear_lab_reminder'
export const REMINDER_HOUR = 8
export const REMINDER_MINUTE = 30
/** The days laid out ahead: four weeks, well inside iOS's 64 pending. */
export const REMINDER_DAYS = 28
/** One id per date, from a ring longer than the days laid out: no two
 *  pending ever share one, and turning off can name every one. */
const SLOTS = 32
const FIRST_ID = 8300
/** None is laid out closer than this: iOS shows at once a reminder whose
 *  time has passed by the time it arrives. */
const LEAD_MS = 60_000
const DAY_MS = 86_400_000

const [wanted, setWanted] = createPersistedSignal<boolean>(
  REMINDER_KEY,
  false,
  { validator: (value): value is boolean => typeof value === 'boolean' },
)

/** On: asked for, and allowed by the phone when last asked. */
export const remindersOn = wanted

/** What the row says under its switch, after an answer it has to explain. */
export type ReminderNote = 'refused' | 'unavailable'

const [note, setNote] = createSignal<ReminderNote | null>(null)

export const reminderNote = note

function reminders(): NativeReminders | null {
  return nativeDeviceApi()?.reminders ?? null
}

/** Whether this phone can set them at all. Nowhere else is the switch. */
export function remindersOffered(): boolean {
  return reminders() !== null
}

/** The local date as a count of days: a clock change does not move it. */
function dayNumber(date: Date): number {
  return Math.floor(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS,
  )
}

/** The id of the reminder for this date. */
export function reminderId(date: Date): number {
  return FIRST_ID + (dayNumber(date) % SLOTS)
}

/** Every id a reminder of the Ear Lab's can have. */
export const REMINDER_IDS: readonly number[] = Array.from(
  { length: SLOTS },
  (_, slot) => FIRST_ID + slot,
)

/**
 * 8:30 on each of the next four weeks of mornings: from tomorrow when
 * today's three are done, or when today's 8:30 has passed; from today
 * otherwise.
 */
export function reminderTimes(now: Date, todayDone: boolean): Date[] {
  const times: Date[] = []
  for (let ahead = todayDone ? 1 : 0; times.length < REMINDER_DAYS; ahead++) {
    const at = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + ahead,
      REMINDER_HOUR,
      REMINDER_MINUTE,
    )
    if (at.getTime() - now.getTime() >= LEAD_MS) times.push(at)
  }
  return times
}

function remindersAt(times: readonly Date[]): NativeReminder[] {
  return times.map((at) => ({
    id: reminderId(at),
    title: REMINDER.title,
    body: REMINDER.body,
    at,
  }))
}

// Each turn of the switch and each laying out takes a number. One that
// wakes from the phone's answer to find a later one begun does nothing
// more, so a switch turned off is never followed by a schedule.
let turn = 0
/** The day and the state last laid out in this run of the app, so the
 *  Ear Lab opening twice in a morning lays nothing out twice. */
let laidOut: string | null = null

function layoutOf(now: Date, todayDone: boolean): string {
  return `${dayNumber(now)}:${todayDone ? 'done' : 'to do'}`
}

async function layOut(
  phone: NativeReminders,
  mine: number,
  now: Date,
  todayDone: boolean,
): Promise<void> {
  const key = layoutOf(now, todayDone)
  if (laidOut === key) return
  if (todayDone) {
    // Today's, still to come or already in the shade, is about a day
    // that is done.
    await phone.cancel([reminderId(now)])
    if (mine !== turn) return
  }
  const scheduled = await phone.schedule(
    remindersAt(reminderTimes(now, todayDone)),
  )
  if (scheduled && mine === turn) laidOut = key
}

/**
 * Turn them on, from the day's close: the phone's own question, then the
 * mornings from tomorrow. Off again where the phone says no. The answer,
 * or null where the switch was turned again before the phone answered.
 */
export async function turnRemindersOn(
  now: () => Date = () => new Date(),
): Promise<'on' | ReminderNote | null> {
  const phone = reminders()
  turn += 1
  const mine = turn
  setNote(null)
  if (phone === null) {
    setNote('unavailable')
    return 'unavailable'
  }
  const answer = await phone.ask()
  if (mine !== turn) return null
  if (answer !== 'granted') {
    const said: ReminderNote =
      answer === 'unavailable' ? 'unavailable' : 'refused'
    setWanted(false)
    setNote(said)
    return said
  }
  setWanted(true)
  laidOut = null
  await layOut(phone, mine, now(), true)
  return 'on'
}

/** Turn them off: every one still to come, and any in the shade. */
export async function turnRemindersOff(): Promise<void> {
  turn += 1
  laidOut = null
  setWanted(false)
  setNote(null)
  await reminders()?.cancel(REMINDER_IDS)
}

/**
 * Lay the mornings out again, as the Ear Lab opens and as a day's three
 * are done. Where the phone no longer allows them (turned off in its
 * Settings) they are turned off here too, and the day's close says where
 * to turn them back on.
 */
export async function renewReminders(
  todayDone: boolean,
  now: () => Date = () => new Date(),
): Promise<void> {
  const phone = reminders()
  if (!wanted() || phone === null) return
  const at = now()
  if (laidOut === layoutOf(at, todayDone)) return
  turn += 1
  const mine = turn
  const permission = await phone.permission()
  if (mine !== turn || permission === 'unavailable') return
  if (permission !== 'granted') {
    laidOut = null
    setWanted(false)
    setNote('refused')
    await phone.cancel(REMINDER_IDS)
    return
  }
  await layOut(phone, mine, at, todayDone)
}

/** Tests only: forget what this run of the app laid out. */
export function resetRemindersForTests(): void {
  turn += 1
  laidOut = null
  setNote(null)
}
