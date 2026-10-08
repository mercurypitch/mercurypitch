// Hurdle safety proofs — reject impossible flights and sweep crown, lip, edge and checkpoint limits.

import { describe, expect, it } from 'vitest'
import { compileSongRunnerCourseDocument } from './compile-course'
import type { CompiledRunnerBlocker, CompiledRunnerCourse, RunnerBlockerCollisionProfile, RunnerBlockerConvexCollisionProfile, } from './contracts'
import { SINGING_CURRENT_CRYSTAL_CONTINUOUS_STUDY, SINGING_CURRENT_CRYSTAL_CONTINUOUS_STUDY_CATALOG, SINGING_CURRENT_CRYSTAL_CONTINUOUS_STUDY_SOURCE_DOCUMENT, SINGING_CURRENT_CRYSTAL_STUDY, SINGING_CURRENT_CRYSTAL_STUDY_CATALOG, SINGING_CURRENT_CRYSTAL_STUDY_SOURCE_DOCUMENT, } from './crystal-obstacle-study'
import { SINGING_CURRENT, SINGING_CURRENT_SOURCE } from './first-course'
import { runnerFixedStepAtOrAfter } from './fixed-step'
import { applyRunnerMovementInput, createRunnerMovementState, stepRunnerMovement, } from './movement'
import { runnerMovementCue, runnerUsefulJumpWindow } from './movement-cues'
import type { RunnerBlockerCatalogProfile, SongRunnerCourseCatalog, SongRunnerSourceDocument, } from './source'
import { runnerBeatToSeconds } from './tempo'

type Mutable<T> = T extends readonly (infer Entry)[]
  ? Mutable<Entry>[]
  : T extends object
    ? { -readonly [Key in keyof T]: Mutable<T[Key]> }
    : T
const variants = [
  [
    'lanes',
    SINGING_CURRENT_CRYSTAL_STUDY,
    SINGING_CURRENT_CRYSTAL_STUDY_SOURCE_DOCUMENT,
    SINGING_CURRENT_CRYSTAL_STUDY_CATALOG,
  ],
  [
    'continuous',
    SINGING_CURRENT_CRYSTAL_CONTINUOUS_STUDY,
    SINGING_CURRENT_CRYSTAL_CONTINUOUS_STUDY_SOURCE_DOCUMENT,
    SINGING_CURRENT_CRYSTAL_CONTINUOUS_STUDY_CATALOG,
  ],
] as const

// A deliberately simple analytic vault fixture, independent of the finished donor.
const vault: RunnerBlockerConvexCollisionProfile = {
  kind: 'convex-yz',
  vertices: [
    { zFraction: -0.5, yFraction: 0 },
    { zFraction: 0.5, yFraction: 0 },
    { zFraction: 0.5, yFraction: 0.06 },
    { zFraction: 0.35, yFraction: 0.7 },
    { zFraction: 0, yFraction: 1 },
    { zFraction: -0.35, yFraction: 0.7 },
    { zFraction: -0.5, yFraction: 0.06 },
  ],
}
const saddle: Extract<
  RunnerBlockerCollisionProfile,
  { kind: 'convex-yz-bands' }
> = {
  kind: 'convex-yz-bands',
  bands: [
    { minXFraction: -0.5, maxXFraction: -0.3, vertices: vault.vertices },
    {
      minXFraction: -0.3,
      maxXFraction: 0.3,
      vertices: vault.vertices.map((v) => ({
        ...v,
        yFraction: v.yFraction * 0.9,
      })),
    },
    { minXFraction: 0.3, maxXFraction: 0.5, vertices: vault.vertices },
  ],
}

function hurdle(course: CompiledRunnerCourse): CompiledRunnerBlocker {
  return course.obstacles.find(
    (obstacle): obstacle is CompiledRunnerBlocker =>
      obstacle.kind === 'blocker' && obstacle.traversal?.kind === 'jump-over',
  )!
}

function clone<T>(value: T): Mutable<T> {
  return JSON.parse(JSON.stringify(value)) as Mutable<T>
}

function secondsAtDistance(
  course: CompiledRunnerCourse,
  distance: number,
): number {
  return runnerBeatToSeconds(
    course.tempoSegments,
    distance / course.metersPerBeat,
  )
}

function run(
  course: CompiledRunnerCourse,
  state: ReturnType<typeof createRunnerMovementState>,
  start: number,
  end: number,
) {
  for (let time = start; time < end - 1e-9; ) {
    const next = Math.min(end, time + course.movement.fixedStepSeconds)
    const result = stepRunnerMovement(course, state, time, next)
    expect(result).toMatchObject({ collided: false, fell: false })
    time = next
  }
}

describe('bounded jump-over hurdle', () => {
  it('isolates shaped art and rewards while preserving every responsive singing window', () => {
    expect(
      SINGING_CURRENT_CRYSTAL_STUDY_SOURCE_DOCUMENT.courses[0]!.voice,
    ).toEqual(SINGING_CURRENT_SOURCE.voice)
    for (const [
      index,
      target,
    ] of SINGING_CURRENT_CRYSTAL_STUDY.targets.entries()) {
      const accepted = SINGING_CURRENT.targets[index]!
      expect({ ...target, chunkId: accepted.chunkId }).toEqual(accepted)
    }
    expect(
      SINGING_CURRENT.obstacles.some(
        (obstacle) =>
          obstacle.kind === 'blocker' && obstacle.traversal !== undefined,
      ),
    ).toBe(false)
    for (const [, course] of variants) {
      expect(course.id).not.toBe(SINGING_CURRENT.id)
      expect(
        course.rewards.finishRewardIds.some((id) =>
          SINGING_CURRENT.rewards.finishRewardIds.includes(id),
        ),
      ).toBe(false)
      const obstacle = hurdle(course)
      expect(obstacle.maxLateralX - obstacle.minLateralX).toBeCloseTo(1, 12)
      expect(
        obstacle.maxCourseDistanceMeters - obstacle.minCourseDistanceMeters,
      ).toBeCloseTo(0.7, 12)
      expect(obstacle.maxY - obstacle.minY).toBe(0.45)
      expect(obstacle.certifiedActions[0]!.kind).toBe('jump')
    }
  })

  it.each(variants)(
    'clears the whole crown at both certified limits and every checkpoint clock in %s mode',
    (_mode, original, document, catalog) => {
      const source = clone(document)
      source.courses[0]!.checkpoints.splice(1, 0, {
        id: 'hurdle-clock',
        atBeat: 24,
        respawnLane: 1,
        countInBeats: 4,
      })
      const course = compileSongRunnerCourseDocument(source, catalog)[0]!
      expect(course.movement.kind).toBe(original.movement.kind)
      const obstacle = hurdle(course)
      const action = obstacle.certifiedActions[0]!
      const tested = { ...course, obstacles: [obstacle] }
      const positions =
        course.movement.kind === 'continuous'
          ? [-2.72, -0.78, 0, 0.78, 2.72]
          : [0]
      const velocities =
        course.movement.kind === 'continuous' ? [-5, 0, 5] : [0]
      for (const checkpoint of course.checkpoints.filter(
        (c) => c.courseSeconds < action.launchOpenCourseSeconds,
      ))
        for (const chosen of [
          action.launchOpenCourseSeconds,
          action.launchCloseCourseSeconds,
        ])
          for (const x of positions)
            for (const velocity of velocities) {
              const launch = runnerFixedStepAtOrAfter(
                chosen,
                checkpoint.courseSeconds,
                course.movement.fixedStepSeconds,
              )
              const state = createRunnerMovementState(tested, 1)
              state.lateralX = x
              state.lateralVelocityMetersPerSecond = velocity
              applyRunnerMovementInput(
                tested,
                state,
                'steer',
                launch,
                -Math.sign(velocity),
              )
              applyRunnerMovementInput(tested, state, 'jump', launch)
              run(
                tested,
                state,
                launch,
                action.landingCloseCourseSeconds + 0.025,
              )
              expect(state.grounded).toBe(true)
              expect(state.feetY).toBe(course.groundFeetY)
            }
    },
  )

  it.each(variants)(
    'offers only the bounded solid-hurdle Jump cue in %s mode',
    (_mode, course) => {
      const obstacle = hurdle(course)
      const useful = runnerUsefulJumpWindow(course, obstacle)!
      const player = {
        ...createRunnerMovementState(course, 1),
        forwardSpeedMetersPerSecond: 2.6,
      }
      for (const courseSeconds of [
        useful.launchOpenCourseSeconds,
        useful.launchCloseCourseSeconds,
      ])
        expect(
          runnerMovementCue(course, {
            courseSeconds,
            courseDistanceMeters: 49,
            player,
          }),
        ).toEqual({ obstacleId: obstacle.id, stage: 'jump' })
      expect(
        runnerMovementCue(
          { ...course, obstacles: [obstacle] },
          {
            courseSeconds: obstacle.telegraphFromCourseSeconds,
            courseDistanceMeters: 45,
            player,
          },
        ),
      ).toBeNull()
    },
  )

  it.each(variants)(
    'rejects impossible crowns, widths in time, runways, protected singing and checkpoint placement in %s mode',
    (_mode, _course, document, originalCatalog) => {
      const compileWith = (
        change: (
          source: Mutable<SongRunnerSourceDocument>,
          profile: Mutable<RunnerBlockerCatalogProfile>,
        ) => void,
      ) => {
        const source = clone(document)
        const catalog: Mutable<SongRunnerCourseCatalog> = clone(originalCatalog)
        const profile = catalog.obstacleProfiles[
          'runner-rose-hurdle-v1'
        ] as Mutable<RunnerBlockerCatalogProfile>
        change(source, profile)
        return () => compileSongRunnerCourseDocument(source, catalog)
      }
      expect(
        compileWith((_source, profile) => {
          profile.maxYOffsetMeters = profile.visibleMaxYOffsetMeters = 1.01
        }),
      ).toThrow('crown is not clearable')
      expect(
        compileWith((_source, profile) => {
          profile.longitudinalHalfLengthMeters =
            profile.visibleLongitudinalHalfLengthMeters = 2
        }),
      ).toThrow('certified jump window')
      expect(
        compileWith((_source, profile) => {
          profile.traversal = { kind: 'jump-over', landingRunwayMeters: 0.2 }
        }),
      ).toThrow('authored landing runway')
      expect(
        compileWith((_source, profile) => {
          profile.telegraphLeadBeats = 0.1
        }),
      ).toThrow('certified jump window')
      expect(
        compileWith((source) => {
          source.courses[0]!.obstacles.find(
            (o) => o.id === 'rose-jump-hurdle',
          )!.atBeat = 35
        }),
      ).toThrow('protected target')
      expect(
        compileWith((source) => {
          source.courses[0]!.checkpoints.splice(1, 0, {
            id: 'unsafe-hurdle',
            atBeat: 32,
            respawnLane: 1,
            countInBeats: 4,
          })
        }),
      ).toThrow('runway intersects blocker')
      expect(
        compileWith((source) => {
          source.courses[0]!.obstacles.push({
            id: 'blocked-landing',
            atBeat: 34,
            laneMask: [0, 1, 2],
            profileId: 'runner-gap-catch-training-v1',
          })
          source.courses[0]!.obstacles.sort((a, b) => a.atBeat - b.atBeat)
        }),
      ).toThrow('hurdle landing runway intersects')
    },
  )

  it.each(variants)(
    'requires an explicit capability before certifying an all-lane low blocker in %s mode',
    (_mode, _course, document, originalCatalog) => {
      const source = clone(document)
      source.courses[0]!.obstacles.find(
        (o) => o.id === 'rose-jump-hurdle',
      )!.laneMask = [0, 1, 2]
      expect(
        compileSongRunnerCourseDocument(
          source,
          originalCatalog,
        )[0]!.obstacles.find((o) => o.id === 'rose-jump-hurdle')!
          .certifiedActions[0]!.kind,
      ).toBe('jump')
      const catalog = clone(originalCatalog)
      const profile = catalog.obstacleProfiles[
        'runner-rose-hurdle-v1'
      ] as Mutable<RunnerBlockerCatalogProfile>
      delete profile.traversal
      expect(() => compileSongRunnerCourseDocument(source, catalog)).toThrow(
        'leave at least one lane open',
      )
    },
  )

  it.each(variants)(
    'rejects nonconvex, nonfinite, mismatched and unbounded Y/Z profiles in %s mode',
    (_mode, _course, document, originalCatalog) => {
      for (const bad of [
        {
          ...vault,
          vertices: vault.vertices.map((v, i) =>
            i === 4 ? { ...v, yFraction: 0.05 } : v,
          ),
        },
        {
          ...vault,
          vertices: vault.vertices.map((v, i) =>
            i === 4 ? { ...v, yFraction: NaN } : v,
          ),
        },
        {
          ...vault,
          vertices: vault.vertices.map((v) => ({
            ...v,
            zFraction: v.zFraction * 0.9,
          })),
        },
        { ...vault, vertices: [...vault.vertices, ...vault.vertices] },
        {
          ...vault,
          vertices: Array.from({ length: 20 }, (_, i) => ({
            zFraction: Math.cos((i * Math.PI) / 10) / 2,
            yFraction: (1 + Math.sin((i * Math.PI) / 10)) / 2,
          })),
        },
      ]) {
        const catalog = clone(originalCatalog)
        ;(
          catalog.obstacleProfiles[
            'runner-rose-hurdle-v1'
          ] as Mutable<RunnerBlockerCatalogProfile>
        ).collisionProfile = clone(bad)
        expect(() =>
          compileSongRunnerCourseDocument(document, catalog),
        ).toThrow('convex Y/Z collision profile')
      }
    },
  )

  it.each(variants)(
    'uses the curved front lip and honors crown/lateral contacts in %s mode',
    (_mode, original) => {
      const obstacle = hurdle(original)
      const shaped = { ...obstacle, collisionProfile: vault }
      const course = { ...original, obstacles: [shaped] }
      const start = secondsAtDistance(
        course,
        obstacle.minCourseDistanceMeters - course.movement.bodyRadius + 0.07,
      )
      const body = (feetY: number, x = 0) => {
        const state = createRunnerMovementState(course, 1)
        state.grounded = false
        state.feetY = feetY
        state.lateralX = x
        return state
      }
      expect(
        stepRunnerMovement(course, body(0.3), start, start + 0.005).collided,
      ).toBe(false)
      expect(
        stepRunnerMovement(
          {
            ...course,
            obstacles: [{ ...shaped, collisionProfile: undefined }],
          },
          body(0.3),
          start,
          start + 0.005,
        ).collided,
      ).toBe(true)
      expect(
        stepRunnerMovement(course, body(0.1), start, start + 0.005).collided,
      ).toBe(true)
      const crown = secondsAtDistance(
        course,
        (obstacle.minCourseDistanceMeters + obstacle.maxCourseDistanceMeters) /
          2,
      )
      expect(
        stepRunnerMovement(course, body(0.45), crown, crown + 0.0001).collided,
      ).toBe(true)
      expect(
        stepRunnerMovement(course, body(0.4501), crown, crown + 0.0001)
          .collided,
      ).toBe(false)
      expect(
        stepRunnerMovement(
          course,
          body(0, obstacle.maxLateralX + course.movement.bodyRadius - 1e-5),
          crown,
          crown + 0.0001,
        ).collided,
      ).toBe(true)
      expect(
        stepRunnerMovement(
          course,
          body(0, obstacle.maxLateralX + course.movement.bodyRadius + 1e-5),
          crown,
          crown + 0.0001,
        ).collided,
      ).toBe(false)
    },
  )

  it.each(variants)(
    'keeps saddle interior, raised ends and exact band contact consistent at varied steps in %s mode',
    (_mode, original) => {
      const obstacle = hurdle(original)
      const shaped = { ...obstacle, collisionProfile: saddle }
      const course = { ...original, obstacles: [shaped] }
      const crown = secondsAtDistance(
        course,
        (obstacle.minCourseDistanceMeters + obstacle.maxCourseDistanceMeters) /
          2,
      )
      for (const dt of [1 / 120, 1 / 60, 1 / 30, 0.05, 0.2]) {
        const body = (x: number) => {
          const state = createRunnerMovementState(course, 1)
          state.grounded = false
          state.feetY = 0.42
          state.verticalVelocityMetersPerSecond =
            (course.movement.gravityMetersPerSecondSquared * dt) / 2
          state.lateralX = x
          return state
        }
        expect(
          stepRunnerMovement(course, body(0), crown, crown + dt).collided,
        ).toBe(false)
        expect(
          stepRunnerMovement(course, body(-0.4), crown, crown + dt).collided,
        ).toBe(true)
        expect(
          stepRunnerMovement(course, body(0.4), crown, crown + dt).collided,
        ).toBe(true)
        expect(
          stepRunnerMovement(course, body(0.019), crown, crown + dt).collided,
        ).toBe(false)
        expect(
          stepRunnerMovement(course, body(0.02), crown, crown + dt).collided,
        ).toBe(true)
        expect(
          stepRunnerMovement(
            { ...course, obstacles: [{ ...shaped, collisionProfile: vault }] },
            body(0),
            crown,
            crown + dt,
          ).collided,
        ).toBe(true)
      }
    },
  )

  it.each(variants)(
    'rejects gaps, overlaps, bad extents and excessive saddle bands in %s mode',
    (_mode, _course, document, originalCatalog) => {
      const invalid = [
        {
          ...saddle,
          bands: saddle.bands.map((band, index) =>
            index === 1 ? { ...band, minXFraction: -0.29 } : band,
          ),
        },
        {
          ...saddle,
          bands: saddle.bands.map((band, index) =>
            index === 1 ? { ...band, minXFraction: -0.31 } : band,
          ),
        },
        {
          ...saddle,
          bands: saddle.bands.map((band, index) =>
            index === 0 ? { ...band, minXFraction: NaN } : band,
          ),
        },
        {
          ...saddle,
          bands: saddle.bands.map((band, index) =>
            index === 0 ? { ...band, maxXFraction: -0.5 } : band,
          ),
        },
        {
          ...saddle,
          bands: [...saddle.bands, ...saddle.bands, ...saddle.bands],
        },
        {
          ...saddle,
          bands: saddle.bands.map((band) => ({
            ...band,
            vertices: band.vertices.map((v) => ({
              ...v,
              yFraction: v.yFraction * 0.99,
            })),
          })),
        },
      ]
      for (const bad of invalid) {
        const catalog = clone(originalCatalog)
        ;(
          catalog.obstacleProfiles[
            'runner-rose-hurdle-v1'
          ] as Mutable<RunnerBlockerCatalogProfile>
        ).collisionProfile = clone(bad)
        expect(() =>
          compileSongRunnerCourseDocument(document, catalog),
        ).toThrow('contiguous X bands')
      }
      const catalog = clone(originalCatalog)
      ;(
        catalog.obstacleProfiles[
          'runner-rose-hurdle-v1'
        ] as Mutable<RunnerBlockerCatalogProfile>
      ).collisionProfile = clone(saddle)
      expect(
        hurdle(compileSongRunnerCourseDocument(document, catalog)[0]!)
          .collisionProfile,
      ).toEqual(saddle)
    },
  )
})
