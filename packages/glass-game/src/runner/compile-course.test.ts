// ============================================================
// Song runner compiler tests — literal timing, safety, and strict rejection.
// ============================================================

import { describe, expect, it } from 'vitest'
import { compileSongRunnerCourseDocument } from './compile-course'
import { SINGING_CURRENT_CURRENT, SINGING_CURRENT_CURRENT_CATALOG, SINGING_CURRENT_CURRENT_SOURCE_DOCUMENT, SINGING_CURRENT_RESPONSIVE, SINGING_CURRENT_RESPONSIVE_CATALOG, SINGING_CURRENT_RESPONSIVE_SOURCE_DOCUMENT, } from './first-course'
import { createRunnerMovementState, stepRunnerMovement } from './movement'
import type { SongRunnerCourseCatalog, SongRunnerSourceDocument, } from './source'
import { runnerBeatToSeconds } from './tempo'

type Mutable<T> = T extends readonly (infer Entry)[]
  ? Mutable<Entry>[]
  : T extends object
    ? { -readonly [Key in keyof T]: Mutable<T[Key]> }
    : T

function sourceClone(): Mutable<SongRunnerSourceDocument> {
  return mutableJsonClone(SINGING_CURRENT_CURRENT_SOURCE_DOCUMENT)
}

function catalogClone(): Mutable<SongRunnerCourseCatalog> {
  return mutableJsonClone(SINGING_CURRENT_CURRENT_CATALOG)
}

function responsiveSourceClone(): Mutable<SongRunnerSourceDocument> {
  return mutableJsonClone(SINGING_CURRENT_RESPONSIVE_SOURCE_DOCUMENT)
}

function responsiveBlockerSourceClone(): Mutable<SongRunnerSourceDocument> {
  const source = responsiveSourceClone()
  const course = source.courses[0]!
  const catalog: SongRunnerCourseCatalog = SINGING_CURRENT_RESPONSIVE_CATALOG
  course.obstacles = [
    course.obstacles.find(
      (obstacle) =>
        catalog.obstacleProfiles[obstacle.profileId]!.kind === 'blocker',
    )!,
  ]
  return source
}

function nearbyBlockerSource(
  secondBeat: number,
  secondMask: Mutable<SongRunnerSourceDocument>['courses'][number]['obstacles'][number]['laneMask'] = [
    1, 2,
  ],
): Mutable<SongRunnerSourceDocument> {
  const source = responsiveSourceClone()
  source.courses[0]!.obstacles = [
    {
      id: 'squeeze-right',
      atBeat: 19,
      laneMask: [0, 1],
      profileId: 'runner-lane-gate-training-v1',
    },
    {
      id: 'squeeze-left',
      atBeat: secondBeat,
      laneMask: secondMask,
      profileId: 'runner-lane-gate-training-v1',
    },
  ]
  return source
}

function mutableJsonClone<T>(value: T): Mutable<T> {
  return JSON.parse(JSON.stringify(value)) as Mutable<T>
}

describe('song runner course compiler', () => {
  it.each([1.5, 17, 1e9])(
    'rejects unsupported count-in allocation for %s beats',
    (countInBeats) => {
      const source = responsiveSourceClone()
      source.courses[0]!.checkpoints[0]!.countInBeats = countInBeats
      expect(() =>
        compileSongRunnerCourseDocument(
          source,
          SINGING_CURRENT_RESPONSIVE_CATALOG,
        ),
      ).toThrow(
        '$.courses[0].checkpoints[0].countInBeats must be an integer between 1 and 16.',
      )
    },
  )

  it('rejects finite tempos that exceed the supported full-course audio duration', () => {
    const source = sourceClone()
    source.courses[0]!.obstacles = []
    source.courses[0]!.tempoMap = [{ atBeat: 0, bpm: 50 }]
    expect(() =>
      compileSongRunnerCourseDocument(source, SINGING_CURRENT_CURRENT_CATALOG),
    ).toThrow(
      '$.courses[0].tempoMap[0].bpm must keep the course duration at most 180 seconds.',
    )
  })

  it('rejects finite tempos that overflow derived course seconds before target compilation', () => {
    const source = sourceClone()
    source.courses[0]!.obstacles = []
    source.courses[0]!.tempoMap = [{ atBeat: 0, bpm: Number.MIN_VALUE }]
    expect(() =>
      compileSongRunnerCourseDocument(source, SINGING_CURRENT_CURRENT_CATALOG),
    ).toThrow(
      '$.courses[0].tempoMap[0].bpm must produce a finite positive duration.',
    )
  })

  it('bounds a short slow opening count-in independently of the complete course duration', () => {
    const source = sourceClone()
    source.courses[0]!.obstacles = []
    source.courses[0]!.tempoMap.splice(
      0,
      1,
      { atBeat: 0, bpm: 12 },
      { atBeat: 4, bpm: 96 },
    )
    expect(() =>
      compileSongRunnerCourseDocument(source, SINGING_CURRENT_CURRENT_CATALOG),
    ).toThrow(
      '$.courses[0].checkpoints[0].countInBeats must produce at most 16 seconds of count-in audio.',
    )
  })

  it('accepts supported course-duration and count-in boundaries', () => {
    const source = sourceClone()
    source.courses[0]!.obstacles = []
    source.courses[0]!.tempoMap = [{ atBeat: 0, bpm: 160 / 3 }]
    const durationBoundary = compileSongRunnerCourseDocument(
      source,
      SINGING_CURRENT_CURRENT_CATALOG,
    )[0]!
    expect(durationBoundary.lengthCourseSeconds).toBeCloseTo(180, 12)

    source.courses[0]!.tempoMap = [{ atBeat: 0, bpm: 60 }]
    source.courses[0]!.checkpoints[0]!.countInBeats = 16
    const countInBoundary = compileSongRunnerCourseDocument(
      source,
      SINGING_CURRENT_CURRENT_CATALOG,
    )[0]!
    expect(countInBoundary.checkpoints[0]!.countInBeats).toBe(16)
    expect(countInBoundary.lengthCourseSeconds).toBe(160)
  })

  it('rejects separated blockers whose body-expanded envelopes have no shared clear lane', () => {
    const source = nearbyBlockerSource(19.6)
    expect(() =>
      compileSongRunnerCourseDocument(
        source,
        SINGING_CURRENT_RESPONSIVE_CATALOG,
      ),
    ).toThrow(
      '$.courses[0].obstacles[1] body collision envelope overlaps obstacle "squeeze-right" without a shared clear lane.',
    )
  })

  it('rejects opposite-side blockers with a clear longitudinal gap but no time to change lanes', () => {
    const source = nearbyBlockerSource(19.9)
    expect(() =>
      compileSongRunnerCourseDocument(
        source,
        SINGING_CURRENT_RESPONSIVE_CATALOG,
      ),
    ).toThrow(
      '$.courses[0].obstacles[1] leaves no reachable lane to the finish.',
    )
  })

  it('allows overlapping body envelopes with a common safe lane and sufficiently spaced opposite lanes', () => {
    const shared = compileSongRunnerCourseDocument(
      nearbyBlockerSource(19.6, [0, 1]),
      SINGING_CURRENT_RESPONSIVE_CATALOG,
    )[0]!
    expect(
      shared.obstacles.map(
        (obstacle) => obstacle.certifiedActions[0]!.reachableLanes,
      ),
    ).toEqual([[2], [2]])
    const spaced = compileSongRunnerCourseDocument(
      nearbyBlockerSource(22),
      SINGING_CURRENT_RESPONSIVE_CATALOG,
    )[0]!
    expect(
      spaced.obstacles.map(
        (obstacle) => obstacle.certifiedActions[0]!.reachableLanes,
      ),
    ).toEqual([[2], [0]])
  })

  it('rejects a restart lane that cannot clear the next blocker after a short safe runway', () => {
    const source = responsiveSourceClone()
    const course = source.courses[0]!
    course.obstacles = [
      {
        id: 'too-soon-after-respawn',
        atBeat: 16.5,
        laneMask: [0, 1],
        profileId: 'runner-lane-gate-training-v1',
      },
    ]
    course.checkpoints.splice(1, 0, {
      id: 'unsafe-restart',
      atBeat: 16,
      respawnLane: 0,
      countInBeats: 4,
    })
    course.track.spawnRunwayBeats = 0.01
    expect(() =>
      compileSongRunnerCourseDocument(
        source,
        SINGING_CURRENT_RESPONSIVE_CATALOG,
      ),
    ).toThrow(
      '$.courses[0].checkpoints[1] leaves no reachable lane through obstacle "too-soon-after-respawn".',
    )

    course.checkpoints[1]!.respawnLane = 2
    expect(
      compileSongRunnerCourseDocument(
        source,
        SINGING_CURRENT_RESPONSIVE_CATALOG,
      )[0]!.checkpoints[1]!.respawnLane,
    ).toBe(2)
  })

  it('rejects empty checkpoints with an authored-path error before reachability', () => {
    const source = responsiveSourceClone()
    source.courses[0]!.checkpoints = []
    expect(() =>
      compileSongRunnerCourseDocument(
        source,
        SINGING_CURRENT_RESPONSIVE_CATALOG,
      ),
    ).toThrow('$.courses[0].checkpoints must begin at beat 0.')
  })

  it('bounds authored chunk allocation before creating runtime chunks', () => {
    const source = responsiveSourceClone()
    source.courses[0]!.track.chunkBeats = 0.25
    expect(() =>
      compileSongRunnerCourseDocument(
        source,
        SINGING_CURRENT_RESPONSIVE_CATALOG,
      ),
    ).toThrow('$.courses[0].track.chunkBeats must produce at most 256 chunks.')
  })

  it('rejects finite authored meters per beat that overflow the runtime course length', () => {
    const source = responsiveSourceClone()
    source.courses[0]!.obstacles = []
    source.courses[0]!.track.metersPerBeat = 1e308

    expect(() =>
      compileSongRunnerCourseDocument(
        source,
        SINGING_CURRENT_RESPONSIVE_CATALOG,
      ),
    ).toThrow(
      '$.courses[0].track.metersPerBeat must produce a finite course length.',
    )
  })

  it.each([0.5, 0.78])(
    'rejects blocker escape lanes whose bodies touch its envelope at spacing %s',
    (spacing) => {
      const source = responsiveBlockerSourceClone()
      source.courses[0]!.track.laneCenters = [-spacing, 0, spacing]

      expect(() =>
        compileSongRunnerCourseDocument(
          source,
          SINGING_CURRENT_RESPONSIVE_CATALOG,
        ),
      ).toThrow(
        '$.courses[0].obstacles[0].laneMask blockers must leave at least one lane clear of the runner body.',
      )
    },
  )

  it('certifies only collision-free lanes and enough transitions for uneven lane spacing', () => {
    const source = responsiveBlockerSourceClone()
    source.courses[0]!.track.laneCenters = [-0.65, 0, 1.25]

    const course = compileSongRunnerCourseDocument(
      source,
      SINGING_CURRENT_RESPONSIVE_CATALOG,
    )[0]!
    const obstacle = course.obstacles[0]!
    const action = obstacle.certifiedActions[0]!
    const contactSeconds = runnerBeatToSeconds(
      course.tempoSegments,
      source.courses[0]!.obstacles[0]!.atBeat,
    )
    expect(
      stepRunnerMovement(
        course,
        createRunnerMovementState(course, 0),
        contactSeconds - course.movement.fixedStepSeconds,
        contactSeconds,
      ).collided,
    ).toBe(true)
    expect(
      stepRunnerMovement(
        course,
        createRunnerMovementState(course, 2),
        contactSeconds - course.movement.fixedStepSeconds,
        contactSeconds,
      ).collided,
    ).toBe(false)
    expect(action.reachableLanes).toEqual([2])
    expect(
      action.landingOpenCourseSeconds - action.launchOpenCourseSeconds,
    ).toBeGreaterThanOrEqual(2 * course.movement.laneChangeSeconds)
  })

  it('rejects checkpoint runways when the runner body touches an adjacent blocker', () => {
    const source = responsiveBlockerSourceClone()
    const course = source.courses[0]!
    course.track.laneCenters = [-0.65, 0, 1.25]
    course.checkpoints.splice(1, 0, {
      id: 'touching-body',
      atBeat: 16,
      respawnLane: 0,
      countInBeats: 4,
    })

    expect(() =>
      compileSongRunnerCourseDocument(
        source,
        SINGING_CURRENT_RESPONSIVE_CATALOG,
      ),
    ).toThrow(
      '$.courses[0].checkpoints[1] runway intersects blocker "first-lane-gate".',
    )
  })

  it('compiles the approved 160-beat timing and literal content', () => {
    expect(SINGING_CURRENT_CURRENT.id).toBe('the-singing-current-v1')
    expect(SINGING_CURRENT_CURRENT.lengthBeats).toBe(160)
    expect(SINGING_CURRENT_CURRENT.lengthMeters).toBe(192)
    expect(SINGING_CURRENT_CURRENT.laneCenters).toEqual([-2, 0, 2])
    expect(SINGING_CURRENT_CURRENT.groundFeetY).toBe(0)
    expect(SINGING_CURRENT_CURRENT.fallBelowFeetY).toBe(-3)
    expect(
      SINGING_CURRENT_CURRENT.tempoSegments[0]?.endCourseSeconds,
    ).toBeCloseTo(40, 12)
    expect(
      SINGING_CURRENT_CURRENT.tempoSegments[1]?.endCourseSeconds,
    ).toBeCloseTo(57.77777777777778, 12)
    expect(SINGING_CURRENT_CURRENT.lengthCourseSeconds).toBeCloseTo(
      90.88122605363984,
      12,
    )
    expect(
      SINGING_CURRENT_CURRENT.targets.map((target) => [
        target.notes[0]?.startBeat,
        target.notes.at(-1)?.endBeat,
      ]),
    ).toEqual([
      [8, 12],
      [32, 34],
      [40, 42],
      [52, 56],
      [68, 74],
      [100, 108],
      [120, 124],
      [148, 156],
    ])
    expect(
      SINGING_CURRENT_CURRENT.rewards.pickups.map((pickup) => pickup.beat),
    ).toEqual([60, 62, 114, 118])
    expect(
      SINGING_CURRENT_CURRENT.checkpoints.map((checkpoint) => checkpoint.beat),
    ).toEqual([0, 64, 96])
    expect(SINGING_CURRENT_CURRENT.chunks).toHaveLength(10)
    expect(
      new Set(
        SINGING_CURRENT_CURRENT.targets.map((target) => target.glassProfileId),
      ),
    ).toEqual(new Set(['runner-score-window-v1']))
    expect(SINGING_CURRENT_CURRENT.preloadAssetProfileIds).toContain(
      'cloudway-lab-frost-gold-arch-v1',
    )
    expect(SINGING_CURRENT_CURRENT.preloadAssetProfileIds).toContain(
      'museum-environment-v2',
    )
    expect(SINGING_CURRENT_CURRENT.preloadAssetProfileIds).not.toContain(
      'cloudway-platform-kit-v1',
    )
    expect(SINGING_CURRENT_CURRENT.preloadAssetProfileIds).not.toContain(
      'cloudway-lab-frosted-scroll-wall-v1',
    )
    expect(SINGING_CURRENT_CURRENT.preloadAssetProfileIds).not.toContain(
      'pearl-ribbon-lantern-v1',
    )
    expect(SINGING_CURRENT_CURRENT.preloadAssetProfileIds).not.toContain(
      'runner-first-flight-v1',
    )
    expect(SINGING_CURRENT_CURRENT.preloadAssetProfileIds).not.toContain(
      'runner-staff-glass-v1',
    )
    expect(
      SINGING_CURRENT_CURRENT.preloadAssetProfileIds.some((assetId) =>
        /^(g01|g14|g22)-/.test(assetId),
      ),
    ).toBe(false)
  })

  it('resolves glide endpoints, merged full-width gaps, and landing margins', () => {
    const arc = SINGING_CURRENT_CURRENT.targets.find(
      (target) => target.id === 'arc-diadem',
    )!
    expect(
      arc.notes.map((note) => [
        note.startOffsetSemitones,
        note.endOffsetSemitones,
        note.connection,
      ]),
    ).toEqual([
      [0, 0, 'separate'],
      [0, 2, 'glide'],
      [2, 0, 'glide'],
    ])
    const gaps = SINGING_CURRENT_CURRENT.obstacles.filter(
      (obstacle) => obstacle.kind === 'gap',
    )
    expect(gaps).toHaveLength(2)
    for (const gap of gaps) {
      expect(gap.lateralSpans).toEqual([{ minLateralX: -3, maxLateralX: 3 }])
      expect(gap.landingEndCourseDistanceMeters).toBeGreaterThan(
        gap.landingStartCourseDistanceMeters,
      )
      expect(gap.certifiedActions[0]?.launchCloseCourseSeconds).toBeGreaterThan(
        gap.certifiedActions[0]!.launchOpenCourseSeconds,
      )
    }
    const secondGap = gaps[1]!
    const firstGap = gaps[0]!
    expect(firstGap.telegraphFromCourseSeconds).toBeCloseTo(14.375, 12)
    expect(firstGap.telegraphFromCourseSeconds).toBeLessThan(
      firstGap.certifiedActions[0]!.launchOpenCourseSeconds,
    )
    const melodyCheckpoint = SINGING_CURRENT_CURRENT.checkpoints.find(
      (checkpoint) => checkpoint.id === 'melody',
    )!
    expect(secondGap.landingEndCourseDistanceMeters).toBeLessThan(
      melodyCheckpoint.courseDistanceMeters,
    )
  })

  it('rejects unknown keys and inverted ground datums at precise paths', () => {
    const unknown = sourceClone()
    Object.assign(unknown.courses[0]!.track, { surprise: true })
    expect(() =>
      compileSongRunnerCourseDocument(unknown, SINGING_CURRENT_CURRENT_CATALOG),
    ).toThrow('$.courses[0].track.surprise is not supported.')

    const inverted = sourceClone()
    inverted.courses[0].track.fallBelowFeetY = 0
    expect(() =>
      compileSongRunnerCourseDocument(
        inverted,
        SINGING_CURRENT_CURRENT_CATALOG,
      ),
    ).toThrow('$.courses[0].track.fallBelowFeetY must be below groundFeetY.')
  })

  it('rejects target overlap through delivery settlement and tempo steps in protection', () => {
    const overlapSource = sourceClone()
    overlapSource.courses[0].voice.phrases[0].breathAfterBeats = 2
    overlapSource.courses[0].voice.targets =
      overlapSource.courses[0].voice.targets.slice(0, 2)
    overlapSource.courses[0].voice.targets[1].atBeat = 14
    const overlapCatalog = catalogClone()
    overlapCatalog.voiceProfiles[
      'runner-relative-pitch-v1'
    ].voice.judge.maximumDeliveryLatencySeconds = 1.5
    expect(() =>
      compileSongRunnerCourseDocument(overlapSource, overlapCatalog),
    ).toThrow('overlaps target "home-window" through settlement grace')

    const protectedTempo = sourceClone()
    protectedTempo.courses[0].tempoMap.splice(1, 0, { atBeat: 8, bpm: 100 })
    expect(() =>
      compileSongRunnerCourseDocument(
        protectedTempo,
        SINGING_CURRENT_CURRENT_CATALOG,
      ),
    ).toThrow('falls inside protected target "home-window"')
  })

  it('rejects action sweeps through singing and unsafe checkpoint runways', () => {
    const actionOverlap = sourceClone()
    actionOverlap.courses[0].obstacles[0].atBeat = 13
    expect(() =>
      compileSongRunnerCourseDocument(
        actionOverlap,
        SINGING_CURRENT_CURRENT_CATALOG,
      ),
    ).toThrow('certified action overlaps protected target "home-window"')

    const unsafeCheckpoint = sourceClone()
    unsafeCheckpoint.courses[0].checkpoints[1].atBeat = 24
    expect(() =>
      compileSongRunnerCourseDocument(
        unsafeCheckpoint,
        SINGING_CURRENT_CURRENT_CATALOG,
      ),
    ).toThrow('runway intersects gap "first-jump"')
  })

  it('rejects impossible routes and visible/collision geometry disagreement', () => {
    const impossible = sourceClone()
    impossible.courses[0].obstacles[0].laneMask = [0, 1, 2]
    expect(() =>
      compileSongRunnerCourseDocument(
        impossible,
        SINGING_CURRENT_CURRENT_CATALOG,
      ),
    ).toThrow('blockers must leave at least one lane open')

    const mismatchedCatalog = catalogClone()
    const gapProfile = mismatchedCatalog.obstacleProfiles['runner-gap-v1']
    if (gapProfile.kind !== 'gap') {
      throw new Error('Expected runner-gap-v1 to resolve to a gap profile.')
    }
    gapProfile.visibleLengthMeters = 1.2
    expect(() =>
      compileSongRunnerCourseDocument(
        SINGING_CURRENT_CURRENT_SOURCE_DOCUMENT,
        mismatchedCatalog,
      ),
    ).toThrow('must have matching positive visible and collision spans')
  })

  it('compiles explicit charge timing while scheduled targets retain schema-one defaults', () => {
    const scheduled = SINGING_CURRENT_CURRENT.targets[0]!
    expect(scheduled).toMatchObject({
      completionPolicy: 'scheduled',
      completionFingerprint: 'scheduled-v1',
      previewDurationSeconds:
        scheduled.endCourseSeconds - scheduled.onsetCourseSeconds,
      contactCourseSeconds: scheduled.endCourseSeconds,
    })

    const charge = SINGING_CURRENT_RESPONSIVE.targets[0]!
    expect(charge).toMatchObject({
      completionPolicy: 'charge',
      previewDurationSeconds: 0.6,
    })
    expect(charge.completionFingerprint).toMatch(/^charge-v1:/)
    expect(charge.judgeOpenCourseSeconds).toBe(charge.onsetCourseSeconds)
    expect(charge.notes[0]!.minimumReliableSeconds).toBe(0.6)
    expect(
      charge.contactCourseSeconds - charge.settleAfterCourseSeconds,
    ).toBeGreaterThanOrEqual(0.8)
    expect(charge.protectedUntilCourseSeconds).toBeGreaterThanOrEqual(
      charge.contactCourseSeconds,
    )
  })

  it('fingerprints charge policy and rejects unsafe or ambiguous charge authoring', () => {
    const changed = responsiveSourceClone()
    changed.courses[0].voice.targets[0].completion!.minimumReliableSecondsPerNote[0] = 0.55
    const changedCourse = compileSongRunnerCourseDocument(
      changed,
      SINGING_CURRENT_RESPONSIVE_CATALOG,
    )[0]!
    expect(changedCourse.targets[0]!.completionFingerprint).not.toBe(
      SINGING_CURRENT_RESPONSIVE.targets[0]!.completionFingerprint,
    )

    const wrongCount = responsiveSourceClone()
    wrongCount.courses[0].voice.targets[0].completion!.minimumReliableSecondsPerNote =
      [0.5, 0.5]
    expect(() =>
      compileSongRunnerCourseDocument(
        wrongCount,
        SINGING_CURRENT_RESPONSIVE_CATALOG,
      ),
    ).toThrow('must contain exactly one threshold per phrase note')

    const noReleaseRoom = responsiveSourceClone()
    noReleaseRoom.courses[0].voice.targets[0].completion!.contactAfterResponseSeconds = 0.9
    expect(() =>
      compileSongRunnerCourseDocument(
        noReleaseRoom,
        SINGING_CURRENT_RESPONSIVE_CATALOG,
      ),
    ).toThrow('must leave at least 0.8 seconds after late evidence settlement')

    const glide = responsiveSourceClone()
    glide.courses[0].voice.phrases[3].notes[1].connection = 'glide'
    expect(() =>
      compileSongRunnerCourseDocument(
        glide,
        SINGING_CURRENT_RESPONSIVE_CATALOG,
      ),
    ).toThrow('timed glides remain scheduled')
  })
})
