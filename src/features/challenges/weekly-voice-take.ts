// ============================================================
// Weekly Legend Voice Take — challenge-scoped local keep adapter
// ============================================================

import type { SaveVoiceTakeResult } from '@/db/services/voice-take-service'
import { saveVoiceTake } from '@/db/services/voice-take-service'
import type { ExerciseSessionVoiceTake } from '@/features/exercises/use-base-exercise'
import type { WeeklyTier } from './weekly-attempt'

const WEEKLY_CONTEXT_VERSION = 1

export interface WeeklyLegendTakeContext {
  challengeId: string
  title: string
  score: number
  targetScore: number
  tier: WeeklyTier
}

export function weeklyLegendComparisonKey(challengeId: string): string {
  return `legend:${encodeURIComponent(challengeId)}:v${WEEKLY_CONTEXT_VERSION}`
}

export function weeklyLegendThreadTitle(title: string): string {
  return `Weekly Legend · ${title}`
}

export async function keepWeeklyLegendVoiceTake(input: {
  context: WeeklyLegendTakeContext
  take: ExerciseSessionVoiceTake
}): Promise<SaveVoiceTakeResult> {
  const { context, take } = input
  const threadTitle = weeklyLegendThreadTitle(context.title)

  return saveVoiceTake({
    source: 'legend',
    comparisonKey: weeklyLegendComparisonKey(context.challengeId),
    contextVersion: WEEKLY_CONTEXT_VERSION,
    capturedAt: take.capturedAt,
    durationMs: take.durationMs,
    blob: take.blob,
    peaks: take.peaks,
    title: threadTitle,
    context: {
      threadTitle,
      weeklyChallengeId: context.challengeId,
      challengeTitle: context.title,
      targetScore: context.targetScore,
      tier: context.tier,
      exerciseType: take.config.type,
      configuration: take.config,
      score: context.score,
    },
    metrics: {
      ...take.result.metrics,
      score: context.score,
      targetScore: context.targetScore,
      tier: context.tier,
    },
    metricsVersion: 1,
  })
}
