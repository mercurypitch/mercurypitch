// ============================================================
// Glass adventure renderer — a disposable, host-neutral Three.js museum scene.
// ============================================================

import { ACESFilmicToneMapping, DirectionalLight, FogExp2, HemisphereLight, PCFSoftShadowMap, Scene, SRGBColorSpace, Vector3, WebGLRenderer, } from 'three'
import type { GameSnapshot, LevelDefinition } from '../contracts'
import { loadMuseumAssets } from './asset-kit'
import { createAtmosphere } from './atmosphere'
import { createAdventureCamera } from './camera'
import { getBreakableRenderRecipe, getPlatformRenderRecipe } from './catalog'
import { createContactShadow } from './contact-shadow'
import { disposeMaterials, disposeObject } from './dispose'
import { createMuseumEnvironment } from './environment'
import { createMuseumMaterials } from './materials'
import { loadAdventureMerc } from './merc'
import { createMuseum } from './museum'
import { getMuseumSceneRecipe } from './scene-catalog'
import { createVessel } from './vessels'

export interface GlassRendererOptions {
  reducedMotion?: boolean
  onAssetError?: (id: string, error: unknown) => void
  onContextLost?: () => void
}

export interface GlassRenderer {
  /** Required mascot loading rejects visibly; the host always owns the error UI. */
  ready: Promise<void>
  render(snapshot: GameSnapshot, dt: number): void
  resize(): void
  orbit(dxRadians: number, dyRadians: number): void
  zoom(delta: number): void
  recenter(): void
  getCameraYaw(): number
  getMetrics(): {
    drawCalls: number
    triangles: number
    textures: number
    geometries: number
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
  level.breakables.forEach((target) => getBreakableRenderRecipe(target.variant))
  level.platforms.forEach((platform) =>
    getPlatformRenderRecipe(platform.renderId ?? platform.kind),
  )
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
  renderer.shadowMap.type = PCFSoftShadowMap
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5))
  renderer.domElement.style.cssText =
    'display:block;width:100%;height:100%;touch-action:none;'
  renderer.domElement.setAttribute('aria-label', 'Floating glass museum')
  container.append(renderer.domElement)
  const scene = new Scene()
  scene.fog = new FogExp2(0x59899e, 0.009)
  const camera = createAdventureCamera(level)
  const environment = createMuseumEnvironment(renderer, scene)
  scene.environmentIntensity = 0.65
  const materials = createMuseumMaterials()
  const atmosphere = createAtmosphere(materials, getMuseumSceneRecipe(level.id))
  scene.add(atmosphere.root)
  scene.add(new HemisphereLight(0xcceaff, 0x243e42, 0.6))
  const key = new DirectionalLight(0xffdfaa, 2.5)
  key.position.set(-6, 12, 8)
  key.target.position.set(5, 0, 4)
  key.castShadow = true
  key.shadow.mapSize.set(1024, 1024)
  key.shadow.camera.left = key.shadow.camera.bottom = -10
  key.shadow.camera.right = key.shadow.camera.top = 10
  key.shadow.camera.near = 0.5
  key.shadow.camera.far = 35
  key.shadow.normalBias = 0.018
  key.shadow.bias = -0.00015
  scene.add(key, key.target)
  const rim = new DirectionalLight(0x73ddd9, 0.75)
  rim.position.set(12, 5, -6)
  scene.add(rim)
  const museum = createMuseum(level, materials)
  scene.add(museum.root)
  const contact = createContactShadow(level)
  scene.add(contact.mesh)
  const vessels = new Map(
    level.breakables.map((target) => {
      const vessel = createVessel(target, options.reducedMotion ?? false)
      scene.add(vessel.root)
      return [target.id, vessel]
    }),
  )
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
  observer.observe(container)
  const mercReady = loadAdventureMerc(assetUrl('merc')).then((actor) => {
    if (disposed) {
      actor.dispose()
      return
    }
    merc = actor
    scene.add(actor.root)
    if (latest) actor.update(latest, 0, options.reducedMotion ?? false)
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
  const sceneRecipe = getMuseumSceneRecipe(level.id)
  const environmentReady =
    sceneRecipe.environment !== undefined
      ? environment
          .load(
            assetUrl(sceneRecipe.environment),
            () => disposed || contextLost,
          )
          .catch((error: unknown) => {
            if (!disposed)
              options.onAssetError?.(sceneRecipe.environment!, error)
          })
      : Promise.resolve()
  const ready = Promise.all([mercReady, assetsReady, environmentReady]).then(
    () => {
      if (disposed || contextLost || !sceneRecipe.reflectionProbe) return
      const position = new Vector3().copy(sceneRecipe.reflectionProbe)
      try {
        environment.capture(
          position,
          [
            contact.mesh,
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
    zoom: camera.zoom,
    recenter: camera.recenter,
    getCameraYaw: camera.yaw,
    getMetrics: () => ({
      drawCalls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
      textures: renderer.info.memory.textures,
      geometries: renderer.info.memory.geometries,
    }),
    render(snapshot, delta) {
      if (disposed || contextLost) return
      latest = snapshot
      const dt = snapshot.paused ? 0 : Math.max(0, Math.min(0.05, delta))
      museum.update(snapshot)
      camera.setOccluders(museum.cameraOccluders())
      camera.update(snapshot, dt)
      contact.update(snapshot)
      merc?.update(snapshot, dt, options.reducedMotion ?? false)
      for (const state of snapshot.breakables)
        vessels.get(state.id)?.update(state, snapshot.elapsedSeconds)
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
