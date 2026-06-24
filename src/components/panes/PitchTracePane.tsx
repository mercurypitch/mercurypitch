// ============================================================
// PitchTracePane — Scrolling pitch line chart for pane system
// ============================================================

import type { Component } from 'solid-js'
import { onCleanup, onMount, untrack } from 'solid-js'
import type { PitchTracePoint } from '@/components/MultiPaneView'

interface PitchTracePaneProps {
  pitchHistory: PitchTracePoint[]
  timeRange: [number, number]
  height: number
  isActive: boolean
  playheadPosition: number
}

// MIDI note to name (used inline)
const NOTE_NAMES = [
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

function midiName(midi: number): string {
  const noteIdx = Math.round(midi) % 12
  const octave = Math.floor(midi / 12) - 1
  return `${NOTE_NAMES[noteIdx >= 0 ? noteIdx : noteIdx + 12]}${octave}`
}

export const PitchTracePane: Component<PitchTracePaneProps> = (props) => {
  let canvasRef!: HTMLCanvasElement
  let ctx: CanvasRenderingContext2D | null = null
  let rafId = 0

  const draw = () => {
    if (ctx === null || canvasRef === undefined) return
    const w = canvasRef.clientWidth
    const h = props.height
    if (w <= 0 || h <= 0) return

    const dpr = window.devicePixelRatio || 1
    if (canvasRef.width !== w * dpr || canvasRef.height !== h * dpr) {
      canvasRef.width = w * dpr
      canvasRef.height = h * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    // Margins
    const marginLeft = 42
    const marginRight = 12
    const marginTop = 8
    const marginBottom = 16
    const plotW = w - marginLeft - marginRight
    const plotH = h - marginTop - marginBottom

    ctx.clearRect(0, 0, w, h)

    // Background
    ctx.fillStyle = '#0d1117'
    ctx.fillRect(0, 0, w, h)

    const points = props.pitchHistory
    const [t0, t1] = props.timeRange

    // Compute MIDI range
    let minMidi = 48,
      maxMidi = 84 // default C3-C7
    if (points.length > 0) {
      const midis = points.map((p) => p.midi).filter((m) => m > 0)
      if (midis.length > 0) {
        minMidi = Math.min(...midis)
        maxMidi = Math.max(...midis)
        const range = maxMidi - minMidi
        const pad = Math.max(6, range * 0.3)
        minMidi = Math.max(0, Math.floor(minMidi - pad))
        maxMidi = Math.min(127, Math.ceil(maxMidi + pad))
      }
    }

    const toX = (t: number) => marginLeft + ((t - t0) / (t1 - t0)) * plotW
    const toY = (midi: number) =>
      marginTop + ((maxMidi - midi) / (maxMidi - minMidi)) * plotH

    // Grid lines at octave boundaries
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'
    ctx.lineWidth = 0.5
    ctx.setLineDash([3, 3])
    for (let m = Math.ceil(minMidi); m <= maxMidi; m++) {
      if (m % 12 === 0) {
        const y = toY(m)
        ctx.beginPath()
        ctx.moveTo(marginLeft, y)
        ctx.lineTo(w - marginRight, y)
        ctx.stroke()

        // Label
        ctx.fillStyle = 'rgba(255,255,255,0.3)'
        ctx.font = '8px sans-serif'
        ctx.textAlign = 'right'
        ctx.fillText(midiName(m), marginLeft - 6, y + 3)
      }
    }
    ctx.setLineDash([])

    // Plot area border
    ctx.strokeStyle = 'rgba(255,255,255,0.1)'
    ctx.lineWidth = 0.5
    ctx.strokeRect(marginLeft, marginTop, plotW, plotH)

    // Filter points in time range
    const visible = points.filter((p) => p.time >= t0 && p.time <= t1)
    if (visible.length < 2 && points.length > 0) {
      // Show a single point
      const p = points[0]
      const cx = toX(p.time)
      const cy = toY(p.midi)
      ctx.fillStyle = '#58a6ff'
      ctx.beginPath()
      ctx.arc(cx, cy, 3, 0, Math.PI * 2)
      ctx.fill()
      return
    }

    if (visible.length >= 2) {
      // Draw pitch line
      ctx.strokeStyle = '#58a6ff'
      ctx.lineWidth = 2
      ctx.lineJoin = 'round'
      ctx.lineCap = 'round'
      ctx.beginPath()
      for (let i = 0; i < visible.length; i++) {
        const p = visible[i]
        const x = toX(p.time)
        const y = toY(p.midi)
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()

      // On-pitch dots
      for (const p of visible) {
        const isOnPitch = p.clarity !== undefined && p.clarity > 60
        ctx.fillStyle = isOnPitch ? '#3fb950' : '#f85149'
        ctx.beginPath()
        ctx.arc(toX(p.time), toY(p.midi), isOnPitch ? 2.5 : 3.5, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    // Playhead
    if (props.playheadPosition >= t0 && props.playheadPosition <= t1) {
      const px = toX(props.playheadPosition)
      ctx.strokeStyle = '#f85149'
      ctx.lineWidth = 1.5
      ctx.setLineDash([4, 2])
      ctx.beginPath()
      ctx.moveTo(px, marginTop)
      ctx.lineTo(px, h - marginBottom)
      ctx.stroke()
      ctx.setLineDash([])
    }
  }

  onMount(() => {
    if (canvasRef === undefined) return
    ctx = canvasRef.getContext('2d')
    const tick = () => {
      untrack(() => draw())
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
  })

  onCleanup(() => {
    if (rafId) cancelAnimationFrame(rafId)
  })

  return (
    <canvas
      ref={canvasRef!}
      class="pitch-trace-pane-canvas"
      style={{
        width: '100%',
        height: `${props.height}px`,
        display: 'block',
        background: '#0d1117',
      }}
    />
  )
}
