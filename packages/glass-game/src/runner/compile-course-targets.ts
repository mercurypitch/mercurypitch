// ============================================================
// Song runner target compiler — voice profiles, contours, and protected windows.
// ============================================================

import { validateRunnerGlassPresentation } from '../content/runner-glass-presentation.ts'
import { RUNNER_COMPILER_EPSILON, runnerChunkId, runnerCompilerApproximatelyEqual, } from './compile-course-helpers.ts'
import type { CompiledRunnerCourse, CompiledRunnerNote, CompiledRunnerTarget, CompiledRunnerVoiceProfile, RunnerQualityGrade, } from './contracts.ts'
import type { RunnerPhraseSource, RunnerTargetSource, SongRunnerCourseCatalog, SongRunnerCourseSource, } from './source.ts'
import { runnerSourceFail, runnerSourceUniqueIds } from './source.ts'
import { runnerBeatToSeconds, runnerSecondsToBeat } from './tempo.ts'

export const RUNNER_MINIMUM_RELEASE_BEFORE_CONTACT_SECONDS = 0.8

interface ParsedTarget extends RunnerTargetSource {
  readonly phrase: RunnerPhraseSource
}

export interface RunnerProtectedWindow {
  readonly targetId: string
  readonly from: number
  readonly until: number
  readonly fromBeat: number
  readonly untilBeat: number
}

export function validateRunnerMovement(
  course: SongRunnerCourseSource,
  catalog: SongRunnerCourseCatalog,
  path: string,
) {
  const movement = catalog.movementProfiles[course.movementProfileId]
  if (movement === undefined)
    runnerSourceFail(
      `${path}.movementProfileId`,
      `references unknown profile "${course.movementProfileId}".`,
    )
  if (movement.id !== course.movementProfileId)
    runnerSourceFail(
      `${path}.movementProfileId`,
      'does not match the catalog profile identity.',
    )
  const positiveFields = [
    movement.revision,
    movement.fixedStepSeconds,
    movement.maxCatchUpSeconds,
    movement.laneChangeSeconds,
    movement.bodyRadius,
    movement.bodyHeight,
    movement.jumpVelocityMetersPerSecond,
    movement.gravityMetersPerSecondSquared,
    movement.maxJumpRiseMeters,
    movement.coyoteSeconds,
    movement.jumpBufferSeconds,
  ]
  if (positiveFields.some((value) => !Number.isFinite(value) || value <= 0))
    runnerSourceFail(
      `${path}.movementProfileId`,
      'references a malformed movement profile.',
    )
  if (
    movement.kind !== undefined &&
    movement.kind !== 'lanes' &&
    movement.kind !== 'continuous'
  )
    runnerSourceFail(
      `${path}.movementProfileId`,
      'references an unsupported movement capability.',
    )
  if (
    movement.kind === 'continuous' &&
    (movement.edgePolicy !== 'contained' ||
      [
        movement.maxLateralSpeedMetersPerSecond,
        movement.lateralAccelerationMetersPerSecondSquared,
        movement.lateralBrakingMetersPerSecondSquared,
      ].some((value) => !Number.isFinite(value) || value <= 0))
  )
    runnerSourceFail(
      `${path}.movementProfileId`,
      'references malformed continuous steering.',
    )
  if (
    movement.kind === 'continuous' &&
    movement.bodyRadius * 2 >=
      (course.track.laneCenters[2] - course.track.laneCenters[0]) * 1.5
  )
    runnerSourceFail(
      `${path}.movementProfileId`,
      'body must fit inside the continuous track.',
    )
  const derivedRise =
    movement.jumpVelocityMetersPerSecond ** 2 /
    (2 * movement.gravityMetersPerSecondSquared)
  if (
    !runnerCompilerApproximatelyEqual(derivedRise, movement.maxJumpRiseMeters)
  )
    runnerSourceFail(
      `${path}.movementProfileId`,
      'has a maxJumpRiseMeters inconsistent with velocity and gravity.',
    )
  if (movement.maxCatchUpSeconds < movement.fixedStepSeconds)
    runnerSourceFail(
      `${path}.movementProfileId`,
      'must permit at least one fixed step.',
    )
  return movement
}

export function validateRunnerVoice(
  course: SongRunnerCourseSource,
  catalog: SongRunnerCourseCatalog,
  path: string,
): {
  voice: CompiledRunnerVoiceProfile
  profile: NonNullable<(typeof catalog.voiceProfiles)[string]>
} {
  const profile = catalog.voiceProfiles[course.voice.profileId]
  if (profile === undefined)
    runnerSourceFail(
      `${path}.voice.profileId`,
      `references unknown profile "${course.voice.profileId}".`,
    )
  const voice = profile.voice
  if (voice.id !== course.voice.profileId)
    runnerSourceFail(
      `${path}.voice.profileId`,
      'does not match the catalog profile identity.',
    )
  if (
    !Number.isSafeInteger(voice.revision) ||
    voice.revision <= 0 ||
    !Number.isInteger(voice.comfortableRootOffsetSemitones) ||
    !Number.isFinite(voice.minimumComfortableMidi) ||
    !Number.isFinite(voice.maximumComfortableMidi) ||
    voice.minimumComfortableMidi >= voice.maximumComfortableMidi
  )
    runnerSourceFail(
      `${path}.voice.profileId`,
      'references a malformed voice profile.',
    )
  const judge = voice.judge
  if (
    judge.id.length === 0 ||
    !Number.isSafeInteger(judge.revision) ||
    judge.revision <= 0 ||
    judge.evidenceVersion !== 'pitch-accuracy-v1' ||
    !Number.isFinite(judge.minimumConfidence) ||
    judge.minimumConfidence < 0 ||
    judge.minimumConfidence > 1 ||
    !Number.isFinite(judge.centsTolerance) ||
    judge.centsTolerance <= 0 ||
    !Number.isFinite(judge.maximumEvidenceGapSeconds) ||
    judge.maximumEvidenceGapSeconds <= 0 ||
    !Number.isFinite(judge.minimumReliableRatio) ||
    judge.minimumReliableRatio <= 0 ||
    judge.minimumReliableRatio > 1 ||
    !Number.isFinite(judge.maximumDeliveryLatencySeconds) ||
    judge.maximumDeliveryLatencySeconds < 0
  )
    runnerSourceFail(
      `${path}.voice.profileId`,
      'references a malformed judge profile.',
    )
  const grades = [...judge.gradeBands].sort(
    (left, right) => right.grade - left.grade,
  )
  if (
    grades.length !== 3 ||
    grades.some(
      (band, index) =>
        band.grade !== ((3 - index) as RunnerQualityGrade) ||
        !Number.isFinite(band.maximumMeanAbsoluteCents) ||
        band.maximumMeanAbsoluteCents <= 0,
    ) ||
    !(
      grades[0]!.maximumMeanAbsoluteCents < grades[1]!.maximumMeanAbsoluteCents
    ) ||
    !(
      grades[1]!.maximumMeanAbsoluteCents < grades[2]!.maximumMeanAbsoluteCents
    ) ||
    grades[2]!.maximumMeanAbsoluteCents > judge.centsTolerance
  )
    runnerSourceFail(
      `${path}.voice.profileId`,
      'must define ordered finite grade bands 3, 2, and 1 within tolerance.',
    )
  if (
    !Number.isFinite(profile.judgeLeadBeats) ||
    profile.judgeLeadBeats < 0 ||
    !Number.isFinite(profile.protectedLeadBeats) ||
    profile.protectedLeadBeats < 0 ||
    !Number.isFinite(profile.protectedTailBeats) ||
    profile.protectedTailBeats < 0
  )
    runnerSourceFail(`${path}.voice.profileId`, 'has malformed window timing.')
  return { voice, profile }
}

export function compileRunnerTargets(
  course: SongRunnerCourseSource,
  voice: CompiledRunnerVoiceProfile,
  voiceProfile: NonNullable<SongRunnerCourseCatalog['voiceProfiles'][string]>,
  tempoSegments: CompiledRunnerCourse['tempoSegments'],
  catalog: SongRunnerCourseCatalog,
  path: string,
): {
  targets: readonly CompiledRunnerTarget[]
  windows: readonly RunnerProtectedWindow[]
  glassAssets: ReadonlyMap<string, readonly string[]>
} {
  const phraseIds = runnerSourceUniqueIds(
    course.voice.phrases.map((phrase) => phrase.id),
    `${path}.voice.phrases`,
  )
  const phrases = new Map(
    course.voice.phrases.map((phrase) => [phrase.id, phrase]),
  )
  const targetIds = runnerSourceUniqueIds(
    course.voice.targets.map((target) => target.id),
    `${path}.voice.targets`,
  )
  if (phraseIds.size === 0)
    runnerSourceFail(`${path}.voice.phrases`, 'must not be empty.')
  if (targetIds.size === 0)
    runnerSourceFail(`${path}.voice.targets`, 'must not be empty.')

  const parsed: ParsedTarget[] = course.voice.targets.map((target, index) => {
    const phrase = phrases.get(target.phraseId)
    if (phrase === undefined)
      runnerSourceFail(
        `${path}.voice.targets[${index}].phraseId`,
        `references unknown phrase "${target.phraseId}".`,
      )
    const presentation =
      catalog.glassProfiles[target.glassProfileId]?.presentation
    if (
      presentation !== undefined &&
      !validateRunnerGlassPresentation(presentation)
    )
      runnerSourceFail(
        `${path}.voice.targets[${index}].glassProfileId`,
        'has invalid wall presentation bounds.',
      )
    if (
      presentation !== undefined &&
      presentation.envelope.width >
        1.5 * (course.track.laneCenters[2] - course.track.laneCenters[0]) - 0.08
    )
      runnerSourceFail(
        `${path}.voice.targets[${index}].glassProfileId`,
        'does not fit the full course width.',
      )
    if (catalog.glassProfiles[target.glassProfileId] === undefined)
      runnerSourceFail(
        `${path}.voice.targets[${index}].glassProfileId`,
        `references unknown glass profile "${target.glassProfileId}".`,
      )
    return { ...target, phrase }
  })
  const ordered = [...parsed].sort(
    (left, right) =>
      left.atBeat - right.atBeat || left.id.localeCompare(right.id),
  )
  if (ordered.some((target, index) => target !== parsed[index]))
    runnerSourceFail(`${path}.voice.targets`, 'must be ordered by atBeat.')

  const windows: RunnerProtectedWindow[] = []
  const compiled: CompiledRunnerTarget[] = ordered.map(
    (target, targetIndex) => {
      const targetPath = `${path}.voice.targets[${targetIndex}]`
      if (target.atBeat < 0 || target.atBeat >= course.track.lengthBeats)
        runnerSourceFail(`${targetPath}.atBeat`, 'must lie inside the course.')
      let noteBeat = target.atBeat
      let previousOffset: number | null = null
      const charge = target.completion
      if (
        charge !== undefined &&
        charge.minimumReliableSecondsPerNote.length !==
          target.phrase.notes.length
      )
        runnerSourceFail(
          `${targetPath}.completion.minimumReliableSecondsPerNote`,
          'must contain exactly one threshold per phrase note.',
        )
      if (
        charge !== undefined &&
        target.phrase.notes.some((note) => note.connection === 'glide')
      )
        runnerSourceFail(
          `${targetPath}.completion`,
          'charge targets require separate notes; timed glides remain scheduled.',
        )
      const notes: CompiledRunnerNote[] = target.phrase.notes.map(
        (note, noteIndex) => {
          const startBeat = noteBeat
          const endBeat = startBeat + note.durationBeats
          noteBeat = endBeat
          const startCourseSeconds = runnerBeatToSeconds(
            tempoSegments,
            startBeat,
          )
          const endCourseSeconds = runnerBeatToSeconds(tempoSegments, endBeat)
          const connection = note.connection ?? 'separate'
          const startOffsetSemitones =
            connection === 'glide' ? previousOffset! : note.offsetSemitones
          previousOffset = note.offsetSemitones
          return {
            index: noteIndex,
            startOffsetSemitones,
            endOffsetSemitones: note.offsetSemitones,
            connection,
            startBeat,
            endBeat,
            startCourseSeconds,
            endCourseSeconds,
            minimumReliableSeconds:
              charge?.minimumReliableSecondsPerNote[noteIndex] ??
              (endCourseSeconds - startCourseSeconds) *
                voice.judge.minimumReliableRatio,
          }
        },
      )
      if (noteBeat > course.track.lengthBeats + RUNNER_COMPILER_EPSILON)
        runnerSourceFail(targetPath, 'phrase extends beyond the course.')
      const nextTarget = ordered[targetIndex + 1]
      const availableUntil = nextTarget?.atBeat ?? course.track.lengthBeats
      if (
        noteBeat + target.phrase.breathAfterBeats >
        availableUntil + RUNNER_COMPILER_EPSILON
      )
        runnerSourceFail(
          targetPath,
          'does not leave its authored breath before the next target or finish.',
        )
      const onsetCourseSeconds = notes[0]!.startCourseSeconds
      const endCourseSeconds = notes.at(-1)!.endCourseSeconds
      const responseDurationSeconds = endCourseSeconds - onsetCourseSeconds
      const requiredReliableSeconds = notes.reduce(
        (total, note) => total + note.minimumReliableSeconds,
        0,
      )
      if (
        charge !== undefined &&
        requiredReliableSeconds >=
          responseDurationSeconds - RUNNER_COMPILER_EPSILON
      )
        runnerSourceFail(
          `${targetPath}.completion.minimumReliableSecondsPerNote`,
          'must leave response time beyond the aggregate reliable hold.',
        )
      if (
        charge !== undefined &&
        charge.previewDurationSeconds >
          responseDurationSeconds + RUNNER_COMPILER_EPSILON
      )
        runnerSourceFail(
          `${targetPath}.completion.previewDurationSeconds`,
          'cannot exceed the authored response duration.',
        )
      const settleAfterCourseSeconds =
        endCourseSeconds + voice.judge.maximumDeliveryLatencySeconds
      const contactCourseSeconds =
        charge === undefined
          ? endCourseSeconds
          : endCourseSeconds + charge.contactAfterResponseSeconds
      if (
        charge !== undefined &&
        contactCourseSeconds - settleAfterCourseSeconds <
          RUNNER_MINIMUM_RELEASE_BEFORE_CONTACT_SECONDS -
            RUNNER_COMPILER_EPSILON
      )
        runnerSourceFail(
          `${targetPath}.completion.contactAfterResponseSeconds`,
          `must leave at least ${RUNNER_MINIMUM_RELEASE_BEFORE_CONTACT_SECONDS} seconds after late evidence settlement.`,
        )
      if (
        contactCourseSeconds >
        runnerBeatToSeconds(tempoSegments, course.track.lengthBeats) +
          RUNNER_COMPILER_EPSILON
      )
        runnerSourceFail(
          targetPath,
          'physical contact extends beyond the course.',
        )
      const protectedFromBeat = Math.max(
        0,
        target.atBeat - voiceProfile.protectedLeadBeats,
      )
      const protectedUntilCourseSeconds = Math.max(
        runnerBeatToSeconds(
          tempoSegments,
          Math.min(
            course.track.lengthBeats,
            noteBeat + voiceProfile.protectedTailBeats,
          ),
        ),
        contactCourseSeconds,
      )
      const protectedUntilBeat = runnerSecondsToBeat(
        tempoSegments,
        protectedUntilCourseSeconds,
      )
      const protectedFromCourseSeconds = runnerBeatToSeconds(
        tempoSegments,
        protectedFromBeat,
      )
      if (
        settleAfterCourseSeconds >
        runnerBeatToSeconds(tempoSegments, course.track.lengthBeats) +
          RUNNER_COMPILER_EPSILON
      )
        runnerSourceFail(
          targetPath,
          'settlement grace extends beyond the course.',
        )
      for (const [tempoIndex, point] of course.tempoMap.entries()) {
        if (
          point.atBeat > protectedFromBeat + RUNNER_COMPILER_EPSILON &&
          point.atBeat < protectedUntilBeat - RUNNER_COMPILER_EPSILON
        )
          runnerSourceFail(
            `${path}.tempoMap[${tempoIndex}].atBeat`,
            `falls inside protected target "${target.id}".`,
          )
      }
      windows.push({
        targetId: target.id,
        from: protectedFromCourseSeconds,
        until: protectedUntilCourseSeconds,
        fromBeat: protectedFromBeat,
        untilBeat: protectedUntilBeat,
      })
      return {
        id: target.id,
        chunkId: runnerChunkId(
          course.id,
          course.track.chunkBeats,
          target.atBeat,
        ),
        displayLane: target.displayLane,
        glassProfileId: target.glassProfileId,
        soundProfile:
          catalog.glassProfiles[target.glassProfileId]!.soundProfile,
        glassPresentation:
          catalog.glassProfiles[target.glassProfileId]!.presentation,
        requiredForGrade: target.requiredForGrade,
        completionPolicy: charge === undefined ? 'scheduled' : 'charge',
        completionFingerprint:
          charge === undefined
            ? 'scheduled-v1'
            : `charge-v1:${JSON.stringify({
                minimumReliableSecondsPerNote:
                  charge.minimumReliableSecondsPerNote,
                previewDurationSeconds: charge.previewDurationSeconds,
                contactAfterResponseSeconds: charge.contactAfterResponseSeconds,
              })}`,
        previewDurationSeconds:
          charge?.previewDurationSeconds ?? responseDurationSeconds,
        notes,
        visibleFromCourseSeconds: runnerBeatToSeconds(
          tempoSegments,
          Math.max(0, target.atBeat - course.track.vocalLookaheadBeats),
        ),
        emphasizedFromCourseSeconds: runnerBeatToSeconds(
          tempoSegments,
          Math.max(0, target.atBeat - course.track.vocalEmphasisBeats),
        ),
        onsetCourseSeconds,
        endCourseSeconds,
        judgeOpenCourseSeconds:
          charge === undefined
            ? runnerBeatToSeconds(
                tempoSegments,
                Math.max(0, target.atBeat - voiceProfile.judgeLeadBeats),
              )
            : onsetCourseSeconds,
        judgeCloseCourseSeconds: endCourseSeconds,
        settleAfterCourseSeconds,
        contactCourseSeconds,
        protectedFromCourseSeconds,
        protectedUntilCourseSeconds,
      }
    },
  )

  for (let index = 1; index < compiled.length; index++) {
    const previous = compiled[index - 1]!
    const current = compiled[index]!
    if (
      previous.settleAfterCourseSeconds >
      current.judgeOpenCourseSeconds + RUNNER_COMPILER_EPSILON
    )
      runnerSourceFail(
        `${path}.voice.targets[${index}].atBeat`,
        `overlaps target "${previous.id}" through settlement grace.`,
      )
    if (
      previous.contactCourseSeconds >
      current.judgeOpenCourseSeconds + RUNNER_COMPILER_EPSILON
    )
      runnerSourceFail(
        `${path}.voice.targets[${index}].atBeat`,
        `overlaps target "${previous.id}" through physical contact.`,
      )
  }

  return {
    targets: compiled,
    windows,
    glassAssets: new Map(
      compiled.map((target) => [
        target.id,
        catalog.glassProfiles[target.glassProfileId]!.assetProfileIds,
      ]),
    ),
  }
}
