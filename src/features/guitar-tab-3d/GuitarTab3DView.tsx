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
import { createSignal, onCleanup, onMount, Show } from 'solid-js'
import type { GuitarNote } from '@/lib/guitar/guitar-synth'
import { midiToNoteNameOctave } from '@/lib/note-utils'
import type { CameraState } from './renderer/camera'
import { cameraBasis, clampCamera, DEFAULT_CAMERA } from './renderer/camera'
import type { TabDetected, TabRenderer, TabScene } from './renderer/TabRenderer'
import { DEFAULT_DISPLAY } from './renderer/TabRenderer'
import { createTabRenderer } from './renderer/TabRenderer'
import { NavGizmo } from './ui/NavGizmo'
import type { Tab3DControls } from './ui/Tab3DHud'
import { Tab3DHud } from './ui/Tab3DHud'

const ORBIT_SENS = 0.008 // radians per pixel dragged
const ZOOM_SENS = 0.0012 // per wheel delta unit

/** Standard guitar; widened automatically if a tab uses more strings. */
const MIN_STRING_COUNT = 6
/** Fallback open-string tuning (high→low), extended for 7/8-string tabs. */
const DEFAULT_OPEN: readonly number[] = [64, 59, 55, 50, 45, 40, 35, 30]

export interface GuitarTab3DViewProps {
  fallingNotes: Accessor<GuitarNote[]>
  playheadBeat: Accessor<number>
  visibleBeatWindow: Accessor<number>
  showNoteLabels: Accessor<boolean>
  /** Draw the neck (fretboard) at the hit line. */
  showFretboard: Accessor<boolean>
  /** Only animate while the guitar tab is the active view. */
  isActive: Accessor<boolean>
  /** Playback/display controls; when provided, renders the HUD overlay. */
  controls?: Tab3DControls
}

export function GuitarTab3DView(props: GuitarTab3DViewProps) {
  let canvas: HTMLCanvasElement | undefined
  let renderer: TabRenderer | null = null
  let rafId = 0
  const [camera, setCamera] = createSignal<CameraState>(DEFAULT_CAMERA)

  const orbit = (dx: number, dy: number) =>
    setCamera((c) =>
      clampCamera({
        ...c,
        yaw: c.yaw - dx * ORBIT_SENS,
        pitch: c.pitch - dy * ORBIT_SENS,
      }),
    )
  const zoom = (deltaY: number) =>
    setCamera((c) =>
      clampCamera({ ...c, radius: c.radius * Math.exp(deltaY * ZOOM_SENS) }),
    )
  const pan = (dx: number, dy: number) =>
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
  const resetCamera = () => setCamera(DEFAULT_CAMERA)

  const buildScene = (): TabScene => {
    const source = props.fallingNotes()
    let stringCount = MIN_STRING_COUNT
    let maxFret = 0
    const observedOpen: number[] = []
    for (const n of source) {
      if (n.stringIndex + 1 > stringCount) stringCount = n.stringIndex + 1
      if (n.fret > maxFret) maxFret = n.fret
      observedOpen[n.stringIndex] = n.midi - n.fret
    }
    const openMidi: number[] = []
    for (let i = 0; i < stringCount; i++) {
      openMidi[i] = observedOpen[i] ?? DEFAULT_OPEN[i] ?? 40
    }
    const laidMaxFret = Math.min(24, Math.max(12, maxFret))
    const clampFret = (f: number) => Math.max(0, Math.min(laidMaxFret, f))
    const ph = props.playheadBeat()
    const ctrls = props.controls

    // Input scoring feedback (mic/MIDI): recent successful-hit flashes + the
    // player's detected note placed on the neck.
    const now = Date.now()
    const hits = (ctrls?.hitResults() ?? [])
      .filter((h) => h.timing !== 'miss' && now - h.timestamp < 600)
      .map((h) => ({
        stringIndex: h.stringIndex,
        fret: clampFret(h.midiNote - (openMidi[h.stringIndex] ?? 40)),
        timing: h.timing as 'perfect' | 'great' | 'good',
        at: h.timestamp,
      }))

    let detected: TabDetected | null = null
    const dMidi = ctrls?.detectedMidi() ?? null
    if (dMidi !== null && (ctrls?.showUserNotes() ?? true)) {
      // Snap to a hittable target of the same pitch-class near the hit line.
      const matched = source.find(
        (n) =>
          (n.isBacking ?? false) === false &&
          n.startBeat - ph <= 0.35 &&
          n.startBeat + n.duration - ph >= -0.35 &&
          dMidi % 12 === n.midi % 12,
      )
      const clarity = ctrls?.detectedClarity() ?? 1
      if (matched) {
        detected = {
          stringIndex: matched.stringIndex,
          fret: clampFret(matched.fret),
          matchesTarget: true,
          clarity,
        }
      } else {
        // Approximate a lane: first string that can play the pitch (low fret).
        let lane = stringCount - 1
        for (let s = 0; s < stringCount; s++) {
          if (dMidi >= openMidi[s] && dMidi - openMidi[s] <= laidMaxFret) {
            lane = s
            break
          }
        }
        detected = {
          stringIndex: lane,
          fret: clampFret(dMidi - openMidi[lane]),
          matchesTarget: false,
          clarity,
        }
      }
    }

    return {
      notes: source.map((n) => ({
        stringIndex: n.stringIndex,
        fret: n.fret,
        startBeat: n.startBeat,
        durationBeats: n.duration,
        // Always derive name+octave from MIDI so the label is exact (e.g. "C3").
        noteName: midiToNoteNameOctave(n.midi),
        isBacking: n.isBacking ?? false,
      })),
      playheadBeat: ph,
      visibleBeatWindow: Math.max(1, props.visibleBeatWindow()),
      stringCount,
      openMidi,
      maxFret: laidMaxFret,
      showNoteLabels: props.showNoteLabels(),
      showFretboard: props.showFretboard(),
      hits,
      detected,
      display: DEFAULT_DISPLAY,
    }
  }

  onMount(() => {
    if (canvas === undefined) return
    const hw = canvas
    const r = createTabRenderer()
    renderer = r
    void r.mount(hw)

    let lastW = 0
    let lastH = 0
    const renderFrame = () => {
      const rect = hw.getBoundingClientRect()
      if (rect.width !== lastW || rect.height !== lastH) {
        lastW = rect.width
        lastH = rect.height
        r.resize(rect.width, rect.height, window.devicePixelRatio)
      }
      r.setCamera(camera())
      r.render(buildScene())
    }

    // Paint once immediately so the view isn't blank before the first rAF.
    renderFrame()

    const loop = () => {
      if (props.isActive()) renderFrame()
      rafId = requestAnimationFrame(loop)
    }

    rafId = requestAnimationFrame(loop)

    // Direct camera control on the canvas: drag to orbit, shift/right-drag to
    // pan, wheel to zoom (mirrors the corner gizmo).
    let dragMode: 'orbit' | 'pan' | null = null
    let lastX = 0
    let lastY = 0
    const onPointerDown = (e: PointerEvent) => {
      dragMode = e.button === 2 || e.shiftKey ? 'pan' : 'orbit'
      lastX = e.clientX
      lastY = e.clientY
      hw.setPointerCapture(e.pointerId)
      e.preventDefault()
    }
    const onPointerMove = (e: PointerEvent) => {
      if (dragMode === null) return
      const dx = e.clientX - lastX
      const dy = e.clientY - lastY
      lastX = e.clientX
      lastY = e.clientY
      if (dragMode === 'pan') pan(dx, dy)
      else orbit(dx, dy)
    }
    const onPointerUp = (e: PointerEvent) => {
      dragMode = null
      hw.releasePointerCapture?.(e.pointerId)
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

    onCleanup(() => {
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
      class="gp-tab3d-container"
      style={{
        position: 'relative',
        width: '100%',
        // Fill the available area; the parent (#guitar-fretboard-container)
        // is flex:1, so the canvas scales with the window.
        height: '100%',
        'min-height': '0',
        'border-radius': '12px',
        overflow: 'hidden',
      }}
    >
      <canvas
        ref={canvas}
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
          cursor: 'grab',
          'touch-action': 'none',
        }}
      />
      <NavGizmo
        camera={camera}
        onOrbit={orbit}
        onPan={pan}
        onZoom={zoom}
        onReset={resetCamera}
      />
      <Show when={props.controls}>
        {(controls) => <Tab3DHud controls={controls()} />}
      </Show>
    </div>
  )
}
