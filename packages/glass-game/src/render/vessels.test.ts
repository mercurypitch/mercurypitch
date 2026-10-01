// Adventure vessel regressions — persistent artwork survives its breakable glazing.

import type { Group, LineSegments, Mesh, MeshPhysicalMaterial } from 'three'
import { BoxGeometry, EdgesGeometry, Matrix4, MeshPhysicalMaterial as PhysicalMaterial, Texture, Vector3, } from 'three'
import { describe, expect, it, vi } from 'vitest'
import { GLASSWORKS_JOURNEY } from '../content/glassworks-journey'
import { SHATTER_LIFECYCLE_SECONDS, SHATTER_PRESENTATION_TIMING, } from '../core/shatter-presentation'
import { getBreakableRenderRecipe } from './catalog'
import { createAuthoredVessel, createVessel } from './vessels'

describe('persistent glazed artwork', () => {
  it('uses plane texture orientation only for the separate artwork plane', () => {
    const target = GLASSWORKS_JOURNEY.breakables.find((item) =>
      item.id.endsWith('/archive/encounter/archive-glazing'),
    )!
    const planeTexture = new Texture()
    planeTexture.flipY = false
    const planeVersion = planeTexture.version
    const glazedVessel = createVessel(target, false)

    glazedVessel.setPortrait(planeTexture)

    const art = glazedVessel.root.getObjectByName(
      `persistent-portrait-${target.id}`,
    ) as Mesh
    expect((art.material as MeshPhysicalMaterial).map).toBe(planeTexture)
    expect(planeTexture.flipY).toBe(true)
    expect(planeTexture.version).toBe(planeVersion + 1)
    glazedVessel.dispose()

    const shardTexture = new Texture()
    shardTexture.flipY = false
    const shardVersion = shardTexture.version
    const shardTarget = {
      ...target,
      id: `${target.id}-portrait-shards`,
      variant: 'portrait',
    }
    const shardVessel = createVessel(shardTarget, false)

    shardVessel.setPortrait(shardTexture)

    expect(shardTexture.flipY).toBe(false)
    expect(shardTexture.version).toBe(shardVersion)
    shardVessel.dispose()
  })

  it('fractures the glazing while preserving the authored image plane and frame contract', () => {
    const target = GLASSWORKS_JOURNEY.breakables.find((item) =>
      item.id.endsWith('/archive/encounter/archive-glazing'),
    )
    expect(target).toBeDefined()
    const recipe = getBreakableRenderRecipe(target!.variant)
    expect(recipe).toMatchObject({
      bundle: 'legend-slab',
      persistentPrefix: 'legend_cash_frame_',
      portraitTexture: 'painting-archive-v5',
    })

    const vessel = createVessel(target!, false)
    vessel.setPortrait(new Texture())
    const art = vessel.root.getObjectByName(
      `persistent-portrait-${target!.id}`,
    ) as Mesh
    const intact = vessel.root.getObjectByName(
      `vessel-intact-${target!.id}`,
    ) as Mesh
    const shards = vessel.root.getObjectByName(
      `vessel-shards-${target!.id}`,
    ) as Group

    expect(art.visible).toBe(true)
    vessel.update(
      { id: target!.id, charge: 1, phase: 'shattering', brokenAt: 0 },
      0.2,
    )
    expect(intact.visible).toBe(false)
    expect(shards.visible).toBe(true)
    expect(art.visible).toBe(true)

    vessel.update(
      { id: target!.id, charge: 1, phase: 'shattering', brokenAt: 0 },
      SHATTER_LIFECYCLE_SECONDS - 0.001,
    )
    expect(shards.visible).toBe(true)
    vessel.update(
      { id: target!.id, charge: 1, phase: 'complete', brokenAt: 0 },
      SHATTER_LIFECYCLE_SECONDS,
    )
    expect(shards.visible).toBe(false)

    vessel.update(
      { id: target!.id, charge: 1, phase: 'complete', brokenAt: null },
      10,
    )
    expect(intact.visible).toBe(false)
    expect(shards.visible).toBe(false)
    expect(art.visible).toBe(true)
    vessel.dispose()
  })

  it('keeps the reduced-motion shard beat short inside the full gameplay lifecycle', () => {
    const target = GLASSWORKS_JOURNEY.breakables.find((item) =>
      item.id.endsWith('/archive/encounter/archive-glazing'),
    )!
    const vessel = createVessel(target, true)
    const shards = vessel.root.getObjectByName(
      `vessel-shards-${target.id}`,
    ) as Group
    const wave = vessel.root.children.find(
      (child) => (child as Mesh).geometry?.type === 'RingGeometry',
    ) as Mesh

    vessel.update(
      { id: target.id, charge: 1, phase: 'shattering', brokenAt: 0 },
      0.2,
    )
    expect(shards.visible).toBe(true)
    expect(wave.visible).toBe(false)
    vessel.update(
      { id: target.id, charge: 1, phase: 'shattering', brokenAt: 0 },
      SHATTER_PRESENTATION_TIMING.reducedMotion.visibleFlightSeconds,
    )
    expect(shards.visible).toBe(false)
    expect(SHATTER_LIFECYCLE_SECONDS).toBeCloseTo(2.3)
    vessel.dispose()
  })

  it('keeps intact shadows while allowing a presentation to omit flying-shard shadows', () => {
    const target = GLASSWORKS_JOURNEY.breakables.find((item) =>
      item.id.endsWith('/archive/encounter/archive-glazing'),
    )!
    const standard = createVessel(target, false)
    const standardIntact = standard.root.getObjectByName(
      `vessel-intact-${target.id}`,
    ) as Mesh
    const standardShards = standard.root.getObjectByName(
      `vessel-shards-${target.id}`,
    ) as Group
    expect(standardIntact.castShadow).toBe(true)
    expect(standardShards.children.every((child) => child.castShadow)).toBe(
      true,
    )
    standard.dispose()

    const runnerTarget = { ...target, id: `${target.id}-runner` }
    const runner = createVessel(runnerTarget, false, {
      castShardShadows: false,
    })
    const runnerIntact = runner.root.getObjectByName(
      `vessel-intact-${runnerTarget.id}`,
    ) as Mesh
    const runnerShards = runner.root.getObjectByName(
      `vessel-shards-${runnerTarget.id}`,
    ) as Group
    expect(runnerIntact.castShadow).toBe(true)
    expect(runnerShards.children.every((child) => !child.castShadow)).toBe(true)
    runner.dispose()
  })
})

describe('authored vessel installation', () => {
  it('starts from the prepared asset and borrows its pooled crack outlines', () => {
    const base = GLASSWORKS_JOURNEY.breakables[0]!
    const target = {
      ...base,
      id: `${base.id}-authored-first`,
      variant: 'frost-gold-arch-breakwall-a',
    }
    const intactGeometry = new BoxGeometry(0.8, 1, 0.08)
    const shardGeometry = new BoxGeometry(0.2, 0.3, 0.08)
    const crackGeometry = new EdgesGeometry(shardGeometry, 22)
    const crackDispose = vi.spyOn(crackGeometry, 'dispose')
    const sourceMaterial = new PhysicalMaterial({ transmission: 0.9 })
    const release = vi.fn()

    const vessel = createAuthoredVessel(target, false, (library) => ({
      geometry: intactGeometry,
      pieces: [{ geometry: shardGeometry, centre: new Vector3() }],
      crackGeometries: [crackGeometry],
      materials: [library.clone(sourceMaterial)],
      transform: new Matrix4(),
      release,
    }))
    const intact = vessel.root.getObjectByName(
      `vessel-intact-${target.id}`,
    ) as Mesh
    const shards = vessel.root.getObjectByName(
      `vessel-shards-${target.id}`,
    ) as Group
    const crack = intact.children[0] as LineSegments

    expect(intact.geometry).toBe(intactGeometry)
    expect(shards.children).toHaveLength(1)
    expect(crack.geometry).toBe(crackGeometry)
    vessel.dispose()
    vessel.dispose()
    expect(release).toHaveBeenCalledOnce()
    expect(crackDispose).not.toHaveBeenCalled()

    intactGeometry.dispose()
    shardGeometry.dispose()
    crackGeometry.dispose()
    sourceMaterial.dispose()
  })

  it('releases an authored lease when its crack contract is invalid', () => {
    const base = GLASSWORKS_JOURNEY.breakables[0]!
    const target = {
      ...base,
      id: `${base.id}-invalid-authored-cracks`,
      variant: 'frost-gold-arch-breakwall-a',
    }
    const intactGeometry = new BoxGeometry(0.8, 1, 0.08)
    const shardGeometry = new BoxGeometry(0.2, 0.3, 0.08)
    const sourceMaterial = new PhysicalMaterial({ transmission: 0.9 })
    const release = vi.fn()

    expect(() =>
      createAuthoredVessel(target, false, (library) => ({
        geometry: intactGeometry,
        pieces: [{ geometry: shardGeometry, centre: new Vector3() }],
        crackGeometries: [],
        materials: [library.clone(sourceMaterial)],
        transform: new Matrix4(),
        release,
      })),
    ).toThrow('0 crack outlines for 1 fracture pieces')
    expect(release).toHaveBeenCalledOnce()

    intactGeometry.dispose()
    shardGeometry.dispose()
    sourceMaterial.dispose()
  })
})
