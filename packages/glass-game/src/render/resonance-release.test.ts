// Resonance presentation regressions — cracks stay on the vase and lifecycle phases remain explicit.

import type { InstancedMesh, LineSegments, MeshPhysicalMaterial, Object3D, } from 'three'
import { BoxGeometry, BufferGeometry, Group, Material, Matrix4, Mesh, MeshBasicMaterial, SphereGeometry, Vector3, } from 'three'
import { describe, expect, it, vi } from 'vitest'
import type { ResonanceRewardVisualFactory } from './resonance-release'
import { createResonancePresentation } from './resonance-release'

function vaseSurface() {
  const geometry = new SphereGeometry(0.4, 32, 18)
  geometry.translate(0, 0.4, 0)
  const material = new MeshBasicMaterial()
  const intact = new Mesh(geometry, material)
  intact.name = 'borrowed-intact-vase'
  return { geometry, material, intact }
}

function renderResources(...roots: Object3D[]): {
  readonly geometries: Set<BufferGeometry>
  readonly materials: Set<Material>
} {
  const geometries = new Set<BufferGeometry>()
  const materials = new Set<Material>()
  roots.forEach((root) =>
    root.traverse((object) => {
      const renderable = object as Object3D & {
        geometry?: BufferGeometry
        material?: Material | Material[]
      }
      if (renderable.geometry) geometries.add(renderable.geometry)
      if (renderable.material)
        (Array.isArray(renderable.material)
          ? renderable.material
          : [renderable.material]
        ).forEach((material) => materials.add(material))
    }),
  )
  return { geometries, materials }
}

function renderGeometries(...roots: Object3D[]): Set<BufferGeometry> {
  return renderResources(...roots).geometries
}

interface ConstructionDisposals {
  readonly geometryNames: Set<string>
  readonly materialNames: Set<string>
}

function captureConstructionDisposals(run: () => void): ConstructionDisposals {
  const geometryNames = new Set<string>()
  const materialNames = new Set<string>()
  const originalGeometryDispose = BufferGeometry.prototype.dispose
  const originalMaterialDispose = Material.prototype.dispose
  const geometryDispose = vi
    .spyOn(BufferGeometry.prototype, 'dispose')
    .mockImplementation(function (this: BufferGeometry) {
      geometryNames.add(this.name)
      originalGeometryDispose.call(this)
    })
  const materialDispose = vi
    .spyOn(Material.prototype, 'dispose')
    .mockImplementation(function (this: Material) {
      materialNames.add(this.name)
      originalMaterialDispose.call(this)
    })

  try {
    run()
  } finally {
    geometryDispose.mockRestore()
    materialDispose.mockRestore()
  }
  return { geometryNames, materialNames }
}

function expectPresentationConstructionDisposed({
  geometryNames,
  materialNames,
}: ConstructionDisposals): void {
  expect(geometryNames.has('resonance-surface-fracture-geometry')).toBe(true)
  expect(geometryNames.has('resonance-shared-particle-geometry')).toBe(true)
  expect(
    [...geometryNames].some((name) =>
      name.startsWith('resonance-spray-geometry-'),
    ),
  ).toBe(true)
  for (const name of [
    'resonance-surface-fracture-material',
    'resonance-spray-material',
    'resonance-droplet-material',
    'resonance-dust-material',
  ])
    expect(materialNames.has(name)).toBe(true)
}

describe('Resonance presentation', () => {
  it('projects staged fractures onto the supplied surface instead of drawing bounding-box scratches', () => {
    const { geometry, material, intact } = vaseSurface()
    const effect = createResonancePresentation({
      surfaceGeometry: geometry,
      intactVisual: intact,
      seed: 33,
    })
    effect.update({
      deltaSeconds: 0,
      phase: 'charging',
      chargeProgress: 1,
      releaseProgress: 0,
    })
    const lines = intact.getObjectByName(
      'resonance-surface-fracture-lines',
    ) as LineSegments
    const positions = lines.geometry.getAttribute('position')
    const point = new Vector3()
    const sphereCentre = new Vector3(0, 0.4, 0)

    expect(effect.snapshot().totalCrackSegments).toBeGreaterThan(20)
    for (let index = 0; index < positions.count; index++) {
      point.fromBufferAttribute(positions, index)
      // SphereGeometry is faceted; projected triangle faces sit just inside
      // the analytic radius while the presentation offset avoids z-fighting.
      expect(point.distanceTo(sphereCentre)).toBeGreaterThan(0.396)
      expect(point.distanceTo(sphereCentre)).toBeLessThan(0.404)
    }

    effect.dispose()
    geometry.dispose()
    material.dispose()
  })

  it('suppresses projected samples whose first surface hit is gold trim', () => {
    const { geometry, material, intact } = vaseSurface()
    geometry.clearGroups()
    geometry.addGroup(0, geometry.getIndex()!.count, 1)

    const effect = createResonancePresentation({
      surfaceGeometry: geometry,
      glassMaterialIndices: [0],
      intactVisual: intact,
    })

    expect(effect.snapshot().totalCrackSegments).toBe(0)
    effect.dispose()
    geometry.dispose()
    material.dispose()
  })

  it('rejects invalid material filters before taking ownership of any borrowed resource', () => {
    const { geometry, material } = vaseSurface()
    const cloneGeometry = vi.spyOn(geometry, 'clone')
    const geometryDispose = vi.fn()
    const materialDispose = vi.fn()
    geometry.addEventListener('dispose', geometryDispose)
    material.addEventListener('dispose', materialDispose)

    expect(() =>
      createResonancePresentation({
        surfaceGeometry: geometry,
        glassMaterialIndices: [-1],
      }),
    ).toThrow(/non-negative integers/)
    expect(cloneGeometry).not.toHaveBeenCalled()
    expect(geometryDispose).not.toHaveBeenCalled()
    expect(materialDispose).not.toHaveBeenCalled()

    geometry.dispose()
    material.dispose()
  })

  it('adds fracture stages, then clears them when authoritative charge decays', () => {
    const { geometry, material, intact } = vaseSurface()
    const effect = createResonancePresentation({
      surfaceGeometry: geometry,
      intactVisual: intact,
    })
    const initialGeometries = renderGeometries(intact, effect.root)

    effect.update({
      deltaSeconds: 0,
      phase: 'charging',
      chargeProgress: 0.2,
      releaseProgress: 0,
    })
    const firstStage = effect.snapshot()
    effect.update({
      deltaSeconds: 0,
      phase: 'charging',
      chargeProgress: 0.7,
      releaseProgress: 0,
    })
    const laterStage = effect.snapshot()
    effect.update({
      deltaSeconds: 0,
      phase: 'idle',
      chargeProgress: 0,
      releaseProgress: 0,
    })

    expect(firstStage.crackStage).toBe(0)
    expect(laterStage.crackStage).toBe(2)
    expect(laterStage.visibleCrackSegments).toBeGreaterThan(
      firstStage.visibleCrackSegments,
    )
    expect(effect.snapshot()).toMatchObject({
      crackStage: -1,
      visibleCrackSegments: 0,
    })
    const updatedGeometries = renderGeometries(intact, effect.root)
    expect(updatedGeometries.size).toBe(initialGeometries.size)
    expect(
      [...updatedGeometries].every((candidate) =>
        initialGeometries.has(candidate),
      ),
    ).toBe(true)
    effect.dispose()
    geometry.dispose()
    material.dispose()
  })

  it('trembles only the borrowed visual and restores it before stable release accents', () => {
    const { geometry, material, intact } = vaseSurface()
    const parent = new Group()
    parent.add(intact)
    const effect = createResonancePresentation({
      surfaceGeometry: geometry,
      intactVisual: intact,
      seed: 51,
    })
    parent.add(effect.root)
    const basePosition = intact.position.clone()
    const baseQuaternion = intact.quaternion.clone()

    effect.update({
      deltaSeconds: 0.1,
      phase: 'charging',
      chargeProgress: 0.95,
      releaseProgress: 0,
    })

    expect(intact.position.distanceTo(basePosition)).toBeGreaterThan(0)
    expect(intact.position.distanceTo(basePosition)).toBeLessThanOrEqual(0.003)
    expect(intact.quaternion.angleTo(baseQuaternion)).toBeLessThanOrEqual(0.012)
    expect(effect.root.position.length()).toBe(0)
    expect(intact.getObjectByName('resonance-surface-fractures')?.parent).toBe(
      intact,
    )

    effect.update({
      deltaSeconds: 0.1,
      phase: 'releasing',
      chargeProgress: 1,
      releaseProgress: 0.25,
    })
    expect(intact.position.distanceTo(basePosition)).toBeLessThan(1e-12)
    expect(intact.quaternion.angleTo(baseQuaternion)).toBeLessThan(1e-12)
    expect(effect.root.position.length()).toBe(0)

    effect.dispose()
    geometry.dispose()
    material.dispose()
  })

  it('holds the earned reward for completion and hides everything on explicit restore', () => {
    const { geometry, material, intact } = vaseSurface()
    const effect = createResonancePresentation({
      surfaceGeometry: geometry,
      intactVisual: intact,
    })
    const reward = effect.root.getObjectByName('resonance-reward-anchor')!
    const spray = effect.root.getObjectByName('resonance-spray-0') as Mesh<
      BufferGeometry,
      MeshPhysicalMaterial
    >

    effect.update({
      deltaSeconds: 0,
      phase: 'completed',
      chargeProgress: 0,
      releaseProgress: 0,
    })
    expect(effect.snapshot().rewardVisible).toBe(true)
    expect(reward.scale.x).toBe(1)
    expect(spray.material.opacity).toBe(0)

    effect.update({
      deltaSeconds: 0,
      phase: 'restored',
      chargeProgress: 0,
      releaseProgress: 0,
    })
    expect(effect.snapshot()).toMatchObject({
      phase: 'restored',
      rewardVisible: false,
      visibleCrackSegments: 0,
    })
    expect(reward.scale.x).toBeLessThan(0.0001)
    expect(spray.material.opacity).toBe(0)

    effect.dispose()
    geometry.dispose()
    material.dispose()
  })

  it('keeps every prebuilt release primitive renderable while its initial scale or opacity hides it', () => {
    const { geometry, material, intact } = vaseSurface()
    const effect = createResonancePresentation({
      surfaceGeometry: geometry,
      intactVisual: intact,
    })
    const reward = effect.root.getObjectByName('resonance-reward-anchor')!
    const droplets = effect.root.getObjectByName(
      'resonance-bright-droplets',
    ) as InstancedMesh
    const matrix = new Matrix4()
    const scale = new Vector3()

    droplets.getMatrixAt(0, matrix)
    scale.setFromMatrixScale(matrix)
    expect(effect.root.visible).toBe(true)
    expect(reward.visible).toBe(true)
    expect(droplets.visible).toBe(true)
    expect(scale.x).toBeLessThan(0.0001)
    expect(
      intact.getObjectByName('resonance-surface-fracture-lines')?.visible,
    ).toBe(true)

    effect.dispose()
    geometry.dispose()
    material.dispose()
  })

  it('reclaims projected cracks and release accents when reward construction fails', () => {
    const { geometry, material } = vaseSurface()

    try {
      const disposals = captureConstructionDisposals(() => {
        expect(() =>
          createResonancePresentation({
            surfaceGeometry: geometry,
            rewardFactory: () => {
              throw new Error('reward factory failed')
            },
          }),
        ).toThrow('reward factory failed')
      })
      expectPresentationConstructionDisposed(disposals)
    } finally {
      geometry.dispose()
      material.dispose()
    }
  })

  it('rejects an undefined reward owner and reclaims presentation resources', () => {
    const { geometry, material } = vaseSurface()
    const geometryDispose = vi.fn()
    const materialDispose = vi.fn()
    geometry.addEventListener('dispose', geometryDispose)
    material.addEventListener('dispose', materialDispose)
    const invalidFactory = (() =>
      undefined) as unknown as ResonanceRewardVisualFactory

    try {
      const disposals = captureConstructionDisposals(() => {
        expect(() =>
          createResonancePresentation({
            surfaceGeometry: geometry,
            rewardFactory: invalidFactory,
          }),
        ).toThrow(/must return an Object3D and disposer/)
      })

      expectPresentationConstructionDisposed(disposals)
      expect(geometryDispose).not.toHaveBeenCalled()
      expect(materialDispose).not.toHaveBeenCalled()
    } finally {
      geometry.dispose()
      material.dispose()
    }
  })

  it('best-effort disposes a malformed reward owner before construction cleanup', () => {
    const { geometry, material } = vaseSurface()
    const geometryDispose = vi.fn()
    const materialDispose = vi.fn()
    const malformedDispose = vi.fn(() => {
      throw new Error('malformed disposer failed')
    })
    geometry.addEventListener('dispose', geometryDispose)
    material.addEventListener('dispose', materialDispose)
    const invalidFactory = (() => ({
      object: {},
      dispose: malformedDispose,
    })) as unknown as ResonanceRewardVisualFactory

    try {
      const disposals = captureConstructionDisposals(() => {
        expect(() =>
          createResonancePresentation({
            surfaceGeometry: geometry,
            rewardFactory: invalidFactory,
          }),
        ).toThrow(/must return an Object3D and disposer/)
      })

      expect(malformedDispose).toHaveBeenCalledOnce()
      expectPresentationConstructionDisposed(disposals)
      expect(geometryDispose).not.toHaveBeenCalled()
      expect(materialDispose).not.toHaveBeenCalled()
    } finally {
      geometry.dispose()
      material.dispose()
    }
  })

  it('releases presentation resources when a custom reward disposer throws', () => {
    const { geometry, material, intact } = vaseSurface()
    const geometryDispose = vi.fn()
    const materialDispose = vi.fn()
    const rewardDispose = vi.fn(() => {
      throw new Error('custom reward disposal failed')
    })
    geometry.addEventListener('dispose', geometryDispose)
    material.addEventListener('dispose', materialDispose)
    const effect = createResonancePresentation({
      surfaceGeometry: geometry,
      intactVisual: intact,
      rewardFactory: () => ({ object: new Group(), dispose: rewardDispose }),
    })
    const crackRoot = intact.getObjectByName('resonance-surface-fractures')!
    const owned = renderResources(effect.root, crackRoot)
    const ownedGeometryEvents = [...owned.geometries].map(() => vi.fn())
    const ownedMaterialEvents = [...owned.materials].map(() => vi.fn())
    ;[...owned.geometries].forEach((ownedGeometry, index) =>
      ownedGeometry.addEventListener('dispose', ownedGeometryEvents[index]!),
    )
    ;[...owned.materials].forEach((ownedMaterial, index) =>
      ownedMaterial.addEventListener('dispose', ownedMaterialEvents[index]!),
    )

    expect(() => effect.dispose()).not.toThrow()
    expect(() => effect.dispose()).not.toThrow()

    expect(rewardDispose).toHaveBeenCalledOnce()
    ownedGeometryEvents.forEach((listener) =>
      expect(listener).toHaveBeenCalledOnce(),
    )
    ownedMaterialEvents.forEach((listener) =>
      expect(listener).toHaveBeenCalledOnce(),
    )
    expect(geometryDispose).not.toHaveBeenCalled()
    expect(materialDispose).not.toHaveBeenCalled()

    geometry.dispose()
    material.dispose()
  })

  it('restores borrowed state and disposes every owned render resource exactly once', () => {
    const { geometry, material, intact } = vaseSurface()
    const geometryDispose = vi.fn()
    const materialDispose = vi.fn()
    geometry.addEventListener('dispose', geometryDispose)
    material.addEventListener('dispose', materialDispose)
    const rewardGeometry = new BoxGeometry(0.1, 0.1, 0.1)
    const rewardMaterial = new MeshBasicMaterial()
    const rewardDispose = vi.fn(() => {
      rewardGeometry.dispose()
      rewardMaterial.dispose()
    })
    const rewardFactory: ResonanceRewardVisualFactory = () => ({
      object: new Mesh(rewardGeometry, rewardMaterial),
      dispose: rewardDispose,
    })
    const parent = new Group()
    parent.add(intact)
    const effect = createResonancePresentation({
      surfaceGeometry: geometry,
      intactVisual: intact,
      rewardFactory,
    })
    parent.add(effect.root)
    const crackRoot = intact.getObjectByName('resonance-surface-fractures')!
    const owned = renderResources(effect.root, crackRoot)
    const ownedGeometryEvents = [...owned.geometries].map(() => vi.fn())
    const ownedMaterialEvents = [...owned.materials].map(() => vi.fn())
    ;[...owned.geometries].forEach((ownedGeometry, index) =>
      ownedGeometry.addEventListener('dispose', ownedGeometryEvents[index]!),
    )
    ;[...owned.materials].forEach((ownedMaterial, index) =>
      ownedMaterial.addEventListener('dispose', ownedMaterialEvents[index]!),
    )
    effect.update({
      deltaSeconds: 0.1,
      phase: 'charging',
      chargeProgress: 1,
      releaseProgress: 0,
    })

    effect.dispose()
    effect.dispose()

    expect(intact.position.length()).toBe(0)
    expect(effect.root.parent).toBeNull()
    expect(
      intact.getObjectByName('resonance-surface-fractures'),
    ).toBeUndefined()
    expect(rewardDispose).toHaveBeenCalledOnce()
    ownedGeometryEvents.forEach((listener) =>
      expect(listener).toHaveBeenCalledOnce(),
    )
    ownedMaterialEvents.forEach((listener) =>
      expect(listener).toHaveBeenCalledOnce(),
    )
    expect(geometryDispose).not.toHaveBeenCalled()
    expect(materialDispose).not.toHaveBeenCalled()

    geometry.dispose()
    material.dispose()
  })
})
