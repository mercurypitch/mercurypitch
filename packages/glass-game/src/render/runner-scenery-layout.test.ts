// Runner scenery layout tests — collision clearance, bounded cost and invisible handoffs.

import { describe, expect, it } from 'vitest'
import { SINGING_CURRENT } from '../runner/first-course'
import { createRunnerSceneryLayout, RUNNER_SCENERY_VALIDATED_ASPECTS, runnerSceneryHandoffVisibility, runnerSceneryPlacementBounds, } from './runner-scenery-layout'

const course = SINGING_CURRENT

describe('runner scenery layout', () => {
  it('keeps fixed views to three reliable batches and the authored caps', () => {
    const layout = createRunnerSceneryLayout(course)
    expect(layout.chunks).toHaveLength(10)
    expect(layout.windows).toHaveLength(9)
    expect(layout.handoffs).toHaveLength(8)

    const maxima: Record<string, number> = {}
    for (const window of layout.windows)
      for (const [name, count] of Object.entries(window.metrics.authoredCounts))
        maxima[name] = Math.max(maxima[name] ?? 0, count)

    expect(maxima).toMatchObject({
      arches: 2,
      columns: 4,
      rotundas: 1,
      perimeters: 4,
      ivy: 4,
      pools: 4,
      paintings: 1,
    })
    expect(
      Math.max(...layout.windows.map((window) => window.metrics.triangles)),
    ).toBe(27_432)
    expect(
      Math.max(...layout.windows.map((window) => window.metrics.drawBatches)),
    ).toBe(3)

    for (const beat of [0, 8, 25, 68, 100, 148]) {
      const window = layout.select(beat * course.metersPerBeat)
      expect(window.chunkIds.length).toBeLessThanOrEqual(2)
      expect(window.metrics.drawBatches).toBeLessThanOrEqual(3)
      expect(window.metrics.triangles).toBeLessThan(50_000)
    }
  })

  it('keeps every disjoint footprint outside the route and inside its authored chunk', () => {
    const layout = createRunnerSceneryLayout(course)
    for (const chunk of layout.chunks)
      for (const placement of chunk.placements)
        for (const bounds of runnerSceneryPlacementBounds(placement)) {
          expect(
            bounds.max.x <= -3 || bounds.min.x >= 3,
            `${placement.id} entered the lane envelope`,
          ).toBe(true)
          expect(bounds.min.y).toBeGreaterThanOrEqual(-0.241)
          expect(-bounds.max.z).toBeGreaterThanOrEqual(
            course.chunks[chunk.index]!.minCourseDistanceMeters - 1e-9,
          )
          expect(-bounds.min.z).toBeLessThanOrEqual(
            course.chunks[chunk.index]!.maxCourseDistanceMeters + 1e-9,
          )
        }

    const painting = layout.chunks[2]!.placements[0]!
    expect(painting.kind).toBe('painting')
    expect(Math.abs(Math.cos(painting.yawRadians))).toBeLessThan(0.25)
    expect(Math.abs(Math.sin(painting.yawRadians))).toBeGreaterThan(0.95)
  })

  it('supports every side assembly on a foundation joined to the runway', () => {
    const layout = createRunnerSceneryLayout(course)
    const arrival = layout.chunks[0]!.placements[0]!
    const arrivalBounds = runnerSceneryPlacementBounds(arrival)
    const arrivalFoundation = arrivalBounds.at(-1)!
    expect(arrivalFoundation.max.x).toBeCloseTo(-3)
    for (const part of arrivalBounds.slice(0, -1)) {
      expect(arrivalFoundation.min.x).toBeLessThanOrEqual(part.min.x)
      expect(arrivalFoundation.max.x).toBeGreaterThanOrEqual(part.max.x)
      expect(arrivalFoundation.min.z).toBeLessThanOrEqual(part.min.z)
      expect(arrivalFoundation.max.z).toBeGreaterThanOrEqual(part.max.z)
    }

    const landmark = layout.chunks[4]!.placements[0]!
    const landmarkBounds = runnerSceneryPlacementBounds(landmark)
    const rotundaFoundation = landmarkBounds.at(-2)!
    const pavilionFoundation = landmarkBounds.at(-1)!
    expect(rotundaFoundation.max.x).toBeCloseTo(-3)
    expect(pavilionFoundation.min.x).toBeCloseTo(3)
    const expectSupported = (
      foundation: (typeof landmarkBounds)[number],
      part: (typeof landmarkBounds)[number],
    ) => {
      expect(foundation.min.x).toBeLessThanOrEqual(part.min.x)
      expect(foundation.max.x).toBeGreaterThanOrEqual(part.max.x)
      expect(foundation.min.z).toBeLessThanOrEqual(part.min.z)
      expect(foundation.max.z).toBeGreaterThanOrEqual(part.max.z)
    }
    expectSupported(rotundaFoundation, landmarkBounds[0]!)
    for (const part of landmarkBounds.slice(1, 4))
      expectSupported(pavilionFoundation, part)

    const finaleBounds = layout.chunks[9]!.placements.map(
      (placement) => runnerSceneryPlacementBounds(placement).at(-1)!,
    )
    expect(finaleBounds[0]!.max.x).toBeCloseTo(-3)
    expect(finaleBounds[1]!.min.x).toBeCloseTo(3)

    const conservatory = layout.chunks[6]!
    const gardenBounds = runnerSceneryPlacementBounds(
      conservatory.placements[0]!,
    )
    const leftGardenSupport = gardenBounds.at(-2)!
    const rightGardenSupport = gardenBounds.at(-1)!
    expect(leftGardenSupport.max.x).toBeCloseTo(-3)
    expect(rightGardenSupport.min.x).toBeCloseTo(3)
    for (const index of [0, 2])
      expectSupported(leftGardenSupport, gardenBounds[index]!)
    for (const index of [1, 3])
      expectSupported(rightGardenSupport, gardenBounds[index]!)
    const ponds = conservatory.placements
      .slice(1)
      .map((pond) => runnerSceneryPlacementBounds(pond)[0]!)
    expectSupported(leftGardenSupport, ponds[0]!)
    expectSupported(rightGardenSupport, ponds[1]!)
  })

  it('uses one disjoint pond per side without overlap in a resident window', () => {
    const layout = createRunnerSceneryLayout(course)
    const conservatory = layout.windows.find(
      (window) => window.metrics.authoredCounts.pools === 4,
    )!
    const ponds = conservatory.placements
      .filter((placement) => placement.kind === 'water')
      .map((placement) => runnerSceneryPlacementBounds(placement)[0]!)
    expect(ponds).toHaveLength(4)
    for (let first = 0; first < ponds.length; first++)
      for (let second = first + 1; second < ponds.length; second++)
        expect(ponds[first]!.intersectsBox(ponds[second]!)).toBe(false)
  })

  it('retires outgoing art outside every validated frustum before incoming art leaves full fog', () => {
    const layout = createRunnerSceneryLayout(course)
    const failures: string[] = []
    for (const handoff of layout.handoffs) {
      for (const aspect of RUNNER_SCENERY_VALIDATED_ASPECTS) {
        const receipt = runnerSceneryHandoffVisibility(layout, handoff, aspect)
        if (receipt.outgoingVisible)
          failures.push(
            `${handoff.outgoingChunkId} remains visible at ${handoff.atCourseDistanceMeters}m / ${aspect}`,
          )
        if (!receipt.incomingFullyFogged)
          failures.push(
            `${handoff.incomingChunkId} has left fog at ${handoff.atCourseDistanceMeters}m / ${aspect}`,
          )
      }
    }
    expect(failures).toEqual([])
  })

  it('selects deterministic two-chunk windows across forward travel and rewind', () => {
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
  })
})
