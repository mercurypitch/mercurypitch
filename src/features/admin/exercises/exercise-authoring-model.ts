import type { ZenExerciseDefinition, ZenExerciseTarget, } from '@/features/zen/types'

export type ExerciseTargetKind = 'note' | 'glide'

export type ExerciseTargetPatch = Partial<Omit<ZenExerciseTarget, 'id'>>

export interface CreateExerciseTargetOptions {
  atBeat?: number
  semitone?: number
  cue?: string
  durationBeats?: number
}

export const MIN_TARGET_DURATION_BEATS = 0.125
export const TIMELINE_SNAP_BEATS = 0.25

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value))

const finiteOr = (value: number | undefined, fallback: number): number =>
  value !== undefined && Number.isFinite(value) ? value : fallback

const orderedTargets = (
  targets: readonly ZenExerciseTarget[],
): ZenExerciseTarget[] =>
  [...targets].sort(
    (a, b) =>
      a.startBeat - b.startBeat ||
      a.semitone - b.semitone ||
      a.id.localeCompare(b.id),
  )

const nextTargetId = (
  targets: readonly ZenExerciseTarget[],
  prefix: ExerciseTargetKind,
): string => {
  const ids = new Set(targets.map((target) => target.id))
  let sequence = 1
  while (ids.has(`${prefix}-${sequence}`)) sequence += 1
  return `${prefix}-${sequence}`
}

const exerciseWithTargets = (
  exercise: ZenExerciseDefinition,
  targets: readonly ZenExerciseTarget[],
): ZenExerciseDefinition => ({
  ...exercise,
  targets: orderedTargets(targets),
})

const clampTiming = (
  exercise: ZenExerciseDefinition,
  startBeat: number,
  durationBeats: number,
): Pick<ZenExerciseTarget, 'startBeat' | 'durationBeats'> => {
  const loopBeats = Math.max(
    MIN_TARGET_DURATION_BEATS,
    finiteOr(exercise.loopBeats, MIN_TARGET_DURATION_BEATS),
  )
  const duration = clamp(
    finiteOr(durationBeats, MIN_TARGET_DURATION_BEATS),
    MIN_TARGET_DURATION_BEATS,
    loopBeats,
  )
  return {
    startBeat: clamp(finiteOr(startBeat, 0), 0, loopBeats - duration),
    durationBeats: duration,
  }
}

const insertionBeat = (
  exercise: ZenExerciseDefinition,
  durationBeats: number,
): number => {
  const latestEnd = exercise.targets.reduce(
    (latest, target) =>
      Math.max(latest, target.startBeat + target.durationBeats),
    0,
  )
  return Math.min(latestEnd, Math.max(0, exercise.loopBeats - durationBeats))
}

export function exerciseTargetKind(
  target: ZenExerciseTarget,
): ExerciseTargetKind {
  return target.endSemitone === undefined ? 'note' : 'glide'
}

export function findExerciseTarget(
  exercise: ZenExerciseDefinition,
  targetId: string | null | undefined,
): ZenExerciseTarget | null {
  if (targetId === null || targetId === undefined) return null
  return exercise.targets.find((target) => target.id === targetId) ?? null
}

export function createNoteTarget(
  exercise: ZenExerciseDefinition,
  options: CreateExerciseTargetOptions = {},
): ZenExerciseDefinition {
  const durationBeats = clamp(
    finiteOr(options.durationBeats, 1),
    MIN_TARGET_DURATION_BEATS,
    Math.max(MIN_TARGET_DURATION_BEATS, exercise.loopBeats),
  )
  const timing = clampTiming(
    exercise,
    finiteOr(options.atBeat, insertionBeat(exercise, durationBeats)),
    durationBeats,
  )
  const target: ZenExerciseTarget = {
    id: nextTargetId(exercise.targets, 'note'),
    ...timing,
    semitone: Math.round(finiteOr(options.semitone, 0)),
    cue: options.cue ?? 'Ah',
    showCue: true,
  }
  return exerciseWithTargets(exercise, [...exercise.targets, target])
}

export function createGlideTarget(
  exercise: ZenExerciseDefinition,
  options: CreateExerciseTargetOptions = {},
): ZenExerciseDefinition {
  const durationBeats = clamp(
    finiteOr(options.durationBeats, 2),
    MIN_TARGET_DURATION_BEATS,
    Math.max(MIN_TARGET_DURATION_BEATS, exercise.loopBeats),
  )
  const semitone = Math.round(finiteOr(options.semitone, 0))
  const timing = clampTiming(
    exercise,
    finiteOr(options.atBeat, insertionBeat(exercise, durationBeats)),
    durationBeats,
  )
  const target: ZenExerciseTarget = {
    id: nextTargetId(exercise.targets, 'glide'),
    ...timing,
    semitone,
    endSemitone: semitone + 5,
    cue: options.cue ?? 'Noo',
    showCue: true,
  }
  return exerciseWithTargets(exercise, [...exercise.targets, target])
}

export function updateExerciseTarget(
  exercise: ZenExerciseDefinition,
  targetId: string,
  patch: ExerciseTargetPatch,
): ZenExerciseDefinition {
  const targets = exercise.targets.map((target) => {
    if (target.id !== targetId) return target
    let next: ZenExerciseTarget = { ...target, ...patch }
    if ('startBeat' in patch || 'durationBeats' in patch) {
      next = {
        ...next,
        ...clampTiming(exercise, next.startBeat, next.durationBeats),
      }
    }
    if ('semitone' in patch) {
      next = { ...next, semitone: Math.round(next.semitone) }
    }
    if ('endSemitone' in patch && typeof next.endSemitone === 'number') {
      next = { ...next, endSemitone: Math.round(next.endSemitone) }
    }
    return next
  })
  return exerciseWithTargets(exercise, targets)
}

export function removeExerciseTarget(
  exercise: ZenExerciseDefinition,
  targetId: string,
): ZenExerciseDefinition {
  return exerciseWithTargets(
    exercise,
    exercise.targets.filter((target) => target.id !== targetId),
  )
}

export function duplicateExerciseTarget(
  exercise: ZenExerciseDefinition,
  targetId: string,
): ZenExerciseDefinition {
  const target = findExerciseTarget(exercise, targetId)
  if (target === null) return exercise
  const kind = exerciseTargetKind(target)
  const timing = clampTiming(
    exercise,
    target.startBeat + target.durationBeats,
    target.durationBeats,
  )
  const duplicate: ZenExerciseTarget = {
    ...target,
    ...timing,
    id: nextTargetId(exercise.targets, kind),
  }
  return exerciseWithTargets(exercise, [...exercise.targets, duplicate])
}

export function convertExerciseTarget(
  exercise: ZenExerciseDefinition,
  targetId: string,
  kind: ExerciseTargetKind,
): ZenExerciseDefinition {
  const target = findExerciseTarget(exercise, targetId)
  if (target === null || exerciseTargetKind(target) === kind) return exercise
  if (kind === 'glide') {
    return updateExerciseTarget(exercise, targetId, {
      endSemitone: target.semitone + 5,
    })
  }
  const note = { ...target }
  delete note.endSemitone
  return exerciseWithTargets(
    exercise,
    exercise.targets.map((candidate) =>
      candidate.id === targetId ? note : candidate,
    ),
  )
}

export function moveExerciseTarget(
  exercise: ZenExerciseDefinition,
  targetId: string,
  deltaBeat: number,
  deltaSemitone: number,
): ZenExerciseDefinition {
  const target = findExerciseTarget(exercise, targetId)
  if (target === null) return exercise
  return updateExerciseTarget(exercise, targetId, {
    startBeat: target.startBeat + deltaBeat,
    semitone: target.semitone + deltaSemitone,
    ...(target.endSemitone === undefined
      ? {}
      : { endSemitone: target.endSemitone + deltaSemitone }),
  })
}

export function resizeExerciseTarget(
  exercise: ZenExerciseDefinition,
  targetId: string,
  edge: 'start' | 'end',
  beat: number,
  semitone?: number,
): ZenExerciseDefinition {
  const target = findExerciseTarget(exercise, targetId)
  if (target === null) return exercise
  const targetEnd = target.startBeat + target.durationBeats
  if (edge === 'start') {
    const nextStart = clamp(beat, 0, targetEnd - MIN_TARGET_DURATION_BEATS)
    return updateExerciseTarget(exercise, targetId, {
      startBeat: nextStart,
      durationBeats: targetEnd - nextStart,
      ...(semitone === undefined ? {} : { semitone }),
    })
  }
  return updateExerciseTarget(exercise, targetId, {
    durationBeats: Math.max(MIN_TARGET_DURATION_BEATS, beat - target.startBeat),
    ...(target.endSemitone === undefined || semitone === undefined
      ? {}
      : { endSemitone: semitone }),
  })
}

export function snapTimelineBeat(beat: number): number {
  return Math.round(beat / TIMELINE_SNAP_BEATS) * TIMELINE_SNAP_BEATS
}
