// ============================================================
// Long note bests — one per target note, on this device and the account
// ============================================================
//
// The table's shape, its ordering (`beats`) and how a settings pull merges
// another device's copy into it are in src/lib/hold/hold-bests.ts: the
// table syncs with the account, and a pull keeps the better best on each
// note rather than the newest table. This module is the room's side: the
// live table, and recording a run.

import type { BestTable, LongNoteBest } from '@/lib/hold/hold-bests'
import { beats, isBestTable, LONG_NOTE_BESTS_KEY } from '@/lib/hold/hold-bests'
import { createPersistedSignal } from '@/lib/storage'

export type { LongNoteBest } from '@/lib/hold/hold-bests'
export { beats } from '@/lib/hold/hold-bests'

const [bests, setBests] = createPersistedSignal<BestTable>(
  LONG_NOTE_BESTS_KEY,
  {},
  { validator: isBestTable },
)

/** The best on this note, or null before the first run on it. */
export function longNoteBest(midi: number): LongNoteBest | null {
  return bests()[String(midi)] ?? null
}

export interface BestOutcome {
  /** The best before this run, or null for the first run on the note. */
  readonly previous: LongNoteBest | null
  /** This run beat a previous best (never true on a first run). */
  readonly improved: boolean
}

/** Store the run if it is the note's new best, and say how it compared. */
export function recordLongNoteBest(
  midi: number,
  run: LongNoteBest,
): BestOutcome {
  const previous = longNoteBest(midi)
  if (!beats(run, previous)) return { previous, improved: false }
  setBests((table) => ({ ...table, [String(midi)]: run }))
  return { previous, improved: previous !== null }
}
