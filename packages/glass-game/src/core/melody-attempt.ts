// Melody attempt resolution — validate lesson truth and bind one calibration to one save identity.

import type { LevelDefinition, MelodyAttemptConfiguration, MelodyAttemptIdentity, MelodyLessonDefinition, } from '../contracts'
import type { CompiledMelody } from './melody-contour'
import { compileMelody } from './melody-contour'
import { createMelodyJudge } from './melody-judge'
import { melodyJudgePolicyForTier } from './melody-policy'

export interface ResolvedMelodyAttempt {
  identity: MelodyAttemptIdentity
  lesson: MelodyLessonDefinition
  melody: CompiledMelody
}

const ATTEMPT_ID = /^[A-Za-z0-9](?:[A-Za-z0-9._:-]{0,127})$/

function contentRevision(level: LevelDefinition): number {
  return level.authored?.contentRevision ?? 1
}

function finiteMidi(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 127
}

function anchors(lesson: MelodyLessonDefinition) {
  return lesson.melody.phrases.flatMap((phrase) => phrase.anchors)
}

function withFirstVisitMelodyPolicy(
  lesson: MelodyLessonDefinition,
): MelodyLessonDefinition {
  return {
    ...lesson,
    judgePolicy: {
      ...melodyJudgePolicyForTier(1),
      ...lesson.judgePolicy,
    },
  }
}

/** Stable content identity; attempts differ without changing authored lesson truth. */
export function melodyChallengeSignature(level: LevelDefinition): string {
  const authoredLesson = level.melodyLesson
  if (authoredLesson === undefined) return ''
  const lesson = withFirstVisitMelodyPolicy(authoredLesson)
  const lessonEncounterIds = new Set([
    ...lesson.stations.map((station) => station.encounterId),
    lesson.finaleEncounterId,
  ])
  return JSON.stringify({
    contentRevision: contentRevision(level),
    lesson,
    challenges: level.breakables
      .filter((item) => lessonEncounterIds.has(item.id))
      .map((item) => [item.id, item.requiresCompleted ?? [], item.challenge]),
  })
}

export function melodyLessonError(level: LevelDefinition): string | undefined {
  const authoredLesson = level.melodyLesson
  if (authoredLesson === undefined) return undefined
  const lesson = withFirstVisitMelodyPolicy(authoredLesson)
  if (
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(lesson.id) ||
    !Number.isSafeInteger(lesson.revision) ||
    lesson.revision < 1 ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(lesson.referenceProfileId)
  )
    return 'Melody lesson IDs and revision must be stable and positive.'
  if (
    !Number.isFinite(lesson.comfortableOffsetSemitones) ||
    !Number.isFinite(lesson.defaultPace) ||
    lesson.defaultPace <= 0 ||
    lesson.allowedPaces.length === 0 ||
    lesson.allowedPaces.some((pace) => !Number.isFinite(pace) || pace <= 0) ||
    new Set(lesson.allowedPaces).size !== lesson.allowedPaces.length ||
    !lesson.allowedPaces.includes(lesson.defaultPace)
  )
    return 'Melody lesson calibration and pace values are invalid.'
  const range = lesson.allowedRange
  if (
    !finiteMidi(range.minimumMidi) ||
    !finiteMidi(range.maximumMidi) ||
    range.minimumMidi >= range.maximumMidi
  )
    return 'Melody lesson pitch range is invalid.'

  const orderedAnchors = anchors(lesson)
  if (
    orderedAnchors.length === 0 ||
    lesson.stations.length !== orderedAnchors.length
  )
    return 'Melody stations must map every melody anchor exactly once.'
  const encounterIds = new Set<string>()
  const anchorIds = new Set<string>()
  for (let index = 0; index < lesson.stations.length; index++) {
    const station = lesson.stations[index]!
    const expectedAnchor = orderedAnchors[index]!
    if (
      station.anchorId !== expectedAnchor.id ||
      encounterIds.has(station.encounterId) ||
      anchorIds.has(station.anchorId)
    )
      return 'Melody stations must follow the unique authored anchor order.'
    encounterIds.add(station.encounterId)
    anchorIds.add(station.anchorId)
    const encounter = level.breakables.find(
      (item) => item.id === station.encounterId,
    )
    if (
      encounter?.challenge.kind !== 'melody-anchor' ||
      encounter.challenge.lessonId !== lesson.id ||
      encounter.challenge.anchorId !== station.anchorId
    )
      return `Melody station ${station.encounterId} does not match its lesson anchor.`
  }
  if (encounterIds.has(lesson.finaleEncounterId))
    return 'Melody finale must be distinct from its anchor stations.'
  const finale = level.breakables.find(
    (item) => item.id === lesson.finaleEncounterId,
  )
  if (
    finale?.challenge.kind !== 'melody-contour' ||
    finale.challenge.lessonId !== lesson.id
  )
    return 'Melody finale does not match its lesson.'
  try {
    const offsets = orderedAnchors.map((anchor) => anchor.offsetSemitones)
    const sampleRoot =
      (range.minimumMidi +
        range.maximumMidi -
        Math.min(...offsets) -
        Math.max(...offsets)) /
      2
    for (const pace of lesson.allowedPaces) {
      const probe = compileMelody(lesson.melody, {
        rootMidi: sampleRoot,
        pace,
        allowedRange: range,
      })
      createMelodyJudge(probe, lesson.judgePolicy)
    }
  } catch (error) {
    return error instanceof Error ? error.message : 'Melody lesson is invalid.'
  }
  return undefined
}

export function resolveMelodyAttempt(
  level: LevelDefinition,
  configuration: MelodyAttemptConfiguration,
): ResolvedMelodyAttempt {
  const authoredLesson = level.melodyLesson
  if (authoredLesson === undefined)
    throw new Error('Level has no melody lesson.')
  const lesson = withFirstVisitMelodyPolicy(authoredLesson)
  const lessonError = melodyLessonError(level)
  if (lessonError !== undefined) throw new Error(lessonError)
  if (!ATTEMPT_ID.test(configuration.attemptId))
    throw new Error('Melody attempt ID is invalid.')
  if (!finiteMidi(configuration.comfortableMidi))
    throw new Error('Comfortable pitch must be a finite MIDI value.')
  const pace = configuration.pace ?? lesson.defaultPace
  if (!lesson.allowedPaces.includes(pace))
    throw new Error('Melody attempt pace is not allowed by this lesson.')
  const transposeSemitones = configuration.transposeSemitones ?? 0
  if (!Number.isSafeInteger(transposeSemitones))
    throw new Error('Melody transposition must be a whole number of semitones.')
  const rootMidi =
    configuration.comfortableMidi - lesson.comfortableOffsetSemitones
  if (!finiteMidi(rootMidi))
    throw new Error('Melody root falls outside the MIDI range.')
  const melody = compileMelody(lesson.melody, {
    rootMidi,
    transposeSemitones,
    pace,
    allowedRange: lesson.allowedRange,
  })
  // Validate the embedded policy together with the exact resolved contour.
  createMelodyJudge(melody, lesson.judgePolicy)
  return {
    lesson,
    melody,
    identity: {
      attemptId: configuration.attemptId,
      levelId: level.id,
      contentRevision: contentRevision(level),
      lessonId: lesson.id,
      lessonRevision: lesson.revision,
      melodyId: lesson.melody.id,
      melodyVersion: lesson.melody.version,
      comfortableMidi: configuration.comfortableMidi,
      rootMidi,
      pace,
      transposeSemitones,
      challengeSignature: melodyChallengeSignature(level),
    },
  }
}

export function sameMelodyAttempt(
  left: MelodyAttemptIdentity,
  right: MelodyAttemptIdentity,
): boolean {
  return (
    left.attemptId === right.attemptId &&
    left.levelId === right.levelId &&
    left.contentRevision === right.contentRevision &&
    left.lessonId === right.lessonId &&
    left.lessonRevision === right.lessonRevision &&
    left.melodyId === right.melodyId &&
    left.melodyVersion === right.melodyVersion &&
    left.comfortableMidi === right.comfortableMidi &&
    left.rootMidi === right.rootMidi &&
    left.pace === right.pace &&
    left.transposeSemitones === right.transposeSemitones &&
    left.challengeSignature === right.challengeSignature
  )
}

/** Re-resolve untrusted save data; no stored derived field is trusted by itself. */
export function readMelodyAttempt(
  level: LevelDefinition,
  value: unknown,
): ResolvedMelodyAttempt | null {
  if (typeof value !== 'object' || value === null) return null
  const candidate = value as Partial<MelodyAttemptIdentity>
  if (
    typeof candidate.attemptId !== 'string' ||
    typeof candidate.comfortableMidi !== 'number' ||
    typeof candidate.pace !== 'number' ||
    typeof candidate.transposeSemitones !== 'number'
  )
    return null
  try {
    const resolved = resolveMelodyAttempt(level, {
      attemptId: candidate.attemptId,
      comfortableMidi: candidate.comfortableMidi,
      pace: candidate.pace,
      transposeSemitones: candidate.transposeSemitones,
    })
    return sameMelodyAttempt(
      resolved.identity,
      candidate as MelodyAttemptIdentity,
    )
      ? resolved
      : null
  } catch {
    return null
  }
}
