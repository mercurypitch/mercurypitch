// ============================================================
// PitchOverTimeCanvas — Scrolling pitch-over-time timeline
// ============================================================

import type { Component } from 'solid-js'
import { onCleanup, onMount } from 'solid-js'
import type { TimeStampedPitchSample } from '@/types/pitch-algorithms'

interface PitchOverTimeCanvasProps {
  samples: () => TimeStampedPitchSample[]
  isDetecting: () => boolean
  visibleWindowSeconds?: number
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

export const PitchOverTimeCanvas: Component<PitchOverTimeCanvasProps> = (
  props,
) => {
  let canvasRef: HTMLCanvasElement | undefined
  let ctx: CanvasRenderingContext2D | null = null
  let animFrameId: number | null = null
  let resizeObserver: ResizeObserver | null = null

  const visibleWindow = () => props.visibleWindowSeconds ?? 10

  onMount(() => {
    if (!canvasRef) return
    ctx = canvasRef.getContext('2d')
    resizeCanvas()
    startDrawLoop()

    resizeObserver = new ResizeObserver(() => resizeCanvas())
    resizeObserver.observe(canvasRef.parentElement!)

    onCleanup(() => {
      resizeObserver?.disconnect()
      if (animFrameId !== null) cancelAnimationFrame(animFrameId)
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

  const freqToY = (freq: number, h: number): number => {
    if (!Number.isFinite(freq) || freq <= 0) return h / 2
    const pct = (Math.log2(freq) - LOG_MIN) / LOG_RANGE
    const y = h - MARGIN - pct * (h - MARGIN * 2)
    return Number.isFinite(y) ? y : h / 2
  }

  const sampleToX = (sampleTime: number, nowTime: number, w: number): number => {
    const window = visibleWindow()
    const windowStart = nowTime <= window ? 0 : nowTime - window
    const windowDuration = Math.max(nowTime, window)
    const x = ((sampleTime - windowStart) / windowDuration) * w
    return Number.isFinite(x) ? x : 0
  }

  const startDrawLoop = () => {
    const draw = () => {
      if (!ctx || !canvasRef) return
      const w = canvasRef.clientWidth
      const h = canvasRef.clientHeight

      ctx.clearRect(0, 0, w, h)
      ctx.fillStyle = '#0d1117'
      ctx.fillRect(0, 0, w, h)

      drawYAxisLabels(w, h)
      drawTimeLabels(w, h)
      drawSamples(w, h)

      animFrameId = requestAnimationFrame(draw)
    }
    animFrameId = requestAnimationFrame(draw)
  }

  const drawYAxisLabels = (w: number, h: number) => {
    if (!ctx) return

    const rightX = w - 8
    for (const note of Y_AXIS_NOTES) {
      const y = freqToY(note.freq, h)

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

  const drawTimeLabels = (w: number, h: number) => {
    if (!ctx) return

    const samples = props.samples()
    if (samples.length === 0) return

    const nowTime = samples[samples.length - 1]!.time
    const window = visibleWindow()
    const windowStart = nowTime <= window ? 0 : nowTime - window
    const windowDuration = Math.max(nowTime, window)

    // Draw tick marks at 1s intervals
    const startSec = Math.floor(windowStart)
    const endSec = Math.ceil(windowStart + windowDuration)

    ctx.fillStyle = '#484f58'
    ctx.font = '10px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'

    const tickY = h - MARGIN + 8
    for (let sec = startSec; sec <= endSec; sec++) {
      const x = ((sec - windowStart) / windowDuration) * w
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

  const drawSamples = (w: number, h: number) => {
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
        const y = freqToY(freq, h)
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

    // Glow on latest valid point
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
    }
  }

  return <canvas ref={canvasRef} />
}
