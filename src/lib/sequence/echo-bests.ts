// ============================================================
// Echo bests: the best run at each level, and two tables as one
// ============================================================
//
// One best per level, keyed by the tier id (ECHO_LEVELS), so a run at
// Professional never wipes the best at Singer: the levels ask for a
// different number of notes (15, 20, 25), and the catalogue card shows the
// best at the level the singer is at ("Best 18 of 20"). A best is the
// notes landed, the big number on the result; accuracy breaks a tie.
//
// The table follows the account like Long note's (hold-bests.ts): a pull
// merges the two tables (mergeEchoBestsOnPull), every level from either
// side keeping the better of its two bests, and the account is sent the
// result.
//
// Here in lib, not in the room, because the settings sync (src/db) names
// the merge, and a build without the premium exercises folds the key and
// the merge away with it.

import type { EchoLevelId } from './sequence-engine'

/**
 * The levels a table may hold, as ECHO_LEVELS keys them. Listed here
 * rather than read from the engine: the settings sync imports this module
 * into the app's first chunk, and the engine has no business there
 * (echo-bests.test.ts holds the two lists equal).
 */
export const ECHO_BEST_LEVELS = [
  'learning',
  'singer',
  'professional',
] as const satisfies readonly EchoLevelId[]

/** Where the table lives, and the settings row it syncs as. */
export const ECHO_BESTS_KEY = 'pitchperfect_echo_stars_bests'

export interface EchoBest {
  /** Notes landed in the run: the stars lit. */
  readonly landed: number
  /** Notes the run asked for. */
  readonly notes: number
  /** How centred the landed notes were, 0 to 100; null when none landed. */
  readonly accuracy: number | null
  readonly at: number
}

/** The best per level, keyed by the tier id. */
export type EchoBestTable = Readonly<Partial<Record<EchoLevelId, EchoBest>>>

const isLevel = (key: string): key is EchoLevelId =>
  (ECHO_BEST_LEVELS as readonly string[]).includes(key)

const isCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0

function isBest(value: unknown): value is EchoBest {
  if (typeof value !== 'object' || value === null) return false
  const row = value as Record<string, unknown>
  const accuracy = row.accuracy
  return (
    isCount(row.landed) &&
    isCount(row.notes) &&
    row.landed <= row.notes &&
    (accuracy === null ||
      (typeof accuracy === 'number' && Number.isFinite(accuracy))) &&
    typeof row.at === 'number'
  )
}

export function isEchoBestTable(value: unknown): value is EchoBestTable {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }
  return Object.entries(value).every(
    ([key, row]) => isLevel(key) && isBest(row),
  )
}

/** Whether `run` beats `previous`: more notes landed, or as many and more centred. */
export function echoBeats(run: EchoBest, previous: EchoBest | null): boolean {
  if (previous === null) return true
  if (run.landed !== previous.landed) return run.landed > previous.landed
  // Whole points are what the result shows, so less than one is a tie.
  return (run.accuracy ?? 0) - (previous.accuracy ?? 0) >= 1
}

/**
 * The better of one level's two bests, the same whichever side each came
 * from. On a tie the earlier run stands, as it would on one device.
 */
function better(a: EchoBest, b: EchoBest): EchoBest {
  if (echoBeats(a, b)) return a
  if (echoBeats(b, a)) return b
  if (a.at !== b.at) return a.at < b.at ? a : b
  return JSON.stringify(a) <= JSON.stringify(b) ? a : b
}

/** Every level from either table, each with the better of its bests. */
export function mergeEchoBestTables(
  a: EchoBestTable,
  b: EchoBestTable,
): EchoBestTable {
  const merged: Partial<Record<EchoLevelId, EchoBest>> = {}
  for (const level of ECHO_BEST_LEVELS) {
    const mine = a[level]
    const theirs = b[level]
    if (mine === undefined && theirs === undefined) continue
    if (mine === undefined) merged[level] = theirs
    else merged[level] = theirs === undefined ? mine : better(mine, theirs)
  }
  return merged
}

function readTable(raw: string | null): EchoBestTable | null {
  if (raw === null) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    return isEchoBestTable(parsed) ? parsed : null
  } catch {
    return null
  }
}

/** Whether the merge kept exactly `table`'s rows. */
function keeps(merged: EchoBestTable, table: EchoBestTable): boolean {
  const levels = Object.keys(merged) as EchoLevelId[]
  return (
    levels.length === Object.keys(table).length &&
    levels.every((level) => merged[level] === table[level])
  )
}

/**
 * The settings pull's resolver (MERGE_ON_PULL): the device's and the
 * account's raw values in, the one both should hold out. A side that does
 * not read gives way to the other, the account's when neither reads; an
 * unchanged side comes back as its own string, so nothing is rewritten.
 */
export function mergeEchoBestsOnPull(
  local: string | null,
  cloud: string,
): string {
  const mine = readTable(local)
  const theirs = readTable(cloud)
  if (mine === null || local === null) return cloud
  if (theirs === null) return local
  const merged = mergeEchoBestTables(mine, theirs)
  if (keeps(merged, theirs)) return cloud
  if (keeps(merged, mine)) return local
  return JSON.stringify(merged)
}
