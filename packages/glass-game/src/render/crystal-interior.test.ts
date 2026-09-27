import type { BufferGeometry, Material, Mesh, Object3D } from 'three'
import { Box3, Group } from 'three'
import { describe, expect, it, vi } from 'vitest'
import { createCrystalInterior } from './crystal-interior'
import type { CrystalInteriorPreset } from './crystal-interior-config'

const PRESETS: readonly CrystalInteriorPreset[] = [
  'resonance-veins',
  'frost-roots',
  'aurora-heart',
]

const SCROLL_ENVELOPE = {
  width: 2.1,
  height: 0.08,
  depth: 2.1,
  center: [0, -0.05, 0] as const,
  inset: 0.006,
}

function create(
  preset: CrystalInteriorPreset,
  quality: 'high' | 'mobile' = 'high',
) {
  return createCrystalInterior({
    preset,
    seed: 4051,
    envelope: {
      width: 2.4,
      height: 0.36,
      depth: 0.88,
      center: [0, -0.22, 0],
      inset: 0.045,
    },
    quality,
  })
}

function createInScroll(preset: CrystalInteriorPreset) {
  return createCrystalInterior({
    preset,
    seed: 4051,
    envelope: SCROLL_ENVELOPE,
  })
}

function firstMesh(root: Object3D): Mesh {
  let found: Mesh | undefined
  root.traverse((object) => {
    const mesh = object as Mesh
    if (found === undefined && mesh.isMesh) found = mesh
  })
  if (found === undefined)
    throw new Error('Expected one crystal interior mesh.')
  return found
}

describe('living crystal interiors', () => {
  it.each(PRESETS)(
    'builds %s as contained static geometry with no textures or hidden depth',
    (preset) => {
      const effect = create(preset)
      effect.root.updateMatrixWorld(true)
      const bounds = new Box3().setFromObject(effect.root)
      const mesh = firstMesh(effect.root)
      const material = mesh.material as Material

      expect(bounds.min.x).toBeGreaterThanOrEqual(-1.2)
      expect(bounds.max.x).toBeLessThanOrEqual(1.2)
      expect(bounds.min.y).toBeGreaterThanOrEqual(-0.4)
      expect(bounds.max.y).toBeLessThanOrEqual(-0.04)
      expect(bounds.min.z).toBeGreaterThanOrEqual(-0.44)
      expect(bounds.max.z).toBeLessThanOrEqual(0.44)
      expect(material.depthTest).toBe(true)
      expect(material.depthWrite).toBe(true)
      expect(material.transparent).toBe(false)
      expect(effect.snapshot().cost.textures).toBe(0)
      effect.dispose()
    },
  )

  it.each(PRESETS)(
    'keeps %s static tubes and maximum shader motion inside the 8 cm scroll shell',
    (preset) => {
      const effect = createInScroll(preset)
      effect.root.updateMatrixWorld(true)
      const bounds = new Box3().setFromObject(effect.root)
      const drift = effect.snapshot().maximumAnimatedDisplacement

      expect(bounds.min.x - drift).toBeGreaterThanOrEqual(-1.05 - 1e-6)
      expect(bounds.max.x + drift).toBeLessThanOrEqual(1.05 + 1e-6)
      expect(bounds.min.y - drift).toBeGreaterThanOrEqual(-0.09 - 1e-6)
      expect(bounds.max.y + drift).toBeLessThanOrEqual(-0.01 + 1e-6)
      expect(bounds.min.z - drift).toBeGreaterThanOrEqual(-1.05 - 1e-6)
      expect(bounds.max.z + drift).toBeLessThanOrEqual(1.05 + 1e-6)
      if (preset === 'aurora-heart') {
        expect(drift).toBeGreaterThan(0)
        expect(drift).toBeLessThanOrEqual(0.00238 + 1e-8)
      } else expect(drift).toBe(0)
      effect.dispose()
    },
  )

  it.each(PRESETS)(
    'batches %s within the high and mobile draw budgets while lowering mobile geometry cost',
    (preset) => {
      const high = create(preset, 'high')
      const mobile = create(preset, 'mobile')

      expect(high.snapshot().cost.drawCalls).toBeLessThanOrEqual(2)
      expect(mobile.snapshot().cost.drawCalls).toBeLessThanOrEqual(2)
      expect(high.snapshot().cost.triangles).toBeGreaterThan(0)
      expect(mobile.snapshot().cost.triangles).toBeLessThan(
        high.snapshot().cost.triangles,
      )
      expect(mobile.snapshot().cost.geometryBytes).toBeLessThan(
        high.snapshot().cost.geometryBytes,
      )
      high.dispose()
      mobile.dispose()
    },
  )

  it('freezes its deterministic clock while paused and resumes from that exact instant', () => {
    const effect = create('resonance-veins')

    effect.update({ deltaSeconds: 0.75 })
    effect.update({ deltaSeconds: 10, paused: true })
    const paused = effect.snapshot()
    effect.update({ deltaSeconds: 0.25, paused: false })

    expect(paused.elapsedSeconds).toBe(0.75)
    expect(paused.paused).toBe(true)
    expect(effect.snapshot().elapsedSeconds).toBe(1)
    effect.dispose()
  })

  it('holds a steady reduced-motion frame and reset restores the authored start', () => {
    const effect = createCrystalInterior({
      preset: 'aurora-heart',
      seed: 5,
      envelope: { width: 2, height: 0.3, depth: 0.8 },
      reducedMotion: true,
    })

    effect.update({ deltaSeconds: 7, scrollVisibleFraction: 0.35 })
    expect(effect.snapshot().elapsedSeconds).toBe(0)
    expect(effect.root.children[0]!.scale.x).toBeCloseTo(0.35)
    effect.reset()

    expect(effect.snapshot()).toMatchObject({
      elapsedSeconds: 0,
      paused: false,
      scrollVisibleFraction: 1,
    })
    expect(effect.root.children[0]!.scale.x).toBe(1)
    effect.dispose()
  })

  it('can enter reduced motion after animation and then holds the same clock', () => {
    const effect = createInScroll('aurora-heart')
    effect.update({ deltaSeconds: 0.5 })
    effect.configure({ reducedMotion: true })
    effect.update({ deltaSeconds: 8 })

    expect(effect.snapshot().elapsedSeconds).toBe(0.5)
    effect.configure({ reducedMotion: false })
    effect.update({ deltaSeconds: 0.25 })
    expect(effect.snapshot().elapsedSeconds).toBe(0.75)
    effect.dispose()
  })

  it('tunes palette, intensity and speed without rebuilding the owned geometry', () => {
    const effect = create('frost-roots')
    const geometry = firstMesh(effect.root).geometry

    effect.configure({
      palette: { primary: 0x123456 },
      intensity: 2.5,
      speed: 1.4,
    })
    effect.update({ deltaSeconds: 0.5 })

    expect(firstMesh(effect.root).geometry).toBe(geometry)
    expect(effect.snapshot().settings).toMatchObject({
      intensity: 2.5,
      speed: 1.4,
      palette: { primary: 0x123456 },
    })
    effect.dispose()
  })

  it('disposes each owned geometry and material once and detaches its root', () => {
    const parent = new Group()
    const effect = create('frost-roots')
    parent.add(effect.root)
    const geometries = new Set<BufferGeometry>()
    const materials = new Set<Material>()
    effect.root.traverse((object) => {
      const renderable = object as Mesh
      if (
        !renderable.isMesh &&
        (object as unknown as { isPoints?: boolean }).isPoints !== true
      )
        return
      geometries.add(renderable.geometry)
      for (const material of Array.isArray(renderable.material)
        ? renderable.material
        : [renderable.material])
        materials.add(material)
    })
    const geometryEvents = [...geometries].map(() => vi.fn())
    const materialEvents = [...materials].map(() => vi.fn())
    ;[...geometries].forEach((geometry, index) =>
      geometry.addEventListener('dispose', geometryEvents[index]!),
    )
    ;[...materials].forEach((material, index) =>
      material.addEventListener('dispose', materialEvents[index]!),
    )

    effect.dispose()
    effect.dispose()

    geometryEvents.forEach((listener) =>
      expect(listener).toHaveBeenCalledOnce(),
    )
    materialEvents.forEach((listener) =>
      expect(listener).toHaveBeenCalledOnce(),
    )
    expect(effect.root.parent).toBeNull()
  })
})
