// Adventure vessel regressions — persistent artwork survives its breakable glazing.

import type { Group, LineSegments, Mesh, MeshPhysicalMaterial } from 'three'
import { BoxGeometry, EdgesGeometry, Matrix4, MeshPhysicalMaterial as PhysicalMaterial, Texture, Vector3, } from 'three'
import { describe, expect, it, vi } from 'vitest'
import { GLASSWORKS_JOURNEY } from '../content/glassworks-journey'
import { SHATTER_LIFECYCLE_SECONDS, SHATTER_PRESENTATION_TIMING, } from '../core/shatter-presentation'
import { getBreakableRenderRecipe } from './catalog'
import { createAuthoredVessel, createVessel } from './vessels'

describe('intact awakening presentation', () => {
  it.each([false, true])(
    'keeps charged, completed and restored glass intact without fracture effects (reduced motion %s)',
    (reducedMotion) => {
      const target = {
        ...GLASSWORKS_JOURNEY.breakables[0]!,
        completion: 'awaken' as const,
      }
      const vessel = createVessel(target, reducedMotion)
      const intact = vessel.root.getObjectByName(
        `vessel-intact-${target.id}`,
      ) as Mesh
      const shards = vessel.root.getObjectByName(
        `vessel-shards-${target.id}`,
      ) as Group
      const wave = vessel.root.children.find(
        (child) => (child as Mesh).geometry?.type === 'RingGeometry',
      ) as Mesh
      expect(shards.children).toHaveLength(0)
      expect(intact.children).toHaveLength(0)
      for (const phase of ['charging', 'complete'] as const) {
        for (const now of [0.1, 0.4, 5]) {
          vessel.update(
            { id: target.id, charge: 1, phase, brokenAt: null },
            now,
          )
          expect(intact.visible).toBe(true)
          expect(intact.rotation.z).toBe(0)
          expect(shards.visible).toBe(false)
          expect(wave.visible).toBe(false)
          expect(
            (intact.material as MeshPhysicalMaterial).emissiveIntensity,
          ).toBeGreaterThan(0)
          expect(
            (intact.material as MeshPhysicalMaterial).emissiveIntensity,
          ).toBeLessThanOrEqual(0.16)
        }
      }
      const replacement = new BoxGeometry(0.2, 0.3, 0.08)
      vessel.setGeometry(replacement)
      vessel.update(
        { id: target.id, charge: 1, phase: 'complete', brokenAt: null },
        6,
      )
      const replacedIntact = vessel.root.getObjectByName(
        `vessel-intact-${target.id}`,
      ) as Mesh
      expect(replacedIntact.geometry).toBe(replacement)
      expect(replacedIntact.visible).toBe(true)
      expect(
        (vessel.root.getObjectByName(`vessel-shards-${target.id}`) as Group)
          .children,
      ).toHaveLength(0)
      vessel.dispose()

      const restored = createVessel(target, reducedMotion)
      restored.update(
        { id: target.id, charge: 1, phase: 'complete', brokenAt: null },
        0,
      )
      expect(
        restored.root.getObjectByName(`vessel-intact-${target.id}`)?.visible,
      ).toBe(true)
      expect(
        restored.root.getObjectByName(`vessel-shards-${target.id}`)?.visible,
      ).toBe(false)
      restored.dispose()
    },
  )

  it('retains the authored intact mesh and releases its borrowed fracture lease exactly once', () => {
    const target = {
      ...GLASSWORKS_JOURNEY.breakables[0]!,
      completion: 'awaken' as const,
    }
    const geometry = new BoxGeometry(0.2, 0.3, 0.08)
    const shard = new BoxGeometry(0.1, 0.1, 0.08)
    const crack = new EdgesGeometry(shard)
    const sourceMaterial = new PhysicalMaterial({ transmission: 0.9 })
    const release = vi.fn()
    const vessel = createAuthoredVessel(target, false, (library) => ({
      geometry,
      pieces: [{ geometry: shard, centre: new Vector3() }],
      crackGeometries: [crack],
      materials: [library.clone(sourceMaterial)],
      transform: new Matrix4(),
      release,
    }))
    vessel.update(
      { id: target.id, charge: 1, phase: 'complete', brokenAt: null },
      0,
    )
    const intact = vessel.root.getObjectByName(
      `vessel-intact-${target.id}`,
    ) as Mesh
    expect(intact.geometry).toBe(geometry)
    expect(intact.visible).toBe(true)
    expect(intact.children).toHaveLength(0)
    expect(
      (intact.material as MeshPhysicalMaterial[])[0]?.emissiveIntensity,
    ).toBe(0.16)
    expect(
      (vessel.root.getObjectByName(`vessel-shards-${target.id}`) as Group)
        .children,
    ).toHaveLength(0)
    vessel.dispose()
    vessel.dispose()
    expect(release).toHaveBeenCalledOnce()
    geometry.dispose()
    shard.dispose()
    crack.dispose()
    sourceMaterial.dispose()
  })
})

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

    const vessel = createVessel(target!, false, { shatterPlaybackSpeed: 1 })
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

  it('casts no solid shadow from glass', () => {
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
    // Three's shadow map ignores transmission: glass would throw a solid shadow.
    expect(standardIntact.castShadow).toBe(false)
    expect(standardShards.children.some((child) => child.castShadow)).toBe(
      false,
    )
    standard.dispose()
  })

  it.each([true, false])(
    'keeps opaque vessel shadows unless a presentation omits flying-shard shadows (%s)',
    (castShardShadows) => {
      const target = GLASSWORKS_JOURNEY.breakables[0]!
      const geometry = new BoxGeometry(0.2, 0.3, 0.08)
      const shard = new BoxGeometry(0.1, 0.1, 0.08)
      const crack = new EdgesGeometry(shard)
      const porcelain = new PhysicalMaterial({ transmission: 0 })
      const vessel = createAuthoredVessel(
        target,
        false,
        (library) => ({
          geometry,
          pieces: [{ geometry: shard, centre: new Vector3() }],
          crackGeometries: [crack],
          materials: [library.clone(porcelain)],
          transform: new Matrix4(),
          release: () => undefined,
        }),
        { castShardShadows },
      )
      const intact = vessel.root.getObjectByName(
        `vessel-intact-${target.id}`,
      ) as Mesh
      const shards = vessel.root.getObjectByName(
        `vessel-shards-${target.id}`,
      ) as Group
      expect(intact.castShadow).toBe(true)
      expect(shards.children.length).toBeGreaterThan(0)
      expect(shards.children.every((child) => child.castShadow)).toBe(
        castShardShadows,
      )
      vessel.dispose()
      geometry.dispose()
      shard.dispose()
      crack.dispose()
      porcelain.dispose()
    },
  )
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
