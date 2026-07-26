import { z } from 'zod'
import type { ZenExerciseDefinition } from './types'

export interface ZenExerciseValidationIssue {
  path: string
  message: string
}

const zenExerciseTargetSchema = z
  .object({
    id: z.string(),
    startBeat: z.number(),
    durationBeats: z.number(),
    semitone: z.number(),
    endSemitone: z.number().optional(),
    cue: z.string(),
    showCue: z.boolean().optional(),
  })
  .strict()

const zenExampleAudioSchema = z
  .object({
    src: z.string(),
    durationMs: z.number(),
    locale: z.literal('en-GB'),
    source: z.enum(['coach', 'generated', 'imported']),
    transcript: z.string(),
  })
  .strict()

const zenScoringSchema = z
  .object({
    pitchWeight: z.number(),
    coverageWeight: z.number(),
    steadinessWeight: z.number(),
    toleranceCents: z.number(),
  })
  .strict()

/**
 * Structural runtime parser used at every trust boundary: published catalogue
 * responses, Admin draft payloads, and the DB worker publishing endpoint.
 * Semantic publishing rules remain in validateZenExercise below.
 */
export const zenExerciseDefinitionV1Schema = z
  .object({
    id: z.string(),
    version: z.number(),
    title: z.string(),
    category: z.enum(['range', 'agility', 'scales', 'tone', 'articulation']),
    level: z.enum(['foundation', 'developing', 'advanced']),
    summary: z.string(),
    goal: z.string(),
    instructions: z.string(),
    safetyNote: z.string().optional(),
    pronunciationHint: z.string().optional(),
    bpm: z.number(),
    countInBeats: z.number(),
    loopBeats: z.number(),
    defaultRootMidi: z.number(),
    targets: z.array(zenExerciseTargetSchema),
    defaultTargetVisibility: z.enum(['off', 'dim', 'on']),
    defaultProgressCue: z.enum(['none', 'playhead']),
    scoring: zenScoringSchema,
    exampleAudio: zenExampleAudioSchema.optional(),
  })
  .strict()

export const ZEN_EXERCISE_SCHEMA_VERSION = 1
export const zenExerciseDefinitionSchema = zenExerciseDefinitionV1Schema

export interface ZenExerciseParseResult {
  exercise: ZenExerciseDefinition | null
  issues: ZenExerciseValidationIssue[]
}

/**
 * Parse the complete editor shape without requiring it to be publishable yet.
 * Drafts may keep semantic validation issues (for example unfinished copy),
 * but malformed or partial objects still never enter the editor.
 */
export function parseZenExerciseStructure(
  input: unknown,
): ZenExerciseParseResult {
  const parsed = zenExerciseDefinitionSchema.safeParse(input)
  if (!parsed.success) {
    return {
      exercise: null,
      issues: parsed.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    }
  }
  const exercise = parsed.data as ZenExerciseDefinition
  return { exercise, issues: validateZenExercise(exercise) }
}

export function parseZenExercise(input: unknown): ZenExerciseParseResult {
  return parseZenExerciseVersion(input, ZEN_EXERCISE_SCHEMA_VERSION)
}

/**
 * Decode an immutable published revision with the validator that belonged to
 * its stored schema version. New editorial rules must add a new decoder rather
 * than changing the meaning of historical v1 Ascent assignments.
 */
export function parseZenExerciseVersion(
  input: unknown,
  schemaVersion: number,
): ZenExerciseParseResult {
  if (schemaVersion !== 1) {
    return {
      exercise: null,
      issues: [
        {
          path: 'schemaVersion',
          message: `Unsupported exercise schema version ${schemaVersion}.`,
        },
      ],
    }
  }
  const structured = zenExerciseDefinitionV1Schema.safeParse(input)
  if (!structured.success) {
    return {
      exercise: null,
      issues: structured.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    }
  }
  const exercise = structured.data as ZenExerciseDefinition
  const issues = validateZenExerciseV1(exercise)
  return {
    exercise: issues.length === 0 ? exercise : null,
    issues,
  }
}

/**
 * Frozen version-one validation shared by local seeds, Admin publishing, and
 * immutable historical reads. Authored JSON is rejected before the canvas.
 */
export function validateZenExerciseV1(
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
  if (exercise.title.trim().length > 80) {
    add('title', 'Keep the title to 80 characters or fewer.')
  }
  if (exercise.summary.trim() === '') add('summary', 'Summary is required.')
  if (exercise.summary.trim().length > 180) {
    add('summary', 'Keep the summary to 180 characters or fewer.')
  }
  if (exercise.goal.trim() === '') add('goal', 'Goal is required.')
  if (exercise.instructions.trim() === '') {
    add('instructions', 'Singing instructions are required.')
  }
  if (exercise.instructions.trim().length > 1200) {
    add('instructions', 'Keep instructions to 1,200 characters or fewer.')
  }
  if (
    !Number.isInteger(exercise.bpm) ||
    exercise.bpm < 40 ||
    exercise.bpm > 240
  ) {
    add('bpm', 'Tempo must be a whole number between 40 and 240 BPM.')
  }
  if (
    !Number.isInteger(exercise.countInBeats) ||
    exercise.countInBeats < 0 ||
    exercise.countInBeats > 16
  ) {
    add('countInBeats', 'Count-in must be a whole number from 0 to 16.')
  }
  if (
    !Number.isFinite(exercise.loopBeats) ||
    exercise.loopBeats <= 0 ||
    exercise.loopBeats > 128
  ) {
    add('loopBeats', 'Loop length must be between 1 and 128 beats.')
  } else {
    const durationSec = (exercise.loopBeats * 60) / exercise.bpm
    if (durationSec < 2 || durationSec > 60) {
      add(
        'loopBeats',
        'The resolved loop duration must be between 2 and 60 seconds.',
      )
    }
  }
  if (
    !Number.isInteger(exercise.defaultRootMidi) ||
    exercise.defaultRootMidi < 24 ||
    exercise.defaultRootMidi > 96
  ) {
    add('defaultRootMidi', 'Default root must be a MIDI note from 24 to 96.')
  }
  if (exercise.targets.length === 0) {
    add('targets', 'At least one note or glide is required.')
  }
  if (exercise.targets.length > 128) {
    add('targets', 'An exercise can contain at most 128 targets.')
  }

  const targetIds = new Set<string>()
  const orderedTargets = [...exercise.targets].sort(
    (a, b) => a.startBeat - b.startBeat,
  )
  exercise.targets.forEach((target, index) => {
    const path = `targets.${index}`
    if (targetIds.has(target.id))
      add(`${path}.id`, 'Target IDs must be unique.')
    targetIds.add(target.id)
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(target.id)) {
      add(`${path}.id`, 'Use a stable lowercase target slug.')
    }
    if (!Number.isFinite(target.startBeat) || target.startBeat < 0) {
      add(`${path}.startBeat`, 'Start beat must be zero or greater.')
    }
    if (
      !Number.isFinite(target.durationBeats) ||
      target.durationBeats < 0.125
    ) {
      add(
        `${path}.durationBeats`,
        'Duration must be at least one eighth of a beat.',
      )
    }
    if (target.startBeat + target.durationBeats > exercise.loopBeats) {
      add(`${path}.durationBeats`, 'Target extends beyond the loop.')
    }
    if (!Number.isFinite(target.semitone)) {
      add(`${path}.semitone`, 'Pitch offset must be finite.')
    } else if (target.semitone < -48 || target.semitone > 48) {
      add(`${path}.semitone`, 'Pitch offset must stay within four octaves.')
    } else if (
      exercise.defaultRootMidi + target.semitone < 0 ||
      exercise.defaultRootMidi + target.semitone > 127
    ) {
      add(
        `${path}.semitone`,
        'Resolved pitch must stay inside the MIDI note range.',
      )
    }
    if (
      target.endSemitone !== undefined &&
      !Number.isFinite(target.endSemitone)
    ) {
      add(`${path}.endSemitone`, 'Glide destination must be finite.')
    } else if (
      target.endSemitone !== undefined &&
      (target.endSemitone < -48 || target.endSemitone > 48)
    ) {
      add(
        `${path}.endSemitone`,
        'Glide destination must stay within four octaves.',
      )
    } else if (
      target.endSemitone !== undefined &&
      (exercise.defaultRootMidi + target.endSemitone < 0 ||
        exercise.defaultRootMidi + target.endSemitone > 127)
    ) {
      add(
        `${path}.endSemitone`,
        'Resolved glide destination must stay inside the MIDI note range.',
      )
    }
    if (target.cue.trim() === '') add(`${path}.cue`, 'Visible cue is required.')
    if (target.cue.trim().length > 32) {
      add(`${path}.cue`, 'Visible cue must be 32 characters or fewer.')
    }
  })
  orderedTargets.forEach((target, index) => {
    if (index === 0) return
    const previous = orderedTargets[index - 1]!
    if (target.startBeat < previous.startBeat + previous.durationBeats) {
      const originalIndex = exercise.targets.indexOf(target)
      add(
        `targets.${originalIndex}.startBeat`,
        'Targets cannot overlap in a monophonic exercise.',
      )
    }
  })

  const scoring = exercise.scoring
  if (
    [
      scoring.pitchWeight,
      scoring.coverageWeight,
      scoring.steadinessWeight,
    ].some((weight) => !Number.isFinite(weight) || weight < 0 || weight > 1)
  ) {
    add('scoring', 'Scoring weights must each be between zero and one.')
  }
  if (
    scoring.pitchWeight + scoring.coverageWeight + scoring.steadinessWeight <=
    0
  ) {
    add('scoring', 'At least one scoring weight must be greater than zero.')
  }
  if (
    !Number.isFinite(scoring.toleranceCents) ||
    scoring.toleranceCents < 10 ||
    scoring.toleranceCents > 600
  ) {
    add(
      'scoring.toleranceCents',
      'Pitch tolerance must be between 10 and 600 cents.',
    )
  }

  const audio = exercise.exampleAudio
  if (audio !== undefined) {
    if (audio.locale !== 'en-GB') {
      add('exampleAudio.locale', 'The current catalogue locale is en-GB.')
    }
    if (!Number.isFinite(audio.durationMs) || audio.durationMs <= 0) {
      add('exampleAudio.durationMs', 'Example duration must be positive.')
    } else if (audio.durationMs > 15_000) {
      add(
        'exampleAudio.durationMs',
        'Example audio must be 15 seconds or shorter.',
      )
    }
    if (audio.src.trim() === '')
      add('exampleAudio.src', 'Audio source is required.')
    if (audio.transcript.trim() === '') {
      add('exampleAudio.transcript', 'Audio transcript is required.')
    }
  }

  return issues
}

/** Current authoring validator. It intentionally aliases the latest schema
 * while `validateZenExerciseV1` remains frozen for historical publications. */
export function validateZenExercise(
  exercise: ZenExerciseDefinition,
): ZenExerciseValidationIssue[] {
  return validateZenExerciseV1(exercise)
}
