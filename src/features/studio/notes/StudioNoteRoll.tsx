// ============================================================
// Studio note roll — the note editor's canvas: a clip's notes big, on the piano's keys or the kit's rows, under the song's bars, with their velocities and the transport's playhead
// ============================================================
//
// Two canvases, one over the other, both drawn by note-roll-draw.ts from
// one input. The base is drawn again when what it shows changes (the notes,
// the selection, the view, the size, the theme); the overlay when the
// playhead moves or a gesture changes what it holds. While the song plays
// the overlay follows the clock on every display frame, and the view turns
// the page when the playhead runs off its right edge.
//
// A piano's roll is edited: its pointers and its wheel go to the editing
// engine (`editing`, useStudioNoteEditing.ts), which moves the notes and the
// view alike, the rows in fractions of a row; its draw adds the engine's
// selection, drafts, marquee, grips, hover and velocity readout
// (edit-host.ts). A kit's roll keeps its whole rows and C's navigation
// (roll-navigation.ts) until the drum editor takes it over. The editor's
// buttons and keys reach the view through `controls`.
import { createEffect, createMemo, createSignal, on, onCleanup, onMount, untrack, } from 'solid-js'
import type { RollViewport } from '@/lib/roll-geometry'
import { timeToX } from '@/lib/roll-geometry'
import { studioDrumRows } from '@/lib/studio/midi/drum-rows'
import type { StudioMidiSoundKind } from '@/lib/studio/midi/render-key'
import { panStudioRoll, zoomStudioRoll } from '@/lib/studio/midi/roll'
import type { StudioRollRows } from '@/lib/studio/midi/roll-keyboard'
import { STUDIO_ROLL_ROWS_FINE, STUDIO_ROLL_ROWS_TOUCH, studioRollOpening, studioRollShownRows, studioRollTopRow, studioRollWantedRows, } from '@/lib/studio/midi/roll-keyboard'
import { resizeStudioRollRows } from '@/lib/studio/midi/roll-rows'
import type { StudioTickWindow } from '@/lib/studio/midi/time'
import { studioClipTickWindow, studioSongBeats, studioSongFrameToTick, } from '@/lib/studio/midi/time'
import type { StudioClip, StudioSequence } from '@/lib/studio/model/types'
import { notePianoOpening, noteRollDrafts, noteRollDrawing } from './edit-host'
import { studioRollWords } from './note-editor-words'
import type { StudioRollDraft, StudioRollInput, StudioRollLayout, StudioRollMeter, StudioRollTheme, } from './note-roll-draw'
import { drawStudioRollBase, drawStudioRollOverlay, studioRollRegions, } from './note-roll-draw'
import { createNoteRollPointers } from './note-roll-pointers'
import { readStudioRollTheme } from './note-roll-theme'
import type { StudioRollMove } from './roll-navigation'
import { createStudioRollTouch, moveStudioRoll, studioRollWheelMove, } from './roll-navigation'
import styles from './StudioNoteEditor.module.css'
import type { StudioNoteRollEditing } from './useStudioNoteEditing'

/** What the roll reads from the transport. */
export interface StudioNoteRollTransport {
  playing(): boolean
  playheadFrame(): number
  frameNow(): number
}

/** The roll's view, for the editor's buttons and keys. */
export interface StudioNoteRollControls {
  /** Closer (1) or wider (-1), about the playhead when it is in view. */
  zoom(direction: 1 | -1): void
  /** The clip's whole window. */
  fit(): void
}

interface StudioNoteRollProps {
  clip: StudioClip
  sequence: StudioSequence
  songTempoBpm: number
  sound: StudioMidiSoundKind
  /** Finger-sized rows. */
  touch: boolean
  /** A phone's narrower keys and shorter velocity lane. */
  compact: boolean
  /** The lane's colour: a change reads the theme again. */
  color: string
  transport: StudioNoteRollTransport
  /** The editing engine: a piano's roll edits with it; without it, it only shows. */
  editing?: StudioNoteRollEditing
  controls?(controls: StudioNoteRollControls): void
}

const NO_SELECTION: ReadonlySet<number> = new Set()
const NO_DRAFTS: readonly StudioRollDraft[] = []
/** The Studio's bars are of four beats (timeline-geometry.ts). */
const BEATS_PER_BAR = 4

export function studioRollLayout(
  sound: StudioMidiSoundKind,
  compact: boolean,
): StudioRollLayout {
  const keys = sound === 'drums' ? [136, 104] : [72, 46]
  return {
    keysWidth: keys[compact ? 1 : 0],
    rulerHeight: 26,
    velocityHeight: compact ? 60 : 76,
  }
}

const sameWindow = (a: StudioTickWindow, b: StudioTickWindow) =>
  a.startTick === b.startTick && a.endTick === b.endTick

const sameIds = (a: ReadonlySet<number>, b: ReadonlySet<number>) =>
  a.size === b.size && [...a].every((id) => b.has(id))

const pixelRatio = () =>
  Math.min(3, Math.max(1, globalThis.devicePixelRatio || 1))

/** The canvas at the input's size in device pixels: set only when it changes, which clears and reallocates it. */
function contextFor(
  canvas: HTMLCanvasElement,
  input: StudioRollInput,
): CanvasRenderingContext2D | null {
  const width = Math.round(input.width * input.ratio)
  const height = Math.round(input.height * input.ratio)
  if (canvas.width !== width) canvas.width = width
  if (canvas.height !== height) canvas.height = height
  return canvas.getContext('2d')
}

export function StudioNoteRoll(props: StudioNoteRollProps) {
  let host: HTMLDivElement | undefined
  let base: HTMLCanvasElement | undefined
  let overlay: HTMLCanvasElement | undefined
  const [size, setSize] = createSignal({ width: 0, height: 0 })
  const [theme, setTheme] = createSignal<StudioRollTheme | null>(null)
  const [view, setView] = createSignal<RollViewport | null>(null)
  let carryRows = 0

  const layout = createMemo(() => studioRollLayout(props.sound, props.compact))
  const regions = createMemo(() =>
    studioRollRegions({ ...size(), layout: layout() }),
  )
  const clipWindow = createMemo(
    () => studioClipTickWindow(props.clip, props.sequence),
    undefined,
    { equals: sameWindow },
  )
  const meter = createMemo<StudioRollMeter, undefined>(
    () => ({
      ...studioSongBeats(props.clip, props.sequence, props.songTempoBpm),
      beatsPerBar: BEATS_PER_BAR,
    }),
    undefined,
    {
      equals: (a, b) =>
        a.beatTicks === b.beatTicks && a.originTick === b.originTick,
    },
  )
  const rows = createMemo<StudioRollRows, undefined>(
    () =>
      props.sound === 'drums'
        ? { kind: 'drums', keys: studioDrumRows(props.sequence.notes) }
        : { kind: 'piano' },
    undefined,
    {
      equals: (a, b) =>
        a.kind === b.kind &&
        (a.kind === 'piano' ||
          (b.kind === 'drums' &&
            a.keys.map((row) => row.key).join() ===
              b.keys.map((row) => row.key).join())),
    },
  )
  const grid = createMemo(
    () => {
      const { width, height } = size()
      const { keysWidth, rulerHeight, velocityHeight } = layout()
      return {
        width: Math.max(0, width - keysWidth),
        height: Math.max(0, height - rulerHeight - velocityHeight),
      }
    },
    undefined,
    { equals: (a, b) => a.width === b.width && a.height === b.height },
  )
  const limits = () =>
    props.touch ? STUDIO_ROLL_ROWS_TOUCH : STUDIO_ROLL_ROWS_FINE
  const tickOf = (frame: number) =>
    studioSongFrameToTick(props.clip, props.sequence, frame)
  // A piano edits through the engine; a kit waits for the drum editor.
  const editing = () =>
    props.sound === 'piano' ? (props.editing ?? null) : null

  /** The view as it opens: the first bars that fit, the playhead a tenth in when it is in the clip past them. */
  function opening(box: { width: number; height: number }): RollViewport {
    const barTicks = meter().beatTicks * BEATS_PER_BAR
    const bars = Math.max(2, Math.round(box.width / 160))
    const fitted = studioRollOpening({
      sequence: props.sequence,
      window: clipWindow(),
      rows: rows(),
      width: box.width,
      height: box.height,
      limits: limits(),
      span: bars * barTicks,
    })
    const opened =
      rows().kind === 'piano' ? notePianoOpening(fitted, props.touch) : fitted
    const tick = tickOf(props.transport.playheadFrame())
    const span = opened.end - opened.start
    const shown = tick >= opened.start && tick <= opened.end
    if (shown || tick < clipWindow().startTick || tick >= clipWindow().endTick)
      return opened
    return panStudioRoll(opened, tick - span * 0.1 - opened.start, clipWindow())
  }

  /** The view at a new size, window or kit: its ticks kept inside the window; a piano's rows as tall as they were, a kit's fitted again. */
  function refit(
    current: RollViewport,
    box: { width: number; height: number },
  ): RollViewport {
    const sized = { ...current, width: box.width, height: box.height }
    const kept = panStudioRoll(
      zoomStudioRoll(sized, 1, 0, clipWindow()),
      0,
      clipWindow(),
    )
    if (rows().kind === 'piano')
      return resizeStudioRollRows(
        { ...kept, height: current.height },
        box.height,
      )
    const shown = studioRollShownRows(
      studioRollWantedRows(props.sequence, clipWindow(), rows()),
      box.height,
      limits(),
      studioRollTopRow(rows()),
    )
    return { ...kept, ...shown }
  }

  createEffect(() => {
    const box = grid()
    void clipWindow()
    void rows()
    void limits()
    if (box.width <= 0 || box.height <= 0) return
    untrack(() => {
      const current = view()
      setView(current === null ? opening(box) : refit(current, box))
    })
  })

  function apply(move: StudioRollMove): void {
    const current = view()
    if (current === null) return
    const next = moveStudioRoll(
      current,
      move,
      clipWindow(),
      studioRollTopRow(rows()),
      carryRows,
    )
    carryRows = next.carryRows
    if (next.viewport !== current) setView(next.viewport)
  }

  const touch = createStudioRollTouch({
    apply,
    origin: () =>
      (overlay?.getBoundingClientRect().left ?? 0) + layout().keysWidth,
    holds: (id) => overlay?.hasPointerCapture(id) === true,
  })
  const pointers = createNoteRollPointers({
    editing,
    canvas: () => overlay ?? null,
    regions,
  })

  // What the engine draws: the selection and the drafts' ghosts in the
  // base, the rest on the overlay.
  const editView = () => editing()?.view() ?? null
  const selected = createMemo(
    () => {
      const shown = editView()
      return shown === null ? NO_SELECTION : new Set(shown.selection)
    },
    NO_SELECTION,
    { equals: sameIds },
  )
  const drafts = createMemo(() => {
    const shown = editView()
    return shown === null
      ? NO_DRAFTS
      : noteRollDrafts(shown, props.sequence.notes)
  })
  // The drafts' ids are what the base draws from them: a ghost for each.
  const draftIds = createMemo(() =>
    drafts()
      .map((draft) => draft.id ?? '')
      .filter((id) => id !== '')
      .join(),
  )
  const baseInput = createMemo<StudioRollInput | null>(() => {
    const viewport = view()
    const colours = theme()
    const box = size()
    void draftIds()
    if (viewport === null || colours === null || box.width <= 0) return null
    return {
      width: box.width,
      height: box.height,
      ratio: pixelRatio(),
      layout: layout(),
      theme: colours,
      viewport,
      window: clipWindow(),
      rows: rows(),
      meter: meter(),
      notes: props.sequence.notes,
      selected: selected(),
      drafts: untrack(drafts),
      marquee: null,
      grips: [],
      hover: null,
      readout: null,
      playheadTick: null,
      corner: props.sound === 'drums' ? 'Kit' : 'Notes',
    }
  })
  const restingTick = createMemo(() => tickOf(props.transport.playheadFrame()))
  // While the song plays: the tick heard this display frame.
  let liveTick: number | null = null

  function drawBase(): void {
    const input = baseInput()
    const context = input && base ? contextFor(base, input) : null
    if (input && context) drawStudioRollBase(context, input)
  }

  function drawOverlay(): void {
    const input = baseInput()
    if (input === null || !overlay) return
    const context = contextFor(overlay, input)
    if (context === null) return
    const shown = editView()
    const drawing =
      shown === null
        ? null
        : noteRollDrawing(shown, props.sequence.notes, regions().grid)
    drawStudioRollOverlay(context, {
      ...input,
      drafts: drawing?.drafts ?? NO_DRAFTS,
      marquee: drawing?.marquee ?? null,
      grips: drawing?.grips ?? [],
      hover: drawing?.hover ?? null,
      readout: drawing?.readout ?? null,
      playheadTick: liveTick ?? restingTick(),
    })
  }

  const queued = { base: 0, overlay: 0 }

  function queue(layer: 'base' | 'overlay'): void {
    if (queued[layer] !== 0) return
    queued[layer] = requestAnimationFrame(() => {
      queued[layer] = 0
      if (layer === 'base') drawBase()
      else drawOverlay()
    })
  }
  onCleanup(() => {
    cancelAnimationFrame(queued.base)
    cancelAnimationFrame(queued.overlay)
  })
  createEffect(() => {
    void baseInput()
    queue('base')
  })
  createEffect(() => {
    void baseInput()
    void editView()
    void restingTick()
    queue('overlay')
  })

  /** The playhead ran off the view's right edge: the next page, the playhead a tenth in. */
  function follow(tick: number, before: number | null): void {
    const current = view()
    if (current === null || before === null) return
    if (touch.active() || pointers.active()) return
    if (before > current.end || tick <= current.end) return
    const span = current.end - current.start
    setView(
      panStudioRoll(current, tick - span * 0.1 - current.start, clipWindow()),
    )
  }

  createEffect(() => {
    if (!props.transport.playing()) return
    let frame = requestAnimationFrame(function step() {
      const tick = tickOf(props.transport.frameNow())
      untrack(() => follow(tick, liveTick))
      liveTick = tick
      untrack(drawOverlay)
      frame = requestAnimationFrame(step)
    })
    onCleanup(() => {
      cancelAnimationFrame(frame)
      liveTick = null
      queue('overlay')
    })
  })

  const readTheme = () => {
    if (host?.isConnected === true) setTheme(readStudioRollTheme(host))
  }
  createEffect(on(() => props.color, readTheme, { defer: true }))
  onMount(() => {
    readTheme()
    const appearance =
      typeof MutationObserver === 'undefined'
        ? null
        : new MutationObserver(readTheme)
    appearance?.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    })
    const observer =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver((entries) => {
            const box = entries.at(-1)?.contentRect
            if (box)
              setSize((last) =>
                last.width === box.width && last.height === box.height
                  ? last
                  : { width: box.width, height: box.height },
              )
          })
    if (host) {
      observer?.observe(host)
      const box = host.getBoundingClientRect()
      setSize({ width: box.width, height: box.height })
    }
    const detach = props.editing?.attach({
      viewport: view,
      setViewport: (viewport) => setView(viewport),
      velocityHeight: () => layout().velocityHeight,
    })
    onCleanup(() => {
      appearance?.disconnect()
      observer?.disconnect()
      detach?.()
    })
    props.controls?.({ zoom, fit })
  })

  function zoom(direction: 1 | -1): void {
    const current = view()
    if (current === null) return
    const tick = liveTick ?? restingTick()
    const anchor =
      tick >= current.start && tick <= current.end
        ? timeToX(tick, current)
        : current.width / 2
    apply({ kind: 'zoom', factor: direction > 0 ? 0.5 : 2, anchorX: anchor })
  }

  function fit(): void {
    apply({ kind: 'zoom', factor: Number.MAX_SAFE_INTEGER, anchorX: 0 })
  }

  function wheel(event: WheelEvent): void {
    if (pointers.wheel(event)) return
    const current = view()
    if (current === null || !overlay) return
    const left = overlay.getBoundingClientRect().left + layout().keysWidth
    const showsAll =
      rows().kind === 'drums' &&
      current.maxMidi - current.minMidi >= studioRollTopRow(rows())
    const move = studioRollWheelMove(
      event,
      event.clientX - left,
      !showsAll,
      grid().height,
    )
    if (move === null) return
    event.preventDefault()
    apply(move)
  }

  function press(event: PointerEvent): void {
    if (pointers.down(event)) return
    if (!touch.down(event)) return
    event.preventDefault()
    overlay?.setPointerCapture(event.pointerId)
  }

  function lift(event: PointerEvent, kind: 'up' | 'cancel'): void {
    if (!pointers.end(event, kind)) touch.up(event)
  }

  const words = createMemo(() =>
    studioRollWords({
      notes: props.sequence.notes,
      window: clipWindow(),
      meter: meter(),
      sound: props.sound,
    }),
  )
  const viewData = () => {
    const current = view()
    return current === null
      ? undefined
      : `${Math.round(current.start)}:${Math.round(current.end)}:${current.minMidi}:${current.maxMidi}`
  }

  return (
    <div
      ref={host}
      class={styles.roll}
      data-studio-note-roll={viewData()}
      data-studio-note-editing={editing() === null ? undefined : ''}
    >
      <canvas ref={base} class={styles.rollCanvas} aria-hidden="true" />
      <canvas
        ref={overlay}
        class={styles.rollCanvas}
        style={{ cursor: editView()?.cursor }}
        role="img"
        aria-label={words()}
        onWheel={wheel}
        onPointerDown={press}
        onPointerMove={(event) => {
          if (!pointers.move(event)) touch.move(event)
        }}
        onPointerUp={(event) => lift(event, 'up')}
        onPointerCancel={(event) => lift(event, 'cancel')}
        onLostPointerCapture={(event) => lift(event, 'cancel')}
        onPointerLeave={(event) => pointers.leave(event)}
      />
    </div>
  )
}
