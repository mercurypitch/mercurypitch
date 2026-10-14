// ============================================================
// Ng slides bests: the best run at each level, and two tables as one
// ============================================================
//
// One best per level, keyed by the tier id (NG_SLIDES_LEVELS), so a run at
// Professional never wipes the best at Singer: the levels slide at
// different speeds and judge a different band, and the catalogue card
// shows the best at the level the singer is at ("Best 94% lit"). A best is
// the share of the bridge lit, as the result's big number shows it (whole
// per cent); fewer jumps break a tie.
//
// The table follows the account like Echo's (echo-bests.ts): a pull merges
// the two tables (mergeNgBestsOnPull), every level from either side keeping
// the better of its two bests, and the account is sent the result.
//
// Here in lib, not in the room, because the settings sync (src/db) names
// the merge, and a build without the premium exercises folds the key and
// the merge away with it.

import type { GlideLevelId } from './glide-presets'

/**
 * The levels a table may hold, as NG_SLIDES_LEVELS keys them. Listed here
 * rather than read from the presets: the settings sync imports this module
 * into the app's first chunk (ng-bests.test.ts holds the two lists equal).
 */
export const NG_BEST_LEVELS = [
  'learning',
  'singer',
  'professional',
] as const satisfies readonly GlideLevelId[]

/** Where the table lives, and the settings row it syncs as. */
export const NG_BESTS_KEY = 'pitchperfect_ng_slides_bests'

export interface NgBest {
  /** The bridge lit, whole per cent: the result's big number. */
  readonly lit: number
  /** Arches that reached the level's line, of five. */
  readonly arches: number
  /** Jumps heard in the run. */
  readonly jumps: number
  readonly at: number
}

/** The best per level, keyed by the tier id. */
export type NgBestTable = Readonly<Partial<Record<GlideLevelId, NgBest>>>

const isLevel = (key: string): key is GlideLevelId =>
  (NG_BEST_LEVELS as readonly string[]).includes(key)

const isCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0

function isBest(value: unknown): value is NgBest {
  if (typeof value !== 'object' || value === null) return false
  const row = value as Record<string, unknown>
  return (
    isCount(row.lit) &&
    row.lit <= 100 &&
    isCount(row.arches) &&
    isCount(row.jumps) &&
    typeof row.at === 'number' &&
    Number.isFinite(row.at)
  )
}

export function isNgBestTable(value: unknown): value is NgBestTable {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }
  return Object.entries(value).every(
    ([key, row]) => isLevel(key) && isBest(row),
  )
}

/** Whether `run` beats `previous`: more of the bridge lit, or as much with fewer jumps. */
export function ngBeats(run: NgBest, previous: NgBest | null): boolean {
  if (previous === null) return true
  if (run.lit !== previous.lit) return run.lit > previous.lit
  return run.jumps < previous.jumps
}

/**
 * The better of one level's two bests, the same whichever side each came
 * from. On a tie the earlier run stands, as it would on one device.
 */
function better(a: NgBest, b: NgBest): NgBest {
  if (ngBeats(a, b)) return a
  if (ngBeats(b, a)) return b
  if (a.at !== b.at) return a.at < b.at ? a : b
  return JSON.stringify(a) <= JSON.stringify(b) ? a : b
}

/** Every level from either table, each with the better of its bests. */
export function mergeNgBestTables(a: NgBestTable, b: NgBestTable): NgBestTable {
  const merged: Partial<Record<GlideLevelId, NgBest>> = {}
  for (const level of NG_BEST_LEVELS) {
    const mine = a[level]
    const theirs = b[level]
    if (mine === undefined && theirs === undefined) continue
    if (mine === undefined) merged[level] = theirs
    else merged[level] = theirs === undefined ? mine : better(mine, theirs)
  }
  return merged
}

function readTable(raw: string | null): NgBestTable | null {
  if (raw === null) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    return isNgBestTable(parsed) ? parsed : null
  } catch {
    return null
  }
}

/** Whether the merge kept exactly `table`'s rows. */
function keeps(merged: NgBestTable, table: NgBestTable): boolean {
  const levels = Object.keys(merged) as GlideLevelId[]
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
export function mergeNgBestsOnPull(
  local: string | null,
  cloud: string,
): string {
  const mine = readTable(local)
  const theirs = readTable(cloud)
  if (mine === null || local === null) return cloud
  if (theirs === null) return local
  const merged = mergeNgBestTables(mine, theirs)
  if (keeps(merged, theirs)) return cloud
  if (keeps(merged, mine)) return local
  return JSON.stringify(merged)
}
