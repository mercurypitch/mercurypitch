// Slide capability proofs — real overhead clearance, held-input lifecycle and certified course isolation.

import { describe, expect, it } from 'vitest'
import { compileSongRunnerCourse } from './compile-course'
import type { CompiledRunnerCourse, RunnerBlockerCollisionProfile, } from './contracts'
import { SINGING_CURRENT_CONTINUOUS_CATALOG, SINGING_CURRENT_CONTINUOUS_SOURCE, SINGING_CURRENT_RESPONSIVE_CATALOG, SINGING_CURRENT_RESPONSIVE_SOURCE, } from './first-course'
import { createSongRunnerGame } from './game'
import { applyRunnerMovementInput, createRunnerMovementState, stepRunnerMovement, } from './movement'
import { runnerCourseDistanceAt } from './movement'
import type { RunnerBlockerCatalogProfile, SongRunnerCourseCatalog, SongRunnerCourseSource, } from './source'
import { runnerBodyLateralBounds } from './track-bounds'

const rectangle = (bottom: number) => [
  { zFraction: -0.5, yFraction: bottom },
  { zFraction: 0.5, yFraction: bottom },
  { zFraction: 0.5, yFraction: 1 },
  { zFraction: -0.5, yFraction: 1 },
]
const archShape: RunnerBlockerCollisionProfile = {
  kind: 'convex-yz-bands',
  bands: [
    { minXFraction: -0.5, maxXFraction: -0.33, vertices: rectangle(0) },
    { minXFraction: -0.33, maxXFraction: 0.33, vertices: rectangle(0.5) },
    { minXFraction: 0.33, maxXFraction: 0.5, vertices: rectangle(0) },
  ],
}

function fixture(mode: 'lanes' | 'continuous') {
  const accepted =
    mode === 'lanes'
      ? SINGING_CURRENT_RESPONSIVE_SOURCE
      : SINGING_CURRENT_CONTINUOUS_SOURCE
  const catalog: SongRunnerCourseCatalog =
    mode === 'lanes'
      ? SINGING_CURRENT_RESPONSIVE_CATALOG
      : SINGING_CURRENT_CONTINUOUS_CATALOG
  const source: SongRunnerCourseSource = {
    ...accepted,
    id: `slide-test-${mode}`,
    movementProfileId: 'slide-test',
    tempoMap: [{ atBeat: 0, bpm: 120 }],
    track: {
      ...accepted.track,
      lengthBeats: 32,
      metersPerBeat: 1.5,
      chunkBeats: 8,
    },
    voice: {
      ...accepted.voice,
      targets: [{ ...accepted.voice.targets[0]!, atBeat: 24 }],
    },
    checkpoints: [accepted.checkpoints[0]!],
    obstacles: [{ id: 'arch', atBeat: 16, laneMask: [1], profileId: 'arch' }],
    rewards: {
      ...accepted.rewards,
      pickups: [],
      singingStarTargetIds: [],
      finishRewardIds: ['slide-finish'],
    },
  }
  const arch: RunnerBlockerCatalogProfile = {
    kind: 'blocker',
    id: 'arch',
    longitudinalHalfLengthMeters: 0.6,
    laneHalfWidthMeters: 1.5,
    minYOffsetMeters: 0,
    maxYOffsetMeters: 1.2,
    visibleLongitudinalHalfLengthMeters: 0.6,
    visibleLaneHalfWidthMeters: 1.5,
    visibleMinYOffsetMeters: 0,
    visibleMaxYOffsetMeters: 1.2,
    telegraphLeadBeats: 10,
    assetProfileIds: [],
    collisionProfile: archShape,
    traversal: {
      kind: 'slide-under',
      clearanceHeightMeters: 0.55,
      clearanceMinXFraction: -0.32,
      clearanceMaxXFraction: 0.32,
      exitRunwayMeters: 2,
    },
  }
  const selected: SongRunnerCourseCatalog = {
    ...catalog,
    movementProfiles: {
      ...catalog.movementProfiles,
      'slide-test': {
        ...catalog.movementProfiles[accepted.movementProfileId]!,
        id: 'slide-test',
        slide: {
          version: 1,
          bodyHeightMeters: 0.3,
          enterSeconds: 0.18,
          exitSeconds: 0.15,
        },
      },
    },
    obstacleProfiles: { ...catalog.obstacleProfiles, arch },
  }
  return {
    source,
    catalog: selected,
    arch,
    course: compileSongRunnerCourse(source, selected),
  }
}

function runMovement(
  course: CompiledRunnerCourse,
  state: ReturnType<typeof createRunnerMovementState>,
  start: number,
  end: number,
  step = 1 / 120,
) {
  let collided = false
  for (let t = start; t < end - 1e-9; ) {
    const next = Math.min(end, t + step)
    collided ||= stepRunnerMovement(course, state, t, next).collided
    t = next
  }
  return collided
}

function advance(
  game: ReturnType<typeof createSongRunnerGame>,
  epoch: string,
  end: number,
  hz = 60,
  hitch = false,
) {
  let hitched = false
  for (
    let t = game.snapshot().courseSeconds;
    t < end - 1e-9 && game.snapshot().status === 'running';
  ) {
    const dt = hitch && !hitched && t >= 7.9 ? 0.1 : 1 / hz
    if (dt === 0.1) hitched = true
    t = Math.min(end, t + dt)
    game.advanceTo(epoch, t)
  }
}

for (const mode of ['lanes', 'continuous'] as const)
  describe(`${mode} real slide`, () => {
    it('requires the explicit versioned capability and preserves old course/save identities', () => {
      const { course, source, catalog } = fixture(mode)
      expect(course.version).toBe(3)
      const accepted =
        mode === 'lanes'
          ? SINGING_CURRENT_RESPONSIVE_SOURCE
          : SINGING_CURRENT_CONTINUOUS_SOURCE
      const acceptedCatalog =
        mode === 'lanes'
          ? SINGING_CURRENT_RESPONSIVE_CATALOG
          : SINGING_CURRENT_CONTINUOUS_CATALOG
      const original = compileSongRunnerCourse(accepted, acceptedCatalog)
      expect(original.version).toBe(mode === 'lanes' ? 1 : 2)
      const game = createSongRunnerGame(original, { comfortableMidi: 60 })
      game.beginEpoch('old')
      expect(
        game.input({
          epoch: 'old',
          sequence: 1,
          atCourseSeconds: 0,
          action: 'slide',
          held: true,
        }),
      ).toBe(false)
      expect(game.snapshot().player.slide).toBeUndefined()
      expect(
        createSongRunnerGame(course, {
          comfortableMidi: 60,
          progress: game.saveProgress(),
        }).saveProgress().courseId,
      ).toBe(source.id)
      const unsupported = {
        ...catalog,
        movementProfiles: {
          ...catalog.movementProfiles,
          'slide-test': {
            ...catalog.movementProfiles['slide-test']!,
            slide: undefined,
          },
        },
      }
      expect(() => compileSongRunnerCourse(source, unsupported)).toThrow(
        'versioned slide',
      )
      expect(() =>
        createSongRunnerGame(
          { ...course, version: 2 },
          { comfortableMidi: 60 },
        ),
      ).toThrow('valid compiled course')
    })

    it('hits while upright or too late, clears with the low body, and keeps both arch feet solid', () => {
      const { course } = fixture(mode)
      const standing = createRunnerMovementState(course, 1)
      expect(runMovement(course, standing, 7, 8.5)).toBe(true)
      const slide = createRunnerMovementState(course, 1)
      applyRunnerMovementInput(course, slide, 'slide', 7, 0, true)
      expect(runMovement(course, slide, 7, 8.5)).toBe(false)
      expect(slide.slideProgress).toBe(1)
      expect(slide.grounded).toBe(true)
      for (const x of [-1.1, 1.1]) {
        const foot = createRunnerMovementState(course, 1)
        foot.lateralX = x
        applyRunnerMovementInput(course, foot, 'slide', 7, 0, true)
        expect(runMovement(course, foot, 7, 8.5)).toBe(true)
      }
      const late = createRunnerMovementState(course, 1)
      applyRunnerMovementInput(course, late, 'slide', 7.68, 0, true)
      expect(runMovement(course, late, 7.68, 8.5)).toBe(true)
    })

    it.each([1 / 120, 1 / 60, 1 / 30, 0.05, 0.1])(
      'retains a lowered body on release under overhead and restores it only outside at dt=%s',
      (dt) => {
        const { course } = fixture(mode)
        const state = createRunnerMovementState(course, 1)
        applyRunnerMovementInput(course, state, 'slide', 7, 0, true)
        expect(runMovement(course, state, 7, 8, dt)).toBe(false)
        applyRunnerMovementInput(course, state, 'slide', 8, 0, false)
        expect(runMovement(course, state, 8, 8.2, dt)).toBe(false)
        expect(state.slideProgress).toBe(1)
        expect(state.slideHeld).toBe(false)
        expect(runMovement(course, state, 8.2, 8.8, dt)).toBe(false)
        expect(state.slideProgress).toBe(0)
        expect(state.slidePhase).toBe('standing')
      },
    )

    it('rejects jump during lowering/held/blocked release and ignores an airborne slide press', () => {
      const { course } = fixture(mode)
      const state = createRunnerMovementState(course, 1)
      applyRunnerMovementInput(course, state, 'slide', 7, 0, true)
      runMovement(course, state, 7, 8)
      applyRunnerMovementInput(course, state, 'slide', 8, 0, false)
      applyRunnerMovementInput(course, state, 'jump', 8)
      expect(runMovement(course, state, 8, 8.2)).toBe(false)
      expect(state.grounded).toBe(true)
      const airborne = createRunnerMovementState(course, 1)
      applyRunnerMovementInput(course, airborne, 'jump', 1)
      runMovement(course, airborne, 1, 1.05)
      expect(airborne.grounded).toBe(false)
      applyRunnerMovementInput(course, airborne, 'slide', 1.05, 0, true)
      runMovement(course, airborne, 1.05, 2.5)
      expect(airborne.slideProgress).toBe(0)
      expect(airborne.slideHeld).toBe(false)
      expect(airborne.grounded).toBe(true)
    })

    it('finishes identically at 20/30/60/120Hz including a 100ms hitch, then resets on a new epoch', () => {
      const { course } = fixture(mode)
      let expected:
        | ReturnType<ReturnType<typeof createSongRunnerGame>['snapshot']>
        | undefined
      for (const hz of [20, 30, 60, 120]) {
        const game = createSongRunnerGame(course, { comfortableMidi: 60 })
        game.beginEpoch('slide')
        game.input({
          epoch: 'slide',
          sequence: 1,
          atCourseSeconds: 4,
          action: 'slide',
          held: true,
        })
        game.input({
          epoch: 'slide',
          sequence: 2,
          atCourseSeconds: 8,
          action: 'slide',
          held: false,
        })
        advance(game, 'slide', course.lengthCourseSeconds, hz, true)
        const snapshot = game.snapshot()
        expect(snapshot.status).toBe('finished')
        expect(snapshot.player.slide).toMatchObject({
          phase: 'standing',
          progress: 0,
          bodyHeightMeters: course.movement.bodyHeight,
        })
        expected ??= snapshot
        expect(snapshot.player).toEqual(expected.player)
        expect(game.beginEpoch('new')).toMatchObject({ ok: true })
        expect(game.snapshot().player.slide?.progress).toBe(0)
      }
    })

    it('cancels held input on pause/recovery and rewinds safely without a stale slide', () => {
      const { course } = fixture(mode)
      const game = createSongRunnerGame(course, { comfortableMidi: 60 })
      game.beginEpoch('paused')
      game.input({
        epoch: 'paused',
        sequence: 1,
        atCourseSeconds: 4,
        action: 'slide',
        held: true,
      })
      advance(game, 'paused', 8)
      expect(game.snapshot().player.slide?.progress).toBe(1)
      game.pause()
      expect(game.snapshot().status).toBe('paused')
      expect(
        game.input({
          epoch: 'paused',
          sequence: 2,
          atCourseSeconds: 8,
          action: 'slide',
          held: true,
        }),
      ).toBe(false)
      expect(game.prepareCheckpoint('start')).toMatchObject({ ok: true })
      expect(game.snapshot().player.slide?.progress).toBe(0)
      game.beginEpoch('recovery', 'start')
      game.input({
        epoch: 'recovery',
        sequence: 1,
        atCourseSeconds: 4,
        action: 'slide',
        held: true,
      })
      advance(game, 'recovery', 8)
      game.advanceTo('recovery', 8.5)
      expect(game.snapshot().status).toBe('recovering')
      game.beginEpoch('restored', 'start')
      advance(game, 'restored', 0.5)
      expect(game.snapshot().player.slide?.phase).toBe('standing')
    })

    it('rejects malformed capability, false opening dimensions, late cues, short exit and unsafe checkpoint starts', () => {
      const { source, catalog, arch } = fixture(mode)
      const compileArch = (replacement: RunnerBlockerCatalogProfile) => () =>
        compileSongRunnerCourse(source, {
          ...catalog,
          obstacleProfiles: { ...catalog.obstacleProfiles, arch: replacement },
        })
      if (arch.traversal?.kind !== 'slide-under')
        throw new Error('fixture requires slide')
      for (const mutation of [
        { clearanceHeightMeters: 0.29 },
        { clearanceHeightMeters: 0.65 },
        { clearanceMinXFraction: -0.01, clearanceMaxXFraction: 0.01 },
        { exitRunwayMeters: 0.3 },
      ])
        expect(
          compileArch({
            ...arch,
            traversal: { ...arch.traversal, ...mutation },
          }),
        ).toThrow(/slide/)
      expect(compileArch({ ...arch, telegraphLeadBeats: 0.1 })).toThrow(
        'certified approach',
      )
      expect(() =>
        compileSongRunnerCourse(
          {
            ...source,
            checkpoints: [
              ...source.checkpoints,
              { id: 'unsafe', atBeat: 16, respawnLane: 1, countInBeats: 4 },
            ],
          },
          catalog,
        ),
      ).toThrow('runway intersects blocker')
      const profile = catalog.movementProfiles['slide-test']!
      for (const bodyHeightMeters of [NaN, 0, profile.bodyHeight])
        expect(() =>
          compileSongRunnerCourse(source, {
            ...catalog,
            movementProfiles: {
              ...catalog.movementProfiles,
              'slide-test': {
                ...profile,
                slide: { ...profile.slide!, bodyHeightMeters },
              },
            },
          }),
        ).toThrow('malformed slide')
    })

    it('certifies enough time to lower at both launch limits with no hidden low-body benefit', () => {
      const { course } = fixture(mode)
      const action = course.obstacles[0]!.certifiedActions[0]!
      expect(action.kind).toBe('slide')
      for (const launch of [
        action.launchOpenCourseSeconds,
        action.launchCloseCourseSeconds,
      ]) {
        const state = createRunnerMovementState(course, 1)
        applyRunnerMovementInput(course, state, 'slide', launch, 0, true)
        expect(
          runMovement(course, state, launch, action.landingCloseCourseSeconds),
        ).toBe(false)
        expect(
          runnerCourseDistanceAt(course, action.landingCloseCourseSeconds),
        ).toBeGreaterThan(course.obstacles[0]!.maxCourseDistanceMeters)
      }
    })
  })

describe('slide approach and exit certificates', () => {
  it('steers from the whole continuous entry domain, brakes, and clears at either launch limit', () => {
    const { course } = fixture('continuous')
    if (course.movement.kind !== 'continuous')
      throw new Error('continuous fixture')
    const movement = course.movement
    const bounds = runnerBodyLateralBounds(course)
    const action = course.obstacles[0]!.certifiedActions[0]!
    const corridor = action.slideCorridor!
    const centre = (corridor.minLateralX + corridor.maxLateralX) / 2
    for (const launch of [
      action.launchOpenCourseSeconds,
      action.launchCloseCourseSeconds,
    ]) {
      for (const startX of [bounds.minLateralX, 0, bounds.maxLateralX]) {
        for (const startVelocity of [
          -movement.maxLateralSpeedMetersPerSecond,
          0,
          movement.maxLateralSpeedMetersPerSecond,
        ]) {
          const state = createRunnerMovementState(course, 1)
          state.lateralX = startX
          state.lateralVelocityMetersPerSecond = startVelocity
          let t = launch
          const step = movement.fixedStepSeconds
          const phase = (seconds: number, axis: number) => {
            applyRunnerMovementInput(course, state, 'steer', t, axis)
            const end = t + Math.ceil(seconds / step) * step
            expect(runMovement(course, state, t, end, step)).toBe(false)
            t = end
          }
          // Real fixed-step input phases, including outward initial momentum.
          applyRunnerMovementInput(course, state, 'slide', t, 0, true)
          phase(
            Math.abs(startVelocity) /
              movement.lateralBrakingMetersPerSecondSquared,
            0,
          )
          const distance = Math.abs(centre - state.lateralX)
          const direction = Math.sign(centre - state.lateralX)
          const peak = Math.min(
            movement.maxLateralSpeedMetersPerSecond,
            Math.sqrt(
              (2 * distance) /
                (1 / movement.lateralAccelerationMetersPerSecondSquared +
                  1 / movement.lateralBrakingMetersPerSecondSquared),
            ),
          )
          const covered =
            peak ** 2 /
              (2 * movement.lateralAccelerationMetersPerSecondSquared) +
            peak ** 2 / (2 * movement.lateralBrakingMetersPerSecondSquared)
          phase(
            peak / movement.lateralAccelerationMetersPerSecondSquared +
              Math.max(0, distance - covered) /
                movement.maxLateralSpeedMetersPerSecond,
            direction,
          )
          phase(
            Math.abs(state.lateralVelocityMetersPerSecond) /
              movement.lateralBrakingMetersPerSecondSquared,
            0,
          )
          expect(state.lateralX).toBeGreaterThanOrEqual(corridor.minLateralX)
          expect(state.lateralX).toBeLessThanOrEqual(corridor.maxLateralX)
          expect(state.lateralVelocityMetersPerSecond).toBeCloseTo(0)
          expect(t).toBeLessThan(action.landingOpenCourseSeconds)
          expect(
            runMovement(
              course,
              state,
              t,
              action.landingCloseCourseSeconds,
              step,
            ),
          ).toBe(false)
        }
      }
    }
  })

  it('provides a lane-change approach from either outside lane before lowering', () => {
    const { course } = fixture('lanes')
    const action = course.obstacles[0]!.certifiedActions[0]!
    for (const lane of [0, 2] as const) {
      const state = createRunnerMovementState(course, lane)
      const t = action.launchCloseCourseSeconds
      applyRunnerMovementInput(
        course,
        state,
        lane === 0 ? 'lane-right' : 'lane-left',
        t,
      )
      applyRunnerMovementInput(course, state, 'slide', t, 0, true)
      expect(
        runMovement(course, state, t, action.landingCloseCourseSeconds),
      ).toBe(false)
      expect(state.lateralX).toBe(course.laneCenters[1])
    }
  })

  it('does not certify overlapping voice, airborne approaches, or obstructed exit ground', () => {
    for (const mode of ['lanes', 'continuous'] as const) {
      const { source, catalog, arch } = fixture(mode)
      const compile =
        (next: SongRunnerCourseSource, nextCatalog = catalog) =>
        () =>
          compileSongRunnerCourse(next, nextCatalog)
      expect(
        compile({
          ...source,
          voice: {
            ...source.voice,
            targets: [{ ...source.voice.targets[0]!, atBeat: 16 }],
          },
        }),
      ).toThrow('protected target')
      const gapProfile = Object.values(catalog.obstacleProfiles).find(
        (profile) => profile.kind === 'gap',
      )!
      expect(gapProfile).toBeDefined()
      const gap = {
        id: 'approach-gap',
        atBeat: 13.8,
        laneMask: [0, 1, 2] as const,
        profileId: gapProfile.id,
      }
      expect(
        compile({ ...source, obstacles: [gap, ...source.obstacles] }),
      ).toThrow(/approach intersects gap/)
      const lowArch = {
        ...arch,
        telegraphLeadBeats: 3,
        traversal: undefined,
        laneHalfWidthMeters: 0.1,
        visibleLaneHalfWidthMeters: 0.1,
      }
      expect(
        compile(
          {
            ...source,
            obstacles: [
              ...source.obstacles,
              {
                id: 'exit-block',
                atBeat: 17,
                laneMask: [0],
                profileId: 'exit-block',
              },
            ],
          },
          {
            ...catalog,
            obstacleProfiles: {
              ...catalog.obstacleProfiles,
              'exit-block': { ...lowArch, id: 'exit-block' },
            },
          },
        ),
      ).toThrow(/slide.*intersects/)
    }
  })
})
