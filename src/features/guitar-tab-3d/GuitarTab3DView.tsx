// ============================================================
// GuitarTab3DView — 3D-style falling-notes guitar tab playback
// ============================================================
//
// A drop-in alternate renderer for the same falling-notes data the 2D "hero"
// view uses (guitar.fallingNotes + guitar.playheadBeat). Notes descend from a
// vanishing point onto an actual neck (fretboard) at the hit line. Backend is
// chosen by createTabRenderer (Canvas2D today, WebGPU later) behind the
// TabRenderer interface.

import type { Accessor } from 'solid-js'
import { createEffect, createSignal, createUniqueId, on, onCleanup, onMount, Show, } from 'solid-js'
import type { GuitarNote } from '@/lib/guitar/guitar-synth'
import styles from './GuitarTab3DView.module.css'
import { buildTabScene } from './renderer/build-tab-scene'
import type { CameraState } from './renderer/camera'
import { cameraBasis, clampCamera, DEFAULT_CAMERA, PITCH_MAX, } from './renderer/camera'
import type { TabPresentation, TabRenderer, TabScene, } from './renderer/TabRenderer'
import { createTabRenderer, DEFAULT_DISPLAY } from './renderer/TabRenderer'
import { NavGizmo } from './ui/NavGizmo'
import type { Tab3DControls } from './ui/Tab3DHud'
import { Tab3DHud } from './ui/Tab3DHud'
import { Tab3DInputMonitor } from './ui/Tab3DInputMonitor'

const ORBIT_SENS = 0.008 // radians per pixel dragged
const ZOOM_SENS = 0.0012 // per wheel delta unit
const KEYBOARD_CAMERA_STEP = 24
const KEYBOARD_ZOOM_STEP = 180

export interface GuitarTab3DViewProps {
  fallingNotes: Accessor<readonly GuitarNote[]>
  playheadBeat: Accessor<number>
  visibleBeatWindow: Accessor<number>
  showNoteLabels: Accessor<boolean>
  /** Draw the neck (fretboard) at the hit line. */
  showFretboard: Accessor<boolean>
  /** Only animate while the guitar tab is the active view. */
  isActive: Accessor<boolean>
  /** Playback/display controls; when provided, renders the HUD overlay. */
  controls?: Tab3DControls
  /** Surface-owned display settings; legacy Guitar defaults remain unchanged. */
  display?: Accessor<TabScene['display']>
  /** Change only the spatial projection; the renderer and camera stay mounted. */
  presentation?: Accessor<TabPresentation>
  /** Override the legacy navigation gizmo without requiring the legacy HUD. */
  showGizmo?: Accessor<boolean>
  /** Accessible canvas name and fallback summary owned by the host surface. */
  ariaLabel?: Accessor<string>
  fallbackText?: Accessor<string>
  /** Host-owned edge treatment; the legacy stage keeps its rounded default. */
  borderRadius?: Accessor<string>
  /** Host-owned starting/reset framing; absent preserves the legacy camera. */
  cameraPreset?: Accessor<CameraState>
  /** Phrase-following may update the preset until the player moves the camera. */
  cameraAutoFollow?: Accessor<boolean>
  /** Host-resolved accessibility policy; absent follows the operating system. */
  reducedMotion?: Accessor<boolean>
  /** Host-resolved rendering policy used to cap the canvas pixel budget. */
  reducedEffects?: Accessor<boolean>
  /** The instrument the notes sit on. Absent leaves the neck inferred. */
  tuning?: Accessor<{
    stringCount: number
    openMidi: readonly number[]
    capo?: number
  }>
}

export function GuitarTab3DView(props: GuitarTab3DViewProps) {
  let canvas: HTMLCanvasElement | undefined
  let renderer: TabRenderer | null = null
  let rafId = 0
  const cameraInstructionsId = createUniqueId()
  const homeCamera = (): CameraState =>
    clampCamera(props.cameraPreset?.() ?? DEFAULT_CAMERA)
  const [camera, setCamera] = createSignal<CameraState>(homeCamera())
  const [interactive, setInteractive] = createSignal(false)
  const [systemReducedMotion, setSystemReducedMotion] = createSignal(false)
  const [followSuspended, setFollowSuspended] = createSignal(false)
  const shouldReduceMotion = () =>
    props.reducedMotion?.() ?? systemReducedMotion()
  let requestPaint = () => undefined

  // A direct manipulation (drag/wheel/pinch) cancels any in-flight tween so
  // the camera never fights the user's hand.
  let tweenRaf = 0
  let pendingCameraPreset: CameraState | null = null
  const cancelTween = () => {
    if (tweenRaf !== 0) cancelAnimationFrame(tweenRaf)
    tweenRaf = 0
  }
  const animateCamera = (to: CameraState, ms = 280) => {
    cancelTween()
    if (!props.isActive()) return
    const destination = clampCamera(to)
    if (shouldReduceMotion()) {
      setCamera(destination)
      return
    }
    const from = camera()
    const t0 = performance.now()
    const lerp = (a: number, b: number, k: number) => a + (b - a) * k
    const step = (now: number) => {
      if (!props.isActive()) {
        tweenRaf = 0
        return
      }
      const t = Math.min(1, (now - t0) / ms)
      const k = 1 - (1 - t) ** 3 // ease-out cubic
      setCamera(
        clampCamera({
          yaw: lerp(from.yaw, destination.yaw, k),
          pitch: lerp(from.pitch, destination.pitch, k),
          radius: lerp(from.radius, destination.radius, k),
          target: [
            lerp(from.target[0], destination.target[0], k),
            lerp(from.target[1], destination.target[1], k),
            lerp(from.target[2], destination.target[2], k),
          ],
        }),
      )
      tweenRaf = t < 1 ? requestAnimationFrame(step) : 0
    }
    tweenRaf = requestAnimationFrame(step)
  }
  onCleanup(cancelTween)

  const suspendFollowing = () => {
    cancelTween()
    setFollowSuspended(true)
  }

  const orbit = (dx: number, dy: number) => {
    suspendFollowing()
    setCamera((c) =>
      clampCamera({
        ...c,
        yaw: c.yaw - dx * ORBIT_SENS,
        pitch: c.pitch - dy * ORBIT_SENS,
      }),
    )
  }
  const zoom = (deltaY: number) => {
    suspendFollowing()
    setCamera((c) =>
      clampCamera({ ...c, radius: c.radius * Math.exp(deltaY * ZOOM_SENS) }),
    )
  }
  // Pinch zoom: multiply the orbit radius directly by a ratio (fingers
  // spreading apart → factor < 1 → camera moves closer).
  const zoomBy = (factor: number) => {
    suspendFollowing()
    setCamera((c) => clampCamera({ ...c, radius: c.radius * factor }))
  }
  const pan = (dx: number, dy: number) => {
    suspendFollowing()
    setCamera((c) => {
      const { right, up } = cameraBasis(c)
      const s = c.radius * 0.0016
      return clampCamera({
        ...c,
        target: [
          c.target[0] - right[0] * dx * s + up[0] * dy * s,
          c.target[1] - right[1] * dx * s + up[1] * dy * s,
          c.target[2] - right[2] * dx * s + up[2] * dy * s,
        ],
      })
    })
  }
  // Yaw accumulates unbounded across orbits/flips; tween to the nearest
  // equivalent of the default yaw so Reset glides instead of whirling back
  // through every accumulated revolution.
  const resetCamera = () => {
    setFollowSuspended(false)
    const c = camera()
    const home = homeCamera()
    animateCamera({
      ...home,
      yaw: c.yaw + yawDelta(home.yaw, c.yaw),
    })
  }

  /** Signed shortest angular distance from b to a, in (-π, π]. */
  const yawDelta = (a: number, b: number) =>
    Math.atan2(Math.sin(a - b), Math.cos(a - b))

  const applyCameraPreset = (preset: CameraState) => {
    const current = camera()
    const next = clampCamera(preset)
    animateCamera({
      ...next,
      yaw: current.yaw + yawDelta(next.yaw, current.yaw),
    })
  }

  createEffect(
    on(
      () => props.cameraPreset?.(),
      (preset) => {
        if (preset === undefined) return
        if (props.cameraAutoFollow?.() === true && followSuspended()) return
        if (!props.isActive()) {
          pendingCameraPreset = preset
          cancelTween()
          return
        }
        pendingCameraPreset = null
        applyCameraPreset(preset)
      },
      { defer: true },
    ),
  )

  createEffect(
    on(
      () => props.isActive(),
      (active) => {
        if (!active) {
          cancelTween()
          return
        }
        const pending = pendingCameraPreset
        pendingCameraPreset = null
        if (pending !== null) applyCameraPreset(pending)
        requestPaint()
      },
      { defer: true },
    ),
  )

  // Snap the camera to look along a world axis (gizmo axis-ball click).
  // X/Z pick the nearest side first; clicking the axis you already face flips
  // to the opposite side. Y goes to the top-down view (pitch is clamped so the
  // camera can never flip under the scene).
  const snapToAxis = (axis: 'X' | 'Y' | 'Z') => {
    suspendFollowing()
    const c = camera()
    if (axis === 'Y') {
      animateCamera({ ...c, pitch: PITCH_MAX })
      return
    }
    const base = axis === 'X' ? Math.PI / 2 : 0
    const nearest =
      Math.abs(yawDelta(c.yaw, base)) <= Math.PI / 2 ? base : base + Math.PI
    const alreadyThere =
      Math.abs(yawDelta(c.yaw, nearest)) < 0.02 && Math.abs(c.pitch) < 0.02
    const targetYaw = alreadyThere ? nearest + Math.PI : nearest
    // Travel the shortest arc from the current yaw instead of jumping wraps.
    animateCamera({ ...c, yaw: c.yaw + yawDelta(targetYaw, c.yaw), pitch: 0 })
  }

  const handleCameraKeyDown = (event: KeyboardEvent) => {
    if (
      event.target !== event.currentTarget ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey
    ) {
      return
    }

    let handled = true
    switch (event.key) {
      case 'ArrowLeft':
        if (event.shiftKey) pan(-KEYBOARD_CAMERA_STEP, 0)
        else orbit(-KEYBOARD_CAMERA_STEP, 0)
        break
      case 'ArrowRight':
        if (event.shiftKey) pan(KEYBOARD_CAMERA_STEP, 0)
        else orbit(KEYBOARD_CAMERA_STEP, 0)
        break
      case 'ArrowUp':
        if (event.shiftKey) pan(0, -KEYBOARD_CAMERA_STEP)
        else orbit(0, -KEYBOARD_CAMERA_STEP)
        break
      case 'ArrowDown':
        if (event.shiftKey) pan(0, KEYBOARD_CAMERA_STEP)
        else orbit(0, KEYBOARD_CAMERA_STEP)
        break
      case '+':
      case '=':
      case 'Add':
        zoom(-KEYBOARD_ZOOM_STEP)
        break
      case '-':
      case '_':
      case 'Subtract':
        zoom(KEYBOARD_ZOOM_STEP)
        break
      case 'Home':
      case '0':
      case 'r':
      case 'R':
        resetCamera()
        break
      default:
        handled = false
    }

    if (!handled) return
    event.preventDefault()
    event.stopPropagation()
  }

  const buildScene = (): TabScene => {
    const ctrls = props.controls
    const requestedDisplay = props.display?.() ?? DEFAULT_DISPLAY
    const display =
      shouldReduceMotion() || props.reducedEffects?.() === true
        ? {
            ...requestedDisplay,
            motion: shouldReduceMotion()
              ? ('reduced' as const)
              : requestedDisplay.motion,
            effects:
              props.reducedEffects?.() === true
                ? ('reduced' as const)
                : requestedDisplay.effects,
          }
        : requestedDisplay
    return buildTabScene({
      notes: props.fallingNotes(),
      playheadBeat: props.playheadBeat(),
      visibleBeatWindow: props.visibleBeatWindow(),
      showNoteLabels: props.showNoteLabels(),
      showFretboard: props.showFretboard(),
      display,
      presentation: props.presentation?.(),
      tuning: props.tuning?.(),
      feedback:
        ctrls === undefined
          ? undefined
          : {
              hitResults: ctrls.hitResults(),
              detectedMidi: ctrls.detectedMidi(),
              detectedClarity: ctrls.detectedClarity(),
              showUserNotes: ctrls.showUserNotes(),
            },
    })
  }

  onMount(() => {
    if (canvas === undefined) return
    const hw = canvas
    let motionQuery: MediaQueryList | null = null
    if (
      props.reducedMotion === undefined &&
      typeof window.matchMedia === 'function'
    ) {
      motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
      const syncMotion = () =>
        setSystemReducedMotion(motionQuery?.matches ?? false)
      syncMotion()
      motionQuery.addEventListener?.('change', syncMotion)
      onCleanup(() => motionQuery?.removeEventListener?.('change', syncMotion))
    }
    const r = createTabRenderer()
    renderer = r
    void r.mount(hw)

    let lastW = 0
    let lastH = 0
    let lastDpr = 0
    let lastCamera: CameraState | null = null
    let resizeObserver: ResizeObserver | null = null
    const effectiveDpr = () =>
      Math.min(
        props.reducedEffects?.() === true ||
          props.display?.().effects === 'reduced'
          ? 1.5
          : 2,
        Math.max(1, window.devicePixelRatio || 1),
      )
    const resize = (width: number, height: number) => {
      if (width <= 0 || height <= 0) return
      const dpr = effectiveDpr()
      if (width === lastW && height === lastH && dpr === lastDpr) return
      lastW = width
      lastH = height
      lastDpr = dpr
      r.resize(width, height, dpr)
      requestPaint()
    }
    const renderFrame = () => {
      rafId = 0
      if (!props.isActive()) return
      const nextCamera = camera()
      if (lastCamera !== nextCamera) {
        r.setCamera(nextCamera)
        lastCamera = nextCamera
      }
      const scene = buildScene()
      r.render(scene)
      if (
        scene.display.motion !== 'reduced' &&
        (scene.hits.length > 0 || scene.detected !== null)
      ) {
        requestPaint()
      }
    }

    requestPaint = () => {
      if (!props.isActive() || rafId !== 0) return
      rafId = requestAnimationFrame(renderFrame)
    }

    const initialBounds = hw.getBoundingClientRect()
    resize(initialBounds.width, initialBounds.height)
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver((entries) => {
        const entry = entries[0]
        if (entry === undefined) return
        resize(entry.contentRect.width, entry.contentRect.height)
      })
      resizeObserver.observe(hw)
    } else {
      const resizeFromBounds = () => {
        const bounds = hw.getBoundingClientRect()
        resize(bounds.width, bounds.height)
      }
      window.addEventListener('resize', resizeFromBounds)
      onCleanup(() => window.removeEventListener('resize', resizeFromBounds))
    }

    // Paint once immediately so the view isn't blank before the first rAF.
    requestPaint()

    // Solid invalidates the canvas only when musical, display, feedback, or
    // camera state changes. Playback still paints at its source cadence, while
    // a paused room consumes no permanent animation loop.
    createEffect(() => {
      if (!props.isActive()) {
        if (rafId !== 0) cancelAnimationFrame(rafId)
        rafId = 0
        return
      }
      props.fallingNotes()
      props.playheadBeat()
      props.visibleBeatWindow()
      props.showNoteLabels()
      props.showFretboard()
      props.display?.()
      props.reducedMotion?.()
      props.reducedEffects?.()
      systemReducedMotion()
      props.presentation?.()
      props.tuning?.()
      props.controls?.hitResults()
      props.controls?.detectedMidi()
      props.controls?.detectedClarity()
      props.controls?.showUserNotes()
      camera()
      if (lastW > 0 && lastH > 0) resize(lastW, lastH)
      requestPaint()
    })

    // Direct camera control on the canvas. Pointer Events unify mouse, touch
    // and pen:
    //   • one pointer  → drag to orbit (shift / right-drag pans, mouse only)
    //   • two pointers → pinch to zoom and drag to pan (touch gestures)
    //   • wheel        → zoom (mirrors the corner gizmo)
    const pointers = new Map<number, { x: number; y: number }>()
    let dragMode: 'orbit' | 'pan' | null = null
    let lastX = 0
    let lastY = 0
    // Two-finger gesture baseline (distance + centroid) carried between moves.
    let pinchDist = 0
    let pinchCx = 0
    let pinchCy = 0

    const beginPinch = () => {
      const [a, b] = [...pointers.values()]
      if (a === undefined || b === undefined) return
      pinchDist = Math.hypot(a.x - b.x, a.y - b.y)
      pinchCx = (a.x + b.x) / 2
      pinchCy = (a.y + b.y) / 2
    }

    const onPointerDown = (e: PointerEvent) => {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
      try {
        hw.setPointerCapture(e.pointerId)
      } catch {
        // Some browser/device pairs reject capture while still delivering the drag.
      }
      e.preventDefault()
      if (pointers.size === 1) {
        dragMode = e.button === 2 || e.shiftKey ? 'pan' : 'orbit'
        lastX = e.clientX
        lastY = e.clientY
      } else if (pointers.size === 2) {
        // A second finger switches from orbit to pinch-zoom / two-finger pan.
        dragMode = null
        beginPinch()
      }
    }
    const onPointerMove = (e: PointerEvent) => {
      if (!pointers.has(e.pointerId)) return
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (pointers.size >= 2) {
        const [a, b] = [...pointers.values()]
        if (a === undefined || b === undefined) return
        const dist = Math.hypot(a.x - b.x, a.y - b.y)
        const cx = (a.x + b.x) / 2
        const cy = (a.y + b.y) / 2
        if (pinchDist > 0 && dist > 0) zoomBy(pinchDist / dist)
        pan(cx - pinchCx, cy - pinchCy)
        pinchDist = dist
        pinchCx = cx
        pinchCy = cy
        return
      }
      if (dragMode === null) return
      const dx = e.clientX - lastX
      const dy = e.clientY - lastY
      lastX = e.clientX
      lastY = e.clientY
      if (dragMode === 'pan') pan(dx, dy)
      else orbit(dx, dy)
    }
    const onPointerUp = (e: PointerEvent) => {
      pointers.delete(e.pointerId)
      try {
        hw.releasePointerCapture?.(e.pointerId)
      } catch {
        // A cancelled or uncaptured pointer is already safe to forget.
      }
      if (pointers.size === 1) {
        // Dropped back to one finger: resume orbiting from its position.
        const [p] = [...pointers.values()]
        if (p !== undefined) {
          lastX = p.x
          lastY = p.y
        }
        dragMode = 'orbit'
      } else if (pointers.size >= 2) {
        beginPinch()
      } else {
        dragMode = null
      }
    }
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      zoom(e.deltaY)
    }
    const onContextMenu = (e: Event) => e.preventDefault()
    hw.addEventListener('pointerdown', onPointerDown)
    hw.addEventListener('pointermove', onPointerMove)
    hw.addEventListener('pointerup', onPointerUp)
    hw.addEventListener('pointercancel', onPointerUp)
    hw.addEventListener('wheel', onWheel, { passive: false })
    hw.addEventListener('contextmenu', onContextMenu)
    setInteractive(true)

    onCleanup(() => {
      setInteractive(false)
      resizeObserver?.disconnect()
      hw.removeEventListener('pointerdown', onPointerDown)
      hw.removeEventListener('pointermove', onPointerMove)
      hw.removeEventListener('pointerup', onPointerUp)
      hw.removeEventListener('pointercancel', onPointerUp)
      hw.removeEventListener('wheel', onWheel)
      hw.removeEventListener('contextmenu', onContextMenu)
    })
  })

  onCleanup(() => {
    if (rafId !== 0) cancelAnimationFrame(rafId)
    renderer?.dispose()
    renderer = null
  })

  return (
    <div
      class={`gp-tab3d-container ${styles.keyboardViewport}`}
      role="group"
      aria-label="3D performance view controls"
      aria-roledescription="interactive performance view"
      aria-describedby={cameraInstructionsId}
      tabIndex={0}
      onKeyDown={handleCameraKeyDown}
      style={{
        position: 'relative',
        width: '100%',
        // Fill the available area; the parent (#guitar-fretboard-container)
        // is flex:1, so the canvas scales with the window.
        height: '100%',
        'min-height': '0',
        'border-radius': props.borderRadius?.() ?? '12px',
        overflow: 'hidden',
      }}
    >
      <span id={cameraInstructionsId} class={styles.visuallyHidden}>
        Use the arrow keys to orbit the view, Shift plus the arrow keys to pan,
        plus or minus to zoom, and R, zero, or Home to reset it.
      </span>
      <canvas
        ref={canvas}
        role="img"
        aria-label={props.ariaLabel?.() ?? 'Interactive guitar tab fretboard'}
        data-camera-ready={interactive()}
        data-tab-presentation={props.presentation?.() ?? 'fret-axis'}
        data-camera-yaw={camera().yaw.toFixed(4)}
        data-camera-radius={camera().radius.toFixed(4)}
        data-camera-target-x={camera().target[0].toFixed(4)}
        data-camera-following={
          props.cameraAutoFollow?.() === true && !followSuspended()
        }
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
          cursor: 'grab',
          'touch-action': 'none',
        }}
      >
        {props.fallbackText?.() ??
          'An interactive guitar fretboard with notes approaching the play line.'}
      </canvas>
      <Show
        when={
          props.showGizmo?.() ??
          (props.controls === undefined || props.controls.showGizmo())
        }
      >
        <NavGizmo
          camera={camera}
          onOrbit={orbit}
          onPan={pan}
          onZoom={zoom}
          onReset={resetCamera}
          onSnapAxis={snapToAxis}
        />
      </Show>
      <Show when={props.controls}>
        {(controls) => <Tab3DHud controls={controls()} />}
      </Show>
      <Show
        when={
          props.controls?.showInputMonitor() === true ? props.controls : null
        }
      >
        {(controls) => (
          <Tab3DInputMonitor
            controls={controls()}
            fallingNotes={props.fallingNotes}
            playheadBeat={props.playheadBeat}
            songBpm={controls().songBpm}
          />
        )}
      </Show>
    </div>
  )
}
