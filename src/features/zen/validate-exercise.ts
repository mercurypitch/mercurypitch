import type { ZenExerciseDefinition } from './types'

export interface ZenExerciseValidationIssue {
  path: string
  message: string
}

/**
 * Runtime validation shared by local seeds and the future Admin publishing
 * endpoint. Authored JSON must be rejected before it reaches the canvas.
 */
export function validateZenExercise(
  exercise: ZenExerciseDefinition,
): ZenExerciseValidationIssue[] {
  const issues: ZenExerciseValidationIssue[] = []
  const add = (path: string, message: string): void => {
    issues.push({ path, message })
  }

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(exercise.id)) {
    add('id', 'Use a stable lowercase slug.')
  }
  if (!Number.isInteger(exercise.version) || exercise.version < 1) {
    add('version', 'Version must be a positive integer.')
  }
  if (exercise.title.trim() === '') add('title', 'Title is required.')
  if (exercise.instructions.trim() === '') {
    add('instructions', 'Singing instructions are required.')
  }
  if (
    !Number.isFinite(exercise.bpm) ||
    exercise.bpm < 40 ||
    exercise.bpm > 240
  ) {
    add('bpm', 'Tempo must be between 40 and 240 BPM.')
  }
  if (!Number.isFinite(exercise.loopBeats) || exercise.loopBeats <= 0) {
    add('loopBeats', 'Loop length must be greater than zero.')
  }
  if (exercise.targets.length === 0) {
    add('targets', 'At least one note or glide is required.')
  }

  const targetIds = new Set<string>()
  exercise.targets.forEach((target, index) => {
    const path = `targets.${index}`
    if (targetIds.has(target.id))
      add(`${path}.id`, 'Target IDs must be unique.')
    targetIds.add(target.id)
    if (!Number.isFinite(target.startBeat) || target.startBeat < 0) {
      add(`${path}.startBeat`, 'Start beat must be zero or greater.')
    }
    if (!Number.isFinite(target.durationBeats) || target.durationBeats <= 0) {
      add(`${path}.durationBeats`, 'Duration must be greater than zero.')
    }
    if (target.startBeat + target.durationBeats > exercise.loopBeats) {
      add(`${path}.durationBeats`, 'Target extends beyond the loop.')
    }
    if (!Number.isFinite(target.semitone)) {
      add(`${path}.semitone`, 'Pitch offset must be finite.')
    }
    if (
      target.endSemitone !== undefined &&
      !Number.isFinite(target.endSemitone)
    ) {
      add(`${path}.endSemitone`, 'Glide destination must be finite.')
    }
    if (target.cue.trim() === '') add(`${path}.cue`, 'Visible cue is required.')
  })

  const scoring = exercise.scoring
  if (
    [
      scoring.pitchWeight,
      scoring.coverageWeight,
      scoring.steadinessWeight,
    ].some((weight) => !Number.isFinite(weight) || weight < 0)
  ) {
    add('scoring', 'Scoring weights must be finite and non-negative.')
  }
  if (!Number.isFinite(scoring.toleranceCents) || scoring.toleranceCents <= 0) {
    add('scoring.toleranceCents', 'Pitch tolerance must be greater than zero.')
  }

  const audio = exercise.exampleAudio
  if (audio !== undefined) {
    if (audio.locale !== 'en-GB') {
      add('exampleAudio.locale', 'The current catalogue locale is en-GB.')
    }
    if (!Number.isFinite(audio.durationMs) || audio.durationMs <= 0) {
      add('exampleAudio.durationMs', 'Example duration must be positive.')
    }
  }

  return issues
}
