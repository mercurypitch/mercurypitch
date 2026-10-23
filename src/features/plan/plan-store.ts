// ============================================================
// Plan store — the person's plan record, the stops they opened, the layer
// ============================================================
//
// One record under PLAN_RECORD_KEY says where the plan stands for this
// person: shown to them, answered, or turned down with Not now. The key
// syncs to the account, so the status only ever moves forward and every
// write is careful about what it replaces. The record's setter is private
// to this file for that reason: each way to write the record is a function
// below that looks at what is stored first, and nothing outside this file
// can write it without that look.
//
// Four things are easy to break:
//
// - An answered plan is never turned back into shown or declined.
//   markPlanShown writes only when there is no record, and declinePlan
//   leaves an answered one alone.
// - A stored value that cannot be read (a newer client's record, or damage)
//   reads as no plan, but it is still in storage and a settings sync would
//   carry whatever replaces it to every device. So "shown", "Not now" and
//   the synced mark never write over it; only an answer does, because the
//   person has just given one and it has to be kept. The check looks at
//   storage itself, not at the signal: another tab, or a pull from the
//   account, may have written since this tab loaded, and the signal only
//   knows what it could read.
// - The record holds ids only. The typed lines go to the device key, before
//   the record is written, so anything that reacts to the new record finds
//   them, and a line is kept only while its option is picked: "Something
//   else" in Q3 and "Another app" in Q4. A line typed and then deselected
//   is stored as empty, so it cannot stay on the device or travel with the
//   plan. A voiceprint is kept only where it pointed, and only when it found
//   something.
// - The synced mark belongs to one plan. markPlanSynced is given the date
//   the plan carried when it was sent, and writes only while the record
//   still carries it, so a plan changed while it was on its way is never
//   marked as sent.
//
// The stops the person opened, and the layer's mode, are not synced: the
// first is kept on this device under an `mp.` key and the second is not
// kept at all.

import type { Accessor } from 'solid-js'
import { createSignal, untrack } from 'solid-js'
import { createPersistedSignal, storageGet } from '@/lib/storage'
import type { PlanDest, VoiceprintStop } from './build-plan'
import { PLAN_OPENED_KEY, PLAN_RECORD_KEY } from './plan-keys'
import type { PlanRecordV1, PlanStatus, PlanTexts, PlanVia, } from './plan-record'
import { isPlanRecordV1, pickedLines, writePlanTexts } from './plan-record'
import type { PlanChoices } from './questions'
import { EMPTY_CHOICES, pruneChoices } from './questions'

// ── The record ─────────────────────────────────────────────────────────

const [recordSignal, setPlanRecord] =
  createPersistedSignal<PlanRecordV1 | null>(PLAN_RECORD_KEY, null, {
    validator: (val): val is PlanRecordV1 | null =>
      val === null || isPlanRecordV1(val),
  })

/**
 * The record, or null when none can be read. A value that fails
 * isPlanRecordV1 is no record. Read-only: the setter stays in this file.
 */
export const planRecord: Accessor<PlanRecordV1 | null> = recordSignal

/** What a write finds: a record, no record, or a stored value no record can be read from. */
type Current = PlanRecordV1 | null | 'unreadable'

/**
 * The record as it is now. Storage is read before the signal, because it is
 * the later word. An empty or null value in storage is no value, and the
 * signal then answers for a record that only this tab holds (storage was
 * full, or refused the write). The signal is read untracked: this is the
 * look before a write, and whatever calls the write must not come to depend
 * on the record by doing so.
 */
function currentRecord(): Current {
  const stored = storageGet<unknown>(PLAN_RECORD_KEY)
  if (stored === null || stored === '') return untrack(planRecord)
  return isPlanRecordV1(stored) ? stored : 'unreadable'
}

/** How the plan was first shown, as far as the record knows. A plan that was never recorded as shown was met in the app. */
function viaOf(current: Current): PlanVia {
  return current === null || current === 'unreadable' ? 'layer' : current.via
}

/**
 * A record written now. The choices are saved as the questions settle them,
 * in new arrays, so the record never holds the caller's object (which may be
 * a store's proxy, changed after this returns) and always reads back as a
 * record. Nothing carries over from an earlier record but the way it was
 * first shown: a new status has not been synced.
 */
function newRecord(
  status: PlanStatus,
  c: PlanChoices,
  via: PlanVia,
  now: Date,
): PlanRecordV1 {
  return {
    v: 1,
    status,
    choices: pruneChoices(c),
    at: now.toISOString(),
    via,
  }
}

/** Records that the plan was put in front of the person. Only when there is no record at all. */
export function markPlanShown(via: PlanVia, now: Date = new Date()): void {
  if (currentRecord() !== null) return
  setPlanRecord(newRecord('shown', EMPTY_CHOICES, via, now))
}

/**
 * The rooms whose voiceprint is a finding: where it found something to work
 * on. `practice` is where nothing measured sends someone, which is the
 * default and says nothing, and `jam` and `analysis` are not rooms a
 * voiceprint points at. build-plan.ts decides which findings it uses, and
 * plan-store.test.ts holds this list to it.
 */
const FINDING_ROOMS: ReadonlySet<VoiceprintStop['room']> = new Set([
  'exercises',
  'ascent',
  'karaoke',
])

/** What the record keeps of a voiceprint: where it pointed, never why, and nothing when it found nothing. */
function keptVoiceprint(
  voiceprint: VoiceprintStop | null | undefined,
): PlanRecordV1['voiceprint'] {
  if (!voiceprint || !FINDING_ROOMS.has(voiceprint.room)) return undefined
  return { room: voiceprint.room, detail: voiceprint.detail }
}

/**
 * Saves the answers: the record becomes answered, dated now, with no synced
 * date so that a changed plan syncs again, and the typed lines go to this
 * device first, each only if its option is picked (an earlier line whose
 * option is no longer picked is stored over with an empty one). This is the
 * one write that replaces a stored value that could not be read.
 */
export function savePlanAnswers(
  c: PlanChoices,
  t: PlanTexts,
  voiceprint?: VoiceprintStop | null,
  now: Date = new Date(),
): void {
  const record = newRecord('answered', c, viaOf(currentRecord()), now)
  const kept = keptVoiceprint(voiceprint)
  if (kept) record.voiceprint = kept
  writePlanTexts(pickedLines(record.choices, t))
  setPlanRecord(record)
}

/**
 * Records Not now with the answers so far. It never turns an answered plan
 * back into declined, and it leaves a stored value that cannot be read where
 * it is.
 */
export function declinePlan(c: PlanChoices, now: Date = new Date()): void {
  const current = currentRecord()
  if (current === 'unreadable' || current?.status === 'answered') return
  setPlanRecord(newRecord('declined', c, viaOf(current), now))
}

/**
 * Marks the plan as received by the account: `syncedAt` is set to `now`,
 * once. `recordAt` is the `at` of the record that was sent, and the mark is
 * written only while the record is still that answered plan. A person who
 * answers again while the first plan is on its way has a new plan that was
 * never sent, and the late reply must not mark it; a plan another tab has
 * changed since is the same. Like every write here, it leaves a stored
 * value that cannot be read where it is, and it writes nothing when there
 * is no record.
 */
export function markPlanSynced(recordAt: string, now: Date = new Date()): void {
  const current = currentRecord()
  if (current === null || current === 'unreadable') return
  if (current.status !== 'answered' || current.at !== recordAt) return
  if (current.syncedAt !== undefined) return
  setPlanRecord({ ...current, syncedAt: now.toISOString() })
}

// ── The stops the person opened ────────────────────────────────────────

function isNameList(val: unknown): val is string[] {
  return Array.isArray(val) && val.every((name) => typeof name === 'string')
}

/** The plan's stops this person has opened, on this device. Not synced: the key starts `mp.`. */
const [openedStops, setOpenedStops] = createPersistedSignal<string[]>(
  PLAN_OPENED_KEY,
  [],
  { validator: isNameList },
)

/** Has this stop been opened from the plan? Reactive. */
export function stopOpened(dest: PlanDest): boolean {
  return openedStops().includes(dest)
}

/** Remembers that a stop was opened, once. */
export function markStopOpened(dest: PlanDest): void {
  if (untrack(() => stopOpened(dest))) return
  setOpenedStops((names) => [...names, dest])
}

// ── The layer ──────────────────────────────────────────────────────────

/**
 * How the plan layer opens in the app. `existing` is the one takeover an
 * existing user gets, `skipper` is someone who opens the four taps from
 * Home or the Guide, and `review` is an answered plan, opened on the plan.
 */
export type PlanLayerMode = 'existing' | 'skipper' | 'review'

const [layerMode, setLayerMode] = createSignal<PlanLayerMode | null>(null)

/** The mode the layer is open in, or null while it is closed. Not stored. */
export const planLayerMode: Accessor<PlanLayerMode | null> = layerMode

export function openPlanLayer(mode: PlanLayerMode): void {
  setLayerMode(mode)
}

export function closePlanLayer(): void {
  setLayerMode(null)
}
