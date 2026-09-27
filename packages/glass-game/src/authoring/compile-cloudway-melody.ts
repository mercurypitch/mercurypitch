// Cloudway melody compiler — strict lesson references and ordered learning prerequisites.

import type { BreakableDefinition, ChallengeDefinition, CheckpointDefinition, MelodyLessonDefinition, } from '../contracts'
import { compileMelody } from '../core/melody-contour.ts'
import type { CloudwayCourseProfileCatalog } from './cloudway-course-profiles'
import { array, exactKeys, fail, identifierSet, positive, record, string, } from './cloudway-course-validation.ts'

const stationHold = {
  requiredSeconds: 1.4,
  toleranceCents: 85,
  confidenceFloor: 0.5,
  dropoutGraceSeconds: 0.2,
  decayPerSecond: 0.25,
  maximumSampleGapSeconds: 0.1,
  maximumSampleAgeMs: 150,
} as const

export function compileCloudwayChallenge(
  source: Record<string, unknown>,
  schemaVersion: 2 | 3,
  path: string,
): ChallengeDefinition {
  if (schemaVersion === 2) {
    if (source.challengeProfileId !== 'comfortable-hold')
      fail(`${path}.challengeProfileId`, 'must be comfortable-hold.')
    return {
      kind: 'hold',
      step: {
        target: 'comfortable',
        hold: {
          ...stationHold,
          requiredSeconds: 1.2,
          toleranceCents: 150,
          dropoutGraceSeconds: 0.15,
        },
      },
    }
  }
  const challenge = record(source.challenge, `${path}.challenge`)
  if (challenge.profileId === 'comfortable-hold') {
    exactKeys(challenge, `${path}.challenge`, ['profileId'])
    return compileCloudwayChallenge(
      { challengeProfileId: 'comfortable-hold' },
      2,
      path,
    )
  }
  const anchor = challenge.profileId === 'melody-anchor'
  if (!anchor && challenge.profileId !== 'melody-contour')
    fail(
      `${path}.challenge.profileId`,
      'must name a supported challenge profile.',
    )
  exactKeys(
    challenge,
    `${path}.challenge`,
    anchor
      ? ['profileId', 'lessonId', 'anchorId', 'reference']
      : ['profileId', 'lessonId', 'reference'],
  )
  const lessonId = string(challenge.lessonId, `${path}.challenge.lessonId`)
  if (anchor) {
    if (challenge.reference !== 'anchor-tone')
      fail(`${path}.challenge.reference`, 'must be anchor-tone.')
    return {
      kind: 'melody-anchor',
      lessonId,
      anchorId: string(challenge.anchorId, `${path}.challenge.anchorId`),
      reference: 'anchor-tone',
      step: { hold: { ...stationHold } },
    }
  }
  if (challenge.reference !== 'whole-melody')
    fail(`${path}.challenge.reference`, 'must be whole-melody.')
  return { kind: 'melody-contour', lessonId, reference: 'whole-melody' }
}

export function compileCloudwayMelodyLesson(
  raw: unknown,
  catalog: CloudwayCourseProfileCatalog,
  path: string,
): MelodyLessonDefinition | undefined {
  if (raw === undefined) return undefined
  const source = record(raw, path)
  exactKeys(source, path, [
    'profileId',
    'id',
    'revision',
    'stations',
    'finaleEncounterId',
  ])
  const profileId = string(source.profileId, `${path}.profileId`)
  const profile = catalog.melodyLessons?.[profileId]
  if (profile === undefined)
    fail(
      `${path}.profileId`,
      `references unknown melody profile "${profileId}".`,
    )
  const revision = positive(source.revision, `${path}.revision`)
  if (!Number.isInteger(revision))
    fail(`${path}.revision`, 'must be an integer.')
  const stations = array(source.stations, `${path}.stations`).map(
    (rawStation, index) => {
      const p = `${path}.stations[${index}]`
      const station = record(rawStation, p)
      exactKeys(station, p, ['encounterId', 'anchorId'])
      return {
        encounterId: string(station.encounterId, `${p}.encounterId`),
        anchorId: string(station.anchorId, `${p}.anchorId`),
      }
    },
  )
  identifierSet(
    stations.map((s) => s.encounterId),
    `${path}.stations.encounterId`,
  )
  identifierSet(
    stations.map((s) => s.anchorId),
    `${path}.stations.anchorId`,
  )
  if (!profile.allowedPaces.includes(profile.defaultPace))
    fail(path, 'default pace must be allowed.')
  const offsets = profile.melody.phrases.flatMap((phrase) =>
    phrase.anchors.map((anchor) => anchor.offsetSemitones),
  )
  const sampleRoot =
    (profile.allowedRange.minimumMidi +
      profile.allowedRange.maximumMidi -
      Math.min(...offsets) -
      Math.max(...offsets)) /
    2
  for (const pace of profile.allowedPaces)
    compileMelody(profile.melody, {
      rootMidi: sampleRoot,
      pace,
      allowedRange: profile.allowedRange,
    })
  return {
    ...profile,
    id: string(source.id, `${path}.id`),
    revision,
    stations,
    finaleEncounterId: string(
      source.finaleEncounterId,
      `${path}.finaleEncounterId`,
    ),
  }
}

/** The route teaches every anchor once before a freshly judged complete phrase. */
export function validateMelodyRoute(
  lesson: MelodyLessonDefinition | undefined,
  targets: readonly BreakableDefinition[],
  checkpoints: readonly Pick<
    CheckpointDefinition,
    'id' | 'requiresCompleted'
  >[],
  exitRequirements: readonly string[],
  path: string,
): void {
  const melodic = targets.filter(
    (t) =>
      t.challenge.kind === 'melody-anchor' ||
      t.challenge.kind === 'melody-contour',
  )
  if (lesson === undefined) {
    if (melodic.length > 0) fail(path, 'is required for melodic challenges.')
    return
  }
  const anchors = lesson.melody.phrases.flatMap((p) => p.anchors)
  if (anchors.length !== lesson.stations.length)
    fail(path, 'must teach every anchor exactly once.')
  const orderedIds = [
    ...lesson.stations.map((s) => s.encounterId),
    lesson.finaleEncounterId,
  ]
  identifierSet(orderedIds, path)
  if (melodic.length !== orderedIds.length)
    fail(path, 'must contain only the mapped stations and one finale.')
  const byId = new Map(targets.map((t) => [t.id, t]))
  const predecessors = (id: string, found = new Set<string>()): Set<string> => {
    for (const prerequisite of byId.get(id)?.requiresCompleted ?? []) {
      if (!found.has(prerequisite)) {
        found.add(prerequisite)
        predecessors(prerequisite, found)
      }
    }
    return found
  }
  for (const [index, id] of orderedIds.entries()) {
    const target = byId.get(id)
    if (target === undefined || target.optional)
      fail(path, `requires non-optional encounter "${id}".`)
    const challenge = target.challenge
    if (
      challenge.kind !== 'melody-anchor' &&
      challenge.kind !== 'melody-contour'
    )
      fail(path, `encounter "${id}" must use a melodic challenge.`)
    if (challenge.lessonId !== lesson.id)
      fail(path, `encounter "${id}" references another lesson.`)
    if (index < anchors.length) {
      if (
        challenge.kind !== 'melody-anchor' ||
        challenge.anchorId !== anchors[index]!.id ||
        lesson.stations[index]!.anchorId !== anchors[index]!.id
      )
        fail(
          path,
          'station anchors must match the complete melody order, including repeated pitches.',
        )
    } else if (challenge.kind !== 'melody-contour')
      fail(path, 'the finale must judge the whole melody.')
    const earlier = predecessors(id)
    if (orderedIds.slice(0, index).some((previous) => !earlier.has(previous)))
      fail(path, `encounter "${id}" must require every earlier station.`)
  }
  if (!exitRequirements.includes(lesson.finaleEncounterId))
    fail(path, 'exit must require the whole-melody finale.')
  for (const checkpoint of checkpoints) {
    const known = new Set(
      (checkpoint.requiresCompleted ?? []).flatMap((id) => [
        id,
        ...predecessors(id),
      ]),
    )
    const furthest = Math.max(
      -1,
      ...orderedIds.map((id, index) => (known.has(id) ? index : -1)),
    )
    if (
      furthest > 0 &&
      orderedIds.slice(0, furthest).some((id) => !known.has(id))
    )
      fail(
        `${path}.checkpoints.${checkpoint.id}`,
        'cannot skip earlier station prerequisites.',
      )
  }
}
