// ============================================================
// Guitar score history — bounded, scalar-only summaries of ordinary rehearsals.
// ============================================================
//
// This is intentionally separate from Jam Doctor history. A score summary can
// say which authored notes were hit, missed, or skipped; it cannot diagnose a
// phrase. Device identifiers, take/event identities, raw input, and audio never
// cross this storage boundary.

import type { GuitarInputProfileKind } from './guitar-input-profile'
import { isGuitarInputProfileKind } from './guitar-input-profile'
import type { GuitarLiveScoreDisplay, GuitarLiveScoreGrade, } from './guitar-live-score'

export const GUITAR_SCORE_HISTORY_SCHEMA_VERSION = 1
export const GUITAR_SCORE_HISTORY_STORAGE_KEY =
  'mercurypitch.guitar-score-history.v1'
export const GUITAR_SCORE_HISTORY_LIMIT = 12
export const GUITAR_SCORE_HISTORY_MAX_BYTES = 24_576

const MAX_LABEL_LENGTH = 160
const MAX_RECENT_OUTCOMES = 16
const MAX_DATE_MILLISECONDS = 8_640_000_000_000_000

export type GuitarScoreTakeStatus = 'partial' | 'completed'

export type GuitarScoreRecentOutcome = Readonly<
  | { outcome: 'hit'; score: number }
  | { outcome: 'miss'; score: 0 }
  | { outcome: 'skipped'; score: null }
>

export interface GuitarScoreTakeContext {
  /** Human-readable piece name. Never an audio/session identifier. */
  pieceLabel: string
  /** Human-readable authored part name. Never an input device identifier. */
  trackLabel: string
  range: { startBeat: number; endBeat: number }
  inputKind: GuitarInputProfileKind
  /** Held takes remain presentable, but only completed takes are persisted. */
  status: GuitarScoreTakeStatus
}

export interface GuitarScoreTakeSummary {
  schemaVersion: typeof GUITAR_SCORE_HISTORY_SCHEMA_VERSION
  savedAt: number
  status: GuitarScoreTakeStatus
  pieceLabel: string
  trackLabel: string
  range: { startBeat: number; endBeat: number }
  inputKind: GuitarInputProfileKind
  basis: GuitarLiveScoreDisplay['basis']
  score: number | null
  grade: GuitarLiveScoreGrade | null
  counts: {
    targetCount: number
    judgedTargets: number
    hitTargets: number
    missedTargets: number
    skippedTargets: number
  }
  bestStreak: number
  evidence: {
    status: GuitarLiveScoreDisplay['evidenceStatus']
    detectedGapCount: number
  }
  recentOutcomes: readonly GuitarScoreRecentOutcome[]
}

type GuitarScoreStorageReader = Pick<Storage, 'getItem'>
type GuitarScoreStorageWriter = Pick<Storage, 'getItem' | 'setItem'>

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasExactKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
): boolean {
  const actual = Object.keys(value)
  return actual.length === keys.length && keys.every((key) => key in value)
}

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

function isTimestamp(value: unknown): value is number {
  return isCount(value) && value <= MAX_DATE_MILLISECONDS
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isScore(value: unknown): value is number {
  return isFiniteNumber(value) && value >= 0 && value <= 100
}

function isLabel(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.trim() === value &&
    value.length > 0 &&
    value.length <= MAX_LABEL_LENGTH
  )
}

function isGrade(value: unknown): value is GuitarLiveScoreGrade {
  return (
    value === 'S' ||
    value === 'A' ||
    value === 'B' ||
    value === 'C' ||
    value === 'D'
  )
}

function isStatus(value: unknown): value is GuitarScoreTakeStatus {
  return value === 'partial' || value === 'completed'
}

function isBasis(value: unknown): value is GuitarLiveScoreDisplay['basis'] {
  return value === 'rolling-16' || value === 'cumulative'
}

function isEvidenceStatus(
  value: unknown,
): value is GuitarLiveScoreDisplay['evidenceStatus'] {
  return value === 'complete' || value === 'event-gap'
}

function isRange(value: unknown): value is GuitarScoreTakeSummary['range'] {
  return (
    isRecord(value) &&
    hasExactKeys(value, ['startBeat', 'endBeat']) &&
    isFiniteNumber(value.startBeat) &&
    value.startBeat >= 0 &&
    isFiniteNumber(value.endBeat) &&
    value.endBeat > value.startBeat
  )
}

function isCounts(value: unknown): value is GuitarScoreTakeSummary['counts'] {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      'targetCount',
      'judgedTargets',
      'hitTargets',
      'missedTargets',
      'skippedTargets',
    ]) ||
    !isCount(value.targetCount) ||
    !isCount(value.judgedTargets) ||
    !isCount(value.hitTargets) ||
    !isCount(value.missedTargets) ||
    !isCount(value.skippedTargets)
  ) {
    return false
  }
  return (
    value.hitTargets + value.missedTargets === value.judgedTargets &&
    value.judgedTargets + value.skippedTargets <= value.targetCount
  )
}

function readRecentOutcome(value: unknown): GuitarScoreRecentOutcome | null {
  if (!isRecord(value) || !hasExactKeys(value, ['outcome', 'score'])) {
    return null
  }
  if (value.outcome === 'hit' && isScore(value.score)) {
    return Object.freeze({ outcome: 'hit', score: value.score })
  }
  if (value.outcome === 'miss' && value.score === 0) {
    return Object.freeze({ outcome: 'miss', score: 0 })
  }
  if (value.outcome === 'skipped' && value.score === null) {
    return Object.freeze({ outcome: 'skipped', score: null })
  }
  return null
}

function freezeSummary(
  summary: GuitarScoreTakeSummary,
): GuitarScoreTakeSummary {
  return Object.freeze({
    ...summary,
    range: Object.freeze({ ...summary.range }),
    counts: Object.freeze({ ...summary.counts }),
    evidence: Object.freeze({ ...summary.evidence }),
    recentOutcomes: Object.freeze(
      summary.recentOutcomes.map((outcome) => Object.freeze({ ...outcome })),
    ),
  })
}

function readSummary(value: unknown): GuitarScoreTakeSummary | null {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      'schemaVersion',
      'savedAt',
      'status',
      'pieceLabel',
      'trackLabel',
      'range',
      'inputKind',
      'basis',
      'score',
      'grade',
      'counts',
      'bestStreak',
      'evidence',
      'recentOutcomes',
    ]) ||
    value.schemaVersion !== GUITAR_SCORE_HISTORY_SCHEMA_VERSION ||
    !isTimestamp(value.savedAt) ||
    !isStatus(value.status) ||
    !isLabel(value.pieceLabel) ||
    !isLabel(value.trackLabel) ||
    !isRange(value.range) ||
    !isGuitarInputProfileKind(value.inputKind) ||
    !isBasis(value.basis) ||
    !(value.score === null || isScore(value.score)) ||
    !(value.grade === null || isGrade(value.grade)) ||
    !isCounts(value.counts) ||
    !isCount(value.bestStreak) ||
    !isRecord(value.evidence) ||
    !hasExactKeys(value.evidence, ['status', 'detectedGapCount']) ||
    !isEvidenceStatus(value.evidence.status) ||
    !isCount(value.evidence.detectedGapCount) ||
    !Array.isArray(value.recentOutcomes) ||
    value.recentOutcomes.length > MAX_RECENT_OUTCOMES
  ) {
    return null
  }
  if (
    value.status !== 'completed' ||
    value.basis !== 'cumulative' ||
    (value.score === null && value.grade !== null) ||
    value.bestStreak > value.counts.hitTargets ||
    (value.evidence.status === 'complete' &&
      value.evidence.detectedGapCount !== 0)
  ) {
    return null
  }
  const recentOutcomes = value.recentOutcomes.map(readRecentOutcome)
  if (recentOutcomes.some((outcome) => outcome === null)) return null
  return freezeSummary({
    schemaVersion: GUITAR_SCORE_HISTORY_SCHEMA_VERSION,
    savedAt: value.savedAt,
    status: 'completed',
    pieceLabel: value.pieceLabel,
    trackLabel: value.trackLabel,
    range: { ...value.range },
    inputKind: value.inputKind,
    basis: 'cumulative',
    score: value.score,
    grade: value.grade,
    counts: { ...value.counts },
    bestStreak: value.bestStreak,
    evidence: {
      status: value.evidence.status,
      detectedGapCount: value.evidence.detectedGapCount,
    },
    recentOutcomes: recentOutcomes as readonly GuitarScoreRecentOutcome[],
  })
}

function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength
}

function compactLabel(value: string): string | null {
  const compact = value.trim()
  return isLabel(compact) ? compact : null
}

function recentOutcomes(
  display: GuitarLiveScoreDisplay,
): readonly GuitarScoreRecentOutcome[] | null {
  const outcomes: GuitarScoreRecentOutcome[] = []
  for (const judgment of display.recentJudgments.slice(-MAX_RECENT_OUTCOMES)) {
    if (judgment.outcome === 'hit') {
      if (!isScore(judgment.score)) return null
      outcomes.push({ outcome: 'hit', score: judgment.score })
    } else if (judgment.outcome === 'miss') {
      outcomes.push({ outcome: 'miss', score: 0 })
    } else if (judgment.outcome === 'skipped') {
      outcomes.push({ outcome: 'skipped', score: null })
    } else {
      return null
    }
  }
  return outcomes
}

/** Build the only ordinary score shape that may be shown or persisted. */
export function summarizeGuitarScoreTake(
  display: GuitarLiveScoreDisplay,
  context: GuitarScoreTakeContext,
  savedAt: number = Date.now(),
): GuitarScoreTakeSummary | null {
  const pieceLabel = compactLabel(context.pieceLabel)
  const trackLabel = compactLabel(context.trackLabel)
  const counts: GuitarScoreTakeSummary['counts'] = {
    targetCount: display.targetCount,
    judgedTargets: display.totals.judgedTargets,
    hitTargets: display.totals.hitTargets,
    missedTargets: display.totals.missedTargets,
    skippedTargets: display.totals.skippedTargets,
  }
  const outcomes = recentOutcomes(display)
  const phaseMatchesStatus =
    (context.status === 'completed' && display.phase === 'completed') ||
    (context.status === 'partial' && display.phase === 'active')
  const basisMatchesStatus =
    (context.status === 'completed' && display.basis === 'cumulative') ||
    (context.status === 'partial' && display.basis === 'rolling-16')

  if (
    pieceLabel === null ||
    trackLabel === null ||
    !isRange(context.range) ||
    !isGuitarInputProfileKind(context.inputKind) ||
    !isTimestamp(savedAt) ||
    !phaseMatchesStatus ||
    !basisMatchesStatus ||
    !(display.score === null || isScore(display.score)) ||
    !(display.grade === null || isGrade(display.grade)) ||
    (display.score === null && display.grade !== null) ||
    !isCounts(counts) ||
    !isCount(display.bestStreak) ||
    display.bestStreak > counts.hitTargets ||
    !isEvidenceStatus(display.evidenceStatus) ||
    !isCount(display.detectedGapCount) ||
    (display.evidenceStatus === 'complete' && display.detectedGapCount !== 0) ||
    outcomes === null
  ) {
    return null
  }

  return freezeSummary({
    schemaVersion: GUITAR_SCORE_HISTORY_SCHEMA_VERSION,
    savedAt,
    status: context.status,
    pieceLabel,
    trackLabel,
    range: { ...context.range },
    inputKind: context.inputKind,
    basis: display.basis,
    score: display.score,
    grade: display.grade,
    counts,
    bestStreak: display.bestStreak,
    evidence: {
      status: display.evidenceStatus,
      detectedGapCount: display.detectedGapCount,
    },
    recentOutcomes: outcomes,
  })
}

/** Load canonical completed summaries only. Corrupt or oversized storage is empty. */
export function loadGuitarScoreHistory(
  storage: GuitarScoreStorageReader,
): GuitarScoreTakeSummary[] {
  try {
    const raw = storage.getItem(GUITAR_SCORE_HISTORY_STORAGE_KEY)
    if (raw === null || utf8ByteLength(raw) > GUITAR_SCORE_HISTORY_MAX_BYTES) {
      return []
    }
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .map(readSummary)
      .filter((summary): summary is GuitarScoreTakeSummary => summary !== null)
      .slice(-GUITAR_SCORE_HISTORY_LIMIT)
  } catch {
    return []
  }
}

function sameSavedTake(
  left: GuitarScoreTakeSummary,
  right: GuitarScoreTakeSummary,
): boolean {
  return (
    left.savedAt === right.savedAt &&
    left.pieceLabel === right.pieceLabel &&
    left.trackLabel === right.trackLabel &&
    left.range.startBeat === right.range.startBeat &&
    left.range.endBeat === right.range.endBeat
  )
}

/** Persist one completed summary; held/partial takes remain memory-only. */
export function saveGuitarScoreTake(
  storage: GuitarScoreStorageWriter,
  summary: GuitarScoreTakeSummary,
): GuitarScoreTakeSummary | null {
  const canonical = readSummary(summary)
  if (canonical === null) return null

  const history = loadGuitarScoreHistory(storage).filter(
    (candidate) => !sameSavedTake(candidate, canonical),
  )
  history.push(canonical)
  history.splice(0, Math.max(0, history.length - GUITAR_SCORE_HISTORY_LIMIT))

  let serialized = JSON.stringify(history)
  while (
    history.length > 1 &&
    utf8ByteLength(serialized) > GUITAR_SCORE_HISTORY_MAX_BYTES
  ) {
    history.shift()
    serialized = JSON.stringify(history)
  }
  if (utf8ByteLength(serialized) > GUITAR_SCORE_HISTORY_MAX_BYTES) return null

  try {
    storage.setItem(GUITAR_SCORE_HISTORY_STORAGE_KEY, serialized)
    return canonical
  } catch {
    return null
  }
}
