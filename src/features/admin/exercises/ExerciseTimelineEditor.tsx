import type { Component } from 'solid-js'
import { createEffect, createMemo, For, onCleanup, onMount, Show, } from 'solid-js'
import { PITCH_VISUAL_COLORS } from '@/features/stem-mixer/pitch-canvas-visuals'
import type { ZenExerciseDefinition, ZenExerciseTarget, } from '@/features/zen/types'
import { createDprWatcher, createRedrawScheduler, syncCanvasBacking, } from '@/lib/canvas-size-sync'
import { midiToNote } from '@/lib/scale-data'
import { convertExerciseTarget, createGlideTarget, createNoteTarget, duplicateExerciseTarget, exerciseTargetKind, findExerciseTarget, MIN_TARGET_DURATION_BEATS, moveExerciseTarget, removeExerciseTarget, resizeExerciseTarget, snapTimelineBeat, TIMELINE_SNAP_BEATS, updateExerciseTarget, } from './exercise-authoring-model'
import styles from './ExerciseTimelineEditor.module.css'

export interface ExerciseTimelineEditorProps {
  value: ZenExerciseDefinition
  selectedTargetId: string | null
  onSelectedTargetIdChange: (targetId: string | null) => void
  onChange: (value: ZenExerciseDefinition) => void
  readOnly?: boolean
}

interface TimelinePitchScale {
  minSemitone: number
  maxSemitone: number
  rowCount: number
}

interface TimelineLayout {
  width: number
  height: number
  left: number
  right: number
  top: number
  bottom: number
  plotWidth: number
  plotHeight: number
  scale: TimelinePitchScale
  beatToX: (beat: number) => number
  xToBeat: (x: number) => number
  semitoneToY: (semitone: number) => number
  yToSemitone: (y: number) => number
}

interface TargetGeometry {
  target: ZenExerciseTarget
  startX: number
  endX: number
  startY: number
  endY: number
}

interface TimelineDrag {
  pointerId: number
  target: ZenExerciseTarget
  zone: 'start' | 'body' | 'end'
  pointerStartBeat: number
  pointerStartSemitone: number
}

interface EmptyTimelinePress {
  pointerId: number
  startX: number
  startY: number
  moved: boolean
}

const MIN_VISIBLE_SEMITONE = -12
const MAX_VISIBLE_SEMITONE = 12
const MIN_VISIBLE_ROWS = 25
const HANDLE_HIT_PX = 11
const TARGET_HIT_PX = 12
const CLICK_MOVE_TOLERANCE_PX = 5

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value))

const formatBeat = (beat: number): string => {
  const rounded = Math.round(beat * 100) / 100
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2)
}

const signedSemitone = (semitone: number): string =>
  semitone > 0 ? `+${semitone}` : String(semitone)

const targetPitchLabel = (
  exercise: ZenExerciseDefinition,
  semitone: number,
): string => {
  const note = midiToNote(exercise.defaultRootMidi + semitone)
  return `${signedSemitone(semitone)} · ${note.name}${note.octave}`
}

const timelineScale = (
  targets: readonly ZenExerciseTarget[],
): TimelinePitchScale => {
  const values = targets.flatMap((target) => [
    target.semitone,
    target.endSemitone ?? target.semitone,
  ])
  let minSemitone =
    values.length === 0
      ? MIN_VISIBLE_SEMITONE
      : Math.min(MIN_VISIBLE_SEMITONE, ...values) - 2
  let maxSemitone =
    values.length === 0
      ? MAX_VISIBLE_SEMITONE
      : Math.max(MAX_VISIBLE_SEMITONE, ...values) + 2
  const missing = MIN_VISIBLE_ROWS - (maxSemitone - minSemitone + 1)
  if (missing > 0) {
    minSemitone -= Math.floor(missing / 2)
    maxSemitone += Math.ceil(missing / 2)
  }
  minSemitone = Math.floor(minSemitone)
  maxSemitone = Math.ceil(maxSemitone)
  return {
    minSemitone,
    maxSemitone,
    rowCount: maxSemitone - minSemitone + 1,
  }
}

const createTimelineLayout = (
  width: number,
  height: number,
  exercise: ZenExerciseDefinition,
): TimelineLayout => {
  const left = width < 620 ? 48 : 64
  const right = 14
  const top = 28
  const bottom = 26
  const plotWidth = Math.max(1, width - left - right)
  const plotHeight = Math.max(1, height - top - bottom)
  const scale = timelineScale(exercise.targets)
  const loopBeats = Math.max(TIMELINE_SNAP_BEATS, exercise.loopBeats)
  const rowHeight = plotHeight / scale.rowCount

  return {
    width,
    height,
    left,
    right,
    top,
    bottom,
    plotWidth,
    plotHeight,
    scale,
    beatToX: (beat) => left + clamp(beat / loopBeats, 0, 1) * plotWidth,
    xToBeat: (x) => clamp((x - left) / plotWidth, 0, 1) * loopBeats,
    semitoneToY: (semitone) =>
      top + (scale.maxSemitone - semitone + 0.5) * rowHeight,
    yToSemitone: (y) =>
      Math.round(
        scale.maxSemitone - clamp((y - top) / rowHeight, 0, scale.rowCount - 1),
      ),
  }
}

const targetGeometry = (
  target: ZenExerciseTarget,
  layout: TimelineLayout,
): TargetGeometry => ({
  target,
  startX: layout.beatToX(target.startBeat),
  endX: layout.beatToX(target.startBeat + target.durationBeats),
  startY: layout.semitoneToY(target.semitone),
  endY: layout.semitoneToY(target.endSemitone ?? target.semitone),
})

const pointSegmentDistance = (
  x: number,
  y: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): number => {
  const dx = x2 - x1
  const dy = y2 - y1
  if (dx === 0 && dy === 0) return Math.hypot(x - x1, y - y1)
  const position = clamp(
    ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy),
    0,
    1,
  )
  return Math.hypot(x - (x1 + position * dx), y - (y1 + position * dy))
}

const roundedRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void => {
  const r = Math.min(radius, width / 2, height / 2)
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + width - r, y)
  ctx.quadraticCurveTo(x + width, y, x + width, y + r)
  ctx.lineTo(x + width, y + height - r)
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height)
  ctx.lineTo(x + r, y + height)
  ctx.quadraticCurveTo(x, y + height, x, y + height - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

export const ExerciseTimelineEditor: Component<ExerciseTimelineEditorProps> = (
  props,
) => {
  let canvas: HTMLCanvasElement | undefined
  let timelineSurface: HTMLDivElement | undefined
  let observer: ResizeObserver | null = null
  let drag: TimelineDrag | null = null
  let emptyPress: EmptyTimelinePress | null = null

  const selectedTarget = createMemo(() =>
    findExerciseTarget(props.value, props.selectedTargetId),
  )

  const selectedSummary = createMemo(() => {
    const target = selectedTarget()
    if (target === null) {
      return `${props.value.targets.length} target${
        props.value.targets.length === 1 ? '' : 's'
      }. No target selected.`
    }
    const kind = exerciseTargetKind(target)
    return `${kind === 'glide' ? 'Glide' : 'Note'} ${target.id} selected. Beat ${formatBeat(
      target.startBeat,
    )}, duration ${formatBeat(target.durationBeats)} beats, pitch ${targetPitchLabel(
      props.value,
      target.semitone,
    )}, cue ${target.cue || 'empty'}.`
  })

  const getCanvasLayout = (): TimelineLayout | null => {
    if (canvas === undefined) return null
    const rect = canvas.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return null
    return createTimelineLayout(rect.width, rect.height, props.value)
  }

  const draw = (): void => {
    if (canvas === undefined) return
    const dpr = Math.max(1, window.devicePixelRatio || 1)
    syncCanvasBacking(canvas, dpr)
    const layout = getCanvasLayout()
    if (layout === null) return
    const ctx = canvas.getContext('2d')
    if (ctx === null) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, layout.width, layout.height)

    const background = ctx.createLinearGradient(0, 0, 0, layout.height)
    background.addColorStop(0, '#0d131e')
    background.addColorStop(1, '#070a10')
    ctx.fillStyle = background
    ctx.fillRect(0, 0, layout.width, layout.height)

    const rowHeight = layout.plotHeight / layout.scale.rowCount
    ctx.font = '600 9px ui-monospace, SFMono-Regular, Menlo, monospace'
    ctx.textAlign = 'right'
    ctx.textBaseline = 'middle'
    for (
      let semitone = layout.scale.minSemitone;
      semitone <= layout.scale.maxSemitone;
      semitone += 1
    ) {
      const y = layout.semitoneToY(semitone)
      const isRoot = semitone === 0
      ctx.strokeStyle = isRoot
        ? 'rgba(245, 158, 11, 0.34)'
        : 'rgba(92, 109, 136, 0.14)'
      ctx.lineWidth = isRoot ? 1.1 : 0.65
      ctx.beginPath()
      ctx.moveTo(layout.left, Math.round(y) + 0.5)
      ctx.lineTo(layout.width - layout.right, Math.round(y) + 0.5)
      ctx.stroke()
      if (isRoot || semitone % 3 === 0) {
        ctx.fillStyle = isRoot
          ? 'rgba(255, 214, 143, 0.92)'
          : 'rgba(154, 169, 193, 0.62)'
        const note = midiToNote(props.value.defaultRootMidi + semitone)
        ctx.fillText(
          `${signedSemitone(semitone)} ${note.name}${note.octave}`,
          layout.left - 7,
          y,
        )
      }
    }

    const loopBeats = Math.max(TIMELINE_SNAP_BEATS, props.value.loopBeats)
    const beatLines = Math.ceil(loopBeats / TIMELINE_SNAP_BEATS)
    for (let index = 0; index <= beatLines; index += 1) {
      const beat = index * TIMELINE_SNAP_BEATS
      if (beat > loopBeats) break
      const x = layout.beatToX(beat)
      const isBar = Math.abs(beat % 4) < 0.001
      const isBeat = Math.abs(beat % 1) < 0.001
      ctx.strokeStyle = isBar
        ? 'rgba(117, 139, 174, 0.34)'
        : isBeat
          ? 'rgba(92, 109, 136, 0.2)'
          : 'rgba(92, 109, 136, 0.08)'
      ctx.lineWidth = isBar ? 1 : 0.65
      ctx.beginPath()
      ctx.moveTo(Math.round(x) + 0.5, layout.top)
      ctx.lineTo(Math.round(x) + 0.5, layout.top + layout.plotHeight)
      ctx.stroke()
      if (isBeat) {
        ctx.fillStyle = 'rgba(154, 169, 193, 0.72)'
        ctx.textAlign = beat === 0 ? 'left' : 'center'
        ctx.textBaseline = 'bottom'
        ctx.fillText(formatBeat(beat), x, layout.top - 7)
      }
    }

    ctx.save()
    ctx.beginPath()
    ctx.rect(layout.left, layout.top, layout.plotWidth, layout.plotHeight)
    ctx.clip()
    for (const target of props.value.targets) {
      const geometry = targetGeometry(target, layout)
      const selected = target.id === props.selectedTargetId
      const isGlide = exerciseTargetKind(target) === 'glide'
      ctx.save()
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.shadowColor = PITCH_VISUAL_COLORS.reference
      ctx.shadowBlur = selected ? 12 : 5

      if (isGlide) {
        ctx.strokeStyle = selected
          ? PITCH_VISUAL_COLORS.selection
          : PITCH_VISUAL_COLORS.referenceBright
        ctx.lineWidth = selected ? 7 : 5
        ctx.beginPath()
        ctx.moveTo(geometry.startX, geometry.startY)
        ctx.lineTo(geometry.endX, geometry.endY)
        ctx.stroke()
      } else {
        const height = Math.max(12, Math.min(20, rowHeight * 0.72))
        roundedRect(
          ctx,
          geometry.startX,
          geometry.startY - height / 2,
          Math.max(6, geometry.endX - geometry.startX),
          height,
          height / 2,
        )
        ctx.fillStyle = PITCH_VISUAL_COLORS.referenceFill
        ctx.fill()
        ctx.strokeStyle = selected
          ? PITCH_VISUAL_COLORS.selection
          : PITCH_VISUAL_COLORS.referenceBright
        ctx.lineWidth = selected ? 2 : 1
        ctx.stroke()
      }

      ctx.shadowBlur = 0
      if (selected) {
        ctx.fillStyle = PITCH_VISUAL_COLORS.selection
        for (const [x, y] of [
          [geometry.startX, geometry.startY],
          [geometry.endX, geometry.endY],
        ]) {
          ctx.beginPath()
          ctx.arc(x, y, 4.5, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      if (target.showCue !== false && target.cue.trim() !== '') {
        ctx.fillStyle = '#fff1d2'
        ctx.font = '700 10px Inter, system-ui, sans-serif'
        ctx.textAlign = 'left'
        ctx.textBaseline = isGlide ? 'bottom' : 'middle'
        ctx.fillText(
          target.cue,
          geometry.startX + 7,
          isGlide ? geometry.startY - 8 : geometry.startY,
        )
      }
      ctx.restore()
    }
    ctx.restore()

    ctx.fillStyle = 'rgba(142, 154, 174, 0.78)'
    ctx.font = '600 9px ui-monospace, SFMono-Regular, Menlo, monospace'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'alphabetic'
    ctx.fillText('Beats', layout.left, layout.height - 7)
    ctx.textAlign = 'right'
    ctx.fillText(
      `${formatBeat(props.value.loopBeats)} beat loop`,
      layout.width - layout.right,
      layout.height - 7,
    )
  }

  const redraw = createRedrawScheduler(draw)

  createEffect(() => {
    const reactiveInputs = [props.value, props.selectedTargetId] as const
    void reactiveInputs
    redraw.queue()
  })

  onMount(() => {
    if (canvas === undefined) return
    observer = new ResizeObserver(() => redraw.queue())
    observer.observe(canvas)
    const dprWatcher =
      typeof window.matchMedia === 'function'
        ? createDprWatcher(() => redraw.queue())
        : null
    window.addEventListener('resize', redraw.queue)
    redraw.queue()
    onCleanup(() => {
      dprWatcher?.dispose()
      window.removeEventListener('resize', redraw.queue)
    })
  })

  onCleanup(() => {
    observer?.disconnect()
    redraw.cancel()
  })

  const pointerPosition = (
    event: PointerEvent,
  ): { x: number; y: number; layout: TimelineLayout } | null => {
    if (canvas === undefined) return null
    const rect = canvas.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return null
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
      layout: createTimelineLayout(rect.width, rect.height, props.value),
    }
  }

  const hitTarget = (
    x: number,
    y: number,
    layout: TimelineLayout,
  ): { target: ZenExerciseTarget; zone: TimelineDrag['zone'] } | null => {
    for (const target of [...props.value.targets].reverse()) {
      const geometry = targetGeometry(target, layout)
      if (
        Math.hypot(x - geometry.startX, y - geometry.startY) <= HANDLE_HIT_PX
      ) {
        return { target, zone: 'start' }
      }
      if (Math.hypot(x - geometry.endX, y - geometry.endY) <= HANDLE_HIT_PX) {
        return { target, zone: 'end' }
      }
      const isGlide = exerciseTargetKind(target) === 'glide'
      const hit = isGlide
        ? pointSegmentDistance(
            x,
            y,
            geometry.startX,
            geometry.startY,
            geometry.endX,
            geometry.endY,
          ) <= TARGET_HIT_PX
        : x >= geometry.startX &&
          x <= geometry.endX &&
          Math.abs(y - geometry.startY) <= TARGET_HIT_PX
      if (hit) return { target, zone: 'body' }
    }
    return null
  }

  const isInsidePlot = (
    x: number,
    y: number,
    layout: TimelineLayout,
  ): boolean =>
    x >= layout.left &&
    x <= layout.left + layout.plotWidth &&
    y >= layout.top &&
    y <= layout.top + layout.plotHeight

  const onPointerDown = (event: PointerEvent): void => {
    const position = pointerPosition(event)
    if (position === null || canvas === undefined) return
    const hit = hitTarget(position.x, position.y, position.layout)
    if (hit === null) {
      props.onSelectedTargetIdChange(null)
      timelineSurface?.focus()
      redraw.queue()
      if (
        props.readOnly === true ||
        !isInsidePlot(position.x, position.y, position.layout)
      ) {
        return
      }
      emptyPress = {
        pointerId: event.pointerId,
        startX: position.x,
        startY: position.y,
        moved: false,
      }
      canvas.setPointerCapture(event.pointerId)
      event.preventDefault()
      return
    }
    emptyPress = null
    props.onSelectedTargetIdChange(hit.target.id)
    timelineSurface?.focus()
    if (props.readOnly === true) return
    drag = {
      pointerId: event.pointerId,
      target: { ...hit.target },
      zone: hit.zone,
      pointerStartBeat: position.layout.xToBeat(position.x),
      pointerStartSemitone: position.layout.yToSemitone(position.y),
    }
    canvas.setPointerCapture(event.pointerId)
    event.preventDefault()
  }

  const onPointerMove = (event: PointerEvent): void => {
    if (emptyPress !== null && emptyPress.pointerId === event.pointerId) {
      const position = pointerPosition(event)
      if (
        position !== null &&
        Math.hypot(
          position.x - emptyPress.startX,
          position.y - emptyPress.startY,
        ) > CLICK_MOVE_TOLERANCE_PX
      ) {
        emptyPress.moved = true
      }
      event.preventDefault()
      return
    }
    if (
      drag === null ||
      drag.pointerId !== event.pointerId ||
      props.readOnly === true
    ) {
      return
    }
    const position = pointerPosition(event)
    if (position === null) return
    const beat = snapTimelineBeat(position.layout.xToBeat(position.x))
    const semitone = position.layout.yToSemitone(position.y)
    const original = drag.target

    if (drag.zone === 'body') {
      let deltaBeat = snapTimelineBeat(beat - drag.pointerStartBeat)
      let deltaSemitone = semitone - drag.pointerStartSemitone
      if (event.shiftKey) {
        if (Math.abs(deltaBeat) >= Math.abs(deltaSemitone)) {
          deltaSemitone = 0
        } else {
          deltaBeat = 0
        }
      }
      props.onChange(
        updateExerciseTarget(props.value, original.id, {
          startBeat: original.startBeat + deltaBeat,
          semitone: original.semitone + deltaSemitone,
          ...(original.endSemitone === undefined
            ? {}
            : {
                endSemitone: original.endSemitone + deltaSemitone,
              }),
        }),
      )
    } else if (drag.zone === 'start') {
      const endBeat = original.startBeat + original.durationBeats
      const nextStart = Math.min(beat, endBeat - TIMELINE_SNAP_BEATS)
      props.onChange(
        updateExerciseTarget(props.value, original.id, {
          startBeat: nextStart,
          durationBeats: endBeat - nextStart,
          semitone,
        }),
      )
    } else {
      props.onChange(
        updateExerciseTarget(props.value, original.id, {
          durationBeats: Math.max(
            TIMELINE_SNAP_BEATS,
            beat - original.startBeat,
          ),
          ...(original.endSemitone === undefined
            ? {}
            : { endSemitone: semitone }),
        }),
      )
    }
    event.preventDefault()
  }

  const releasePointer = (pointerId: number): void => {
    try {
      canvas?.releasePointerCapture(pointerId)
    } catch {
      // The browser may already have released a cancelled pointer.
    }
  }

  const endPointerInteraction = (
    event: PointerEvent,
    cancelled = false,
  ): void => {
    if (emptyPress !== null && emptyPress.pointerId === event.pointerId) {
      const press = emptyPress
      emptyPress = null
      releasePointer(event.pointerId)
      if (cancelled || press.moved || props.readOnly === true) return
      const position = pointerPosition(event)
      if (
        position === null ||
        !isInsidePlot(position.x, position.y, position.layout)
      ) {
        return
      }
      selectCreatedTarget(
        props.value,
        createNoteTarget(props.value, {
          atBeat: snapTimelineBeat(position.layout.xToBeat(position.x)),
          semitone: position.layout.yToSemitone(position.y),
        }),
      )
      return
    }
    if (drag === null || drag.pointerId !== event.pointerId) return
    drag = null
    releasePointer(event.pointerId)
  }

  const selectCreatedTarget = (
    previous: ZenExerciseDefinition,
    next: ZenExerciseDefinition,
  ): void => {
    const previousIds = new Set(previous.targets.map((target) => target.id))
    const created = next.targets.find((target) => !previousIds.has(target.id))
    props.onChange(next)
    if (created !== undefined) {
      props.onSelectedTargetIdChange(created.id)
    }
  }

  const addNote = (): void => {
    if (props.readOnly === true) return
    selectCreatedTarget(props.value, createNoteTarget(props.value))
  }

  const addGlide = (): void => {
    if (props.readOnly === true) return
    selectCreatedTarget(props.value, createGlideTarget(props.value))
  }

  const duplicateSelected = (): void => {
    const target = selectedTarget()
    if (target === null || props.readOnly === true) return
    selectCreatedTarget(
      props.value,
      duplicateExerciseTarget(props.value, target.id),
    )
  }

  const removeSelected = (): void => {
    const target = selectedTarget()
    if (target === null || props.readOnly === true) return
    props.onChange(removeExerciseTarget(props.value, target.id))
    props.onSelectedTargetIdChange(null)
  }

  const onTimelineKeyDown = (event: KeyboardEvent): void => {
    if (props.readOnly === true) return
    const target = selectedTarget()
    const modifier = event.ctrlKey || event.metaKey

    if (!modifier && event.key.toLowerCase() === 'n') {
      event.preventDefault()
      addNote()
      return
    }
    if (!modifier && event.key.toLowerCase() === 'g') {
      event.preventDefault()
      addGlide()
      return
    }
    if (modifier && event.key.toLowerCase() === 'd' && target !== null) {
      event.preventDefault()
      duplicateSelected()
      return
    }
    if (
      target !== null &&
      (event.key === 'Delete' || event.key === 'Backspace')
    ) {
      event.preventDefault()
      removeSelected()
      return
    }
    if (target === null) return

    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault()
      props.onChange(
        moveExerciseTarget(
          props.value,
          target.id,
          0,
          event.key === 'ArrowUp' ? 1 : -1,
        ),
      )
      return
    }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault()
      const delta =
        event.key === 'ArrowLeft' ? -TIMELINE_SNAP_BEATS : TIMELINE_SNAP_BEATS
      if (event.shiftKey) {
        props.onChange(
          resizeExerciseTarget(
            props.value,
            target.id,
            'end',
            target.startBeat + target.durationBeats + delta,
          ),
        )
      } else {
        props.onChange(moveExerciseTarget(props.value, target.id, delta, 0))
      }
    }
  }

  return (
    <section class={styles.root} aria-labelledby="exercise-timeline-heading">
      <header class={styles.header}>
        <div>
          <h3 id="exercise-timeline-heading">Pitch timeline</h3>
          <p>
            Click empty grid space to add a note. Drag a target to move and
            retune it; drag either handle to change timing.
          </p>
        </div>
        <div class={styles.tools} aria-label="Timeline target tools">
          <button
            type="button"
            disabled={props.readOnly === true}
            onClick={addNote}
            title="Add note target (N)"
          >
            Add note
            <kbd>N</kbd>
          </button>
          <button
            type="button"
            disabled={props.readOnly === true}
            onClick={addGlide}
            title="Add glide target (G)"
          >
            Add glide
            <kbd>G</kbd>
          </button>
        </div>
      </header>

      <div
        ref={timelineSurface}
        class={styles.timelineSurface}
        data-testid="exercise-authoring-timeline"
        role="group"
        aria-label="Exercise timeline"
        aria-describedby="exercise-timeline-help exercise-timeline-status"
        tabindex="0"
        onKeyDown={onTimelineKeyDown}
      >
        <canvas
          ref={canvas}
          class={styles.canvas}
          aria-hidden="true"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endPointerInteraction}
          onPointerCancel={(event) => endPointerInteraction(event, true)}
        />
      </div>
      <p id="exercise-timeline-help" class={styles.keyboardHelp}>
        Click empty grid space to add a note. Arrow keys move a selected target;
        up and down retune it. Hold Shift with left or right to resize. Delete
        removes and Control or Command D duplicates.
      </p>
      <p
        id="exercise-timeline-status"
        class={styles.srStatus}
        aria-live="polite"
      >
        {selectedSummary()}
      </p>

      <div class={styles.eventListHeading}>
        <div>
          <h4>Precise event rows</h4>
          <p>Every visual edit is available here with exact values.</p>
        </div>
        <span>
          {props.value.targets.length} target
          {props.value.targets.length === 1 ? '' : 's'}
        </span>
      </div>

      <div class={styles.eventList}>
        <For
          each={props.value.targets}
          fallback={
            <div class={styles.empty}>
              <strong>No pitch targets yet</strong>
              <span>
                Add a note or glide. Empty beats before, after, or between
                targets are rests.
              </span>
            </div>
          }
        >
          {(target) => {
            const kind = () => exerciseTargetKind(target)
            const selected = () => props.selectedTargetId === target.id
            return (
              <article
                class={styles.eventRow}
                classList={{ [styles.selected]: selected() }}
                aria-label={`${kind()} ${target.id}`}
                onClick={() => props.onSelectedTargetIdChange(target.id)}
                onFocusIn={() => props.onSelectedTargetIdChange(target.id)}
              >
                <label>
                  <span>Type</span>
                  <select
                    value={kind()}
                    disabled={props.readOnly === true}
                    aria-label={`Type for ${target.id}`}
                    onChange={(event) =>
                      props.onChange(
                        convertExerciseTarget(
                          props.value,
                          target.id,
                          event.currentTarget.value as 'note' | 'glide',
                        ),
                      )
                    }
                  >
                    <option value="note">Note</option>
                    <option value="glide">Glide</option>
                  </select>
                </label>

                <label class={styles.cueField}>
                  <span>Cue</span>
                  <input
                    value={target.cue}
                    disabled={props.readOnly === true}
                    aria-label={`Cue for ${target.id}`}
                    onInput={(event) =>
                      props.onChange(
                        updateExerciseTarget(props.value, target.id, {
                          cue: event.currentTarget.value,
                        }),
                      )
                    }
                  />
                </label>

                <label>
                  <span>Start beat</span>
                  <input
                    type="number"
                    min="0"
                    step="0.05"
                    value={target.startBeat}
                    disabled={props.readOnly === true}
                    aria-label={`Start beat for ${target.id}`}
                    onChange={(event) =>
                      props.onChange(
                        updateExerciseTarget(props.value, target.id, {
                          startBeat: Number(event.currentTarget.value),
                        }),
                      )
                    }
                  />
                </label>

                <label>
                  <span>Duration</span>
                  <input
                    type="number"
                    min={MIN_TARGET_DURATION_BEATS}
                    step={MIN_TARGET_DURATION_BEATS}
                    value={target.durationBeats}
                    disabled={props.readOnly === true}
                    aria-label={`Duration in beats for ${target.id}`}
                    onChange={(event) =>
                      props.onChange(
                        updateExerciseTarget(props.value, target.id, {
                          durationBeats: Number(event.currentTarget.value),
                        }),
                      )
                    }
                  />
                </label>

                <label class={styles.pitchField}>
                  <span class={styles.pitchFieldHeading}>
                    <span>Start pitch</span>
                    <small>
                      {targetPitchLabel(props.value, target.semitone)}
                    </small>
                  </span>
                  <input
                    type="number"
                    step="1"
                    value={target.semitone}
                    disabled={props.readOnly === true}
                    aria-label={`Start semitone for ${target.id}`}
                    onChange={(event) =>
                      props.onChange(
                        updateExerciseTarget(props.value, target.id, {
                          semitone: Number(event.currentTarget.value),
                        }),
                      )
                    }
                  />
                </label>

                <Show
                  when={target.endSemitone !== undefined}
                  fallback={
                    <div
                      class={`${styles.endPitchField} ${styles.endPitchPlaceholder}`}
                    >
                      <span class={styles.pitchFieldHeading}>
                        <span>End pitch</span>
                        <small>Same as start</small>
                      </span>
                    </div>
                  }
                >
                  <label class={`${styles.endPitchField} ${styles.pitchField}`}>
                    <span class={styles.pitchFieldHeading}>
                      <span>End pitch</span>
                      <small>
                        {targetPitchLabel(
                          props.value,
                          target.endSemitone ?? target.semitone,
                        )}
                      </small>
                    </span>
                    <input
                      type="number"
                      step="1"
                      value={target.endSemitone}
                      disabled={props.readOnly === true}
                      aria-label={`End semitone for ${target.id}`}
                      onChange={(event) =>
                        props.onChange(
                          updateExerciseTarget(props.value, target.id, {
                            endSemitone: Number(event.currentTarget.value),
                          }),
                        )
                      }
                    />
                  </label>
                </Show>

                <label class={styles.showCueField}>
                  <input
                    type="checkbox"
                    checked={target.showCue !== false}
                    disabled={props.readOnly === true}
                    aria-label={`Show cue for ${target.id}`}
                    onChange={(event) =>
                      props.onChange(
                        updateExerciseTarget(props.value, target.id, {
                          showCue: event.currentTarget.checked,
                        }),
                      )
                    }
                  />
                  <span>Show cue</span>
                </label>

                <div class={styles.rowActions}>
                  <button
                    type="button"
                    disabled={props.readOnly === true}
                    onClick={(event) => {
                      event.stopPropagation()
                      const next = duplicateExerciseTarget(
                        props.value,
                        target.id,
                      )
                      selectCreatedTarget(props.value, next)
                    }}
                  >
                    Duplicate
                  </button>
                  <button
                    type="button"
                    class={styles.remove}
                    disabled={props.readOnly === true}
                    onClick={(event) => {
                      event.stopPropagation()
                      props.onChange(
                        removeExerciseTarget(props.value, target.id),
                      )
                      if (selected()) {
                        props.onSelectedTargetIdChange(null)
                      }
                    }}
                  >
                    Remove
                  </button>
                </div>
              </article>
            )
          }}
        </For>
      </div>
    </section>
  )
}
