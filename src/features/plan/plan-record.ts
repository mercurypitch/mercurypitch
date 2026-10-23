// ============================================================
// Plan record — what is kept of the answers, and what counts as a record
// ============================================================
//
// The record is the four answers as ids, with when and how the plan was
// first shown. It is stored under PLAN_RECORD_KEY, which syncs to the
// account, so it comes back from other devices as well as from this one:
// from a newer client, a hand edit or half a write. isPlanRecordV1 is the
// one gate, and it is strict. A value that fails it is treated as no record
// and never thrown at, because a person must not meet an error for storage
// they did not touch.
//
// Three things are easy to break:
//
// - The record holds ids only. What the person typed under "Something else"
//   and "Another app", and the reason a voiceprint gave, are not in it. The
//   lines live under PLAN_TEXT_KEY, which stays on this device; this file
//   reads and writes them, cut to the limits the fields use.
// - The known ids are not listed here by hand. They are read from the
//   questions, so an option added to a column is accepted the day it can be
//   picked, and an id no column offers is not.
// - This file is pure: it imports no store, because the funnel and the
//   screens read it.

import type { RoomId } from '@/features/onboarding/rooms'
import { storageGet, storageSet } from '@/lib/storage'
import { PLAN_TEXT_KEY } from './plan-keys'
import type { PlanChoices, PlanOption, Q1Answer, Q2Id, Q3Id, Q4Id, } from './questions'
import { EVERYTHING, INSTRUMENTS, q2Options, Q3_MAX, q3Options, q4Options, } from './questions'

/** Where a record stands: put in front of the person, answered, or turned down. */
export type PlanStatus = 'shown' | 'answered' | 'declined'

/**
 * How the plan was first shown: in First Light, in the app, or, for
 * `welcome-skip`, marked as shown when the person skipped First Light's
 * intro, so that no takeover follows.
 */
export type PlanVia = 'first-light' | 'layer' | 'welcome-skip'

/**
 * The record, version 1. A later version can re-ask after a big change to the
 * questions, and this client reads it as no record. `at` is when this status
 * was written and `syncedAt` is when it last reached the account: both are
 * dates written as text.
 */
export interface PlanRecordV1 {
  v: 1
  status: PlanStatus
  choices: PlanChoices
  at: string
  via: PlanVia
  /** What the voiceprint found, where it pointed and not why. Only when it found something. */
  voiceprint?: { room: RoomId; detail: string | null }
  syncedAt?: string
}

/** The two lines a person can type. They are never part of the record. */
export interface PlanTexts {
  q3other: string
  q4app: string
}

/** The longest "Something else" line: the field's own limit. */
export const Q3_OTHER_MAX = 140

/** The longest "Another app" name: the field's own limit. */
export const Q4_APP_MAX = 60

// ── The ids the questions can write ────────────────────────────────────

/** Q1's answers: the four instruments, then "A bit of everything". */
const Q1_ANSWERS: readonly Q1Answer[] = [
  ...INSTRUMENTS.map((i) => i.id),
  EVERYTHING.id,
]

/**
 * A skipped Q1 is a first answer too: the questions after it offer a column
 * of their own, which today is the Singing one.
 */
const FIRST_ANSWERS: readonly (Q1Answer | null)[] = [...Q1_ANSWERS, null]

/** The ids a later question offers across every first answer, each once. */
function offeredIds<Id extends string>(
  options: (q1: Q1Answer | null) => PlanOption<Id>[],
): readonly Id[] {
  return [
    ...new Set(FIRST_ANSWERS.flatMap((q1) => options(q1).map((o) => o.id))),
  ]
}

/**
 * Every id the four questions can write, read from the questions. The
 * events name the same ids, so both read this one list.
 */
export const PLAN_IDS: {
  readonly q1: readonly Q1Answer[]
  readonly q2: readonly Q2Id[]
  readonly q3: readonly Q3Id[]
  readonly q4: readonly Q4Id[]
} = {
  q1: Q1_ANSWERS,
  q2: offeredIds(q2Options),
  q3: offeredIds(q3Options),
  q4: offeredIds(q4Options),
}

const KNOWN_Q1: ReadonlySet<unknown> = new Set(PLAN_IDS.q1)
const KNOWN_Q2: ReadonlySet<unknown> = new Set(PLAN_IDS.q2)
const KNOWN_Q3: ReadonlySet<unknown> = new Set(PLAN_IDS.q3)
const KNOWN_Q4: ReadonlySet<unknown> = new Set(PLAN_IDS.q4)

// A Record, not a list, so a room added to RoomId fails to compile here
// until the validator knows it.
const ROOM_FLAGS: Record<RoomId, true> = {
  practice: true,
  exercises: true,
  ascent: true,
  karaoke: true,
  jam: true,
  analysis: true,
}
const KNOWN_ROOMS: ReadonlySet<unknown> = new Set(Object.keys(ROOM_FLAGS))

const KNOWN_STATUSES: ReadonlySet<unknown> = new Set<PlanStatus>([
  'shown',
  'answered',
  'declined',
])
const KNOWN_VIAS: ReadonlySet<unknown> = new Set<PlanVia>([
  'first-light',
  'layer',
  'welcome-skip',
])

// ── The record ─────────────────────────────────────────────────────────

function isObject(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null && !Array.isArray(val)
}

/** A date written as text that a Date can read. A number is not one. */
function isDateText(val: unknown): val is string {
  return typeof val === 'string' && !Number.isNaN(Date.parse(val))
}

/** An answer that may be left out: null, or an id from `known`. */
function isPick(val: unknown, known: ReadonlySet<unknown>): boolean {
  return val === null || known.has(val)
}

/** A list of ids from `known`, no longer than `max`. */
function isIdList(
  val: unknown,
  known: ReadonlySet<unknown>,
  max = Infinity,
): boolean {
  return (
    Array.isArray(val) && val.length <= max && val.every((id) => known.has(id))
  )
}

function isChoices(val: unknown): val is PlanChoices {
  if (!isObject(val)) return false
  return (
    isPick(val.q1, KNOWN_Q1) &&
    isPick(val.q2, KNOWN_Q2) &&
    isIdList(val.q3, KNOWN_Q3, Q3_MAX) &&
    isIdList(val.q4, KNOWN_Q4)
  )
}

function isVoiceprint(
  val: unknown,
): val is NonNullable<PlanRecordV1['voiceprint']> {
  return (
    isObject(val) &&
    KNOWN_ROOMS.has(val.room) &&
    (val.detail === null || typeof val.detail === 'string')
  )
}

/** A field a record may leave out: it is absent, or it is valid. */
function isAbsentOr(val: unknown, isValid: (val: unknown) => boolean): boolean {
  return val === undefined || isValid(val)
}

/** What a record says about itself: its version, status, way in and date. */
function hasValidHead(val: Record<string, unknown>): boolean {
  return (
    val.v === 1 &&
    KNOWN_STATUSES.has(val.status) &&
    KNOWN_VIAS.has(val.via) &&
    isDateText(val.at)
  )
}

/** The fields a record may leave out: the voiceprint, and when it was synced. */
function hasValidExtras(val: Record<string, unknown>): boolean {
  return (
    isAbsentOr(val.voiceprint, isVoiceprint) &&
    isAbsentOr(val.syncedAt, isDateText)
  )
}

/**
 * Is this value a record this client can read? Version 1 exactly, ids it
 * knows, no more Q3 picks than the questions allow, and dates that parse. A
 * record from a newer version fails on `v` and fails whole: this client does
 * not guess at fields it has not met.
 */
export function isPlanRecordV1(val: unknown): val is PlanRecordV1 {
  return (
    isObject(val) &&
    hasValidHead(val) &&
    isChoices(val.choices) &&
    hasValidExtras(val)
  )
}

// ── The typed lines ────────────────────────────────────────────────────

/**
 * A typed line as it is kept: trimmed, cut at `max`, and trimmed again so a
 * cut that lands after a space leaves none. Anything that is not text is an
 * empty line. A line that has been kept reads back as it was: a second pass
 * changes nothing.
 */
function typedLine(text: unknown, max: number): string {
  return typeof text === 'string' ? text.trim().slice(0, max).trimEnd() : ''
}

function keptTexts(from: { q3other?: unknown; q4app?: unknown }): PlanTexts {
  return {
    q3other: typedLine(from.q3other, Q3_OTHER_MAX),
    q4app: typedLine(from.q4app, Q4_APP_MAX),
  }
}

/** The lines typed under "Something else" and "Another app", or empty ones. */
export function readPlanTexts(): PlanTexts {
  const stored = storageGet<unknown>(PLAN_TEXT_KEY)
  return keptTexts(isObject(stored) ? stored : {})
}

/** Keeps the typed lines on this device, trimmed and cut to their limits. */
export function writePlanTexts(t: PlanTexts): void {
  storageSet(PLAN_TEXT_KEY, keptTexts(t))
}
