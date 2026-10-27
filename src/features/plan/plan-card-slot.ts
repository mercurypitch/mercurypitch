// ============================================================
// Plan card slot — the slot Home keeps for its plan card, read before the card is in
// ============================================================
//
// Home's "Your plan" card comes in a lazy chunk, after Home's first paint: the
// native bundle has no plan, and Home does not wait for it. A card that lands
// in an empty grid pushes the rest of Home down (the PR 1.3 gate's H-4: the
// session card moved 273 px on a phone, a layout shift of 0.23), so Home keeps
// a slot for it from what it can read at once, from storage and from the
// card's rules (plan-card-rules.ts), which carry no plan code either. This file
// is Home's memory of the card's layout and nothing else: its key, the read
// Home makes as it is drawn, and what the card keeps for that read.
//
// - Which card, if either, a record asks for in its week is the card's rule
//   (planCardKind). The one thing only the card can tell is whether every
//   stop of a plan is done, and how tall it is.
// - So the card keeps the height it last drew at on this device
//   (`rememberPlanCardSlot`), for the record it drew, the width of the window
//   and the stops it drew. Home keeps no slot for a card that drew nothing for
//   this record (a height of 0), or whose stops are all done by now (the last
//   one was done in another room, and Home was not drawn since). Both are
//   facts of the record, not of the window, so they hold at any width. With
//   no height for this record and this width (a record that came from the
//   account, or a window resized), Home's sheet guesses one by the kind
//   (HomePlanCardMount.module.css).
//
// The record is read as Home needs it, not as the store validates it: a
// version-1 object with a status and a date. A stored record the store will
// not read is a card that draws nothing, which the card then keeps as 0.

import { storageGet, storageSet } from '@/lib/storage'
import type { PlanDest } from './build-plan'
import type { PlanCardKind, PlanCardRecord } from './plan-card-rules'
import { hiddenOnDevice, isNameList, openedOnDevice, planCardKind, stopDoneBy, } from './plan-card-rules'
import { PLAN_CARD_SLOT_KEY, PLAN_RECORD_KEY } from './plan-keys'

/** The slot Home keeps for the card: its kind, and its height when the card has drawn it here. */
export interface PlanCardSlot {
  kind: PlanCardKind
  /** CSS pixels; null when Home's sheet is to guess it. */
  height: number | null
}

/**
 * How long the card's height has to hold before the card keeps it, in
 * milliseconds: past the fonts that land as it draws, and past the frames of
 * a window being resized, so a drag writes once and not once a frame.
 */
export const PLAN_CARD_SLOT_SETTLE_MS = 250

function isObject(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null && !Array.isArray(val)
}

/** The stored record's status and date, or null when no version-1 record is stored. */
function storedRecord(): PlanCardRecord | null {
  const val = storageGet<unknown>(PLAN_RECORD_KEY)
  if (!isObject(val) || val.v !== 1) return null
  const { status, at } = val
  return typeof status === 'string' && typeof at === 'string'
    ? { status, at }
    : null
}

interface Kept {
  at: string
  w: number
  h: number
  /** The stops the card drew, none for the ask. */
  dests: string[]
}

/** The height the card kept, or null when what is stored does not read as one. */
function kept(): Kept | null {
  const val = storageGet<unknown>(PLAN_CARD_SLOT_KEY)
  if (!isObject(val)) return null
  const { at, w, h, dests } = val
  return typeof at === 'string' &&
    typeof w === 'number' &&
    typeof h === 'number' &&
    h >= 0 &&
    isNameList(dests)
    ? { at, w, h, dests }
    : null
}

/** Has every stop the card drew been done since? Read from storage, as the store would. */
function everyStopDone(dests: string[]): boolean {
  if (dests.length === 0) return false
  const opened = openedOnDevice()
  return dests.every((dest) =>
    stopDoneBy(dest as PlanDest, (d) => opened.includes(d)),
  )
}

/**
 * The slot Home keeps for its card as it is drawn, `now` epoch milliseconds
 * and the window `width` CSS pixels wide, or null when it keeps none. The
 * kept record is matched first, then the two tests that say the card draws
 * nothing, and only then the width, which can only send it to the guess.
 */
export function readPlanCardSlot(
  now: number,
  width: number,
): PlanCardSlot | null {
  const record = storedRecord()
  const kind = planCardKind({ record, dismissed: hiddenOnDevice(record), now })
  if (kind === null || record === null) return null
  const last = kept()
  if (last === null || last.at !== record.at) return { kind, height: null }
  if (last.h === 0 || everyStopDone(last.dests)) return null
  if (last.w !== width) return { kind, height: null }
  return { kind, height: last.h }
}

/**
 * Keeps the height the card drew at (0 when it drew nothing) and the stops it
 * drew, in a window `width` wide, for Home's next load. `at` is the date of
 * the record the card drew, which a store write can set before storage holds
 * it; without one (a stored record the store will not read) it is the stored
 * record's. Nothing without a record; nothing written when it is kept already.
 */
export function rememberPlanCardSlot(
  height: number,
  width: number,
  dests: readonly PlanDest[],
  at: string | undefined = storedRecord()?.at,
): void {
  if (at === undefined) return
  const last = kept()
  if (
    last !== null &&
    last.at === at &&
    last.w === width &&
    last.h === height &&
    last.dests.join() === dests.join()
  ) {
    return
  }
  storageSet(PLAN_CARD_SLOT_KEY, { at, w: width, h: height, dests: [...dests] })
}
