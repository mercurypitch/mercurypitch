// Guitar Night first-win progress keeps the versioned beginner handoff local and resumable.
// ============================================================

import type { GuitarFirstWinConfigV1, GuitarFirstWinInputKind, } from './first-win-config'

export type GuitarFirstWinProgressV1 = {
  schemaVersion: 1
  flowVersion: 'first-win-v1'
  configVersion: string
  status: 'not-started' | 'in-progress' | 'completed' | 'skipped'
  currentStepId: string | null
  completedStepIds: string[]
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

type UnknownRecord = Record<string, unknown>

const STATUS_VALUES = new Set<GuitarFirstWinProgressV1['status']>([
  'not-started',
  'in-progress',
  'completed',
  'skipped',
])
const INPUT_VALUES = new Set<GuitarFirstWinInputKind>([
  'microphone',
  'midi',
  'keyboard',
  'touch',
])
const HANDEDNESS_VALUES = new Set<
  NonNullable<GuitarFirstWinProgressV1['handedness']>
>(['right', 'left'])
const TAB_FAMILIARITY_VALUES = new Set<
  NonNullable<GuitarFirstWinProgressV1['tabFamiliarity']>
>(['new', 'some', 'comfortable'])

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function createProgress(
  config: GuitarFirstWinConfigV1,
): GuitarFirstWinProgressV1 {
  return {
    schemaVersion: 1,
    flowVersion: 'first-win-v1',
    configVersion: config.configVersion,
    status: 'not-started',
    currentStepId: config.exerciseSteps[0]?.id ?? null,
    completedStepIds: [],
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

function safeNumberMap(
  value: unknown,
  integerOnly: boolean,
): Record<string, number> {
  if (!isRecord(value)) return {}
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, number] => {
      const candidate = entry[1]
      return (
        typeof candidate === 'number' &&
        Number.isFinite(candidate) &&
        candidate >= 0 &&
        (!integerOnly || Number.isInteger(candidate))
      )
    }),
  )
}

function safeTuning(
  value: unknown,
  fallback: GuitarFirstWinProgressV1['tuningMidiHighToLow'],
): GuitarFirstWinProgressV1['tuningMidiHighToLow'] {
  if (
    !Array.isArray(value) ||
    value.length !== 6 ||
    !value.every((midi) => Number.isInteger(midi) && midi >= 0 && midi <= 127)
  ) {
    return [...fallback]
  }
  return [...value] as GuitarFirstWinProgressV1['tuningMidiHighToLow']
}

function safeDate(value: unknown): string | null {
  return typeof value === 'string' && Number.isFinite(Date.parse(value))
    ? value
    : null
}

function safeNullableEnum<T extends string>(
  value: unknown,
  allowed: ReadonlySet<T>,
): T | null {
  return typeof value === 'string' && allowed.has(value as T)
    ? (value as T)
    : null
}

function isProgressEnvelope(value: unknown): value is UnknownRecord {
  return (
    isRecord(value) &&
    value.schemaVersion === 1 &&
    value.flowVersion === 'first-win-v1'
  )
}

export function readGuitarFirstWinProgress(
  config: GuitarFirstWinConfigV1,
): GuitarFirstWinProgressV1 {
  const fallback = createProgress(config)
  try {
    const value = localStorage.getItem(GUITAR_FIRST_WIN_PROGRESS_KEY)
    if (value === null) return fallback
    const parsed: unknown = JSON.parse(value)
    if (!isProgressEnvelope(parsed)) return fallback

    const stepIds = config.exerciseSteps.map((step) => step.id)
    const availableSteps = new Set(stepIds)
    const parsedStatus = safeNullableEnum(parsed.status, STATUS_VALUES)
    let status = parsedStatus ?? fallback.status
    const parsedCurrentStep =
      typeof parsed.currentStepId === 'string' &&
      availableSteps.has(parsed.currentStepId)
        ? parsed.currentStepId
        : null
    const storedCompletedStepIds = Array.isArray(parsed.completedStepIds)
      ? parsed.completedStepIds
      : null
    let completedStepIds = storedCompletedStepIds
      ? stepIds.filter((stepId) => storedCompletedStepIds.includes(stepId))
      : []

    // Records written before multi-step progression treated the first step as
    // the whole lesson. Promote those users to the first newly incomplete step.
    if (storedCompletedStepIds === null && status === 'completed') {
      const legacyCompleted = parsedCurrentStep ?? stepIds[0]
      completedStepIds = legacyCompleted === undefined ? [] : [legacyCompleted]
    }

    const firstIncomplete = stepIds.find(
      (stepId) => !completedStepIds.includes(stepId),
    )
    const attemptsByStep = safeNumberMap(parsed.attemptsByStep, true)
    let currentStepId =
      parsedCurrentStep ?? firstIncomplete ?? stepIds.at(-1) ?? null
    let completedAt = safeDate(parsed.completedAt)

    if (status === 'completed' && firstIncomplete !== undefined) {
      status = 'in-progress'
      currentStepId = firstIncomplete
      completedAt = null
    } else if (status !== 'skipped') {
      if (
        currentStepId === null ||
        (completedStepIds.includes(currentStepId) &&
          firstIncomplete !== undefined)
      ) {
        currentStepId = firstIncomplete ?? stepIds.at(-1) ?? null
      }
      if (firstIncomplete === undefined && stepIds.length > 0) {
        status = 'completed'
      }
    }
    if (
      status === 'not-started' &&
      (completedStepIds.length > 0 || Object.keys(attemptsByStep).length > 0)
    ) {
      status = 'in-progress'
    }

    return {
      ...fallback,
      configVersion: config.configVersion,
      status,
      currentStepId,
      completedStepIds,
      attemptsByStep,
      bestAbsoluteTimingMsByStep: safeNumberMap(
        parsed.bestAbsoluteTimingMsByStep,
        false,
      ),
      lastInputKind: safeNullableEnum(parsed.lastInputKind, INPUT_VALUES),
      tuningMidiHighToLow: safeTuning(
        parsed.tuningMidiHighToLow,
        fallback.tuningMidiHighToLow,
      ),
      handedness: safeNullableEnum(parsed.handedness, HANDEDNESS_VALUES),
      tabFamiliarity: safeNullableEnum(
        parsed.tabFamiliarity,
        TAB_FAMILIARITY_VALUES,
      ),
      completedAt,
      skippedAt: safeDate(parsed.skippedAt),
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
  const replayingCompletedFlow =
    progress.status === 'completed' &&
    progress.completedStepIds.includes(stepId)
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
    status: replayingCompletedFlow ? 'completed' : 'in-progress',
    currentStepId: stepId,
    attemptsByStep: {
      ...progress.attemptsByStep,
      [stepId]: (progress.attemptsByStep[stepId] ?? 0) + 1,
    },
    bestAbsoluteTimingMsByStep: nextBest,
    lastInputKind: inputKind,
    completedAt: replayingCompletedFlow ? progress.completedAt : null,
    skippedAt: null,
  }
}

export function completeGuitarFirstWinStep(
  progress: GuitarFirstWinProgressV1,
  config: GuitarFirstWinConfigV1,
  stepId: string,
): GuitarFirstWinProgressV1 {
  const stepIds = config.exerciseSteps.map((step) => step.id)
  if (!stepIds.includes(stepId)) return progress

  const completedStepIds = stepIds.filter(
    (candidate) =>
      candidate === stepId || progress.completedStepIds.includes(candidate),
  )
  const nextStepId = stepIds.find(
    (candidate) => !completedStepIds.includes(candidate),
  )

  return {
    ...progress,
    configVersion: config.configVersion,
    status: nextStepId === undefined ? 'completed' : 'in-progress',
    currentStepId: nextStepId ?? stepId,
    completedStepIds,
    completedAt: nextStepId === undefined ? new Date().toISOString() : null,
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
