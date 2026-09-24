// Floating museum scene — one fallible WebGL map, frame clock and selection surface.

import type { Object3D } from 'three'
import { ACESFilmicToneMapping, AmbientLight, DirectionalLight, Fog, HemisphereLight, Mesh, MeshStandardMaterial, PerspectiveCamera, Raycaster, RingGeometry, Scene, SRGBColorSpace, Vector2, Vector3, WebGLRenderer, } from 'three'
import type { MuseumJourneyDefinition, MuseumJourneyStage, } from '../content/museum-journey'
import { disposeObject } from '../render/dispose'
import { createMuseumEnvironment } from '../render/environment'
import { verifyFirstFrame } from '../render/first-frame'
import { canRenderViewport } from '../render/viewport'
import { clampJourneyInspectionZoom, clampJourneyOrbit, JOURNEY_DEFAULT_ORBIT, journeyCameraView, projectJourneyStage, } from './camera'
import { createJourneyPointerTracker, journeyWheelZoomDelta, } from './interaction'
import { JOURNEY_MEDALLION_CLEARANCE_Y, journeyMarkerPoint } from './landmarks'
import { loadJourneyMapModels } from './models'
import type { JourneyProgressDisplay, MuseumJourneyStageProgress, } from './progress'
import { createJourneyProgressDisplay } from './progress'
import { acceptJourneyResource, createJourneyFrameLoop } from './resources'
import { createJourneySky } from './sky'
import { createJourneyWater } from './water'

export interface MuseumJourneySceneMetrics {
  drawCalls: number
  triangles: number
  geometries: number
  textures: number
  waterTriangles: number
  waterDrawCalls: number
  secondaryRenderPasses: number
}

export interface MuseumJourneyScene {
  ready: Promise<void>
  setSelected(stageId: string): void
  setProgress(progress: readonly MuseumJourneyStageProgress[]): void
  setForeground(foreground: boolean): void
  setReducedMotion(reduced: boolean): void
  resetView(): void
  getMetrics(): MuseumJourneySceneMetrics
  dispose(): void
}

export interface MuseumJourneySceneOptions {
  selectedStageId: string
  foreground: boolean
  reducedMotion: boolean
  onSelect(stageId: string): void
  onFailure(error: unknown): void
  onViewChange?(changed: boolean): void
  onProjectStageLabels?(
    labels: readonly MuseumJourneyStageLabelProjection[],
  ): void
}

export interface MuseumJourneyStageLabelProjection {
  stageId: string
  x: number
  y: number
  visible: boolean
}

function stageById(
  definition: MuseumJourneyDefinition,
  id: string,
): MuseumJourneyStage {
  return (
    definition.stages.find((stage) => stage.id === id) ?? definition.stages[0]!
  )
}

function stageIdFromHit(object: Object3D | null): string | undefined {
  let cursor = object
  while (cursor !== null) {
    const id = cursor.userData.journeyStageId
    if (typeof id === 'string') return id
    cursor = cursor.parent
  }
  return undefined
}

function normalizeProgress(
  definition: MuseumJourneyDefinition,
  progress: readonly MuseumJourneyStageProgress[],
): readonly MuseumJourneyStageProgress[] {
  const knownStageIds = new Set(definition.stages.map((stage) => stage.id))
  const byStage = new Map<string, MuseumJourneyStageProgress>()
  for (const entry of progress) {
    if (!knownStageIds.has(entry.stageId)) continue
    byStage.set(entry.stageId, {
      stageId: entry.stageId,
      ...(entry.stars === 1 || entry.stars === 2 || entry.stars === 3
        ? { stars: entry.stars }
        : {}),
      ...(entry.portrait !== undefined && entry.portrait.imageUrl.trim() !== ''
        ? {
            portrait: {
              ...(entry.portrait.id === undefined
                ? {}
                : { id: entry.portrait.id }),
              imageUrl: entry.portrait.imageUrl,
            },
          }
        : {}),
    })
  }
  return definition.stages.flatMap((stage) => {
    const entry = byStage.get(stage.id)
    return entry === undefined ? [] : [entry]
  })
}

type RegisterConstructionCleanup = (cleanup: () => void) => void

export function createMuseumJourneyScene(
  container: HTMLElement,
  definition: MuseumJourneyDefinition,
  assetUrl: (id: string) => string,
  options: MuseumJourneySceneOptions,
): MuseumJourneyScene {
  const cleanups: (() => void)[] = []
  try {
    const result = buildMuseumJourneyScene(
      container,
      definition,
      assetUrl,
      options,
      (cleanup) => cleanups.push(cleanup),
    )
    cleanups.length = 0
    return result
  } catch (error) {
    for (let index = cleanups.length - 1; index >= 0; index--) {
      try {
        cleanups[index]!()
      } catch {
        // Preserve the setup failure; every remaining owner still gets retired.
      }
    }
    throw error
  }
}

function buildMuseumJourneyScene(
  container: HTMLElement,
  definition: MuseumJourneyDefinition,
  assetUrl: (id: string) => string,
  options: MuseumJourneySceneOptions,
  onConstructionFailure: RegisterConstructionCleanup,
): MuseumJourneyScene {
  const mapUrl = assetUrl(definition.modelAssetId)
  const mercUrl = assetUrl('merc')
  const sculptureUrl =
    definition.sculpturalAssetId === undefined
      ? undefined
      : assetUrl(definition.sculpturalAssetId)
  const architectureUrl =
    definition.architecturalAssetId === undefined
      ? undefined
      : assetUrl(definition.architecturalAssetId)
  const marbleTextureUrls = {
    basecolor: assetUrl('warm-carrara-basecolor'),
    normal: assetUrl('warm-carrara-normal'),
    roughness: assetUrl('warm-carrara-roughness'),
  }
  const mysteryPortraitUrl = assetUrl('floating-museum-mystery-portrait-v5')
  const cloudscapeUrl = assetUrl('floating-museum-cloudscape-v3')
  const environmentUrl = assetUrl('museum-environment-v2')
  const renderer = new WebGLRenderer({
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
  })
  onConstructionFailure(() => renderer.domElement.remove())
  onConstructionFailure(() => renderer.forceContextLoss())
  onConstructionFailure(() => renderer.dispose())
  renderer.outputColorSpace = SRGBColorSpace
  renderer.toneMapping = ACESFilmicToneMapping
  renderer.toneMappingExposure = 0.86
  renderer.transmissionResolutionScale = 0.5
  renderer.info.autoReset = false
  renderer.shadowMap.enabled = true
  const pixelRatio = Math.min(
    window.devicePixelRatio || 1,
    window.matchMedia('(pointer: coarse)').matches ? 1.5 : 1.8,
  )
  renderer.setPixelRatio(pixelRatio)
  renderer.domElement.style.cssText =
    'display:block;width:100%;height:100%;touch-action:none;'
  renderer.domElement.setAttribute(
    'aria-label',
    'Interactive floating museum map. Tap a gallery to select it, drag to orbit, and scroll or pinch to zoom. The gallery list below is also available.',
  )
  renderer.domElement.setAttribute('role', 'img')

  const scene = new Scene()
  onConstructionFailure(() => disposeObject(scene))
  const abort = new AbortController()
  onConstructionFailure(() => abort.abort())
  const sky = createJourneySky({
    backgroundUrl: cloudscapeUrl,
    signal: abort.signal,
  })
  onConstructionFailure(() => sky.dispose())
  scene.background = sky.background
  scene.fog = new Fog(0xd9e5e8, 24, 48)
  scene.add(sky.root)
  scene.environmentIntensity = 0.58
  const environment = createMuseumEnvironment(renderer, scene)
  onConstructionFailure(() => environment.dispose())
  const camera = new PerspectiveCamera(34, 1, 0.1, 80)
  const raycaster = new Raycaster()
  const pointer = new Vector2()
  const target = new Vector3()
  const desiredTarget = new Vector3()
  const projectionScratch = new Vector3()
  let orbitYaw: number = JOURNEY_DEFAULT_ORBIT.yaw
  let orbitPitch: number = JOURNEY_DEFAULT_ORBIT.pitch
  let inspectionZoom = 0
  let desiredDistance = 21
  let cameraDistance = desiredDistance
  let selectedStageId = stageById(definition, options.selectedStageId).id
  let reducedMotion = options.reducedMotion
  let foreground = options.foreground
  let disposed = false
  let contextLost = false
  let viewChanged = false
  let models: Awaited<ReturnType<typeof loadJourneyMapModels>> | undefined
  let progressDisplay: JourneyProgressDisplay | undefined
  let latestProgress: readonly MuseumJourneyStageProgress[] = []
  let projectionSettled = false
  let resolveProjection!: () => void
  let rejectProjection!: (reason: unknown) => void
  const firstModelProjection = new Promise<void>((resolve, reject) => {
    resolveProjection = resolve
    rejectProjection = reject
  })
  // A scene can be disposed before its consumer observes ready. Keep the
  // internal gate rejection handled while the public ready promise reports it.
  void firstModelProjection.catch(() => undefined)

  function failProjection(reason: unknown): void {
    if (projectionSettled) return
    projectionSettled = true
    rejectProjection(reason)
  }

  scene.add(new AmbientLight(0xfff2dc, 0.3))
  scene.add(new HemisphereLight(0xddeef2, 0x294a43, 0.62))
  const sun = new DirectionalLight(0xffdfac, 2.25)
  onConstructionFailure(() => sun.shadow.dispose())
  sun.position.set(-9, 14, 10)
  sun.castShadow = true
  sun.shadow.mapSize.set(1024, 1024)
  sun.shadow.camera.left = -14
  sun.shadow.camera.right = 14
  sun.shadow.camera.top = 12
  sun.shadow.camera.bottom = -12
  sun.shadow.camera.near = 1
  sun.shadow.camera.far = 45
  sun.shadow.normalBias = 0.035
  scene.add(sun)
  const halo = new Mesh(
    new RingGeometry(1.2, 1.38, 48),
    new MeshStandardMaterial({
      color: 0xe8c675,
      emissive: 0x8b6422,
      emissiveIntensity: 0.45,
      metalness: 0.66,
      roughness: 0.24,
      transparent: true,
      opacity: 0.9,
    }),
  )
  halo.name = 'journey-selection-halo'
  halo.rotation.x = -Math.PI / 2
  halo.scale.setScalar(0.42)
  halo.position.fromArray(
    journeyMarkerPoint(
      stageById(definition, selectedStageId),
      JOURNEY_MEDALLION_CLEARANCE_Y,
    ),
  )
  scene.add(halo)

  const water = createJourneyWater(definition.spillways)
  onConstructionFailure(() => water.dispose())
  water.setReducedMotion(reducedMotion)
  scene.add(water.root)
  let publishedMetrics = false

  function publishCameraState(): void {
    renderer.domElement.dataset.journeyCameraZoom = inspectionZoom.toFixed(3)
    renderer.domElement.dataset.journeyCameraYaw = orbitYaw.toFixed(3)
    renderer.domElement.dataset.journeyCameraPitch = orbitPitch.toFixed(3)
  }

  function setViewChanged(next: boolean): void {
    if (viewChanged === next) return
    viewChanged = next
    options.onViewChange?.(next)
  }

  function collectMetrics(): MuseumJourneySceneMetrics {
    const waterMetrics = water.getMetrics()
    return {
      drawCalls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
      geometries: renderer.info.memory.geometries,
      textures: renderer.info.memory.textures,
      waterTriangles: waterMetrics.triangles,
      waterDrawCalls: waterMetrics.drawCalls,
      // renderer.info totals this shadow pass with the visible-scene draws.
      secondaryRenderPasses: 1 + waterMetrics.secondaryRenderPasses,
    }
  }

  function updateDesiredView(immediate = false): void {
    const stage = stageById(definition, selectedStageId)
    const view = journeyCameraView(
      container.clientWidth,
      container.clientHeight,
      stage.focus,
      inspectionZoom,
    )
    desiredTarget.fromArray(view.target)
    desiredDistance = view.distance
    halo.position.fromArray(
      journeyMarkerPoint(stage, JOURNEY_MEDALLION_CLEARANCE_Y),
    )
    models?.setSelected(stage, immediate || reducedMotion)
    if (immediate || reducedMotion) {
      target.copy(desiredTarget)
      cameraDistance = desiredDistance
    }
  }
  updateDesiredView(true)
  publishCameraState()

  let drawable = false
  let firstFrameVerified = false

  function resize(): void {
    if (disposed) return
    const width = container.clientWidth
    const height = container.clientHeight
    drawable = canRenderViewport(width, height, pixelRatio)
    if (!drawable) return
    renderer.setSize(width, height, false)
    sky.resize(width, height)
    camera.aspect = width / height
    camera.updateProjectionMatrix()
    updateDesiredView(reducedMotion)
  }
  resize()
  const observer = new ResizeObserver(resize)
  onConstructionFailure(() => observer.disconnect())
  observer.observe(container)

  function renderFrame(visibleSeconds: number, dt: number): void {
    if (disposed || contextLost || !drawable) return
    if (reducedMotion) {
      target.copy(desiredTarget)
      cameraDistance = desiredDistance
    } else {
      target.lerp(desiredTarget, 1 - Math.exp(-3.8 * dt))
      cameraDistance +=
        (desiredDistance - cameraDistance) * (1 - Math.exp(-7.5 * dt))
    }
    const planar = Math.cos(orbitPitch) * cameraDistance
    camera.position.set(
      target.x + Math.sin(orbitYaw) * planar,
      target.y + Math.sin(orbitPitch) * cameraDistance,
      target.z + Math.cos(orbitYaw) * planar,
    )
    camera.lookAt(target)
    camera.updateMatrixWorld()
    halo.rotation.z = reducedMotion ? 0 : visibleSeconds * 0.16
    water.update(visibleSeconds, dt)
    sky.update(visibleSeconds, dt, reducedMotion)
    models?.update(dt, reducedMotion)
    // With auto-reset disabled this single reset includes Three's shadow pass
    // in the same totals as the visible scene draw.
    renderer.info.reset()
    try {
      renderer.render(scene, camera)
      if (models !== undefined && !firstFrameVerified) {
        verifyFirstFrame(renderer.getContext())
        firstFrameVerified = true
      }
    } catch (error) {
      failGraphics(
        error instanceof Error ? error : new Error('The museum frame failed.'),
      )
      return
    }
    const projections = definition.stages.map((stage) => {
      const projected = projectJourneyStage(
        journeyMarkerPoint(stage),
        camera,
        Math.max(1, container.clientWidth),
        Math.max(1, container.clientHeight),
        projectionScratch,
      )
      return {
        stageId: stage.id,
        x: projected.x,
        y: projected.y,
        visible: models !== undefined && projected.visible,
      }
    })
    options.onProjectStageLabels?.(projections)
    if (
      models !== undefined &&
      !projectionSettled &&
      projections.some(
        (projection) =>
          projection.stageId === selectedStageId && projection.visible,
      )
    ) {
      projectionSettled = true
      resolveProjection()
    }
    if (models !== undefined && !publishedMetrics) {
      publishedMetrics = true
      renderer.domElement.dataset.rendererMetrics =
        JSON.stringify(collectMetrics())
    }
  }
  const loop = createJourneyFrameLoop(renderFrame)
  onConstructionFailure(() => loop.dispose())

  const gestures = createJourneyPointerTracker()

  function setInspectionZoom(next: number): boolean {
    const clamped = clampJourneyInspectionZoom(next)
    if (Math.abs(clamped - inspectionZoom) < 0.0001) return false
    inspectionZoom = clamped
    const orbit = clampJourneyOrbit(orbitYaw, orbitPitch, inspectionZoom)
    orbitYaw = orbit.yaw
    orbitPitch = orbit.pitch
    updateDesiredView()
    publishCameraState()
    setViewChanged(true)
    return true
  }

  const sample = (event: PointerEvent) => ({
    pointerId: event.pointerId,
    clientX: event.clientX,
    clientY: event.clientY,
  })
  const onPointerDown = (event: PointerEvent): void => {
    if (disposed || contextLost || !foreground) return
    gestures.down(sample(event))
    renderer.domElement.setPointerCapture(event.pointerId)
  }
  const onPointerMove = (event: PointerEvent): void => {
    if (disposed || contextLost || !foreground) return
    const move = gestures.move(sample(event))
    if (move?.kind === 'pinch') {
      setInspectionZoom(inspectionZoom + Math.log(move.scale) / Math.log(2.5))
      return
    }
    if (move?.kind !== 'drag') return
    const orbit = clampJourneyOrbit(
      orbitYaw - move.dx * 0.004,
      orbitPitch + move.dy * 0.0035,
      inspectionZoom,
    )
    if (orbit.yaw === orbitYaw && orbit.pitch === orbitPitch) return
    orbitYaw = orbit.yaw
    orbitPitch = orbit.pitch
    publishCameraState()
    setViewChanged(true)
  }
  const onPointerUp = (event: PointerEvent): void => {
    if (disposed || contextLost || !foreground) {
      gestures.cancel(event.pointerId)
      if (renderer.domElement.hasPointerCapture(event.pointerId))
        renderer.domElement.releasePointerCapture(event.pointerId)
      return
    }
    const result = gestures.up(sample(event))
    if (renderer.domElement.hasPointerCapture(event.pointerId))
      renderer.domElement.releasePointerCapture(event.pointerId)
    if (result === undefined || models === undefined) return
    const bounds = renderer.domElement.getBoundingClientRect()
    pointer.set(
      ((result.clientX - bounds.left) / Math.max(1, bounds.width)) * 2 - 1,
      -((result.clientY - bounds.top) / Math.max(1, bounds.height)) * 2 + 1,
    )
    raycaster.setFromCamera(pointer, camera)
    const hit = raycaster.intersectObjects(
      [...models.selectableRoots.values()],
      true,
    )[0]
    const stageId = stageIdFromHit(hit?.object ?? null)
    if (stageId !== undefined) options.onSelect(stageId)
  }
  const onPointerCancel = (event: PointerEvent): void => {
    gestures.cancel(event.pointerId)
    if (renderer.domElement.hasPointerCapture(event.pointerId))
      renderer.domElement.releasePointerCapture(event.pointerId)
  }
  const onLostPointerCapture = (event: PointerEvent): void => {
    gestures.cancel(event.pointerId)
  }
  const onWheel = (event: WheelEvent): void => {
    if (disposed || contextLost || !foreground) return
    const delta = journeyWheelZoomDelta(
      event.deltaY,
      event.deltaMode,
      container.clientHeight,
    )
    if (delta === 0) return
    event.preventDefault()
    setInspectionZoom(inspectionZoom + delta)
  }
  renderer.domElement.addEventListener('pointerdown', onPointerDown)
  onConstructionFailure(() =>
    renderer.domElement.removeEventListener('pointerdown', onPointerDown),
  )
  renderer.domElement.addEventListener('pointermove', onPointerMove)
  onConstructionFailure(() =>
    renderer.domElement.removeEventListener('pointermove', onPointerMove),
  )
  renderer.domElement.addEventListener('pointerup', onPointerUp)
  onConstructionFailure(() =>
    renderer.domElement.removeEventListener('pointerup', onPointerUp),
  )
  renderer.domElement.addEventListener('pointercancel', onPointerCancel)
  onConstructionFailure(() =>
    renderer.domElement.removeEventListener('pointercancel', onPointerCancel),
  )
  renderer.domElement.addEventListener(
    'lostpointercapture',
    onLostPointerCapture,
  )
  onConstructionFailure(() =>
    renderer.domElement.removeEventListener(
      'lostpointercapture',
      onLostPointerCapture,
    ),
  )
  renderer.domElement.addEventListener('wheel', onWheel, { passive: false })
  onConstructionFailure(() =>
    renderer.domElement.removeEventListener('wheel', onWheel),
  )

  function failGraphics(error: Error): void {
    if (disposed || contextLost) return
    contextLost = true
    abort.abort()
    loop.setForeground(false)
    gestures.reset()
    setViewChanged(false)
    options.onProjectStageLabels?.([])
    progressDisplay?.dispose()
    progressDisplay = undefined
    delete renderer.domElement.dataset.journeyProgress
    failProjection(error)
    options.onFailure(error)
  }
  const onContextLost = (event: Event): void => {
    event.preventDefault()
    failGraphics(new Error('The floating museum lost its graphics context.'))
  }
  renderer.domElement.addEventListener('webglcontextlost', onContextLost)
  onConstructionFailure(() =>
    renderer.domElement.removeEventListener('webglcontextlost', onContextLost),
  )

  container.append(renderer.domElement)
  loop.setForeground(foreground)

  const modelsReady = loadJourneyMapModels(
    definition,
    mapUrl,
    mercUrl,
    abort.signal,
    {
      sculptureUrl,
      architectureUrl,
      mysteryPortraitUrl,
      marbleTextureUrls,
    },
  )
  const environmentReady = environment
    .load(environmentUrl, () => disposed || contextLost)
    .catch(() => undefined)
  const acceptedModels = acceptJourneyResource(
    modelsReady,
    () => (contextLost ? 'failed' : disposed ? 'disposed' : 'active'),
    (loaded) => {
      const display = createJourneyProgressDisplay(definition, loaded, {
        onChange(snapshot) {
          if (!disposed && !contextLost)
            renderer.domElement.dataset.journeyProgress =
              JSON.stringify(snapshot)
        },
      })
      try {
        models = loaded
        progressDisplay = display
        scene.add(loaded.root)
        display.setProgress(latestProgress)
        updateDesiredView(true)
      } catch (error) {
        models = undefined
        progressDisplay = undefined
        display.dispose()
        loaded.dispose()
        throw error
      }
    },
  )
  const ready = Promise.all([
    acceptedModels,
    environmentReady,
    sky.ready,
    firstModelProjection,
  ]).then(() => {
    if (contextLost)
      throw new Error('The floating museum lost its graphics context.')
  })

  return {
    ready,
    setSelected(stageId) {
      if (
        disposed ||
        contextLost ||
        !definition.stages.some((stage) => stage.id === stageId)
      )
        return
      selectedStageId = stageId
      updateDesiredView()
    },
    setProgress(progress) {
      if (disposed || contextLost) return
      latestProgress = normalizeProgress(definition, progress)
      progressDisplay?.setProgress(latestProgress)
    },
    setForeground(next) {
      if (disposed || contextLost || foreground === next) return
      foreground = next
      if (!next) gestures.reset()
      if (!next) options.onProjectStageLabels?.([])
      loop.setForeground(next && !contextLost)
    },
    setReducedMotion(next) {
      if (disposed || contextLost || reducedMotion === next) return
      reducedMotion = next
      water.setReducedMotion(next)
      updateDesiredView(next)
    },
    resetView() {
      if (disposed || contextLost) return
      inspectionZoom = 0
      orbitYaw = JOURNEY_DEFAULT_ORBIT.yaw
      orbitPitch = JOURNEY_DEFAULT_ORBIT.pitch
      // Retire the moving DOM hit targets until the first frame at the exact
      // approved composition republishes them.
      options.onProjectStageLabels?.([])
      updateDesiredView(true)
      publishCameraState()
      setViewChanged(false)
    },
    getMetrics() {
      return collectMetrics()
    },
    dispose() {
      if (disposed) return
      disposed = true
      failProjection(new DOMException('Journey scene disposed.', 'AbortError'))
      options.onProjectStageLabels?.([])
      abort.abort()
      loop.dispose()
      observer.disconnect()
      gestures.reset()
      renderer.domElement.removeEventListener('pointerdown', onPointerDown)
      renderer.domElement.removeEventListener('pointermove', onPointerMove)
      renderer.domElement.removeEventListener('pointerup', onPointerUp)
      renderer.domElement.removeEventListener('pointercancel', onPointerCancel)
      renderer.domElement.removeEventListener(
        'lostpointercapture',
        onLostPointerCapture,
      )
      renderer.domElement.removeEventListener('wheel', onWheel)
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost)
      progressDisplay?.dispose()
      progressDisplay = undefined
      models?.dispose()
      water.dispose()
      environment.dispose()
      sky.dispose()
      disposeObject(scene)
      sun.shadow.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
      renderer.domElement.remove()
      void ready.catch(() => undefined)
    },
  }
}
