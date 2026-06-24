import type { Component } from 'solid-js'
import { onCleanup, onMount } from 'solid-js'
import type { VibratoResult } from '@/lib/vocal-analyzer'

interface VibratoWaveformCanvasProps {
  vibrato: VibratoResult | null
  isActive: boolean
  width?: number
  height?: number
}

export const VibratoWaveformCanvas: Component<VibratoWaveformCanvasProps> = (
  props,
) => {
  let canvasRef: HTMLCanvasElement | undefined
  let ctx: CanvasRenderingContext2D | null = null
  let animationId = 0

  const w = 300
  const h = 100
  const centerY = Math.floor(h / 2)

  // To make it animate smoothly, we track phase
  let phase = 0
  let lastTime = performance.now()

  onMount(() => {
    if (!canvasRef) return
    ctx = canvasRef.getContext('2d', { alpha: false })

    const render = (time: number) => {
      const dt = (time - lastTime) / 1000 // delta time in seconds
      lastTime = time

      if (ctx && props.isActive) {
        ctx.fillStyle = '#0f172a'
        ctx.fillRect(0, 0, w, h)

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(0, centerY)
        ctx.lineTo(w, centerY)
        ctx.stroke()

        const vib = props.vibrato

        if (vib && vib.detected) {
          // Advance phase
          phase += vib.rateHz * Math.PI * 2 * dt

          ctx.beginPath()
          ctx.strokeStyle = '#bc8cff' // matching the purple color used for vibrato
          ctx.lineWidth = 2
          ctx.lineCap = 'round'
          ctx.lineJoin = 'round'

          // Draw a synthesized sine wave spanning the width
          // Let's show roughly 1.5 seconds of wave history
          const durationToShow = 1.5

          for (let x = 0; x < w; x++) {
            // time offset for this pixel
            const t = (x / w) * durationToShow
            // The wave at this pixel
            // We want it to scroll left, so we add the global phase to the pixel's local phase
            const pixelPhase = phase - t * vib.rateHz * Math.PI * 2

            // map depth from cents to pixels. Let's say 50 cents = half height
            const maxDepth = 50
            const amplitudePx = Math.min(
              (vib.depthCents / maxDepth) * (h / 2) * 0.8,
              (h / 2) * 0.9,
            )

            const y = centerY + Math.sin(pixelPhase) * amplitudePx

            if (x === 0) {
              ctx.moveTo(x, y)
            } else {
              ctx.lineTo(x, y)
            }
          }
          ctx.stroke()
        } else {
          // Draw flat line if no vibrato
          ctx.beginPath()
          ctx.strokeStyle = 'rgba(188, 140, 255, 0.3)'
          ctx.lineWidth = 2
          ctx.moveTo(0, centerY)
          ctx.lineTo(w, centerY)
          ctx.stroke()
        }
      }

      animationId = requestAnimationFrame(render)
    }

    animationId = requestAnimationFrame(render)
  })

  onCleanup(() => {
    if (animationId) {
      cancelAnimationFrame(animationId)
    }
    ctx = null
  })

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <canvas
        ref={canvasRef}
        width={w}
        height={h}
        style={{
          width: '100%',
          height: '100%',
          'border-radius': '8px',
          border: '1px solid rgba(255,255,255,0.1)',
          background: '#0f172a',
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: '8px',
          left: '12px',
          color: 'rgba(255,255,255,0.9)',
          'text-shadow': '0 1px 2px rgba(0,0,0,0.8)',
        }}
      >
        {props.vibrato?.detected === true ? (
          <div style={{ display: 'flex', 'flex-direction': 'column' }}>
            <span
              style={{
                'font-size': '1.2rem',
                'font-weight': 'bold',
                color: '#bc8cff',
              }}
            >
              {props.vibrato.rateHz.toFixed(1)} Hz
            </span>
            <span
              style={{ 'font-size': '0.75rem', color: 'rgba(255,255,255,0.7)' }}
            >
              Depth: {Math.round(props.vibrato.depthCents)}¢
            </span>
          </div>
        ) : (
          <span
            style={{ 'font-size': '0.875rem', color: 'rgba(255,255,255,0.5)' }}
          >
            No Vibrato
          </span>
        )}
      </div>
    </div>
  )
}
