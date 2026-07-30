// ============================================================
// Ear Lab store — readings, ratings and calibration history.
//
// Local-first, like exercise history: persisted signals in
// localStorage (which the settings cloud-sync already observes).
// The store enforces the plan's central rule — only a calibration
// run writes a mark the Mercury Column treats as proven; practice
// produces estimates, stored and displayed as estimates.
// ============================================================

import { addScoredMs } from '@/db/services/practice-minutes'
import { trackEvent } from '@/lib/analytics'
import type { FacultyId } from '@/lib/ear/drills'
import { IDENTIFICATION_DRILLS, THRESHOLD_DRILLS } from '@/lib/ear/drills'
import type { Rating } from '@/lib/ear/elo'
import { isProvisional, newRating, updateItemDifficulty, updateRating, } from '@/lib/ear/elo'
import type { FacultyReading, MercuryIndex } from '@/lib/ear/mercury-index'
import { mercuryIndex } from '@/lib/ear/mercury-index'
import { createPersistedSignal } from '@/lib/storage'
import { recordActivity } from './usage-store'

const KEY_PREFIX = 'mercurypitch_ear_'

export type ReadingSource = 'practice' | 'calibration'

export interface ThresholdReadingEntry {
  drillId: string
  /** The difference limen, in the drill's unit. */
  value: number
  /** ± half-width shown next to the reading. */
  spread: number
  /** Staircase tracks pooled into this reading (1 for practice). */
  tracks: number
  source: ReadingSource
  at: number
}

export interface CalibrationRunEntry {
  at: number
  /** Mercury Index at this calibration. */
  index: number
  /** Per-faculty sub-scores that fed the index. */
  parts: Partial<Record<FacultyId, number>>
  /** The threshold readings taken during the run. */
  readings: Array<{ drillId: string; value: number; spread: number }>
}

const MAX_READINGS = 300
const MAX_CALIBRATIONS = 120

const [ratings, setRatings] = createPersistedSignal<Record<string, Rating>>(
  `${KEY_PREFIX}ratings`,
  {},
)
const [itemStates, setItemStates] = createPersistedSignal<
  Record<string, Rating>
>(`${KEY_PREFIX}items`, {})
const [readings, setReadings] = createPersistedSignal<ThresholdReadingEntry[]>(
  `${KEY_PREFIX}readings`,
  [],
)
const [calibrations, setCalibrations] = createPersistedSignal<
  CalibrationRunEntry[]
>(`${KEY_PREFIX}calibrations`, [])
const [confusions, setConfusions] = createPersistedSignal<
  Record<string, number>
>(`${KEY_PREFIX}confusions`, {})

export interface LatencyEntry {
  /** Round-trip audio latency, milliseconds (median over clicks). */
  medianMs: number
  /** MAD spread of the measurement, ms. */
  spreadMs: number
  at: number
}

const [latency, setLatency] = createPersistedSignal<LatencyEntry | null>(
  `${KEY_PREFIX}latency`,
  null,
)

/** Device round-trip latency, or null before the wizard has run.
 *  Millisecond drills subtract this; they stay locked while null. */
export function earLatency(): LatencyEntry | null {
  return latency()
}

export function recordLatencyReading(reading: {
  medianMs: number
  spreadMs: number
}): void {
  setLatency({ ...reading, at: Date.now() })
}

// ── Ratings (Ruler B) ───────────────────────────────────────────

export function earPlayerRating(drillId: string): Rating {
  return ratings()[drillId] ?? newRating()
}

export function earItemStates(): Record<string, Rating> {
  return itemStates()
}

/**
 * Record one identification answer: moves the player rating, lets the
 * item difficulty self-calibrate (until frozen), and books the
 * confusion pair so the Ear Report has data from day one.
 */
export function recordIdentificationAnswer(args: {
  drillId: string
  itemId: string
  itemDifficulty: Rating
  correct: boolean
  guessRate: number
  /** Confusion bookkeeping: what the item was, what the user said. */
  expected: string
  answered: string
  /** Whether this answer refines the item's difficulty. Mic answers
   *  pass false: items are calibrated as *tap* yardsticks, and mixing
   *  in production error would blur the scale for everyone. */
  updateItem?: boolean
}): Rating {
  const player = earPlayerRating(args.drillId)
  const nextPlayer = updateRating(
    player,
    args.itemDifficulty.rating,
    args.correct,
    args.guessRate,
  )
  setRatings((prev) => ({ ...prev, [args.drillId]: nextPlayer }))

  if (args.updateItem !== false) {
    const nextItem = updateItemDifficulty(
      args.itemDifficulty,
      player.rating,
      args.correct,
      args.guessRate,
    )
    setItemStates((prev) => ({ ...prev, [args.itemId]: nextItem }))
  }

  if (!args.correct) {
    const key = `${args.drillId}|${args.expected}>${args.answered}`
    setConfusions((prev) => ({ ...prev, [key]: (prev[key] ?? 0) + 1 }))
  }

  return nextPlayer
}

/** Confusion counts for a drill, keyed `expected>answered`. */
export function earConfusions(drillId: string): Record<string, number> {
  const out: Record<string, number> = {}
  const prefix = `${drillId}|`
  for (const [key, count] of Object.entries(confusions())) {
    if (key.startsWith(prefix)) out[key.slice(prefix.length)] = count
  }
  return out
}

// ── Threshold readings (Ruler A) ────────────────────────────────

export function recordThresholdReading(
  entry: Omit<ThresholdReadingEntry, 'at'>,
): void {
  setReadings((prev) =>
    [{ ...entry, at: Date.now() }, ...prev].slice(0, MAX_READINGS),
  )
}

export function latestThresholdReading(
  drillId: string,
  source?: ReadingSource,
): ThresholdReadingEntry | null {
  return (
    readings().find(
      (r) =>
        r.drillId === drillId && (source === undefined || r.source === source),
    ) ?? null
  )
}

/** Newest-first history for one drill (sparklines, deltas). */
export function thresholdHistory(drillId: string): ThresholdReadingEntry[] {
  return readings().filter((r) => r.drillId === drillId)
}

// ── The Mercury Index ───────────────────────────────────────────

function facultyReadingsFrom(options: {
  thresholdFor: (drillId: string) => { value: number } | null
}): FacultyReading[] {
  const out: FacultyReading[] = []

  // Threshold faculties: one reading per drill that has one; drills
  // sharing a faculty are averaged inside mercuryIndex.
  for (const drill of THRESHOLD_DRILLS) {
    const reading = options.thresholdFor(drill.id)
    if (reading) {
      out.push({
        faculty: drill.faculty,
        value: reading.value,
        scale: drill.scale,
      })
    }
  }

  // Identification faculties: settled ratings only — a provisional
  // rating is a guess, and guesses do not move the column.
  for (const drill of IDENTIFICATION_DRILLS) {
    const rating = ratings()[drill.id]
    if (rating !== undefined && !isProvisional(rating)) {
      out.push({
        faculty: drill.faculty,
        value: rating.rating,
        scale: drill.scale,
      })
    }
  }

  return out
}

/** The live estimate: newest reading of any source per drill, plus
 *  settled ratings. Renders as the lighter meniscus, never a mark. */
export function practiceIndexEstimate(): MercuryIndex {
  return mercuryIndex(
    facultyReadingsFrom({
      thresholdFor: (drillId) => latestThresholdReading(drillId),
    }),
  )
}

/**
 * Close a calibration: store its pooled readings, then snapshot the
 * index from calibrated readings + settled ratings. This is the only
 * writer of Mercury Column marks.
 */
export function completeCalibrationRun(
  runReadings: Array<{ drillId: string; value: number; spread: number }>,
): CalibrationRunEntry {
  for (const reading of runReadings) {
    recordThresholdReading({
      drillId: reading.drillId,
      value: reading.value,
      spread: reading.spread,
      tracks: 3,
      source: 'calibration',
    })
  }

  const index = mercuryIndex(
    facultyReadingsFrom({
      thresholdFor: (drillId) =>
        runReadings.find((r) => r.drillId === drillId) ??
        latestThresholdReading(drillId, 'calibration'),
    }),
  )

  const run: CalibrationRunEntry = {
    at: Date.now(),
    index: index.value,
    parts: index.parts,
    readings: runReadings,
  }
  setCalibrations((prev) => [run, ...prev].slice(0, MAX_CALIBRATIONS))
  return run
}

export function latestCalibration(): CalibrationRunEntry | null {
  return calibrations()[0] ?? null
}

/** Newest first. */
export function calibrationHistory(): CalibrationRunEntry[] {
  return calibrations()
}

// ── Session credit ──────────────────────────────────────────────

/** Ear Lab sessions count toward the daily practice goal and the
 *  streak, exactly like exercise runs — but they never enter the
 *  vocal exercise history; the two progressions stay separate. */
export function creditEarSession(durationMs: number): void {
  if (durationMs > 0) void addScoredMs(durationMs)
  trackEvent('session_complete')
  recordActivity()
}

// ── Test / reset support ────────────────────────────────────────

/** Wipe all Ear Lab progress (tests; a future settings action). */
export function resetEarLabStore(): void {
  setRatings({})
  setItemStates({})
  setReadings([])
  setCalibrations([])
  setConfusions({})
}
