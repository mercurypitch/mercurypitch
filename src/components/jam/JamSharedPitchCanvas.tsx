// ── JamSharedPitchCanvas ─────────────────────────────────────────────
// Multi-peer scrolling pitch-over-time canvas.
// Each peer gets a distinct color; own peer gets glow + note pills.

import type { Component } from 'solid-js'
import { createMemo, onCleanup, onMount } from 'solid-js'
import { buildPeerColorMap } from '@/lib/jam/peer-colors'
import { jamPitchHistory } from '@/stores/jam-store'

const Y_AXIS_NOTES = [
  { label: 'C2', freq: 65.41 },
  { label: 'C3', freq: 130.81 },
  { label: 'C4', freq: 261.63 },
  { label: 'C5', freq: 523.25 },
  { label: 'C6', freq: 1046.5 },
  { label: 'C7', freq: 2093.0 },
]

const MIN_FREQ = 55
const MAX_FREQ = 2093
const LOG_MIN = Math.log2(MIN_FREQ)
const LOG_MAX = Math.log2(MAX_FREQ)
const LOG_RANGE = LOG_MAX - LOG_MIN
const MARGIN = 36
const DOT_RADIUS = 2.5
const GLOW_RADIUS = 10

interface JamSharedPitchCanvasProps {
  myPeerId: () => string | null
}

export const JamSharedPitchCanvas: Component<JamSharedPitchCanvasProps> = (
  props,
) => {
  let canvasRef: HTMLCanvasElement | undefined
  let ctx: CanvasRenderingContext2D | null = null
  let animFrameId: number | null = null
  let resizeObserver: ResizeObserver | null = null

  const peerColorMap = createMemo(() => {
    const history = jamPitchHistory()
    const peerIds = Object.keys(history)
    return buildPeerColorMap(peerIds)
  })

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

  const startDrawLoop = () => {
    const draw = () => {
      if (!ctx || !canvasRef) return
      const w = canvasRef.clientWidth
      const h = canvasRef.clientHeight

      ctx.clearRect(0, 0, w, h)
      ctx.fillStyle = '#0d1117'
      ctx.fillRect(0, 0, w, h)

      drawYAxis(w, h)
      drawTimeTicks(w, h)
      drawPeerSamples(w, h)

      animFrameId = requestAnimationFrame(draw)
    }
    animFrameId = requestAnimationFrame(draw)
  }

  const drawYAxis = (w: number, h: number) => {
    if (!ctx) return
    const rightX = w - 8
    for (const note of Y_AXIS_NOTES) {
      const y = freqToY(note.freq, h)
      if (y < 4 || y > h - 4) continue

      ctx.strokeStyle = 'rgba(48,54,61,0.7)'
      ctx.lineWidth = 1
      ctx.setLineDash([4, 6])
      ctx.beginPath()
      ctx.moveTo(MARGIN, y)
      ctx.lineTo(w - MARGIN, y)
      ctx.stroke()
      ctx.setLineDash([])

      ctx.fillStyle = '#484f58'
      ctx.font = '10px sans-serif'
      ctx.textAlign = 'right'
      ctx.textBaseline = 'middle'
      ctx.fillText(note.label, rightX, y)
    }
  }

  const drawTimeTicks = (w: number, h: number) => {
    if (!ctx) return
    const allSamples = Object.values(jamPitchHistory()).flat()
    if (allSamples.length === 0) return

    const now = Date.now()
    const windowSec = 10
    // Anchor: "now" is at 60% of drawable width
    const ANCHOR_PCT = 0.6
    const drawW = w - MARGIN * 2
    const anchorX = MARGIN + drawW * ANCHOR_PCT
    const pxPerMs = (drawW * ANCHOR_PCT) / (windowSec * 1000)

    ctx.fillStyle = '#484f58'
    ctx.font = '10px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'

    const tickY = h - MARGIN + 8
    const windowStartMs = now - (drawW * ANCHOR_PCT) / pxPerMs
    const windowEndMs = now + (drawW * (1 - ANCHOR_PCT)) / pxPerMs
    const startSec = Math.floor(windowStartMs / 1000)
    const endSec = Math.ceil(windowEndMs / 1000)
    for (let sec = startSec; sec <= endSec; sec++) {
      const x = anchorX + (sec * 1000 - now) * pxPerMs
      if (x < MARGIN || x > w - MARGIN) continue

      ctx.strokeStyle = 'rgba(48,54,61,0.5)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(x, tickY)
      ctx.lineTo(x, tickY + 4)
      ctx.stroke()

      const displaySec = (sec % 60).toString().padStart(2, '0')
      ctx.fillText(`:${displaySec}`, x, tickY + 4)
    }

    // Draw "now" cursor
    ctx.strokeStyle = 'rgba(88,166,255,0.25)'
    ctx.lineWidth = 1
    ctx.setLineDash([4, 4])
    ctx.beginPath()
    ctx.moveTo(anchorX, MARGIN)
    ctx.lineTo(anchorX, h - MARGIN)
    ctx.stroke()
    ctx.setLineDash([])
  }

  const drawPeerSamples = (w: number, h: number) => {
    if (!ctx) return

    const history = jamPitchHistory()
    const colors = peerColorMap()
    const myId = props.myPeerId()
    const now = Date.now()
    // Anchor: "now" maps to 60% of drawable width
    const ANCHOR_PCT = 0.6
    const drawW = w - MARGIN * 2
    const anchorX = MARGIN + drawW * ANCHOR_PCT
    // Total visible time window
    const windowMs = 10000
    const pxPerMs = (drawW * ANCHOR_PCT) / windowMs

    for (const [peerId, samples] of Object.entries(history)) {
      const color = colors[peerId] ?? '#58a6ff'
      const isOwn = peerId === myId

      // Collect valid points
      const points: { x: number; y: number; clarity: number }[] = []

      for (let i = 0; i < samples.length; i++) {
        const s = samples[i]!
        const x = anchorX + (s.timestamp - now) * pxPerMs
        if (x < -10 || x > w + 10) continue

        if (s.frequency > 0) {
          const y = freqToY(s.frequency, h)
          if (y < -10 || y > h + 10) continue
          points.push({ x, y, clarity: s.clarity })
        }
      }

      if (points.length === 0) continue

      // Polyline
      ctx.strokeStyle = isOwn ? hexToRgba(color, 0.6) : hexToRgba(color, 0.35)
      ctx.lineWidth = isOwn ? 2 : 1.2
      ctx.lineJoin = 'round'
      ctx.beginPath()
      ctx.moveTo(points[0]!.x, points[0]!.y)
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i]!.x, points[i]!.y)
      }
      ctx.stroke()

      // Dots
      for (const p of points) {
        const alpha = isOwn ? 0.2 + p.clarity * 0.7 : 0.1 + p.clarity * 0.5
        ctx.fillStyle = hexToRgba(color, alpha)
        ctx.beginPath()
        ctx.arc(p.x, p.y, DOT_RADIUS, 0, Math.PI * 2)
        ctx.fill()
      }

      // Glow + pill on latest point — only if the sample is fresh
      const latestSample = samples[samples.length - 1]
      const isFresh =
        latestSample !== undefined && now - latestSample.timestamp < 400
      if (isFresh && points.length > 0) {
        const latest = points[points.length - 1]!
        const grad = ctx.createRadialGradient(
          latest.x,
          latest.y,
          0,
          latest.x,
          latest.y,
          GLOW_RADIUS,
        )
        grad.addColorStop(0, hexToRgba(color, 0.5))
        grad.addColorStop(1, hexToRgba(color, 0))
        ctx.fillStyle = grad
        ctx.beginPath()
        ctx.arc(latest.x, latest.y, GLOW_RADIUS, 0, Math.PI * 2)
        ctx.fill()

        ctx.fillStyle = color
        ctx.beginPath()
        ctx.arc(latest.x, latest.y, DOT_RADIUS + 1.5, 0, Math.PI * 2)
        ctx.fill()

        // Note pill — only show if sample is fresh
        const noteName = latestSample.noteName
        if (noteName) {
          const nearRight = latest.x > w - 70
          const labelX = nearRight ? latest.x - 14 : latest.x + 14
          const labelY = latest.y - 10

          ctx.font = 'bold 11px sans-serif'
          const textWidth = ctx.measureText(noteName).width
          const pillW = textWidth + 10
          const pillH = 18

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

          ctx.strokeStyle = hexToRgba(color, 0.35)
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

          ctx.fillStyle = '#e6edf3'
          ctx.textAlign = nearRight ? 'right' : 'left'
          ctx.textBaseline = 'middle'
          ctx.fillText(noteName, labelX, labelY)
        }
      }
    }
  }

  return <canvas ref={canvasRef} />
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}
