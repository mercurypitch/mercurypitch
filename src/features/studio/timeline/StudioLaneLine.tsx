// Studio lane line — a lane's open volume or pan line over its clips: press to add a point, drag one to move it, keys for the rest.
import { createMemo, createSignal, Index, Show } from 'solid-js'
import type { StudioAutomationParam } from '@/lib/studio/model/automation'
import type { StudioAutomationPoint, StudioClip, StudioTrack, } from '@/lib/studio/model/types'
import { STUDIO_SAMPLE_RATE } from '@/lib/studio/model/types'
import { addStudioLinePoint, formatStudioLineValue, moveStudioLinePoint, sameStudioLine, studioLineDepth, studioLineKeyStep, studioLinePointBounds, studioLineValueAtDepth, } from './lane-line'
import type { StudioLineActions, StudioLineEditor } from './line-editor'
import styles from './StudioLaneLine.module.css'
import { formatStudioMoment, frameToPixel } from './timeline-geometry'
import { snapStudioPosition, studioGridInterval } from './timeline-snap'

/** How far a press moves before it moves a point: a click only chooses it. */
const DEAD_ZONE_PX = 3

const NAMES: Readonly<Record<StudioAutomationParam, string>> = {
  volume: 'Volume',
  pan: 'Pan',
}

/** The labels at a lane's top, at its 0 dB or centre line, and at its foot. */
const SCALE: Readonly<Record<StudioAutomationParam, readonly string[]>> = {
  volume: ['+12 dB', '0 dB', '\u221260 dB'],
  pan: ['L', 'C', 'R'],
}

interface StudioLaneLineProps {
  track: StudioTrack
  param: StudioAutomationParam
  editor: StudioLineEditor
  actions: StudioLineActions
  /** The lane's clips: a point snaps to their edges, as a clip does. */
  clips: readonly StudioClip[]
  /** Pixels per second, and the lane's width in pixels. */
  scale: number
  width: number
  /** Where the lane is scrolled to, so the scale's labels stay in view. */
  scroll: number
  playheadFrame: number
  snap: boolean
  tempoBpm?: number
  writable: boolean
  /** Touch-sized points. */
  touch: boolean
  /** Said in the timeline's status pill. */
  onStatus(message: string): void
  onClose(): void
}

/** A point in hand: where the press began, and the line under it. */
interface Hand {
  readonly pointer: number
  readonly index: number
  /** The line when the press began, with the point it added. */
  readonly base: readonly StudioAutomationPoint[]
  readonly from: StudioAutomationPoint
  readonly x: number
  readonly y: number
  readonly added: boolean
  moved: boolean
}

export function StudioLaneLine(props: StudioLaneLineProps) {
  let area!: HTMLDivElement
  let hand: Hand | null = null
  let keyed = false
  const [snapAt, setSnapAt] = createSignal<number | null>(null)
  const points = () => props.editor.draft() ?? props.actions.saved()
  const selected = () => {
    const index = props.editor.selected()
    return index !== null && index < points().length ? index : null
  }
  const x = (frame: number) => frameToPixel(frame, props.scale)
  const depth = (value: number) => studioLineDepth(props.param, value)
  const span = () => Math.max(1, props.width)
  // Drawn in a box 1000 high and stretched to the lane, with strokes kept
  // their own width (vector-effect), so the line needs no measuring.
  const path = createMemo(() => {
    const line = points()
    const first = line.at(0)
    const last = line.at(-1)
    if (!first || !last) return null
    return [
      `0,${depth(first.value) * 1000}`,
      ...line.map((point) => `${x(point.frame)},${depth(point.value) * 1000}`),
      `${span()},${depth(last.value) * 1000}`,
    ].join(' ')
  })
  const rest = () =>
    depth(props.param === 'volume' ? props.track.gainDb : props.track.pan) *
    1000
  const guide = () => depth(0)
  const label = (value: number) => formatStudioLineValue(props.param, value)

  function snapFrame(frame: number, bounds: { min: number; max: number }) {
    return snapStudioPosition({
      value: frame,
      min: bounds.min,
      max: bounds.max,
      pixelsPerSecond: props.scale,
      tempoBpm: props.tempoBpm,
      playheadFrame: props.playheadFrame,
      clips: props.clips,
      excludeClipId: '',
      enabled: props.snap,
    })
  }

  function grab(event: PointerEvent, index: number, added: boolean): void {
    const base = props.editor.draft() ?? props.actions.saved()
    hand = {
      pointer: event.pointerId,
      index,
      base,
      from: base[index],
      x: event.clientX,
      y: event.clientY,
      added,
      moved: added,
    }
    props.editor.select(index)
    area.setPointerCapture(event.pointerId)
  }

  // A press on the lane adds a point there and holds it until release.
  function pressLane(event: PointerEvent): void {
    if (event.button !== 0 || !props.writable || hand) return
    event.preventDefault()
    flushKeys()
    const box = area.getBoundingClientRect()
    const line = props.actions.saved()
    const frame = snapFrame(
      ((event.clientX - box.left) / props.scale) * STUDIO_SAMPLE_RATE,
      { min: 0, max: Number.MAX_SAFE_INTEGER },
    ).value
    const value = studioLineValueAtDepth(
      props.param,
      (event.clientY - box.top) / Math.max(1, box.height),
    )
    const added = addStudioLinePoint(line, { frame, value })
    if (!added) {
      props.onStatus('A line holds up to 256 points.')
      return
    }
    props.editor.setDraft(added.points)
    grab(event, added.index, added.points !== line)
  }

  function pressPoint(event: PointerEvent, index: number): void {
    if (event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    ;(event.currentTarget as HTMLElement).focus({ preventScroll: true })
    props.editor.select(index)
    if (!props.writable || hand) return
    flushKeys()
    grab(event, index, false)
  }

  function move(event: PointerEvent): void {
    const held = hand
    if (held?.pointer !== event.pointerId) return
    const dx = event.clientX - held.x
    const dy = event.clientY - held.y
    if (!held.moved && Math.hypot(dx, dy) < DEAD_ZONE_PX) return
    held.moved = true
    const box = area.getBoundingClientRect()
    const snapped = snapFrame(
      held.from.frame + (dx / props.scale) * STUDIO_SAMPLE_RATE,
      studioLinePointBounds(held.base, held.index),
    )
    setSnapAt(snapped.target)
    const value = studioLineValueAtDepth(
      props.param,
      depth(held.from.value) + dy / Math.max(1, box.height),
    )
    props.editor.setDraft(
      moveStudioLinePoint(
        held.base,
        held.index,
        props.param,
        snapped.value,
        value,
      ),
    )
  }

  function release(event: PointerEvent): void {
    const held = hand
    if (held?.pointer !== event.pointerId) return
    hand = null
    setSnapAt(null)
    const next = props.editor.draft()
    props.editor.setDraft(null)
    if (held.moved && next && !sameStudioLine(next, props.actions.saved()))
      props.actions.commit(next)
  }

  function cancelHand(event: PointerEvent): void {
    const held = hand
    if (held?.pointer !== event.pointerId) return
    hand = null
    setSnapAt(null)
    props.editor.setDraft(null)
    if (held.added) props.editor.select(null)
  }

  // Arrow keys move a point as a draft; it saves once the key comes up.
  function flushKeys(): void {
    if (!keyed) return
    keyed = false
    const next = props.editor.draft()
    props.editor.setDraft(null)
    if (next && !sameStudioLine(next, props.actions.saved()))
      props.actions.commit(next)
  }

  function nudge(event: KeyboardEvent, index: number): boolean {
    const base = props.editor.draft() ?? props.actions.saved()
    const point = base.at(index)
    if (!point) return false
    const fine = event.shiftKey
    const value = studioLineKeyStep(props.param, fine)
    // Up the lane is louder, or further left.
    const up = props.param === 'volume' ? value : -value
    const frames = Math.max(
      1,
      Math.round(
        studioGridInterval(props.scale, props.tempoBpm) / (fine ? 10 : 1),
      ),
    )
    const change = (
      {
        ArrowUp: [0, up],
        ArrowDown: [0, -up],
        ArrowLeft: [-frames, 0],
        ArrowRight: [frames, 0],
      } as Record<string, readonly [number, number] | undefined>
    )[event.key]
    if (!change) return false
    keyed = true
    props.editor.setDraft(
      moveStudioLinePoint(
        base,
        index,
        props.param,
        point.frame + change[0],
        point.value + change[1],
      ),
    )
    return true
  }

  function keyDown(event: KeyboardEvent, index: number): void {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      if (keyed) {
        keyed = false
        props.editor.setDraft(null)
      } else props.onClose()
      return
    }
    if (!props.writable || hand) return
    const remove = event.key === 'Delete' || event.key === 'Backspace'
    if (remove || nudge(event, index)) {
      event.preventDefault()
      event.stopPropagation()
    }
    if (remove && !event.repeat) {
      flushKeys()
      props.actions.remove(index)
    }
  }

  const readout = () => {
    const index = selected()
    if (index === null) return null
    const point = points()[index]
    return {
      left: x(point.frame),
      depth: depth(point.value),
      text: `${label(point.value)} at ${formatStudioMoment(point.frame)}`,
    }
  }

  return (
    <div
      ref={area}
      class={styles.area}
      classList={{
        [styles.touch]: props.touch,
        [styles.readOnly]: !props.writable,
      }}
      role="group"
      aria-label={`${props.track.name} ${props.param} line`}
      data-studio-line={props.param}
      onPointerDown={pressLane}
      onPointerMove={move}
      onPointerUp={release}
      onPointerCancel={cancelHand}
      onLostPointerCapture={release}
    >
      <svg
        class={styles.drawing}
        viewBox={`0 0 ${span()} 1000`}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <line
          class={styles.guide}
          x1="0"
          x2={span()}
          y1={guide() * 1000}
          y2={guide() * 1000}
          vector-effect="non-scaling-stroke"
        />
        <Show
          when={path()}
          fallback={
            <line
              class={styles.rest}
              x1="0"
              x2={span()}
              y1={rest()}
              y2={rest()}
              vector-effect="non-scaling-stroke"
            />
          }
        >
          {(line) => (
            <polyline
              class={styles.line}
              points={line()}
              vector-effect="non-scaling-stroke"
            />
          )}
        </Show>
      </svg>
      <span
        class={styles.scale}
        style={{ left: `${props.scroll + 6}px` }}
        aria-hidden="true"
      >
        <span class={styles.scaleTop}>{SCALE[props.param][0]}</span>
        <span class={styles.scaleGuide} style={{ top: `${guide() * 100}%` }}>
          {SCALE[props.param][1]}
        </span>
        <span class={styles.scaleFoot}>{SCALE[props.param][2]}</span>
      </span>
      <Show when={snapAt() !== null}>
        <span
          class={styles.snapMark}
          style={{ left: `${x(snapAt() ?? 0)}px` }}
          aria-hidden="true"
        />
      </Show>
      <Show when={points().length === 0}>
        <p class={styles.hint} style={{ left: `${props.scroll + 56}px` }}>
          {props.writable
            ? `${props.touch ? 'Tap' : 'Click'} to add a point, then drag it. ${
                props.param === 'volume'
                  ? 'Higher is louder.'
                  : 'Up is left, down is right.'
              }`
            : `No ${props.param} line yet.`}
        </p>
      </Show>
      <Index each={points()}>
        {(point, index) => (
          <button
            type="button"
            class={styles.point}
            classList={{ [styles.pointSelected]: selected() === index }}
            data-studio-line-point={index}
            style={{
              left: `${x(point().frame)}px`,
              top: `${depth(point().value) * 100}%`,
            }}
            aria-label={`${NAMES[props.param]} point at ${formatStudioMoment(point().frame)}, ${label(point().value)}`}
            title="Drag to move it. Arrow keys nudge it; Delete removes it."
            onPointerDown={(event) => pressPoint(event, index)}
            onFocus={() => props.editor.select(index)}
            onKeyDown={(event) => keyDown(event, index)}
            onKeyUp={(event) => {
              if (event.key.startsWith('Arrow')) flushKeys()
            }}
            onBlur={flushKeys}
          />
        )}
      </Index>
      <Show when={readout()}>
        {(shown) => (
          <span
            class={styles.readout}
            classList={{ [styles.readoutBelow]: shown().depth < 0.4 }}
            style={{
              left: `${shown().left}px`,
              top: `${shown().depth * 100}%`,
            }}
            aria-hidden="true"
          >
            {shown().text}
          </span>
        )}
      </Show>
    </div>
  )
}
