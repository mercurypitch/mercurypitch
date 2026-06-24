// ============================================================
// AnnotationLayer — Canvas overlay for annotation rendering
// ============================================================

import type { Component } from 'solid-js'
import { createEffect, onCleanup, onMount } from 'solid-js'
import type { Annotation, Region, TimeInstant, TimeValue } from '@/types'

interface AnnotationLayerProps {
  annotations: Annotation[]
  /** Visible time range [start, end] in seconds. */
  timeRange: [number, number]
  /** Optional Y-axis range for value annotations. */
  yRange?: [number, number]
  width?: number
  height?: number
  isActive?: boolean
  selectedId?: string | null
  onSelect?: (id: string) => void
  /** Called on double-click at a time position (creates a TimeInstant). */
  onDoubleClickAt?: (time: number) => void
}

// ── Style constants ────────────────────────────────────────────

const COLORS = {
  instant: '#06b6d4', // cyan
  instantSelected: '#ffffff',
  value: '#eab308', // yellow
  region: '#f97316', // orange
  regionSelected: '#fb923c',
  regionFill: 'rgba(249, 115, 22, 0.15)',
  regionFillSelected: 'rgba(249, 115, 22, 0.30)',
  label: 'rgba(255, 255, 255, 0.8)',
}

// ── Helpers ────────────────────────────────────────────────────

function timeToX(time: number, timeRange: [number, number], w: number): number {
  return ((time - timeRange[0]) / (timeRange[1] - timeRange[0])) * w
}

function valueToY(value: number, yRange: [number, number], h: number): number {
  return h - ((value - yRange[0]) / (yRange[1] - yRange[0])) * h
}

/** Hit-test: is the point (px, py) near an annotation? Returns the annotation id or null. */
function hitTest(
  px: number,
  py: number,
  annotations: Annotation[],
  timeRange: [number, number],
  yRange: [number, number],
  w: number,
  h: number,
): string | null {
  const HIT_RADIUS = 12
  // Check in reverse order (topmost rendered last)
  for (let i = annotations.length - 1; i >= 0; i--) {
    const a = annotations[i]!
    const ax = timeToX(a.time, timeRange, w)

    if (a.type === 'instant') {
      if (Math.abs(px - ax) <= HIT_RADIUS) return a.id
    } else if (a.type === 'value') {
      const v = a as TimeValue
      const ay = valueToY(v.value, yRange, h)
      if (Math.hypot(px - ax, py - ay) <= HIT_RADIUS) return a.id
    } else {
      const r = a as Region
      const rx2 = timeToX(r.endTime, timeRange, w)
      if (px >= ax && px <= rx2) return a.id
    }
  }
  return null
}

// ── Component ──────────────────────────────────────────────────

export const AnnotationLayer: Component<AnnotationLayerProps> = (props) => {
  let canvasRef: HTMLCanvasElement | undefined
  let ctx: CanvasRenderingContext2D | null = null

  const w = () => props.width ?? 800
  const h = () => props.height ?? 200
  const timeRange = () => props.timeRange
  const yRange = () => props.yRange ?? [0, 100]

  onMount(() => {
    if (!canvasRef) return
    ctx = canvasRef.getContext('2d')
  })

  createEffect(() => {
    if (ctx === null || props.isActive !== true) return
    const c = ctx
    const width = w()
    const height = h()
    const tr = timeRange()
    const yr = yRange()

    // Clear
    c.clearRect(0, 0, width, height)

    // Draw each annotation
    for (const a of props.annotations) {
      // Skip annotations outside visible time range
      const annEnd = a.type === 'region' ? (a as Region).endTime : a.time
      if (annEnd < tr[0] || a.time > tr[1]) continue

      const x = timeToX(a.time, tr, width)
      const isSelected = a.id === props.selectedId

      if (a.type === 'instant') {
        drawTimeInstant(c, x, height, a, isSelected)
      } else if (a.type === 'value') {
        const v = a as TimeValue
        const y = valueToY(v.value, yr, height)
        drawTimeValue(c, x, y, v, isSelected)
      } else {
        const r = a as Region
        const x2 = timeToX(r.endTime, tr, width)
        drawRegion(c, x, x2, height, r, isSelected)
      }
    }
  })

  // Click handler for selection
  const handleClick = (e: MouseEvent) => {
    if (!canvasRef || !props.onSelect) return
    const rect = canvasRef.getBoundingClientRect()
    const scaleX = w() / rect.width
    const scaleY = h() / rect.height
    const px = (e.clientX - rect.left) * scaleX
    const py = (e.clientY - rect.top) * scaleY
    const id = hitTest(
      px,
      py,
      props.annotations,
      timeRange(),
      yRange(),
      w(),
      h(),
    )
    if (id !== null) props.onSelect(id)
  }

  const handleDoubleClick = (e: MouseEvent) => {
    if (!canvasRef || !props.onDoubleClickAt) return
    const rect = canvasRef.getBoundingClientRect()
    const scaleX = w() / rect.width
    const px = (e.clientX - rect.left) * scaleX
    const time = timeRange()[0] + (px / w()) * (timeRange()[1] - timeRange()[0])
    props.onDoubleClickAt(time)
  }

  onCleanup(() => {
    ctx = null
  })

  return (
    <canvas
      ref={canvasRef}
      width={w()}
      height={h()}
      onClick={handleClick}
      onDblClick={handleDoubleClick}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        'pointer-events': 'auto',
        cursor: 'crosshair',
      }}
    />
  )
}

// ── Drawing functions ──────────────────────────────────────────

function drawTimeInstant(
  c: CanvasRenderingContext2D,
  x: number,
  h: number,
  _a: TimeInstant,
  selected: boolean,
) {
  const color = selected ? COLORS.instantSelected : COLORS.instant
  c.strokeStyle = color
  c.lineWidth = selected ? 2 : 1
  c.setLineDash([4, 4])
  c.beginPath()
  c.moveTo(x, 0)
  c.lineTo(x, h)
  c.stroke()
  c.setLineDash([])

  // Diamond marker at top
  const diamondSize = selected ? 8 : 5
  c.fillStyle = color
  c.beginPath()
  c.moveTo(x, 8 + diamondSize)
  c.lineTo(x - diamondSize, 8)
  c.lineTo(x, 8 - diamondSize)
  c.lineTo(x + diamondSize, 8)
  c.closePath()
  c.fill()

  // Label
  if (_a.label != null) {
    c.fillStyle = COLORS.label
    c.font = `${selected ? 'bold ' : ''}11px sans-serif`
    c.textAlign = 'left'
    c.fillText(_a.label, x + diamondSize + 4, 12)
  }
}

function drawTimeValue(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  a: TimeValue,
  selected: boolean,
) {
  c.fillStyle = COLORS.value
  c.beginPath()
  c.arc(x, y, selected ? 5 : 3, 0, Math.PI * 2)
  c.fill()

  if (selected || a.label != null) {
    c.fillStyle = COLORS.label
    c.font = '10px sans-serif'
    c.textAlign = 'left'
    c.fillText(
      a.label ?? `${a.value}${a.valueUnit === 'cents' ? '¢' : ''}`,
      x + 8,
      y + 3,
    )
  }
}

function drawRegion(
  c: CanvasRenderingContext2D,
  x: number,
  x2: number,
  h: number,
  a: Region,
  selected: boolean,
) {
  const fill = selected ? COLORS.regionFillSelected : COLORS.regionFill
  const stroke = selected ? COLORS.regionSelected : COLORS.region

  c.fillStyle = fill
  c.fillRect(x, 0, x2 - x, h)

  c.strokeStyle = stroke
  c.lineWidth = selected ? 2 : 1
  c.strokeRect(x, 0, x2 - x, h)

  if (a.label != null) {
    c.fillStyle = COLORS.label
    c.font = `${selected ? 'bold ' : ''}10px sans-serif`
    c.textAlign = 'left'
    c.fillText(a.label, x + 4, 14)
  }
}
