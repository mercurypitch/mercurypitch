// Crackle art proofs — protect source fidelity, contact alignment, phase ownership and deterministic shard recovery.

import { BoxGeometry, Group, Line, LineBasicMaterial, Mesh, MeshPhysicalMaterial, MeshStandardMaterial, Vector3, } from 'three'
import { describe, expect, it, vi } from 'vitest'
import type { PlatformDefinition, PlatformRuntimeSnapshot } from '../contracts'
import type { CloudwayCrackleMaterialBinding } from './cloudway-crackle-adapter'
import { createCloudwayCrackleAdapter } from './cloudway-crackle-adapter'

function fixture(turns: 0 | 1 = 0) {
  const source = new Group()
  source.name = 'ReviewedCrystal'
  const provider = new MeshStandardMaterial({
    color: 0xfbcde9,
    roughness: 0.18,
  })
  const glass = new MeshPhysicalMaterial({
    color: 0xffeefb,
    transmission: 0.94,
    roughness: 0.09,
    metalness: 0,
  })
  const gold = new MeshStandardMaterial({ color: 0xe3bc67, metalness: 0.8 })
  const materialBindings: CloudwayCrackleMaterialBinding[] = []
  const groups = new Map<string, Group>()
  for (const [name, material, kind] of [
    ['intact', provider, 'opaque'],
    ['frame', gold, 'opaque'],
    ['left', glass, 'glass'],
    ['right', glass, 'glass'],
    ['contact', provider, 'opaque'],
  ] as const) {
    const group = new Group()
    group.name = name
    const mesh = new Mesh(new BoxGeometry(0.8, 0.24, 1.1), material)
    mesh.name = `${name}-mesh`
    mesh.position.y = -0.12
    group.add(mesh)
    source.add(group)
    groups.set(name, group)
    if (name !== 'contact')
      materialBindings.push({ mesh: mesh.name, kind, material })
  }
  groups.get('left')!.position.x = -0.4
  groups.get('right')!.position.x = 0.4
  groups.get('right')!.visible = false
  source.userData.platform_adapter_json = JSON.stringify({
    version: 1,
    coordinates: {
      upAxis: '+Y',
      units: 'metres',
      origin: 'top-centre-of-fully-extended-support',
    },
    support: { state: 'intact', topY: 0, width: 1.64, depth: 1.1 },
    motion: {
      kind: 'crackle',
      roles: {
        persistent: ['frame'],
        intactGlass: 'intact',
        contact: 'contact',
        shards: ['left', 'right'],
      },
    },
  })
  source.userData.collider_json = JSON.stringify({
    shape: 'box',
    width: 1.64,
    depth: 1.1,
    height: 0.24,
    topY: 0,
    center: [0, -0.12, 0],
  })
  const width = turns ? 1.1 : 1.64,
    depth = turns ? 1.64 : 1.1
  const platform: PlatformDefinition = {
    id: 'crystal',
    minX: 3 - width / 2,
    maxX: 3 + width / 2,
    minZ: 5 - depth / 2,
    maxZ: 5 + depth / 2,
    top: 2,
    thickness: 0.24,
    kind: 'deck',
    material: 'stone',
    renderQuarterTurns: turns,
    behavior: {
      kind: 'crackle',
      warningSeconds: 2,
      releaseSeconds: 1.15,
      resetSeconds: 2,
    },
  }
  return { source, platform, materials: materialBindings, provider, groups }
}

function snapshot(
  phase: PlatformRuntimeSnapshot['phase'],
  phaseProgress = 0,
): PlatformRuntimeSnapshot {
  return {
    id: 'crystal',
    phase,
    phaseProgress,
    offset: { x: 0, y: 0, z: 0 },
    collisionEnabled: phase === 'intact' || phase === 'warning',
  }
}

function visible(object: Mesh): boolean {
  for (
    let node: typeof object | Group | null = object;
    node;
    node = node.parent as Group | null
  )
    if (!node.visible) return false
  return true
}

describe('authored crackle art', () => {
  it('preserves the exact opaque source finish and contact orientation without stretching', () => {
    const f = fixture(1)
    const adapter = createCloudwayCrackleAdapter(f)
    expect(adapter.root.visible).toBe(false)
    adapter.update(snapshot('intact'))
    adapter.root.updateMatrixWorld(true)
    const intact = adapter.root.getObjectByName('intact-mesh') as Mesh
    expect(intact.material).toBe(f.provider)
    expect(intact.geometry.getAttribute('position').array).toEqual(
      (f.groups.get('intact')!.children[0] as Mesh).geometry.getAttribute(
        'position',
      ).array,
    )
    expect(intact.getWorldPosition(new Vector3()).toArray()).toEqual([
      3, 1.88, 5,
    ])
    expect(adapter.root.rotation.y).toBe(Math.PI / 2)
    expect(adapter.root.scale.toArray()).toEqual([1, 1, 1])
    expect(adapter.root.getObjectByName('contact')).toBeUndefined()
    expect(visible(intact)).toBe(true)
    expect(visible(adapter.root.getObjectByName('right-mesh') as Mesh)).toBe(
      false,
    )
    adapter.dispose()
  })

  it('hides the intact lattice on release and rotates shards about their own assembled pivots', () => {
    const f = fixture()
    const adapter = createCloudwayCrackleAdapter(f)
    adapter.update(snapshot('released', 0.5))
    adapter.root.updateMatrixWorld(true)
    expect(visible(adapter.root.getObjectByName('intact-mesh') as Mesh)).toBe(
      false,
    )
    expect(visible(adapter.root.getObjectByName('frame-mesh') as Mesh)).toBe(
      true,
    )
    const right = adapter.root.getObjectByName('right')!
    const shardMotion = right.parent!
    expect(visible(right.children[0] as Mesh)).toBe(true)
    // Rotation lives outside a zero-translation role transform, at its original pivot.
    expect(new Vector3().setFromMatrixPosition(right.matrix).toArray()).toEqual(
      [0, 0, 0],
    )
    expect(shardMotion.position.x).toBeCloseTo(
      0.4 + Math.cos(2.399963229728653) * 0.125,
    )
    expect(shardMotion.position.y).toBeCloseTo(-0.95)
    expect(
      (right.children[0] as Mesh).userData.excludeFromCameraCollision,
    ).toBe(true)
    expect(f.groups.get('right')!.visible).toBe(false)
    expect(f.groups.get('right')!.position.x).toBe(0.4)
    adapter.dispose()
  })

  it('is identical on repeated paused snapshots and reverses to the exact intact pose after reset', () => {
    const adapter = createCloudwayCrackleAdapter(fixture())
    const right = adapter.root.getObjectByName('right')!.parent!
    adapter.update(snapshot('released', 0.5))
    right.updateMatrix()
    const released = right.matrix.clone()
    for (let n = 0; n < 50; n++) adapter.update(snapshot('released', 0.5))
    right.updateMatrix()
    expect(right.matrix.equals(released)).toBe(true)
    adapter.update(snapshot('resetting', 0.5))
    right.updateMatrix()
    expect(right.matrix.equals(released)).toBe(true)
    adapter.update(snapshot('intact'))
    expect(right.position.toArray()).toEqual([0.4, 0, 0])
    expect(right.rotation.toArray().slice(0, 3)).toEqual([0, 0, 0])
    expect(visible(adapter.root.getObjectByName('intact-mesh') as Mesh)).toBe(
      true,
    )
    adapter.dispose()
  })

  it('owns only copied geometry, including idempotent disposal', () => {
    const f = fixture()
    const sourceMesh = f.groups.get('intact')!.children[0] as Mesh
    const sourceDispose = vi.spyOn(sourceMesh.geometry, 'dispose')
    const materialDispose = vi.spyOn(f.provider, 'dispose')
    const adapter = createCloudwayCrackleAdapter(f)
    const copied = adapter.root.getObjectByName('intact-mesh') as Mesh
    const copiedDispose = vi.spyOn(copied.geometry, 'dispose')
    adapter.dispose()
    adapter.dispose()
    expect(copiedDispose).toHaveBeenCalledOnce()
    expect(sourceDispose).not.toHaveBeenCalled()
    expect(materialDispose).not.toHaveBeenCalled()
  })

  it.each([
    'overlap',
    'unowned',
    'unsupported',
    'stretched',
    'wrong-collider',
    'incomplete-materials',
    'alpha-glass',
    'nonfinite',
  ])('rejects %s before touching borrowed resources', (problem) => {
    const f = fixture()
    const sourceDispose = vi.spyOn(
      (f.groups.get('intact')!.children[0] as Mesh).geometry,
      'dispose',
    )
    if (problem === 'overlap')
      f.groups.get('intact')!.add(f.groups.get('right')!)
    if (problem === 'unowned') {
      const mesh = new Mesh(new BoxGeometry(), f.provider)
      mesh.name = 'orphan'
      f.source.add(mesh)
    }
    if (problem === 'unsupported')
      f.groups
        .get('intact')!
        .add(new Line(new BoxGeometry(), new LineBasicMaterial()))
    if (problem === 'stretched') f.platform.maxX += 0.1
    if (problem === 'wrong-collider')
      f.source.userData.collider_json = JSON.stringify({
        shape: 'box',
        width: 1.64,
        depth: 1.1,
        height: 0.24,
        topY: 0,
        center: [0, 0, 0],
      })
    if (problem === 'incomplete-materials') f.materials.pop()
    if (problem === 'alpha-glass') f.materials[2]!.material.transparent = true
    if (problem === 'nonfinite') f.groups.get('right')!.position.x = NaN
    expect(() => createCloudwayCrackleAdapter(f)).toThrow(/Cloudway crackle/)
    expect(sourceDispose).not.toHaveBeenCalled()
  })

  it('rejects invalid snapshots without advancing the current pose', () => {
    const adapter = createCloudwayCrackleAdapter(fixture())
    adapter.update(snapshot('intact'))
    for (const invalid of [
      snapshot('moving'),
      snapshot('released', NaN),
      { ...snapshot('intact'), id: 'other' },
      { ...snapshot('intact'), offset: { x: 0, y: -1, z: 0 } },
    ])
      expect(() => adapter.update(invalid)).toThrow(/Cloudway crackle/)
    expect(visible(adapter.root.getObjectByName('intact-mesh') as Mesh)).toBe(
      true,
    )
    adapter.dispose()
  })
})
