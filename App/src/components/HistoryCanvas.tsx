// ============================================================
// HistoryCanvas — Real-time pitch visualization
// ============================================================

import type { Component} from 'solid-js';
import { onCleanup,onMount } from 'solid-js'

interface HistoryCanvasProps {
  frequencyData: () => Float32Array | null
  waveformData: () => Float32Array | null
  liveScore: () => number | null
}

export const HistoryCanvas: Component<HistoryCanvasProps> = (props) => {
  let canvasRef: HTMLCanvasElement | undefined
  let ctx: CanvasRenderingContext2D | null = null
  let animFrameId: number | null = null

  onMount(() => {
    if (!canvasRef) return
    ctx = canvasRef.getContext('2d')
    resizeCanvas()

    const ro = new ResizeObserver(() => { resizeCanvas(); })
    ro.observe(canvasRef.parentElement!)

    animFrameId = requestAnimationFrame(function loop() {
      draw()
      animFrameId = requestAnimationFrame(loop)
    })

    onCleanup(() => {
      ro.disconnect()
      if (animFrameId !== null) cancelAnimationFrame(animFrameId)
    })
  })

  const resizeCanvas = () => {
    if (!canvasRef) return
    const dpr = window.devicePixelRatio || 1
    const w = canvasRef.parentElement!.clientWidth
    const h = canvasRef.parentElement!.clientHeight
    canvasRef.width = w * dpr
    canvasRef.height = h * dpr
    canvasRef.style.width = `${w  }px`
    canvasRef.style.height = `${h  }px`
    ctx?.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  const draw = () => {
    if (!ctx || !canvasRef) return
    const w = canvasRef.clientWidth
    const h = canvasRef.clientHeight

    ctx.clearRect(0, 0, w, h)
    ctx.fillStyle = '#161b22'
    ctx.fillRect(0, 0, w, h)

    const waveform = props.waveformData()
    const freqData = props.frequencyData()

    // Show waveform when mic is active and has data
    if (waveform && waveform.length > 0) {
      // Draw waveform as a filled area in the upper portion
      const waveH = Math.floor(h * 0.6)
      const centerY = waveH / 2
      const step = Math.max(1, Math.floor(waveform.length / w))

      // Gradient for the waveform
      const gradient = ctx.createLinearGradient(0, 0, 0, waveH)
      gradient.addColorStop(0, 'rgba(0, 200, 120, 0.15)')
      gradient.addColorStop(0.5, 'rgba(0, 200, 120, 0.6)')
      gradient.addColorStop(1, 'rgba(0, 200, 120, 0.15)')

      ctx.beginPath()
      ctx.moveTo(0, centerY)
      for (let x = 0; x < w; x++) {
        let sum = 0
        let count = 0
        for (let j = 0; j < step; j++) {
          const idx = Math.floor(((x * step) / w) * waveform.length) + j
          if (idx < waveform.length) {
            sum += waveform[idx]
            count++
          }
        }
        const avg = count > 0 ? sum / count : 0
        const y = centerY - avg * centerY * 0.9
        ctx.lineTo(x, y)
      }
      ctx.strokeStyle = 'rgba(0, 200, 120, 0.8)'
      ctx.lineWidth = 1.5
      ctx.stroke()

      // Mirror for filled area
      ctx.beginPath()
      ctx.moveTo(0, centerY)
      for (let x = 0; x < w; x++) {
        let sum = 0
        let count = 0
        for (let j = 0; j < step; j++) {
          const idx = Math.floor(((x * step) / w) * waveform.length) + j
          if (idx < waveform.length) {
            sum += waveform[idx]
            count++
          }
        }
        const avg = count > 0 ? sum / count : 0
        const y = centerY + avg * centerY * 0.9
        ctx.lineTo(x, y)
      }
      ctx.strokeStyle = 'rgba(0, 200, 120, 0.4)'
      ctx.lineWidth = 1
      ctx.stroke()

      // Divider line
      ctx.beginPath()
      ctx.moveTo(0, waveH)
      ctx.lineTo(w, waveH)
      ctx.strokeStyle = 'rgba(255,255,255,0.05)'
      ctx.lineWidth = 1
      ctx.stroke()

      // Frequency bars below waveform
      if (freqData && freqData.length > 0) {
        const barCount = Math.min(freqData.length, 64)
        const barWidth = w / barCount
        const barAreaH = h - waveH - 1
        for (let i = 0; i < barCount; i++) {
          const val = (freqData[i] + 140) / 140
          const barH = Math.max(0, val * (barAreaH - 2))
          const hue = 120 + val * 40
          ctx.fillStyle = `hsla(${hue},80%,${50 + val * 20}%,${0.3 + val * 0.4})`
          ctx.fillRect(
            i * barWidth + 1,
            waveH + barAreaH - barH,
            barWidth - 2,
            barH,
          )
        }
      }

      // "Live" indicator
      ctx.fillStyle = '#00c878'
      ctx.font = '9px sans-serif'
      ctx.textAlign = 'left'
      ctx.fillText('● LIVE', 6, 12)
    } else if (freqData && freqData.length > 0) {
      // Fallback: frequency bars only
      const barCount = Math.min(freqData.length, 128)
      const barWidth = w / barCount
      for (let i = 0; i < barCount; i++) {
        const val = (freqData[i] + 140) / 140
        const barH = Math.max(0, val * (h - 10))
        const hue = 120 + val * 40
        ctx.fillStyle = `hsla(${hue},80%,${50 + val * 20}%,${0.4 + val * 0.5})`
        ctx.fillRect(i * barWidth + 1, h - barH - 2, barWidth - 2, barH)
      }
    } else {
      ctx.fillStyle = '#484f58'
      ctx.font = '11px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('Enable microphone to see pitch history', w / 2, h / 2 + 4)
    }

    const score = props.liveScore()
    if (score !== null) {
      const color =
        score >= 80 ? '#3fb950' : score >= 50 ? '#d29922' : '#f85149'
      ctx.fillStyle = color
      ctx.font = 'bold 15px sans-serif'
      ctx.textAlign = 'right'
      ctx.fillText(`${score  }%`, w - 10, 20)
      ctx.fillStyle = '#8b949e'
      ctx.font = '9px sans-serif'
      ctx.fillText('live score', w - 10, 32)
    }
  }

  return (
    <canvas
      ref={canvasRef}
      style={{ display: 'block', width: '100%', height: '100%' }}
    />
  )
}
