// Singing Current renderer — one stable third-person view of a bounded, audio-clock-driven world.
import type { Object3D, Texture } from 'three'
import { ACESFilmicToneMapping, Color, DirectionalLight, Fog, HemisphereLight, PCFShadowMap, PerspectiveCamera, RepeatWrapping, Scene, SRGBColorSpace, TextureLoader, WebGLRenderer, } from 'three'
import type { CompiledRunnerCourse, RunnerSnapshot } from '../runner/contracts'
import { resolveAssetProfileBundle } from './asset-profile-bundles'
import { loadProfiledAssetScene } from './asset-scene-loader'
import { releaseAssetImage } from './asset-texture-profile'
import { installBackdropFog } from './backdrop-fog'
import { disposeObject } from './dispose'
import { createMuseumEnvironment } from './environment'
import { verifyFirstFrame } from './first-frame'
import { loadAdventureMerc } from './merc'
import { precompileRendererPrograms } from './program-precompile'
import type { GlassAssetQualityProfile } from './render-quality'
import { createShadowUpdateCadence, effectiveGlassPixelRatio, resolveGlassRenderQuality, } from './render-quality'
import { withResidentRenderablesVisible } from './render-warmup'
import { createRunnerTargets } from './runner-targets'
import { createRunnerWorld } from './runner-world'
import { runnerCameraPose } from './runner-world-layout'
import { fitSkyBackdrop } from './sky-backdrop'
import { canRenderViewport } from './viewport'

export interface SongRunnerRendererOptions {
  readonly initialSnapshot: RunnerSnapshot
  readonly assetProfile?: GlassAssetQualityProfile
  readonly reducedMotion?: boolean
  readonly onContextLost: () => void
}
export interface SongRunnerRenderer {
  readonly ready: Promise<void>
  render(snapshot: RunnerSnapshot, deltaSeconds: number): boolean
  resize(): void
  metrics(): {
    drawCalls: number
    triangles: number
    residentChunks: number
    targets: number
  }
  dispose(): void
}

export function createSongRunnerRenderer(
  container: HTMLElement,
  course: CompiledRunnerCourse,
  comfortableMidi: number,
  assetUrl: (id: string) => string,
  options: SongRunnerRendererOptions,
): SongRunnerRenderer {
  const abort = new AbortController()
  const scene = new Scene()
  scene.background = new Color(0xc8dce0)
  scene.fog = new Fog(0xc8dce0, 18, 37)
  const camera = new PerspectiveCamera(60, 1, 0.08, 65)
  const quality = resolveGlassRenderQuality('auto', {
    cssWidth: container.clientWidth,
    cssHeight: container.clientHeight,
    coarsePointer: window.matchMedia('(pointer: coarse)').matches,
    mobileHint: options.assetProfile === 'mobile',
  })
  const renderer = new WebGLRenderer({
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
  })
  renderer.outputColorSpace = SRGBColorSpace
  renderer.toneMapping = ACESFilmicToneMapping
  renderer.toneMappingExposure = 0.9
  renderer.transmissionResolutionScale = quality.transmissionResolutionScale
  renderer.setPixelRatio(
    effectiveGlassPixelRatio(window.devicePixelRatio, quality),
  )
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = PCFShadowMap
  renderer.shadowMap.autoUpdate = false
  const shadowCadence = createShadowUpdateCadence(quality.shadowFrameInterval)
  renderer.domElement.style.cssText =
    'display:block;width:100%;height:100%;touch-action:none'
  renderer.domElement.setAttribute(
    'aria-label',
    'The Singing Current, three paths through floating glass',
  )
  container.append(renderer.domElement)
  const images = new Set<TexImageSource>(),
    scenes: Object3D[] = [],
    textures: Texture[] = []
  let environment: ReturnType<typeof createMuseumEnvironment> | undefined
  let world: ReturnType<typeof createRunnerWorld> | undefined
  let targets: ReturnType<typeof createRunnerTargets> | undefined
  let merc: Awaited<ReturnType<typeof loadAdventureMerc>> | undefined
  let sky: Texture | undefined
  let disposed = false,
    loaded = false,
    verified = false,
    contextLost = false
  let latest: RunnerSnapshot | undefined
  const key = new DirectionalLight(0xffdfaa, 2.5)
  key.position.set(-6, 9, 2)
  key.target.position.set(0, 0, -6)
  key.castShadow = true
  key.shadow.mapSize.set(1024, 1024)
  key.shadow.camera.left = key.shadow.camera.bottom = -12
  key.shadow.camera.right = key.shadow.camera.top = 12
  key.shadow.camera.near = 0.5
  key.shadow.camera.far = 35
  key.shadow.bias = -0.00015
  key.shadow.normalBias = 0.025
  const rim = new DirectionalLight(0x73ddd9, 0.65)
  rim.position.set(6, 4, -9)
  scene.add(new HemisphereLight(0xcceaff, 0x243e42, 0.7), key, key.target, rim)

  function resize() {
    if (
      disposed ||
      contextLost ||
      !canRenderViewport(
        container.clientWidth,
        container.clientHeight,
        renderer.getPixelRatio(),
      )
    )
      return
    const width = container.clientWidth,
      height = container.clientHeight
    renderer.setSize(width, height, false)
    camera.aspect = width / height
    const pose = runnerCameraPose(camera.aspect)
    camera.position.set(pose.x, pose.y, pose.z)
    camera.lookAt(0, pose.targetY, pose.targetZ)
    camera.updateProjectionMatrix()
    if (sky) fitSkyBackdrop(sky, width, height)
    shadowCadence.invalidate()
  }

  function lost(event: Event) {
    event.preventDefault()
    if (disposed) return
    contextLost = true
    options.onContextLost()
  }
  renderer.domElement.addEventListener('webglcontextlost', lost)
  const observer = new ResizeObserver(() => {
    resize()
    if (loaded && latest) render(latest, 0)
  })
  observer.observe(container)

  function dispose() {
    if (disposed) return
    disposed = true
    abort.abort()
    observer.disconnect()
    renderer.domElement.removeEventListener('webglcontextlost', lost)
    targets?.dispose()
    world?.dispose()
    merc?.dispose()
    environment?.dispose()
    scenes.forEach((source) => disposeObject(source))
    textures.forEach((texture) => texture.dispose())
    key.shadow.dispose()
    renderer.dispose()
    renderer.forceContextLoss()
    renderer.domElement.remove()
    images.forEach(releaseAssetImage)
    images.clear()
  }

  async function texture(id: string) {
    const value = await new TextureLoader().loadAsync(assetUrl(id))
    if (disposed) {
      value.dispose()
      throw new DOMException('Disposed', 'AbortError')
    }
    value.colorSpace = SRGBColorSpace
    textures.push(value)
    return value
  }

  async function model(id: string) {
    const value = await loadProfiledAssetScene(assetUrl(id), {
      signal: abort.signal,
      assetProfile: options.assetProfile ?? quality.assetProfile,
      onDecodedImage: (image) => {
        if (disposed) releaseAssetImage(image)
        else images.add(image)
      },
    })
    if (disposed) {
      disposeObject(value)
      throw new DOMException('Disposed', 'AbortError')
    }
    scenes.push(value)
    return value
  }
  const ready = (async () => {
    try {
      resize()
      environment = createMuseumEnvironment(renderer, scene)
      // Decode large bundles sequentially on phones; no all-course asset spike.
      const nextMerc = await loadAdventureMerc(assetUrl('merc'))
      if (disposed) {
        nextMerc.dispose()
        return
      }
      merc = nextMerc
      scene.add(merc.root)
      const marble = await texture('floor-marble')
      marble.wrapS = marble.wrapT = RepeatWrapping
      marble.repeat.set(2, 2)
      sky = await texture('museum-sky')
      scene.background = sky
      resize()
      const crystal = await model('living-crystal-platform-v2')
      const bundle = resolveAssetProfileBundle(
        'cloudway-lab-frost-gold-arch-v1',
        options.assetProfile ?? quality.assetProfile,
      )
      const glass = await model(bundle)
      if (disposed) return
      world = createRunnerWorld(
        course,
        crystal,
        marble,
        options.reducedMotion === true,
      )
      targets = createRunnerTargets(
        course,
        glass,
        bundle,
        comfortableMidi,
        options.reducedMotion === true,
      )
      scene.add(world.root, targets.root)
      await environment.load(assetUrl('museum-environment-v2'), () => disposed)
      if (disposed) return
      world.update(options.initialSnapshot, 0)
      targets.update(options.initialSnapshot, 0)
      installBackdropFog(scene, sky)
      await precompileRendererPrograms(renderer, scene, camera, abort.signal)
      if (disposed) return
      renderer.shadowMap.needsUpdate = true
      withResidentRenderablesVisible(scene, () =>
        renderer.render(scene, camera),
      )
      if (disposed) return
      shadowCadence.invalidate()
      loaded = true
      if (!render(options.initialSnapshot, 0))
        throw new Error('Runner initial frame could not be rendered.')
    } catch (error) {
      if (disposed) return
      dispose()
      throw error
    }
  })()

  function render(snapshot: RunnerSnapshot, dt: number) {
    latest = snapshot
    if (
      disposed ||
      contextLost ||
      !loaded ||
      !canRenderViewport(
        container.clientWidth,
        container.clientHeight,
        renderer.getPixelRatio(),
      )
    )
      return false
    world!.update(snapshot, dt)
    targets!.update(snapshot, dt)
    merc!.update(
      {
        player: {
          position: {
            x: snapshot.player.lateralX,
            y: snapshot.player.feetY,
            z: 0,
          },
          velocity: {
            x: 0,
            y: snapshot.player.verticalVelocityMetersPerSecond,
            z:
              snapshot.status === 'running'
                ? -snapshot.player.forwardSpeedMetersPerSecond
                : 0,
          },
          grounded: snapshot.player.grounded,
          facingYaw: 0,
        },
        elapsedSeconds: snapshot.courseSeconds,
        breakables: [
          ...snapshot.resolvedTargets
            .filter((result) => result.outcome === 'hit')
            .map(() => ({ phase: 'complete' as const })),
          ...(snapshot.activeTarget ? [{ phase: 'listening' as const }] : []),
        ],
      },
      dt,
      options.reducedMotion === true,
    )
    if (sky) installBackdropFog(scene, sky)
    renderer.shadowMap.needsUpdate = shadowCadence.next()
    renderer.render(scene, camera)
    if (!verified) {
      verifyFirstFrame(renderer.getContext())
      verified = true
    }
    return true
  }
  return {
    ready,
    render,
    resize,
    metrics: () => ({
      drawCalls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
      residentChunks: world?.metrics().residentChunks ?? 0,
      targets: targets?.metrics().targets ?? 0,
    }),
    dispose,
  }
}
