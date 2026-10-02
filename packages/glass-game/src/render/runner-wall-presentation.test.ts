// Authored wall regressions — pane datums, score anchors, frame retirement and borrowed geometry survive the real adapter.

import { Box3, BoxGeometry, Group, Mesh, MeshStandardMaterial } from 'three'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { runnerCourseFixture } from '../browser/__fixtures__/runner-course'
import type { RunnerGlassPresentation } from '../content/runner-glass-presentation'
import type { RunnerSnapshot } from '../runner/contracts'
import { createSongRunnerGame } from '../runner/game'
import { runnerBeatToSeconds, runnerSecondsToBeat } from '../runner/tempo'
import type { BreakableRenderRecipe } from './breakable-render-recipe'
import type * as Catalog from './catalog'
import { disposeObject } from './dispose'

const recipe: BreakableRenderRecipe = {
  bundle: 'fixture-wall',
  intactNode: 'fixture_intact',
  shardPrefix: 'fixture_shard_',
  shardCount: 2,
  persistentPrefix: 'fixture_frame',
  preserveAuthoredOrigin: true,
  sharedGeometry: true,
  sourceHeight: 3,
  displayHeight: 3,
  barrierEnvelope: { width: 1.2, height: 3, depth: 0.02 },
  shatterProfile: 'ice-wall',
  tint: 0xdbfff8,
  roughness: 0.06,
  transmission: 0.96,
  thickness: 0.02,
  fallbackShape: 'slab',
  fragmentBudget: 2,
}
vi.mock('./catalog', async (original) => {
  const actual = await original<typeof Catalog>()
  return {
    ...actual,
    getBreakableRenderRecipe: (id: string) =>
      id === 'fixture-wall' ? recipe : actual.getBreakableRenderRecipe(id),
  }
})
import { createRunnerTargets } from './runner-targets'

const presentation: RunnerGlassPresentation = {
  variant: 'fixture-wall',
  family: 'raised-reeded',
  envelope: { width: 1.55, height: 3.5, depth: 0.28 },
  pane: {
    width: 1.2,
    height: 3,
    depth: 0.02,
    shoulderHeight: 3.25,
    archRise: 0,
    frontZ: 0.01,
    outline: [
      { x: -0.6, y: 0.25 },
      { x: 0.6, y: 0.25 },
      { x: 0.6, y: 3.25 },
      { x: -0.6, y: 3.25 },
    ],
  },
  notation: { width: 0.8, height: 0.6, centerX: 0.15, centerY: 1.8, z: 0.03 },
}

function donor() {
  const root = new Group()
  const material = new MeshStandardMaterial({ color: 0xffffff })
  const pane = new Mesh(new BoxGeometry(1.2, 3, 0.02), material)
  pane.name = 'fixture_intact'
  pane.position.y = 1.75
  const frame = new Mesh(new BoxGeometry(1.55, 3.5, 0.28), material)
  frame.name = 'fixture_frame'
  frame.position.y = 1.75
  root.add(pane, frame)
  for (let i = 0; i < 2; i++) {
    const shard = new Mesh(new BoxGeometry(0.6, 3, 0.02), material)
    shard.name = `fixture_shard_${String(i).padStart(3, '0')}`
    shard.position.set(i === 0 ? -0.3 : 0.3, 1.75, 0)
    root.add(shard)
  }
  return { root, frame }
}
beforeEach(() => {
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

describe('authored runner wall presentation', () => {
  it('preserves raised pane origin and full floor envelope, then retires the frame before contact without cutting earned shards', () => {
    const base = runnerCourseFixture()
    const target = {
      ...base.targets[0]!,
      glassPresentation: presentation,
      displayLane: 2 as const,
    }
    const course = { ...base, targets: [target] }
    const source = donor()
    const frameDispose = vi.spyOn(source.frame.geometry, 'dispose')
    const targets = createRunnerTargets(
      course,
      new Map([
        ['fixture-wall', { source: source.root, bundle: 'fixture-wall' }],
      ]),
      '',
      60,
      false,
    )
    const initial = createSongRunnerGame(course, {
      comfortableMidi: 60,
    }).snapshot()
    targets.update(initial, 0)
    const wall = targets.root.children[0]!
    expect(wall.scale.toArray()).toEqual([1, 1, 1])
    const intact = wall.getObjectByName(`vessel-intact-${target.id}`) as Mesh
    intact.geometry.computeBoundingBox()
    expect(intact.geometry.boundingBox!.min.y).toBeCloseTo(0.25)
    expect(intact.geometry.boundingBox!.max.y).toBeCloseTo(3.25)
    const frame = wall.getObjectByName('fixture_frame') as Mesh
    expect(frame.geometry).toBe(source.frame.geometry)
    const bounds = new Box3()
      .setFromObject(frame)
      .union(new Box3().setFromObject(intact))
    expect(bounds.min.y).toBeCloseTo(0)
    expect(bounds.max.y).toBeCloseTo(3.5)
    expect(bounds.max.x).toBeLessThan(3)
    const card = wall.getObjectByName('runner-target-scorecard') as Mesh
    expect(card.position.toArray()).toEqual([0.15, 1.8, 0.03])
    const contactDistance =
      runnerSecondsToBeat(course.tempoSegments, target.contactCourseSeconds) *
      course.metersPerBeat
    const hit: RunnerSnapshot['resolvedTargets'][number] = {
      targetId: target.id,
      outcome: 'hit',
      grade: 3,
      meanAbsoluteCents: 0,
      reliableSeconds: 1,
      resolvedAtCourseSeconds: target.contactCourseSeconds - 0.5,
    }
    const clearance =
      course.movement.bodyRadius + presentation.envelope.depth / 2 + 0.08
    const beforeClearance = contactDistance - clearance - 0.01
    targets.update(
      {
        ...initial,
        courseSeconds: runnerBeatToSeconds(
          course.tempoSegments,
          beforeClearance / course.metersPerBeat,
        ),
        courseDistanceMeters: beforeClearance,
        activeTarget: null,
        resolvedTargets: [hit],
      },
      0.1,
    )
    expect(frame.parent!.visible).toBe(true)
    const insideClearance = contactDistance - clearance + 0.01
    const beforeContactSeconds = runnerBeatToSeconds(
      course.tempoSegments,
      insideClearance / course.metersPerBeat,
    )
    expect(beforeContactSeconds).toBeLessThan(target.contactCourseSeconds)
    targets.update(
      {
        ...initial,
        courseSeconds: beforeContactSeconds,
        courseDistanceMeters: insideClearance,
        activeTarget: null,
        resolvedTargets: [hit],
      },
      0.01,
    )
    expect(frame.parent!.visible).toBe(false)
    expect(wall.visible).toBe(true)
    expect(wall.getObjectByName(`vessel-shards-${target.id}`)!.visible).toBe(
      true,
    )
    targets.update(
      {
        ...initial,
        courseSeconds: target.contactCourseSeconds,
        courseDistanceMeters: contactDistance,
        activeTarget: null,
        resolvedTargets: [hit],
      },
      0.1,
    )
    expect(frame.parent!.visible).toBe(false)
    expect(wall.visible).toBe(true)
    expect(wall.getObjectByName(`vessel-shards-${target.id}`)!.visible).toBe(
      true,
    )
    targets.update(
      {
        ...initial,
        courseSeconds: target.contactCourseSeconds + 0.2,
        courseDistanceMeters: contactDistance + 0.5,
        activeTarget: null,
        resolvedTargets: [{ ...hit, outcome: 'miss', grade: null }],
      },
      0.1,
    )
    expect(wall.visible).toBe(false)
    targets.dispose()
    expect(frameDispose).not.toHaveBeenCalled()
    disposeObject(source.root)
    expect(frameDispose).toHaveBeenCalledOnce()
  })
})
