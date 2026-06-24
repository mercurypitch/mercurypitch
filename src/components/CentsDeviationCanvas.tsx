import type { Component } from 'solid-js'
import { createEffect, onCleanup, onMount } from 'solid-js'

interface CentsDeviationCanvasProps {
  centsOffset: number | null
  targetNote: string | null
  isActive: boolean
}

export const CentsDeviationCanvas: Component<CentsDeviationCanvasProps> = (
  props,
) => {
  let canvasRef: HTMLCanvasElement | undefined
  let offscreenCanvas: HTMLCanvasElement | undefined
  let offscreenCtx: CanvasRenderingContext2D | null = null
  let mainCtx: CanvasRenderingContext2D | null = null

  const w = 800
  const h = 100
  const centerY = Math.floor(h / 2)
  const centsRange = 50 // ±50 cents scale

  onMount(() => {
    if (!canvasRef) return
    mainCtx = canvasRef.getContext('2d', { alpha: false })

    offscreenCanvas = document.createElement('canvas')
    offscreenCanvas.width = w
    offscreenCanvas.height = h
    offscreenCtx = offscreenCanvas.getContext('2d', {
      alpha: false,
      willReadFrequently: true,
    })

    if (offscreenCtx) {
      offscreenCtx.fillStyle = '#0f172a'
      offscreenCtx.fillRect(0, 0, w, h)
      drawReferenceLines(offscreenCtx)
    }
  })

  const drawReferenceLines = (ctx: CanvasRenderingContext2D) => {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)'
    ctx.lineWidth = 1

    // Center (0 cents)
    ctx.beginPath()
    ctx.moveTo(0, centerY)
    ctx.lineTo(w, centerY)
    ctx.stroke()

    // +25 and -25 cents
    ctx.setLineDash([4, 4])
    const y25 = centerY - (25 / centsRange) * (h / 2)
    ctx.beginPath()
    ctx.moveTo(0, y25)
    ctx.lineTo(w, y25)
    ctx.stroke()

    const yMinus25 = centerY - (-25 / centsRange) * (h / 2)
    ctx.beginPath()
    ctx.moveTo(0, yMinus25)
    ctx.lineTo(w, yMinus25)
    ctx.stroke()
    ctx.setLineDash([])
  }

  createEffect(() => {
    if (
      !props.isActive ||
      !mainCtx ||
      !offscreenCtx ||
      !offscreenCanvas ||
      !canvasRef
    )
      return

    // Shift offscreen canvas left by 2px (faster scrolling than spectrogram)
    const shift = 2
    offscreenCtx.drawImage(
      offscreenCanvas,
      shift,
      0,
      w - shift,
      h,
      0,
      0,
      w - shift,
      h,
    )

    // Clear new area on right
    offscreenCtx.fillStyle = '#0f172a'
    offscreenCtx.fillRect(w - shift, 0, shift, h)

    // Redraw reference lines in the cleared area
    offscreenCtx.strokeStyle = 'rgba(255, 255, 255, 0.1)'
    offscreenCtx.lineWidth = 1

    offscreenCtx.beginPath()
    offscreenCtx.moveTo(w - shift, centerY)
    offscreenCtx.lineTo(w, centerY)
    offscreenCtx.stroke()

    offscreenCtx.setLineDash([4, 4])
    const y25 = centerY - (25 / centsRange) * (h / 2)
    offscreenCtx.beginPath()
    offscreenCtx.moveTo(w - shift, y25)
    offscreenCtx.lineTo(w, y25)
    offscreenCtx.stroke()

    const yMinus25 = centerY - (-25 / centsRange) * (h / 2)
    offscreenCtx.beginPath()
    offscreenCtx.moveTo(w - shift, yMinus25)
    offscreenCtx.lineTo(w, yMinus25)
    offscreenCtx.stroke()
    offscreenCtx.setLineDash([])

    // Draw data point if available
    if (props.centsOffset !== null) {
      // Clamp between -50 and 50
      const clampedCents = Math.max(
        -centsRange,
        Math.min(centsRange, props.centsOffset),
      )
      const y = centerY - (clampedCents / centsRange) * (h / 2)

      // Color logic: green < 15, yellow < 30, red > 30
      const absCents = Math.abs(clampedCents)
      if (absCents < 15) {
        offscreenCtx.fillStyle = '#22c55e' // text-green-500
      } else if (absCents < 30) {
        offscreenCtx.fillStyle = '#eab308' // text-yellow-500
      } else {
        offscreenCtx.fillStyle = '#ef4444' // text-red-500
      }

      offscreenCtx.beginPath()
      offscreenCtx.arc(w - shift / 2, y, 2, 0, 2 * Math.PI)
      offscreenCtx.fill()
    }

    // Render to main canvas
    mainCtx.drawImage(offscreenCanvas, 0, 0)

    // Draw target note overlay on main canvas (not offscreen so it stays fixed on the right)
    if (props.targetNote !== null && props.targetNote !== '') {
      mainCtx.fillStyle = 'rgba(15, 23, 42, 0.8)' // dark bg for text
      mainCtx.fillRect(w - 40, centerY - 12, 40, 24)
      mainCtx.fillStyle = 'white'
      mainCtx.font = '12px sans-serif'
      mainCtx.textAlign = 'right'
      mainCtx.textBaseline = 'middle'
      mainCtx.fillText(props.targetNote, w - 8, centerY)
    }
  })

  onCleanup(() => {
    offscreenCanvas = undefined
    offscreenCtx = null
    mainCtx = null
  })

  return (
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
  )
}
