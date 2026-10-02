// Runner target fit regressions — shipped arches and their overlays stay inside compiled lanes at the floor datum.

import { readFileSync } from 'node:fs'
import type { Mesh, Object3D } from 'three'
import { Box3, Texture, Vector3 } from 'three'
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GLASS_GAME_ASSET_FILES } from '../browser/assets'
import { FROST_GOLD_ARCH_BUNDLE_IDS, FROST_GOLD_ARCH_NODES, } from '../content/frost-gold-arch-profile'
import { compileSongRunnerCourse } from '../runner/compile-course'
import type { CompiledRunnerCourse, CompiledRunnerTarget, RunnerPitchFeedback, RunnerSnapshot, } from '../runner/contracts'
import { SINGING_CURRENT_CURRENT, SINGING_CURRENT_RESPONSIVE, SINGING_CURRENT_RESPONSIVE_CATALOG, SINGING_CURRENT_RESPONSIVE_SOURCE, } from '../runner/first-course'
import { createSongRunnerGame } from '../runner/game'
import { disposeObject } from './dispose'
import { RUNNER_TARGET_FEEDBACK_PRESENTATION } from './runner-target-feedback-config'
import { createRunnerTargets } from './runner-targets'
import { runnerLaneDividerXs, runnerTrackBounds } from './runner-world-layout'

const NEUTRAL: RunnerPitchFeedback = {
  state: 'neutral',
  observedMidi: null,
  comparedTargetMidi: null,
  errorCents: null,
  correction: null,
}
const ACCEPTED: RunnerPitchFeedback = {
  state: 'accepted',
  observedMidi: 60,
  comparedTargetMidi: 60,
  errorCents: 0,
  correction: null,
}

const shiftedUneven = compileSongRunnerCourse(
  {
    ...SINGING_CURRENT_RESPONSIVE_SOURCE,
    id: 'runner-fit-shifted-uneven',
    track: {
      ...SINGING_CURRENT_RESPONSIVE_SOURCE.track,
      laneCenters: [-1.7, -0.15, 1.1],
      groundFeetY: 0.6,
    },
  },
  SINGING_CURRENT_RESPONSIVE_CATALOG,
)
const layouts = [
  SINGING_CURRENT_RESPONSIVE,
  SINGING_CURRENT_CURRENT,
  shiftedUneven,
]

async function load(tier: 'desktop' | 'mobile') {
  const bundle = FROST_GOLD_ARCH_BUNDLE_IDS[tier]
  const bytes = readFileSync(
    new URL(
      `../../../../apps/beside-cue/public/games/${GLASS_GAME_ASSET_FILES[bundle]}`,
      import.meta.url,
    ),
  )
  const source = (
    await new GLTFLoader()
      .setMeshoptDecoder(MeshoptDecoder)
      .register(() => ({
        name: 'EXT_texture_webp',
        loadTexture: async () => new Texture(),
      }))
      .parseAsync(Uint8Array.from(bytes).buffer, '')
  ).scene
  return { source, bundle }
}

function present(
  course: CompiledRunnerCourse,
  target: CompiledRunnerTarget,
  feedback: RunnerPitchFeedback = NEUTRAL,
  courseSeconds = target.onsetCourseSeconds,
): RunnerSnapshot {
  return {
    ...createSongRunnerGame(course, { comfortableMidi: 60 }).snapshot(),
    courseSeconds,
    residentChunkIds: [target.chunkId],
    activeTarget: {
      id: target.id,
      phase: 'judging',
      phaseStartCourseSeconds: target.judgeOpenCourseSeconds,
      phaseEndCourseSeconds: target.judgeCloseCourseSeconds,
      phaseProgress: 0.5,
      noteIndex: 0,
      currentTargetMidi: 60,
      pitchFeedback: feedback,
      notes: target.notes.map((note) => ({
        index: note.index,
        startMidi: 60 + note.startOffsetSemitones,
        endMidi: 60 + note.endOffsetSemitones,
        targetMidi: 60 + note.endOffsetSemitones,
        fillProgress: feedback.state === 'accepted' ? 1 : 0,
        state: feedback.state === 'accepted' ? 'filled' : 'hollow',
      })),
    },
  }
}

function expectFitsLane(
  object: Object3D,
  course: CompiledRunnerCourse,
  target: CompiledRunnerTarget,
) {
  const track = runnerTrackBounds(course)
  const dividers = runnerLaneDividerXs(course)
  const edges = [track.left, ...dividers, track.right]
  const bounds = new Box3().setFromObject(object)
  const minX = edges[target.displayLane]!
  const maxX = edges[target.displayLane + 1]!
  expect(bounds.min.x, `${target.id} left edge`).toBeGreaterThan(minX + 0.025)
  expect(bounds.max.x, `${target.id} right edge`).toBeLessThan(maxX - 0.025)
  return bounds
}

beforeEach(() => {
  const draw = vi.fn()
  const context = new Proxy({}, { get: () => draw })
  vi.stubGlobal('document', {
    createElement: () => ({ width: 0, height: 0, getContext: () => context }),
  })
})
afterEach(() => vi.unstubAllGlobals())

describe.each(['desktop', 'mobile'] as const)(
  'runner shipped $0 arch fit',
  (tier) => {
    it('fits the full frame, pane and scorecard uniformly in all compiled lane layouts', async () => {
      const { source, bundle } = await load(tier)
      const originalFrame = new Box3().setFromObject(
        source.getObjectByName(FROST_GOLD_ARCH_NODES.frame)!,
      )
      const originalPane = new Box3().setFromObject(
        source.getObjectByName(FROST_GOLD_ARCH_NODES.intact)!,
      )
      expect(originalFrame.max.x - originalFrame.min.x).toBeGreaterThan(3.13)

      try {
        for (const layout of layouts) {
          const scales: number[] = []
          for (const lane of [0, 1, 2] as const) {
            const target = layout.targets.find(
              (item) => item.displayLane === lane,
            )!
            const course = { ...layout, targets: [target] }
            const targets = createRunnerTargets(
              course,
              source,
              bundle,
              60,
              false,
            )
            try {
              targets.update(present(course, target), 0)
              const assembly = targets.root.children[0]!
              const frame = assembly.getObjectByName(
                FROST_GOLD_ARCH_NODES.frame,
              )!
              const pane = assembly.getObjectByName(
                `vessel-intact-${target.id}`,
              ) as Mesh
              const card = assembly.getObjectByName('runner-target-scorecard')!
              const feedback = assembly.getObjectByName(
                'runner-target-feedback',
              )!
              expectFitsLane(assembly, course, target)
              const frameBounds = expectFitsLane(frame, course, target)
              const paneBounds = expectFitsLane(pane, course, target)
              const cardBounds = expectFitsLane(card, course, target)
              const scale = assembly.scale.x
              scales.push(scale)
              expect(assembly.position.x).toBe(course.laneCenters[lane])
              expect(assembly.position.y).toBe(course.groundFeetY)
              expect(assembly.scale.toArray()).toEqual([scale, scale, scale])
              expect(scale).toBeLessThanOrEqual(1)
              expect(paneBounds.min.y).toBeCloseTo(course.groundFeetY, 5)
              expect(frameBounds.min.y).toBeGreaterThan(
                course.groundFeetY - 0.01,
              )
              expect(frameBounds.min.y).toBeLessThan(course.groundFeetY)
              expect(paneBounds.max.y - course.groundFeetY).toBeGreaterThan(
                course.movement.bodyHeight,
              )
              expect(
                frameBounds.getSize(new Vector3()).x /
                  originalFrame.getSize(new Vector3()).x,
              ).toBeCloseTo(scale, 5)
              expect(
                paneBounds.getSize(new Vector3()).y /
                  originalPane.getSize(new Vector3()).y,
              ).toBeCloseTo(scale, 5)
              expect(cardBounds.getSize(new Vector3()).x / 1.8).toBeCloseTo(
                scale,
                5,
              )
              expect(card.parent).toBe(assembly)
              expect(feedback.parent).toBe(assembly)
            } finally {
              targets.dispose()
            }
          }
          expect(scales[1]).toBeCloseTo(scales[0]!, 6)
          expect(scales[2]).toBeCloseTo(scales[0]!, 6)
        }
      } finally {
        disposeObject(source)
      }
    })

    it('keeps peak tremor and live feedback within outer lanes without changing the fitted scale', async () => {
      const { source, bundle } = await load(tier)
      try {
        for (const reducedMotion of [false, true]) {
          for (const lane of [0, 2] as const) {
            const target = SINGING_CURRENT_RESPONSIVE.targets.find(
              (item) => item.displayLane === lane,
            )!
            const course = { ...SINGING_CURRENT_RESPONSIVE, targets: [target] }
            const targets = createRunnerTargets(
              course,
              source,
              bundle,
              60,
              reducedMotion,
            )
            try {
              const peakTime =
                (Math.PI / 2 +
                  Math.PI *
                    2 *
                    Math.ceil(
                      (target.onsetCourseSeconds * 48 - Math.PI / 2) /
                        (Math.PI * 2),
                    )) /
                48
              targets.update(
                present(course, target, ACCEPTED, peakTime),
                1 / 60,
              )
              const assembly = targets.root.children[0]!
              const scale = assembly.scale.x
              expectFitsLane(assembly, course, target)
              const pane = assembly.getObjectByName(
                `vessel-intact-${target.id}`,
              )!
              expect(Math.abs(pane.rotation.z)).toBeCloseTo(
                reducedMotion ? 0 : 0.0072,
                6,
              )
              const accepted = assembly.getObjectByName(
                'runner-target-feedback-accepted',
              )!
              expect(accepted.visible).toBe(true)
              expectFitsLane(accepted, course, target)

              for (const correction of ['higher', 'lower'] as const) {
                targets.update(
                  present(
                    course,
                    target,
                    {
                      state: 'wrong',
                      observedMidi: correction === 'higher' ? 57 : 63,
                      comparedTargetMidi: 60,
                      errorCents: correction === 'higher' ? -300 : 300,
                      correction,
                    },
                    peakTime,
                  ),
                  0.05,
                )
                expectFitsLane(assembly, course, target)
                const direction = assembly.getObjectByName(
                  'runner-target-feedback-direction',
                )!
                expect(direction.visible).toBe(true)
                expectFitsLane(direction, course, target)
              }

              const age =
                RUNNER_TARGET_FEEDBACK_PRESENTATION.timing
                  .completionPopSeconds / 2
              targets.update(
                {
                  ...present(course, target, NEUTRAL, peakTime + age),
                  activeTarget: null,
                  resolvedTargets: [
                    {
                      targetId: target.id,
                      outcome: 'hit',
                      grade: 3,
                      resolvedAtCourseSeconds: peakTime,
                      reliableSeconds: 1,
                      meanAbsoluteCents: 0,
                    },
                  ],
                },
                age,
              )
              expectFitsLane(assembly, course, target)
              expect(accepted.visible).toBe(true)
              expect(accepted.scale.x).toBeCloseTo(
                reducedMotion
                  ? 1
                  : 1 +
                      RUNNER_TARGET_FEEDBACK_PRESENTATION.timing
                        .completionPopScale,
                6,
              )
              expect(assembly.scale.toArray()).toEqual([scale, scale, scale])
            } finally {
              targets.dispose()
            }
          }
        }
      } finally {
        disposeObject(source)
      }
    })
  },
)
