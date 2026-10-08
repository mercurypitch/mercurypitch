// Singing Current renderer — one stable third-person view of a bounded, audio-clock-driven world.
import type { Object3D, Texture } from 'three'
import { ACESFilmicToneMapping, Color, DirectionalLight, Fog, HemisphereLight, PCFShadowMap, PerspectiveCamera, RepeatWrapping, Scene, SRGBColorSpace, TextureLoader, } from 'three'
import { RUNNER_MATERIAL_FINISH_TEXTURE_IDS } from '../content/material-finishes'
import { runnerObstacleArt } from '../content/runner-obstacle-profiles'
import { parseShatterPlaybackSpeed } from '../core/shatter-presentation'
import type { CompiledRunnerCourse, RunnerSnapshot } from '../runner/contracts'
import { resolveAssetProfileBundle } from './asset-profile-bundles'
import { loadProfiledAssetScene } from './asset-scene-loader'
import { releaseAssetImage } from './asset-texture-profile'
import { installBackdropFog } from './backdrop-fog'
import { getBreakableRenderRecipe } from './catalog'
import { disposeObject } from './dispose'
import { createMuseumEnvironment } from './environment'
import { verifyFirstFrame } from './first-frame'
import type { GlassRenderer } from './glass-renderer-contracts'
import { retireGraphicsCanvas } from './graphics-diagnostics'
import { createGraphicsRenderer } from './graphics-renderer'
import { createMaterialFinishBank } from './material-finishes'
import { loadAdventureMerc } from './merc'
import { precompileRendererPrograms } from './program-precompile'
import { ADAPTIVE_PIXEL_RATIO, ADAPTIVE_SHADOW_FRAME_INTERVAL, createRenderPerformanceGovernor, } from './render-performance-governor'
import type { GlassAssetQualityProfile, GlassRenderQualityPreference, } from './render-quality'
import { createShadowUpdateCadence, effectiveGlassPixelRatio, resolveGlassRenderQuality, } from './render-quality'
import { withResidentRenderablesVisible } from './render-warmup'
import { captureRunnerImageLight, RUNNER_LOOK } from './runner-look'
import { createRunnerOpening } from './runner-opening'
import { RUNNER_OPENING_REPLACED_CHUNKS } from './runner-opening-layout'
import { createRunnerScenery } from './runner-scenery'
import { runnerSceneryFogFar } from './runner-scenery-layout'
import { createRunnerTargets } from './runner-targets'
import { createRunnerWorld } from './runner-world'
import { runnerCameraFollowTarget, runnerCameraPose, runnerMercVisualHeightMeters, stepRunnerCameraFollow, } from './runner-world-layout'
import { fitSkyBackdrop } from './sky-backdrop'
import { canRenderViewport } from './viewport'

export interface SongRunnerRendererOptions {
  readonly initialSnapshot: RunnerSnapshot
  readonly assetProfile?: GlassAssetQualityProfile
  readonly reducedMotion?: boolean
  readonly shatterPlaybackSpeed?: number
  readonly renderQuality?: GlassRenderQualityPreference
  readonly onContextLost: () => void
}
export interface SongRunnerRenderer {
  readonly ready: Promise<void>
  render(snapshot: RunnerSnapshot, deltaSeconds: number): boolean
  resize(): void
  setShatterPlaybackSpeed(speed: number): void
  setRenderQuality(preference: GlassRenderQualityPreference): void
  getRenderQuality: GlassRenderer['getRenderQuality']
  setCameraProfile(
    profile: CompiledRunnerCourse['presentation']['cameraProfile'],
  ): boolean
  metrics(): {
    drawCalls: number
    triangles: number
    residentChunks: number
    targets: number
    sceneryChunks: number
    sceneryBatches: number
    sceneryTriangles: number
    adaptiveQualityActive: boolean
    actualPixelRatio: number
    actualShadowFrameInterval: number
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
  let cameraProfile = course.presentation.cameraProfile
  const abort = new AbortController()
  const scene = new Scene()
  scene.background = new Color(0xc8dce0)
  const fog = new Fog(
    0xc8dce0,
    18,
    runnerSceneryFogFar(course.laneCenters, cameraProfile),
  )
  scene.fog = fog
  const camera = new PerspectiveCamera(55, 1, 0.08, 75)
  let shatterPlaybackSpeed = parseShatterPlaybackSpeed(
    options.shatterPlaybackSpeed,
  )
  let qualityPreference = options.renderQuality ?? 'auto'
  const qualityEnvironment = {
    cssWidth: container.clientWidth,
    cssHeight: container.clientHeight,
    coarsePointer: window.matchMedia('(pointer: coarse)').matches,
    mobileHint: options.assetProfile === 'mobile',
  }
  let quality = resolveGlassRenderQuality(qualityPreference, qualityEnvironment)
  const loadedAssetProfile = options.assetProfile ?? quality.assetProfile
  const renderer = createGraphicsRenderer('singing-current', {
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
  })
  renderer.outputColorSpace = SRGBColorSpace
  renderer.toneMapping = ACESFilmicToneMapping
  renderer.toneMappingExposure = RUNNER_LOOK.exposure
  scene.environmentIntensity = RUNNER_LOOK.environmentIntensity
  renderer.transmissionResolutionScale = quality.transmissionResolutionScale
  renderer.setPixelRatio(
    effectiveGlassPixelRatio(window.devicePixelRatio, quality),
  )
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = PCFShadowMap
  renderer.shadowMap.autoUpdate = false
  const shadowCadence = createShadowUpdateCadence(quality.shadowFrameInterval)
  const performanceGovernor = createRenderPerformanceGovernor(
    qualityPreference,
    quality.profile,
  )
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
  let scenery: ReturnType<typeof createRunnerScenery> | undefined
  let opening: ReturnType<typeof createRunnerOpening> | undefined
  let merc: Awaited<ReturnType<typeof loadAdventureMerc>> | undefined
  let sky: Texture | undefined
  let disposed = false,
    loaded = false,
    verified = false,
    contextLost = false
  let latest: RunnerSnapshot | undefined
  let cameraFollowX = runnerCameraFollowTarget(
    options.initialSnapshot.player.lateralX,
    course.laneCenters,
    1,
    cameraProfile,
    course.movement.kind === 'continuous',
  )
  let cameraPose = runnerCameraPose(1, course.laneCenters, cameraProfile)
  const key = new DirectionalLight(
    RUNNER_LOOK.key.color,
    RUNNER_LOOK.key.intensity,
  )
  key.position.set(...RUNNER_LOOK.key.position)
  key.target.position.set(0, 0, -6)
  key.castShadow = true
  key.shadow.mapSize.set(1024, 1024)
  key.shadow.camera.left = key.shadow.camera.bottom =
    -RUNNER_LOOK.shadow.halfExtent
  key.shadow.camera.right = key.shadow.camera.top =
    RUNNER_LOOK.shadow.halfExtent
  key.shadow.camera.near = RUNNER_LOOK.shadow.near
  key.shadow.camera.far = RUNNER_LOOK.shadow.far
  key.shadow.bias = RUNNER_LOOK.shadow.bias
  key.shadow.normalBias = RUNNER_LOOK.shadow.normalBias
  const rim = new DirectionalLight(
    RUNNER_LOOK.rim.color,
    RUNNER_LOOK.rim.intensity,
  )
  rim.position.set(...RUNNER_LOOK.rim.position)
  scene.add(
    new HemisphereLight(
      RUNNER_LOOK.fill.sky,
      RUNNER_LOOK.fill.ground,
      RUNNER_LOOK.fill.intensity,
    ),
    key,
    key.target,
    rim,
  )

  function applyCameraPose() {
    camera.position.set(
      cameraPose.x + cameraFollowX,
      cameraPose.y,
      cameraPose.z,
    )
    camera.lookAt(
      cameraPose.targetX + cameraFollowX,
      cameraPose.targetY,
      cameraPose.targetZ,
    )
  }

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
    refreshCameraPose()
    if (sky) fitSkyBackdrop(sky, width, height)
    shadowCadence.invalidate()
  }

  function applyPresentationQuality() {
    const adapted = performanceGovernor.metrics().adapted
    const baseRatio = effectiveGlassPixelRatio(window.devicePixelRatio, quality)
    renderer.setPixelRatio(
      adapted ? Math.min(baseRatio, ADAPTIVE_PIXEL_RATIO) : baseRatio,
    )
    renderer.transmissionResolutionScale = quality.transmissionResolutionScale
    shadowCadence.setInterval(
      adapted ? ADAPTIVE_SHADOW_FRAME_INTERVAL : quality.shadowFrameInterval,
    )
    resize()
  }

  function refreshCameraPose() {
    cameraPose = runnerCameraPose(
      camera.aspect,
      course.laneCenters,
      cameraProfile,
    )
    camera.fov = cameraPose.fovDegrees
    cameraFollowX = runnerCameraFollowTarget(
      (latest ?? options.initialSnapshot).player.lateralX,
      course.laneCenters,
      camera.aspect,
      cameraProfile,
      course.movement.kind === 'continuous',
    )
    applyCameraPose()
    camera.updateProjectionMatrix()
    shadowCadence.invalidate()
  }

  function setCameraProfile(
    profile: CompiledRunnerCourse['presentation']['cameraProfile'],
  ): boolean {
    if (
      disposed ||
      contextLost ||
      !loaded ||
      !scenery ||
      latest?.status === 'running' ||
      !canRenderViewport(
        container.clientWidth,
        container.clientHeight,
        renderer.getPixelRatio(),
      )
    )
      return false
    if (
      profile !== 'responsive-close' &&
      profile !== 'steering-close' &&
      profile !== 'steering-angled'
    )
      return false
    if (profile === cameraProfile) return true
    if (!scenery.setCameraProfile(profile)) return false
    cameraProfile = profile
    fog.far = runnerSceneryFogFar(course.laneCenters, profile)
    merc!.root.scale.setScalar(
      runnerMercVisualHeightMeters(course.laneCenters, profile) / 0.55,
    )
    refreshCameraPose()
    return render(latest ?? options.initialSnapshot, 0)
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
    retireGraphicsCanvas(renderer.domElement)
    performanceGovernor.dispose()
    abort.abort()
    observer.disconnect()
    renderer.domElement.removeEventListener('webglcontextlost', lost)
    targets?.dispose()
    scenery?.dispose()
    opening?.dispose()
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
      assetProfile: loadedAssetProfile,
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
      const nextMerc = await loadAdventureMerc(assetUrl('merc'), {
        initialFacingYaw: Math.PI,
      })
      if (disposed) {
        nextMerc.dispose()
        return
      }
      merc = nextMerc
      // The shared loader normalizes Merc to 0.55m. Runner framing owns a
      // larger presentation scale while compiled collision remains conservative.
      merc.root.scale.setScalar(
        runnerMercVisualHeightMeters(course.laneCenters, cameraProfile) / 0.55,
      )
      scene.add(merc.root)
      const marble = await texture('floor-marble')
      marble.wrapS = marble.wrapT = RepeatWrapping
      marble.repeat.set(2, 2)
      sky = await texture('floating-museum-cloudscape-v3')
      scene.background = sky
      resize()
      const crystal = await model('living-crystal-platform-v2')
      const obstacleSources = new Map<string, Object3D>()
      for (const obstacle of course.obstacles) {
        if (obstacle.kind !== 'blocker') continue
        const profile = runnerObstacleArt(obstacle.profileId)
        if (profile && !obstacleSources.has(profile.bundle))
          obstacleSources.set(profile.bundle, await model(profile.bundle))
      }
      const wallSources = new Map<
        string,
        { source: Object3D; bundle: string }
      >()
      const wallBundles = new Map<string, Object3D>()
      for (const target of course.targets) {
        const variant =
          target.glassPresentation?.variant ?? 'frost-gold-arch-breakwall-a'
        if (wallSources.has(variant)) continue
        const recipe = getBreakableRenderRecipe(variant)
        const bundle = resolveAssetProfileBundle(
          recipe.bundle!,
          loadedAssetProfile,
        )
        // Only installed course families are decoded, one at a time. Editor-only
        // alternatives never enter a play visit's memory or preparation work.
        const source = wallBundles.get(bundle) ?? (await model(bundle))
        wallBundles.set(bundle, source)
        wallSources.set(variant, { source, bundle })
      }
      if (disposed) return
      const museum = await model('museum-kit-v2')
      const garden = await model('museum-garden-v2')
      const arcade = await model('museum-arcade-v3')
      const canopy = await model('museum-canopy-v3')
      if (disposed) return
      const finishTextures = new Map<string, Texture>()
      for (const id of RUNNER_MATERIAL_FINISH_TEXTURE_IDS)
        finishTextures.set(id, await texture(id))
      if (disposed) return
      const finishes = createMaterialFinishBank(finishTextures)
      world = createRunnerWorld(
        course,
        crystal,
        marble,
        options.reducedMotion === true,
        finishes,
        obstacleSources,
      )
      targets = createRunnerTargets(
        course,
        wallSources,
        '',
        comfortableMidi,
        options.reducedMotion === true,
        finishes,
        shatterPlaybackSpeed,
      )
      const dressedOpening =
        cameraProfile === 'responsive-close' ||
        cameraProfile === 'steering-close' ||
        cameraProfile === 'steering-angled'
      if (dressedOpening)
        opening = createRunnerOpening({
          course,
          finishes,
          museum,
          garden,
          arcade,
          canopy,
          marble,
          reducedMotion: options.reducedMotion === true,
        })
      scenery = createRunnerScenery({
        skipFirstChunks: dressedOpening ? RUNNER_OPENING_REPLACED_CHUNKS : 0,
        course,
        finishes,
        museumScene: museum,
        gardenScene: garden,
        arcadeScene: arcade,
        canopyScene: canopy,
        reducedMotion: options.reducedMotion === true,
      })
      scene.add(world.root, targets.root, scenery.root)
      if (opening) scene.add(opening.root)
      if (disposed) return
      world.update(options.initialSnapshot, 0)
      targets.update(options.initialSnapshot, 0)
      scenery.update(options.initialSnapshot, 0)
      opening?.update(options.initialSnapshot, 0)
      captureRunnerImageLight(
        environment,
        renderer,
        scene,
        [merc.root, targets.root],
        quality,
      )
      installBackdropFog(scene, sky)
      await scenery.withWarmupState(async () => {
        await precompileRendererPrograms(renderer, scene, camera, abort.signal)
        if (disposed) return
        renderer.shadowMap.needsUpdate = true
        withResidentRenderablesVisible(scene, () =>
          renderer.render(scene, camera),
        )
      })
      if (disposed) return
      shadowCadence.invalidate()
      loaded = true
      if (!render(options.initialSnapshot, 0))
        throw new Error('Runner initial frame could not be rendered.')
      performanceGovernor.activate()
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
    if (
      performanceGovernor.observe(
        dt,
        snapshot.status === 'running' &&
          (typeof document === 'undefined' ||
            document.visibilityState === 'visible'),
      )
    ) {
      applyPresentationQuality()
    }
    world!.update(snapshot, dt)
    targets!.update(snapshot, dt)
    scenery!.update(snapshot, dt)
    opening?.update(snapshot, dt)
    cameraFollowX = stepRunnerCameraFollow(
      cameraFollowX,
      runnerCameraFollowTarget(
        snapshot.player.lateralX,
        course.laneCenters,
        camera.aspect,
        cameraProfile,
        course.movement.kind === 'continuous',
      ),
      dt,
    )
    applyCameraPose()
    merc!.update(
      {
        player: {
          position: {
            x: snapshot.player.lateralX,
            y: snapshot.player.feetY,
            z: 0,
          },
          velocity: {
            x: snapshot.player.lateralVelocityMetersPerSecond ?? 0,
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
      {
        slide:
          snapshot.player.slide === undefined
            ? undefined
            : {
                progress: snapshot.player.slide.progress,
                heightRatio:
                  snapshot.player.slide.bodyHeightMeters /
                  runnerMercVisualHeightMeters(
                    course.laneCenters,
                    cameraProfile,
                  ),
              },
      },
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
    setCameraProfile,
    setShatterPlaybackSpeed(speed) {
      shatterPlaybackSpeed = parseShatterPlaybackSpeed(speed)
      targets?.setShatterPlaybackSpeed(shatterPlaybackSpeed)
    },
    setRenderQuality(preference) {
      if (disposed || contextLost) return
      qualityPreference = preference
      quality = resolveGlassRenderQuality(preference, qualityEnvironment)
      performanceGovernor.configure(preference, quality.profile)
      applyPresentationQuality()
    },
    getRenderQuality: () => ({
      preference: qualityPreference,
      profile: quality.profile,
      assetProfile: loadedAssetProfile,
      pixelRatio: renderer.getPixelRatio(),
      shadowFrameInterval: performanceGovernor.metrics().adapted
        ? ADAPTIVE_SHADOW_FRAME_INTERVAL
        : quality.shadowFrameInterval,
    }),
    metrics: () => ({
      adaptiveQualityActive: performanceGovernor.metrics().adapted,
      actualPixelRatio: renderer.getPixelRatio(),
      actualShadowFrameInterval: performanceGovernor.metrics().adapted
        ? ADAPTIVE_SHADOW_FRAME_INTERVAL
        : quality.shadowFrameInterval,
      drawCalls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
      residentChunks: world?.metrics().residentChunks ?? 0,
      targets: targets?.metrics().targets ?? 0,
      sceneryChunks: scenery?.metrics().residentChunks ?? 0,
      sceneryBatches:
        (scenery?.metrics().drawBatches ?? 0) +
        (opening?.metrics().drawBatches ?? 0),
      sceneryTriangles:
        (scenery?.metrics().triangles ?? 0) +
        (opening?.metrics().triangles ?? 0),
    }),
    dispose,
  }
}
