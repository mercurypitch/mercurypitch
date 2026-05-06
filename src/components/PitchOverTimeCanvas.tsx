// ============================================================
// PitchOverTimeCanvas — Scrolling pitch-over-time timeline
// ============================================================

import type { Component } from 'solid-js'
import { createSignal, onCleanup, onMount } from 'solid-js'
import type { TimeStampedPitchSample } from '@/types/pitch-algorithms'
import type { ScaleDegree } from '@/types'

interface PitchOverTimeCanvasProps {
  samples: () => TimeStampedPitchSample[]
  isDetecting: () => boolean
  visibleWindowSeconds?: number
  zoomLevel?: () => number
  onZoomChange?: (level: number) => void
  scaleNotes?: () => ScaleDegree[]
}

const Y_AXIS_NOTES = [
  { label: 'C2', freq: 65.41 },
  { label: 'C3', freq: 130.81 },
  { label: 'C4', freq: 261.63 },
  { label: 'C5', freq: 523.25 },
  { label: 'C6', freq: 1046.5 },
  { label: 'C7', freq: 2093.0 },
]

const MIN_FREQ = 55      // A1
const MAX_FREQ = 2093    // C7
const LOG_MIN = Math.log2(MIN_FREQ)
const LOG_MAX = Math.log2(MAX_FREQ)
const LOG_RANGE = LOG_MAX - LOG_MIN

const MARGIN = 32

const DOT_RADIUS = 3
const GLOW_RADIUS = 12

const ZOOM_STEPS = [1, 2, 3, 5, 8]

export const PitchOverTimeCanvas: Component<PitchOverTimeCanvasProps> = (
  props,
) => {
  let canvasRef: HTMLCanvasElement | undefined
  let ctx: CanvasRenderingContext2D | null = null
  let animFrameId: number | null = null
  let resizeObserver: ResizeObserver | null = null

  const [internalZoomLevel, setInternalZoomLevel] = createSignal(1)

  const currentZoom = () => props.zoomLevel?.() ?? internalZoomLevel()

  const visibleWindow = () => props.visibleWindowSeconds ?? 10

  const setZoom = (level: number) => {
    setInternalZoomLevel(level)
    props.onZoomChange?.(level)
  }

  const handleWheel = (e: WheelEvent) => {
    e.preventDefault()
    const current = currentZoom()
    const idx = ZOOM_STEPS.indexOf(current)
    if (e.deltaY < 0 && idx < ZOOM_STEPS.length - 1) {
      setZoom(ZOOM_STEPS[idx + 1]!)
    } else if (e.deltaY > 0 && idx > 0) {
      setZoom(ZOOM_STEPS[idx - 1]!)
    }
  }

  onMount(() => {
    if (!canvasRef) return
    ctx = canvasRef.getContext('2d')
    canvasRef.addEventListener('wheel', handleWheel, { passive: false })
    resizeCanvas()
    startDrawLoop()

    resizeObserver = new ResizeObserver(() => resizeCanvas())
    resizeObserver.observe(canvasRef.parentElement!)

    onCleanup(() => {
      resizeObserver?.disconnect()
      if (animFrameId !== null) cancelAnimationFrame(animFrameId)
      canvasRef?.removeEventListener('wheel', handleWheel)
    })
  })

  const resizeCanvas = () => {
    if (!canvasRef || !ctx) return
    const dpr = window.devicePixelRatio || 1
    const w = canvasRef.parentElement!.clientWidth
    const h = canvasRef.parentElement!.clientHeight
    canvasRef.width = w * dpr
    canvasRef.height = h * dpr
    canvasRef.style.width = `${w}px`
    canvasRef.style.height = `${h}px`
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  const freqToY = (
    freq: number,
    h: number,
    logMin: number,
    logRange: number,
  ): number => {
    if (!Number.isFinite(freq) || freq <= 0) return h / 2
    const pct = (Math.log2(freq) - logMin) / logRange
    const y = h - MARGIN - pct * (h - MARGIN * 2)
    return Number.isFinite(y) ? y : h / 2
  }

  const sampleToX = (sampleTime: number, nowTime: number, w: number): number => {
    const window = visibleWindow()
    const windowStart = nowTime <= window ? 0 : nowTime - window
    const x = ((sampleTime - windowStart) / window) * w
    return Number.isFinite(x) ? x : 0
  }

  const startDrawLoop = () => {
    const draw = () => {
      if (!ctx || !canvasRef) return
      const w = canvasRef.clientWidth
      const h = canvasRef.clientHeight

      // Compute dynamic log range for zoom
      const zoom = currentZoom()
      let effLogMin = LOG_MIN
      let effLogMax = LOG_MAX
      if (zoom > 1) {
        const samples = props.samples()
        let centerFreq = 440
        for (let i = samples.length - 1; i >= 0; i--) {
          const f = samples[i]!.freq
          if (f !== null && f > 0) {
            centerFreq = f
            break
          }
        }
        const centerLog = Math.log2(centerFreq)
        const halfRange = LOG_RANGE / (2 * zoom)
        effLogMin = Math.max(LOG_MIN, centerLog - halfRange)
        effLogMax = Math.min(LOG_MAX, centerLog + halfRange)
      }
      const effLogRange = effLogMax - effLogMin

      ctx.clearRect(0, 0, w, h)
      ctx.fillStyle = '#0d1117'
      ctx.fillRect(0, 0, w, h)

      drawYAxisLabels(w, h, effLogMin, effLogRange)
      drawScaleGridLines(w, h, effLogMin, effLogRange)
      drawTimeLabels(w, h)
      drawSamples(w, h, effLogMin, effLogRange)

      animFrameId = requestAnimationFrame(draw)
    }
    animFrameId = requestAnimationFrame(draw)
  }

  const drawYAxisLabels = (
    w: number,
    h: number,
    logMin: number,
    logRange: number,
  ) => {
    if (!ctx) return

    const rightX = w - 8
    for (const note of Y_AXIS_NOTES) {
      const y = freqToY(note.freq, h, logMin, logRange)

      // Only draw labels within the visible area
      if (y < 4 || y > h - 4) continue

      // Grid line
      ctx.strokeStyle = 'rgba(48,54,61,0.7)'
      ctx.lineWidth = 1
      ctx.setLineDash([4, 6])
      ctx.beginPath()
      ctx.moveTo(MARGIN, y)
      ctx.lineTo(w - MARGIN, y)
      ctx.stroke()
      ctx.setLineDash([])

      // Label
      ctx.fillStyle = '#484f58'
      ctx.font = '10px sans-serif'
      ctx.textAlign = 'right'
      ctx.textBaseline = 'middle'
      ctx.fillText(note.label, rightX, y)
    }
  }

  const drawScaleGridLines = (
    w: number,
    h: number,
    logMin: number,
    logRange: number,
  ) => {
    if (!ctx) return
    const notes = props.scaleNotes?.()
    if (!notes || notes.length === 0) return

    // Blue scale note labels sit left of the octave labels (C2–C7)
    const scaleLabelX = w - 30

    for (const note of notes) {
      const y = freqToY(note.freq, h, logMin, logRange)
      if (y < 4 || y > h - 4) continue

      // Grid line
      ctx.strokeStyle = 'rgba(88,166,255,0.22)'
      ctx.lineWidth = 1.0
      ctx.setLineDash([3, 6])
      ctx.beginPath()
      ctx.moveTo(MARGIN, y)
      ctx.lineTo(w - MARGIN, y)
      ctx.stroke()
      ctx.setLineDash([])

      // Note label — padded left so octave labels sit rightmost
      ctx.fillStyle = 'rgba(88,166,255,0.45)'
      ctx.font = '9px sans-serif'
      ctx.textAlign = 'right'
      ctx.textBaseline = 'middle'
      ctx.fillText(note.name, scaleLabelX, y)
    }
  }

  const drawTimeLabels = (w: number, h: number) => {
    if (!ctx) return

    const samples = props.samples()
    if (samples.length === 0) return

    const nowTime = samples[samples.length - 1]!.time
    const window = visibleWindow()
    const windowStart = nowTime <= window ? 0 : nowTime - window

    // Draw tick marks at 1s intervals
    const startSec = Math.floor(windowStart)
    const endSec = Math.ceil(windowStart + window)

    ctx.fillStyle = '#484f58'
    ctx.font = '10px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'

    const tickY = h - MARGIN + 8
    for (let sec = startSec; sec <= endSec; sec++) {
      const x = ((sec - windowStart) / window) * w
      if (x < MARGIN || x > w - MARGIN) continue

      // Tick line
      ctx.strokeStyle = 'rgba(48,54,61,0.5)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(x, tickY)
      ctx.lineTo(x, tickY + 4)
      ctx.stroke()

      // Label
      ctx.fillText(`${sec.toString().padStart(2, '0')}s`, x, tickY + 4)
    }
  }

  const drawSamples = (
    w: number,
    h: number,
    logMin: number,
    logRange: number,
  ) => {
    if (!ctx) return

    const samples = props.samples()
    if (samples.length === 0) return

    const nowTime = samples[samples.length - 1]!.time

    // Collect valid points for polyline
    const validPoints: { x: number; y: number }[] = []

    for (let i = 0; i < samples.length; i++) {
      const s = samples[i]!
      const x = sampleToX(s.time, nowTime, w)

      // Skip dots outside visible area
      if (x < -10 || x > w + 10) continue

      const freq = s.freq
      if (freq !== null && freq > 0) {
        const y = freqToY(freq, h, logMin, logRange)

        // Clip dots to visible Y range
        if (y < -10 || y > h + 10) continue

        validPoints.push({ x, y })

        // Opacity from clarity
        const alpha = 0.15 + Math.min(1, s.clarity) * 0.7

        ctx.fillStyle = `rgba(88,166,255,${alpha})`
        ctx.beginPath()
        ctx.arc(x, y, DOT_RADIUS, 0, Math.PI * 2)
        ctx.fill()
      } else {
        // No detection — draw a dim marker at the bottom
        ctx.fillStyle = 'rgba(248,81,73,0.3)'
        ctx.beginPath()
        ctx.arc(x, h - MARGIN - 4, 2, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    // Draw polyline connecting valid points
    if (validPoints.length > 1) {
      ctx.strokeStyle = 'rgba(88,166,255,0.4)'
      ctx.lineWidth = 1.5
      ctx.lineJoin = 'round'
      ctx.beginPath()
      ctx.moveTo(validPoints[0]!.x, validPoints[0]!.y)
      for (let i = 1; i < validPoints.length; i++) {
        ctx.lineTo(validPoints[i]!.x, validPoints[i]!.y)
      }
      ctx.stroke()
    }

    // Glow on latest valid point + note name pill
    const isActive = props.isDetecting()
    if (isActive && validPoints.length > 0) {
      const latest = validPoints[validPoints.length - 1]!
      const grad = ctx.createRadialGradient(
        latest.x,
        latest.y,
        0,
        latest.x,
        latest.y,
        GLOW_RADIUS,
      )
      grad.addColorStop(0, 'rgba(88,166,255,0.55)')
      grad.addColorStop(1, 'rgba(88,166,255,0)')
      ctx.fillStyle = grad
      ctx.beginPath()
      ctx.arc(latest.x, latest.y, GLOW_RADIUS, 0, Math.PI * 2)
      ctx.fill()

      // Bright dot center
      ctx.fillStyle = '#a0d0ff'
      ctx.beginPath()
      ctx.arc(latest.x, latest.y, DOT_RADIUS + 1, 0, Math.PI * 2)
      ctx.fill()

      // Note name pill near latest dot
      const latestSample = samples[samples.length - 1]
      const noteName = latestSample?.noteName
      if (noteName) {
        const nearRight = latest.x > w - 70
        const labelX = nearRight ? latest.x - 14 : latest.x + 14
        const labelY = latest.y - 10

        ctx.font = 'bold 11px sans-serif'
        const textWidth = ctx.measureText(noteName).width
        const pillW = textWidth + 10
        const pillH = 18

        // Background pill
        ctx.fillStyle = 'rgba(13,17,23,0.8)'
        ctx.beginPath()
        ctx.roundRect(
          nearRight ? labelX - textWidth - 6 : labelX - 4,
          labelY - pillH / 2,
          pillW,
          pillH,
          4,
        )
        ctx.fill()

        // Pill border
        ctx.strokeStyle = 'rgba(88,166,255,0.35)'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.roundRect(
          nearRight ? labelX - textWidth - 6 : labelX - 4,
          labelY - pillH / 2,
          pillW,
          pillH,
          4,
        )
        ctx.stroke()

        // Text
        ctx.fillStyle = '#e6edf3'
        ctx.textAlign = nearRight ? 'right' : 'left'
        ctx.textBaseline = 'middle'
        ctx.fillText(noteName, labelX, labelY)
      }
    }
  }

  return <canvas ref={canvasRef} />
}
