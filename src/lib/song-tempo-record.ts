// ============================================================
// Song tempo record — a song's tempo as it is kept with its notes
// ============================================================
//
// The estimate (features/stem-mixer/song-tempo.ts) runs once per song; this
// is what is stored of it, beside what the singer typed. A leaf module, so
// the storage layer that reads it back does not load the estimator.

export interface SongTempoEstimate {
  /** Whole beats per minute, in `TEMPO_RANGE`. */
  bpm: number
  /** `detectTempo`'s share of intervals that agree with the tempo, 0 to 1. */
  confidence: number
}

/**
 * A song's tempo as it is stored with its analysis, so a reopened song needs
 * no second estimate.
 */
export interface SongTempoRecord {
  /** What the estimate read: null when it found no tempo, absent if never run. */
  estimate?: SongTempoEstimate | null
  /** The tempo the singer typed into the BPM box, which always wins. */
  typedBpm?: number
}

const isTempo = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0

/** A stored tempo record, or undefined when the value is not one. */
export function parseSongTempoRecord(
  value: unknown,
): SongTempoRecord | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const { estimate, typedBpm } = value as Record<string, unknown>
  const record: SongTempoRecord = {}
  if (estimate === null) {
    record.estimate = null
  } else if (estimate !== undefined) {
    const { bpm, confidence } = estimate as Record<string, unknown>
    if (
      typeof estimate !== 'object' ||
      !isTempo(bpm) ||
      typeof confidence !== 'number' ||
      !Number.isFinite(confidence)
    ) {
      return undefined
    }
    record.estimate = { bpm, confidence }
  }
  if (typedBpm !== undefined) {
    if (!isTempo(typedBpm)) return undefined
    record.typedBpm = typedBpm
  }
  return record
}
