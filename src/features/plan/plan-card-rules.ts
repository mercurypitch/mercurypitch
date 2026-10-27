// ============================================================
// Plan card rules — which card a record asks for, and when a stop is done
// ============================================================
//
// Home's "Your plan" card follows these rules, and so do three readers that
// cannot share a store: the card itself (HomePlanCard.tsx, through
// plan-progress.ts), the store (plan-store.ts), through which the card, Merc's
// hand-over at the end of a tour and Settings read whether the card is hidden,
// and Home's slot for the card (plan-card-slot.ts), which Home reads before the
// card's chunk is in. Each rule is written once, here, and each of them imports
// it:
//
// - The week: a record answered, skipped or turned down keeps its card for
//   PLAN_CARD_DAYS, counted from the record's own date, on either side.
// - The kind: nothing for a card hidden on this device or for no record,
//   nothing out of the week, the plan for an answered record, otherwise the
//   ask. Whether every stop of a plan is done is the caller's to add, since
//   only a caller knows which stops the plan has.
// - What finishes a stop (DONE_WHEN): the first values that do, or an opening
//   from the plan for a room that has none.
// - Hidden on this device: the X stores the date (`at`) of the record whose
//   card it hid under PLAN_CARD_DISMISSED_KEY, and that card is hidden while
//   the record carries that date, and after it, while no answers come: Not
//   now again writes a record with a new date but no plan. A plan answered
//   again, here or on another device, is a record with a new date, so its
//   card shows for its own week. A stored `true` (the X wrote that before it
//   kept a date) hides any record, until the person answers again on this
//   device, which clears the key (plan-store.ts). Storage that cannot be read
//   holds no hide.
// - The stops opened from the plan: a list of names under PLAN_OPENED_KEY.
//
// Home imports this file statically, in the native build too, so it holds no
// plan code: no persisted signal, nothing done as it loads, and no words
// (plan-card-rules.test.ts reads its source to hold it to that).

import type { FirstValueKind } from '@/lib/first-value'
import { firstValueSeen } from '@/lib/first-value'
import { storageGet } from '@/lib/storage'
import type { PlanDest } from './build-plan'
import { PLAN_CARD_DISMISSED_KEY, PLAN_OPENED_KEY } from './plan-keys'

/** How many days after a plan was answered, skipped or turned down Home's card stays. */
export const PLAN_CARD_DAYS = 7

const PLAN_CARD_MS = PLAN_CARD_DAYS * 24 * 60 * 60 * 1000

/** The cards Home can show: the plan's stops, or the ask for the four questions. */
export const PLAN_CARD_KINDS = ['plan', 'ask'] as const

/** Which card Home shows. */
export type PlanCardKind = (typeof PLAN_CARD_KINDS)[number]

/** What the week's rule reads of a record. */
export interface PlanCardRecord {
  status: string
  at: string
}

/**
 * Is `at`, a date written as text, within a week of `now`, on either side? A
 * date a little ahead is inside the week, as two devices that share a record
 * never quite agree; one more than a week ahead (a clock that was wrong when
 * it wrote the record) is not, or it would hold the card until the clock
 * caught up. One that does not read parses to NaN, and no distance is less
 * than NaN.
 */
function withinTheWeek(at: string, now: number): boolean {
  return Math.abs(now - Date.parse(at)) < PLAN_CARD_MS
}

/**
 * Which card a record asks for. The first rule that fits wins: nothing for a
 * card that was hidden, or for no record; nothing for a record out of its
 * week; the plan for an answered one; otherwise the ask. The plan is shown
 * only while a stop of it is not done, which the caller adds.
 */
export function planCardKind(i: {
  record: PlanCardRecord | null
  dismissed: boolean
  now: number
}): PlanCardKind | null {
  if (i.dismissed || i.record === null) return null
  if (!withinTheWeek(i.record.at, i.now)) return null
  return i.record.status === 'answered' ? 'plan' : 'ask'
}

/**
 * What finishes a stop: the first values that do, or `opened` for a room that
 * has none, which is done once it is opened from the plan. A Record over every
 * destination, so a destination added to the plan fails to compile here until
 * it says what finishes it.
 */
const DONE_WHEN: Record<PlanDest, readonly FirstValueKind[] | 'opened'> = {
  sing: ['sing'],
  homeSession: ['sing', 'drill'],
  ascent: ['sing', 'drill'],
  exercises: ['drill'],
  guitar: ['guitar'],
  guitarNight: ['guitar'],
  piano: ['piano'],
  pianoNight: ['piano'],
  earLab: ['ear'],
  karaokeNight: ['karaoke'],
  jam: 'opened',
  lesson1: 'opened',
  lesson2: 'opened',
  hearYourself: 'opened',
}

/**
 * Is this stop done: its room has given a first value on this device, or, for
 * a room with none, `opened` says it was opened from the plan. A name that is
 * not a destination (read back from storage, say) is a stop not done, even
 * one an object inherits, such as `constructor`.
 */
export function stopDoneBy(
  dest: PlanDest,
  opened: (dest: PlanDest) => boolean,
): boolean {
  if (!Object.hasOwn(DONE_WHEN, dest)) return false
  const rule = DONE_WHEN[dest]
  if (rule === 'opened') return opened(dest)
  return rule.some((kind) => firstValueSeen(kind))
}

/**
 * A hide on this device, as it is stored under PLAN_CARD_DISMISSED_KEY: the
 * date (`at`) of the record whose card the X hid, or `true`, which the X
 * stored before it kept a date and which hides the card of any record. Null
 * is no hide.
 */
export type PlanCardHide = string | true | null

/**
 * The hide stored on this device: a date, or `true`, and nothing else. A
 * value that is neither (an empty string, a number, damage) is no hide, and
 * so is storage that cannot be read.
 */
export function hideOnDevice(): PlanCardHide {
  const val = storageGet<unknown>(PLAN_CARD_DISMISSED_KEY)
  if (val === true) return true
  return typeof val === 'string' && val.length > 0 ? val : null
}

/**
 * Does this hide hide the card of this record? A date hides the record that
 * carries it, and a record written since that holds no answers: Not now
 * again, here or on another device, is no new plan, so its ask stays off
 * Home. A record answered since is a new plan, and is not hidden. A date that
 * does not read hides only the record that carries it. `true` hides every
 * record.
 */
export function hidesCard(
  hide: PlanCardHide,
  record: PlanCardRecord | null,
): boolean {
  if (hide === true) return true
  if (hide === null || record === null) return false
  if (record.at === hide) return true
  return (
    record.status !== 'answered' && Date.parse(record.at) > Date.parse(hide)
  )
}

/**
 * Is this record's card hidden on this device? Read from storage as it
 * stands, for a caller that holds no store (Home's slot); the store keeps the
 * same hide in a signal (plan-store.ts), which is what a screen reads.
 * Storage that cannot be read says no.
 */
export function hiddenOnDevice(record: PlanCardRecord | null): boolean {
  return hidesCard(hideOnDevice(), record)
}

/** Is this a list of names, as the opened stops are stored? */
export function isNameList(val: unknown): val is string[] {
  return Array.isArray(val) && val.every((name) => typeof name === 'string')
}

/**
 * The stops opened from the plan on this device, read from storage as it
 * stands: none when nothing that reads as a list of names is stored. The store
 * keeps the same list in a persisted signal (plan-store.ts), which is what a
 * screen reads; this is the read for a caller that holds no store.
 */
export function openedOnDevice(): string[] {
  const val = storageGet<unknown>(PLAN_OPENED_KEY)
  return isNameList(val) ? val : []
}
