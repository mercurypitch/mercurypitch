// Vessel shatter presentation regressions — authored pieces, micro debris and save restoration share one bounded beat.

import type { BufferGeometry, InstancedMesh, Mesh } from 'three'
import { Box3, BoxGeometry, Group, LineBasicMaterial, LineSegments, Material, MeshPhysicalMaterial, Quaternion, Vector3, } from 'three'
import { describe, expect, it, vi } from 'vitest'
import { FROST_WALL_PANE } from '../content/frost-wall-profile'
import { GLASSWORKS } from '../content/glassworks'
import { LIVING_GLASS_ROSEBUD_ID, LIVING_GLASS_TRIAL, } from '../content/living-glass-trial'
import { RESONANCE_ROSEBUD_MATERIALS } from '../content/resonance-rosebud-profile'
import type { BreakableDefinition, BreakableSnapshot } from '../contracts'
import { SHATTER_LIFECYCLE_SECONDS, SHATTER_PRESENTATION_TIMING, } from '../core/shatter-presentation'
import { createVessel } from './vessels'

function target(variant: 'goblet' | 'vase' | 'portrait'): BreakableDefinition {
  return {
    ...GLASSWORKS.breakables[0],
    id: `profile-${variant}`,
    variant,
  }
}

function snapshot(
  id: string,
  phase: BreakableSnapshot['phase'],
  brokenAt: number | null,
  charge = 1,
): BreakableSnapshot {
  return { id, phase, brokenAt, charge }
}

describe('vessel shatter presentation', () => {
  it.each([
    ['goblet', 'crown'],
    ['vase', 'radial'],
    ['portrait', 'sheet'],
  ] as const)("selects the %s recipe's %s burst", (variant, profile) => {
    const vessel = createVessel(target(variant), false)
    const burst = vessel.root.getObjectByName(
      `shatter-burst-${target(variant).id}`,
    )!

    expect(burst.userData.shatterProfile).toBe(profile)
    expect(burst.children).toHaveLength(4)
    vessel.dispose()
  })

  it('keeps authored macro pieces and layers anticipation, stagger and micro debris around them', () => {
    const subject = { ...target('goblet'), id: 'authored-crown' }
    const vessel = createVessel(subject, false, { shatterPlaybackSpeed: 1 })
    const geometry = new BoxGeometry(0.6, 0.8, 0.4)
    geometry.translate(0, 0.4, 0)
    const pieces = [
      {
        geometry: new BoxGeometry(0.2, 0.28, 0.16),
        centre: new Vector3(-0.16, 0.58, 0),
      },
      {
        geometry: new BoxGeometry(0.22, 0.24, 0.14),
        centre: new Vector3(0.17, 0.62, 0.02),
      },
    ]
    vessel.setGeometry(geometry, pieces)
    const intact = vessel.root.getObjectByName(
      `vessel-intact-${subject.id}`,
    ) as Mesh
    const shards = vessel.root.getObjectByName(
      `vessel-shards-${subject.id}`,
    ) as Group
    const burst = vessel.root.getObjectByName(`shatter-burst-${subject.id}`)!
    const cracks = intact.children.filter(
      (child): child is LineSegments => child instanceof LineSegments,
    )

    expect(shards.children.map((child) => (child as Mesh).geometry)).toEqual(
      pieces.map((piece) => piece.geometry),
    )
    vessel.update(
      snapshot(subject.id, 'shattering', 0),
      SHATTER_PRESENTATION_TIMING.normal.anticipationSeconds / 2,
    )
    expect(intact.visible).toBe(true)
    expect(shards.visible).toBe(false)
    expect(burst.visible).toBe(false)
    expect(cracks.every((crack) => crack.visible)).toBe(true)

    vessel.update(
      snapshot(subject.id, 'shattering', 0),
      SHATTER_PRESENTATION_TIMING.normal.anticipationSeconds,
    )
    expect(intact.visible).toBe(false)
    expect(shards.visible).toBe(true)
    shards.children.forEach((child, index) => {
      // Delayed release cannot punch an early invisible hole in the exhibit.
      expect(child.visible).toBe(true)
      expect(child.position.distanceTo(pieces[index].centre)).toBeLessThan(1e-9)
      expect(child.scale.x).toBe(1)
    })

    vessel.update(
      snapshot(subject.id, 'shattering', 0),
      SHATTER_PRESENTATION_TIMING.normal.anticipationSeconds + 0.2,
    )
    expect(intact.visible).toBe(false)
    expect(shards.visible).toBe(true)
    expect(burst.visible).toBe(true)
    expect(
      shards.children.some(
        (child, index) =>
          child.position.distanceTo(pieces[index].centre) > 0.01,
      ),
    ).toBe(true)

    vessel.update(
      snapshot(subject.id, 'complete', 0),
      SHATTER_LIFECYCLE_SECONDS,
    )
    expect(shards.visible).toBe(false)
    expect(burst.visible).toBe(false)
    vessel.update(snapshot(subject.id, 'complete', null), 40)
    vessel.update(snapshot(subject.id, 'complete', null), 80)
    expect(intact.visible).toBe(false)
    expect(shards.visible).toBe(false)
    expect(burst.visible).toBe(false)
    vessel.dispose()
  })

  it('omits all instanced micro effects for reduced motion', () => {
    const subject = target('vase')
    const vessel = createVessel(subject, true)

    expect(
      vessel.root.getObjectByName(`shatter-burst-${subject.id}`),
    ).toBeUndefined()
    vessel.update(snapshot(subject.id, 'shattering', 0), 0.2)
    const shards = vessel.root.getObjectByName(
      `vessel-shards-${subject.id}`,
    ) as Group
    expect(shards.visible).toBe(true)
    vessel.dispose()
  })

  it('layers the Rosebud response around standard rigid shards and accepts a replaceable visual reward', () => {
    const subject = LIVING_GLASS_TRIAL.breakables[0]!
    const reward = new Group()
    reward.name = 'test-resonance-reward'
    const disposeReward = vi.fn()
    const vessel = createVessel(subject, false, {
      shatterPlaybackSpeed: 1,
      resonanceRewardFactory: () => ({
        object: reward,
        dispose: disposeReward,
      }),
    })
    const intact = vessel.root.getObjectByName(
      `vessel-intact-${LIVING_GLASS_ROSEBUD_ID}`,
    )!
    const shards = vessel.root.getObjectByName(
      `vessel-shards-${LIVING_GLASS_ROSEBUD_ID}`,
    ) as Group
    const cracks = intact.getObjectByName('resonance-surface-fracture-lines')!

    expect(vessel.root.getObjectByName('resonance-release')).toBeDefined()
    expect(vessel.root.getObjectByName('test-resonance-reward')).toBe(reward)
    expect(
      vessel.root.getObjectByName(`shatter-burst-${LIVING_GLASS_ROSEBUD_ID}`),
    ).toBeUndefined()
    expect(cracks.parent?.parent).toBe(intact)

    vessel.update(snapshot(subject.id, 'charging', null, 0.2), 0)
    expect(vessel.resonanceSnapshot()).toMatchObject({
      phase: 'charging',
      chargeProgress: 0.2,
      crackStage: 0,
    })
    vessel.update(snapshot(subject.id, 'charging', null, 0.7), 0.1)
    expect(vessel.resonanceSnapshot()).toMatchObject({
      phase: 'charging',
      chargeProgress: 0.7,
      crackStage: 2,
    })
    expect(intact.quaternion.angleTo(new Quaternion())).toBeLessThanOrEqual(
      0.01,
    )

    vessel.update(snapshot(subject.id, 'shattering', 1), 1.2)
    expect(shards.visible).toBe(true)
    expect(vessel.resonanceSnapshot()).toMatchObject({
      phase: 'releasing',
      rewardVisible: true,
    })
    vessel.update(snapshot(subject.id, 'complete', 1), 3.31)
    expect(shards.visible).toBe(false)
    expect(vessel.resonanceSnapshot()).toMatchObject({
      phase: 'completed',
      releaseProgress: 1,
      rewardVisible: true,
    })
    vessel.update(snapshot(subject.id, 'complete', null), 40)
    expect(intact.visible).toBe(false)
    expect(shards.visible).toBe(false)
    expect(vessel.resonanceSnapshot()).toMatchObject({
      phase: 'restored',
      rewardVisible: false,
    })

    vessel.dispose()
    expect(disposeReward).toHaveBeenCalledOnce()
  })

  it('reclaims outer vessel materials when first reward construction throws', () => {
    const materialDispose = vi.spyOn(Material.prototype, 'dispose')
    try {
      expect(() =>
        createVessel(LIVING_GLASS_TRIAL.breakables[0]!, false, {
          resonanceRewardFactory: () => {
            throw new Error('initial reward failed')
          },
        }),
      ).toThrow('initial reward failed')

      const disposed = materialDispose.mock.instances as Material[]
      expect(
        disposed.filter(
          (material) =>
            material instanceof MeshPhysicalMaterial &&
            material.color.getHex() === 0xf3c9dc &&
            material.transmission === 0.96 &&
            material.emissive.getHex() === 0xfff0c6,
        ),
      ).toHaveLength(1)
      expect(
        disposed.filter((material) => material.name === 'portrait-surface'),
      ).toHaveLength(1)
      expect(
        disposed.filter(
          (material) =>
            material instanceof MeshPhysicalMaterial &&
            material.name === '' &&
            material.color.getHex() === 0xffffff &&
            material.roughness === 0.24 &&
            material.metalness === 0.14,
        ),
      ).toHaveLength(1)
      expect(
        disposed.filter(
          (material) =>
            material instanceof LineBasicMaterial &&
            material.name === '' &&
            material.color.getHex() === 0xcaffee,
        ),
      ).toHaveLength(1)
    } finally {
      materialDispose.mockRestore()
    }
  })

  it('keeps the installed Rosebud when a replacement omits its glass material', () => {
    const subject = LIVING_GLASS_TRIAL.breakables[0]!
    const vessel = createVessel(subject, false)
    const previousIntact = vessel.root.getObjectByName(
      `vessel-intact-${LIVING_GLASS_ROSEBUD_ID}`,
    )!
    const previousResonance = vessel.root.getObjectByName('resonance-release')!
    const geometry = new BoxGeometry(0.6, 0.8, 0.4)
    const pieceGeometry = new BoxGeometry(0.2, 0.3, 0.15)
    const geometryDisposed = vi.fn()
    const pieceDisposed = vi.fn()
    geometry.addEventListener('dispose', geometryDisposed)
    pieceGeometry.addEventListener('dispose', pieceDisposed)
    const wrongMaterial = new MeshPhysicalMaterial()
    wrongMaterial.name = 'NotRoseGlass'

    expect(() =>
      vessel.setGeometry(
        geometry,
        [{ geometry: pieceGeometry, centre: new Vector3() }],
        [wrongMaterial],
      ),
    ).toThrow('missing glass material')

    expect(
      vessel.root.getObjectByName(`vessel-intact-${LIVING_GLASS_ROSEBUD_ID}`),
    ).toBe(previousIntact)
    expect(vessel.root.getObjectByName('resonance-release')).toBe(
      previousResonance,
    )
    expect(previousIntact.parent).toBe(vessel.root)
    expect(previousResonance.parent).toBe(vessel.root)
    expect(geometryDisposed).toHaveBeenCalledOnce()
    expect(pieceDisposed).toHaveBeenCalledOnce()
    vessel.update(snapshot(subject.id, 'charging', null, 0.6), 0.1)
    expect(vessel.resonanceSnapshot()).toMatchObject({
      phase: 'charging',
      chargeProgress: 0.6,
    })

    vessel.dispose()
    wrongMaterial.dispose()
  })

  it('keeps the installed Rosebud and reward when a replacement reward fails', () => {
    const subject = LIVING_GLASS_TRIAL.breakables[0]!
    const disposeReward = vi.fn()
    let rewardCalls = 0
    const vessel = createVessel(subject, false, {
      shatterPlaybackSpeed: 1,
      resonanceRewardFactory: () => {
        rewardCalls++
        if (rewardCalls > 1) throw new Error('replacement reward failed')
        const object = new Group()
        object.name = 'stable-resonance-reward'
        return { object, dispose: disposeReward }
      },
    })
    const previousIntact = vessel.root.getObjectByName(
      `vessel-intact-${LIVING_GLASS_ROSEBUD_ID}`,
    )!
    const previousResonance = vessel.root.getObjectByName('resonance-release')!
    const previousReward = vessel.root.getObjectByName(
      'stable-resonance-reward',
    )!
    const geometry = new BoxGeometry(0.6, 0.8, 0.4)
    const pieceGeometry = new BoxGeometry(0.2, 0.3, 0.15)
    const geometryDisposed = vi.fn()
    const pieceDisposed = vi.fn()
    geometry.addEventListener('dispose', geometryDisposed)
    pieceGeometry.addEventListener('dispose', pieceDisposed)
    const roseGlass = new MeshPhysicalMaterial()
    roseGlass.name = RESONANCE_ROSEBUD_MATERIALS.glass

    expect(() =>
      vessel.setGeometry(
        geometry,
        [{ geometry: pieceGeometry, centre: new Vector3() }],
        [roseGlass],
      ),
    ).toThrow('replacement reward failed')

    expect(rewardCalls).toBe(2)
    expect(disposeReward).not.toHaveBeenCalled()
    expect(
      vessel.root.getObjectByName(`vessel-intact-${LIVING_GLASS_ROSEBUD_ID}`),
    ).toBe(previousIntact)
    expect(vessel.root.getObjectByName('resonance-release')).toBe(
      previousResonance,
    )
    expect(vessel.root.getObjectByName('stable-resonance-reward')).toBe(
      previousReward,
    )
    expect(geometryDisposed).toHaveBeenCalledOnce()
    expect(pieceDisposed).toHaveBeenCalledOnce()

    vessel.dispose()
    expect(disposeReward).toHaveBeenCalledOnce()
    roseGlass.dispose()
  })

  it('returns cached intact-only world bounds after debris has moved', () => {
    const source = target('portrait')
    const subject: BreakableDefinition = {
      ...source,
      id: 'floor-pane',
      position: { x: 2, y: 1.25, z: -3 },
      presentation: { kind: 'barrier', facingYaw: Math.PI / 2 },
    }
    const vessel = createVessel(subject, false)
    const before = vessel.getIntactBounds(new Box3())

    expect(vessel.root.position.y).toBe(subject.position.y)
    expect(vessel.root.rotation.y).toBe(subject.presentation!.facingYaw)
    expect(before.min.y).toBeCloseTo(subject.position.y)
    vessel.update(snapshot(subject.id, 'shattering', 0), 0.8)
    const during = vessel.getIntactBounds(new Box3())

    expect(during).toEqual(before)
    vessel.dispose()
  })

  it('uses the certified floor-based wall envelope and ice-wall burst', () => {
    const source = target('portrait')
    const subject: BreakableDefinition = {
      ...source,
      id: 'frosted-scroll-wall',
      variant: 'frosted-scroll-wall',
      position: { x: 2, y: 0.32, z: -3 },
      presentation: { kind: 'barrier', facingYaw: Math.PI / 2 },
    }
    const vessel = createVessel(subject, false)
    const bounds = vessel.getIntactBounds(new Box3())
    const size = bounds.getSize(new Vector3())
    const burst = vessel.root.getObjectByName(`shatter-burst-${subject.id}`)!

    expect(vessel.root.position.y).toBe(subject.position.y)
    expect(vessel.root.rotation.y).toBe(subject.presentation!.facingYaw)
    expect(bounds.min.y).toBeCloseTo(subject.position.y)
    expect(size.x).toBeCloseTo(FROST_WALL_PANE.depth)
    expect(size.y).toBeCloseTo(FROST_WALL_PANE.height)
    expect(size.z).toBeCloseTo(FROST_WALL_PANE.width)
    expect(burst.userData.shatterProfile).toBe('ice-wall')
    expect(burst.userData.chipCount).toBe(72)
    vessel.dispose()
  })

  it('disposes the shared instanced burst resources with the vessel', () => {
    const subject = { ...target('vase'), id: 'dispose-profiled-vase' }
    const vessel = createVessel(subject, false)
    const burst = vessel.root.getObjectByName(`shatter-burst-${subject.id}`)!
    const geometries = new Set<BufferGeometry>()
    const materials = new Set<Material>()
    const meshDisposals = (burst.children as InstancedMesh[]).map(() => vi.fn())
    ;(burst.children as InstancedMesh[]).forEach((mesh, index) =>
      mesh.addEventListener('dispose', meshDisposals[index]),
    )
    for (const child of burst.children as InstancedMesh[]) {
      geometries.add(child.geometry)
      for (const material of Array.isArray(child.material)
        ? child.material
        : [child.material])
        materials.add(material)
    }
    const geometryDisposals = [...geometries].map(() => vi.fn())
    const materialDisposals = [...materials].map(() => vi.fn())
    ;[...geometries].forEach((geometry, index) =>
      geometry.addEventListener('dispose', geometryDisposals[index]),
    )
    ;[...materials].forEach((material, index) =>
      material.addEventListener('dispose', materialDisposals[index]),
    )

    vessel.dispose()

    meshDisposals.forEach((dispose) => expect(dispose).toHaveBeenCalledOnce())
    geometryDisposals.forEach((dispose) =>
      expect(dispose).toHaveBeenCalledOnce(),
    )
    materialDisposals.forEach((dispose) =>
      expect(dispose).toHaveBeenCalledOnce(),
    )
  })

  it('releases fallback burst instance buffers when authored geometry installs', () => {
    const subject = { ...target('goblet'), id: 'replace-profiled-goblet' }
    const vessel = createVessel(subject, false)
    const fallbackBurst = vessel.root.getObjectByName(
      `shatter-burst-${subject.id}`,
    )!
    const meshDisposals = (fallbackBurst.children as InstancedMesh[]).map(() =>
      vi.fn(),
    )
    ;(fallbackBurst.children as InstancedMesh[]).forEach((mesh, index) =>
      mesh.addEventListener('dispose', meshDisposals[index]),
    )

    vessel.setGeometry(new BoxGeometry(0.6, 0.8, 0.4))

    meshDisposals.forEach((dispose) => expect(dispose).toHaveBeenCalledOnce())
    expect(fallbackBurst.parent).toBeNull()
    expect(vessel.root.getObjectByName(`shatter-burst-${subject.id}`)).not.toBe(
      fallbackBurst,
    )
    vessel.dispose()
  })
})
