// ============================================================
// Progress view model — maps the canonical record into the Resonance Atlas.
// Copy and marks expose evidence boundaries instead of inventing continuity.
// ============================================================

import type { SessionSource, UserActivity, UserActivityKind, } from '@/db/entities'
import { badgeArtSrc } from '@/features/challenges/badge-art'
import { legendTierSrc } from '@/features/mirror/LegendCaricature'
import { midiToNoteNameOctave } from '@/lib/note-utils'
import type { ProgressActivityWeek, ProgressCoverageLabel, ProgressHistoryItem, ProgressModel, ProgressOneMoment, ProgressScorePoint, } from './model'
import type { ProgressActionView, ProgressCoverageView, ProgressEvidenceView, ProgressHistoryItemView, ProgressHistoryView, ProgressLeagueView, ProgressMilestoneView, ProgressMomentOptionView, ProgressMomentView, ProgressPageSnapshot, ProgressPathSegmentView, ProgressPathsView, ProgressRhythmView, ProgressSkillThreadView, ProgressSourceKind, ProgressTraceView, ProgressVoiceAtlasView, ProgressWeekView, } from './ProgressPage'

export type ProgressHistoryFilterId = 'all' | ProgressSourceKind

export interface BuildProgressPageSnapshotOptions {
  accountHeld: boolean
  selectedMomentId?: string
  selectedWeekId?: string
  historyFilterId?: string
}

const PERIOD_ID = '13-weeks'
const MAX_THREAD_POINTS = 8
const MAX_MILESTONES = 8

const SOURCE_ORDER: readonly ProgressSourceKind[] = [
  'practice',
  'exercise',
  'challenge',
  'weekly',
]

interface AccountPathDefinition {
  label: string
  detail: (count: number) => string
  action: ProgressActionView
}

const ACCOUNT_PATHS: Readonly<Record<UserActivityKind, AccountPathDefinition>> =
  {
    song_completed: {
      label: 'Karaoke performances',
      detail: (count) => plural(count, 'recorded performance'),
      action: { id: 'path:karaoke', label: 'Open Karaoke', href: '#/karaoke' },
    },
    playlist_created: {
      label: 'Playlists made',
      detail: (count) => `${plural(count, 'playlist')} made`,
      action: {
        id: 'path:playlists',
        label: 'Open Karaoke',
        href: '#/karaoke',
      },
    },
    playlist_completed: {
      label: 'Playlists completed',
      detail: (count) => plural(count, 'recorded playlist completion'),
      action: {
        id: 'path:playlist-completions',
        label: 'Open Karaoke',
        href: '#/karaoke',
      },
    },
    stems_separated: {
      label: 'Stems separated',
      detail: (count) => plural(count, 'recorded stem separation'),
      action: { id: 'path:stems', label: 'Open Karaoke', href: '#/karaoke' },
    },
    melody_created: {
      label: 'Melodies created',
      detail: (count) => plural(count, 'recorded melody'),
      action: { id: 'path:compose', label: 'Open Compose', href: '#/compose' },
    },
    ascent_week_completed: {
      label: 'Ascent weeks',
      detail: (count) => plural(count, 'recorded week completed'),
      action: { id: 'path:ascent', label: 'Open Ascent', href: '#/path' },
    },
  }

function sourceKind(source: SessionSource): ProgressSourceKind {
  return source
}

function sourceName(source: SessionSource): string {
  if (source === 'weekly') return 'Weekly Legend'
  if (source === 'exercise') return 'Exercises'
  if (source === 'challenge') return 'Challenges'
  return 'Singing'
}

function plural(
  count: number,
  singular: string,
  pluralForm = `${singular}s`,
): string {
  return `${count} ${count === 1 ? singular : pluralForm}`
}

function percentage(value: number): string {
  return `${Math.round(value)}%`
}

function points(value: number): string {
  const rounded = Math.round(value * 10) / 10
  return `${rounded} ${Math.abs(rounded) === 1 ? 'point' : 'points'}`
}

function formatDateKey(
  value: string,
  options: Intl.DateTimeFormatOptions,
): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (match === null) return value
  const date = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    12,
  )
  return new Intl.DateTimeFormat(undefined, options).format(date)
}

function localDateKey(value: string | null | undefined): string | null {
  if (value === null || value === undefined || value === '') return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function dateWithinPeriod(
  value: string | null | undefined,
  model: ProgressModel,
): boolean {
  const key = localDateKey(value)
  return (
    key !== null &&
    key >= model.activity.fromDate &&
    key <= model.activity.throughDate
  )
}

function formatDate(value: string | null | undefined): string | null {
  const key = localDateKey(value)
  if (key === null) return null
  return formatDateKey(key, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function formatShortDate(value: string): string {
  return formatDateKey(value, { month: 'short', day: 'numeric' })
}

function formatWeekRange(
  week: ProgressActivityWeek,
  throughDate: string,
): string {
  const end = week.endDate > throughDate ? throughDate : week.endDate
  return `${formatShortDate(week.startDate)}–${formatShortDate(end)}`
}

function formatDuration(durationMs: number): string {
  const totalSeconds = Math.max(1, Math.round(durationMs / 1_000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  if (minutes === 0) return `${seconds}s measured`
  if (seconds === 0) return `${minutes}m measured`
  return `${minutes}m ${seconds}s measured`
}

function momentKindLabel(moment: ProgressOneMoment): string {
  if (moment.kind === 'personal-best') return 'Comparable best'
  if (moment.kind === 'voiceprint-growth') return 'Voiceprint'
  if (moment.kind === 'latest-attempt') return 'Latest practice'
  if (moment.kind === 'milestone') return 'Milestone'
  if (moment.kind === 'league') return 'League'
  if (moment.kind === 'consistency') return 'Consistency'
  if (moment.kind === 'challenge') return 'Challenge'
  if (moment.kind === 'return') return 'Return'
  return 'First reading'
}

/**
 * Stable within the persisted evidence behind a moment. It deliberately uses
 * record, milestone, voiceprint, and league identities before display copy.
 */
export function progressMomentId(moment: ProgressOneMoment): string {
  if (moment.milestone !== undefined) return `milestone:${moment.milestone.id}`
  if (moment.recordId !== undefined) return `${moment.kind}:${moment.recordId}`
  if (
    moment.voiceprintGrowth?.latest !== null &&
    moment.voiceprintGrowth?.latest !== undefined
  ) {
    return `voiceprint:${moment.voiceprintGrowth.latest.id}`
  }
  if (moment.league?.weekStart !== undefined) {
    return `league:${moment.league.weekStart}:${moment.league.league?.id ?? 'standing'}`
  }
  if (moment.kind === 'empty') return 'empty'
  return `${moment.kind}:${localDateKey(moment.occurredAt) ?? 'current'}`
}

export function findProgressMoment(
  model: ProgressModel,
  id: string,
): ProgressOneMoment | undefined {
  const eligible = model.eligibleMoments.find(
    (moment) => progressMomentId(moment) === id,
  )
  if (eligible !== undefined) return eligible
  return progressMomentId(model.oneMoment) === id ? model.oneMoment : undefined
}

function actionForSource(
  source: SessionSource,
  actionId: string,
): ProgressActionView {
  if (source === 'exercise') {
    return { id: actionId, label: 'Open Exercises', href: '#/exercises' }
  }
  if (source === 'challenge' || source === 'weekly') {
    return { id: actionId, label: 'Open Challenges', href: '#/challenges' }
  }
  return { id: actionId, label: 'Open Singing', href: '#/singing' }
}

function momentScorePoint(
  model: ProgressModel,
  moment: ProgressOneMoment,
): ProgressScorePoint | undefined {
  if (moment.recordId === undefined) return undefined
  return (
    model.scoreTrend.points.find(
      (point) => point.recordId === moment.recordId,
    ) ??
    model.scoreTrend.comparablePersonalBests.find(
      (point) => point.recordId === moment.recordId,
    )
  )
}

function historyForMoment(
  model: ProgressModel,
  moment: ProgressOneMoment,
): ProgressHistoryItem | undefined {
  if (moment.recordId === undefined) return undefined
  return model.recentHistory.find((item) => item.id === moment.recordId)
}

function momentTitle(model: ProgressModel, moment: ProgressOneMoment): string {
  const history = historyForMoment(model, moment)
  const scorePoint = momentScorePoint(model, moment)
  if (moment.kind === 'milestone' && moment.milestone !== undefined) {
    return `${moment.milestone.name} is now part of your record.`
  }
  if (moment.kind === 'league') {
    const league = moment.league ?? model.league
    return league?.league === undefined
      ? 'Your current league week is recorded.'
      : `You are in ${league.league.name} this week.`
  }
  if (moment.kind === 'personal-best') {
    return `A new like-for-like best on ${scorePoint?.melodyName ?? history?.melodyName ?? 'this practice'}.`
  }
  if (moment.kind === 'voiceprint-growth') {
    return 'Your voiceprint has a new reading.'
  }
  if (moment.kind === 'consistency') {
    const streak = model.streak.current
    return streak === null
      ? 'Your practice rhythm is still active.'
      : `You kept a ${plural(streak, 'day')} practice streak.`
  }
  if (moment.kind === 'challenge') {
    return `You completed ${history?.melodyName ?? scorePoint?.melodyName ?? 'a challenge'}.`
  }
  if (moment.kind === 'return') return 'You found your way back.'
  if (moment.kind === 'latest-attempt') {
    return `You completed ${history?.melodyName ?? scorePoint?.melodyName ?? 'your latest practice'}.`
  }
  return 'Your next moment starts here.'
}

function momentEvidence(
  model: ProgressModel,
  moment: ProgressOneMoment,
): ProgressEvidenceView[] {
  const evidence: ProgressEvidenceView[] = []
  const at = formatDate(moment.occurredAt)
  const scorePoint = momentScorePoint(model, moment)
  const add = (fact: ProgressEvidenceView | undefined): void => {
    if (fact !== undefined && evidence.length < 3) evidence.push(fact)
  }

  if (moment.kind === 'milestone' && moment.milestone !== undefined) {
    add({
      id: 'kind',
      label: 'Earned mark',
      value: moment.milestone.kind === 'badge' ? 'Badge' : 'Achievement',
      detail: moment.milestone.tier,
    })
    add(at === null ? undefined : { id: 'earned', label: 'Earned', value: at })
  } else if (moment.kind === 'league') {
    const league = moment.league ?? model.league
    add(
      league?.rank === null || league?.rank === undefined
        ? undefined
        : { id: 'rank', label: 'Current rank', value: String(league.rank) },
    )
    add(
      league?.points === undefined
        ? undefined
        : {
            id: 'points',
            label: 'League points',
            value: String(league.points),
          },
    )
    add(
      league?.league === undefined
        ? undefined
        : { id: 'rung', label: 'League', value: league.league.name },
    )
  } else if (moment.kind === 'personal-best') {
    add(
      moment.score === undefined
        ? undefined
        : {
            id: 'score',
            label: 'Current score',
            value: percentage(moment.score),
          },
    )
    add(
      scorePoint?.previousBestScore === null ||
        scorePoint?.previousBestScore === undefined
        ? undefined
        : {
            id: 'previous',
            label: 'Previous comparable best',
            value: percentage(scorePoint.previousBestScore),
          },
    )
    add(
      scorePoint?.improvement === null || scorePoint?.improvement === undefined
        ? undefined
        : {
            id: 'difference',
            label: 'Difference',
            value: points(scorePoint.improvement),
          },
    )
  } else if (moment.kind === 'voiceprint-growth') {
    const latest = moment.voiceprintGrowth?.latest
    const summary = latest?.summary
    add(
      summary?.lowMidi === null ||
        summary?.lowMidi === undefined ||
        summary.highMidi === null
        ? undefined
        : {
            id: 'range',
            label: 'Latest measured range',
            value: `${midiToNoteNameOctave(summary.lowMidi)}–${midiToNoteNameOctave(summary.highMidi)}`,
          },
    )
    add(
      summary?.accuracy === null || summary?.accuracy === undefined
        ? undefined
        : {
            id: 'accuracy',
            label: 'Latest accuracy',
            value: percentage(summary.accuracy),
          },
    )
    add(
      summary?.steadiness === null || summary?.steadiness === undefined
        ? undefined
        : {
            id: 'steadiness',
            label: 'Latest steadiness',
            value: percentage(summary.steadiness),
          },
    )
  } else if (moment.kind === 'consistency') {
    add(
      model.streak.current === null
        ? undefined
        : {
            id: 'current-streak',
            label: 'Current streak',
            value: plural(model.streak.current, 'day'),
          },
    )
    add({
      id: 'active-weeks',
      label: 'Active weeks',
      value: String(
        model.activity.weeks.filter((week) => week.sessionCount > 0).length,
      ),
    })
    add({
      id: 'attempts',
      label: 'Recorded attempts',
      value: String(model.sessions.last13Weeks),
    })
  } else {
    add(
      moment.score === undefined
        ? undefined
        : {
            id: 'score',
            label: 'Recorded score',
            value: percentage(moment.score),
          },
    )
    add(
      moment.source === undefined
        ? undefined
        : {
            id: 'source',
            label: 'Practice kind',
            value: sourceName(moment.source),
          },
    )
    add(
      moment.returnGapDays === undefined
        ? undefined
        : {
            id: 'return-gap',
            label: 'Time away',
            value: plural(moment.returnGapDays, 'day'),
          },
    )
    add(at === null ? undefined : { id: 'date', label: 'Recorded', value: at })
  }
  return evidence
}

function momentReason(moment: ProgressOneMoment): string {
  if (moment.kind === 'milestone') {
    return 'This is the newest recently earned mark in the loaded record.'
  }
  if (moment.kind === 'league') {
    return 'Your current league position is the clearest recent result.'
  }
  if (moment.kind === 'personal-best') {
    return 'This score beat an earlier attempt of the same exercise or song.'
  }
  if (moment.kind === 'voiceprint-growth') {
    return 'The first and latest saved voiceprints share measured fields, and at least one change cleared the display threshold.'
  }
  if (moment.kind === 'consistency') {
    return 'Your current streak is the clearest consistency signal.'
  }
  if (moment.kind === 'challenge') {
    return moment.trace === undefined
      ? 'This is the latest recorded challenge or Weekly Legend attempt.'
      : 'This is the latest recorded challenge or Weekly Legend attempt with a saved pitch trace from that take.'
  }
  if (moment.kind === 'return') {
    return 'This is the first recorded practice after a gap of at least seven days.'
  }
  if (moment.kind === 'latest-attempt') {
    return 'No stronger recent candidate outranked the latest completed attempt.'
  }
  return 'Complete a scored practice to begin the record.'
}

function momentAction(
  model: ProgressModel,
  moment: ProgressOneMoment,
): ProgressActionView | undefined {
  const id = `continue:${progressMomentId(moment)}`
  if (moment.kind === 'empty') return undefined
  if (moment.kind === 'voiceprint-growth') {
    return {
      id,
      label: 'Explore constellation',
      href: '#/voice-constellation',
    }
  }
  if (moment.kind === 'league') {
    return { id, label: 'Open Leaderboard', href: '#/leaderboard' }
  }
  const source = moment.source ?? model.recentHistory[0]?.source
  return source === undefined
    ? { id, label: 'Open Singing', href: '#/singing' }
    : actionForSource(source, id)
}

export function progressMomentToView(
  model: ProgressModel,
  moment: ProgressOneMoment,
): ProgressMomentView {
  const at = formatDate(moment.occurredAt)
  const contextParts = [
    moment.source === undefined ? null : sourceName(moment.source),
    at,
  ].filter((part): part is string => part !== null)

  return {
    id: progressMomentId(moment),
    kindLabel: momentKindLabel(moment),
    title: momentTitle(model, moment),
    context:
      contextParts.length > 0
        ? contextParts.join(' · ')
        : 'Loaded progress record',
    evidence: momentEvidence(model, moment),
    reason: momentReason(moment),
    confidenceLabel:
      moment.kind === 'consistency' || moment.kind === 'return'
        ? 'Based on your saved practice dates.'
        : moment.kind === 'empty'
          ? 'No scored reading yet.'
          : 'Based on the practice details available here.',
    primaryAction: momentAction(model, moment),
    shareable: moment.kind !== 'empty',
  }
}

function momentOptions(
  model: ProgressModel,
  selected: ProgressOneMoment,
): ProgressMomentOptionView[] {
  const selectedId = progressMomentId(selected)
  return model.eligibleMoments
    .filter((moment) => progressMomentId(moment) !== selectedId)
    .slice(0, 3)
    .map((moment) => {
      const view = progressMomentToView(model, moment)
      return { id: view.id, title: view.title, kindLabel: view.kindLabel }
    })
}

function weekMilestone(
  model: ProgressModel,
  week: ProgressActivityWeek,
): string | undefined {
  return model.recognition.milestones.find((milestone) => {
    const key = localDateKey(milestone.occurredAt)
    return key !== null && key >= week.startDate && key <= week.endDate
  })?.name
}

function buildWeeks(model: ProgressModel): ProgressWeekView[] {
  const maximum = Math.max(
    0,
    ...model.activity.weeks.map((week) => week.sessionCount),
  )
  const sessionCoverage = model.coverage.find(
    (entry) => entry.id === 'sessions',
  )
  const historyIsWindowed = sessionCoverage?.status === 'windowed'

  return model.activity.weeks.map((week) => {
    const sources = SOURCE_ORDER.filter((source) =>
      week.days.some((day) => day.sources.includes(source)),
    )
    return {
      id: week.startDate,
      shortLabel: formatShortDate(week.startDate),
      rangeLabel: formatWeekRange(week, model.activity.throughDate),
      activityLevel: maximum === 0 ? 0 : week.sessionCount / maximum,
      activeDaysLabel: plural(week.practiceDays, 'active day', 'active days'),
      attemptsLabel: plural(week.sessionCount, 'attempt'),
      summary:
        week.sessionCount === 0
          ? historyIsWindowed
            ? 'No scored attempt appears in the loaded history for this week.'
            : 'No scored practice recorded in this week.'
          : `${plural(week.sessionCount, 'scored attempt')} across ${plural(week.practiceDays, 'active day', 'active days')}.`,
      sources,
      coverage: historyIsWindowed
        ? 'partial'
        : week.sessionCount === 0
          ? 'empty'
          : 'complete',
      milestoneLabel: weekMilestone(model, week),
    }
  })
}

function buildRhythm(model: ProgressModel): ProgressRhythmView {
  const attempts = model.activity.days.reduce((sum, day) => sum + day.count, 0)
  const activeDays = model.activity.days.filter((day) => day.count > 0).length
  const activeWeeks = model.activity.weeks.filter(
    (week) => week.sessionCount > 0,
  ).length
  const sources = new Set(
    model.activity.days.flatMap((day) => day.sources.map(sourceKind)),
  )
  const facts: ProgressEvidenceView[] = [
    {
      id: 'active-days',
      label: 'Active days',
      value: String(activeDays),
    },
    {
      id: 'attempts',
      label: 'Scored attempts',
      value: String(attempts),
    },
    {
      id: 'practice-kinds',
      label: 'Practice kinds',
      value: String(sources.size),
    },
  ]
  if (model.streak.current !== null) {
    facts.unshift({
      id: 'current-streak',
      label: 'Current streak',
      value: plural(model.streak.current, 'day'),
    })
  }

  return {
    title:
      activeWeeks === 0
        ? 'The last 13 weeks are still quiet.'
        : `${plural(activeWeeks, 'active week')} in view.`,
    summary:
      attempts === 0
        ? 'Finish a scored practice to leave the first mark in this period.'
        : `${plural(attempts, 'scored attempt')} across ${plural(activeDays, 'active day', 'active days')}.`,
    facts: facts.slice(0, 3),
  }
}

function buildSkillThreads(model: ProgressModel): ProgressSkillThreadView[] {
  return model.scoreTrend.comparableSeries
    .map((series): ProgressSkillThreadView | null => {
      const periodPoints = series.points.filter(
        (point) =>
          point.date >= model.activity.fromDate &&
          point.date <= model.activity.throughDate,
      )
      if (periodPoints.length < 2) return null
      const displayPoints = periodPoints.slice(-MAX_THREAD_POINTS)
      const latest = displayPoints[displayPoints.length - 1]
      const summary =
        latest.isComparablePersonalBest && latest.improvement !== null
          ? `The latest score is ${points(latest.improvement)} above the previous comparable best.`
          : `${plural(periodPoints.length, 'scored attempt')} were recorded for the same exercise or song.`
      return {
        id: `thread:${series.comparisonKey}`,
        label: series.melodyName,
        context: `${sourceName(series.source)} · same task setup`,
        metricLabel: 'Score',
        summary,
        points: displayPoints.map((point) => ({
          id: point.recordId,
          label: formatShortDate(point.date),
          value: percentage(point.score),
          level: Math.min(1, Math.max(0, point.score / 100)),
        })),
        action: actionForSource(
          series.source,
          `thread:${series.comparisonKey}`,
        ),
      }
    })
    .filter((thread): thread is ProgressSkillThreadView => thread !== null)
}

function buildVoiceAtlas(model: ProgressModel): ProgressVoiceAtlasView {
  const latest = model.voiceprintGrowth.latest
  const actions: ProgressActionView[] = [
    { id: 'voice-map', label: 'Map my voice again', href: '/mirror' },
    { id: 'voice-analysis', label: 'Open Analysis', href: '#/analysis' },
  ]
  if (latest?.twin !== null && latest?.twin !== undefined) {
    actions.push({
      id: 'voice-constellation',
      label: 'Explore constellation',
      href: '#/voice-constellation',
    })
  }
  if (latest === null) {
    return {
      title: 'Map your voice to begin this chapter.',
      measuredAtLabel: 'No saved voiceprint',
      description:
        'A saved Voice Mirror reading can place measured range, accuracy, and steadiness beside practice history.',
      metrics: [],
      actions,
    }
  }

  const summary = latest.summary
  const metrics: ProgressEvidenceView[] = []
  if (summary.lowMidi !== null && summary.highMidi !== null) {
    metrics.push({
      id: 'range',
      label: 'Measured range',
      value: `${midiToNoteNameOctave(summary.lowMidi)}–${midiToNoteNameOctave(summary.highMidi)}`,
    })
  }
  if (summary.semitones !== null) {
    metrics.push({
      id: 'span',
      label: 'Measured span',
      value: plural(Math.round(summary.semitones), 'semitone'),
    })
  }
  if (summary.accuracy !== null) {
    metrics.push({
      id: 'accuracy',
      label: 'Accuracy',
      value: percentage(summary.accuracy),
    })
  }
  if (summary.steadiness !== null) {
    metrics.push({
      id: 'steadiness',
      label: 'Steadiness',
      value: percentage(summary.steadiness),
    })
  }

  return {
    title:
      latest.twin === null
        ? 'Your latest measured voiceprint.'
        : `Your latest voiceprint overlaps with ${latest.twin}.`,
    twinName: latest.twin ?? undefined,
    portraitUrl:
      latest.twin === null ? undefined : legendTierSrc(latest.twin, 'mid'),
    measuredAtLabel: `Mapped ${formatDate(latest.takenAt) ?? 'on an unknown date'}`,
    description:
      'This chapter shows only the latest saved reading. Each measurement stays separate; there is no composite voice score.',
    metrics,
    actions,
  }
}

function latestAccountActivity(
  activities: readonly UserActivity[],
): UserActivity | undefined {
  return activities.reduce<UserActivity | undefined>((latest, activity) => {
    if (localDateKey(activity.at) === null) return latest
    if (latest === undefined) return activity
    return activity.at > latest.at ? activity : latest
  }, undefined)
}

function buildPaths(model: ProgressModel): ProgressPathsView {
  const sourceDays = SOURCE_ORDER.map((source) => {
    const days = model.activity.days.filter((day) =>
      day.sources.includes(source),
    )
    return {
      source,
      days: days.length,
      firstDate: days[0]?.date ?? null,
    }
  }).filter((entry) => entry.days > 0 && entry.firstDate !== null)
  sourceDays.sort((a, b) =>
    (a.firstDate ?? '').localeCompare(b.firstDate ?? ''),
  )
  const latestActiveDay = [...model.activity.days]
    .reverse()
    .find((day) => day.count > 0)
  const latestActivity = latestAccountActivity(model.recentActivity)
  const accountActivityIsNewest =
    latestActivity !== undefined &&
    (latestActiveDay === undefined ||
      (localDateKey(latestActivity.at) ?? '') > latestActiveDay.date)
  const latestSource = accountActivityIsNewest
    ? undefined
    : latestActiveDay?.sources[0]
  const scoredSegments: ProgressPathSegmentView[] = sourceDays.map((entry) => ({
    id: `path:${entry.source}`,
    label: sourceName(entry.source),
    detail: `${plural(entry.days, 'active day', 'active days')} in this view`,
    source: entry.source,
    status: latestSource === entry.source ? 'current' : 'visited',
  }))
  const accountSegments = Object.entries(ACCOUNT_PATHS).flatMap(
    ([kindValue, definition]): ProgressPathSegmentView[] => {
      const kind = kindValue as UserActivityKind
      const count = model.activityCounts[kind] ?? 0
      if (count <= 0) return []
      return [
        {
          id: `path:account:${kind}`,
          label: definition.label,
          detail: model.activityHistory.complete
            ? `${definition.detail(count)} · recorded overall`
            : `At least ${definition.detail(count)} in loaded account history`,
          status:
            accountActivityIsNewest && latestActivity?.kind === kind
              ? 'current'
              : 'visited',
        },
      ]
    },
  )
  const segments = [...scoredSegments, ...accountSegments]
  const currentAccountPath =
    accountActivityIsNewest && latestActivity !== undefined
      ? ACCOUNT_PATHS[latestActivity.kind]
      : undefined
  const recommendation =
    currentAccountPath?.action ??
    (latestSource === undefined
      ? undefined
      : actionForSource(latestSource, `path:return:${latestSource}`))

  return {
    summary:
      segments.length === 0
        ? 'No scored practice appears in this 13-week view and no recorded account act is available.'
        : scoredSegments.length > 0 && accountSegments.length > 0
          ? model.activityHistory.complete
            ? 'Scored practice paths cover 13 weeks; account acts are recorded overall totals.'
            : 'Scored practice paths cover 13 weeks; account acts show the minimum found in loaded history.'
          : scoredSegments.length > 0
            ? 'Scored practice paths cover the last 13 weeks.'
            : model.activityHistory.complete
              ? 'Account acts are recorded overall totals; no scored path appears in this 13-week view.'
              : 'Account acts show the minimum found in loaded history; no scored path appears in this 13-week view.',
    segments,
    recommendation,
    recommendationReason:
      currentAccountPath !== undefined
        ? `${currentAccountPath.label} is your most recent recorded path act.`
        : latestSource === undefined
          ? undefined
          : `${sourceName(latestSource)} appears in your most recent active day.`,
  }
}

function buildMilestones(model: ProgressModel): ProgressMilestoneView[] {
  return model.recognition.milestones
    .slice(0, MAX_MILESTONES)
    .map((milestone) => ({
      id: milestone.id,
      title: milestone.name,
      kindLabel:
        milestone.kind === 'badge'
          ? `${milestone.tier === undefined ? '' : `${milestone.tier} `}badge`.trim()
          : 'Achievement',
      earnedAtLabel:
        formatDate(milestone.occurredAt) === null
          ? 'Earned date unavailable'
          : `Earned ${formatDate(milestone.occurredAt)}`,
      detail: milestone.description,
      artUrl: badgeArtSrc(milestone.icon),
      // Carried even when `artUrl` resolves: the view picks one or the
      // other, and a badge whose .webp 404s still has a glyph to fall to.
      icon: milestone.icon,
    }))
}

function leagueZone(model: ProgressModel): string | undefined {
  const league = model.league
  if (
    league?.eligible !== true ||
    league.league === undefined ||
    league.rank === null ||
    league.rank === undefined ||
    league.cohortSize === undefined
  ) {
    return undefined
  }
  if (league.rank <= league.league.promoteCount) return 'Promotion zone'
  if (league.rank > league.cohortSize - league.league.relegateCount) {
    return 'Relegation zone'
  }
  return 'Holding zone'
}

function buildLeague(model: ProgressModel): ProgressLeagueView | undefined {
  const league = model.league
  if (league?.eligible !== true || league.league === undefined) return undefined
  const rankLabel =
    league.rank !== null && league.rank !== undefined
      ? `Rank ${league.rank}${league.cohortSize === undefined ? '' : ` of ${league.cohortSize}`}`
      : league.points === undefined
        ? 'Standing available'
        : plural(league.points, 'point')
  return {
    title: league.league.name,
    rankLabel,
    periodLabel:
      league.weekStart === undefined
        ? 'Current week'
        : `Week of ${formatDate(league.weekStart) ?? league.weekStart}`,
    zoneLabel: leagueZone(model),
    artUrl: league.league.trophyAsset ?? undefined,
    action: {
      id: 'league:open',
      label: 'Open Leaderboard',
      href: '#/leaderboard',
    },
  }
}

function normalizeHistoryFilter(
  value: string | undefined,
): ProgressHistoryFilterId {
  return value !== undefined &&
    (value === 'all' || SOURCE_ORDER.includes(value as ProgressSourceKind))
    ? (value as ProgressHistoryFilterId)
    : 'all'
}

function historyFacts(item: ProgressHistoryItem): string[] {
  const facts: string[] = []
  if (Number.isFinite(item.score) && item.score >= 0 && item.score <= 100) {
    facts.push(`${percentage(item.score)} score`)
  }
  if (
    Number.isFinite(item.accuracy) &&
    item.accuracy >= 0 &&
    item.accuracy <= 100
  ) {
    facts.push(`${percentage(item.accuracy)} accuracy`)
  }
  if (item.notesTotal > 0 && item.notesHit >= 0) {
    facts.push(`${item.notesHit} of ${item.notesTotal} notes`)
  }
  if (item.durationMs !== null) facts.push(formatDuration(item.durationMs))
  if (item.isComparablePersonalBest) facts.push('Comparable personal best')
  return facts
}

function historyItemView(
  item: ProgressHistoryItem,
  accountHeld: boolean,
): ProgressHistoryItemView {
  return {
    id: item.id,
    occurredAtLabel: formatDate(item.occurredAt) ?? 'Date unavailable',
    title: item.melodyName,
    context:
      item.comparisonKey === null
        ? 'Scored attempt'
        : 'Comparable attempt details',
    facts: historyFacts(item),
    storageLabel: accountHeld ? 'Account history' : 'On this device',
    source: sourceKind(item.source),
    coverageLabel:
      item.comparisonKey === null
        ? 'This older attempt cannot be compared like for like'
        : 'Ready for like-for-like comparison',
    action: actionForSource(item.source, `history:${item.id}`),
  }
}

function buildHistory(
  model: ProgressModel,
  accountHeld: boolean,
  filterValue: string | undefined,
): ProgressHistoryView {
  const activeFilterId = normalizeHistoryFilter(filterValue)
  const periodItems = model.recentHistory.filter((item) =>
    dateWithinPeriod(item.occurredAt, model),
  )
  const filtered =
    activeFilterId === 'all'
      ? periodItems
      : periodItems.filter((item) => item.source === activeFilterId)
  return {
    summary: `${plural(periodItems.length, 'recent scored attempt')} available in this 13-week view.`,
    activeFilterId,
    filters: [
      { id: 'all', label: 'All' },
      { id: 'practice', label: 'Singing' },
      { id: 'exercise', label: 'Exercises' },
      { id: 'challenge', label: 'Challenges' },
      { id: 'weekly', label: 'Weekly Legend' },
    ],
    items: filtered.map((item) => historyItemView(item, accountHeld)),
  }
}

function coverageEntry(
  model: ProgressModel,
  id: ProgressCoverageLabel['id'],
): ProgressCoverageLabel | undefined {
  return model.coverage.find((entry) => entry.id === id)
}

function buildCoverageView(
  model: ProgressModel,
  accountHeld: boolean,
): ProgressCoverageView {
  const sessions = coverageEntry(model, 'sessions')
  const rhythm = coverageEntry(model, 'rhythm')
  const status: ProgressCoverageView['status'] =
    sessions?.status === 'unavailable'
      ? 'offline'
      : !accountHeld
        ? 'device-only'
        : sessions?.status === 'windowed'
          ? 'partial'
          : 'complete'
  const detail = [sessions?.label, rhythm?.label]
    .filter((label): label is string => label !== undefined)
    .join(' · ')
  return {
    scopeLabel: accountHeld ? 'Account progress' : 'On this device',
    detail:
      detail === ''
        ? 'Progress coverage is unavailable.'
        : `${detail}. ${sessions?.detail ?? ''}`.trim(),
    status,
    boundaryLabel:
      sessions?.status === 'windowed'
        ? 'Earlier records may exist outside the loaded history window.'
        : undefined,
    continuityAction: accountHeld
      ? undefined
      : {
          id: 'progress:continuity',
          label: 'Keep progress with an account',
          href: '#/settings/account',
        },
  }
}

function buildAtlasActivityTrace(
  weeks: readonly ProgressWeekView[],
): ProgressTraceView | undefined {
  if (weeks.length === 0) return undefined
  return {
    label: 'Weekly scored activity',
    values: weeks.map((week) => week.activityLevel),
  }
}

export function buildProgressPageSnapshot(
  model: ProgressModel,
  options: BuildProgressPageSnapshotOptions,
): ProgressPageSnapshot {
  const selected =
    (options.selectedMomentId === undefined
      ? undefined
      : findProgressMoment(model, options.selectedMomentId)) ?? model.oneMoment
  const weeks = buildWeeks(model)
  const selectedWeekId = weeks.some(
    (week) => week.id === options.selectedWeekId,
  )
    ? options.selectedWeekId
    : weeks.at(-1)?.id

  return {
    periodLabel: 'Last 13 weeks',
    periodContext: 'Scored voice practice',
    activePeriodId: PERIOD_ID,
    periodOptions: [{ id: PERIOD_ID, label: '13 weeks' }],
    selectedWeekId,
    moment: progressMomentToView(model, selected),
    alternateMoments: momentOptions(model, selected),
    weeks,
    atlasTrace: buildAtlasActivityTrace(weeks),
    rhythm: buildRhythm(model),
    skillThreads: buildSkillThreads(model),
    voice: buildVoiceAtlas(model),
    paths: buildPaths(model),
    milestones: buildMilestones(model),
    milestonesAvailable: model.recognition.available,
    league: buildLeague(model),
    history: buildHistory(model, options.accountHeld, options.historyFilterId),
    coverage: buildCoverageView(model, options.accountHeld),
  }
}
