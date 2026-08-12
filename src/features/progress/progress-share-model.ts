// ============================================================
// Progress share model — the pure truth boundary between the longitudinal
// Progress model and the canvas renderer's compact semantic payload.
// ============================================================

import type { ProgressHistoryItem, ProgressModel, ProgressOneMoment, ProgressScorePoint, ProgressVoiceprintGrowth, } from './model'
import type { ProgressPitchTrace, ProgressShareFact, ProgressShareMoment, } from './share-card'

const SOURCE_LABELS = {
  practice: 'Practice',
  exercise: 'Exercise',
  challenge: 'Challenge',
  weekly: 'Weekly Legend',
} as const

function finite(value: number | null | undefined): value is number {
  return value !== null && value !== undefined && Number.isFinite(value)
}

function clean(value: string | null | undefined): string {
  return value?.trim() ?? ''
}

function number(value: number): string {
  return Number.isInteger(value)
    ? String(value)
    : value.toFixed(1).replace(/\.0$/, '')
}

function signed(value: number): string {
  return `${value > 0 ? '+' : ''}${number(value)}`
}

function percentage(value: number | null | undefined): string | null {
  return finite(value) && value >= 0 && value <= 100
    ? `${number(value)}%`
    : null
}

function formatDate(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined || value === '') return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date)
}

function dateRange(
  from: string | null | undefined,
  through: string | null | undefined,
): string | null {
  const first = formatDate(from)
  const latest = formatDate(through)
  if (first === null) return latest
  if (latest === null || latest === first) return first
  return `${first} – ${latest}`
}

function fact(
  value: string | null | undefined,
  label: string,
): ProgressShareFact | null {
  const cleanValue = clean(value)
  return cleanValue === '' ? null : { value: cleanValue, label }
}

function keepFacts(
  facts: ReadonlyArray<ProgressShareFact | null>,
): ProgressShareFact[] {
  return facts
    .filter((item): item is ProgressShareFact => item !== null)
    .slice(0, 3)
}

function historyFor(
  moment: ProgressOneMoment,
  model: ProgressModel,
): ProgressHistoryItem | undefined {
  if (moment.recordId === undefined) return undefined
  return model.recentHistory.find((item) => item.id === moment.recordId)
}

function personalBestPoint(
  moment: ProgressOneMoment,
  model: ProgressModel,
): ProgressScorePoint | undefined {
  if (moment.recordId === undefined) return undefined
  return model.scoreTrend.comparablePersonalBests.find(
    (point) => point.recordId === moment.recordId,
  )
}

function attemptFacts(
  moment: ProgressOneMoment,
  model: ProgressModel,
  scoreLabel = 'score',
): ProgressShareFact[] {
  const history = historyFor(moment, model)
  const score = percentage(moment.score)
  const accuracy = percentage(history?.accuracy)
  const notes =
    history !== undefined &&
    finite(history.notesHit) &&
    finite(history.notesTotal) &&
    history.notesHit >= 0 &&
    history.notesTotal > 0 &&
    history.notesHit <= history.notesTotal
      ? `${number(history.notesHit)} / ${number(history.notesTotal)}`
      : null
  const source = moment.source ?? history?.source

  return keepFacts([
    fact(score, scoreLabel),
    fact(accuracy, 'pitch accuracy'),
    fact(notes, 'notes hit'),
    score === null && source !== undefined
      ? fact(SOURCE_LABELS[source], 'practice source')
      : null,
  ])
}

function milestoneFacts(moment: ProgressOneMoment): ProgressShareFact[] {
  const milestone = moment.milestone
  if (milestone === undefined) return []
  const kind = milestone.kind === 'badge' ? 'Badge' : 'Achievement'
  const tier = milestone.tier
  return keepFacts([
    fact(kind, 'earned milestone'),
    tier === undefined
      ? null
      : fact(`${tier[0].toUpperCase()}${tier.slice(1)}`, 'badge tier'),
  ])
}

function leagueFacts(
  moment: ProgressOneMoment,
  model: ProgressModel,
): ProgressShareFact[] {
  const league = moment.league ?? model.league
  if (league === null || league === undefined || !league.eligible) return []
  return keepFacts([
    fact(league.league?.name, 'league'),
    finite(league.rank) && league.rank > 0
      ? fact(`#${number(league.rank)}`, 'weekly rank')
      : null,
    finite(league.points) && league.points >= 0
      ? fact(number(league.points), 'league points')
      : null,
  ])
}

function personalBestFacts(
  moment: ProgressOneMoment,
  model: ProgressModel,
): ProgressShareFact[] {
  const point = personalBestPoint(moment, model)
  return keepFacts([
    fact(percentage(moment.score), 'new comparable best'),
    fact(percentage(point?.previousBestScore), 'previous comparable best'),
    finite(point?.improvement) && point.improvement > 0
      ? fact(`+${number(point.improvement)}`, 'points vs prior best')
      : null,
  ])
}

function voiceprintFacts(
  moment: ProgressOneMoment,
  model: ProgressModel,
): ProgressShareFact[] {
  const growth: ProgressVoiceprintGrowth =
    moment.voiceprintGrowth ?? model.voiceprintGrowth
  const facts: Array<ProgressShareFact | null> = []
  const addChange = (
    value: number | null,
    label: string,
    suffix = '',
  ): void => {
    if (finite(value) && value !== 0) {
      facts.push(fact(`${signed(value)}${suffix}`, label))
    }
  }

  addChange(growth.deltas.semitones, 'range span change', ' st')
  addChange(growth.deltas.accuracy, 'accuracy change', ' pts')
  addChange(growth.deltas.steadiness, 'steadiness change', ' pts')
  if (facts.length === 0) {
    addChange(growth.deltas.lowMidi, 'low edge change', ' st')
    addChange(growth.deltas.highMidi, 'high edge change', ' st')
  }
  if (facts.length < 3 && growth.count >= 2) {
    facts.push(fact(number(growth.count), 'measured voiceprints'))
  }
  return keepFacts(facts)
}

function consistencyFacts(model: ProgressModel): ProgressShareFact[] {
  const current = model.streak.current
  const longest = model.streak.longest
  return keepFacts([
    finite(current) && current > 0
      ? fact(number(current), 'current streak days')
      : null,
    model.sessions.last7Days > 0
      ? fact(number(model.sessions.last7Days), 'attempts in last 7 days')
      : null,
    finite(longest) && longest > 0 && longest !== current
      ? fact(
          number(longest),
          model.streak.longestIsWindowed
            ? 'longest in loaded history'
            : 'longest recorded streak',
        )
      : null,
  ])
}

function returnFacts(
  moment: ProgressOneMoment,
  model: ProgressModel,
): ProgressShareFact[] {
  const gap = moment.returnGapDays
  return keepFacts([
    finite(gap) && gap >= 1
      ? fact(number(gap), 'days between practices')
      : null,
    ...attemptFacts(moment, model, 'return attempt score'),
  ])
}

function factsFor(
  moment: ProgressOneMoment,
  model: ProgressModel,
): ProgressShareFact[] {
  switch (moment.kind) {
    case 'milestone':
      return milestoneFacts(moment)
    case 'league':
      return leagueFacts(moment, model)
    case 'personal-best':
      return personalBestFacts(moment, model)
    case 'voiceprint-growth':
      return voiceprintFacts(moment, model)
    case 'consistency':
      return consistencyFacts(model)
    case 'challenge':
      return attemptFacts(moment, model, 'challenge score')
    case 'return':
      return returnFacts(moment, model)
    case 'latest-attempt':
      return attemptFacts(moment, model)
    case 'empty':
      return []
  }
}

function traceFor(moment: ProgressOneMoment): ProgressPitchTrace | undefined {
  if (moment.kind !== 'challenge' || moment.trace === undefined)
    return undefined
  const points = moment.trace.samples.flatMap(([time, hz]) => {
    if (!finite(time) || time < 0 || !finite(hz) || hz <= 0) return []
    const pitch = 69 + 12 * Math.log2(hz / 440)
    return finite(pitch) ? [{ time, pitch }] : []
  })
  if (points.length < 2) return undefined
  let firstTime = Number.POSITIVE_INFINITY
  let lastTime = Number.NEGATIVE_INFINITY
  for (const point of points) {
    firstTime = Math.min(firstTime, point.time)
    lastTime = Math.max(lastTime, point.time)
  }
  if (firstTime === lastTime) return undefined

  return {
    points,
    description:
      moment.source === 'weekly'
        ? 'Best saved pitch contour for this Weekly Legend'
        : 'Best saved pitch contour for this challenge',
  }
}

function periodFor(
  moment: ProgressOneMoment,
  model: ProgressModel,
): string | null {
  if (moment.kind === 'voiceprint-growth') {
    const growth = moment.voiceprintGrowth ?? model.voiceprintGrowth
    return dateRange(growth.first?.takenAt, growth.latest?.takenAt)
  }
  if (moment.kind === 'league') {
    const weekStart = (moment.league ?? model.league)?.weekStart
    const date = formatDate(weekStart)
    return date === null ? formatDate(moment.occurredAt) : `Week of ${date}`
  }
  return formatDate(moment.occurredAt)
}

/**
 * Converts one already-selected Progress story into the complete share-card
 * payload. It adds only measured context held by the same model snapshot;
 * identity remains absent until the Share Studio's explicit opt-in.
 */
export function buildProgressShareMoment(
  moment: ProgressOneMoment,
  model: ProgressModel,
): ProgressShareMoment {
  return {
    claim: moment.headline,
    facts: factsFor(moment, model),
    context: clean(moment.detail) === '' ? null : moment.detail,
    period: periodFor(moment, model),
    handle: null,
    trace: traceFor(moment),
  }
}
