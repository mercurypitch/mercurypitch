// ============================================================
// Loading Merc — an isolated, optional 3D preview with a finite lifecycle.
// ============================================================

import type { AnimationAction, AnimationClip, Object3D, SkinnedMesh, WebGLRenderTarget, } from 'three'
import { ACESFilmicToneMapping, AnimationMixer, Box3, CircleGeometry, DirectionalLight, Group, HemisphereLight, LoopOnce, LoopRepeat, Mesh, MeshBasicMaterial, PerspectiveCamera, PMREMGenerator, Scene, SRGBColorSpace, Vector3, WebGLRenderer, } from 'three'
import { disposeObject } from './dispose'
import { createReflectionTexture } from './materials'
import type { MercModelAsset } from './merc-model'
import { loadMercModel } from './merc-model'

export type LoadingMercPhase =
  | 'loading-assets'
  | 'awaiting-first-frame'
  | 'error'

export interface LoadingMercState {
  readonly phase: LoadingMercPhase
  readonly completedUnits: number
  readonly totalUnits: number
}

export interface LoadingMercOptions {
  readonly modelUrl: string
  readonly reducedMotion: boolean
  readonly onFirstFrame: () => void
  readonly onError: (error: unknown) => void
}

export interface LoadingMercController {
  setState(state: LoadingMercState): void
  setReducedMotion(reduced: boolean): void
  dispose(): void
}

const MAXIMUM_FRAME_DELTA_SECONDS = 0.05
const MAXIMUM_DEVICE_PIXEL_RATIO = 1.5
const PRESENTATION_HEIGHT = 1.7
const PRESENTATION_GROUND_Y = -0.82
const PREVIEW_CLIP_NAMES = new Set(['welcome', 'listen', 'laugh'])

function updateSkinnedBounds(root: Object3D, target: Box3): void {
  root.updateMatrixWorld(true)
  root.traverse((object) => {
    if ((object as SkinnedMesh).isSkinnedMesh === true)
      (object as SkinnedMesh).computeBoundingBox()
  })
  target.union(new Box3().setFromObject(root))
}

/** Samples only clips the loading preview can play, including skinned hands. */
export function measureMercPreviewBounds(
  root: Object3D,
  animations: readonly AnimationClip[],
): Box3 {
  const measured = new Box3()
  updateSkinnedBounds(root, measured)
  const previewClips = animations.filter((clip) =>
    PREVIEW_CLIP_NAMES.has(clip.name.toLowerCase()),
  )
  if (previewClips.length === 0) return measured

  const mixer = new AnimationMixer(root)
  try {
    for (const clip of previewClips) {
      const action = mixer.clipAction(clip).reset().setLoop(LoopOnce, 1).play()
      const times = clip.tracks[0]?.times
      const sampleTimes =
        times === undefined || times.length === 0 ? [0, clip.duration] : times
      for (const time of sampleTimes) {
        action.time = Math.max(0, Math.min(clip.duration, Number(time)))
        mixer.update(0)
        updateSkinnedBounds(root, measured)
      }
      action.stop()
    }
  } finally {
    mixer.stopAllAction()
    mixer.uncacheRoot(root)
    root.updateMatrixWorld(true)
  }
  return measured
}

function createStudioEnvironment(renderer: WebGLRenderer): {
  target: WebGLRenderTarget
  root: Group
} {
  const source = createReflectionTexture()
  let generator: PMREMGenerator | undefined
  let target: WebGLRenderTarget
  try {
    generator = new PMREMGenerator(renderer)
    target = generator.fromEquirectangular(source)
  } finally {
    generator?.dispose()
    source.dispose()
  }
  try {
    const root = new Group()
    root.name = 'loading-merc-studio'
    const key = new DirectionalLight(0xffe7c4, 1.65)
    key.position.set(-2.2, 3.4, 3.3)
    const rim = new DirectionalLight(0x8ed2d2, 0.9)
    rim.position.set(2.6, 1.5, -1.8)
    root.add(new HemisphereLight(0xfff8e8, 0x345c66, 1.2), key, rim)
    const grounding = new Mesh(
      new CircleGeometry(0.74, 48),
      new MeshBasicMaterial({
        color: 0x1d5556,
        transparent: true,
        opacity: 0.12,
        depthWrite: false,
      }),
    )
    grounding.name = 'loading-merc-grounding'
    grounding.rotation.x = -Math.PI / 2
    grounding.position.y = PRESENTATION_GROUND_Y - 0.003
    grounding.scale.y = 0.52
    root.add(grounding)
    return { target, root }
  } catch (error) {
    target.dispose()
    throw error
  }
}

function finiteUnit(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0
}

/**
 * Creates a self-contained preview. Readiness and failure callbacks describe
 * this optional canvas only; game loading never waits for it.
 */
export function createLoadingMerc(
  canvas: HTMLCanvasElement,
  options: LoadingMercOptions,
): LoadingMercController {
  const scene = new Scene()
  const camera = new PerspectiveCamera(29, 1, 0.05, 24)
  const presentation = new Group()
  presentation.name = 'loading-merc-presentation'
  scene.add(presentation)

  let renderer: WebGLRenderer | undefined
  let environment: ReturnType<typeof createStudioEnvironment> | undefined
  let observer: ResizeObserver | undefined
  let asset: MercModelAsset | undefined
  let mixer: AnimationMixer | undefined
  let currentAction: AnimationAction | undefined
  let currentClip = ''
  let onceClip: 'welcome' | 'laugh' | undefined
  let onceRemaining = 0
  let animationBounds: Box3 | undefined
  let raf = 0
  let previousTimestamp: number | undefined
  let disposed = false
  let contextLost = false
  let firstFrameRendered = false
  let welcomePlayed = false
  let laughPlayed = false
  let pendingLaugh = false
  let progressAtInstall = 0
  let reducedMotion = options.reducedMotion
  let state: LoadingMercState = {
    phase: 'loading-assets',
    completedUnits: 0,
    totalUnits: 0,
  }
  const abort = new AbortController()

  const isForeground = (): boolean => document.visibilityState !== 'hidden'
  const isAnimated = (): boolean =>
    asset !== undefined && !reducedMotion && state.phase !== 'error'

  const resize = (): void => {
    if (renderer === undefined || disposed) return
    const width = Math.max(1, canvas.clientWidth || canvas.width || 1)
    const height = Math.max(1, canvas.clientHeight || canvas.height || 1)
    const pixelRatio =
      typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1
    renderer.setPixelRatio(Math.min(MAXIMUM_DEVICE_PIXEL_RATIO, pixelRatio))
    renderer.setSize(width, height, false)
    camera.aspect = width / height
    camera.updateProjectionMatrix()
    if (animationBounds !== undefined) {
      const rawSize = animationBounds.getSize(new Vector3())
      const rawHeight = Math.max(rawSize.y, 0.001)
      const scale = PRESENTATION_HEIGHT / rawHeight
      const halfHeight = PRESENTATION_HEIGHT * 0.58
      const halfWidth = Math.max(0.35, rawSize.x * scale * 0.58)
      const verticalFov = (camera.fov * Math.PI) / 180
      const horizontalFov =
        2 * Math.atan(Math.tan(verticalFov / 2) * camera.aspect)
      const distance =
        Math.max(
          halfHeight / Math.tan(verticalFov / 2),
          halfWidth / Math.tan(horizontalFov / 2),
        ) +
        rawSize.z * scale * 0.35
      const yaw = 0.13
      camera.position.set(
        Math.sin(yaw) * distance,
        0.04,
        Math.cos(yaw) * distance,
      )
      camera.lookAt(0, 0, 0)
    }
  }

  const clip = (name: string): AnimationClip | undefined =>
    asset?.animations.find((candidate) => candidate.name.toLowerCase() === name)

  const play = (name: string, mode: 'loop' | 'once' | 'still'): boolean => {
    if (mixer === undefined) return false
    const nextClip = clip(name)
    if (nextClip === undefined) return false
    if (
      name === currentClip &&
      currentAction !== undefined &&
      mode !== 'still'
    ) {
      currentAction.timeScale = 1
      onceClip = mode === 'once' ? (name as 'welcome' | 'laugh') : undefined
      onceRemaining = mode === 'once' ? nextClip.duration : 0
      return true
    }
    const previous = currentAction
    if (mode === 'still') mixer.stopAllAction()
    const next = mixer
      .clipAction(nextClip)
      .reset()
      .setLoop(
        mode === 'once' ? LoopOnce : LoopRepeat,
        mode === 'once' ? 1 : Infinity,
      )
      .play()
    next.clampWhenFinished = mode === 'once'
    next.timeScale = mode === 'still' ? 0 : 1
    if (mode === 'still') mixer.update(0)
    else if (previous !== undefined) next.crossFadeFrom(previous, 0.14, false)
    currentAction = next
    currentClip = name
    onceClip = mode === 'once' ? (name as 'welcome' | 'laugh') : undefined
    onceRemaining = mode === 'once' ? nextClip.duration : 0
    return true
  }

  const playListen = (still = false): void => {
    if (!play('listen', still ? 'still' : 'loop')) {
      const fallback = asset?.animations[0]
      if (fallback !== undefined) play(fallback.name.toLowerCase(), 'still')
    }
  }

  const tryLaugh = (): boolean => {
    if (
      !pendingLaugh ||
      laughPlayed ||
      !firstFrameRendered ||
      reducedMotion ||
      state.phase !== 'loading-assets' ||
      onceClip === 'welcome'
    )
      return false
    pendingLaugh = false
    if (!play('laugh', 'once')) return false
    laughPlayed = true
    return true
  }

  const beginPresentation = (): void => {
    if (reducedMotion || state.phase === 'error') {
      playListen(true)
      return
    }
    if (state.phase === 'loading-assets' && !welcomePlayed) {
      welcomePlayed = play('welcome', 'once')
      if (welcomePlayed) return
    }
    playListen(false)
  }

  const finishOnce = (): void => {
    const finished = onceClip
    onceClip = undefined
    onceRemaining = 0
    if (finished === 'welcome' && tryLaugh()) return
    playListen(reducedMotion || state.phase === 'error')
  }

  const release = (): void => {
    if (disposed) return
    disposed = true
    abort.abort()
    if (raf !== 0) cancelAnimationFrame(raf)
    raf = 0
    previousTimestamp = undefined
    document.removeEventListener('visibilitychange', onVisibilityChange)
    canvas.removeEventListener('webglcontextlost', onContextLost)
    observer?.disconnect()
    observer = undefined
    mixer?.stopAllAction()
    if (asset !== undefined) {
      mixer?.uncacheRoot(asset.body)
      presentation.remove(asset.body)
      asset.dispose()
    }
    mixer = undefined
    asset = undefined
    if (environment !== undefined) {
      scene.environment = null
      environment.target.dispose()
      disposeObject(environment.root)
      environment = undefined
    }
    renderer?.dispose()
    renderer?.forceContextLoss()
    renderer = undefined
  }

  const fail = (error: unknown): void => {
    if (disposed) return
    release()
    try {
      options.onError(error)
    } catch {
      // An optional preview never lets a host callback disrupt game loading.
    }
  }

  const requestFrame = (): void => {
    if (disposed || contextLost || !isForeground() || raf !== 0) return
    raf = requestAnimationFrame(renderFrame)
  }

  function renderFrame(timestamp: number): void {
    raf = 0
    if (disposed || contextLost || !isForeground() || renderer === undefined)
      return
    const dt =
      previousTimestamp === undefined
        ? 0
        : Math.max(
            0,
            Math.min(
              MAXIMUM_FRAME_DELTA_SECONDS,
              (timestamp - previousTimestamp) / 1000,
            ),
          )
    previousTimestamp = timestamp
    if (mixer !== undefined) {
      const animationDt = reducedMotion || state.phase === 'error' ? 0 : dt
      mixer.update(animationDt)
      if (onceClip !== undefined && animationDt > 0) {
        onceRemaining -= animationDt
        if (onceRemaining <= 0) finishOnce()
      }
    }
    try {
      renderer.render(scene, camera)
    } catch (error) {
      fail(error)
      return
    }
    if (!firstFrameRendered && asset !== undefined) {
      firstFrameRendered = true
      try {
        options.onFirstFrame()
      } catch {
        // Host signalling cannot invalidate an otherwise healthy preview.
      }
      tryLaugh()
    }
    if (isAnimated()) requestFrame()
  }

  function onVisibilityChange(): void {
    if (disposed) return
    if (!isForeground()) {
      if (raf !== 0) cancelAnimationFrame(raf)
      raf = 0
      previousTimestamp = undefined
      return
    }
    requestFrame()
  }

  function onContextLost(event: Event): void {
    event.preventDefault()
    if (disposed || contextLost) return
    contextLost = true
    fail(new Error('Loading Merc WebGL context was lost'))
  }

  try {
    renderer = new WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: 'low-power',
    })
    renderer.outputColorSpace = SRGBColorSpace
    renderer.toneMapping = ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.02
    renderer.shadowMap.enabled = false
    renderer.setClearColor(0x000000, 0)
    environment = createStudioEnvironment(renderer)
    scene.environment = environment.target.texture
    scene.add(environment.root)
    resize()
    observer = new ResizeObserver(() => {
      resize()
      requestFrame()
    })
    observer.observe(canvas)
    document.addEventListener('visibilitychange', onVisibilityChange)
    canvas.addEventListener('webglcontextlost', onContextLost)
  } catch (error) {
    release()
    throw error
  }

  void loadMercModel(options.modelUrl, {
    castShadows: false,
    signal: abort.signal,
  })
    .then((loaded) => {
      if (disposed || contextLost) {
        loaded.dispose()
        return
      }
      asset = loaded
      animationBounds = measureMercPreviewBounds(loaded.body, loaded.animations)
      const center = animationBounds.getCenter(new Vector3())
      const size = animationBounds.getSize(new Vector3())
      const scale = PRESENTATION_HEIGHT / Math.max(size.y, 0.001)
      loaded.body.scale.setScalar(scale)
      loaded.body.position.set(
        -center.x * scale,
        PRESENTATION_GROUND_Y - animationBounds.min.y * scale,
        -center.z * scale,
      )
      presentation.add(loaded.body)
      mixer = new AnimationMixer(loaded.body)
      progressAtInstall = state.completedUnits
      beginPresentation()
      resize()
      requestFrame()
    })
    .catch((error: unknown) => {
      if (
        disposed ||
        (error instanceof DOMException && error.name === 'AbortError')
      )
        return
      fail(error)
    })

  return {
    setState(next) {
      if (disposed) return
      const totalUnits = finiteUnit(next.totalUnits)
      const completedUnits = Math.min(
        finiteUnit(next.completedUnits),
        totalUnits,
      )
      const previous = state
      state = { phase: next.phase, completedUnits, totalUnits }
      if (state.phase !== 'loading-assets') pendingLaugh = false
      else if (
        asset !== undefined &&
        completedUnits > previous.completedUnits &&
        completedUnits > progressAtInstall
      )
        pendingLaugh = true

      if (asset !== undefined) {
        if (state.phase === 'error') playListen(true)
        else if (state.phase === 'awaiting-first-frame' && onceClip === 'laugh')
          playListen(false)
        else if (previous.phase === 'error') beginPresentation()
        else tryLaugh()
        requestFrame()
      }
    },
    setReducedMotion(reduced) {
      if (disposed || reducedMotion === reduced) return
      reducedMotion = reduced
      if (reduced) {
        pendingLaugh = false
        playListen(true)
      } else beginPresentation()
      previousTimestamp = undefined
      requestFrame()
    },
    dispose: release,
  }
}
