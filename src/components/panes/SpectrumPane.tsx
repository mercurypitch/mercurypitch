// ============================================================
// SpectrumPane — Instantaneous frequency spectrum at playhead
// ============================================================

import type { Component } from 'solid-js'
import { onCleanup, onMount, untrack } from 'solid-js'
import type { ColourMapId } from '@/lib/colour-maps'
import { getColourMap } from '@/lib/colour-maps'

interface SpectrumPaneProps {
  magnitudeSpectrum: Float32Array | null
  sampleRate: number
  height: number
  isActive: boolean
  colourMap?: ColourMapId
}

export const SpectrumPane: Component<SpectrumPaneProps> = (props) => {
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

    const marginLeft = 42
    const marginRight = 12
    const marginTop = 8
    const marginBottom = 20
    const plotW = w - marginLeft - marginRight
    const plotH = h - marginTop - marginBottom

    ctx.clearRect(0, 0, w, h)
    ctx.fillStyle = '#0d1117'
    ctx.fillRect(0, 0, w, h)

    const mag = props.magnitudeSpectrum
    const sampleRate = props.sampleRate || 44100
    const nyquist = sampleRate / 2

    if (!mag || mag.length < 2) {
      ctx.fillStyle = 'rgba(255,255,255,0.2)'
      ctx.font = '10px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('No spectrum data', w / 2, h / 2)
      return
    }

    const map = getColourMap(props.colourMap ?? 'viridis')

    // Draw bars/columns for each frequency bin
    const barWidth = Math.max(1, plotW / Math.min(mag.length, plotW))
    for (let px = 0; px < plotW; px++) {
      const binIdx = Math.min(
        mag.length - 1,
        Math.floor((px / plotW) * mag.length),
      )
      const val = mag[binIdx]
      const norm = Math.min(1, Math.max(0, val / 50)) // same normalization as spectrogram
      const barH = norm * plotH
      const [r, g, b] = map(norm)

      ctx.fillStyle = `rgb(${r},${g},${b})`
      ctx.fillRect(
        marginLeft + px,
        marginTop + plotH - barH,
        barWidth + 1,
        barH < 1 ? 1 : barH,
      )
    }

    // Frequency axis labels
    ctx.fillStyle = 'rgba(255,255,255,0.3)'
    ctx.font = '8px sans-serif'
    ctx.textAlign = 'center'
    const freqSteps = [100, 500, 1000, 2000, 4000, 8000]
    for (const f of freqSteps) {
      if (f > nyquist) continue
      const x = marginLeft + (f / nyquist) * plotW
      const label = f >= 1000 ? `${f / 1000}k` : `${f}`
      ctx.fillText(label, x, h - 4)
    }

    // Border
    ctx.strokeStyle = 'rgba(255,255,255,0.1)'
    ctx.lineWidth = 0.5
    ctx.strokeRect(marginLeft, marginTop, plotW, plotH)
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

  // rAF loop handles all drawing — no createEffect needed

  return (
    <canvas
      ref={canvasRef!}
      class="spectrum-pane-canvas"
      style={{
        width: '100%',
        height: `${props.height}px`,
        display: 'block',
        background: '#0d1117',
      }}
    />
  )
}
