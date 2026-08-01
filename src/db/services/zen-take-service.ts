// ============================================================
// Zen Take Service — compact, local-only pitch-loop persistence
// ============================================================

import { getDb } from '@/db'
import type { ZenTakeRecord } from '@/db/entities'
import type { Repository } from '@/db/types'
import type { ZenPitchPoint, ZenPitchRun, ZenPracticeMode, ZenRunScore, } from '@/features/zen/types'

export const MAX_ZEN_TAKES = 50
export const MAX_ZEN_TRACE_POINTS = 600

const TRACE_VERSION = 1 as const
const MAX_TRACE_JSON_LENGTH = 100_000

type CompactZenPoint =
  | [timeSec: number, midi: number | null]
  | [timeSec: number, midi: number | null, clarity: number]

export interface ZenTakeDraft extends Omit<ZenPitchRun, 'id'> {
  exerciseVersion?: number
}

export interface SavedZenTake extends ZenPitchRun {
  exerciseVersion?: number
}

export interface ListZenTakesOptions {
  mode?: ZenPracticeMode
  exerciseId?: string
  exerciseVersion?: number
  limit?: number
}

const roundTo = (value: number, precision: number): number => {
  const factor = 10 ** precision
  return Math.round(value * factor) / factor
}

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

function isPracticeMode(value: unknown): value is ZenPracticeMode {
  return value === 'monitor' || value === 'exercise'
}

function isValidViewport(minMidi: unknown, maxMidi: unknown): boolean {
  return (
    isFiniteNumber(minMidi) &&
    isFiniteNumber(maxMidi) &&
    minMidi >= 0 &&
    maxMidi <= 127 &&
    minMidi < maxMidi
  )
}

function downsamplePoints(
  points: readonly CompactZenPoint[],
): CompactZenPoint[] {
  if (points.length <= MAX_ZEN_TRACE_POINTS) return [...points]

  // Gap markers are semantic, not ordinary samples: dropping one reconnects
  // the pitch line across a breath after reload. Preserve every gap plus both
  // endpoints, then distribute the remaining budget over voiced points.
  const required = new Set<number>([0, points.length - 1])
  points.forEach((point, index) => {
    if (point[1] === null) required.add(index)
  })

  const requiredIndices = [...required].sort((left, right) => left - right)
  if (requiredIndices.length >= MAX_ZEN_TRACE_POINTS) {
    const stride = requiredIndices.length / MAX_ZEN_TRACE_POINTS
    return Array.from({ length: MAX_ZEN_TRACE_POINTS }, (_, index) => {
      const sourceIndex =
        index === MAX_ZEN_TRACE_POINTS - 1
          ? requiredIndices[requiredIndices.length - 1]!
          : requiredIndices[Math.floor(index * stride)]!
      return points[sourceIndex]!
    })
  }

  const candidates = points
    .map((_, index) => index)
    .filter((index) => !required.has(index))
  const remaining = MAX_ZEN_TRACE_POINTS - requiredIndices.length
  const selected = new Set(requiredIndices)
  const stride = candidates.length / remaining
  for (let index = 0; index < remaining; index += 1) {
    selected.add(candidates[Math.floor(index * stride)]!)
  }
  return [...selected]
    .sort((left, right) => left - right)
    .map((index) => points[index]!)
}

function compactPoint(point: ZenPitchPoint): CompactZenPoint | null {
  if (!isFiniteNumber(point.timeSec) || point.timeSec < 0) return null
  if (
    point.midi !== null &&
    (!isFiniteNumber(point.midi) || point.midi < 0 || point.midi > 127)
  ) {
    return null
  }

  const timeSec = roundTo(point.timeSec, 3)
  const midi = point.midi === null ? null : roundTo(point.midi, 3)
  if (
    point.clarity === undefined ||
    !isFiniteNumber(point.clarity) ||
    point.clarity < 0 ||
    point.clarity > 1
  ) {
    return [timeSec, midi]
  }
  return [timeSec, midi, roundTo(point.clarity, 3)]
}

function encodeTrace(points: readonly ZenPitchPoint[]): string {
  const compact = points
    .map(compactPoint)
    .filter((point): point is CompactZenPoint => point !== null)
    .sort((left, right) => left[0] - right[0])
  return JSON.stringify(downsamplePoints(compact))
}

function decodeCompactPoint(value: unknown): ZenPitchPoint | null {
  if (!Array.isArray(value) || (value.length !== 2 && value.length !== 3)) {
    return null
  }
  const [timeSec, midi, clarity] = value
  if (!isFiniteNumber(timeSec) || timeSec < 0) return null
  if (midi !== null && (!isFiniteNumber(midi) || midi < 0 || midi > 127)) {
    return null
  }

  const point: ZenPitchPoint = { timeSec, midi }
  if (
    value.length === 3 &&
    isFiniteNumber(clarity) &&
    clarity >= 0 &&
    clarity <= 1
  ) {
    point.clarity = clarity
  }
  return point
}

function decodeTrace(raw: unknown): ZenPitchPoint[] | null {
  if (typeof raw !== 'string' || raw.length > MAX_TRACE_JSON_LENGTH) {
    return null
  }
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return null
    const points = parsed
      .slice(0, MAX_ZEN_TRACE_POINTS)
      .map(decodeCompactPoint)
      .filter((point): point is ZenPitchPoint => point !== null)
    if (parsed.length > 0 && points.length === 0) return null
    return points.sort((left, right) => left.timeSec - right.timeSec)
  } catch {
    return null
  }
}

function scoreFromRecord(record: ZenTakeRecord): ZenRunScore | undefined {
  const percentages = [
    record.scoreTotal,
    record.scorePitch,
    record.scoreCoverage,
    record.scoreSteadiness,
  ]
  if (
    !percentages.every(
      (value) => isFiniteNumber(value) && value >= 0 && value <= 100,
    ) ||
    !isFiniteNumber(record.scoreAverageCents) ||
    record.scoreAverageCents < 0
  ) {
    return undefined
  }
  return {
    total: record.scoreTotal!,
    pitch: record.scorePitch!,
    coverage: record.scoreCoverage!,
    steadiness: record.scoreSteadiness!,
    averageCents: record.scoreAverageCents!,
  }
}

function decodeTake(record: ZenTakeRecord): SavedZenTake | null {
  if (
    !isPracticeMode(record.mode) ||
    !Number.isInteger(record.takeNumber) ||
    record.takeNumber <= 0 ||
    !isFiniteNumber(record.completedAt) ||
    record.completedAt < 0 ||
    !isFiniteNumber(record.durationSec) ||
    record.durationSec < 0 ||
    record.traceVersion !== TRACE_VERSION ||
    !isValidViewport(record.viewportMinMidi, record.viewportMaxMidi) ||
    (record.exerciseId !== undefined &&
      (typeof record.exerciseId !== 'string' ||
        record.exerciseId.trim().length === 0)) ||
    (record.exerciseVersion !== undefined &&
      (!Number.isInteger(record.exerciseVersion) ||
        record.exerciseVersion <= 0)) ||
    (record.rootMidi !== undefined &&
      (!Number.isInteger(record.rootMidi) ||
        record.rootMidi < 0 ||
        record.rootMidi > 127))
  ) {
    return null
  }

  const points = decodeTrace(record.traceJson)
  if (points === null) return null

  const take: SavedZenTake = {
    id: record.id,
    takeNumber: record.takeNumber,
    completedAt: record.completedAt,
    mode: record.mode,
    durationSec: record.durationSec,
    points,
    viewport: {
      minMidi: record.viewportMinMidi,
      maxMidi: record.viewportMaxMidi,
    },
  }
  if (record.exerciseId !== undefined) take.exerciseId = record.exerciseId
  if (record.exerciseVersion !== undefined) {
    take.exerciseVersion = record.exerciseVersion
  }
  if (record.rootMidi !== undefined) take.rootMidi = record.rootMidi
  const score = scoreFromRecord(record)
  if (score !== undefined) take.score = score
  return take
}

function scoreFields(
  score: ZenRunScore | undefined,
): Pick<
  ZenTakeRecord,
  | 'scoreTotal'
  | 'scorePitch'
  | 'scoreCoverage'
  | 'scoreSteadiness'
  | 'scoreAverageCents'
> {
  if (
    score === undefined ||
    ![score.total, score.pitch, score.coverage, score.steadiness].every(
      (value) => isFiniteNumber(value) && value >= 0 && value <= 100,
    ) ||
    !isFiniteNumber(score.averageCents) ||
    score.averageCents < 0
  ) {
    return {}
  }
  return {
    scoreTotal: score.total,
    scorePitch: score.pitch,
    scoreCoverage: score.coverage,
    scoreSteadiness: score.steadiness,
    scoreAverageCents: score.averageCents,
  }
}

function validDraft(take: ZenTakeDraft): boolean {
  return (
    isPracticeMode(take.mode) &&
    Number.isInteger(take.takeNumber) &&
    take.takeNumber > 0 &&
    isFiniteNumber(take.completedAt) &&
    take.completedAt >= 0 &&
    isFiniteNumber(take.durationSec) &&
    take.durationSec >= 0 &&
    isValidViewport(take.viewport.minMidi, take.viewport.maxMidi) &&
    (take.exerciseId === undefined ||
      (typeof take.exerciseId === 'string' &&
        take.exerciseId.trim().length > 0)) &&
    (take.exerciseVersion === undefined ||
      (Number.isInteger(take.exerciseVersion) && take.exerciseVersion > 0)) &&
    (take.rootMidi === undefined ||
      (Number.isInteger(take.rootMidi) &&
        take.rootMidi >= 0 &&
        take.rootMidi <= 127))
  )
}

function rowRecency(record: ZenTakeRecord): number {
  return isFiniteNumber(record.completedAt)
    ? record.completedAt
    : Number.NEGATIVE_INFINITY
}

async function pruneOldestTakes(
  repo: Repository<ZenTakeRecord>,
): Promise<void> {
  const records = await repo.findAll()
  records.sort((left, right) => {
    const byCompletion = rowRecency(right) - rowRecency(left)
    if (byCompletion !== 0) return byCompletion
    return right.createdAt.localeCompare(left.createdAt)
  })
  for (const stale of records.slice(MAX_ZEN_TAKES)) {
    await repo.delete(stale.id)
  }
}

/** Persist one completed canvas pass, then enforce the bounded local history. */
export async function saveZenTake(
  take: ZenTakeDraft,
): Promise<SavedZenTake | null> {
  if (!validDraft(take)) return null
  try {
    const db = await getDb()
    const created = await db.transaction(async (transactionDb) => {
      const repo = transactionDb.getRepository<ZenTakeRecord>('zenTakes')
      const record = await repo.create({
        mode: take.mode,
        takeNumber: take.takeNumber,
        exerciseId: take.exerciseId,
        exerciseVersion: take.exerciseVersion,
        rootMidi: take.rootMidi,
        completedAt: take.completedAt,
        durationSec: take.durationSec,
        traceVersion: TRACE_VERSION,
        traceJson: encodeTrace(take.points),
        viewportMinMidi: take.viewport.minMidi,
        viewportMaxMidi: take.viewport.maxMidi,
        ...scoreFields(take.score),
      })
      await pruneOldestTakes(repo)
      return record
    })
    return decodeTake(created)
  } catch {
    return null
  }
}

/** Return valid takes newest-first; corrupt rows are skipped, not surfaced. */
export async function listZenTakes(
  options: ListZenTakesOptions = {},
): Promise<SavedZenTake[]> {
  const requestedLimit = options.limit ?? MAX_ZEN_TAKES
  const limit = Math.max(0, Math.min(MAX_ZEN_TAKES, Math.floor(requestedLimit)))
  if (!Number.isFinite(limit) || limit === 0) return []

  try {
    const db = await getDb()
    const repo = db.getRepository<ZenTakeRecord>('zenTakes')
    const where: Partial<ZenTakeRecord> = {}
    if (options.mode !== undefined) where.mode = options.mode
    if (options.exerciseId !== undefined) {
      where.exerciseId = options.exerciseId
    }
    if (options.exerciseVersion !== undefined) {
      where.exerciseVersion = options.exerciseVersion
    }
    const records = await repo.findAll({
      ...(Object.keys(where).length > 0 ? { where } : {}),
      orderBy: 'completedAt',
      orderDir: 'desc',
    })
    return records
      .map(decodeTake)
      .filter((take): take is SavedZenTake => take !== null)
      .slice(0, limit)
  } catch {
    return []
  }
}

/** Delete one persisted take. True when a row went away; corrupt/missing
 *  ids report false rather than throwing (same stance as the readers). */
export async function deleteZenTake(id: string): Promise<boolean> {
  if (typeof id !== 'string' || id === '') return false
  try {
    const db = await getDb()
    const repo = db.getRepository<ZenTakeRecord>('zenTakes')
    if ((await repo.findById(id)) == null) return false
    await repo.delete(id)
    return true
  } catch {
    return false
  }
}
