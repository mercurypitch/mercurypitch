// Floating museum scene — one fallible WebGL map, frame clock and selection surface.

import type { Object3D } from 'three'
import { ACESFilmicToneMapping, AmbientLight, DirectionalLight, Fog, HemisphereLight, Mesh, MeshStandardMaterial, PerspectiveCamera, Raycaster, RingGeometry, Scene, SRGBColorSpace, Vector2, Vector3, WebGLRenderer, } from 'three'
import type { MuseumJourneyDefinition, MuseumJourneyStage, } from '../content/museum-journey'
import { disposeObject } from '../render/dispose'
import { createMuseumEnvironment } from '../render/environment'
import { createJourneyPointerTracker } from './interaction'
import { loadJourneyMapModels } from './models'
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
  setForeground(foreground: boolean): void
  setReducedMotion(reduced: boolean): void
  getMetrics(): MuseumJourneySceneMetrics
  dispose(): void
}

export interface MuseumJourneySceneOptions {
  selectedStageId: string
  foreground: boolean
  reducedMotion: boolean
  onSelect(stageId: string): void
  onFailure(error: unknown): void
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
  renderer.setPixelRatio(
    Math.min(
      window.devicePixelRatio || 1,
      window.matchMedia('(pointer: coarse)').matches ? 1.5 : 1.8,
    ),
  )
  renderer.domElement.style.cssText =
    'display:block;width:100%;height:100%;touch-action:none;'
  renderer.domElement.setAttribute(
    'aria-label',
    'Interactive floating museum map. Tap an island to select it, or use the gallery list below.',
  )
  renderer.domElement.setAttribute('role', 'img')

  const scene = new Scene()
  onConstructionFailure(() => disposeObject(scene))
  const sky = createJourneySky()
  onConstructionFailure(() => sky.dispose())
  scene.background = sky.background
  scene.fog = new Fog(0x87929a, 22, 44)
  scene.add(sky.root)
  scene.environmentIntensity = 0.58
  const environment = createMuseumEnvironment(renderer, scene)
  onConstructionFailure(() => environment.dispose())
  const camera = new PerspectiveCamera(36, 1, 0.1, 80)
  const raycaster = new Raycaster()
  const pointer = new Vector2()
  const target = new Vector3()
  const desiredTarget = new Vector3()
  let orbitYaw = 0.63
  let orbitPitch = 0.52
  let desiredDistance = 21
  let selectedStageId = stageById(definition, options.selectedStageId).id
  let reducedMotion = options.reducedMotion
  let foreground = options.foreground
  let disposed = false
  let contextLost = false
  let models: Awaited<ReturnType<typeof loadJourneyMapModels>> | undefined

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
  halo.position.fromArray(stageById(definition, selectedStageId).position)
  halo.position.y += 0.12
  scene.add(halo)

  const water = createJourneyWater(definition.spillways)
  onConstructionFailure(() => water.dispose())
  water.setReducedMotion(reducedMotion)
  scene.add(water.root)
  const abort = new AbortController()
  onConstructionFailure(() => abort.abort())
  let publishedMetrics = false

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
    const narrow = container.clientWidth < 640
    desiredTarget.fromArray(narrow ? stage.focus : [0.45, 0.35, -0.15])
    desiredDistance = narrow ? 10.8 : container.clientWidth < 900 ? 20.5 : 22
    halo.position.fromArray(stage.position)
    halo.position.y += 0.12
    models?.setSelected(stage, immediate || reducedMotion)
    if (immediate || reducedMotion) target.copy(desiredTarget)
  }
  updateDesiredView(true)

  function resize(): void {
    if (disposed) return
    const width = Math.max(1, container.clientWidth)
    const height = Math.max(1, container.clientHeight)
    renderer.setSize(width, height, false)
    camera.aspect = width / height
    camera.updateProjectionMatrix()
    updateDesiredView(reducedMotion)
  }
  resize()
  const observer = new ResizeObserver(resize)
  onConstructionFailure(() => observer.disconnect())
  observer.observe(container)

  function renderFrame(visibleSeconds: number, dt: number): void {
    if (disposed || contextLost) return
    if (reducedMotion) target.copy(desiredTarget)
    else target.lerp(desiredTarget, 1 - Math.exp(-3.8 * dt))
    const planar = Math.cos(orbitPitch) * desiredDistance
    camera.position.set(
      target.x + Math.sin(orbitYaw) * planar,
      target.y + Math.sin(orbitPitch) * desiredDistance,
      target.z + Math.cos(orbitYaw) * planar,
    )
    camera.lookAt(target)
    halo.rotation.z = reducedMotion ? 0 : visibleSeconds * 0.16
    water.update(visibleSeconds, dt)
    sky.update(visibleSeconds, dt, reducedMotion)
    models?.update(dt, reducedMotion)
    // With auto-reset disabled this single reset includes Three's shadow pass
    // in the same totals as the visible scene draw.
    renderer.info.reset()
    renderer.render(scene, camera)
    if (models !== undefined && !publishedMetrics) {
      publishedMetrics = true
      renderer.domElement.dataset.rendererMetrics =
        JSON.stringify(collectMetrics())
    }
  }
  const loop = createJourneyFrameLoop(renderFrame)
  onConstructionFailure(() => loop.dispose())

  const gestures = createJourneyPointerTracker()
  const sample = (event: PointerEvent) => ({
    pointerId: event.pointerId,
    clientX: event.clientX,
    clientY: event.clientY,
  })
  const onPointerDown = (event: PointerEvent): void => {
    if (disposed || !foreground) return
    gestures.down(sample(event))
    renderer.domElement.setPointerCapture(event.pointerId)
  }
  const onPointerMove = (event: PointerEvent): void => {
    const move = gestures.move(sample(event))
    if (move?.kind !== 'drag') return
    orbitYaw -= move.dx * 0.005
    orbitPitch = Math.max(0.3, Math.min(0.73, orbitPitch + move.dy * 0.004))
  }
  const onPointerUp = (event: PointerEvent): void => {
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

  const onContextLost = (event: Event): void => {
    event.preventDefault()
    if (disposed || contextLost) return
    contextLost = true
    loop.setForeground(false)
    options.onFailure(
      new Error('The floating museum lost its graphics context.'),
    )
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
  )
  const environmentReady = environment
    .load(environmentUrl, () => disposed || contextLost)
    .catch(() => undefined)
  const acceptedModels = acceptJourneyResource(
    modelsReady,
    () => (contextLost ? 'failed' : disposed ? 'disposed' : 'active'),
    (loaded) => {
      models = loaded
      scene.add(loaded.root)
      updateDesiredView(true)
    },
  )
  const ready = Promise.all([acceptedModels, environmentReady]).then(() => {
    if (contextLost)
      throw new Error('The floating museum lost its graphics context.')
  })

  return {
    ready,
    setSelected(stageId) {
      if (disposed || !definition.stages.some((stage) => stage.id === stageId))
        return
      selectedStageId = stageId
      updateDesiredView()
    },
    setForeground(next) {
      if (disposed || foreground === next) return
      foreground = next
      if (!next) gestures.reset()
      loop.setForeground(next && !contextLost)
    },
    setReducedMotion(next) {
      if (disposed || reducedMotion === next) return
      reducedMotion = next
      water.setReducedMotion(next)
      updateDesiredView(next)
    },
    getMetrics() {
      return collectMetrics()
    },
    dispose() {
      if (disposed) return
      disposed = true
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
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost)
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
