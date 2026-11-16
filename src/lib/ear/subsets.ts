// ============================================================
// Ear Lab — a drill narrowed to some of its items: a lesson's set.
//
// A lesson's link can open a drill on only what the lesson taught
// (`/exercises/<slug>`, the `ear-drill` launch in
// src/features/exercises/slug-map.ts): Leap on the perfect intervals and
// the tritone, Gravity on Te and Ti. The link names the set by the
// drill's own bank ids, so a new set is data.
//
// A run over a set is not a run of the drill, so it is rated apart, as
// Lesson 2 decided for Leap on m2 and M2 (its DECISIONS 73): on a track of
// its own, with the guess floor of the pads it shows, and leaving the
// items' difficulties alone. The drill's own rating and the bank's
// calibration then still describe the whole drill. A set that does not
// resolve (a drill that cannot be narrowed, an id its bank does not
// have, fewer than two answers, every item) opens the drill whole
// rather than failing.
//
// Pure: no store, no sound.
// ============================================================

import { CHART_BANK, LEAP_BANK, STACK_BANK } from './banks'
import type { DegreeSet } from './item-bank'
import { GRAVITY_SET } from './item-bank'
import { METRE_BANK } from './metre'

/** A drill narrowed to some of its items. */
export interface EarSubset {
  /** The drill, by the id the Ear Lab opens it by. */
  drillId: string
  /** The items it asks, by the drill's bank ids, in the bank's order. */
  itemIds: readonly string[]
  /** Where a run over the set is rated, apart from the drill's own
   *  rating: the drill and its items. */
  trackId: string
  /** The Elo guess floor: one over the answers its pads show, or zero
   *  where the answer is tapped back rather than picked. */
  guessRate: number
}

interface Narrowable {
  /** Every item, by bank id, in the bank's order. */
  ids: readonly string[]
  /** The answer an item is named by: the metre for Subdivide's bars,
   *  the item itself everywhere else. */
  answerOf: (id: string) => string
  /** Answered from pads, which sets a guess floor. The Chart's answer
   *  is a take, tapped back. */
  pads: boolean
}

const itself = (id: string): string => id
const idsOf = (bank: ReadonlyArray<{ itemId: string }>): string[] =>
  bank.map((item) => item.itemId)

/** The drills a set can narrow, by the id the Ear Lab opens each by. */
const NARROWABLE: Readonly<Record<string, Narrowable>> = {
  leap: { ids: idsOf(LEAP_BANK), answerOf: itself, pads: true },
  stack: { ids: idsOf(STACK_BANK), answerOf: itself, pads: true },
  chart: { ids: idsOf(CHART_BANK), answerOf: itself, pads: false },
  subdivide: {
    ids: idsOf(METRE_BANK),
    answerOf: (id) =>
      METRE_BANK.find((item) => item.itemId === id)?.label ?? id,
    pads: true,
  },
  gravity: {
    ids: GRAVITY_SET.degrees.map((degree) => GRAVITY_SET.itemId(degree.degree)),
    answerOf: itself,
    pads: true,
  },
}

/** The drills a lesson's set can narrow. */
export const NARROWABLE_DRILLS: readonly string[] = Object.keys(NARROWABLE)

/**
 * The set a link asks for, or null for the whole drill: no items, a
 * drill that cannot be narrowed, an id its bank does not have, fewer
 * than two answers to choose between, or every item the drill has.
 */
export function resolveEarSubset(
  drillId: string,
  itemIds: readonly string[] | null | undefined,
): EarSubset | null {
  if (!Array.isArray(itemIds) || !Object.hasOwn(NARROWABLE, drillId)) {
    return null
  }
  const drill = NARROWABLE[drillId]
  if (itemIds.some((id) => !drill.ids.includes(id))) return null
  const ids = drill.ids.filter((id) => itemIds.includes(id))
  const answers = new Set(ids.map(drill.answerOf))
  if (answers.size < 2 || ids.length === drill.ids.length) return null
  return {
    drillId,
    itemIds: ids,
    trackId: `${drillId}:set:${ids.join(',')}`,
    guessRate: drill.pads ? 1 / answers.size : 0,
  }
}

/** The set's answers, each once, in the bank's order: Subdivide's two
 *  metres for its four bars, the items themselves elsewhere. */
export function subsetAnswers(subset: EarSubset): string[] {
  const answerOf = NARROWABLE[subset.drillId]?.answerOf ?? itself
  return [...new Set(subset.itemIds.map(answerOf))]
}

/** A bank's items that are in the set, in the bank's order. */
export function narrowBank<T extends { itemId: string }>(
  bank: readonly T[],
  subset: EarSubset | null | undefined,
): readonly T[] {
  return subset
    ? bank.filter((item) => subset.itemIds.includes(item.itemId))
    : bank
}

/** A degree drill's set narrowed: its pads and its picks are the set's
 *  degrees, its two tracks the set's own, and it keeps the drill's every
 *  degree as `whole` (item-bank.ts says what that changes). */
export function narrowDegreeSet(set: DegreeSet, subset: EarSubset): DegreeSet {
  const degrees = set.degrees.filter((degree) =>
    subset.itemIds.includes(set.itemId(degree.degree)),
  )
  return {
    ...set,
    tapDrillId: subset.trackId,
    micDrillId: `${subset.trackId}:sing`,
    degrees,
    choices: degrees.length,
    whole: set.degrees,
  }
}

// ── The words the bench says about a set ────────────────────────

const COUNT_WORDS = [
  'no',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
]

/** A count as a word: "four". Digits past fifteen. */
export function countWord(count: number): string {
  return COUNT_WORDS[count] ?? String(count)
}

/** "P4, TT, P5 and P8"; "triplets or sixteenths". */
export function listWords(words: readonly string[], joiner = 'and'): string {
  if (words.length <= 1) return words.join('')
  return `${words.slice(0, -1).join(', ')} ${joiner} ${words[words.length - 1]}`
}

/** What a set asks, at idle: "Only P4, TT, P5 and P8 this time, four of
 *  the twelve." `noun` follows the whole's count ("of the five metres"). */
export function subsetLine(
  asked: readonly string[],
  of: number,
  noun?: string,
): string {
  return `Only ${listWords(asked)} this time, ${countWord(asked.length)} of the ${countWord(of)}${
    noun === undefined ? '' : ` ${noun}`
  }.`
}

/** And what it leaves alone. */
export function subsetRatingLine(drillName: string): string {
  return `Rated on their own: your ${drillName} rating stays as it is.`
}
