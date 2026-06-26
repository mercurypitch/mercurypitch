// ============================================================
// GuitarTab3DView — 3D-style falling-notes guitar tab playback
// ============================================================
//
// A drop-in alternate renderer for the same falling-notes data the 2D "hero"
// view uses (guitar.fallingNotes + guitar.playheadBeat), drawn as a perspective
// highway. Backend is chosen by createTabRenderer (Canvas2D today, WebGPU
// later) behind the TabRenderer interface. A flat fretboard reference panel
// (the "stacked keyboard" equivalent) renders below it when enabled.

import type { Accessor } from 'solid-js'
import { onCleanup, onMount, Show } from 'solid-js'
import type { GuitarNote } from '@/lib/guitar/guitar-synth'
import { midiToNoteNameOctave } from '@/lib/note-utils'
import type { FretboardDrawOpts } from './renderer/canvas2d/FretboardStrip'
import { cellKey, drawFretboard } from './renderer/canvas2d/FretboardStrip'
import type { TabRenderer, TabScene } from './renderer/TabRenderer'
import { DEFAULT_DISPLAY } from './renderer/TabRenderer'
import { createTabRenderer } from './renderer/TabRenderer'

/** Standard guitar; widened automatically if a tab uses more strings. */
const MIN_STRING_COUNT = 6
/** Fallback open-string tuning (high→low), extended for 7/8-string tabs. */
const DEFAULT_OPEN: readonly number[] = [64, 59, 55, 50, 45, 40, 35, 30]
/** Beats either side of the hit line counted as "now playing" on the board. */
const ACTIVE_BEATS = 0.12

export interface GuitarTab3DViewProps {
  fallingNotes: Accessor<GuitarNote[]>
  playheadBeat: Accessor<number>
  visibleBeatWindow: Accessor<number>
  showNoteLabels: Accessor<boolean>
  /** Show the flat fretboard reference panel below the highway. */
  showFretboard: Accessor<boolean>
  /** Only animate while the guitar tab is the active view. */
  isActive: Accessor<boolean>
}

export function GuitarTab3DView(props: GuitarTab3DViewProps) {
  let canvas: HTMLCanvasElement | undefined
  let fretCanvas: HTMLCanvasElement | undefined
  let renderer: TabRenderer | null = null
  let rafId = 0

  const buildScene = (): TabScene => {
    const source = props.fallingNotes()
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

  const buildFretboardOpts = (
    width: number,
    height: number,
  ): FretboardDrawOpts => {
    const notes = props.fallingNotes()
    const playhead = props.playheadBeat()
    let stringCount = MIN_STRING_COUNT
    let maxFret = 0
    const observedOpen: number[] = []
    const activeCells = new Set<string>()
    for (const n of notes) {
      if (n.stringIndex + 1 > stringCount) stringCount = n.stringIndex + 1
      if (n.fret > maxFret) maxFret = n.fret
      observedOpen[n.stringIndex] = n.midi - n.fret
      if (
        n.isBacking !== true &&
        Math.abs(n.startBeat - playhead) < ACTIVE_BEATS
      ) {
        activeCells.add(cellKey(n.stringIndex, n.fret))
      }
    }
    const openMidi: number[] = []
    for (let i = 0; i < stringCount; i++) {
      openMidi[i] = observedOpen[i] ?? DEFAULT_OPEN[i] ?? 40
    }
    return {
      width,
      height,
      stringCount,
      openMidi,
      maxFret: Math.min(24, Math.max(12, maxFret)),
      activeCells,
      showNoteNames: props.showNoteLabels(),
      stringColors: DEFAULT_DISPLAY.stringColors,
      leftHanded: DEFAULT_DISPLAY.leftHanded,
    }
  }

  onMount(() => {
    if (canvas === undefined) return
    const r = createTabRenderer()
    renderer = r
    void r.mount(canvas)

    let lastHwW = 0
    let lastHwH = 0
    const renderHighway = () => {
      const hw = canvas
      if (hw === undefined) return
      const rect = hw.getBoundingClientRect()
      if (rect.width !== lastHwW || rect.height !== lastHwH) {
        lastHwW = rect.width
        lastHwH = rect.height
        r.resize(rect.width, rect.height, window.devicePixelRatio)
      }
      r.render(buildScene())
    }

    const renderFretboard = () => {
      const fc = fretCanvas
      if (!props.showFretboard() || fc === undefined) return
      const fctx = fc.getContext('2d')
      if (fctx === null) return
      const rect = fc.getBoundingClientRect()
      const dpr = window.devicePixelRatio
      const needW = Math.max(1, Math.round(rect.width * dpr))
      const needH = Math.max(1, Math.round(rect.height * dpr))
      if (fc.width !== needW || fc.height !== needH) {
        fc.width = needW
        fc.height = needH
        fctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      }
      drawFretboard(fctx, buildFretboardOpts(rect.width, rect.height))
    }

    const renderFrame = () => {
      renderHighway()
      renderFretboard()
    }

    // Paint once immediately so the view isn't blank before the first rAF.
    renderFrame()

    const loop = () => {
      if (props.isActive()) renderFrame()
      rafId = requestAnimationFrame(loop)
    }

    rafId = requestAnimationFrame(loop)
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
        display: 'flex',
        'flex-direction': 'column',
        width: '100%',
        height: 'min(62vh, 560px)',
        'border-radius': '12px',
        overflow: 'hidden',
      }}
    >
      <canvas
        ref={canvas}
        style={{
          display: 'block',
          width: '100%',
          flex: '1 1 auto',
          'min-height': '0',
        }}
      />
      <Show when={props.showFretboard()}>
        <canvas
          ref={fretCanvas}
          style={{
            display: 'block',
            width: '100%',
            height: '128px',
            'border-top': '1px solid rgba(255,255,255,0.08)',
          }}
        />
      </Show>
    </div>
  )
}
