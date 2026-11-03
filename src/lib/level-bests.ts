// ============================================================
// Level bests: a room's best run at each level, and two tables as one
// ============================================================
//
// The rooms that keep one best per level (the Ear rooms, ear-room-bests.ts)
// keep a table keyed by the level, and it follows the account as Echo's
// does (sequence/echo-bests.ts): a pull merges the device's table and the
// account's (`levelBestsOnPull`), every level from either side keeping the
// better of its two bests by the room's own rule, and the account is sent
// the result. A room says what a best is and which of two is better
// (`BestRules`); the rest is the same for every room, here.
//
// Here in lib, not in the rooms, because the settings sync (src/db) names
// the merges, and a build without the premium exercises folds the keys and
// the merges away with them.

/**
 * The levels a table may hold, easiest first. Listed here rather than read
 * from the levels' store: the settings sync imports this module into the
 * app's first chunk, and the store has no business there
 * (level-bests.test.ts holds the two lists equal).
 */
export const BEST_LEVELS = ['learning', 'singer', 'professional'] as const

export type BestLevel = (typeof BEST_LEVELS)[number]

/** A best at one level: the run's numbers, and when it was sung. */
export interface DatedBest {
  readonly at: number
}

/** One room's bests: what a best is, and which of two is better. */
export interface BestRules<B extends DatedBest> {
  readonly isBest: (value: unknown) => value is B
  /** `run` beats `previous`: the room's own rule, as its result says it. */
  readonly beats: (run: B, previous: B | null) => boolean
}

/** The best per level, keyed by the level. */
export type LevelBestTable<B> = Partial<Record<BestLevel, B>>

const isLevel = (key: string): key is BestLevel =>
  (BEST_LEVELS as readonly string[]).includes(key)

/** A count of rounds, lines or notes: a whole number, never negative. */
export const isCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0

/** A finite number, as a time or a distance is. */
export const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

export function isLevelBestTable<B extends DatedBest>(
  value: unknown,
  rules: BestRules<B>,
): value is LevelBestTable<B> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }
  return Object.entries(value).every(
    ([level, best]) => isLevel(level) && rules.isBest(best),
  )
}

/**
 * The better of one level's two bests, the same whichever side each came
 * from. On a tie the earlier run stands, as it would on one device.
 */
function better<B extends DatedBest>(a: B, b: B, rules: BestRules<B>): B {
  if (rules.beats(a, b)) return a
  if (rules.beats(b, a)) return b
  if (a.at !== b.at) return a.at < b.at ? a : b
  return JSON.stringify(a) <= JSON.stringify(b) ? a : b
}

/** Every level from either table, each with the better of its bests. */
export function mergeLevelBestTables<B extends DatedBest>(
  a: LevelBestTable<B>,
  b: LevelBestTable<B>,
  rules: BestRules<B>,
): LevelBestTable<B> {
  const merged: Partial<Record<BestLevel, B>> = {}
  for (const level of BEST_LEVELS) {
    const mine = a[level]
    const theirs = b[level]
    if (mine === undefined && theirs === undefined) continue
    if (mine === undefined) merged[level] = theirs
    else
      merged[level] = theirs === undefined ? mine : better(mine, theirs, rules)
  }
  return merged
}

function readTable<B extends DatedBest>(
  raw: string | null,
  rules: BestRules<B>,
): LevelBestTable<B> | null {
  if (raw === null) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    return isLevelBestTable(parsed, rules) ? parsed : null
  } catch {
    return null
  }
}

/** Whether the merge kept exactly `table`'s rows. */
function keeps<B>(
  merged: LevelBestTable<B>,
  table: LevelBestTable<B>,
): boolean {
  const levels = Object.keys(merged) as BestLevel[]
  return (
    levels.length === Object.keys(table).length &&
    levels.every((level) => merged[level] === table[level])
  )
}

/**
 * A room's resolver for the settings pull (MERGE_ON_PULL): the device's
 * and the account's raw values in, the one both should hold out. A side
 * that does not read gives way to the other, the account's when neither
 * reads; an unchanged side comes back as its own string, so nothing is
 * rewritten.
 */
export function levelBestsOnPull<B extends DatedBest>(
  rules: BestRules<B>,
): (local: string | null, cloud: string) => string {
  return (local, cloud) => {
    const mine = readTable(local, rules)
    const theirs = readTable(cloud, rules)
    if (mine === null || local === null) return cloud
    if (theirs === null) return local
    const merged = mergeLevelBestTables(mine, theirs, rules)
    if (keeps(merged, theirs)) return cloud
    if (keeps(merged, mine)) return local
    return JSON.stringify(merged)
  }
}

/**
 * The bests a device kept before they followed the account, under their
 * old key on this device only: read once, merged into the table that syncs
 * (`keep`, the room's persisted setter, so the account learns them), and
 * let go. Nothing to keep, or nothing that reads, is let go all the same.
 */
export function adoptDeviceBests<B extends DatedBest>(
  oldKey: string,
  rules: BestRules<B>,
  keep: (update: (current: LevelBestTable<B>) => LevelBestTable<B>) => unknown,
): void {
  let raw: string | null
  try {
    raw = localStorage.getItem(oldKey)
  } catch {
    return
  }
  if (raw === null) return
  const old = readTable(raw, rules)
  if (old !== null && Object.keys(old).length > 0) {
    keep((current) => mergeLevelBestTables(current, old, rules))
  }
  try {
    localStorage.removeItem(oldKey)
  } catch {
    // Storage went away: read again next time, and merged as harmlessly.
  }
}
