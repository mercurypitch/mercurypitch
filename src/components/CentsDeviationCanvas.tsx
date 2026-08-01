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

  // CSS-pixel size of the element; backing stores are this times dpr so the
  // wide Lab pane doesn't stretch a fixed bitmap into fuzzy text.
  let cssW = 0
  let cssH = 0
  let dpr = 1

  const centsRange = 50 // ±50 cents scale

  const drawReferenceLines = (
    ctx: CanvasRenderingContext2D,
    x0: number,
    x1: number,
  ) => {
    const centerY = cssH / 2
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)'
    ctx.lineWidth = 1

    // Center (0 cents)
    ctx.beginPath()
    ctx.moveTo(x0, centerY)
    ctx.lineTo(x1, centerY)
    ctx.stroke()

    // +25 and -25 cents
    ctx.setLineDash([4, 4])
    const y25 = centerY - (25 / centsRange) * (cssH / 2)
    ctx.beginPath()
    ctx.moveTo(x0, y25)
    ctx.lineTo(x1, y25)
    ctx.stroke()

    const yMinus25 = centerY - (-25 / centsRange) * (cssH / 2)
    ctx.beginPath()
    ctx.moveTo(x0, yMinus25)
    ctx.lineTo(x1, yMinus25)
    ctx.stroke()
    ctx.setLineDash([])
  }

  /** Copy the scroll surface to the visible canvas and draw the fixed
      annotations on top, all in CSS pixels so text stays its natural size
      however wide the pane is. */
  const renderFrame = (targetNote: string | null) => {
    if (!mainCtx || !offscreenCanvas) return
    const centerY = cssH / 2

    // Device-to-device copy, no resampling.
    mainCtx.setTransform(1, 0, 0, 1, 0, 0)
    mainCtx.drawImage(offscreenCanvas, 0, 0)

    // Fixed annotations (main canvas, never scrolled): what the axes and
    // colors MEAN. Without them this read as mystery confetti - the dots
    // are your distance from the nearest note, sharp above, flat below.
    mainCtx.setTransform(dpr, 0, 0, dpr, 0, 0)
    mainCtx.font = '10px sans-serif'
    mainCtx.textAlign = 'left'
    mainCtx.textBaseline = 'middle'
    mainCtx.fillStyle = 'rgba(255, 255, 255, 0.55)'
    mainCtx.fillText('+50¢ sharp', 4, centerY - cssH / 2 + 8)
    mainCtx.fillText('0¢ on pitch', 4, centerY)
    mainCtx.fillText('−50¢ flat', 4, centerY + cssH / 2 - 8)
    const legend: [string, string][] = [
      ['#22c55e', '≤15¢'],
      ['#eab308', '≤30¢'],
      ['#ef4444', '>30¢'],
    ]
    let lx = 4
    const ly = centerY - cssH / 2 + 22
    for (const [color, label] of legend) {
      mainCtx.fillStyle = color
      mainCtx.beginPath()
      mainCtx.arc(lx + 3, ly, 3, 0, 2 * Math.PI)
      mainCtx.fill()
      mainCtx.fillStyle = 'rgba(255, 255, 255, 0.55)'
      mainCtx.fillText(label, lx + 9, ly)
      lx += 9 + mainCtx.measureText(label).width + 10
    }

    // Draw target note overlay on main canvas (not offscreen so it stays fixed on the right)
    if (targetNote !== null && targetNote !== '') {
      mainCtx.font = '12px sans-serif'
      const noteW = Math.ceil(mainCtx.measureText(targetNote).width) + 16
      mainCtx.fillStyle = 'rgba(15, 23, 42, 0.8)' // dark bg for text
      mainCtx.fillRect(cssW - noteW, centerY - 12, noteW, 24)
      mainCtx.fillStyle = 'white'
      mainCtx.textAlign = 'right'
      mainCtx.textBaseline = 'middle'
      mainCtx.fillText(targetNote, cssW - 8, centerY)
    }
  }

  /** Match both backing stores to the element's layed-out size times dpr.
      Clears the scroll history — resizes are rare (pane drag), and a fresh
      surface beats a stretched one. */
  const resize = () => {
    if (!canvasRef || !offscreenCanvas || !offscreenCtx || !mainCtx) return
    const w = canvasRef.clientWidth
    const h = canvasRef.clientHeight
    if (w === 0 || h === 0) return
    cssW = w
    cssH = h
    dpr = window.devicePixelRatio || 1

    canvasRef.width = Math.round(cssW * dpr)
    canvasRef.height = Math.round(cssH * dpr)
    offscreenCanvas.width = canvasRef.width
    offscreenCanvas.height = canvasRef.height

    // Draw in CSS pixels on the scroll surface.
    offscreenCtx.setTransform(dpr, 0, 0, dpr, 0, 0)
    offscreenCtx.fillStyle = '#0f172a'
    offscreenCtx.fillRect(0, 0, cssW, cssH)
    drawReferenceLines(offscreenCtx, 0, cssW)

    // Repaint immediately so a resize while paused doesn't show a bare pane.
    renderFrame(props.targetNote)
  }

  onMount(() => {
    if (!canvasRef) return
    mainCtx = canvasRef.getContext('2d', { alpha: false })

    offscreenCanvas = document.createElement('canvas')
    offscreenCtx = offscreenCanvas.getContext('2d', {
      alpha: false,
      willReadFrequently: true,
    })

    resize()

    const resizeObs = new ResizeObserver(() => resize())
    resizeObs.observe(canvasRef)
    onCleanup(() => resizeObs.disconnect())
  })

  createEffect(() => {
    // Read every prop up front so the effect stays subscribed to all of them
    // even when an early return fires (e.g. a still-unsized pane).
    const isActive = props.isActive
    const centsOffset = props.centsOffset
    const targetNote = props.targetNote

    if (
      !isActive ||
      !mainCtx ||
      !offscreenCtx ||
      !offscreenCanvas ||
      !canvasRef ||
      cssW === 0 ||
      cssH === 0
    )
      return

    const centerY = cssH / 2

    // Shift the scroll surface left (faster scrolling than spectrogram).
    // The self-copy happens in device pixels so nothing resamples.
    const shiftDev = Math.max(1, Math.round(2 * dpr))
    const shift = shiftDev / dpr // CSS pixels actually shifted
    const devW = offscreenCanvas.width
    const devH = offscreenCanvas.height
    if (devW <= shiftDev) return
    offscreenCtx.setTransform(1, 0, 0, 1, 0, 0)
    offscreenCtx.drawImage(
      offscreenCanvas,
      shiftDev,
      0,
      devW - shiftDev,
      devH,
      0,
      0,
      devW - shiftDev,
      devH,
    )
    offscreenCtx.setTransform(dpr, 0, 0, dpr, 0, 0)

    // Clear new area on right
    offscreenCtx.fillStyle = '#0f172a'
    offscreenCtx.fillRect(cssW - shift, 0, shift, cssH)

    // Redraw reference lines in the cleared area
    drawReferenceLines(offscreenCtx, cssW - shift, cssW)

    // Draw data point if available
    if (centsOffset !== null) {
      // Clamp between -50 and 50
      const clampedCents = Math.max(
        -centsRange,
        Math.min(centsRange, centsOffset),
      )
      const y = centerY - (clampedCents / centsRange) * (cssH / 2)

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
      offscreenCtx.arc(cssW - shift / 2, y, 2, 0, 2 * Math.PI)
      offscreenCtx.fill()
    }

    // Render to main canvas with the fixed annotations on top
    renderFrame(targetNote)
  })

  onCleanup(() => {
    offscreenCanvas = undefined
    offscreenCtx = null
    mainCtx = null
  })

  return (
    <canvas
      ref={canvasRef}
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
