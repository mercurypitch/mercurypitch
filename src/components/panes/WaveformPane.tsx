// ============================================================
// WaveformPane — Peak waveform renderer for pane system
// ============================================================

import type { Component } from 'solid-js'
import { onCleanup, onMount, untrack } from 'solid-js'

interface WaveformPaneProps {
  waveformData: Float32Array | null | undefined
  timeRange: [number, number]
  playheadPosition: number
  height: number
  isActive: boolean
}

export const WaveformPane: Component<WaveformPaneProps> = (props) => {
  let canvasRef!: HTMLCanvasElement
  let ctx: CanvasRenderingContext2D | null = null
  let rafId = 0

  const draw = () => {
    if (ctx === null || canvasRef === undefined) return
    const w = canvasRef.width
    const h = canvasRef.height
    const dpr = window.devicePixelRatio || 1

    // Clear
    ctx.fillStyle = '#0d1117'
    ctx.fillRect(0, 0, w, h)

    const waveform = props.waveformData
    if (!waveform || waveform.length < 2) {
      // Draw a flat line
      ctx.strokeStyle = 'rgba(255,255,255,0.15)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(0, h / 2)
      ctx.lineTo(w, h / 2)
      ctx.stroke()
      return
    }

    const [t0, t1] = props.timeRange
    const dur = t1 - t0
    if (dur <= 0) return

    // Draw waveform: for each pixel column, find peak amplitude in that time window
    const midY = h / 2
    const samplesPerPixel = Math.max(1, Math.floor(waveform.length / w))

    ctx.strokeStyle = '#58a6ff'
    ctx.lineWidth = 1.5 * dpr
    ctx.beginPath()

    for (let px = 0; px < w; px++) {
      const t = t0 + (px / w) * dur
      // Map time to sample index (approximate)
      // Assume waveformData represents the full audio buffer
      const idx = Math.floor((t / (t1 - t0 || 1)) * waveform.length)
      const sampleIdx = Math.max(0, Math.min(waveform.length - 1, idx))

      // Peak within a small window
      let peakMin = 0
      let peakMax = 0
      const half = Math.floor(samplesPerPixel / 2)
      const start = Math.max(0, sampleIdx - half)
      const end = Math.min(waveform.length - 1, sampleIdx + half)
      for (let si = start; si <= end; si++) {
        const v = waveform[si]
        if (v < peakMin) peakMin = v
        if (v > peakMax) peakMax = v
      }

      const yMin = midY + peakMin * midY

      // Draw filled waveform silhouette
      if (px === 0) {
        ctx.moveTo(px, yMin)
      } else {
        ctx.lineTo(px, yMin)
      }
    }

    // Complete lower envelope outline
    ctx.stroke()

    // Draw upper envelope and fill between
    ctx.strokeStyle = '#58a6ff'
    ctx.lineWidth = 1.5 * dpr
    ctx.beginPath()
    for (let px = 0; px < w; px++) {
      const t = t0 + (px / w) * dur
      const idx = Math.floor((t / (t1 - t0 || 1)) * waveform.length)
      const sampleIdx = Math.max(0, Math.min(waveform.length - 1, idx))
      let peakMax = 0
      const half = Math.floor(samplesPerPixel / 2)
      const start = Math.max(0, sampleIdx - half)
      const end = Math.min(waveform.length - 1, sampleIdx + half)
      for (let si = start; si <= end; si++) {
        const v = waveform[si]
        if (v > peakMax) peakMax = v
      }

      const yMax = midY + peakMax * midY
      if (px === 0) ctx.moveTo(px, yMax)
      else ctx.lineTo(px, yMax)
    }
    ctx.stroke()

    // Center line
    ctx.strokeStyle = 'rgba(255,255,255,0.1)'
    ctx.lineWidth = 0.5 * dpr
    ctx.beginPath()
    ctx.moveTo(0, midY)
    ctx.lineTo(w, midY)
    ctx.stroke()

    // Playhead
    const playPct = dur > 0 ? (props.playheadPosition - t0) / dur : 0
    if (playPct >= 0 && playPct <= 1) {
      const px = playPct * w
      ctx.strokeStyle = '#f85149'
      ctx.lineWidth = 1.5 * dpr
      ctx.beginPath()
      ctx.moveTo(px, 0)
      ctx.lineTo(px, h)
      ctx.stroke()
    }
  }

  onMount(() => {
    if (canvasRef === undefined) return
    ctx = canvasRef.getContext('2d')
    const dpr = window.devicePixelRatio || 1
    const w = canvasRef.clientWidth
    const h = props.height
    canvasRef.width = w * dpr
    canvasRef.height = h * dpr
    ctx?.scale(dpr, dpr)

    const resizeObs = new ResizeObserver(() => {
      if (canvasRef === undefined || ctx === null) return
      const d = window.devicePixelRatio || 1
      canvasRef.width = canvasRef.clientWidth * d
      canvasRef.height = props.height * d
      ctx.setTransform(d, 0, 0, d, 0, 0)
      draw()
    })
    resizeObs.observe(canvasRef)
    onCleanup(() => resizeObs.disconnect())

    const tick = () => {
      untrack(() => draw())
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
  })

  onCleanup(() => {
    if (rafId) cancelAnimationFrame(rafId)
  })

  // rAF loop handles all drawing — no createEffect needed

  return (
    <canvas
      ref={canvasRef!}
      class="waveform-pane-canvas"
      style={{
        width: '100%',
        height: `${props.height}px`,
        display: 'block',
        background: '#0d1117',
      }}
    />
  )
}
