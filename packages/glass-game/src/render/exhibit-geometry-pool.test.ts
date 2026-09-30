// Exhibit lease regressions — shared buffers outlive individual vessels without sharing mutable presentation state.

import type { BufferGeometry, MeshPhysicalMaterial as PhysicalMaterial, Object3D, } from 'three'
import { BoxGeometry, Group, Mesh, MeshBasicMaterial, MeshPhysicalMaterial, Texture, } from 'three'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LIVING_GLASS_TRIAL } from '../content/living-glass-trial'
import { RESONANCE_ROSEBUD_BUNDLE_ID, RESONANCE_ROSEBUD_MATERIALS, RESONANCE_ROSEBUD_NODES, RESONANCE_ROSEBUD_VARIANT_ID, } from '../content/resonance-rosebud-profile'
import { getBreakableRenderRecipe } from './catalog'
import { disposeObject } from './dispose'
import type { PreparedExhibitAssetLease } from './exhibit-geometry-pool'
import { createExhibitGeometryPool } from './exhibit-geometry-pool'
import { createMaterialLibrary } from './material-library'
import { RESONANCE_PEARL_PALETTE } from './resonance-release-config'
import { createVessel } from './vessels'

const cleanup: (() => void)[] = []
afterEach(() => {
  cleanup
    .splice(0)
    .reverse()
    .forEach((dispose) => dispose())
  vi.restoreAllMocks()
})

const recipe = getBreakableRenderRecipe(RESONANCE_ROSEBUD_VARIANT_ID)

function fixture(physical = true) {
  const scene = new Group()
  const material = physical
    ? new MeshPhysicalMaterial({
        thickness: 0.012,
        attenuationDistance: 0.15,
        transmission: 0.96,
      })
    : new MeshBasicMaterial()
  material.name = RESONANCE_ROSEBUD_MATERIALS.glass
  material.map = new Texture()
  const intact = new Mesh(new BoxGeometry(0.3, 0.45, 0.3), material)
  intact.position.y = 0.225
  intact.name = RESONANCE_ROSEBUD_NODES.intact
  scene.add(intact)
  for (let index = 0; index < recipe.shardCount; index++) {
    const shard = new Mesh(new BoxGeometry(0.08, 0.08, 0.08), material)
    shard.name = `${RESONANCE_ROSEBUD_NODES.shardPrefix}${String(index).padStart(3, '0')}`
    shard.position.set((index % 2) * 0.1, index * 0.018 + 0.04, 0)
    scene.add(shard)
  }
  cleanup.push(() => disposeObject(scene))
  const pool = createExhibitGeometryPool(scene, RESONANCE_ROSEBUD_BUNDLE_ID)
  cleanup.push(() => pool.close())
  const acquire = (override = recipe, library = createMaterialLibrary()) => {
    cleanup.push(() => library.dispose())
    const lease = pool.acquire(override, library)
    cleanup.push(() => lease.release())
    return lease
  }
  return { scene, intact, material, pool, acquire }
}

function ownedGeometries(lease: PreparedExhibitAssetLease): BufferGeometry[] {
  return [lease.geometry, ...lease.pieces.map((piece) => piece.geometry)]
}

function disposalCounts(lease: PreparedExhibitAssetLease) {
  return ownedGeometries(lease).map((geometry) => {
    const disposed = vi.fn()
    geometry.addEventListener('dispose', disposed)
    return disposed
  })
}

function vessel(id: string, crackGlow = RESONANCE_PEARL_PALETTE.crackGlow) {
  const target = { ...LIVING_GLASS_TRIAL.breakables[0]!, id }
  const result = createVessel(target, false, {
    resonancePresentation: { palette: { crackGlow } },
  })
  cleanup.push(() => result.dispose())
  return result
}

function intactMesh(root: Object3D, id: string): Mesh {
  return root.getObjectByName(`vessel-intact-${id}`) as Mesh
}

describe('bundle-scoped exhibit geometry leases', () => {
  it('shares prepared buffers but isolates material optics, piece pivots and placement transforms', () => {
    const { acquire, pool, intact } = fixture()
    const first = acquire()
    const second = acquire({
      ...recipe,
      resonancePresentation: { seed: 73, intensity: 0.6 },
    })
    const third = acquire()
    pool.close()

    expect(first.geometry).toBe(second.geometry)
    expect(ownedGeometries(third)).toEqual(ownedGeometries(first))
    expect(first.geometry).not.toBe(intact.geometry)
    expect(first.geometry.boundingBox?.max.y).toBeCloseTo(recipe.displayHeight)
    expect(
      ownedGeometries(first).every(
        (geometry) => geometry.boundingSphere !== null,
      ),
    ).toBe(true)
    expect(first.materials[0]).not.toBe(second.materials[0])
    const firstMaterial = first.materials[0] as PhysicalMaterial
    const secondMaterial = second.materials[0] as PhysicalMaterial
    expect(firstMaterial.map).not.toBe(secondMaterial.map)
    expect(firstMaterial.thickness).toBeCloseTo((0.012 * 0.8) / 0.45)
    expect(secondMaterial.thickness).toBeCloseTo(firstMaterial.thickness)
    expect(secondMaterial.attenuationDistance).toBeCloseTo((0.15 * 0.8) / 0.45)
    firstMaterial.emissiveIntensity = 2
    expect(secondMaterial.emissiveIntensity).not.toBe(2)
    const originalCentre = second.pieces[0]!.centre.clone()
    first.pieces[0]!.centre.set(20, 30, 40)
    expect(second.pieces[0]!.centre).toEqual(originalCentre)
    first.transform.makeTranslation(12, 0, 0)
    expect(second.transform.elements[12]).not.toBe(12)
  })

  it('keeps geometry alive through intermediate and repeated releases, then disposes the final owner once', () => {
    const { acquire, pool, intact } = fixture()
    const leases = [acquire(), acquire(), acquire()]
    const disposals = disposalCounts(leases[0]!)
    const borrowedDispose = vi.fn()
    intact.geometry.addEventListener('dispose', borrowedDispose)
    pool.close()

    leases[0]!.release()
    leases[0]!.release()
    leases[1]!.release()
    expect(
      disposals.every((disposed) => disposed.mock.calls.length === 0),
    ).toBe(true)
    leases[2]!.release()
    leases[2]!.release()
    pool.close()
    expect(
      disposals.every((disposed) => disposed.mock.calls.length === 1),
    ).toBe(true)
    expect(borrowedDispose).not.toHaveBeenCalled()
    expect(() => acquire()).toThrow('pool is closed')
  })

  it('retains an unused entry only until installation closes and never aliases distinct preparation contracts', () => {
    const { acquire, pool } = fixture()
    const first = acquire()
    const smaller = acquire({ ...recipe, displayHeight: 0.4 })
    expect(smaller.geometry).not.toBe(first.geometry)
    expect(smaller.geometry.boundingBox?.max.y).toBeCloseTo(0.4)
    expect((smaller.materials[0] as PhysicalMaterial).thickness).toBeCloseTo(
      (0.012 * 0.4) / 0.45,
    )
    expect(() => acquire({ ...recipe, shardCount: 19 })).toThrow(
      'Unexpected fracture node',
    )
    expect(() => acquire({ ...recipe, sourceHeight: 0.9 })).toThrow(
      'source height',
    )
    expect(() => acquire({ ...recipe, displayHeight: Number.NaN })).toThrow(
      'finite and positive',
    )
    const disposals = disposalCounts(first)
    first.release()
    expect(
      disposals.every((disposed) => disposed.mock.calls.length === 0),
    ).toBe(true)
    pool.close()
    expect(
      disposals.every((disposed) => disposed.mock.calls.length === 1),
    ).toBe(true)
  })

  it('reclaims template materials when preparation fails without disposing source materials or textures', () => {
    const { material, acquire, pool } = fixture(false)
    const template = material.clone()
    const templateDispose = vi.spyOn(template, 'dispose')
    const sourceDispose = vi.spyOn(material, 'dispose')
    const textureDispose = vi.spyOn(material.map!, 'dispose')
    vi.spyOn(material, 'clone').mockReturnValue(template)

    expect(() => acquire()).toThrow('must be physical')
    pool.close()
    expect(templateDispose).toHaveBeenCalledOnce()
    expect(sourceDispose).not.toHaveBeenCalled()
    expect(textureDispose).not.toHaveBeenCalled()
  })

  it('keeps shared geometry after a material-clone failure until remaining vessel leases release', () => {
    const { acquire, pool } = fixture()
    const first = acquire()
    const disposals = disposalCounts(first)
    const brokenLibrary = createMaterialLibrary()
    cleanup.push(() => brokenLibrary.dispose())
    vi.spyOn(brokenLibrary, 'clone').mockImplementation(() => {
      throw new Error('material clone failed')
    })

    expect(() => pool.acquire(recipe, brokenLibrary)).toThrow(
      'material clone failed',
    )
    pool.close()
    expect(
      disposals.every((disposed) => disposed.mock.calls.length === 0),
    ).toBe(true)
    first.release()
    expect(
      disposals.every((disposed) => disposed.mock.calls.length === 1),
    ).toBe(true)
  })
})

describe('leased vessel installations', () => {
  it('keeps three vessels independent through charge, shatter, replacement and final teardown', () => {
    const { pool } = fixture()
    const first = vessel('first', 0xffaabb)
    const second = vessel('second', 0xaabbff)
    const third = vessel('third')
    const vessels = [first, second, third]
    const leases = vessels.map((item) =>
      pool.acquire(recipe, item.materialLibrary),
    )
    const disposals = disposalCounts(leases[0]!)
    vessels.forEach((item, index) => item.setGeometryLease(leases[index]!))
    pool.close()
    const positions = Array.from(
      leases[0]!.geometry.getAttribute('position').array,
    )
    first.update(
      { id: 'first', phase: 'charging', brokenAt: null, charge: 0.9 },
      0.1,
    )
    second.update(
      { id: 'second', phase: 'idle', brokenAt: null, charge: 0 },
      0.1,
    )

    expect(
      (leases[0]!.materials[0] as PhysicalMaterial).emissive.getHex(),
    ).toBe(0xffaabb)
    expect(
      (leases[1]!.materials[0] as PhysicalMaterial).emissive.getHex(),
    ).toBe(0xaabbff)
    expect(
      (leases[1]!.materials[0] as PhysicalMaterial).emissiveIntensity,
    ).toBe(0)
    first.update(
      { id: 'first', phase: 'shattering', brokenAt: 0, charge: 1 },
      0.8,
    )
    expect(first.root.getObjectByName('vessel-shards-first')?.visible).toBe(
      true,
    )
    expect(second.root.getObjectByName('vessel-shards-second')?.visible).toBe(
      false,
    )
    expect(
      Array.from(leases[0]!.geometry.getAttribute('position').array),
    ).toEqual(positions)
    expect(intactMesh(second.root, 'second').geometry).toBe(leases[0]!.geometry)
    second.setGeometry(new BoxGeometry(0.2, 0.8, 0.2))
    first.dispose()
    first.dispose()
    expect(
      disposals.every((disposed) => disposed.mock.calls.length === 0),
    ).toBe(true)
    third.dispose()
    third.dispose()
    expect(
      disposals.every((disposed) => disposed.mock.calls.length === 1),
    ).toBe(true)
  })

  it('releases a rejected replacement without destroying its previous installation or a sibling lease', () => {
    const { pool } = fixture()
    const first = vessel('first')
    const sibling = vessel('sibling')
    const firstLease = pool.acquire(recipe, first.materialLibrary)
    const siblingLease = pool.acquire(recipe, sibling.materialLibrary)
    first.setGeometryLease(firstLease)
    sibling.setGeometryLease(siblingLease)
    const replacement = pool.acquire(recipe, first.materialLibrary)
    const previousIntact = intactMesh(first.root, 'first')
    const disposals = disposalCounts(firstLease)
    pool.close()

    expect(() =>
      first.setGeometryLease({ ...replacement, materials: [] }),
    ).toThrow('missing glass material')
    expect(intactMesh(first.root, 'first')).toBe(previousIntact)
    first.dispose()
    expect(
      disposals.every((disposed) => disposed.mock.calls.length === 0),
    ).toBe(true)
    sibling.dispose()
    expect(
      disposals.every((disposed) => disposed.mock.calls.length === 1),
    ).toBe(true)
  })

  it('releases late leases after a break or teardown without rewinding the vessel or invalidating a sibling', () => {
    const { pool } = fixture()
    const broken = vessel('broken')
    const sibling = vessel('sibling')
    const siblingLease = pool.acquire(recipe, sibling.materialLibrary)
    sibling.setGeometryLease(siblingLease)
    const lateBroken = pool.acquire(recipe, broken.materialLibrary)
    const lateDisposed = pool.acquire(recipe, broken.materialLibrary)
    const disposals = disposalCounts(siblingLease)
    pool.close()
    const previousIntact = intactMesh(broken.root, 'broken')
    broken.update(
      { id: 'broken', phase: 'shattering', brokenAt: 0, charge: 1 },
      0.8,
    )

    broken.setGeometryLease(lateBroken)
    expect(intactMesh(broken.root, 'broken')).toBe(previousIntact)
    broken.dispose()
    broken.setGeometryLease(lateDisposed)
    expect(
      disposals.every((disposed) => disposed.mock.calls.length === 0),
    ).toBe(true)
    sibling.dispose()
    expect(
      disposals.every((disposed) => disposed.mock.calls.length === 1),
    ).toBe(true)
  })
})
