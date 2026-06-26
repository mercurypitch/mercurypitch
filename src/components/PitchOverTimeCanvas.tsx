// ============================================================
// PitchOverTimeCanvas — Scrolling pitch-over-time timeline
// ============================================================

import type { Component } from 'solid-js'
import { createSignal, onCleanup, onMount } from 'solid-js'
import type { ScaleDegree } from '@/types'
import type { TimeStampedPitchSample } from '@/types/pitch-algorithms'

interface PitchOverTimeCanvasProps {
  samples: () => TimeStampedPitchSample[]
  isDetecting: () => boolean
  visibleWindowSeconds?: number
  zoomLevel?: () => number
  onZoomChange?: (level: number) => void
  scaleNotes?: () => ScaleDegree[]
  autoZoom?: boolean
  onAutoZoomChange?: (enabled: boolean) => void
  targetNoteMidi?: () => number | undefined
  /** Optional guide frequency (Hz) that moves over time — drawn as a vertical
   *  sliding dot so the singer can follow a glide up/down. */
  movingTarget?: () => number | null
}

const Y_AXIS_NOTES = [
  { label: 'C2', freq: 65.41 },
  { label: 'C3', freq: 130.81 },
  { label: 'C4', freq: 261.63 },
  { label: 'C5', freq: 523.25 },
  { label: 'C6', freq: 1046.5 },
  { label: 'C7', freq: 2093.0 },
]

const MIN_FREQ = 55 // A1
const MAX_FREQ = 2093 // C7
const LOG_MIN = Math.log2(MIN_FREQ)
const LOG_MAX = Math.log2(MAX_FREQ)
const LOG_RANGE = LOG_MAX - LOG_MIN

const AUTO_ZOOM_WINDOW_SEC = 6
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
  // Smoothed auto-zoom bounds (log2 Hz) carried between frames so the view
  // eases into a new range instead of snapping. Reset to null when auto-zoom
  // isn't driving the range, so it re-initializes cleanly on the next entry.
  let smoothedLogMin: number | null = null
  let smoothedLogMax: number | null = null

  const [internalZoomLevel, setInternalZoomLevel] = createSignal(1)
  const [internalAutoZoom, setInternalAutoZoom] = createSignal(true)

  const currentZoom = () => props.zoomLevel?.() ?? internalZoomLevel()
  const isAutoZoom = () => props.autoZoom ?? internalAutoZoom()

  const toggleAutoZoom = () => {
    const next = !isAutoZoom()
    setInternalAutoZoom(next)
    props.onAutoZoomChange?.(next)
  }

  const visibleWindow = () => props.visibleWindowSeconds ?? 10

  const setZoom = (level: number) => {
    setInternalZoomLevel(level)
    props.onZoomChange?.(level)
  }

  const handleWheel = (e: WheelEvent) => {
    if (isAutoZoom()) return
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

  const sampleToX = (
    sampleTime: number,
    nowTime: number,
    w: number,
  ): number => {
    const window = visibleWindow()
    const windowStart = nowTime - window
    // Pin the latest sample at 45% of canvas width so the timeline
    // slides naturally — the dot never reaches the right-side labels.
    const targetRight = w * 0.45
    const effectiveWidth = targetRight - MARGIN
    const pct = Math.max(0, Math.min(1, (sampleTime - windowStart) / window))
    const x = MARGIN + pct * effectiveWidth
    return Number.isFinite(x) ? x : MARGIN
  }

  const startDrawLoop = () => {
    const draw = () => {
      if (!ctx || !canvasRef) return
      const w = canvasRef.clientWidth
      const h = canvasRef.clientHeight

      // Compute dynamic log range for zoom / auto-zoom
      const samples = props.samples()
      let effLogMin = LOG_MIN
      let effLogMax = LOG_MAX

      if (isAutoZoom()) {
        const now = samples.length > 0 ? samples[samples.length - 1]!.time : 0
        const windowStart = now - AUTO_ZOOM_WINDOW_SEC
        const recentFreqs: number[] = []
        for (let i = samples.length - 1; i >= 0; i--) {
          const s = samples[i]!
          if (s.time < windowStart) break
          if (s.freq !== null && s.freq > 0) recentFreqs.push(s.freq)
        }
        if (recentFreqs.length >= 3) {
          const minF = Math.min(...recentFreqs)
          const maxF = Math.max(...recentFreqs)
          const rangeOct = Math.log2(maxF / minF)
          const centerLog = (Math.log2(minF) + Math.log2(maxF)) / 2
          // Zoom to roughly one octave when the singer stays within a small
          // range: half the sung range plus ~4 semitones (0.33 oct) of
          // headroom each side, floored at 0.5 oct so the minimum view is
          // ~1 octave total (keeps the line off the edges).
          const halfRange = Math.max(0.5, rangeOct / 2 + 0.33)
          const targetLogMin = Math.max(LOG_MIN, centerLog - halfRange)
          const targetLogMax = Math.min(LOG_MAX, centerLog + halfRange)
          // Ease toward the target bounds to avoid jumpiness frame-to-frame.
          const SMOOTH = 0.15
          smoothedLogMin =
            smoothedLogMin == null
              ? targetLogMin
              : smoothedLogMin + (targetLogMin - smoothedLogMin) * SMOOTH
          smoothedLogMax =
            smoothedLogMax == null
              ? targetLogMax
              : smoothedLogMax + (targetLogMax - smoothedLogMax) * SMOOTH
          effLogMin = smoothedLogMin
          effLogMax = smoothedLogMax
        } else {
          smoothedLogMin = null
          smoothedLogMax = null
        }
      } else {
        smoothedLogMin = null
        smoothedLogMax = null
        const zoom = currentZoom()
        if (zoom > 1) {
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
      }
      const effLogRange = effLogMax - effLogMin

      ctx.clearRect(0, 0, w, h)
      ctx.fillStyle = '#0d1117'
      ctx.fillRect(0, 0, w, h)

      drawYAxisLabels(w, h, effLogMin, effLogRange)
      drawScaleGridLines(w, h, effLogMin, effLogRange)
      drawTargetLine(w, h, effLogMin, effLogRange)
      drawMovingTarget(w, h, effLogMin, effLogRange)
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

    // Build a set of semitone offsets and their names from the scale
    const semitoneMap = new Map<number, string>()
    for (const note of notes) {
      if (!semitoneMap.has(note.semitone)) {
        semitoneMap.set(note.semitone, note.name)
      }
    }
    const scaleLabelX = w - 30

    // Replicate scale pattern across all octaves in the visible range
    const logMax = logMin + logRange
    const minFreq = 2 ** logMin
    const maxFreq = 2 ** logMax
    const minMidi = Math.floor(12 * Math.log2(minFreq / 440) + 69)
    const maxMidi = Math.ceil(12 * Math.log2(maxFreq / 440) + 69)

    ctx.strokeStyle = 'rgba(88,166,255,0.22)'
    ctx.lineWidth = 1.0
    ctx.fillStyle = 'rgba(88,166,255,0.45)'
    ctx.font = '9px sans-serif'
    ctx.textAlign = 'right'
    ctx.textBaseline = 'middle'

    for (let midi = minMidi; midi <= maxMidi; midi++) {
      const semitone = ((midi % 12) + 12) % 12
      if (!semitoneMap.has(semitone)) continue

      const freq = 440 * 2 ** ((midi - 69) / 12)
      const y = freqToY(freq, h, logMin, logRange)
      if (y < 4 || y > h - 4) continue

      ctx.setLineDash([3, 6])
      ctx.beginPath()
      ctx.moveTo(MARGIN, y)
      ctx.lineTo(w - MARGIN, y)
      ctx.stroke()
      ctx.setLineDash([])

      ctx.fillText(semitoneMap.get(semitone)!, scaleLabelX, y)
    }
  }

  const drawTargetLine = (
    w: number,
    h: number,
    logMin: number,
    logRange: number,
  ) => {
    if (!ctx) return
    const targetMidi = props.targetNoteMidi?.()
    if (targetMidi == null || targetMidi <= 0) return

    const freq = 440 * 2 ** ((targetMidi - 69) / 12)
    const y = freqToY(freq, h, logMin, logRange)
    if (y < 4 || y > h - 4) return

    const label = (() => {
      const names = [
        'C',
        'C#',
        'D',
        'D#',
        'E',
        'F',
        'F#',
        'G',
        'G#',
        'A',
        'A#',
        'B',
      ]
      const octave = Math.floor((targetMidi - 12) / 12)
      return `${names[((Math.round(targetMidi) % 12) + 12) % 12]}${octave}`
    })()

    ctx.strokeStyle = 'rgba(63,185,80,0.55)'
    ctx.lineWidth = 1.2
    ctx.setLineDash([8, 6])
    ctx.beginPath()
    ctx.moveTo(MARGIN, y)
    ctx.lineTo(w - MARGIN, y)
    ctx.stroke()
    ctx.setLineDash([])

    // Label pill on the right side
    ctx.font = 'bold 10px sans-serif'
    const textWidth = ctx.measureText(label).width
    const pillW = textWidth + 12
    const pillH = 16
    const pillX = w - MARGIN - pillW
    const pillY = y - pillH / 2

    ctx.fillStyle = 'rgba(13,17,23,0.85)'
    ctx.beginPath()
    ctx.roundRect(pillX - 2, pillY, pillW, pillH, 4)
    ctx.fill()

    ctx.strokeStyle = 'rgba(63,185,80,0.5)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.roundRect(pillX - 2, pillY, pillW, pillH, 4)
    ctx.stroke()

    ctx.fillStyle = 'rgba(63,185,80,0.9)'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(label, pillX + pillW / 2, y)
  }

  const drawMovingTarget = (
    w: number,
    h: number,
    logMin: number,
    logRange: number,
  ) => {
    if (!ctx) return
    const freq = props.movingTarget?.()
    if (freq == null || freq <= 0) return
    const y = freqToY(freq, h, logMin, logRange)
    if (y < 4 || y > h - 4) return

    // Amber guide line at the target height the singer should be on now.
    ctx.strokeStyle = 'rgba(219,109,40,0.45)'
    ctx.lineWidth = 1.2
    ctx.setLineDash([4, 5])
    ctx.beginPath()
    ctx.moveTo(MARGIN, y)
    ctx.lineTo(w - MARGIN, y)
    ctx.stroke()
    ctx.setLineDash([])

    // Glowing guide dot at the "now" line (where the latest sample sits).
    const samples = props.samples()
    const nowTime = samples.length > 0 ? samples[samples.length - 1]!.time : 0
    const x = sampleToX(nowTime, nowTime, w)
    const grad = ctx.createRadialGradient(x, y, 0, x, y, GLOW_RADIUS)
    grad.addColorStop(0, 'rgba(219,109,40,0.85)')
    grad.addColorStop(1, 'rgba(219,109,40,0)')
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.arc(x, y, GLOW_RADIUS, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#f0a868'
    ctx.beginPath()
    ctx.arc(x, y, DOT_RADIUS + 1, 0, Math.PI * 2)
    ctx.fill()
  }

  const drawTimeLabels = (w: number, h: number) => {
    if (!ctx) return

    const samples = props.samples()
    if (samples.length === 0) return

    const nowTime = samples[samples.length - 1]!.time
    const window = visibleWindow()
    const windowStart = nowTime - window

    // Match the sample-to-x mapping so ticks align with dots
    const targetRight = w * 0.45
    const effectiveWidth = targetRight - MARGIN

    // Draw tick marks at 1s intervals
    const startSec = Math.floor(windowStart)
    const endSec = Math.ceil(nowTime)

    ctx.fillStyle = '#484f58'
    ctx.font = '10px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'

    const tickY = h - MARGIN + 8
    for (let sec = startSec; sec <= endSec; sec++) {
      const pct = (sec - windowStart) / window
      if (pct < 0 || pct > 1) continue
      const x = MARGIN + pct * effectiveWidth
      if (x < MARGIN || x > targetRight) continue

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
        const alpha = 0.15 + Math.min(1, s.clarity ?? 0) * 0.7

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
      ctx.strokeStyle = 'rgba(88,166,255,0.28)'
      ctx.lineWidth = 0.8
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
      if (typeof noteName === 'string') {
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

  return (
    <div class="pitch-canvas-wrapper">
      <canvas ref={canvasRef} />
      <button
        type="button"
        class={`pitch-canvas-auto-toggle${isAutoZoom() ? ' pitch-canvas-auto-on' : ''}`}
        onClick={toggleAutoZoom}
        title={
          isAutoZoom()
            ? 'Auto-zoom ON — click for manual'
            : 'Manual zoom — click for auto'
        }
      >
        {isAutoZoom() ? 'AUTO' : 'MAN'}
      </button>
    </div>
  )
}
