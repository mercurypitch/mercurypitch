// ============================================================
// GuitarTab3DView — 3D-style falling-notes guitar tab playback
// ============================================================
//
// A drop-in alternate renderer for the same falling-notes data the 2D "hero"
// view uses (guitar.fallingNotes + guitar.playheadBeat), drawn as a perspective
// highway. Backend is chosen by createTabRenderer (Canvas2D today, WebGPU
// later) behind the TabRenderer interface.

import type { Accessor } from 'solid-js'
import { onCleanup, onMount } from 'solid-js'
import type { GuitarNote } from '@/lib/guitar/guitar-synth'
import { midiToNoteNameOctave } from '@/lib/note-utils'
import type { TabRenderer, TabScene } from './renderer/TabRenderer'
import { DEFAULT_DISPLAY } from './renderer/TabRenderer'
import { createTabRenderer } from './renderer/TabRenderer'

/** Standard guitar; widened automatically if a tab uses more strings. */
const MIN_STRING_COUNT = 6

export interface GuitarTab3DViewProps {
  fallingNotes: Accessor<GuitarNote[]>
  playheadBeat: Accessor<number>
  visibleBeatWindow: Accessor<number>
  showNoteLabels: Accessor<boolean>
  /** Only animate while the guitar tab is the active view. */
  isActive: Accessor<boolean>
}

export function GuitarTab3DView(props: GuitarTab3DViewProps) {
  let container: HTMLDivElement | undefined
  let canvas: HTMLCanvasElement | undefined
  let renderer: TabRenderer | null = null
  let rafId = 0
  let observer: ResizeObserver | null = null

  const buildScene = (): TabScene => {
    const source = props.fallingNotes()
    // Widen the board to fit tabs with more than 6 strings (7/8-string, etc.).
    let stringCount = MIN_STRING_COUNT
    for (const n of source) {
      if (n.stringIndex + 1 > stringCount) stringCount = n.stringIndex + 1
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
      playheadBeat: props.playheadBeat(),
      visibleBeatWindow: Math.max(1, props.visibleBeatWindow()),
      stringCount,
      showNoteLabels: props.showNoteLabels(),
      display: DEFAULT_DISPLAY,
    }
  }

  onMount(() => {
    if (canvas === undefined || container === undefined) return
    const r = createTabRenderer()
    renderer = r
    void r.mount(canvas)

    let lastW = 0
    let lastH = 0
    const syncSize = () => {
      if (container === undefined) return
      const rect = container.getBoundingClientRect()
      if (rect.width === lastW && rect.height === lastH) return
      lastW = rect.width
      lastH = rect.height
      r.resize(rect.width, rect.height, window.devicePixelRatio)
    }

    const renderFrame = () => {
      syncSize()
      r.render(buildScene())
    }

    // Paint once immediately so the view isn't blank before the first rAF.
    renderFrame()
    observer = new ResizeObserver(syncSize)
    observer.observe(container)

    const loop = () => {
      if (props.isActive()) renderFrame()
      rafId = requestAnimationFrame(loop)
    }

    rafId = requestAnimationFrame(loop)
  })

  onCleanup(() => {
    if (rafId !== 0) cancelAnimationFrame(rafId)
    observer?.disconnect()
    renderer?.dispose()
    renderer = null
  })

  return (
    <div
      ref={container}
      class="gp-tab3d-container"
      style={{
        position: 'relative',
        width: '100%',
        height: 'min(62vh, 560px)',
        'border-radius': '12px',
        overflow: 'hidden',
      }}
    >
      <canvas
        ref={canvas}
        style={{ display: 'block', width: '100%', height: '100%' }}
      />
    </div>
  )
}
