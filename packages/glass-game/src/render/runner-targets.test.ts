// Runner target integration regressions — semantic feedback gates presentation without becoming score truth.

import type { Box3 as ThreeBox3, Mesh, MeshBasicMaterial, PlaneGeometry, } from 'three'
import { Group } from 'three'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { runnerCourseFixture } from '../browser/__fixtures__/runner-course'
import type { RunnerPitchFeedback, RunnerSnapshot } from '../runner/contracts'
import { SINGING_CURRENT_RESPONSIVE } from '../runner/first-course'
import { createSongRunnerGame } from '../runner/game'
import { runnerSecondsToBeat } from '../runner/tempo'

const state = vi.hoisted(() => ({
  vesselUpdate: vi.fn(),
  vesselDispose: vi.fn(),
  feedbackUpdate: vi.fn(),
  feedbackDispose: vi.fn(),
  poolClose: vi.fn(),
  drawText: vi.fn(),
}))

vi.mock('./exhibit-geometry-pool', async () => {
  const { Matrix4 } = await import('three')
  return {
    createExhibitGeometryPool: () => ({
      acquire: () => ({ transform: new Matrix4() }),
      close: state.poolClose,
    }),
  }
})
vi.mock('./kit-instance', async () => {
  const { Group } = await import('three')
  return { createKitInstance: () => new Group() }
})
vi.mock('./vessels', async () => {
  const { Box3, Group, Vector3 } = await import('three')
  return {
    createAuthoredVessel: (
      _target: unknown,
      _reducedMotion: boolean,
      acquire: (library: unknown) => unknown,
    ) => {
      acquire({})
      const root = new Group()
      const intactLocalBounds = new Box3(
        new Vector3(-0.5, 0, -0.01),
        new Vector3(0.5, 2, 0.01),
      )
      return {
        root,
        materialLibrary: {},
        addPersistent(object: Group) {
          root.add(object)
        },
        getIntactBounds: (box: ThreeBox3): ThreeBox3 => {
          root.updateWorldMatrix(true, false)
          return box.copy(intactLocalBounds).applyMatrix4(root.matrixWorld)
        },
        update: state.vesselUpdate,
        dispose: state.vesselDispose,
      }
    },
  }
})
vi.mock('./runner-target-feedback', async () => {
  const { Group } = await import('three')
  return {
    createRunnerTargetFeedback: () => ({
      root: new Group(),
      update: state.feedbackUpdate,
      dispose: state.feedbackDispose,
    }),
  }
})

import { createRunnerTargets } from './runner-targets'

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
const WRONG: RunnerPitchFeedback = {
  state: 'wrong',
  observedMidi: 63,
  comparedTargetMidi: 60,
  errorCents: 300,
  correction: 'lower',
}

function context() {
  return {
    scale: vi.fn(),
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    roundRect: vi.fn(),
    fill: vi.fn(),
    fillText: state.drawText,
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    bezierCurveTo: vi.fn(),
    save: vi.fn(),
    ellipse: vi.fn(),
    clip: vi.fn(),
    fillRect: vi.fn(),
    restore: vi.fn(),
    arc: vi.fn(),
    quadraticCurveTo: vi.fn(),
    font: '',
    textAlign: 'left',
    fillStyle: '',
    lineWidth: 1,
    strokeStyle: '',
  }
}

function withFeedback(
  snapshot: RunnerSnapshot,
  feedback: RunnerPitchFeedback,
  fillProgress: number,
): RunnerSnapshot {
  const active = snapshot.activeTarget!
  return {
    ...snapshot,
    activeTarget: {
      ...active,
      pitchFeedback: feedback,
      notes: active.notes.map((note) => ({ ...note, fillProgress })),
    },
  }
}

function latestVesselState() {
  return state.vesselUpdate.mock.calls.at(-1)![0] as {
    charge: number
    phase: string
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  const drawing = context()
  vi.stubGlobal('document', {
    createElement: () => ({
      width: 0,
      height: 0,
      getContext: () => drawing,
    }),
  })
})
afterEach(() => vi.unstubAllGlobals())

describe('runner targets live feedback', () => {
  it('shows authoritative charge even after instantaneous pitch feedback becomes neutral', () => {
    const course = runnerCourseFixture()
    const initial = createSongRunnerGame(course, {
      comfortableMidi: 60,
    }).snapshot()
    const targets = createRunnerTargets(
      course,
      new Group(),
      'test-bundle',
      60,
      false,
    )

    targets.update(withFeedback(initial, ACCEPTED, 0.4), 1 / 60)
    expect(latestVesselState()).toMatchObject({
      charge: 0.4,
      phase: 'charging',
    })
    expect(state.vesselUpdate.mock.calls.at(-1)![3]).toMatchObject({
      surfaceStressActive: true,
      tremorActive: true,
    })

    targets.update(withFeedback(initial, NEUTRAL, 0.7), 1 / 60)
    expect(latestVesselState().charge).toBe(0.7)
    expect(state.vesselUpdate.mock.calls.at(-1)![3]).toMatchObject({
      surfaceStressActive: false,
      tremorActive: false,
    })

    targets.update(withFeedback(initial, WRONG, 0.7), 1 / 60)
    expect(latestVesselState().charge).toBe(0.7)

    targets.update(withFeedback(initial, ACCEPTED, 0.75), 1 / 60)
    expect(latestVesselState().charge).toBe(0.75)
    targets.dispose()
  })

  it('places the pane at contact time rather than the response deadline', () => {
    const course = SINGING_CURRENT_RESPONSIVE
    const target = course.targets[0]!
    const snapshot = createSongRunnerGame(course, {
      comfortableMidi: 60,
    }).snapshot()
    const targets = createRunnerTargets(
      course,
      new Group(),
      'test-bundle',
      60,
      false,
    )
    targets.update(snapshot, 0)
    const pane = targets.root.children[0]!
    const contactBeat = runnerSecondsToBeat(
      course.tempoSegments,
      target.contactCourseSeconds,
    )
    expect(target.completionPolicy).toBe('charge')
    expect(pane.position.z).toBeCloseTo(-contactBeat * course.metersPerBeat, 8)
    expect(pane.position.z).toBeLessThan(
      -target.notes.at(-1)!.endBeat * course.metersPerBeat,
    )
    expect(pane.position.y).toBe(course.groundFeetY)
    expect(pane.scale.toArray()).toEqual([1, 1, 1])
    targets.update(
      {
        ...snapshot,
        courseSeconds: target.contactCourseSeconds,
        courseDistanceMeters: contactBeat * course.metersPerBeat,
      },
      0,
    )
    expect(pane.position.z).toBeCloseTo(0, 8)
    expect(pane.scale.toArray()).toEqual([1, 1, 1])
    targets.dispose()
  })

  it('labels a short hold with the actual pitch instead of a timed notation duration', () => {
    const original = runnerCourseFixture()
    const course = {
      ...original,
      targets: [
        { ...original.targets[0]!, completionPolicy: 'charge' as const },
      ],
    }
    const snapshot = createSongRunnerGame(course, {
      comfortableMidi: 60,
    }).snapshot()
    const targets = createRunnerTargets(
      course,
      new Group(),
      'test-bundle',
      60,
      false,
    )
    targets.update(snapshot, 0)
    expect(state.drawText).toHaveBeenCalledWith('C4', 256, 122)
    expect(state.drawText).toHaveBeenCalledWith('Short hold', 256, 206)
    targets.dispose()
  })

  it('keeps scorecard uploads keyed to score progress rather than pitch frames', () => {
    const course = runnerCourseFixture()
    const initial = createSongRunnerGame(course, {
      comfortableMidi: 60,
    }).snapshot()
    const targets = createRunnerTargets(
      course,
      new Group(),
      'test-bundle',
      60,
      false,
    )

    targets.update(withFeedback(initial, ACCEPTED, 0.4), 1 / 60)
    const card = targets.root.getObjectByName(
      'runner-target-scorecard',
    ) as Mesh<PlaneGeometry, MeshBasicMaterial>
    const texture = card.material.map!
    const firstVersion = texture.version

    targets.update(withFeedback(initial, WRONG, 0.4), 1 / 60)
    targets.update(withFeedback(initial, NEUTRAL, 0.4), 1 / 60)
    expect(texture.version).toBe(firstVersion)

    targets.update(withFeedback(initial, NEUTRAL, 0.7), 1 / 60)
    expect(texture.version).toBeGreaterThan(firstVersion)
    targets.dispose()
  })

  it('clears unresolved charge when a same-resident target enters a new epoch', () => {
    const course = runnerCourseFixture()
    const initial = createSongRunnerGame(course, {
      comfortableMidi: 60,
    }).snapshot()
    const targets = createRunnerTargets(
      course,
      new Group(),
      'test-bundle',
      60,
      false,
    )
    const hit = {
      targetId: course.targets[0]!.id,
      outcome: 'hit' as const,
      grade: 3 as const,
      resolvedAtCourseSeconds: 0,
      reliableSeconds: 1,
      meanAbsoluteCents: 0,
    }

    targets.update(
      {
        ...initial,
        epoch: 'first-flight',
        activeTarget: null,
        resolvedTargets: [hit],
      },
      0,
    )
    expect(latestVesselState().charge).toBe(1)

    targets.update(
      {
        ...initial,
        epoch: 'retry-with-earned-hit',
        activeTarget: null,
        resolvedTargets: [hit],
      },
      0,
    )
    expect(latestVesselState().charge).toBe(1)

    targets.update(
      {
        ...initial,
        epoch: 'retry-before-target',
        activeTarget: null,
        resolvedTargets: [],
      },
      0,
    )
    expect(latestVesselState()).toMatchObject({ charge: 0, phase: 'idle' })
    targets.dispose()
  })

  it('retires target-local feedback exactly once with a streamed target', () => {
    const course = runnerCourseFixture()
    const initial = createSongRunnerGame(course, {
      comfortableMidi: 60,
    }).snapshot()
    const targets = createRunnerTargets(
      course,
      new Group(),
      'test-bundle',
      60,
      false,
    )
    targets.update(withFeedback(initial, WRONG, 0), 0.05)

    targets.update(
      {
        ...initial,
        activeTarget: null,
        residentChunkIds: ['chunk-1'],
      },
      0.05,
    )
    targets.dispose()
    targets.dispose()

    expect(state.feedbackDispose).toHaveBeenCalledOnce()
    expect(state.vesselDispose).toHaveBeenCalledOnce()
    expect(state.poolClose).toHaveBeenCalledOnce()
  })
})
