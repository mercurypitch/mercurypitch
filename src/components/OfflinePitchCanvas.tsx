import type { Component } from 'solid-js'
import { createSignal, onCleanup, onMount, For } from 'solid-js'
import type { TimeStampedPitchSample } from '@/types/pitch-algorithms'

export interface OfflinePitchCanvasProps {
  waveform: Float32Array | null
  durationSec: number
  analysisResults: { algorithm: string; pitches: TimeStampedPitchSample[] }[]
}

const ALGO_COLORS: Record<string, string> = {
  yin: 'rgba(248, 81, 73, 0.8)',      // Red
  fft: 'rgba(88, 166, 255, 0.8)',     // Blue
  autocorr: 'rgba(63, 185, 80, 0.8)', // Green
  swift: 'rgba(163, 113, 247, 0.8)',  // Purple
}

const MIN_FREQ = 55 // A1
const MAX_FREQ = 2093 // C7
const LOG_MIN = Math.log2(MIN_FREQ)
const LOG_RANGE = Math.log2(MAX_FREQ) - LOG_MIN

export const OfflinePitchCanvas: Component<OfflinePitchCanvasProps> = (props) => {
  let canvasRef: HTMLCanvasElement | undefined
  let ctx: CanvasRenderingContext2D | null = null
  let resizeObserver: ResizeObserver | null = null
  let animFrameId: number | null = null

  const [hiddenAlgos, setHiddenAlgos] = createSignal<Set<string>>(new Set())

  const toggleAlgo = (algo: string) => {
    setHiddenAlgos(prev => {
      const next = new Set(prev)
      if (next.has(algo)) next.delete(algo)
      else next.add(algo)
      return next
    })
    // Request a redraw on next frame
    requestAnimationFrame(draw)
  }

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
    draw() // Trigger immediate redraw
  }

  const freqToY = (freq: number, h: number): number => {
    if (!Number.isFinite(freq) || freq <= 0) return h
    const pct = (Math.log2(freq) - LOG_MIN) / LOG_RANGE
    return Math.max(0, Math.min(h, h - pct * h))
  }

  const startDrawLoop = () => {
    const loop = () => {
      draw()
      animFrameId = requestAnimationFrame(loop)
    }
    animFrameId = requestAnimationFrame(loop)
  }

  const draw = () => {
    if (!ctx || !canvasRef) return
    const w = canvasRef.clientWidth
    const h = canvasRef.clientHeight

    ctx.clearRect(0, 0, w, h)
    ctx.fillStyle = '#0d1117'
    ctx.fillRect(0, 0, w, h)

    // Draw Waveform
    const samples = props.waveform
    if (samples && samples.length > 0) {
      ctx.fillStyle = 'rgba(48, 54, 61, 0.5)'
      const step = Math.ceil(samples.length / w)
      const amp = h / 2

      for (let i = 0; i < w; i++) {
        let min = 1.0
        let max = -1.0
        const start = i * step
        const end = Math.min(start + step, samples.length)

        for (let j = start; j < end; j++) {
          const val = samples[j]
          if (val < min) min = val
          if (val > max) max = val
        }

        const yMin = amp - max * amp
        const yMax = amp - min * amp
        ctx.fillRect(i, yMin, 1, Math.max(1, yMax - yMin))
      }
    }

    // Draw Pitches
    const duration = props.durationSec || 1
    const results = props.analysisResults
    if (!results || results.length === 0) return

    for (const res of results) {
      if (hiddenAlgos().has(res.algorithm)) continue

      const color = ALGO_COLORS[res.algorithm] || 'rgba(255, 255, 255, 0.8)'
      ctx.strokeStyle = color
      ctx.fillStyle = color
      ctx.lineWidth = 2
      ctx.lineJoin = 'round'

      let isDrawing = false
      ctx.beginPath()

      for (let i = 0; i < res.pitches.length; i++) {
        const p = res.pitches[i]
        const x = (p.time / duration) * w
        
        // Skip invalid points
        if (p.freq === null || p.freq <= 0) {
          isDrawing = false
          continue
        }
        
        const y = freqToY(p.freq, h)

        if (!isDrawing) {
          ctx.moveTo(x, y)
          isDrawing = true
        } else {
          // If jump is too big in time, break the line
          const prev = res.pitches[i - 1]
          if (prev && p.time - prev.time > 0.1) {
            ctx.moveTo(x, y)
          } else {
            ctx.lineTo(x, y)
          }
        }
      }
      ctx.stroke()
    }
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
      
      {/* HTML Overlay Legend */}
      <div style={{
        position: 'absolute',
        top: '8px',
        right: '8px',
        display: 'flex',
        'flex-direction': 'column',
        gap: '4px',
        padding: '6px',
        background: 'rgba(13, 17, 23, 0.7)',
        'border-radius': '6px',
        'backdrop-filter': 'blur(4px)',
        border: '1px solid rgba(255,255,255,0.1)'
      }}>
        <For each={props.analysisResults}>
          {(res) => {
            const isHidden = () => hiddenAlgos().has(res.algorithm)
            const color = ALGO_COLORS[res.algorithm] || '#fff'
            return (
              <button
                style={{
                  background: 'none',
                  border: 'none',
                  color: isHidden() ? 'rgba(255,255,255,0.3)' : color,
                  'font-size': '12px',
                  'font-weight': 'bold',
                  'text-align': 'right',
                  cursor: 'pointer',
                  padding: '2px 6px',
                  opacity: isHidden() ? 0.6 : 1,
                  transition: 'all 0.2s ease',
                }}
                onClick={() => toggleAlgo(res.algorithm)}
              >
                {res.algorithm.toUpperCase()}
              </button>
            )
          }}
        </For>
      </div>
    </div>
  )
}
