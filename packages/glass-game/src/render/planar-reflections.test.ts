// Planar reflection tests — selection, cadence and failure cleanup stay bounded.

import type { Material, WebGLRenderer, WebGLRenderTarget } from 'three'
import { Box3, Group, Mesh, MeshBasicMaterial, PerspectiveCamera, PlaneGeometry, Scene, Vector3, Vector4, } from 'three'
import { expect, it, vi } from 'vitest'
import type { PlanarMirrorSurface } from './planar-reflections'
import { createPlanarMirrorSurface, createPlanarReflectionController, } from './planar-reflections'

function camera(): PerspectiveCamera {
  const result = new PerspectiveCamera(50, 4 / 3, 0.05, 100)
  result.position.set(0, 0, 3)
  result.lookAt(0, 0, 0)
  result.updateProjectionMatrix()
  result.updateMatrixWorld()
  return result
}

function fakeMirror(x: number, z: number) {
  const surface: Mesh = new Mesh(
    new PlaneGeometry(1, 1),
    new MeshBasicMaterial(),
  )
  surface.position.set(x, 0, z)
  const capture = vi.fn()
  const mirror: PlanarMirrorSurface = {
    surface,
    material: surface.material as Material,
    renderTarget: {} as WebGLRenderTarget,
    capture,
    useFallback: vi.fn(),
    disposeTarget: vi.fn(),
  }
  return { mirror, capture }
}

it('anchors an offset authored inset on its real plane without moving it', () => {
  const geometry = new PlaneGeometry(0.8, 1.5)
  geometry.translate(0, 0, 0.025)
  const sourceMaterial = new MeshBasicMaterial()
  const surface: Mesh = new Mesh(geometry, sourceMaterial)
  surface.position.set(1, 2, 3)
  surface.rotation.set(0.1, -0.4, 0.05)
  surface.scale.set(1.2, 0.8, 1.5)
  const parent = new Group()
  parent.position.set(-2, 0.5, 4)
  parent.rotation.y = 0.3
  parent.add(surface)
  parent.updateWorldMatrix(true, true)
  const before = new Box3().setFromObject(surface)

  const mirror = createPlanarMirrorSurface(surface, 0xcbe4e3)
  parent.updateWorldMatrix(true, true)
  const after = new Box3().setFromObject(surface)
  surface.geometry.computeBoundingBox()
  const localCentre = surface.geometry.boundingBox!.getCenter(new Vector3())

  expect(localCentre.z).toBeCloseTo(0, 8)
  before.min
    .toArray()
    .forEach((value, index) =>
      expect(after.min.toArray()[index]).toBeCloseTo(value, 7),
    )
  before.max
    .toArray()
    .forEach((value, index) =>
      expect(after.max.toArray()[index]).toBeCloseTo(value, 7),
    )

  mirror.disposeTarget()
  mirror.material.dispose()
  sourceMaterial.dispose()
  geometry.dispose()
})

it('captures only the nearest visible front-facing mirror on a bounded cadence', () => {
  const scene = new Scene()
  const near = fakeMirror(0, 0)
  const far = fakeMirror(0, -1)
  scene.add(near.mirror.surface, far.mirror.surface)
  const mirrors = [near.mirror, far.mirror]
  const controller = createPlanarReflectionController(() => mirrors)
  const renderer = {} as WebGLRenderer
  const view = camera()
  const withVisibleScene = (capture: () => void) => {
    expect(mirrors.every(({ surface }) => !surface.visible)).toBe(true)
    capture()
  }

  expect(
    controller.update(renderer, scene, view, 800, 600, withVisibleScene),
  ).toBe(true)
  expect(near.capture).toHaveBeenCalledWith(renderer, scene, view, 384, 288)
  expect(far.capture).not.toHaveBeenCalled()
  expect(mirrors.every(({ surface }) => surface.visible)).toBe(true)

  expect(
    controller.update(renderer, scene, view, 800, 600, withVisibleScene),
  ).toBe(false)
  expect(
    controller.update(renderer, scene, view, 800, 600, withVisibleScene),
  ).toBe(true)
  expect(near.capture).toHaveBeenCalledTimes(2)
  expect(controller.metrics).toEqual({
    captures: 2,
    targetWidth: 384,
    targetHeight: 288,
  })
})

it('ignores a hidden parent, back face and off-screen surface', () => {
  const scene = new Scene()
  const hidden = fakeMirror(0, 0.5)
  const hiddenParent = new Group()
  hiddenParent.visible = false
  hiddenParent.add(hidden.mirror.surface)
  const backFace = fakeMirror(0, 0)
  backFace.mirror.surface.rotation.y = Math.PI
  const offscreen = fakeMirror(100, 0)
  const eligible = fakeMirror(0, -1)
  scene.add(hiddenParent, backFace.mirror.surface, offscreen.mirror.surface)
  scene.add(eligible.mirror.surface)
  const controller = createPlanarReflectionController(() => [
    hidden.mirror,
    backFace.mirror,
    offscreen.mirror,
    eligible.mirror,
  ])

  expect(
    controller.update(
      {} as WebGLRenderer,
      scene,
      camera(),
      390,
      740,
      (capture) => capture(),
    ),
  ).toBe(true)
  expect(eligible.capture).toHaveBeenCalledWith(
    expect.anything(),
    scene,
    expect.any(PerspectiveCamera),
    135,
    256,
  )
  expect(hidden.capture).not.toHaveBeenCalled()
  expect(backFace.capture).not.toHaveBeenCalled()
  expect(offscreen.capture).not.toHaveBeenCalled()
})

it('restores mirror visibility and disables optional captures after an error', () => {
  const scene = new Scene()
  const failing = fakeMirror(0, 0)
  failing.mirror.capture = vi.fn(() => {
    throw new Error('reflection failed')
  })
  scene.add(failing.mirror.surface)
  const onError = vi.fn()
  const controller = createPlanarReflectionController(
    () => [failing.mirror],
    onError,
  )

  expect(
    controller.update(
      {} as WebGLRenderer,
      scene,
      camera(),
      800,
      600,
      (capture) => capture(),
    ),
  ).toBe(false)
  expect(failing.mirror.surface.visible).toBe(true)
  expect(failing.mirror.useFallback).toHaveBeenCalledTimes(1)
  expect(onError).toHaveBeenCalledWith(expect.any(Error))

  controller.update({} as WebGLRenderer, scene, camera(), 800, 600, (capture) =>
    capture(),
  )
  expect(failing.mirror.capture).toHaveBeenCalledTimes(1)
})

it('restores renderer state when the reflected scene render throws', () => {
  const surface: Mesh = new Mesh(
    new PlaneGeometry(1, 1),
    new MeshBasicMaterial(),
  )
  const mirror = createPlanarMirrorSurface(surface, 0xcbe4e3)
  surface.material = mirror.material
  const originalTarget = {} as WebGLRenderTarget
  let currentTarget: WebGLRenderTarget | null = originalTarget
  const viewport = new Vector4(3, 4, 800, 600)
  const scissor = new Vector4(5, 6, 700, 500)
  let scissorTest = true
  const renderer = {
    xr: { enabled: true },
    shadowMap: { autoUpdate: true },
    autoClear: true,
    state: { buffers: { depth: { setMask: vi.fn() } } },
    getRenderTarget: () => currentTarget,
    getActiveCubeFace: () => 2,
    getActiveMipmapLevel: () => 3,
    getViewport: (target: Vector4) => target.copy(viewport),
    getScissor: (target: Vector4) => target.copy(scissor),
    getScissorTest: () => scissorTest,
    setRenderTarget: (target: WebGLRenderTarget | null) => {
      currentTarget = target
    },
    setViewport: (value: Vector4) => viewport.copy(value),
    setScissor: (value: Vector4) => scissor.copy(value),
    setScissorTest: (value: boolean) => {
      scissorTest = value
    },
    render: () => {
      throw new Error('render failed')
    },
  } as unknown as WebGLRenderer
  expect(() =>
    mirror.capture(renderer, new Scene(), camera(), 256, 192),
  ).toThrow('render failed')
  expect(currentTarget).toBe(originalTarget)
  expect(renderer.xr.enabled).toBe(true)
  expect(renderer.shadowMap.autoUpdate).toBe(true)
  expect(viewport.toArray()).toEqual([3, 4, 800, 600])
  expect(scissor.toArray()).toEqual([5, 6, 700, 500])
  expect(scissorTest).toBe(true)

  const targetDispose = vi.spyOn(mirror.renderTarget, 'dispose')
  const liveMaterial = mirror.material
  const liveMaterialDispose = vi.spyOn(liveMaterial, 'dispose')
  mirror.useFallback()
  mirror.useFallback()
  mirror.disposeTarget()
  expect(targetDispose).toHaveBeenCalledTimes(1)
  expect(liveMaterialDispose).toHaveBeenCalledTimes(1)
  expect(surface.material).not.toBe(liveMaterial)
  surface.geometry.dispose()
  surface.material.dispose()
})
