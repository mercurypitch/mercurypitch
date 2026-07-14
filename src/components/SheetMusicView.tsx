// ============================================================
// SheetMusicView — Standard notation view for melodies
//
// Renders a melody with VexFlow and overlays an interactive layer:
//  - a playback cursor + current-note highlight driven by currentBeat()
//  - click a note to seek there (onSeek)
//  - click empty staff to place a note / right-click to delete (onMelodyChange)
// The overlay maps 1:1 to the rendered SVG (renderer draws at the measured
// width, no CSS scaling), so screen clicks are layout coordinates directly.
// ============================================================

import type { Component } from 'solid-js'
import { createEffect, createSignal, onCleanup, onMount } from 'solid-js'
import { midiToFreq, midiToNote } from '@/lib/scale-data'
import type { SheetLayout } from '@/lib/sheet-music-renderer'
import { beatToCursor, noteBoxAt, renderSheetMusic, staffYToMidi, systemAtY, xToBeat, } from '@/lib/sheet-music-renderer'
import type { MelodyItem, NoteName, ScaleDegree } from '@/types'
import styles from './SheetMusicView.module.css'

interface SheetMusicViewProps {
  melody: () => MelodyItem[]
  musicKey: () => string
  scaleType: () => string
  beatsPerBar?: number
  /** playback position (beats); enables the cursor + highlight when provided */
  currentBeat?: () => number
  isPlaying?: () => boolean
  /** seek playback to a beat when a note is clicked */
  onSeek?: (beat: number) => void
  /** scale degrees for pitch snapping when placing notes */
  scale?: () => ScaleDegree[]
  /** enables note entry/deletion when provided */
  onMelodyChange?: (melody: MelodyItem[]) => void
  /** length in beats of a newly placed note (default 1) */
  noteDuration?: () => number
  /** compact top toolbar area (e.g. a length picker) rendered above the staff */
  toolbar?: () => unknown
  /** optional data-tour hook for the container */
  dataTour?: string
}

function snapToScale(midi: number, scale: ScaleDegree[]): ScaleDegree | null {
  if (!scale.length) return null
  let best = scale[0]
  let bestD = Infinity
  for (const d of scale) {
    const dist = Math.abs(d.midi - midi)
    if (dist < bestD) {
      best = d
      bestD = dist
    }
  }
  return best
}

export const SheetMusicView: Component<SheetMusicViewProps> = (props) => {
  let scrollRef: HTMLDivElement | undefined
  let innerRef: HTMLDivElement | undefined
  let vexRef: HTMLDivElement | undefined

  const [layout, setLayout] = createSignal<SheetLayout | null>(null)
  const editable = (): boolean => typeof props.onMelodyChange === 'function'

  const measureWidth = (): number => {
    const w = scrollRef?.clientWidth ?? 960
    return Math.max(480, Math.min(1400, w - 4))
  }

  const draw = (): void => {
    if (!vexRef) return
    const l = renderSheetMusic({
      container: vexRef,
      melody: props.melody(),
      key: props.musicKey(),
      scaleType: props.scaleType(),
      beatsPerBar: props.beatsPerBar,
      width: measureWidth(),
    })
    setLayout(l)
  }

  // Redraw on any content change. createEffect runs once on mount.
  createEffect(() => {
    props.melody()
    props.musicKey()
    props.scaleType()
    draw()
  })

  // Redraw on container resize (debounced via rAF).
  onMount(() => {
    if (!scrollRef) return
    let raf = 0
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(draw)
    })
    ro.observe(scrollRef)
    onCleanup(() => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    })
  })

  // Playback cursor + current-note highlight + auto-scroll.
  const [cursorX, setCursorX] = createSignal<number | null>(null)
  const [cursorTop, setCursorTop] = createSignal(0)
  const [cursorH, setCursorH] = createSignal(0)
  const [hl, setHl] = createSignal<{
    x: number
    y: number
    w: number
    h: number
  } | null>(null)

  createEffect(() => {
    const l = layout()
    const beatFn = props.currentBeat
    if (!l || !beatFn) {
      setCursorX(null)
      setHl(null)
      return
    }
    const beat = beatFn()
    const pos = beatToCursor(l, beat)
    if (!pos) {
      setCursorX(null)
      setHl(null)
      return
    }
    setCursorX(pos.x)
    setCursorTop(pos.top)
    setCursorH(pos.bottom - pos.top)

    // Highlight the note currently sounding.
    const active = l.notes.find(
      (n) => !n.isRest && beat >= n.startBeat && beat < n.endBeat,
    )
    const sys = active ? l.systems[active.systemIndex] : undefined
    if (active && sys) {
      setHl({
        x: active.x - Math.max(8, active.width / 2) - 2,
        y: sys.top,
        w: Math.max(16, active.width) + 4,
        h: sys.bottom - sys.top,
      })
    } else {
      setHl(null)
    }

    // Keep the cursor in view during playback.
    if (props.isPlaying?.() === true && scrollRef) {
      const c = scrollRef
      const m = 80
      if (pos.x < c.scrollLeft + m) c.scrollLeft = Math.max(0, pos.x - m)
      else if (pos.x > c.scrollLeft + c.clientWidth - m)
        c.scrollLeft = pos.x - c.clientWidth + m
      if (pos.top < c.scrollTop) c.scrollTop = Math.max(0, pos.top - 20)
      else if (pos.bottom > c.scrollTop + c.clientHeight)
        c.scrollTop = pos.bottom - c.clientHeight + 20
    }
  })

  const localCoords = (e: MouseEvent): { px: number; py: number } | null => {
    if (!innerRef) return null
    const r = innerRef.getBoundingClientRect()
    return { px: e.clientX - r.left, py: e.clientY - r.top }
  }

  const nextId = (): number => {
    let max = 0
    for (const m of props.melody())
      if (typeof m.id === 'number' && m.id > max) max = m.id
    return max + 1
  }

  // Pitch tolerance for treating a click as "on a note" (≈ one staff space).
  const NOTE_Y_TOL = 12

  const handleClick = (e: MouseEvent): void => {
    const l = layout()
    const c = localCoords(e)
    if (!l || !c) return

    if (!editable()) {
      // Read-only: click anywhere in a note's column seeks to it.
      const hit = noteBoxAt(l, c.px, c.py)
      if (hit && props.onSeek) props.onSeek(hit.startBeat)
      return
    }

    // Editing: a click landing on a notehead seeks; empty staff places a note.
    const onNote = noteBoxAt(l, c.px, c.py, NOTE_Y_TOL)
    if (onNote && props.onSeek) {
      props.onSeek(onNote.startBeat)
      return
    }

    // Otherwise place a note at the clicked staff position.
    const sys = systemAtY(l, c.py)
    if (!sys) return
    const beat = xToBeat(sys, c.px)
    const dur = props.noteDuration?.() ?? 1
    const snapUnit = dur >= 1 ? 1 : 0.5
    const startBeat = Math.max(0, Math.round(beat / snapUnit) * snapUnit)

    const rawMidi = staffYToMidi(sys, c.py)
    const scale = props.scale?.() ?? []
    const snapped = snapToScale(rawMidi, scale)
    let note: MelodyItem['note']
    if (snapped) {
      note = {
        midi: snapped.midi,
        name: snapped.name as NoteName,
        octave: snapped.octave,
        freq: snapped.freq,
      }
    } else {
      const { name, octave } = midiToNote(rawMidi)
      note = { midi: rawMidi, name, octave, freq: midiToFreq(rawMidi) }
    }

    const item: MelodyItem = { id: nextId(), note, duration: dur, startBeat }
    props.onMelodyChange?.([...props.melody(), item])
  }

  const handleContextMenu = (e: MouseEvent): void => {
    if (!editable()) return
    const l = layout()
    const c = localCoords(e)
    if (!l || !c) return
    const hit = noteBoxAt(l, c.px, c.py, NOTE_Y_TOL)
    if (hit && hit.melodyId !== null) {
      e.preventDefault()
      props.onMelodyChange?.(
        props.melody().filter((m) => m.id !== hit.melodyId),
      )
    }
  }

  onCleanup(() => {
    if (vexRef) vexRef.innerHTML = ''
  })

  return (
    <div ref={scrollRef} class={styles.sheetScroll} data-tour={props.dataTour}>
      {props.toolbar?.() as never}
      <div
        ref={innerRef}
        class={styles.sheetInner}
        style={{
          width: `${layout()?.width ?? measureWidth()}px`,
          height: `${layout()?.height ?? 200}px`,
        }}
      >
        <div ref={vexRef} class={styles.vexHost} />

        {hl() && (
          <div
            class={styles.noteHighlight}
            style={{
              left: `${hl()!.x}px`,
              top: `${hl()!.y}px`,
              width: `${hl()!.w}px`,
              height: `${hl()!.h}px`,
            }}
          />
        )}

        {cursorX() !== null && (
          <div
            class={styles.playCursor}
            classList={{ [styles.playCursorActive]: props.isPlaying?.() }}
            style={{
              left: `${cursorX()!}px`,
              top: `${cursorTop()}px`,
              height: `${cursorH()}px`,
            }}
          />
        )}

        <div
          class={styles.clickLayer}
          classList={{ [styles.clickLayerEdit]: editable() }}
          onClick={handleClick}
          onContextMenu={handleContextMenu}
        />
      </div>
    </div>
  )
}
