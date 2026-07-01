// ============================================================
// Voice Mirror — live visual feedback while recording.
//
// Three modes, one canvas:
//   glide — the pitch trace draws as they sing (stars trail)
//   hold  — a ring that tightens the steadier the note is held
//   match — target line, dot shows the octave-folded offset
//
// Feedback only — judgment comes later, from the pure metrics.
// ============================================================

import type { Component } from 'solid-js'
import { createEffect, onCleanup, onMount } from 'solid-js'
import type { F0Frame } from '@/lib/mirror/metrics'
import { CONF_MIN, foldCents, hzToCents } from '@/lib/mirror/metrics'

export type LiveVizMode = 'glide' | 'hold' | 'match'

interface LiveVizProps {
  latest: () => F0Frame | null
  mode: LiveVizMode
  targetMidi: number | null
  /** Changing this clears the trail (a new take started). */
  resetKey: number
}

const WIDTH = 640
const HEIGHT = 240

export const LiveViz: Component<LiveVizProps> = (props) => {
  let canvas: HTMLCanvasElement | undefined
  let rafId = 0
  let trail: Array<{ t: number; cents: number }> = []
  let lastFrameT = -1

  createEffect(() => {
    void props.resetKey
    trail = []
    lastFrameT = -1
  })

  onMount(() => {
    const ctx = canvas?.getContext('2d')
    if (!ctx) return

    const draw = (): void => {
      rafId = requestAnimationFrame(draw)
      const frame = props.latest()
      if (frame && frame.t !== lastFrameT) {
        lastFrameT = frame.t
        if (frame.f0 > 0 && frame.conf >= CONF_MIN) {
          trail.push({ t: frame.t, cents: hzToCents(frame.f0) })
          if (trail.length > 900) trail.shift()
        }
      }

      ctx.clearRect(0, 0, WIDTH, HEIGHT)
      if (props.mode === 'hold') drawHold(ctx)
      else if (props.mode === 'match') drawMatch(ctx)
      else drawGlide(ctx)
    }
    draw()
  })
  onCleanup(() => cancelAnimationFrame(rafId))

  function drawGlide(ctx: CanvasRenderingContext2D): void {
    if (trail.length === 0) return
    const centsValues = trail.map((p) => p.cents)
    const min = Math.min(...centsValues) - 150
    const max = Math.max(...centsValues) + 150
    const tMax = Math.max(4, trail[trail.length - 1].t)
    for (const point of trail) {
      const x = (point.t / tMax) * (WIDTH - 24) + 12
      const y =
        HEIGHT - 16 - ((point.cents - min) / (max - min)) * (HEIGHT - 32)
      ctx.fillStyle = '#8fa3ff'
      ctx.globalAlpha = 0.8
      ctx.beginPath()
      ctx.arc(x, y, 2.4, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
  }

  function drawHold(ctx: CanvasRenderingContext2D): void {
    // Ring radius follows the wobble of the last ~second of voiced pitch.
    const recent = trail.slice(-60)
    let spread = 44
    if (recent.length >= 8) {
      const mean = recent.reduce((s, p) => s + p.cents, 0) / recent.length
      const sd = Math.sqrt(
        recent.reduce((s, p) => s + (p.cents - mean) ** 2, 0) / recent.length,
      )
      spread = 12 + Math.min(60, sd * 1.6)
    }
    const cx = WIDTH / 2
    const cy = HEIGHT / 2
    ctx.strokeStyle = '#a8b6ff'
    ctx.lineWidth = 3
    ctx.globalAlpha = 0.9
    ctx.beginPath()
    ctx.arc(cx, cy, 18 + spread, 0, Math.PI * 2)
    ctx.stroke()
    ctx.globalAlpha = 1
    ctx.fillStyle = recent.length >= 8 ? '#ffe9a8' : '#4a4a6a'
    ctx.beginPath()
    ctx.arc(cx, cy, 10, 0, Math.PI * 2)
    ctx.fill()
  }

  function drawMatch(ctx: CanvasRenderingContext2D): void {
    const cy = HEIGHT / 2
    // Target line.
    ctx.strokeStyle = '#ffe9a8'
    ctx.globalAlpha = 0.7
    ctx.lineWidth = 2
    ctx.setLineDash([8, 8])
    ctx.beginPath()
    ctx.moveTo(24, cy)
    ctx.lineTo(WIDTH - 24, cy)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.globalAlpha = 1

    if (trail.length === 0 || props.targetMidi === null) return
    const last = trail[trail.length - 1]
    const folded = foldCents(last.cents - props.targetMidi * 100)
    const clamped = Math.max(-150, Math.min(150, folded))
    const y = cy - (clamped / 150) * (HEIGHT / 2 - 24)
    ctx.fillStyle = Math.abs(folded) <= 35 ? '#8be9b8' : '#8fa3ff'
    ctx.shadowColor = ctx.fillStyle
    ctx.shadowBlur = 12
    ctx.beginPath()
    ctx.arc(WIDTH / 2, y, 9, 0, Math.PI * 2)
    ctx.fill()
    ctx.shadowBlur = 0
  }

  return (
    <canvas ref={canvas} class="mirror-liveviz" width={WIDTH} height={HEIGHT} />
  )
}
