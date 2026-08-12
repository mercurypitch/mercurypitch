// ============================================================
// Progress model — an honest, bounded synthesis of practice evidence.
// Comparisons require explicit compatible-attempt keys; gaps stay visible.
// ============================================================

import type { Achievement, BadgeDefinition, ChallengeDefinition, SessionRecord, SessionSource, UserAchievement, UserActivity, UserBadge, } from '@/db/entities'
import type { LeagueMe } from '@/db/services/league-service'
import type { ActivityCounts } from '@/db/services/user-activity-service'
import { countActivity } from '@/db/services/user-activity-service'
import type { VoiceprintRecord } from '@/db/services/voiceprint-service'
import type { StoredChallengeTrace } from '@/features/challenges/challenge-trace'
import { activityByDay, localDayKey, } from '@/features/practice-intelligence/practice-activity'

export const PROGRESS_HISTORY_WEEKS = 13
/** Safety ceiling for the paginated Progress history read. */
export const PROGRESS_SESSION_LIMIT = 5_000
export const PROGRESS_RECENT_HISTORY_LIMIT = 12
export const PROGRESS_SCORE_TREND_LIMIT = 24
const MAX_MEASURED_DURATION_MS = 86_400_000
const CHALLENGE_TRACE_MATCH_WINDOW_MS = 5 * 60_000

export const PROGRESS_SOURCES = [
  'practice',
  'exercise',
  'challenge',
  'weekly',
] as const satisfies readonly SessionSource[]

export interface ProgressDataAvailability {
  sessions: boolean
  account: boolean
  voiceprints: boolean
  activity: boolean
  league: boolean
}

export interface ProgressModelInput {
  records: readonly SessionRecord[]
  sessionHistory?: {
    complete: boolean
    totalAvailable: number | null
  }
  voiceprintHistory?: {
    complete: boolean
    totalAvailable: number | null
    comparable: boolean
  }
  activityHistory?: {
    complete: boolean
    totalAvailable: number | null
  }
  currentStreak?: number | null
  voiceprints: readonly VoiceprintRecord[]
  badgeDefinitions: readonly BadgeDefinition[]
  userBadges: readonly UserBadge[]
  achievementDefinitions: readonly Achievement[]
  userAchievements: readonly UserAchievement[]
  challengeDefinitions: readonly ChallengeDefinition[]
  activityRows: ReadonlyArray<Pick<UserActivity, 'kind' | 'refId'>>
  recentActivity: readonly UserActivity[]
  league: LeagueMe | null
  challengeTraces?: Readonly<Record<string, StoredChallengeTrace>>
  availability?: Partial<ProgressDataAvailability>
}

export interface BuildProgressModelOptions {
  now?: Date
  sessionLimit?: number
  recentHistoryLimit?: number
  scoreTrendLimit?: number
}

export interface ProgressSessionTotals {
  totalLoaded: number
  totalAvailable: number | null
  last7Days: number
  last30Days: number
  last13Weeks: number
  distinctPracticeDays: number
  bestScore: number | null
  loadedWindowIsCapped: boolean
}

export interface ProgressSourceSlice {
  source: SessionSource
  count: number
  proportion: number
}

export interface ProgressActivityDay {
  date: string
  count: number
  bestScore: number | null
  sources: SessionSource[]
  isFuture: boolean
}

export interface ProgressActivityWeek {
  startDate: string
  endDate: string
  sessionCount: number
  practiceDays: number
  bestScore: number | null
  days: ProgressActivityDay[]
}

export interface ProgressActivityWindow {
  fromDate: string
  throughDate: string
  gridThroughDate: string
  days: ProgressActivityDay[]
  weeks: ProgressActivityWeek[]
}

export interface ProgressScorePoint {
  recordId: string
  occurredAt: string
  date: string
  score: number
  accuracy: number
  melodyName: string
  source: SessionSource
  comparisonKey: string | null
  isComparablePersonalBest: boolean
  previousBestScore: number | null
  improvement: number | null
}

export interface ProgressScoreTrend {
  /** Recent raw attempts. Do not connect these as one comparable series. */
  points: ProgressScorePoint[]
  /** Like-for-like groups backed by an explicit persisted comparison key. */
  comparableSeries: Array<{
    comparisonKey: string
    melodyName: string
    source: SessionSource
    points: ProgressScorePoint[]
  }>
  comparablePersonalBests: ProgressScorePoint[]
}

export interface ProgressStreakSummary {
  current: number | null
  longest: number | null
  /** Longest is derived from the loaded session window plus the current value. */
  longestIsWindowed: boolean
}

export interface ProgressDurationSummary {
  measuredSessions: number
  totalLoadedSessions: number
  measuredCoverage: number
  measuredMs: number
  /** Present only when every available record carries measured duration. */
  completeTotalMs: number | null
}

export interface ProgressVoiceprintGrowth {
  count: number
  first: VoiceprintRecord | null
  latest: VoiceprintRecord | null
  deltas: {
    lowMidi: number | null
    highMidi: number | null
    semitones: number | null
    accuracy: number | null
    steadiness: number | null
  }
  changedMetrics: number
  hasMeaningfulChange: boolean
}

export interface ProgressMilestone {
  id: string
  kind: 'badge' | 'achievement'
  name: string
  description: string
  icon: string
  occurredAt: string | null
  tier?: BadgeDefinition['tier']
}

export interface ProgressRecognitionSummary {
  available: boolean
  badges: {
    earned: number
    total: number
  }
  achievements: {
    unlocked: number
    inProgress: number
    total: number
  }
  milestones: ProgressMilestone[]
}

export interface ProgressHistoryItem {
  id: string
  occurredAt: string
  melodyName: string
  source: SessionSource
  score: number
  accuracy: number
  notesHit: number
  notesTotal: number
  streak: number
  instrument: NonNullable<SessionRecord['instrument']>
  durationMs: number | null
  sourceRef?: string
  weeklyChallengeId?: string
  comparisonKey: string | null
  isComparablePersonalBest: boolean
}

export type ProgressCoverageStatus =
  | 'available'
  | 'windowed'
  | 'conditional'
  | 'unavailable'

export interface ProgressCoverageLabel {
  id:
    | 'sessions'
    | 'rhythm'
    | 'scores'
    | 'streak'
    | 'voiceprints'
    | 'account-activity'
    | 'recognition'
    | 'duration'
  status: ProgressCoverageStatus
  label: string
  detail: string
}

export type ProgressOneMomentKind =
  | 'milestone'
  | 'league'
  | 'personal-best'
  | 'voiceprint-growth'
  | 'consistency'
  | 'challenge'
  | 'return'
  | 'latest-attempt'
  | 'empty'

export interface ProgressOneMoment {
  kind: ProgressOneMomentKind
  /** 1 is the strongest story. Empty state has no ranked candidate. */
  priority: 1 | 2 | 3 | 4 | 5 | 6 | 7 | null
  headline: string
  detail: string
  occurredAt: string | null
  recordId?: string
  score?: number
  source?: SessionSource
  milestone?: ProgressMilestone
  league?: LeagueMe
  voiceprintGrowth?: ProgressVoiceprintGrowth
  trace?: StoredChallengeTrace
  returnGapDays?: number
}

export interface ProgressModel {
  generatedAt: string
  sessions: ProgressSessionTotals
  sourceComposition: ProgressSourceSlice[]
  activity: ProgressActivityWindow
  scoreTrend: ProgressScoreTrend
  streak: ProgressStreakSummary
  duration: ProgressDurationSummary
  voiceprintGrowth: ProgressVoiceprintGrowth
  recognition: ProgressRecognitionSummary
  activityCounts: ActivityCounts
  activityTotal: number
  activityHistory: {
    complete: boolean
    totalAvailable: number | null
  }
  recentActivity: UserActivity[]
  league: LeagueMe | null
  recentHistory: ProgressHistoryItem[]
  coverage: ProgressCoverageLabel[]
  oneMoment: ProgressOneMoment
  /** Eligible stories in the same deterministic order used for selection. */
  eligibleMoments: ProgressOneMoment[]
  /** Convenience view for the inspector; excludes the selected first story. */
  oneMomentAlternates: ProgressOneMoment[]
}

interface Candidate extends ProgressOneMoment {
  priority: 1 | 2 | 3 | 4 | 5 | 6 | 7
  stableKey: string
}

const DEFAULT_AVAILABILITY: ProgressDataAvailability = {
  sessions: true,
  account: true,
  voiceprints: true,
  activity: true,
  league: true,
}

const pad = (value: number): string => String(value).padStart(2, '0')

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function dateAtLocalNoon(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12)
}

function addCalendarDays(date: Date, amount: number): Date {
  const next = dateAtLocalNoon(date)
  next.setDate(next.getDate() + amount)
  return next
}

function parseDateKey(key: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key)
  if (match === null) return null
  const parsed = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    12,
  )
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function calendarDayDifference(from: string, to: string): number | null {
  const start = parseDateKey(from)
  const end = parseDateKey(to)
  if (start === null || end === null) return null
  const startUtc = Date.UTC(
    start.getFullYear(),
    start.getMonth(),
    start.getDate(),
  )
  const endUtc = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate())
  return Math.round((endUtc - startUtc) / 86_400_000)
}

function occurredAt(record: SessionRecord): string {
  const candidates = [record.endedAt, record.startedAt, record.createdAt]
  return candidates.find((candidate) => validTime(candidate) !== null) ?? ''
}

function validTime(value: string | null | undefined): number | null {
  if (value === undefined || value === null || value === '') return null
  const time = new Date(value).getTime()
  return Number.isNaN(time) ? null : time
}

function scoreOf(record: SessionRecord): number | null {
  return Number.isFinite(record.score) &&
    record.score >= 0 &&
    record.score <= 100
    ? record.score
    : null
}

function measuredDurationOf(record: SessionRecord): number | null {
  return record.durationMs !== undefined &&
    Number.isFinite(record.durationMs) &&
    record.durationMs > 0 &&
    record.durationMs <= MAX_MEASURED_DURATION_MS
    ? record.durationMs
    : null
}

function matchingChallengeTrace(
  record: SessionRecord,
  trace: StoredChallengeTrace | undefined,
): StoredChallengeTrace | null {
  if (trace === undefined || !Number.isFinite(trace.at)) return null
  const recordTime = validTime(occurredAt(record))
  const recordScore = scoreOf(record)
  if (
    recordTime === null ||
    recordScore === null ||
    !Number.isFinite(trace.score) ||
    trace.score !== recordScore ||
    Math.abs(trace.at - recordTime) > CHALLENGE_TRACE_MATCH_WINDOW_MS
  ) {
    return null
  }
  return trace
}

function sourceOf(record: SessionRecord): SessionSource {
  return record.source ?? 'practice'
}

function dedupeRecords(records: readonly SessionRecord[]): SessionRecord[] {
  const seen = new Set<string>()
  const unique: SessionRecord[] = []
  for (const record of records) {
    if (seen.has(record.id)) continue
    seen.add(record.id)
    unique.push(record)
  }
  return unique
}

function newestRecords(records: readonly SessionRecord[]): SessionRecord[] {
  return [...records].sort((a, b) => {
    const delta =
      (validTime(occurredAt(b)) ?? -Infinity) -
      (validTime(occurredAt(a)) ?? -Infinity)
    return delta !== 0 ? delta : a.id.localeCompare(b.id)
  })
}

function oldestRecords(records: readonly SessionRecord[]): SessionRecord[] {
  return newestRecords(records).reverse()
}

/**
 * Only an explicitly persisted key proves that target and scoring semantics
 * match. Melody names are useful labels, but they are not comparison keys.
 */
export function sessionComparisonKey(record: SessionRecord): string | null {
  const key = record.comparabilityKey?.trim()
  return key === undefined || key === '' ? null : key
}

function scorePoints(records: readonly SessionRecord[]): ProgressScorePoint[] {
  const bestByComparison = new Map<string, number>()
  const points: ProgressScorePoint[] = []
  for (const record of oldestRecords(records)) {
    const score = scoreOf(record)
    const at = occurredAt(record)
    if (score === null || at === '') continue
    const key = sessionComparisonKey(record)
    const previousBest =
      key === null ? null : (bestByComparison.get(key) ?? null)
    const isPersonalBest = previousBest !== null && score > previousBest
    points.push({
      recordId: record.id,
      occurredAt: at,
      date: localDayKey(at),
      score,
      accuracy: record.accuracy,
      melodyName: record.melodyName,
      source: sourceOf(record),
      comparisonKey: key,
      isComparablePersonalBest: isPersonalBest,
      previousBestScore: previousBest,
      improvement: isPersonalBest ? score - previousBest : null,
    })
    if (key !== null) {
      bestByComparison.set(key, Math.max(previousBest ?? score, score))
    }
  }
  return points
}

function buildActivityWindow(
  records: readonly SessionRecord[],
  now: Date,
): ProgressActivityWindow {
  const today = dateAtLocalNoon(now)
  const weekdayFromMonday = (today.getDay() + 6) % 7
  const firstMonday = addCalendarDays(
    today,
    -weekdayFromMonday - (PROGRESS_HISTORY_WEEKS - 1) * 7,
  )
  const todayKey = dateKey(today)
  const activity = activityByDay(records)
  const days: ProgressActivityDay[] = []

  for (let index = 0; index < PROGRESS_HISTORY_WEEKS * 7; index += 1) {
    const dayDate = addCalendarDays(firstMonday, index)
    const key = dateKey(dayDate)
    const day = key <= todayKey ? activity.get(key) : undefined
    days.push({
      date: key,
      count: day?.count ?? 0,
      bestScore: day === undefined ? null : day.bestScore,
      sources: PROGRESS_SOURCES.filter(
        (source) => day !== undefined && day.sources.has(source),
      ),
      isFuture: key > todayKey,
    })
  }

  const weeks: ProgressActivityWeek[] = []
  for (let index = 0; index < days.length; index += 7) {
    const weekDays = days.slice(index, index + 7)
    const scored = weekDays
      .map((day) => day.bestScore)
      .filter((score): score is number => score !== null)
    weeks.push({
      startDate: weekDays[0].date,
      endDate: weekDays[weekDays.length - 1].date,
      sessionCount: weekDays.reduce((sum, day) => sum + day.count, 0),
      practiceDays: weekDays.filter((day) => day.count > 0).length,
      bestScore: scored.length === 0 ? null : Math.max(...scored),
      days: weekDays,
    })
  }

  return {
    fromDate: days[0].date,
    throughDate: todayKey,
    gridThroughDate: days[days.length - 1].date,
    days,
    weeks,
  }
}

function buildVoiceprintGrowth(
  voiceprints: readonly VoiceprintRecord[],
  comparable = true,
): ProgressVoiceprintGrowth {
  const sorted = [...voiceprints].sort((a, b) => {
    const delta =
      (validTime(a.takenAt) ?? Infinity) - (validTime(b.takenAt) ?? Infinity)
    return delta !== 0 ? delta : a.id.localeCompare(b.id)
  })
  const first = sorted[0] ?? null
  const latest = sorted[sorted.length - 1] ?? null
  const delta = (
    firstValue: number | null | undefined,
    latestValue: number | null | undefined,
  ): number | null =>
    comparable && firstValue != null && latestValue != null
      ? latestValue - firstValue
      : null
  const deltas = {
    lowMidi: delta(first?.summary.lowMidi, latest?.summary.lowMidi),
    highMidi: delta(first?.summary.highMidi, latest?.summary.highMidi),
    semitones: delta(first?.summary.semitones, latest?.summary.semitones),
    accuracy: delta(first?.summary.accuracy, latest?.summary.accuracy),
    steadiness: delta(first?.summary.steadiness, latest?.summary.steadiness),
  }
  const magnitudeAtLeast = (value: number | null, threshold: number): boolean =>
    value !== null && Math.abs(value) >= threshold
  return {
    count: sorted.length,
    first,
    latest,
    deltas,
    changedMetrics: Object.values(deltas).filter(
      (value) => value !== null && value !== 0,
    ).length,
    hasMeaningfulChange:
      magnitudeAtLeast(deltas.semitones, 2) ||
      magnitudeAtLeast(deltas.accuracy, 3) ||
      magnitudeAtLeast(deltas.steadiness, 3),
  }
}

function buildRecognition(
  input: ProgressModelInput,
): ProgressRecognitionSummary {
  const badgeById = new Map(
    input.badgeDefinitions.map((definition) => [definition.id, definition]),
  )
  const achievementById = new Map(
    input.achievementDefinitions.map((definition) => [
      definition.id,
      definition,
    ]),
  )
  const earnedBadgeIds = new Set(input.userBadges.map((badge) => badge.badgeId))
  const unlockedAchievementIds = new Set(
    input.userAchievements
      .filter((achievement) => achievement.unlocked)
      .map((achievement) => achievement.achievementId),
  )
  const milestones: ProgressMilestone[] = []

  for (const earned of input.userBadges) {
    const definition = badgeById.get(earned.badgeId)
    if (definition === undefined) continue
    milestones.push({
      id: `badge:${earned.id}`,
      kind: 'badge',
      name: definition.name,
      description: definition.description,
      icon: definition.icon,
      occurredAt: validTime(earned.earnedAt) === null ? null : earned.earnedAt,
      tier: definition.tier,
    })
  }
  for (const earned of input.userAchievements) {
    if (!earned.unlocked) continue
    const definition = achievementById.get(earned.achievementId)
    if (definition === undefined) continue
    const at = earned.unlockedAt ?? earned.updatedAt ?? earned.createdAt
    milestones.push({
      id: `achievement:${earned.id}`,
      kind: 'achievement',
      name: definition.name,
      description: definition.description,
      icon: definition.icon,
      occurredAt: validTime(at) === null ? null : at,
    })
  }
  milestones.sort((a, b) => {
    const delta =
      (validTime(b.occurredAt) ?? -Infinity) -
      (validTime(a.occurredAt) ?? -Infinity)
    return delta !== 0 ? delta : a.id.localeCompare(b.id)
  })

  return {
    available: input.availability?.account ?? true,
    badges: {
      earned: earnedBadgeIds.size,
      total: input.badgeDefinitions.length,
    },
    achievements: {
      unlocked: unlockedAchievementIds.size,
      inProgress: input.userAchievements.filter(
        (achievement) => !achievement.unlocked && achievement.progress > 0,
      ).length,
      total: input.achievementDefinitions.length,
    },
    milestones,
  }
}

export function challengeIdForRecord(
  record: SessionRecord,
  definitions: readonly ChallengeDefinition[],
): string | null {
  if (
    (sourceOf(record) === 'challenge' || sourceOf(record) === 'weekly') &&
    record.sourceRef !== undefined &&
    record.sourceRef.trim() !== ''
  ) {
    return record.sourceRef
  }
  if (record.weeklyChallengeId !== undefined) return record.weeklyChallengeId
  if (sourceOf(record) !== 'challenge') return null
  const title = record.melodyName.replace(/^Challenge:\s*/i, '').trim()
  return (
    definitions.find(
      (definition) =>
        definition.title.trim().toLocaleLowerCase() ===
        title.toLocaleLowerCase(),
    )?.id ?? null
  )
}

function signed(value: number): string {
  return `${value > 0 ? '+' : ''}${value}`
}

function voiceprintDetail(growth: ProgressVoiceprintGrowth): string {
  const details: string[] = []
  if (growth.deltas.semitones !== null && growth.deltas.semitones !== 0) {
    details.push(`${signed(growth.deltas.semitones)} semitones of range`)
  }
  if (growth.deltas.accuracy !== null && growth.deltas.accuracy !== 0) {
    details.push(`${signed(growth.deltas.accuracy)} accuracy`)
  }
  if (growth.deltas.steadiness !== null && growth.deltas.steadiness !== 0) {
    details.push(`${signed(growth.deltas.steadiness)} steadiness`)
  }
  if (
    details.length === 0 &&
    growth.deltas.lowMidi !== null &&
    growth.deltas.lowMidi !== 0
  ) {
    details.push(`${signed(growth.deltas.lowMidi)} semitones at the low edge`)
  }
  if (
    details.length === 0 &&
    growth.deltas.highMidi !== null &&
    growth.deltas.highMidi !== 0
  ) {
    details.push(`${signed(growth.deltas.highMidi)} semitones at the high edge`)
  }
  return details.join(', ')
}

function candidateTime(candidate: Candidate): number {
  return validTime(candidate.occurredAt) ?? -Infinity
}

function isWithinRecentDays(
  occurred: string | null,
  now: Date,
  maximumDays: number,
): boolean {
  if (occurred === null || validTime(occurred) === null) return false
  const difference = calendarDayDifference(localDayKey(occurred), dateKey(now))
  return difference !== null && difference >= 0 && difference <= maximumDays
}

function rankMoments(candidates: readonly Candidate[]): ProgressOneMoment[] {
  return [...candidates]
    .sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority
      const timeDelta = candidateTime(b) - candidateTime(a)
      return timeDelta !== 0
        ? timeDelta
        : a.stableKey.localeCompare(b.stableKey)
    })
    .map(({ stableKey: _stableKey, ...moment }) => moment)
}

function emptyMoment(): ProgressOneMoment {
  return {
    kind: 'empty',
    priority: null,
    headline: 'Your next moment starts here',
    detail: 'Complete a scored practice run to begin your progress story.',
    occurredAt: null,
  }
}

function buildMomentCandidates(input: {
  modelInput: ProgressModelInput
  newest: readonly SessionRecord[]
  scorePoints: readonly ProgressScorePoint[]
  recognition: ProgressRecognitionSummary
  voiceprintGrowth: ProgressVoiceprintGrowth
  streak: ProgressStreakSummary
  now: Date
}): Candidate[] {
  const candidates: Candidate[] = []
  const latestMilestone = input.recognition.milestones[0]
  if (
    latestMilestone !== undefined &&
    isWithinRecentDays(latestMilestone.occurredAt, input.now, 7)
  ) {
    candidates.push({
      kind: 'milestone',
      priority: 1,
      stableKey: latestMilestone.id,
      headline: `${latestMilestone.name} unlocked`,
      detail: latestMilestone.description,
      occurredAt: latestMilestone.occurredAt,
      milestone: latestMilestone,
    })
  }

  const newestPersonalBest = [...input.scorePoints]
    .reverse()
    .find(
      (point) =>
        point.isComparablePersonalBest && (point.improvement ?? 0) >= 3,
    )
  if (newestPersonalBest !== undefined) {
    candidates.push({
      kind: 'personal-best',
      priority: 2,
      stableKey: newestPersonalBest.recordId,
      headline: `A new best on ${newestPersonalBest.melodyName}`,
      detail: `Up ${newestPersonalBest.improvement ?? 0} points from your previous best.`,
      occurredAt: newestPersonalBest.occurredAt,
      recordId: newestPersonalBest.recordId,
      score: newestPersonalBest.score,
      source: newestPersonalBest.source,
    })
  }

  if (
    input.voiceprintGrowth.count >= 2 &&
    input.voiceprintGrowth.hasMeaningfulChange
  ) {
    candidates.push({
      kind: 'voiceprint-growth',
      priority: 3,
      stableKey: input.voiceprintGrowth.latest?.id ?? 'voiceprint',
      headline: 'Your voiceprint moved',
      detail: voiceprintDetail(input.voiceprintGrowth),
      occurredAt: input.voiceprintGrowth.latest?.takenAt ?? null,
      voiceprintGrowth: input.voiceprintGrowth,
    })
  }

  const consistency = input.streak.current ?? 0
  if (consistency >= 2) {
    candidates.push({
      kind: 'consistency',
      priority: 4,
      stableKey: `streak:${consistency}`,
      headline: `${consistency}-day practice streak`,
      detail: 'Your current practice rhythm is still active.',
      occurredAt:
        input.newest[0] === undefined ? null : occurredAt(input.newest[0]),
    })
  }

  const challengeRecord = input.newest.find((record) => {
    const source = sourceOf(record)
    return source === 'challenge' || source === 'weekly'
  })
  if (challengeRecord !== undefined) {
    const challengeId = challengeIdForRecord(
      challengeRecord,
      input.modelInput.challengeDefinitions,
    )
    const challengeScore = scoreOf(challengeRecord)
    const trace =
      challengeId === null
        ? null
        : matchingChallengeTrace(
            challengeRecord,
            input.modelInput.challengeTraces?.[challengeId],
          )
    candidates.push({
      kind: 'challenge',
      priority: 5,
      stableKey: challengeRecord.id,
      headline:
        challengeScore === null
          ? challengeRecord.melodyName
          : `${challengeScore}% on ${challengeRecord.melodyName}`,
      detail:
        sourceOf(challengeRecord) === 'weekly'
          ? 'Your latest weekly Legend attempt.'
          : 'Your latest challenge attempt.',
      occurredAt: occurredAt(challengeRecord),
      recordId: challengeRecord.id,
      score: challengeScore ?? undefined,
      source: sourceOf(challengeRecord),
      ...(trace === null ? {} : { trace }),
    })
  }

  const chronological = oldestRecords(input.newest).filter(
    (record) => occurredAt(record) !== '',
  )
  let returnCandidate: { record: SessionRecord; gapDays: number } | undefined
  for (let index = 1; index < chronological.length; index += 1) {
    const previousDay = localDayKey(occurredAt(chronological[index - 1]))
    const currentDay = localDayKey(occurredAt(chronological[index]))
    const gap = calendarDayDifference(previousDay, currentDay)
    if (gap !== null && gap >= 7) {
      returnCandidate = { record: chronological[index], gapDays: gap }
    }
  }
  if (
    returnCandidate !== undefined &&
    returnCandidate.record.id === input.newest[0]?.id
  ) {
    candidates.push({
      kind: 'return',
      priority: 6,
      stableKey: returnCandidate.record.id,
      headline: 'You came back',
      detail: `This practice followed a ${returnCandidate.gapDays}-day gap.`,
      occurredAt: occurredAt(returnCandidate.record),
      recordId: returnCandidate.record.id,
      score: scoreOf(returnCandidate.record) ?? undefined,
      source: sourceOf(returnCandidate.record),
      returnGapDays: returnCandidate.gapDays,
    })
  }

  const latest = input.newest[0]
  if (latest !== undefined) {
    const latestScore = scoreOf(latest)
    candidates.push({
      kind: 'latest-attempt',
      priority: 7,
      stableKey: latest.id,
      headline:
        latestScore === null
          ? 'Latest recorded practice'
          : `Latest practice: ${latestScore}%`,
      detail: latest.melodyName,
      occurredAt: occurredAt(latest),
      recordId: latest.id,
      score: latestScore ?? undefined,
      source: sourceOf(latest),
    })
  }

  return candidates
}

function buildCoverage(input: {
  availability: ProgressDataAvailability
  sessionsCapped: boolean
  sessionsLoaded: number
  sessionsAvailable: number | null
  hasCurrentStreak: boolean
  hasVoiceprints: boolean
  voiceprintsComplete: boolean
  voiceprintsLoaded: number
  voiceprintsAvailable: number | null
  activityComplete: boolean
  activityLoaded: number
  activityAvailable: number | null
  duration: ProgressDurationSummary
}): ProgressCoverageLabel[] {
  const sessionsStatus: ProgressCoverageStatus = !input.availability.sessions
    ? 'unavailable'
    : input.sessionsCapped
      ? 'windowed'
      : 'available'
  return [
    {
      id: 'sessions',
      status: sessionsStatus,
      label: !input.availability.sessions
        ? 'Scored session history unavailable'
        : input.sessionsCapped
          ? input.sessionsAvailable === null
            ? `Latest ${input.sessionsLoaded} scored sessions`
            : `Latest ${input.sessionsLoaded} of ${input.sessionsAvailable} scored sessions`
          : 'All scored sessions currently available',
      detail:
        'Session, exercise, challenge and weekly results share this record source.',
    },
    {
      id: 'rhythm',
      status: input.availability.sessions ? 'windowed' : 'unavailable',
      label: '13 calendar weeks',
      detail: 'Practice days use the device local date of each scored session.',
    },
    {
      id: 'scores',
      status: input.availability.sessions ? 'conditional' : 'unavailable',
      label: 'Like-for-like personal bests',
      detail: 'A score is compared only with the same source and task or song.',
    },
    {
      id: 'streak',
      status: input.hasCurrentStreak ? 'available' : 'windowed',
      label: input.hasCurrentStreak
        ? 'Current streak plus loaded history'
        : 'Loaded session streaks only',
      detail: 'The longest value may predate the loaded session window.',
    },
    {
      id: 'voiceprints',
      status: !input.availability.voiceprints
        ? 'unavailable'
        : input.hasVoiceprints
          ? input.voiceprintsComplete
            ? 'available'
            : 'windowed'
          : 'conditional',
      label: !input.availability.voiceprints
        ? 'Voiceprint history unavailable'
        : !input.voiceprintsComplete && input.hasVoiceprints
          ? input.voiceprintsAvailable === null
            ? `Latest ${input.voiceprintsLoaded} measured voiceprints`
            : `Latest ${input.voiceprintsLoaded} of ${input.voiceprintsAvailable} measured voiceprints`
          : 'Measured voiceprints',
      detail:
        'Growth appears only when both the first and latest metric exist.',
    },
    {
      id: 'account-activity',
      status: !input.availability.activity
        ? 'unavailable'
        : input.activityComplete
          ? 'conditional'
          : 'windowed',
      label: !input.availability.activity
        ? 'Account activity unavailable'
        : !input.activityComplete && input.activityLoaded > 0
          ? input.activityAvailable === null
            ? `Latest ${input.activityLoaded} account activities`
            : `Latest ${input.activityLoaded} of ${input.activityAvailable} account activities`
          : 'Registered-account activity',
      detail:
        'Playlists, karaoke, stems, melodies and Ascent acts are not stored while signed out.',
    },
    {
      id: 'recognition',
      status: input.availability.account ? 'conditional' : 'unavailable',
      label: input.availability.account
        ? 'Earned badges and achievements'
        : 'Earned marks unavailable',
      detail:
        'Only saved badge and achievement records appear on the milestone shelf.',
    },
    {
      id: 'duration',
      status:
        input.duration.completeTotalMs !== null
          ? 'available'
          : input.duration.measuredSessions > 0
            ? 'conditional'
            : 'unavailable',
      label:
        input.duration.completeTotalMs !== null
          ? 'Measured practice time available'
          : input.duration.measuredSessions > 0
            ? `Measured time on ${input.duration.measuredSessions} of ${input.duration.totalLoadedSessions} loaded sessions`
            : 'Practice minutes not shown',
      detail:
        input.duration.completeTotalMs !== null
          ? 'Every available scored session carries measured duration.'
          : 'No historical time is estimated or backfilled from streak credit.',
    },
  ]
}

export function buildProgressModel(
  rawInput: ProgressModelInput,
  options: BuildProgressModelOptions = {},
): ProgressModel {
  const now = options.now ?? new Date()
  const sessionLimit = options.sessionLimit ?? PROGRESS_SESSION_LIMIT
  const records = dedupeRecords(rawInput.records)
  const newest = newestRecords(records)
  const activity = buildActivityWindow(records, now)
  const allScorePoints = scorePoints(records)
  const scoreTrendLimit = options.scoreTrendLimit ?? PROGRESS_SCORE_TREND_LIMIT
  const comparableGroups = new Map<string, ProgressScorePoint[]>()
  for (const point of allScorePoints) {
    if (point.comparisonKey === null) continue
    const series = comparableGroups.get(point.comparisonKey) ?? []
    series.push(point)
    comparableGroups.set(point.comparisonKey, series)
  }
  const comparableSeries = [...comparableGroups.entries()]
    .filter(([, points]) => points.length >= 2)
    .map(([comparisonKey, points]) => ({
      comparisonKey,
      melodyName: points[points.length - 1].melodyName,
      source: points[points.length - 1].source,
      points: points.slice(-scoreTrendLimit),
    }))
    .sort((a, b) => {
      const latestA = a.points[a.points.length - 1]?.occurredAt ?? ''
      const latestB = b.points[b.points.length - 1]?.occurredAt ?? ''
      const delta =
        (validTime(latestB) ?? -Infinity) - (validTime(latestA) ?? -Infinity)
      return delta !== 0
        ? delta
        : a.comparisonKey.localeCompare(b.comparisonKey)
    })
  const validScores = records
    .map(scoreOf)
    .filter((score): score is number => score !== null)
  const sessionDayKeys = new Set(
    records.map((record) => localDayKey(occurredAt(record))).filter(Boolean),
  )
  const countSince = (daysAgo: number): number => {
    const from = dateKey(addCalendarDays(now, -daysAgo + 1))
    const through = dateKey(now)
    return records.filter((record) => {
      const day = localDayKey(occurredAt(record))
      return day >= from && day <= through
    }).length
  }
  const sourceCounts = new Map<SessionSource, number>()
  for (const source of PROGRESS_SOURCES) sourceCounts.set(source, 0)
  for (const record of records) {
    const source = sourceOf(record)
    sourceCounts.set(source, (sourceCounts.get(source) ?? 0) + 1)
  }

  const currentStreak =
    rawInput.currentStreak == null || !Number.isFinite(rawInput.currentStreak)
      ? null
      : Math.max(0, rawInput.currentStreak)
  const recordedStreaks = records
    .map((record) => record.streak)
    .filter((streak) => Number.isFinite(streak) && streak >= 0)
  const historyComplete =
    rawInput.sessionHistory?.complete ?? records.length < sessionLimit
  const totalAvailable =
    rawInput.sessionHistory?.totalAvailable ??
    (historyComplete ? records.length : null)
  const streak: ProgressStreakSummary = {
    current: currentStreak,
    longest:
      currentStreak === null && recordedStreaks.length === 0
        ? null
        : Math.max(currentStreak ?? 0, ...recordedStreaks, 0),
    longestIsWindowed: !historyComplete,
  }
  const measuredDurations = records
    .map(measuredDurationOf)
    .filter((duration): duration is number => duration !== null)
  const duration: ProgressDurationSummary = {
    measuredSessions: measuredDurations.length,
    totalLoadedSessions: records.length,
    measuredCoverage:
      records.length === 0 ? 0 : measuredDurations.length / records.length,
    measuredMs: measuredDurations.reduce((sum, value) => sum + value, 0),
    completeTotalMs:
      records.length > 0 &&
      historyComplete &&
      measuredDurations.length === records.length
        ? measuredDurations.reduce((sum, value) => sum + value, 0)
        : null,
  }
  const voiceprintGrowth = buildVoiceprintGrowth(
    rawInput.voiceprints,
    rawInput.voiceprintHistory?.comparable ?? true,
  )
  const recognition = buildRecognition(rawInput)
  const activityCounts = countActivity(rawInput.activityRows)
  const pointByRecord = new Map(
    allScorePoints.map((point) => [point.recordId, point]),
  )
  const recentHistory = newest
    .slice(0, options.recentHistoryLimit ?? PROGRESS_RECENT_HISTORY_LIMIT)
    .map(
      (record): ProgressHistoryItem => ({
        id: record.id,
        occurredAt: occurredAt(record),
        melodyName: record.melodyName,
        source: sourceOf(record),
        score: record.score,
        accuracy: record.accuracy,
        notesHit: record.notesHit,
        notesTotal: record.notesTotal,
        streak: record.streak,
        instrument: record.instrument ?? 'voice',
        durationMs: measuredDurationOf(record),
        ...(record.sourceRef === undefined
          ? {}
          : { sourceRef: record.sourceRef }),
        ...(record.weeklyChallengeId === undefined
          ? {}
          : { weeklyChallengeId: record.weeklyChallengeId }),
        comparisonKey: sessionComparisonKey(record),
        isComparablePersonalBest:
          pointByRecord.get(record.id)?.isComparablePersonalBest ?? false,
      }),
    )
  const availability = {
    ...DEFAULT_AVAILABILITY,
    ...rawInput.availability,
  }
  const sessionsCapped = !historyComplete
  const eligibleMoments = rankMoments(
    buildMomentCandidates({
      modelInput: rawInput,
      newest,
      scorePoints: allScorePoints,
      recognition,
      voiceprintGrowth,
      streak,
      now,
    }),
  )
  const oneMoment = eligibleMoments[0] ?? emptyMoment()

  return {
    generatedAt: now.toISOString(),
    sessions: {
      totalLoaded: records.length,
      totalAvailable,
      last7Days: countSince(7),
      last30Days: countSince(30),
      last13Weeks: activity.days.reduce((sum, day) => sum + day.count, 0),
      distinctPracticeDays: sessionDayKeys.size,
      bestScore: validScores.length === 0 ? null : Math.max(...validScores),
      loadedWindowIsCapped: sessionsCapped,
    },
    sourceComposition: PROGRESS_SOURCES.map((source) => ({
      source,
      count: sourceCounts.get(source) ?? 0,
      proportion:
        records.length === 0
          ? 0
          : (sourceCounts.get(source) ?? 0) / records.length,
    })),
    activity,
    scoreTrend: {
      points: allScorePoints.slice(-scoreTrendLimit),
      comparableSeries,
      comparablePersonalBests: allScorePoints
        .filter((point) => point.isComparablePersonalBest)
        .reverse(),
    },
    streak,
    duration,
    voiceprintGrowth,
    recognition,
    activityCounts,
    activityTotal: Object.values(activityCounts).reduce(
      (sum, count) => sum + (count ?? 0),
      0,
    ),
    activityHistory: {
      complete: rawInput.activityHistory?.complete ?? true,
      totalAvailable:
        rawInput.activityHistory?.totalAvailable ??
        rawInput.activityRows.length,
    },
    recentActivity: [...rawInput.recentActivity]
      .sort((a, b) => {
        const delta =
          (validTime(b.at) ?? -Infinity) - (validTime(a.at) ?? -Infinity)
        return delta !== 0 ? delta : a.id.localeCompare(b.id)
      })
      .slice(0, PROGRESS_RECENT_HISTORY_LIMIT),
    league: rawInput.league,
    recentHistory,
    coverage: buildCoverage({
      availability,
      sessionsCapped,
      sessionsLoaded: records.length,
      sessionsAvailable: totalAvailable,
      hasCurrentStreak: currentStreak !== null && currentStreak > 0,
      hasVoiceprints: voiceprintGrowth.count > 0,
      voiceprintsComplete: rawInput.voiceprintHistory?.complete ?? true,
      voiceprintsLoaded: voiceprintGrowth.count,
      voiceprintsAvailable:
        rawInput.voiceprintHistory?.totalAvailable ?? voiceprintGrowth.count,
      activityComplete: rawInput.activityHistory?.complete ?? true,
      activityLoaded: rawInput.activityRows.length,
      activityAvailable:
        rawInput.activityHistory?.totalAvailable ??
        rawInput.activityRows.length,
      duration,
    }),
    oneMoment,
    eligibleMoments,
    oneMomentAlternates: eligibleMoments.slice(1),
  }
}
