// ============================================================
// Hold bests — the Long note's best on each note, and two tables as one
// ============================================================
//
// One best per target note, keyed by its MIDI number, so a higher note
// never wipes a lower note's best (design §7). The best is the big number
// on the result card, the seconds the light filled; steadiness breaks a
// tie.
//
// The table follows the account like a preference (settings-service.ts),
// but it is a record: a pull that replaced it with another device's lost
// this device's bests, and the next run below one was cheered as a new
// best (review A of PR 973, m6). So a pull merges the two tables
// (mergeBestsOnPull): every note from either side, each keeping the better
// of its two bests, and the account is sent the result.
//
// Here in lib, not in the room, because the settings sync (src/db) names
// the merge, and a build without the Long note folds the key and the merge
// away with it.

/** Where the table lives, and the settings row it syncs as. */
export const LONG_NOTE_BESTS_KEY = 'pitchperfect_long_note_lantern_bests'

export interface LongNoteBest {
  readonly inBandSeconds: number
  readonly steadiness: number
  readonly at: number
}

/** The best per note, keyed by the note's MIDI number. */
export type BestTable = Readonly<Record<string, LongNoteBest>>

function isBest(value: unknown): value is LongNoteBest {
  if (typeof value !== 'object' || value === null) return false
  const row = value as Record<string, unknown>
  return (
    typeof row.inBandSeconds === 'number' &&
    Number.isFinite(row.inBandSeconds) &&
    typeof row.steadiness === 'number' &&
    Number.isFinite(row.steadiness) &&
    typeof row.at === 'number'
  )
}

export function isBestTable(value: unknown): value is BestTable {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }
  return Object.values(value).every(isBest)
}

/** Whether `run` beats `previous`: longer, or as long and steadier. */
export function beats(
  run: LongNoteBest,
  previous: LongNoteBest | null,
): boolean {
  if (previous === null) return true
  const longer = run.inBandSeconds - previous.inBandSeconds
  // Tenths are what the card shows, so a difference below that is a tie.
  if (Math.abs(longer) >= 0.05) return longer > 0
  return run.steadiness > previous.steadiness
}

/**
 * The better of one note's two bests, the same whichever side each came
 * from. On a tie the earlier run stands, as it would on one device.
 */
function better(a: LongNoteBest, b: LongNoteBest): LongNoteBest {
  if (beats(a, b)) return a
  if (beats(b, a)) return b
  if (a.at !== b.at) return a.at < b.at ? a : b
  return JSON.stringify(a) <= JSON.stringify(b) ? a : b
}

/** Every note from either table, each with the better of its bests. */
export function mergeBestTables(a: BestTable, b: BestTable): BestTable {
  const merged: Record<string, LongNoteBest> = {}
  const notes = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort(
    (x, y) => Number(x) - Number(y),
  )
  for (const note of notes) {
    const mine = a[note] as LongNoteBest | undefined
    const theirs = b[note] as LongNoteBest | undefined
    if (mine === undefined) merged[note] = theirs as LongNoteBest
    else merged[note] = theirs === undefined ? mine : better(mine, theirs)
  }
  return merged
}

function readTable(raw: string | null): BestTable | null {
  if (raw === null) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    return isBestTable(parsed) ? parsed : null
  } catch {
    return null
  }
}

/** Whether the merge kept exactly `table`'s rows. */
function keeps(merged: BestTable, table: BestTable): boolean {
  const notes = Object.keys(merged)
  return (
    notes.length === Object.keys(table).length &&
    notes.every((note) => merged[note] === table[note])
  )
}

/**
 * The settings pull's resolver (MERGE_ON_PULL): the device's and the
 * account's raw values in, the one both should hold out. A side that does
 * not read gives way to the other, the account's when neither reads; an
 * unchanged side comes back as its own string, so nothing is rewritten.
 */
export function mergeBestsOnPull(local: string | null, cloud: string): string {
  const mine = readTable(local)
  const theirs = readTable(cloud)
  if (mine === null || local === null) return cloud
  if (theirs === null) return local
  const merged = mergeBestTables(mine, theirs)
  if (keeps(merged, theirs)) return cloud
  if (keeps(merged, mine)) return local
  return JSON.stringify(merged)
}
