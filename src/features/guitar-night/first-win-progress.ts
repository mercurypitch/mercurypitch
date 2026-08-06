// Guitar Night first-win progress keeps the versioned beginner handoff local and resumable.
// ============================================================

import type { GuitarFirstWinConfigV1, GuitarFirstWinInputKind, } from './first-win-config'

export type GuitarFirstWinProgressV1 = {
  schemaVersion: 1
  flowVersion: 'first-win-v1'
  configVersion: string
  status: 'not-started' | 'in-progress' | 'completed' | 'skipped'
  currentStepId: string | null
  attemptsByStep: Record<string, number>
  bestAbsoluteTimingMsByStep: Record<string, number>
  lastInputKind: GuitarFirstWinInputKind | null
  tuningMidiHighToLow: [number, number, number, number, number, number]
  handedness: 'right' | 'left' | null
  tabFamiliarity: 'new' | 'some' | 'comfortable' | null
  completedAt: string | null
  skippedAt: string | null
}

export const GUITAR_FIRST_WIN_PROGRESS_KEY =
  'mercurypitch:guitar-night:first-win:v1'

function createProgress(
  config: GuitarFirstWinConfigV1,
): GuitarFirstWinProgressV1 {
  return {
    schemaVersion: 1,
    flowVersion: 'first-win-v1',
    configVersion: config.configVersion,
    status: 'not-started',
    currentStepId: config.exerciseSteps[0]?.id ?? null,
    attemptsByStep: {},
    bestAbsoluteTimingMsByStep: {},
    lastInputKind: null,
    tuningMidiHighToLow: [...config.tuningMidiHighToLow],
    handedness: null,
    tabFamiliarity: null,
    completedAt: null,
    skippedAt: null,
  }
}

function isProgress(value: unknown): value is GuitarFirstWinProgressV1 {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Partial<GuitarFirstWinProgressV1>
  return record.schemaVersion === 1 && record.flowVersion === 'first-win-v1'
}

export function readGuitarFirstWinProgress(
  config: GuitarFirstWinConfigV1,
): GuitarFirstWinProgressV1 {
  const fallback = createProgress(config)
  try {
    const value = localStorage.getItem(GUITAR_FIRST_WIN_PROGRESS_KEY)
    if (value === null) return fallback
    const parsed: unknown = JSON.parse(value)
    if (!isProgress(parsed)) return fallback
    const availableSteps = new Set(config.exerciseSteps.map((step) => step.id))
    return {
      ...fallback,
      ...parsed,
      configVersion: config.configVersion,
      currentStepId:
        parsed.currentStepId !== null &&
        availableSteps.has(parsed.currentStepId)
          ? parsed.currentStepId
          : fallback.currentStepId,
      tuningMidiHighToLow: Array.isArray(parsed.tuningMidiHighToLow)
        ? [...parsed.tuningMidiHighToLow]
        : fallback.tuningMidiHighToLow,
    }
  } catch {
    return fallback
  }
}

export function writeGuitarFirstWinProgress(
  progress: GuitarFirstWinProgressV1,
): void {
  try {
    localStorage.setItem(
      GUITAR_FIRST_WIN_PROGRESS_KEY,
      JSON.stringify(progress),
    )
  } catch {
    // Private browsing or full storage must not block the playable lesson.
  }
}

export function recordGuitarFirstWinAttempt(
  progress: GuitarFirstWinProgressV1,
  stepId: string,
  inputKind: GuitarFirstWinInputKind,
  absoluteTimingMs: number | null,
): GuitarFirstWinProgressV1 {
  const best = progress.bestAbsoluteTimingMsByStep[stepId]
  const nextBest =
    absoluteTimingMs === null
      ? progress.bestAbsoluteTimingMsByStep
      : {
          ...progress.bestAbsoluteTimingMsByStep,
          [stepId]: Math.min(
            best ?? Number.POSITIVE_INFINITY,
            absoluteTimingMs,
          ),
        }
  return {
    ...progress,
    status: 'in-progress',
    currentStepId: stepId,
    attemptsByStep: {
      ...progress.attemptsByStep,
      [stepId]: (progress.attemptsByStep[stepId] ?? 0) + 1,
    },
    bestAbsoluteTimingMsByStep: nextBest,
    lastInputKind: inputKind,
  }
}

export function completeGuitarFirstWinProgress(
  progress: GuitarFirstWinProgressV1,
): GuitarFirstWinProgressV1 {
  return {
    ...progress,
    status: 'completed',
    completedAt: new Date().toISOString(),
    skippedAt: null,
  }
}

export function skipGuitarFirstWinProgress(
  progress: GuitarFirstWinProgressV1,
): GuitarFirstWinProgressV1 {
  return {
    ...progress,
    status: 'skipped',
    skippedAt: new Date().toISOString(),
  }
}
