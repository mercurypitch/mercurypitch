// ============================================================
// Studio note end — the clip's End handle on the note roll's ruler: dragged by a finger or a mouse, or moved by the arrows, longer or shorter, as one trim of the clip
// ============================================================
//
// It stands on the ruler where the clip's window ends; the roll draws its
// line down through the notes (note-roll-frame.ts). It takes a press 44 px
// across, a finger's target, as tall as the ruler, and on a touch screen
// as tall as a finger again under the ruler's dimmed side, past the end,
// where a press draws nothing, so it takes no press from a note.
//
// A drag drafts the end on the editor's grid (roll-end.ts), the roll
// drawing the window as far as the draft, and keeps it when let go: one
// commit. The pointer is read through the view it pressed in, so the view,
// which follows the handle past an edge, does not run away under it, and
// from where it took the handle, so the end moves with it and never jumps.
// Escape, a lost capture or a cancel puts the end back. With the focus,
// the arrows move it a grid step, and Shift a bar, each press one commit.
import { createSignal, Show } from 'solid-js'
import type { RollViewport } from '@/lib/roll-geometry'
import { timeToX, xToTime } from '@/lib/roll-geometry'
import type { StudioTickWindow } from '@/lib/studio/midi/time'
import { STUDIO_PPQ } from '@/lib/studio/model/types'
import type { NoteGridLines } from './edit-snap'
import type { StudioRollMeter } from './note-roll-geometry'
import { ROLL_END_TARGET, rollEndTick, rollEndWords } from './roll-end'
import styles from './StudioNoteEditor.module.css'

export interface StudioNoteEndProps {
  /** The roll's view now. */
  viewport: RollViewport
  /** Where the grid starts across the roll: the keys' column's width. */
  left: number
  /** The roll's width, for whether the handle is in view. */
  width: number
  window: StudioTickWindow
  meter: StudioRollMeter
  /** The editor's grid; null with Snap off. */
  grid: NoteGridLines | null
  /** The furthest the end can go, in ticks. */
  mostTick: number
  writable: boolean
  /** The end a drag shows, null when there is none: the roll draws the window as far as it. */
  onDraft(endTick: number | null): void
  /** Keep the clip's end at `endTick`: one trim of the clip. */
  onCommit(endTick: number): void
  /** Bring tick `tick` into the roll's view. */
  onReveal(tick: number): void
}

/** An arrow's way along the ruler: 1 for ArrowRight, -1 for ArrowLeft, 0 for any other key. */
function arrowDirection(key: string): number {
  if (key === 'ArrowRight') return 1
  return key === 'ArrowLeft' ? -1 : 0
}

interface EndDrag {
  readonly pointerId: number
  readonly target: HTMLElement
  /** The view the press was in, and the grid's left edge on the page then. */
  readonly view: RollViewport
  readonly left: number
  /** How far right of the end's line the press took the handle, in pixels. */
  readonly grab: number
}

export function StudioNoteEnd(props: StudioNoteEndProps) {
  const [draft, setDraft] = createSignal<number | null>(null)
  let drag: EndDrag | null = null
  const end = () => draft() ?? props.window.endTick
  const x = () => props.left + timeToX(end(), props.viewport)
  const inView = () =>
    x() >= props.left - ROLL_END_TARGET / 2 &&
    x() <= props.width + ROLL_END_TARGET / 2

  function show(tick: number | null): void {
    setDraft(tick)
    props.onDraft(tick)
  }

  function letGo(keep: boolean): void {
    const was = drag
    const tick = draft()
    drag = null
    show(null)
    if (was?.target.hasPointerCapture(was.pointerId) === true)
      was.target.releasePointerCapture(was.pointerId)
    if (keep && tick !== null && tick !== props.window.endTick)
      props.onCommit(tick)
  }

  function press(event: PointerEvent): void {
    if (!props.writable || event.button !== 0 || drag !== null) return
    const target = event.currentTarget as HTMLElement
    const host = target.parentElement?.getBoundingClientRect()
    if (host === undefined) return
    event.preventDefault()
    event.stopPropagation()
    target.focus({ preventScroll: true })
    target.setPointerCapture(event.pointerId)
    drag = {
      pointerId: event.pointerId,
      target,
      view: props.viewport,
      left: host.left + props.left,
      grab: event.clientX - (host.left + x()),
    }
    show(props.window.endTick)
  }

  function move(event: PointerEvent): void {
    if (drag?.pointerId !== event.pointerId) return
    const tick = rollEndTick(
      xToTime(event.clientX - drag.grab - drag.left, drag.view),
      props.grid,
      props.window.startTick,
      props.mostTick,
    )
    if (tick !== draft()) show(tick)
    props.onReveal(tick)
  }

  /** An arrow with no drag under way: a grid step, Shift a bar, each press one commit. */
  function stepKey(event: KeyboardEvent): void {
    const direction = arrowDirection(event.key)
    if (direction === 0 || !props.writable || event.altKey) return
    event.preventDefault()
    event.stopPropagation()
    const bar = props.meter.beatTicks * props.meter.beatsPerBar
    const step = event.shiftKey ? bar : (props.grid?.ticks ?? STUDIO_PPQ / 4)
    const tick = rollEndTick(
      props.window.endTick + direction * step,
      props.grid,
      props.window.startTick,
      props.mostTick,
    )
    if (tick !== props.window.endTick) props.onCommit(tick)
  }

  function key(event: KeyboardEvent): void {
    if (drag === null) {
      stepKey(event)
      return
    }
    if (event.key !== 'Escape') return
    event.preventDefault()
    event.stopPropagation()
    letGo(false)
  }

  return (
    <Show when={draft() !== null || inView()}>
      <div
        class={styles.end}
        classList={{ [styles.endDragging]: draft() !== null }}
        style={{ left: `${x()}px` }}
        role="slider"
        tabIndex={0}
        aria-label="Clip end"
        aria-orientation="horizontal"
        aria-valuemin={props.window.startTick}
        aria-valuemax={props.mostTick}
        aria-valuenow={Math.round(end())}
        aria-valuetext={rollEndWords(end(), props.meter)}
        aria-disabled={props.writable ? undefined : 'true'}
        aria-keyshortcuts="ArrowLeft ArrowRight Shift+ArrowLeft Shift+ArrowRight"
        title="Drag to lengthen or shorten the clip"
        data-studio-note-end={Math.round(end())}
        onPointerDown={press}
        onPointerMove={move}
        onPointerUp={(event) => {
          if (drag?.pointerId === event.pointerId) letGo(true)
        }}
        onPointerCancel={() => letGo(false)}
        onLostPointerCapture={() => {
          if (drag !== null) letGo(false)
        }}
        onKeyDown={key}
      >
        <span class={styles.endFlag}>End</span>
      </div>
    </Show>
  )
}
