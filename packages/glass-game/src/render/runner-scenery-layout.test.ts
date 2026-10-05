// Runner scenery layout tests — reference composition, support, collision clearance and handoffs.

import { Box3 } from 'three'
import { describe, expect, it } from 'vitest'
import type { CompiledRunnerCourse } from '../runner/contracts'
import { SINGING_CURRENT_CONTINUOUS_TRIAL, SINGING_CURRENT_CURRENT, SINGING_CURRENT_LEARNING, SINGING_CURRENT_RESPONSIVE, } from '../runner/first-course'
import { createRunnerSceneryLayout, RUNNER_SCENERY_VALIDATED_ASPECTS, runnerSceneryHandoffVisibility, runnerSceneryPlacementBounds, } from './runner-scenery-layout'
import { runnerTrackBounds } from './runner-world-layout'

const courses = [
  SINGING_CURRENT_RESPONSIVE,
  SINGING_CURRENT_CURRENT,
  SINGING_CURRENT_LEARNING,
  SINGING_CURRENT_CONTINUOUS_TRIAL,
  {
    ...SINGING_CURRENT_CONTINUOUS_TRIAL,
    presentation: {
      ...SINGING_CURRENT_CONTINUOUS_TRIAL.presentation,
      cameraProfile: 'steering-close',
    },
  },
  {
    ...SINGING_CURRENT_CONTINUOUS_TRIAL,
    presentation: {
      ...SINGING_CURRENT_CONTINUOUS_TRIAL.presentation,
      cameraProfile: 'steering-angled',
    },
  },
] as const

function boundsFor(kind: string, course: CompiledRunnerCourse) {
  return createRunnerSceneryLayout(course).chunks.flatMap((chunk) =>
    chunk.placements
      .filter((placement) => placement.kind === kind)
      .map((placement) => ({
        placement,
        bounds: runnerSceneryPlacementBounds(placement)[0]!,
      })),
  )
}

describe('runner scenery layout', () => {
  it('authors a complete architectural and garden chapter in every course chunk', () => {
    for (const course of courses) {
      const layout = createRunnerSceneryLayout(course)
      expect(layout.chunks).toHaveLength(10)
      expect(layout.windows).toHaveLength(9)
      expect(layout.handoffs).toHaveLength(8)

      layout.chunks.forEach((chunk, index) => {
        const architecture = chunk.placements.filter(
          (placement) =>
            placement.kind === 'canopy' || placement.kind === 'arcade',
        )
        expect(architecture, `chunk ${index} architecture`).toHaveLength(1)
        expect(
          chunk.placements.some((placement) => placement.kind === 'terrace'),
        ).toBe(true)
        expect(
          chunk.placements.some((placement) => placement.kind === 'water'),
        ).toBe(true)
        expect(
          chunk.placements.some((placement) => placement.kind === 'waterfall'),
        ).toBe(true)
      })
    }
  })

  it('records each richer two-chunk composition from its reusable instanced pools', () => {
    const layout = createRunnerSceneryLayout(SINGING_CURRENT_RESPONSIVE)
    for (const window of layout.windows) {
      const canopies = window.placements.filter(
        (placement) => placement.kind === 'canopy',
      ).length
      const arcades = window.placements.filter(
        (placement) => placement.kind === 'arcade',
      ).length
      const terraces = 4 + arcades
      expect(window.metrics).toEqual({
        instances: terraces + 6,
        triangles:
          terraces * 25_504 + canopies * 40_424 + arcades * 28_161 + 160,
        drawBatches: 9 + Number(canopies > 0) + Number(arcades > 0),
        authoredCounts: {
          terraces,
          balustrades: terraces * 3,
          gardenBeds: terraces * 2,
          ivy: terraces,
          ...(canopies > 0 ? { canopies } : {}),
          ...(arcades > 0 ? { arcades } : {}),
          pools: 2,
          waterfalls: 2,
        },
      })
    }
    expect(
      Math.max(...layout.windows.map((window) => window.metrics.triangles)),
    ).toBe(209_506)
  })

  it('keeps every finished-art footprint outside the route and inside its authored chunk', () => {
    for (const course of courses) {
      const layout = createRunnerSceneryLayout(course)
      const track = runnerTrackBounds(course)
      for (const chunk of layout.chunks)
        for (const placement of chunk.placements)
          for (const bounds of runnerSceneryPlacementBounds(placement)) {
            expect(
              bounds.max.x <= track.left - 0.1 ||
                bounds.min.x >= track.right + 0.1,
              `${course.id}/${placement.id} entered the route envelope`,
            ).toBe(true)
            expect(-bounds.max.z).toBeGreaterThanOrEqual(
              course.chunks[chunk.index]!.minCourseDistanceMeters - 1e-9,
            )
            expect(-bounds.min.z).toBeLessThanOrEqual(
              course.chunks[chunk.index]!.maxCourseDistanceMeters + 1e-9,
            )
          }
    }
  })

  it('supports each premium structure on finished terraces rather than placeholder slabs', () => {
    const course = SINGING_CURRENT_RESPONSIVE
    const layout = createRunnerSceneryLayout(course)
    for (const chunk of layout.chunks) {
      const terraces = chunk.placements
        .filter((placement) => placement.kind === 'terrace')
        .map((placement) => runnerSceneryPlacementBounds(placement)[0]!)
      for (const structure of chunk.placements.filter(
        (placement) =>
          placement.kind === 'canopy' || placement.kind === 'arcade',
      )) {
        const structureBounds = runnerSceneryPlacementBounds(structure)[0]!
        const supports = terraces.filter(
          (terrace) =>
            terrace.min.x <= structureBounds.min.x &&
            terrace.max.x >= structureBounds.max.x &&
            terrace.max.z >= structureBounds.min.z &&
            terrace.min.z <= structureBounds.max.z,
        )
        expect(supports.length).toBe(structure.kind === 'arcade' ? 2 : 1)
        const supportUnion = supports.reduce(
          (union, support) => union.union(support),
          new Box3().makeEmpty(),
        )
        expect(supportUnion.min.z).toBeLessThanOrEqual(structureBounds.min.z)
        expect(supportUnion.max.z).toBeGreaterThanOrEqual(structureBounds.max.z)
      }
    }
  })

  it('keeps each animated pool on its terrace and hangs its fall from the inner edge', () => {
    for (const course of courses) {
      const layout = createRunnerSceneryLayout(course)
      const track = runnerTrackBounds(course)
      for (const chunk of layout.chunks) {
        const terraceBounds = chunk.placements
          .filter((placement) => placement.kind === 'terrace')
          .map((placement) => runnerSceneryPlacementBounds(placement)[0]!)
        const pool = chunk.placements.find(
          (placement) => placement.kind === 'water',
        )!
        const poolBounds = runnerSceneryPlacementBounds(pool)[0]!
        expect(
          terraceBounds.some(
            (terrace) =>
              terrace.min.x <= poolBounds.min.x &&
              terrace.max.x >= poolBounds.max.x &&
              terrace.min.z <= poolBounds.min.z &&
              terrace.max.z >= poolBounds.max.z,
          ),
        ).toBe(true)

        const waterfall = chunk.placements.find(
          (placement) => placement.kind === 'waterfall',
        )!
        const waterfallBounds = runnerSceneryPlacementBounds(waterfall)[0]!
        expect(waterfallBounds.max.y).toBeCloseTo(0)
        expect(
          waterfallBounds.max.x <= track.left - 0.1 ||
            waterfallBounds.min.x >= track.right + 0.1,
        ).toBe(true)
      }
    }
  })

  it('keeps resident pools spatially separate even while their geometry and clock are shared', () => {
    const course = SINGING_CURRENT_RESPONSIVE
    const pools = boundsFor('water', course)
    for (let first = 0; first < pools.length; first++)
      for (let second = first + 1; second < pools.length; second++)
        expect(
          pools[first]!.bounds.intersectsBox(pools[second]!.bounds),
          `${pools[first]!.placement.id} overlaps ${pools[second]!.placement.id}`,
        ).toBe(false)
  })

  it('retires outgoing art before incoming art leaves full fog at every validated aspect', () => {
    for (const course of courses) {
      const layout = createRunnerSceneryLayout(course)
      const failures: string[] = []
      for (const handoff of layout.handoffs) {
        for (const aspect of RUNNER_SCENERY_VALIDATED_ASPECTS) {
          for (const playerX of [
            course.laneCenters[0],
            0,
            course.laneCenters[2],
            ...(layout.lateralRange
              ? Array.from(
                  { length: 25 },
                  (_, index) =>
                    layout.lateralRange![0] +
                    ((layout.lateralRange![1] - layout.lateralRange![0]) *
                      index) /
                      24,
                )
              : []),
          ]) {
            const receipt = runnerSceneryHandoffVisibility(
              layout,
              handoff,
              aspect,
              playerX,
            )
            if (receipt.outgoingVisible)
              failures.push(
                `${course.id}/${handoff.outgoingChunkId} visible at ${handoff.atCourseDistanceMeters}m / ${aspect} / x=${playerX}`,
              )
            if (!receipt.incomingFullyFogged)
              failures.push(
                `${course.id}/${handoff.incomingChunkId} left fog at ${handoff.atCourseDistanceMeters}m / ${aspect} / x=${playerX}`,
              )
          }
        }
      }
      expect(failures).toEqual([])
    }
  })

  it('selects deterministic two-chunk windows across forward travel and rewind', () => {
    for (const course of courses) {
      const layout = createRunnerSceneryLayout(course)
      const probes = [
        0,
        ...layout.handoffs.flatMap((handoff) => [
          handoff.atCourseDistanceMeters - 1e-6,
          handoff.atCourseDistanceMeters,
        ]),
        course.lengthMeters,
      ]
      const forward = probes.map((distance) => layout.select(distance).key)
      const backward = [...probes]
        .reverse()
        .map((distance) => layout.select(distance).key)
        .reverse()

      expect(backward).toEqual(forward)
      expect(forward[0]).toBe('0:1')
      expect(forward.at(-1)).toBe('8:9')
      expect(layout.select(Number.NaN)).toBe(layout.windows[0])
    }
  })
})
