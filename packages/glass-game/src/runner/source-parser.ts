// ============================================================
// Song runner source parser — exact-key JSON decoding with authored paths.
// ============================================================

import type { RunnerLane } from './contracts.ts'
import type { RunnerCheckpointSource, RunnerObstacleSource, RunnerPhraseSource, RunnerPickupSource, RunnerTargetSource, SongRunnerCourseSource, } from './source.ts'
import { runnerSourceArray, runnerSourceBoolean, runnerSourceExactKeys, runnerSourceFail, runnerSourceFinite, runnerSourceInteger, runnerSourceLane, runnerSourcePositive, runnerSourceRecord, runnerSourceString, runnerSourceTitle, runnerSourceUniqueIds, } from './source.ts'

const MAXIMUM_TARGETS = 64
const MAXIMUM_OBSTACLES = 128
const MAXIMUM_REWARDS = 128

function parseLaneMask(value: unknown, path: string): readonly RunnerLane[] {
  const lanes = runnerSourceArray(value, path, 3).map((lane, index) =>
    runnerSourceLane(lane, `${path}[${index}]`),
  )
  if (lanes.length === 0) runnerSourceFail(path, 'must not be empty.')
  runnerSourceUniqueIds(lanes.map(String), path)
  return [...lanes].sort((left, right) => left - right)
}

function parseStringArray(
  value: unknown,
  path: string,
  maximum = 128,
): readonly string[] {
  return runnerSourceArray(value, path, maximum).map((entry, index) =>
    runnerSourceString(entry, `${path}[${index}]`),
  )
}

function parsePhrase(value: unknown, path: string): RunnerPhraseSource {
  const source = runnerSourceRecord(value, path)
  runnerSourceExactKeys(source, path, ['id', 'notes', 'breathAfterBeats'])
  const notes = runnerSourceArray(source.notes, `${path}.notes`, 16).map(
    (rawNote, noteIndex) => {
      const notePath = `${path}.notes[${noteIndex}]`
      const note = runnerSourceRecord(rawNote, notePath)
      runnerSourceExactKeys(
        note,
        notePath,
        ['offsetSemitones', 'durationBeats'],
        ['connection'],
      )
      const offsetSemitones = runnerSourceFinite(
        note.offsetSemitones,
        `${notePath}.offsetSemitones`,
      )
      if (!Number.isInteger(offsetSemitones) || Math.abs(offsetSemitones) > 24)
        runnerSourceFail(
          `${notePath}.offsetSemitones`,
          'must be an integer within two octaves.',
        )
      const durationBeats = runnerSourcePositive(
        note.durationBeats,
        `${notePath}.durationBeats`,
      )
      if (durationBeats < 0.25 || durationBeats > 16)
        runnerSourceFail(
          `${notePath}.durationBeats`,
          'must be between 0.25 and 16 beats.',
        )
      if (
        note.connection !== undefined &&
        note.connection !== 'separate' &&
        note.connection !== 'glide'
      )
        runnerSourceFail(`${notePath}.connection`, 'must be separate or glide.')
      const connection: 'separate' | 'glide' =
        note.connection === 'glide' ? 'glide' : 'separate'
      if (noteIndex === 0 && connection === 'glide')
        runnerSourceFail(
          `${notePath}.connection`,
          'cannot glide without a previous note.',
        )
      return { offsetSemitones, durationBeats, connection }
    },
  )
  if (notes.length === 0)
    runnerSourceFail(`${path}.notes`, 'must not be empty.')
  const breathAfterBeats = runnerSourcePositive(
    source.breathAfterBeats,
    `${path}.breathAfterBeats`,
  )
  const minimumBreath = notes.length === 1 ? 2 : 4
  if (breathAfterBeats < minimumBreath)
    runnerSourceFail(
      `${path}.breathAfterBeats`,
      `must be at least ${minimumBreath} beats for this phrase.`,
    )
  return {
    id: runnerSourceString(source.id, `${path}.id`),
    notes,
    breathAfterBeats,
  }
}

function parseTarget(value: unknown, path: string): RunnerTargetSource {
  const source = runnerSourceRecord(value, path)
  runnerSourceExactKeys(
    source,
    path,
    [
      'id',
      'atBeat',
      'phraseId',
      'displayLane',
      'glassProfileId',
      'requiredForGrade',
    ],
    ['completion'],
  )
  let completion: RunnerTargetSource['completion']
  if (source.completion !== undefined) {
    const completionPath = `${path}.completion`
    const rawCompletion = runnerSourceRecord(source.completion, completionPath)
    runnerSourceExactKeys(rawCompletion, completionPath, [
      'kind',
      'minimumReliableSecondsPerNote',
      'previewDurationSeconds',
      'contactAfterResponseSeconds',
    ])
    if (rawCompletion.kind !== 'charge')
      runnerSourceFail(`${completionPath}.kind`, 'must be charge.')
    completion = {
      kind: 'charge',
      minimumReliableSecondsPerNote: runnerSourceArray(
        rawCompletion.minimumReliableSecondsPerNote,
        `${completionPath}.minimumReliableSecondsPerNote`,
        16,
      ).map((entry, index) =>
        runnerSourcePositive(
          entry,
          `${completionPath}.minimumReliableSecondsPerNote[${index}]`,
        ),
      ),
      previewDurationSeconds: runnerSourcePositive(
        rawCompletion.previewDurationSeconds,
        `${completionPath}.previewDurationSeconds`,
      ),
      contactAfterResponseSeconds: runnerSourcePositive(
        rawCompletion.contactAfterResponseSeconds,
        `${completionPath}.contactAfterResponseSeconds`,
      ),
    }
  }
  return {
    id: runnerSourceString(source.id, `${path}.id`),
    atBeat: runnerSourceFinite(source.atBeat, `${path}.atBeat`),
    phraseId: runnerSourceString(source.phraseId, `${path}.phraseId`),
    displayLane: runnerSourceLane(source.displayLane, `${path}.displayLane`),
    glassProfileId: runnerSourceString(
      source.glassProfileId,
      `${path}.glassProfileId`,
    ),
    requiredForGrade: runnerSourceBoolean(
      source.requiredForGrade,
      `${path}.requiredForGrade`,
    ),
    ...(completion === undefined ? {} : { completion }),
  }
}

function parseObstacle(value: unknown, path: string): RunnerObstacleSource {
  const source = runnerSourceRecord(value, path)
  runnerSourceExactKeys(source, path, ['id', 'atBeat', 'laneMask', 'profileId'])
  return {
    id: runnerSourceString(source.id, `${path}.id`),
    atBeat: runnerSourceFinite(source.atBeat, `${path}.atBeat`),
    laneMask: parseLaneMask(source.laneMask, `${path}.laneMask`),
    profileId: runnerSourceString(source.profileId, `${path}.profileId`),
  }
}

function parseCheckpoint(value: unknown, path: string): RunnerCheckpointSource {
  const source = runnerSourceRecord(value, path)
  runnerSourceExactKeys(source, path, [
    'id',
    'atBeat',
    'respawnLane',
    'countInBeats',
  ])
  return {
    id: runnerSourceString(source.id, `${path}.id`),
    atBeat: runnerSourceFinite(source.atBeat, `${path}.atBeat`),
    respawnLane: runnerSourceLane(source.respawnLane, `${path}.respawnLane`),
    countInBeats: runnerSourcePositive(
      source.countInBeats,
      `${path}.countInBeats`,
    ),
  }
}

function parsePickup(value: unknown, path: string): RunnerPickupSource {
  const source = runnerSourceRecord(value, path)
  runnerSourceExactKeys(source, path, ['id', 'atBeat', 'lane'])
  return {
    id: runnerSourceString(source.id, `${path}.id`),
    atBeat: runnerSourceFinite(source.atBeat, `${path}.atBeat`),
    lane: runnerSourceLane(source.lane, `${path}.lane`),
  }
}

export function parseRunnerCourseSource(
  value: unknown,
  path: string,
): SongRunnerCourseSource {
  const source = runnerSourceRecord(value, path)
  runnerSourceExactKeys(source, path, [
    'id',
    'title',
    'revision',
    'seed',
    'meter',
    'tempoMap',
    'track',
    'movementProfileId',
    'voice',
    'obstacles',
    'checkpoints',
    'rewards',
    'presentation',
  ])

  const meter = runnerSourceRecord(source.meter, `${path}.meter`)
  runnerSourceExactKeys(meter, `${path}.meter`, ['beatsPerBar', 'beatUnit'])
  if (meter.beatsPerBar !== 4 || meter.beatUnit !== 4)
    runnerSourceFail(`${path}.meter`, 'must be 4/4 in runner schema 1.')

  const tempoMap = runnerSourceArray(
    source.tempoMap,
    `${path}.tempoMap`,
    32,
  ).map((rawPoint, index) => {
    const pointPath = `${path}.tempoMap[${index}]`
    const point = runnerSourceRecord(rawPoint, pointPath)
    runnerSourceExactKeys(point, pointPath, ['atBeat', 'bpm'])
    return {
      atBeat: runnerSourceFinite(point.atBeat, `${pointPath}.atBeat`),
      bpm: runnerSourcePositive(point.bpm, `${pointPath}.bpm`),
    }
  })

  const track = runnerSourceRecord(source.track, `${path}.track`)
  runnerSourceExactKeys(track, `${path}.track`, [
    'lengthBeats',
    'metersPerBeat',
    'groundFeetY',
    'fallBelowFeetY',
    'laneCenters',
    'spawnRunwayBeats',
    'vocalLookaheadBeats',
    'vocalEmphasisBeats',
    'chunkBeats',
  ])
  const laneValues = runnerSourceArray(
    track.laneCenters,
    `${path}.track.laneCenters`,
    3,
  )
  if (laneValues.length !== 3)
    runnerSourceFail(`${path}.track.laneCenters`, 'must contain three lanes.')
  const laneCenters = laneValues.map((entry, index) =>
    runnerSourceFinite(entry, `${path}.track.laneCenters[${index}]`),
  ) as [number, number, number]
  if (!(laneCenters[0] < laneCenters[1] && laneCenters[1] < laneCenters[2]))
    runnerSourceFail(
      `${path}.track.laneCenters`,
      'must be strictly increasing.',
    )
  const groundFeetY = runnerSourceFinite(
    track.groundFeetY,
    `${path}.track.groundFeetY`,
  )
  const fallBelowFeetY = runnerSourceFinite(
    track.fallBelowFeetY,
    `${path}.track.fallBelowFeetY`,
  )
  if (fallBelowFeetY >= groundFeetY)
    runnerSourceFail(
      `${path}.track.fallBelowFeetY`,
      'must be below groundFeetY.',
    )

  const voice = runnerSourceRecord(source.voice, `${path}.voice`)
  runnerSourceExactKeys(voice, `${path}.voice`, [
    'profileId',
    'phrases',
    'targets',
  ])
  const phrases = runnerSourceArray(
    voice.phrases,
    `${path}.voice.phrases`,
    32,
  ).map((phrase, index) =>
    parsePhrase(phrase, `${path}.voice.phrases[${index}]`),
  )
  const targets = runnerSourceArray(
    voice.targets,
    `${path}.voice.targets`,
    MAXIMUM_TARGETS,
  ).map((target, index) =>
    parseTarget(target, `${path}.voice.targets[${index}]`),
  )

  const rewards = runnerSourceRecord(source.rewards, `${path}.rewards`)
  runnerSourceExactKeys(rewards, `${path}.rewards`, [
    'revision',
    'pickupProfileId',
    'pickups',
    'singingStarTargetIds',
    'finishRewardIds',
  ])

  const presentation = runnerSourceRecord(
    source.presentation,
    `${path}.presentation`,
  )
  runnerSourceExactKeys(presentation, `${path}.presentation`, [
    'environmentProfileId',
    'musicProfileId',
    'notationProfileId',
  ])

  return {
    id: runnerSourceString(source.id, `${path}.id`),
    title: runnerSourceTitle(source.title, `${path}.title`),
    revision: runnerSourceInteger(source.revision, `${path}.revision`),
    seed: runnerSourceInteger(source.seed, `${path}.seed`),
    meter: { beatsPerBar: 4, beatUnit: 4 },
    tempoMap,
    track: {
      lengthBeats: runnerSourcePositive(
        track.lengthBeats,
        `${path}.track.lengthBeats`,
      ),
      metersPerBeat: runnerSourcePositive(
        track.metersPerBeat,
        `${path}.track.metersPerBeat`,
      ),
      groundFeetY,
      fallBelowFeetY,
      laneCenters,
      spawnRunwayBeats: runnerSourcePositive(
        track.spawnRunwayBeats,
        `${path}.track.spawnRunwayBeats`,
      ),
      vocalLookaheadBeats: runnerSourcePositive(
        track.vocalLookaheadBeats,
        `${path}.track.vocalLookaheadBeats`,
      ),
      vocalEmphasisBeats: runnerSourcePositive(
        track.vocalEmphasisBeats,
        `${path}.track.vocalEmphasisBeats`,
      ),
      chunkBeats: runnerSourcePositive(
        track.chunkBeats,
        `${path}.track.chunkBeats`,
      ),
    },
    movementProfileId: runnerSourceString(
      source.movementProfileId,
      `${path}.movementProfileId`,
    ),
    voice: {
      profileId: runnerSourceString(voice.profileId, `${path}.voice.profileId`),
      phrases,
      targets,
    },
    obstacles: runnerSourceArray(
      source.obstacles,
      `${path}.obstacles`,
      MAXIMUM_OBSTACLES,
    ).map((obstacle, index) =>
      parseObstacle(obstacle, `${path}.obstacles[${index}]`),
    ),
    checkpoints: runnerSourceArray(
      source.checkpoints,
      `${path}.checkpoints`,
      32,
    ).map((checkpoint, index) =>
      parseCheckpoint(checkpoint, `${path}.checkpoints[${index}]`),
    ),
    rewards: {
      revision: runnerSourceInteger(
        rewards.revision,
        `${path}.rewards.revision`,
      ),
      pickupProfileId: runnerSourceString(
        rewards.pickupProfileId,
        `${path}.rewards.pickupProfileId`,
      ),
      pickups: runnerSourceArray(
        rewards.pickups,
        `${path}.rewards.pickups`,
        MAXIMUM_REWARDS,
      ).map((pickup, index) =>
        parsePickup(pickup, `${path}.rewards.pickups[${index}]`),
      ),
      singingStarTargetIds: parseStringArray(
        rewards.singingStarTargetIds,
        `${path}.rewards.singingStarTargetIds`,
      ),
      finishRewardIds: parseStringArray(
        rewards.finishRewardIds,
        `${path}.rewards.finishRewardIds`,
      ),
    },
    presentation: {
      environmentProfileId: runnerSourceString(
        presentation.environmentProfileId,
        `${path}.presentation.environmentProfileId`,
      ),
      musicProfileId: runnerSourceString(
        presentation.musicProfileId,
        `${path}.presentation.musicProfileId`,
      ),
      notationProfileId: runnerSourceString(
        presentation.notationProfileId,
        `${path}.presentation.notationProfileId`,
      ),
    },
  }
}
