// ============================================================
// VoiceTrace — the target line and the sung line flowing along it
// ============================================================
//
// One canvas across the whole stage. The target line runs the full width
// through the middle of the lantern; the voice enters from the left and
// arrives at the glass, newest point first, so a held note draws a line
// that lies on the target with small ripples where it wavers (storyboard
// screen 2). A faint band marks the tolerance either side of the line.

import type { JSX } from 'solid-js'
import { createEffect, onCleanup, onMount } from 'solid-js'
import type { VoiceTraceBuffer } from './voice-trace-buffer'

export interface VoiceTraceProps {
  trace: VoiceTraceBuffer
  /** The session clock, seconds. */
  now: () => number
  /** Where the line runs, px from the canvas top. */
  lineY: () => number
  /** Where the newest point lands, px from the canvas left. */
  anchorX: () => number
  /** The tolerance either side of the target, in cents. */
  toleranceCents: number
  /** Draw while true; a still frame otherwise. */
  active: () => boolean
  class?: string
}

/** Seconds of voice drawn between the left edge and the glass. */
const WINDOW_SEC = 4
/** Vertical scale: how far a cent moves the line. */
const PX_PER_CENT = 0.32
const MAX_CENTS = 160

export function VoiceTrace(props: VoiceTraceProps): JSX.Element {
  let canvas: HTMLCanvasElement | undefined
  let frame = 0
  let width = 0
  let height = 0

  const resize = (): void => {
    if (canvas === undefined) return
    const ratio = Math.min(3, window.devicePixelRatio || 1)
    width = canvas.clientWidth
    height = canvas.clientHeight
    canvas.width = Math.max(1, Math.round(width * ratio))
    canvas.height = Math.max(1, Math.round(height * ratio))
    const ctx = canvas.getContext('2d')
    ctx?.setTransform(ratio, 0, 0, ratio, 0, 0)
  }

  const draw = (): void => {
    const ctx = canvas?.getContext('2d')
    if (ctx === null || ctx === undefined) return
    ctx.clearRect(0, 0, width, height)
    const y0 = props.lineY()
    const band = props.toleranceCents * PX_PER_CENT

    ctx.fillStyle = 'rgba(120, 200, 255, 0.07)'
    ctx.fillRect(0, y0 - band, width, band * 2)
    ctx.strokeStyle = 'rgba(150, 205, 255, 0.6)'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(0, y0)
    ctx.lineTo(width, y0)
    ctx.stroke()

    const anchor = props.anchorX()
    const now = props.now()
    const samples = props.trace.all()
    if (samples.length === 0 || anchor <= 0) return
    const gradient = ctx.createLinearGradient(0, 0, anchor, 0)
    gradient.addColorStop(0, 'rgba(4, 236, 216, 0)')
    gradient.addColorStop(0.35, 'rgba(4, 236, 216, 0.85)')
    gradient.addColorStop(1, 'rgba(176, 120, 255, 1)')
    ctx.strokeStyle = gradient
    ctx.lineWidth = 3
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    ctx.shadowColor = 'rgba(150, 110, 255, 0.7)'
    ctx.shadowBlur = 8
    ctx.beginPath()
    let pen = false
    for (const sample of samples) {
      const age = now - sample.t
      if (age > WINDOW_SEC || age < 0) continue
      if (sample.cents === null) {
        pen = false
        continue
      }
      const cents = Math.max(-MAX_CENTS, Math.min(MAX_CENTS, sample.cents))
      const x = anchor - (age / WINDOW_SEC) * anchor
      const y = y0 - cents * PX_PER_CENT
      if (pen) ctx.lineTo(x, y)
      else ctx.moveTo(x, y)
      pen = true
    }
    ctx.stroke()
    ctx.shadowBlur = 0
  }

  const loop = (): void => {
    draw()
    frame = props.active() ? requestAnimationFrame(loop) : 0
  }

  onMount(() => {
    resize()
    const observer = new ResizeObserver(() => {
      resize()
      draw()
    })
    if (canvas !== undefined) observer.observe(canvas)
    onCleanup(() => {
      observer.disconnect()
    })
  })

  createEffect(() => {
    if (props.active()) {
      if (frame === 0) frame = requestAnimationFrame(loop)
    } else {
      // One last frame, so the line the singer just drew stays put.
      draw()
    }
  })

  onCleanup(() => {
    if (frame !== 0) cancelAnimationFrame(frame)
    frame = 0
  })

  return (
    <canvas
      ref={canvas}
      class={props.class}
      aria-hidden="true"
      data-testid="long-note-trace"
    />
  )
}
