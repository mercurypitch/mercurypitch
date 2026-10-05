// Runner wall projections — full authored walls and their score anchors survive outer-lane placement without scaling.
import { readFileSync } from 'node:fs'
import type { Mesh, Object3D } from 'three'
import { Box3, PerspectiveCamera, Texture, Vector3 } from 'three'
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GLASS_GAME_ASSET_FILES } from '../browser/assets'
import type { SingingCurrentWallProfile } from '../content/singing-current-wall-profiles'
import { SINGING_CURRENT_WALL_PROFILES } from '../content/singing-current-wall-profiles'
import type { CompiledRunnerCourse, CompiledRunnerTarget, RunnerSnapshot, } from '../runner/contracts'
import { SINGING_CURRENT } from '../runner/first-course'
import { createSongRunnerGame } from '../runner/game'
import { runnerBeatToSeconds, runnerSecondsToBeat } from '../runner/tempo'
import { disposeObject } from './dispose'
import { createRunnerTargets } from './runner-targets'
import { runnerCameraFollowTarget, runnerCameraPose, runnerTrackBounds, } from './runner-world-layout'

beforeEach(() => {
  // Drawing is the browser boundary; real loaders, wall transforms, geometry,
  // notation anchors and feedback are exercised by the production adapter.
  const draw = vi.fn()
  vi.stubGlobal('document', {
    createElement: () => ({
      width: 0,
      height: 0,
      getContext: () => new Proxy({}, { get: () => draw }),
    }),
  })
})
afterEach(() => vi.unstubAllGlobals())

async function loadWall(profile: SingingCurrentWallProfile) {
  const bytes = readFileSync(
    new URL(
      `../../../../apps/beside-cue/public/games/${GLASS_GAME_ASSET_FILES[profile.bundle]}`,
      import.meta.url,
    ),
  )
  return (
    await new GLTFLoader()
      .setMeshoptDecoder(MeshoptDecoder)
      .register(() => ({
        name: 'EXT_texture_webp',
        loadTexture: async () => new Texture(),
      }))
      .parseAsync(Uint8Array.from(bytes).buffer, '')
  ).scene
}

function present(
  course: CompiledRunnerCourse,
  target: CompiledRunnerTarget,
): RunnerSnapshot {
  return {
    ...createSongRunnerGame(course, { comfortableMidi: 60 }).snapshot(),
    courseSeconds: target.judgeOpenCourseSeconds,
    courseDistanceMeters:
      runnerSecondsToBeat(course.tempoSegments, target.judgeOpenCourseSeconds) *
      course.metersPerBeat,
    residentChunkIds: [target.chunkId],
    activeTarget: {
      id: target.id,
      phase: 'judging',
      phaseStartCourseSeconds: target.judgeOpenCourseSeconds,
      phaseEndCourseSeconds: target.judgeCloseCourseSeconds,
      phaseProgress: 0,
      noteIndex: 0,
      currentTargetMidi: 60,
      pitchFeedback: {
        state: 'neutral',
        observedMidi: null,
        comparedTargetMidi: null,
        errorCents: null,
        correction: null,
      },
      notes: target.notes.map((note) => ({
        index: note.index,
        startMidi: 60 + note.startOffsetSemitones,
        endMidi: 60 + note.endOffsetSemitones,
        targetMidi: 60 + note.endOffsetSemitones,
        fillProgress: 0,
        state: 'hollow',
      })),
    },
  }
}

function expectOnScreen(object: Object3D, camera: PerspectiveCamera) {
  const bounds = new Box3().setFromObject(object)
  for (const x of [bounds.min.x, bounds.max.x])
    for (const y of [bounds.min.y, bounds.max.y]) {
      const point = new Vector3(x, y, bounds.max.z).project(camera)
      expect(Math.abs(point.x)).toBeLessThan(0.96)
      expect(Math.abs(point.y)).toBeLessThan(0.96)
    }
}

describe.each(Object.values(SINGING_CURRENT_WALL_PROFILES))(
  '$id authored wall and notation',
  (profile) => {
    it('retains the complete floor envelope and score anchors on screen across all three lanes, then clears the frame before body contact', async () => {
      const source = await loadWall(profile)
      const template =
        SINGING_CURRENT.targets.find(
          (target) =>
            target.glassPresentation?.variant === profile.presentation.variant,
        ) ?? SINGING_CURRENT.targets[0]!
      try {
        for (const displayLane of [0, 1, 2] as const) {
          const target = {
            ...template,
            displayLane,
            glassPresentation: profile.presentation,
          }
          const course = { ...SINGING_CURRENT, targets: [target] }
          const targets = createRunnerTargets(
            course,
            new Map([
              [
                profile.presentation.variant,
                { source, bundle: profile.bundle },
              ],
            ]),
            '',
            60,
            false,
          )
          try {
            const snapshot = present(course, target)
            targets.update(snapshot, 0)
            targets.root.updateMatrixWorld(true)
            const wall = targets.root.children[0]!
            const frame = wall.getObjectByName(profile.persistentPrefix)!
            const pane = wall.getObjectByName(
              `vessel-intact-${target.id}`,
            ) as Mesh
            const full = new Box3()
              .setFromObject(frame)
              .union(new Box3().setFromObject(pane))
            const dimensions = full.getSize(new Vector3())
            const track = runnerTrackBounds(course)
            expect(wall.scale.toArray()).toEqual([1, 1, 1])
            expect(dimensions.x).toBeCloseTo(
              profile.presentation.envelope.width,
              4,
            )
            expect(dimensions.y).toBeCloseTo(
              profile.presentation.envelope.height,
              4,
            )
            expect(dimensions.z).toBeCloseTo(
              profile.presentation.envelope.depth,
              4,
            )
            expect(full.min.y).toBeCloseTo(course.groundFeetY, 4)
            expect(full.min.x).toBeGreaterThan(track.left + 0.025)
            expect(full.max.x).toBeLessThan(track.right - 0.025)
            expect(new Box3().setFromObject(pane).min.y).toBeCloseTo(
              course.groundFeetY + profile.paneBounds.min[1]!,
              4,
            )

            const notation = (profile as SingingCurrentWallProfile).presentation
              .notation
            const anchors =
              notation.noteCards?.length === target.notes.length
                ? notation.noteCards
                : [{ ...notation, noteIndex: -1 }]
            for (const anchor of anchors) {
              const card = wall.getObjectByName(
                anchor.noteIndex < 0
                  ? 'runner-target-scorecard'
                  : `runner-target-note-card-${anchor.noteIndex}`,
              ) as Mesh
              expect(card.position.toArray()).toEqual([
                anchor.centerX ?? 0,
                anchor.centerY,
                anchor.z,
              ])
              expect(card.visible).toBe(true)
              const size = new Box3().setFromObject(card).getSize(new Vector3())
              expect(size.x).toBeCloseTo(anchor.width, 5)
              expect(size.y).toBeCloseTo(anchor.height, 5)
              for (const aspect of [
                390 / 844,
                768 / 1024,
                1440 / 900,
                844 / 390,
              ]) {
                const pose = runnerCameraPose(
                  aspect,
                  course.laneCenters,
                  course.presentation.cameraProfile,
                )
                const followX = runnerCameraFollowTarget(
                  course.laneCenters[displayLane],
                  course.laneCenters,
                  aspect,
                  course.presentation.cameraProfile,
                )
                const camera = new PerspectiveCamera(
                  pose.fovDegrees,
                  aspect,
                  0.08,
                  75,
                )
                camera.position.set(pose.x + followX, pose.y, pose.z)
                camera.lookAt(
                  pose.targetX + followX,
                  pose.targetY,
                  pose.targetZ,
                )
                camera.updateMatrixWorld(true)
                expectOnScreen(card, camera)
              }
            }

            const contactDistance =
              runnerSecondsToBeat(
                course.tempoSegments,
                target.contactCourseSeconds,
              ) * course.metersPerBeat
            const clearance =
              course.movement.bodyRadius +
              profile.presentation.envelope.depth / 2 +
              0.08
            expect(frame.parent!.visible).toBe(true)
            const beforeContact = contactDistance - clearance + 0.01
            targets.update(
              {
                ...snapshot,
                courseDistanceMeters: beforeContact,
                courseSeconds: runnerBeatToSeconds(
                  course.tempoSegments,
                  beforeContact / course.metersPerBeat,
                ),
              },
              0,
            )
            expect(frame.parent!.visible).toBe(false)
            expect(wall.visible).toBe(true)
          } finally {
            targets.dispose()
          }
        }
      } finally {
        disposeObject(source)
      }
    })
  },
)
