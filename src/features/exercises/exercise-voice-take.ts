// ============================================================
// Exercise Voice Take — stable context and local keep adapter
// ============================================================

import type { SaveVoiceTakeResult } from '@/db/services/voice-take-service'
import { saveVoiceTake } from '@/db/services/voice-take-service'
import { EXERCISE_SING_IN_TIME, EXERCISE_VIBRATO, EXERCISE_WARMUP, } from '@/lib/domain/exercise-contracts'
import type { ExerciseConfig } from './types'
import type { ExerciseSessionVoiceTake } from './use-base-exercise'
import { VIBRATO_STYLES } from './vibrato/vibrato-styles'
import { WARMUP_PATTERN_LABELS } from './warmup/warmup-steps'

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

/**
 * A drill's pattern is its own value for the variant it ran (`level:5`,
 * `lip-trill`). It keys the thread; the title says it in the words the
 * drill's own picker uses. A pattern with no such words stays out of the
 * title rather than show its internal value.
 */
function patternLabel(config: ExerciseConfig): string | null {
  const pattern = config.pattern
  if (pattern === undefined || pattern === '') return null
  switch (config.type) {
    case EXERCISE_SING_IN_TIME: {
      const level = /^level:(\d+)$/.exec(pattern)
      return level === null ? null : `Level ${level[1]}`
    }
    case EXERCISE_VIBRATO:
      return Object.hasOwn(VIBRATO_STYLES, pattern)
        ? VIBRATO_STYLES[pattern as keyof typeof VIBRATO_STYLES].label
        : null
    case EXERCISE_WARMUP:
      return Object.hasOwn(WARMUP_PATTERN_LABELS, pattern)
        ? WARMUP_PATTERN_LABELS[pattern as keyof typeof WARMUP_PATTERN_LABELS]
        : null
    default:
      return null
  }
}

/** The note or notes first, then the variant: two Vibrato styles on one
 *  note are two threads, and their titles say which is which. */
export function exerciseThreadTitle(
  exerciseTitle: string,
  config: ExerciseConfig,
): string {
  const parts = [exerciseTitle]
  if (config.targetNotes !== undefined && config.targetNotes.length > 0) {
    const first = config.targetNotes[0]!
    const last = config.targetNotes.at(-1)!
    parts.push(first === last ? first : `${first} to ${last}`)
  } else if (config.targetNote !== undefined && config.targetNote !== '') {
    parts.push(config.targetNote)
  }
  const label = patternLabel(config)
  if (label !== null) parts.push(label)
  return parts.join(' · ')
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
