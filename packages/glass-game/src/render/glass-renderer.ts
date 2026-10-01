// ============================================================
// Glass adventure renderer — a disposable, host-neutral Three.js museum scene.
// ============================================================

import type { Material, Texture } from 'three'
import { ACESFilmicToneMapping, Box3, DirectionalLight, Fog, FogExp2, HemisphereLight, PCFShadowMap, Scene, SRGBColorSpace, Vector3, WebGLRenderer, } from 'three'
import type { GameSnapshot, LevelDefinition } from '../contracts'
import { getRequiredRouteBreakableIds } from '../core/progress'
import { createLoadingProgressLedger } from '../loading-progress'
import { loadMuseumAssets } from './asset-kit'
import { createMuseumAssetLoadPlan } from './asset-load-plan'
import { releaseAssetImage } from './asset-texture-profile'
import { createAtmosphere } from './atmosphere'
import { installBackdropFog } from './backdrop-fog'
import { createAdventureCamera } from './camera'
import { getBreakableRenderRecipe, getPlatformRenderRecipe } from './catalog'
import { CLOUDWAY_FOG_COLOR, CLOUDWAY_FOG_FAR, CLOUDWAY_FOG_NEAR, isCloudwayLevel, } from './cloudway-scene'
import { createContactShadow } from './contact-shadow'
import { disposeMaterials, disposeObject } from './dispose'
import { createMuseumEnvironment } from './environment'
import { verifyFirstFrame } from './first-frame'
import { createGalleryInspection } from './gallery-inspection'
import type { GlassRenderer, GlassRendererOptions, } from './glass-renderer-contracts'
import { createMuseumMaterials } from './materials'
import { loadAdventureMerc } from './merc'
import { createMuseum } from './museum'
import { precompileRendererPrograms } from './program-precompile'
import { ADAPTIVE_PIXEL_RATIO, ADAPTIVE_SHADOW_FRAME_INTERVAL, createRenderPerformanceGovernor, } from './render-performance-governor'
import { createShadowUpdateCadence, effectiveGlassPixelRatio, resolveGlassRenderQuality, } from './render-quality'
import { withResidentRenderablesVisible } from './render-warmup'
import { resolveResonanceExhibitPresentations } from './resonance-exhibit-layout'
import { createResonancePortal } from './resonance-portal'
import { getMuseumSceneFrame, getMuseumVisualRecipe } from './scene-catalog'
import { fitSkyBackdrop } from './sky-backdrop'
import { createVessel } from './vessels'
import { canRenderViewport } from './viewport'

export type {
  GlassRenderer,
  GlassRendererOptions,
  GlassRendererPresentation,
} from './glass-renderer-contracts'

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
  const assetPlan = createMuseumAssetLoadPlan(level)
  const sceneRecipe = assetPlan.sceneRecipe
  const environmentTaskId =
    sceneRecipe.environment === undefined
      ? undefined
      : `environment:${sceneRecipe.environment}`
  const reflectionTaskId = sceneRecipe.reflectionProbe
    ? 'reflection-probe'
    : undefined
  const loading = createLoadingProgressLedger(
    [
      'merc:model',
      'gpu:programs',
      ...assetPlan.taskIds,
      ...(environmentTaskId === undefined ? [] : [environmentTaskId]),
      ...(reflectionTaskId === undefined ? [] : [reflectionTaskId]),
    ],
    options.onLoadingProgress ?? (() => undefined),
  )
  registerPartialCleanup(() => loading.freeze())
  const sceneFrame = getMuseumSceneFrame(level)
  const qualityEnvironment = {
    cssWidth:
      typeof window.innerWidth === 'number' && window.innerWidth > 0
        ? window.innerWidth
        : container.clientWidth,
    cssHeight:
      typeof window.innerHeight === 'number' && window.innerHeight > 0
        ? window.innerHeight
        : container.clientHeight,
    coarsePointer:
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(pointer: coarse)').matches,
    mobileHint:
      typeof navigator !== 'undefined' &&
      (
        navigator as Navigator & {
          userAgentData?: { readonly mobile?: boolean }
        }
      ).userAgentData?.mobile === true,
  }
  let renderQualityPreference = options.renderQuality ?? 'auto'
  let renderQuality = resolveGlassRenderQuality(
    renderQualityPreference,
    qualityEnvironment,
  )
  const performanceGovernor = createRenderPerformanceGovernor(
    renderQualityPreference,
    renderQuality.profile,
  )
  registerPartialCleanup(() => performanceGovernor.dispose())
  const loadedAssetProfile = options.assetProfile ?? renderQuality.assetProfile
  let shadowFrameInterval = renderQuality.shadowFrameInterval
  const shadowCadence = createShadowUpdateCadence(shadowFrameInterval)
  let shadowUpdates = 0
  let shadowReuses = 0
  const renderer = new WebGLRenderer({
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
  })
  renderer.outputColorSpace = SRGBColorSpace
  renderer.toneMapping = ACESFilmicToneMapping
  renderer.toneMappingExposure = 0.9
  const renderContext = renderer.getContext()
  const renderCapabilities = {
    colorBufferFloat:
      renderContext.getExtension('EXT_color_buffer_float') !== null,
    floatLinear:
      renderContext.getExtension('OES_texture_float_linear') !== null,
  }
  renderer.transmissionResolutionScale =
    renderQuality.transmissionResolutionScale
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = PCFShadowMap
  renderer.shadowMap.autoUpdate = shadowFrameInterval === 1
  // The reflection probe renders before the playable-frame cadence runs.
  // Prime a manual shadow map so Balanced never samples Three's placeholder
  // texture during that first offscreen pass.
  if (!renderer.shadowMap.autoUpdate) renderer.shadowMap.needsUpdate = true
  let pixelRatio = effectiveGlassPixelRatio(
    window.devicePixelRatio,
    renderQuality,
  )
  renderer.setPixelRatio(pixelRatio)
  renderer.domElement.style.cssText =
    'display:block;width:100%;height:100%;touch-action:none;'
  renderer.domElement.setAttribute('aria-label', 'Floating glass museum')
  container.append(renderer.domElement)
  const programPrecompile = new AbortController()
  const assetLoads = new AbortController()
  const decodedAssetImages = new Set<TexImageSource>()
  const releaseDecodedAssetImages = () => {
    decodedAssetImages.forEach((image) => releaseAssetImage(image))
    decodedAssetImages.clear()
  }
  registerPartialCleanup(() => {
    assetLoads.abort()
    programPrecompile.abort()
    renderer.dispose()
    renderer.forceContextLoss()
    renderer.domElement.remove()
    releaseDecodedAssetImages()
  })
  const scene = new Scene()
  scene.fog = isCloudwayLevel(level)
    ? new Fog(CLOUDWAY_FOG_COLOR, CLOUDWAY_FOG_NEAR, CLOUDWAY_FOG_FAR)
    : new FogExp2(0x59899e, 0.009)
  const camera = createAdventureCamera(level, {
    reducedMotion: options.reducedMotion,
    followSmoothnessSeconds: options.followSmoothnessSeconds,
    mode: options.cameraMode,
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
  const shadowMapSize = renderQuality.shadowMapSize
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
    { ...level.exit, requiresCompleted: getRequiredRouteBreakableIds(level) },
    materials,
    options.reducedMotion ?? false,
  )
  scene.add(portal.root)
  const contact = createContactShadow(level)
  scene.add(contact.mesh)
  const resonancePresentations = resolveResonanceExhibitPresentations(level)
  const vessels = new Map(
    level.breakables.map((target) => {
      const resonancePresentation = resonancePresentations.get(target.id)
      const vessel = createVessel(target, options.reducedMotion ?? false, {
        resonancePresentation,
      })
      scene.add(vessel.root)
      return [target.id, vessel]
    }),
  )
  const mercBounds = new Box3()
  const targetBounds = new Box3()
  const targetFacing = new Vector3()
  let boundsEncounterId: string | null = null
  const vesselRoomIds = new Map(
    level.breakables.map((target) => [
      target.id,
      museum.roomIdForRuntimeId(target.id),
    ]),
  )
  const explicitlyRoomOwnedVesselIds = new Set(
    (level.presentation?.rooms ?? []).flatMap(
      (room) => room.breakableIds ?? [],
    ),
  )
  registerPartialCleanup(() => vessels.forEach((vessel) => vessel.dispose()))
  let merc: Awaited<ReturnType<typeof loadAdventureMerc>> | undefined
  let disposed = false
  let contextLost = false
  const onContextLost = (event: Event) => {
    event.preventDefault()
    if (disposed || contextLost) return
    contextLost = true
    assetLoads.abort()
    programPrecompile.abort()
    loading.freeze()
    options.onContextLost?.()
  }
  renderer.domElement.addEventListener('webglcontextlost', onContextLost)
  registerPartialCleanup(() =>
    renderer.domElement.removeEventListener('webglcontextlost', onContextLost),
  )
  let latest: GameSnapshot | undefined
  let skyBackdrop: Texture | undefined
  let drawable = false
  let firstFrameVerified = false
  let shadowTopology = ''
  const resize = () => {
    if (disposed) return
    const width = container.clientWidth
    const height = container.clientHeight
    drawable = canRenderViewport(width, height, pixelRatio)
    if (!drawable) return
    renderer.setSize(width, height, false)
    if (skyBackdrop) fitSkyBackdrop(skyBackdrop, width, height)
    camera.camera.aspect = width / height
    camera.camera.updateProjectionMatrix()
    shadowCadence.invalidate()
  }
  const applyPresentationQuality = (): void => {
    const adapted = performanceGovernor.metrics().adapted
    const nextPixelRatio = adapted
      ? Math.min(
          effectiveGlassPixelRatio(window.devicePixelRatio, renderQuality),
          ADAPTIVE_PIXEL_RATIO,
        )
      : effectiveGlassPixelRatio(window.devicePixelRatio, renderQuality)
    const nextShadowFrameInterval = adapted
      ? ADAPTIVE_SHADOW_FRAME_INTERVAL
      : renderQuality.shadowFrameInterval
    const pixelRatioChanged = nextPixelRatio !== pixelRatio
    pixelRatio = nextPixelRatio
    shadowFrameInterval = nextShadowFrameInterval
    renderer.transmissionResolutionScale =
      renderQuality.transmissionResolutionScale
    renderer.shadowMap.autoUpdate = shadowFrameInterval === 1
    shadowCadence.setInterval(shadowFrameInterval)
    if (pixelRatioChanged) {
      renderer.setPixelRatio(pixelRatio)
      resize()
    }
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
    loading.complete('merc:model')
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
    (texture) => {
      atmosphere.setSky(texture)
      if (sceneRecipe.skyProjection === 'backdrop') {
        skyBackdrop = texture
        fitSkyBackdrop(texture, container.clientWidth, container.clientHeight)
        scene.background = texture
      }
    },
    () => disposed,
    options.onAssetError,
    (taskId) => loading.complete(taskId),
    {
      signal: assetLoads.signal,
      assetProfile: loadedAssetProfile,
      maximumConcurrentBundleLoads: renderQuality.maximumConcurrentBundleLoads,
      onDecodedImage: (image) => {
        if (disposed || contextLost || assetLoads.signal.aborted)
          releaseAssetImage(image)
        else decodedAssetImages.add(image)
      },
    },
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
          .then(() => {
            if (!disposed && !contextLost) loading.complete(environmentTaskId!)
          })
      : Promise.resolve()
  registerPartialCleanup(() => {
    void environmentReady.catch(() => undefined)
  })
  const ready = Promise.all([mercReady, assetsReady, environmentReady])
    .then(() => {
      if (disposed || contextLost) return
      if (isCloudwayLevel(level) && skyBackdrop !== undefined)
        installBackdropFog(scene, skyBackdrop)
      if (!sceneRecipe.reflectionProbe) return
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
      if (!disposed && !contextLost) loading.complete(reflectionTaskId!)
    })
    .then(async () => {
      if (disposed || contextLost) return
      // Compile hidden fragment/instancing variants behind the loading screen,
      // after the final lighting and environment exist, before the first Sing.
      await precompileRendererPrograms(
        renderer,
        scene,
        camera.camera,
        programPrecompile.signal,
      )
      if (disposed || contextLost) return
      // compile() cannot upload hidden buffers or complete a program's first
      // real use. Exercise every resident effect behind the loading cover on
      // the same framebuffer used during play, then restore its exact state.
      renderer.shadowMap.needsUpdate = true
      withResidentRenderablesVisible(scene, () =>
        renderer.render(scene, camera.camera),
      )
      shadowCadence.invalidate()
      performanceGovernor.activate()
      loading.complete('gpu:programs')
    })
    .catch((error: unknown) => {
      loading.freeze()
      throw error
    })
  return {
    ready,
    resize,
    orbit: camera.orbit,
    setOrbitActive: camera.setOrbitActive,
    zoom: camera.zoom,
    recenter: camera.recenter,
    setCameraMode: camera.setMode,
    getCameraMode: camera.mode,
    getCameraYaw: camera.yaw,
    getMercYaw: () => merc?.root.rotation.y ?? null,
    getMovementYaw: camera.movementYaw,
    setFollowSmoothness: camera.setFollowSmoothness,
    setRenderQuality(preference) {
      const next = resolveGlassRenderQuality(preference, qualityEnvironment)
      renderQualityPreference = preference
      renderQuality = next
      performanceGovernor.configure(preference, next.profile)
      applyPresentationQuality()
    },
    getRenderQuality: () => ({
      preference: renderQualityPreference,
      profile: renderQuality.profile,
      assetProfile: loadedAssetProfile,
      pixelRatio,
      shadowFrameInterval,
    }),
    setMovementActive: camera.setMovementActive,
    rebaseMovement: camera.rebaseMovement,
    cancelHeadingFollow: camera.cancelHeadingFollow,
    pickArtwork: gallery.pick,
    nearbyArtwork: gallery.nearby,
    getChallengeCameraMetrics: camera.getChallengeMetrics,
    getMetrics: () => {
      const performance = performanceGovernor.metrics()
      return {
        drawCalls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
        textures: renderer.info.memory.textures,
        geometries: renderer.info.memory.geometries,
        ...renderCapabilities,
        reflectionCaptures: museum.planarReflectionMetrics.captures,
        reflectionTargetPixels:
          museum.planarReflectionMetrics.targetWidth *
          museum.planarReflectionMetrics.targetHeight,
        adaptiveQualityActive: performance.adapted,
        performanceSampleCount: performance.sampleCount,
        performanceSampleWindowSeconds: performance.sampleWindowSeconds,
        performanceSlowSampleCount: performance.slowSampleCount,
        actualPixelRatio: pixelRatio,
        actualShadowFrameInterval: shadowFrameInterval,
        shadowUpdates,
        shadowReuses,
      }
    },
    render(snapshot, delta, presentation) {
      if (disposed || contextLost || !drawable) return false
      latest = snapshot
      const elapsedDt = Number.isFinite(delta) ? Math.max(0, delta) : 0
      const performanceEligible =
        snapshot.phase === 'idle' &&
        !snapshot.complete &&
        !snapshot.paused &&
        presentation?.paused !== true &&
        (presentation?.challengeEncounterId ?? null) === null &&
        !camera.challengePresentationActive() &&
        (typeof document === 'undefined' ||
          document.visibilityState === 'visible')
      if (performanceGovernor.observe(elapsedDt, performanceEligible))
        applyPresentationQuality()
      // A slow mobile frame cannot be redrawn, but dropping its elapsed time
      // here made Merc's mixer lag behind the game's wall clock afterward.
      // Keep a suspension bound while allowing ordinary hitches to catch up.
      const animationDt = snapshot.paused ? 0 : Math.min(0.25, elapsedDt)
      const presentationDt = Math.min(0.25, elapsedDt)
      const cameraDt = Math.min(0.05, elapsedDt)
      const simulationDt = snapshot.paused ? 0 : cameraDt
      const presentationPaused = presentation?.paused ?? snapshot.paused
      camera.setChallengeEncounter(presentation?.challengeEncounterId ?? null)
      if (presentation?.safeBottomFraction !== undefined)
        camera.setChallengeSafeBottomFraction(presentation.safeBottomFraction)
      const challengeId = camera.focusedChallengeId(snapshot)
      const challengeDefinition =
        challengeId === null
          ? undefined
          : level.breakables.find((item) => item.id === challengeId)
      const presentationFacingYaw =
        challengeDefinition === undefined
          ? undefined
          : Math.atan2(
              challengeDefinition.position.x - snapshot.player.position.x,
              challengeDefinition.position.z - snapshot.player.position.z,
            )
      const museumShadowVisibilityChanged = museum.update(snapshot)
      if (portal.update(snapshot, simulationDt))
        options.onExitCelebrationComplete?.()
      contact.update(snapshot)
      merc?.update(snapshot, animationDt, options.reducedMotion ?? false, {
        facingYaw: presentationFacingYaw,
        turnDeltaSeconds: presentationPaused ? 0 : presentationDt,
        narrationLevel: presentationPaused ? 0 : presentation?.narrationLevel,
      })
      camera.setOccluders(museum.cameraOccluders())
      const challengeVessel =
        challengeId === null ? undefined : vessels.get(challengeId)
      const updatedVesselIds = new Set<string>()
      if (challengeId !== null && challengeVessel !== undefined) {
        const challengeState = snapshot.breakables.find(
          (state) => state.id === challengeId,
        )
        if (challengeState !== undefined) {
          challengeVessel.update(challengeState, snapshot.elapsedSeconds, true)
          updatedVesselIds.add(challengeId)
        }
      }
      if (
        challengeId !== null &&
        challengeId !== boundsEncounterId &&
        merc !== undefined &&
        challengeVessel
      ) {
        merc.root.updateWorldMatrix(true, true)
        mercBounds.setFromObject(merc.root, true)
        challengeVessel.getIntactBounds(targetBounds)
        if (!mercBounds.isEmpty() && !targetBounds.isEmpty()) {
          const planarTarget =
            challengeDefinition !== undefined &&
            (getBreakableRenderRecipe(challengeDefinition.variant)
              .faceAnchor === true ||
              challengeDefinition.presentation?.kind === 'barrier')
          camera.setChallengeSubjects({
            encounterId: challengeId,
            merc: mercBounds,
            target: targetBounds,
            targetFacing: planarTarget
              ? challengeVessel.root.getWorldDirection(targetFacing)
              : undefined,
          })
          boundsEncounterId = challengeId
        }
      }
      if (challengeId === null) boundsEncounterId = null
      camera.update(snapshot, presentationDt, presentationPaused)
      const cloudwaySelectionChanged = museum.cullCloudwayPlatforms(
        camera.camera,
      )
      const roomSelection = museum.updateRoomVisibility(
        snapshot.player.position,
        camera.camera,
      )
      const visibleRooms = roomSelection.visibleRoomIds
      vessels.forEach((vessel, id) => {
        const roomId = vesselRoomIds.get(id)
        vessel.root.visible = roomId === undefined || visibleRooms.has(roomId)
      })
      for (const state of snapshot.breakables) {
        const vessel = vessels.get(state.id)
        if (vessel === undefined || updatedVesselIds.has(state.id)) continue
        vessel.update(state, snapshot.elapsedSeconds, vessel.root.visible)
      }
      museum.updatePlanarReflection(
        renderer,
        scene,
        camera.camera,
        container.clientWidth,
        container.clientHeight,
        (capture) => {
          const legacyVisibility = new Map<string, boolean>()
          try {
            for (const state of snapshot.breakables) {
              if (explicitlyRoomOwnedVesselIds.has(state.id)) continue
              const vessel = vessels.get(state.id)
              if (vessel === undefined) continue
              legacyVisibility.set(state.id, vessel.root.visible)
              vessel.update(state, snapshot.elapsedSeconds, true)
              vessel.root.visible = true
            }
            capture()
          } finally {
            legacyVisibility.forEach((visible, id) => {
              const vessel = vessels.get(id)
              if (vessel !== undefined) vessel.root.visible = visible
            })
          }
        },
      )
      const nextShadowTopology = [
        `${snapshot.player.grounded ? 'grounded' : 'airborne'}:${
          Math.hypot(snapshot.player.velocity.x, snapshot.player.velocity.z) >
          0.08
            ? 'moving'
            : 'stationary'
        }`,
        snapshot.activeSolidIds?.join('|') ?? '',
        snapshot.enabledPlatformIds.join('|'),
        snapshot.breakables
          .map(
            (state) =>
              `${state.id}:${state.phase}:${state.brokenAt === null ? 'intact' : 'broken'}`,
          )
          .join('|'),
      ].join('::')
      if (
        museumShadowVisibilityChanged ||
        cloudwaySelectionChanged ||
        roomSelection.shadowVisibilityChanged ||
        nextShadowTopology !== shadowTopology
      )
        shadowCadence.invalidate()
      shadowTopology = nextShadowTopology
      const updateShadow = shadowCadence.next()
      renderer.shadowMap.needsUpdate = updateShadow
      if (updateShadow) shadowUpdates++
      else shadowReuses++
      const mercVisible = merc?.root.visible
      if (merc !== undefined && camera.mode() === 'first-person')
        merc.root.visible = false
      try {
        renderer.render(scene, camera.camera)
      } finally {
        if (merc !== undefined && mercVisible !== undefined)
          merc.root.visible = mercVisible
      }
      if (!firstFrameVerified) {
        verifyFirstFrame(renderer.getContext())
        firstFrameVerified = true
      }
      return !contextLost
    },
    dispose() {
      if (disposed) return
      disposed = true
      assetLoads.abort()
      programPrecompile.abort()
      loading.freeze()
      performanceGovernor.dispose()
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost)
      observer.disconnect()
      camera.clearChallenge()
      merc?.dispose()
      vessels.forEach((vessel) => vessel.dispose())
      scene.environment = null
      const borrowedMaterials = new Set([
        ...museum.materialLibrary.materials,
        ...Object.values(materials),
      ])
      // Museum adapters own geometry and material variants that may borrow
      // library textures. Remove those roots before generic scene disposal so
      // the shared textures remain exclusively library-owned.
      museum.dispose()
      disposeObject(scene, borrowedMaterials)
      museum.materialLibrary.dispose()
      disposeMaterials(Object.values(materials))
      releaseDecodedAssetImages()
      environment.dispose()
      key.shadow.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
      renderer.domElement.remove()
    },
  }
}
