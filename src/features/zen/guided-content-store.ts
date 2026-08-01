import { createSignal } from 'solid-js'
import { ASCENT_ID, ASCENT_WEEKS, DAYS_PER_WEEK, } from '@/features/path/path-content'
import { getZenExercise, installPublishedZenExercises, installPublishedZenExerciseVersion, restoreSeedZenExercises, } from './exercise-catalog'
import type { GuidedPathAssignment } from './guided-exercise-service'
import { getPublishedGuidedExercise, listGuidedPathAssignments, listPublishedGuidedExercises, } from './guided-exercise-service'

export type GuidedContentLoadState = 'idle' | 'loading' | 'ready' | 'fallback'

export interface GuidedContentRefreshResult {
  catalogueUpdated: boolean
  assignmentsUpdated: boolean
  complete: boolean
}

const MAX_SLOT_NUMBER = 99
const EXERCISE_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

const [ascentAssignments, setAscentAssignments] = createSignal<
  readonly GuidedPathAssignment[]
>([])
const [loadState, setLoadState] = createSignal<GuidedContentLoadState>('idle')

let inFlight: Promise<GuidedContentRefreshResult> | null = null
let hasCompleteRefresh = false
let lastResult: GuidedContentRefreshResult = {
  catalogueUpdated: false,
  assignmentsUpdated: false,
  complete: false,
}

export function guidedContentLoadState(): GuidedContentLoadState {
  return loadState()
}

export function ascentGuidedAssignments(): readonly GuidedPathAssignment[] {
  return ascentAssignments()
}

export function ascentGuidedAssignmentsForWeek(
  weekNumber: number,
): readonly GuidedPathAssignment[] {
  return ascentAssignments().filter(
    (assignment) => assignment.weekNumber === weekNumber,
  )
}

function isIntegerInRange(
  value: unknown,
  minimum: number,
  maximum: number,
): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= minimum &&
    value <= maximum
  )
}

function isValidAssignment(input: unknown): input is GuidedPathAssignment {
  if (typeof input !== 'object' || input === null) return false
  const assignment = input as Partial<GuidedPathAssignment>
  return (
    typeof assignment.id === 'string' &&
    assignment.id.trim() !== '' &&
    typeof assignment.createdAt === 'string' &&
    assignment.createdAt.trim() !== '' &&
    typeof assignment.updatedAt === 'string' &&
    assignment.updatedAt.trim() !== '' &&
    assignment.pathId === ASCENT_ID &&
    isIntegerInRange(assignment.weekNumber, 1, ASCENT_WEEKS.length) &&
    isIntegerInRange(assignment.dayNumber, 0, DAYS_PER_WEEK) &&
    isIntegerInRange(assignment.slotNumber, 1, MAX_SLOT_NUMBER) &&
    typeof assignment.exerciseId === 'string' &&
    EXERCISE_ID_PATTERN.test(assignment.exerciseId) &&
    isIntegerInRange(assignment.exerciseVersion, 1, Number.MAX_SAFE_INTEGER)
  )
}

function validateAndOrderAssignments(
  input: unknown,
): GuidedPathAssignment[] | null {
  if (!Array.isArray(input)) return null

  const ids = new Set<string>()
  const slots = new Set<string>()
  const assignments: GuidedPathAssignment[] = []

  for (const candidate of input) {
    if (!isValidAssignment(candidate) || ids.has(candidate.id)) return null

    const slot = `${candidate.weekNumber}:${candidate.dayNumber}:${candidate.slotNumber}`
    if (slots.has(slot)) return null

    ids.add(candidate.id)
    slots.add(slot)
    assignments.push(candidate)
  }

  return assignments.sort(
    (left, right) =>
      left.weekNumber - right.weekNumber ||
      left.dayNumber - right.dayNumber ||
      left.slotNumber - right.slotNumber ||
      left.id.localeCompare(right.id),
  )
}

async function resolvePinnedAssignments(
  input: unknown,
): Promise<GuidedPathAssignment[] | null> {
  const assignments = validateAndOrderAssignments(input)
  if (assignments === null || assignments.length === 0) return assignments

  const references = new Map<
    string,
    { exerciseId: string; exerciseVersion: number }
  >()
  for (const assignment of assignments) {
    references.set(`${assignment.exerciseId}@${assignment.exerciseVersion}`, {
      exerciseId: assignment.exerciseId,
      exerciseVersion: assignment.exerciseVersion,
    })
  }

  const exactVersions = await Promise.all(
    [...references.values()].map(async ({ exerciseId, exerciseVersion }) => {
      const exercise = await getPublishedGuidedExercise(
        exerciseId,
        exerciseVersion,
      )
      if (
        exercise === null ||
        exercise.id !== exerciseId ||
        exercise.version !== exerciseVersion
      ) {
        return null
      }
      return exercise
    }),
  )

  if (exactVersions.some((exercise) => exercise === null)) return null
  for (const exercise of exactVersions) {
    if (
      exercise === null ||
      !installPublishedZenExerciseVersion(exercise) ||
      getZenExercise(exercise.id, exercise.version) === null
    ) {
      return null
    }
  }

  return assignments
}

async function performRefresh(): Promise<GuidedContentRefreshResult> {
  setLoadState('loading')

  try {
    const [publishedExercises, assignmentResult] = await Promise.all([
      listPublishedGuidedExercises(),
      listGuidedPathAssignments(ASCENT_ID),
    ])

    let catalogueUpdated = false
    if (publishedExercises !== null) {
      if (publishedExercises.length === 0) {
        restoreSeedZenExercises()
        catalogueUpdated = true
      } else {
        catalogueUpdated = installPublishedZenExercises(publishedExercises)
      }
    }
    const catalogueSafe = publishedExercises !== null && catalogueUpdated

    const resolvedAssignments = assignmentResult.ok
      ? await resolvePinnedAssignments(assignmentResult.data)
      : null
    const assignmentsUpdated = resolvedAssignments !== null
    if (resolvedAssignments !== null) {
      setAscentAssignments(resolvedAssignments)
    }

    const result = {
      catalogueUpdated,
      assignmentsUpdated,
      complete: catalogueSafe && assignmentsUpdated,
    }
    lastResult = result
    hasCompleteRefresh = result.complete
    setLoadState(result.complete ? 'ready' : 'fallback')
    return result
  } catch {
    const result = {
      catalogueUpdated: false,
      assignmentsUpdated: false,
      complete: false,
    }
    lastResult = result
    hasCompleteRefresh = false
    setLoadState('fallback')
    return result
  }
}

/**
 * Hydrate published Zen content once per app session. Concurrent callers share
 * one request; `force` is reserved for the admin studio after publication.
 */
export function refreshGuidedContent(
  force = false,
): Promise<GuidedContentRefreshResult> {
  if (inFlight !== null) return inFlight
  if (hasCompleteRefresh && !force) return Promise.resolve(lastResult)

  const request = performRefresh().finally(() => {
    if (inFlight === request) inFlight = null
  })
  inFlight = request
  return request
}

/** Reset module state for isolated tests and explicit sign-out boundaries. */
export function resetGuidedContent(): void {
  inFlight = null
  hasCompleteRefresh = false
  lastResult = {
    catalogueUpdated: false,
    assignmentsUpdated: false,
    complete: false,
  }
  setAscentAssignments([])
  setLoadState('idle')
}
