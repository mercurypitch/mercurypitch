// Bounded planar mirrors — one visible surface captures at a conservative cadence.

import type { ColorRepresentation, Material, Mesh, Object3D, PerspectiveCamera, Scene, WebGLRenderer, WebGLRenderTarget, } from 'three'
import { Frustum, Matrix4, Vector3, Vector4 } from 'three'
import { Reflector } from 'three/addons/objects/Reflector.js'
import { disposeMaterials } from './dispose'

const DESKTOP_TARGET_MAX = 384
const COMPACT_TARGET_MAX = 256
const DESKTOP_FRAME_INTERVAL = 2
const COMPACT_FRAME_INTERVAL = 4
const COMPACT_SHORT_EDGE = 600
const MAXIMUM_PLANAR_DEPTH = 0.02

export interface PlanarMirrorSurface {
  surface: Mesh
  material: Material
  renderTarget: WebGLRenderTarget
  capture(
    renderer: WebGLRenderer,
    scene: Scene,
    camera: PerspectiveCamera,
    width: number,
    height: number,
  ): void
  useFallback(): void
  disposeTarget(): void
}

export interface PlanarReflectionMetrics {
  captures: number
  targetWidth: number
  targetHeight: number
}

function reflectionTargetSize(
  width: number,
  height: number,
): { width: number; height: number; frameInterval: number } {
  const safeWidth = Math.max(1, width)
  const safeHeight = Math.max(1, height)
  const compact = Math.min(safeWidth, safeHeight) < COMPACT_SHORT_EDGE
  const maximum = compact ? COMPACT_TARGET_MAX : DESKTOP_TARGET_MAX
  const scale = Math.min(1, maximum / Math.max(safeWidth, safeHeight))
  return {
    width: Math.max(1, Math.round(safeWidth * scale)),
    height: Math.max(1, Math.round(safeHeight * scale)),
    frameInterval: compact ? COMPACT_FRAME_INTERVAL : DESKTOP_FRAME_INTERVAL,
  }
}

/** Keep the authored inset mesh; only its material and reflected camera change. */
export function createPlanarMirrorSurface(
  surface: Mesh,
  color: ColorRepresentation,
  ownedFallback?: Material,
): PlanarMirrorSurface {
  const fallbackMaterial = ownedFallback ?? surface.material
  surface.geometry.computeBoundingBox()
  const bounds = surface.geometry.boundingBox
  if (bounds === null)
    throw new Error('Planar mirror inset has no geometry bounds.')
  if (bounds.max.z - bounds.min.z > MAXIMUM_PLANAR_DEPTH)
    throw new Error('Planar mirror inset must be flat along its local Z axis.')
  const planeOffset = (bounds.min.z + bounds.max.z) / 2
  if (Math.abs(planeOffset) > Number.EPSILON) {
    // Reflector derives its clipping plane from the mesh origin. Normalize the
    // owned inset to local Z=0, then compensate the object translation so its
    // world-space shape remains exactly where the authored asset placed it.
    surface.geometry.translate(0, 0, -planeOffset)
    surface.position.add(
      new Vector3(0, 0, planeOffset)
        .multiply(surface.scale)
        .applyQuaternion(surface.quaternion),
    )
    surface.updateMatrix()
  }
  const reflector = new Reflector(surface.geometry, {
    color,
    clipBias: 0.002,
    textureWidth: 1,
    textureHeight: 1,
    multisample: 0,
  })
  const renderReflection = reflector.onBeforeRender.bind(reflector) as (
    renderer: WebGLRenderer,
    scene: Scene,
    camera: PerspectiveCamera,
  ) => void
  const reflectionMaterial = reflector.material as Material
  // The source mesh carries this material, so no reflector callback is ever
  // entered by the main or reflected scene render.
  reflector.onBeforeRender = () => undefined
  surface.castShadow = false
  surface.receiveShadow = false
  let disposed = false
  let usingFallback = false

  return {
    surface,
    material: reflectionMaterial,
    renderTarget: reflector.getRenderTarget(),
    capture(renderer, scene, camera, width, height) {
      if (disposed) return
      const target = reflector.getRenderTarget()
      target.setSize(width, height)
      surface.updateWorldMatrix(true, false)
      reflector.matrixWorld.copy(surface.matrixWorld)

      const previousTarget = renderer.getRenderTarget()
      const previousCubeFace = renderer.getActiveCubeFace()
      const previousMipmapLevel = renderer.getActiveMipmapLevel()
      const previousViewport = renderer.getViewport(new Vector4())
      const previousScissor = renderer.getScissor(new Vector4())
      const previousScissorTest = renderer.getScissorTest()
      const previousXrEnabled = renderer.xr.enabled
      const previousShadowAutoUpdate = renderer.shadowMap.autoUpdate
      try {
        renderReflection(renderer, scene, camera)
      } finally {
        // Reflector restores these on success. The explicit finally also
        // protects the live renderer if an optional mirror capture throws.
        reflector.visible = true
        renderer.xr.enabled = previousXrEnabled
        renderer.shadowMap.autoUpdate = previousShadowAutoUpdate
        renderer.setRenderTarget(
          previousTarget,
          previousCubeFace,
          previousMipmapLevel,
        )
        renderer.setViewport(previousViewport)
        renderer.setScissor(previousScissor)
        renderer.setScissorTest(previousScissorTest)
      }
    },
    useFallback() {
      if (usingFallback || disposed) return
      usingFallback = true
      surface.material = fallbackMaterial
      reflectionMaterial.dispose()
      reflector.getRenderTarget().dispose()
      disposed = true
    },
    disposeTarget() {
      if (disposed) return
      disposed = true
      // The shader material is attached to the scene mesh and follows normal
      // scene disposal. A detached static fallback remains manager-owned.
      reflector.getRenderTarget().dispose()
      if (ownedFallback !== undefined)
        disposeMaterials(
          Array.isArray(fallbackMaterial)
            ? fallbackMaterial
            : [fallbackMaterial],
        )
    },
  }
}

function hierarchyVisible(surface: Mesh): boolean {
  let current: Object3D | null = surface
  while (current !== null) {
    if (!current.visible) return false
    current = current.parent
  }
  return true
}

/** Schedule at most one non-recursive reflection capture for a rendered frame. */
export function createPlanarReflectionController(
  surfaces: () => readonly PlanarMirrorSurface[],
  onError: (error: unknown) => void = () => undefined,
) {
  const projection = new Matrix4()
  const frustum = new Frustum()
  const mirrorPosition = new Vector3()
  const mirrorNormal = new Vector3()
  const cameraPosition = new Vector3()
  const cameraOffset = new Vector3()
  let frame = 0
  let lastCaptureFrame = -Infinity
  let lastSelected: PlanarMirrorSurface | undefined
  let disabled = false
  const metrics: PlanarReflectionMetrics = {
    captures: 0,
    targetWidth: 0,
    targetHeight: 0,
  }

  return {
    metrics,
    update(
      renderer: WebGLRenderer,
      scene: Scene,
      camera: PerspectiveCamera,
      width: number,
      height: number,
      withVisibleScene: (capture: () => void) => void,
    ): boolean {
      frame++
      if (disabled) return false
      const candidates = surfaces()
      if (candidates.length === 0) return false

      camera.updateMatrixWorld()
      camera.getWorldPosition(cameraPosition)
      projection.multiplyMatrices(
        camera.projectionMatrix,
        camera.matrixWorldInverse,
      )
      frustum.setFromProjectionMatrix(projection)
      let selected: PlanarMirrorSurface | undefined
      let selectedDistance = Infinity
      for (const candidate of candidates) {
        const surface = candidate.surface
        if (!hierarchyVisible(surface)) continue
        surface.updateWorldMatrix(true, false)
        if (!frustum.intersectsObject(surface)) continue
        surface.getWorldPosition(mirrorPosition)
        mirrorNormal.set(0, 0, 1).transformDirection(surface.matrixWorld)
        const facing = mirrorNormal.dot(
          cameraOffset.subVectors(cameraPosition, mirrorPosition),
        )
        if (facing <= 0) continue
        const distance = cameraPosition.distanceToSquared(mirrorPosition)
        if (distance < selectedDistance) {
          selected = candidate
          selectedDistance = distance
        }
      }
      if (selected === undefined) {
        lastSelected = undefined
        return false
      }

      const target = reflectionTargetSize(width, height)
      const changed = selected !== lastSelected
      lastSelected = selected
      if (!changed && frame - lastCaptureFrame < target.frameInterval)
        return false

      const visibility = candidates.map(({ surface }) => surface.visible)
      try {
        candidates.forEach(({ surface }) => {
          surface.visible = false
        })
        withVisibleScene(() =>
          selected.capture(
            renderer,
            scene,
            camera,
            target.width,
            target.height,
          ),
        )
        lastCaptureFrame = frame
        metrics.captures++
        metrics.targetWidth = target.width
        metrics.targetHeight = target.height
        return true
      } catch (error: unknown) {
        disabled = true
        candidates.forEach((candidate) => candidate.useFallback())
        onError(error)
        return false
      } finally {
        candidates.forEach(({ surface }, index) => {
          surface.visible = visibility[index]!
        })
      }
    },
  }
}
