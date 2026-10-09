// ============================================================
// Long note bests — one per target note, kept on this device
// ============================================================
//
// A higher note must not wipe a lower note's best (design §7), so the best
// is keyed by the target's MIDI number. The best is the big number on the
// result card, the seconds the light filled; steadiness breaks a tie.

import { createPersistedSignal } from '@/lib/storage'

export interface LongNoteBest {
  readonly inBandSeconds: number
  readonly steadiness: number
  readonly at: number
}

type BestTable = Readonly<Record<string, LongNoteBest>>

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

function isBestTable(value: unknown): value is BestTable {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }
  return Object.values(value).every(isBest)
}

const [bests, setBests] = createPersistedSignal<BestTable>(
  'pitchperfect_long_note_lantern_bests',
  {},
  { validator: isBestTable },
)

/** The best on this note, or null before the first run on it. */
export function longNoteBest(midi: number): LongNoteBest | null {
  return bests()[String(midi)] ?? null
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
