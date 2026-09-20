// ============================================================
// Glass adventure renderer — a disposable, host-neutral Three.js museum scene.
// ============================================================

import type { Material } from 'three'
import { ACESFilmicToneMapping, DirectionalLight, FogExp2, HemisphereLight, PCFShadowMap, Scene, SRGBColorSpace, Vector3, WebGLRenderer, } from 'three'
import type { GameSnapshot, LevelDefinition, Vec3 } from '../contracts'
import { loadMuseumAssets } from './asset-kit'
import { createAtmosphere } from './atmosphere'
import { createAdventureCamera } from './camera'
import { getBreakableRenderRecipe, getPlatformRenderRecipe } from './catalog'
import { createContactShadow } from './contact-shadow'
import { disposeMaterials, disposeObject } from './dispose'
import { createMuseumEnvironment } from './environment'
import { createGalleryInspection } from './gallery-inspection'
import { createMuseumMaterials } from './materials'
import { loadAdventureMerc } from './merc'
import { createMuseum } from './museum'
import { createResonancePortal } from './resonance-portal'
import { getMuseumSceneFrame, getMuseumSceneRecipe, getMuseumVisualRecipe, } from './scene-catalog'
import { createVessel } from './vessels'

export interface GlassRendererOptions {
  reducedMotion?: boolean
  onAssetError?: (id: string, error: unknown) => void
  onContextLost?: () => void
  onExitCelebrationComplete?: () => void
}

export interface GlassRenderer {
  /** Required assets are installed; the host still owns the first-frame gate. */
  ready: Promise<void>
  render(snapshot: GameSnapshot, dt: number): void
  resize(): void
  orbit(dxRadians: number, dyRadians: number): void
  setOrbitActive(active: boolean): void
  zoom(delta: number): void
  recenter(): void
  /** Actual rendered view heading, used for presentation and diagnostics. */
  getCameraYaw(): number
  /** Stable camera-relative movement basis for the current held input. */
  getMovementYaw(): number
  setMovementActive(active: boolean): void
  rebaseMovement(): void
  cancelHeadingFollow(): void
  pickArtwork(clientX: number, clientY: number): string | null
  nearbyArtwork(position: Vec3): string | null
  getMetrics(): {
    drawCalls: number
    triangles: number
    textures: number
    geometries: number
    reflectionCaptures: number
    reflectionTargetPixels: number
  }
  dispose(): void
}

/** Synchronous handle permits disposal even while the required GLB is loading. */
export function createGlassRenderer(
  container: HTMLElement,
  level: LevelDefinition,
  assetUrl: (id: string) => string,
  options: GlassRendererOptions = {},
): GlassRenderer {
  const partialCleanups: (() => void)[] = []
  try {
    return createGlassRendererInstance(
      container,
      level,
      assetUrl,
      options,
      (cleanup) => partialCleanups.push(cleanup),
    )
  } catch (error) {
    for (const cleanup of partialCleanups.reverse())
      try {
        cleanup()
      } catch {
        // Preserve the construction failure that explains why loading stopped.
      }
    throw error
  }
}

function createGlassRendererInstance(
  container: HTMLElement,
  level: LevelDefinition,
  assetUrl: (id: string) => string,
  options: GlassRendererOptions,
  registerPartialCleanup: (cleanup: () => void) => void,
): GlassRenderer {
  level.breakables.forEach((target) => getBreakableRenderRecipe(target.variant))
  level.platforms.forEach((platform) =>
    getPlatformRenderRecipe(platform.renderId ?? platform.kind),
  )
  level.presentation?.visuals.forEach((visual) =>
    getMuseumVisualRecipe(visual.recipeId),
  )
  const sceneRecipe = getMuseumSceneRecipe(level)
  const sceneFrame = getMuseumSceneFrame(level)
  const renderer = new WebGLRenderer({
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
  })
  renderer.outputColorSpace = SRGBColorSpace
  renderer.toneMapping = ACESFilmicToneMapping
  renderer.toneMappingExposure = 0.9
  renderer.transmissionResolutionScale = 0.5
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = PCFShadowMap
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5))
  renderer.domElement.style.cssText =
    'display:block;width:100%;height:100%;touch-action:none;'
  renderer.domElement.setAttribute('aria-label', 'Floating glass museum')
  container.append(renderer.domElement)
  registerPartialCleanup(() => {
    renderer.dispose()
    renderer.forceContextLoss()
    renderer.domElement.remove()
  })
  const scene = new Scene()
  scene.fog = new FogExp2(0x59899e, 0.009)
  const camera = createAdventureCamera(level, {
    reducedMotion: options.reducedMotion,
  })
  camera.camera.far = sceneFrame.cameraFar
  camera.camera.updateProjectionMatrix()
  const environment = createMuseumEnvironment(renderer, scene)
  registerPartialCleanup(() => environment.dispose())
  scene.environmentIntensity = 0.65
  const materials = createMuseumMaterials()
  const partialBorrowedMaterials = new Set<Material>(Object.values(materials))
  registerPartialCleanup(() => disposeMaterials(Object.values(materials)))
  registerPartialCleanup(() => disposeObject(scene, partialBorrowedMaterials))
  const atmosphere = createAtmosphere(materials, sceneRecipe)
  scene.add(atmosphere.root)
  scene.add(new HemisphereLight(0xcceaff, 0x243e42, 0.6))
  const key = new DirectionalLight(0xffdfaa, 2.5)
  key.position.copy(sceneFrame.keyPosition)
  key.target.position.copy(sceneFrame.lightTarget)
  key.castShadow = true
  const shadowMapSize = 1024
  key.shadow.mapSize.set(shadowMapSize, shadowMapSize)
  key.shadow.camera.left = key.shadow.camera.bottom = -sceneFrame.shadowExtent
  key.shadow.camera.right = key.shadow.camera.top = sceneFrame.shadowExtent
  key.shadow.camera.near = 0.5
  key.shadow.camera.far = sceneFrame.shadowFar
  // Keep the receiver offset proportional to an authored level's shadow
  // texel. A fixed 18mm offset is too small once a long museum expands the
  // orthographic map, producing regular self-shadow bands across flat floors.
  const shadowTexelSize = (sceneFrame.shadowExtent * 2) / shadowMapSize
  key.shadow.normalBias = Math.max(0.018, shadowTexelSize * 0.75)
  key.shadow.bias = -0.00015
  registerPartialCleanup(() => key.shadow.dispose())
  scene.add(key, key.target)
  const rim = new DirectionalLight(0x73ddd9, 0.75)
  rim.position.copy(sceneFrame.rimPosition)
  if (level.presentation === undefined) scene.add(rim)
  else {
    rim.target.position.copy(sceneFrame.lightTarget)
    scene.add(rim, rim.target)
  }
  const museum = createMuseum(level, materials, (error) =>
    options.onAssetError?.('museum-planar-reflection', error),
  )
  const gallery = createGalleryInspection(
    museum.root,
    camera.camera,
    renderer.domElement,
    level,
    museum.cameraOccluders,
  )
  registerPartialCleanup(() => {
    museum.materialLibrary.materials.forEach((material) =>
      partialBorrowedMaterials.add(material),
    )
    museum.dispose()
    museum.materialLibrary.dispose()
  })
  scene.add(museum.root)
  const portal = createResonancePortal(
    level.exit,
    materials,
    options.reducedMotion ?? false,
  )
  scene.add(portal.root)
  const contact = createContactShadow(level)
  scene.add(contact.mesh)
  const vessels = new Map(
    level.breakables.map((target) => {
      const vessel = createVessel(target, options.reducedMotion ?? false)
      scene.add(vessel.root)
      return [target.id, vessel]
    }),
  )
  const vesselRoomIds = new Map(
    level.breakables.map((target) => [
      target.id,
      museum.roomIdForRuntimeId(target.id),
    ]),
  )
  registerPartialCleanup(() => vessels.forEach((vessel) => vessel.dispose()))
  let merc: Awaited<ReturnType<typeof loadAdventureMerc>> | undefined
  let disposed = false
  let contextLost = false
  const onContextLost = (event: Event) => {
    event.preventDefault()
    if (disposed || contextLost) return
    contextLost = true
    options.onContextLost?.()
  }
  renderer.domElement.addEventListener('webglcontextlost', onContextLost)
  registerPartialCleanup(() =>
    renderer.domElement.removeEventListener('webglcontextlost', onContextLost),
  )
  let latest: GameSnapshot | undefined
  const resize = () => {
    if (disposed) return
    const width = Math.max(1, container.clientWidth)
    const height = Math.max(1, container.clientHeight)
    renderer.setSize(width, height, false)
    camera.camera.aspect = width / height
    camera.camera.updateProjectionMatrix()
  }
  resize()
  const observer = new ResizeObserver(resize)
  registerPartialCleanup(() => observer.disconnect())
  observer.observe(container)
  const mercUrl = assetUrl('merc')
  const environmentUrl =
    sceneRecipe.environment === undefined
      ? undefined
      : assetUrl(sceneRecipe.environment)
  registerPartialCleanup(() => {
    disposed = true
  })
  const mercReady = loadAdventureMerc(mercUrl).then((actor) => {
    if (disposed) {
      actor.dispose()
      return
    }
    merc = actor
    scene.add(actor.root)
    if (latest) actor.update(latest, 0, options.reducedMotion ?? false)
  })
  registerPartialCleanup(() => {
    void mercReady.catch(() => undefined)
  })
  const assetsReady = loadMuseumAssets(
    level,
    assetUrl,
    vessels,
    museum,
    materials,
    atmosphere.setSky,
    () => disposed,
    options.onAssetError,
  )
  registerPartialCleanup(() => {
    void assetsReady.catch(() => undefined)
  })
  const environmentReady =
    environmentUrl !== undefined
      ? environment
          .load(environmentUrl, () => disposed || contextLost)
          .catch((error: unknown) => {
            if (!disposed)
              options.onAssetError?.(sceneRecipe.environment!, error)
          })
      : Promise.resolve()
  registerPartialCleanup(() => {
    void environmentReady.catch(() => undefined)
  })
  const ready = Promise.all([mercReady, assetsReady, environmentReady]).then(
    () => {
      if (disposed || contextLost || !sceneRecipe.reflectionProbe) return
      const position = new Vector3().copy(sceneRecipe.reflectionProbe)
      try {
        environment.capture(
          position,
          [
            contact.mesh,
            portal.root,
            ...[...vessels.values()].map((vessel) => vessel.root),
            ...(merc ? [merc.root] : []),
          ],
          container.clientWidth < 700 ? 128 : 256,
        )
      } catch (error: unknown) {
        // The previous environment remains valid if this optional enhancement fails.
        if (!disposed && !contextLost)
          options.onAssetError?.('museum-reflection-probe', error)
      }
    },
  )
  return {
    ready,
    resize,
    orbit: camera.orbit,
    setOrbitActive: camera.setOrbitActive,
    zoom: camera.zoom,
    recenter: camera.recenter,
    getCameraYaw: camera.yaw,
    getMovementYaw: camera.movementYaw,
    setMovementActive: camera.setMovementActive,
    rebaseMovement: camera.rebaseMovement,
    cancelHeadingFollow: camera.cancelHeadingFollow,
    pickArtwork: gallery.pick,
    nearbyArtwork: gallery.nearby,
    getMetrics: () => ({
      drawCalls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
      textures: renderer.info.memory.textures,
      geometries: renderer.info.memory.geometries,
      reflectionCaptures: museum.planarReflectionMetrics.captures,
      reflectionTargetPixels:
        museum.planarReflectionMetrics.targetWidth *
        museum.planarReflectionMetrics.targetHeight,
    }),
    render(snapshot, delta) {
      if (disposed || contextLost) return
      latest = snapshot
      const dt = snapshot.paused ? 0 : Math.max(0, Math.min(0.05, delta))
      museum.update(snapshot)
      if (portal.update(snapshot, dt)) options.onExitCelebrationComplete?.()
      camera.setOccluders(museum.cameraOccluders())
      camera.update(snapshot, dt)
      const visibleRooms = museum.updateRoomVisibility(
        snapshot.player.position,
        camera.camera,
      ).visibleRoomIds
      vessels.forEach((vessel, id) => {
        const roomId = vesselRoomIds.get(id)
        vessel.root.visible = roomId === undefined || visibleRooms.has(roomId)
      })
      contact.update(snapshot)
      merc?.update(snapshot, dt, options.reducedMotion ?? false)
      for (const state of snapshot.breakables)
        vessels.get(state.id)?.update(state, snapshot.elapsedSeconds)
      museum.updatePlanarReflection(
        renderer,
        scene,
        camera.camera,
        container.clientWidth,
        container.clientHeight,
        (capture) => {
          const vesselVisibility = new Map(
            [...vessels].map(([id, vessel]) => [id, vessel.root.visible]),
          )
          try {
            vessels.forEach((vessel) => {
              vessel.root.visible = true
            })
            capture()
          } finally {
            vessels.forEach((vessel, id) => {
              vessel.root.visible = vesselVisibility.get(id) ?? true
            })
          }
        },
      )
      renderer.render(scene, camera.camera)
    },
    dispose() {
      if (disposed) return
      disposed = true
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost)
      observer.disconnect()
      merc?.dispose()
      vessels.forEach((vessel) => vessel.dispose())
      scene.environment = null
      disposeObject(
        scene,
        new Set([
          ...museum.materialLibrary.materials,
          ...Object.values(materials),
        ]),
      )
      museum.dispose()
      museum.materialLibrary.dispose()
      disposeMaterials(Object.values(materials))
      environment.dispose()
      key.shadow.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
      renderer.domElement.remove()
    },
  }
}
