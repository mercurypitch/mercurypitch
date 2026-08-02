// ============================================================
// Exercise Voice Take — stable context and local keep adapter
// ============================================================

import type { SaveVoiceTakeResult } from '@/db/services/voice-take-service'
import { saveVoiceTake } from '@/db/services/voice-take-service'
import type { ExerciseConfig } from './types'
import type { ExerciseSessionVoiceTake } from './use-base-exercise'

const EXERCISE_CONTEXT_VERSION = 1

interface ComparableExerciseConfig {
  type: ExerciseConfig['type']
  targetNote: string | null
  targetNotes: string[]
  duration: number | null
  difficulty: number | null
  pattern: string | null
}

function comparableConfig(config: ExerciseConfig): ComparableExerciseConfig {
  return {
    type: config.type,
    targetNote: config.targetNote ?? null,
    targetNotes:
      config.targetNotes === undefined ? [] : [...config.targetNotes],
    duration: config.duration ?? null,
    difficulty: config.difficulty ?? null,
    pattern: config.pattern ?? null,
  }
}

/** Small deterministic FNV-1a fingerprint; no user or audio data enters it. */
function fingerprint(value: string): string {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(36)
}

export function exerciseComparisonKey(config: ExerciseConfig): string {
  const payload = JSON.stringify(comparableConfig(config))
  return `exercise:${config.type}:${fingerprint(payload)}:v${EXERCISE_CONTEXT_VERSION}`
}

export function exerciseThreadTitle(
  exerciseTitle: string,
  config: ExerciseConfig,
): string {
  if (config.targetNotes !== undefined && config.targetNotes.length > 0) {
    const first = config.targetNotes[0]!
    const last = config.targetNotes.at(-1)!
    return `${exerciseTitle} · ${first}${first === last ? '' : ` to ${last}`}`
  }
  if (config.targetNote !== undefined && config.targetNote !== '') {
    return `${exerciseTitle} · ${config.targetNote}`
  }
  if (config.pattern !== undefined && config.pattern !== '') {
    return `${exerciseTitle} · ${config.pattern}`
  }
  return exerciseTitle
}

export async function keepExerciseVoiceTake(input: {
  exerciseTitle: string
  take: ExerciseSessionVoiceTake
}): Promise<SaveVoiceTakeResult> {
  const threadTitle = exerciseThreadTitle(
    input.exerciseTitle,
    input.take.config,
  )
  return saveVoiceTake({
    source: 'exercise',
    comparisonKey: exerciseComparisonKey(input.take.config),
    contextVersion: EXERCISE_CONTEXT_VERSION,
    capturedAt: input.take.capturedAt,
    durationMs: input.take.durationMs,
    blob: input.take.blob,
    peaks: input.take.peaks,
    contour: input.take.contour,
    title: threadTitle,
    context: {
      threadTitle,
      exerciseTitle: input.exerciseTitle,
      exerciseType: input.take.config.type,
      configuration: comparableConfig(input.take.config),
      score: input.take.result.score,
    },
    metrics: {
      score: input.take.result.score,
      ...input.take.result.metrics,
    },
    metricsVersion: 1,
  })
}
