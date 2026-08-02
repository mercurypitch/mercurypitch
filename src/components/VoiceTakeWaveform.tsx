// ============================================================
// Voice Take Waveform — responsive canvas art for dry voice captures
// ============================================================

import type { Component } from 'solid-js'
import { createEffect, onCleanup } from 'solid-js'

const FALLBACK_BUCKETS = 72

export interface VoiceWaveBar {
  x: number
  top: number
  width: number
  height: number
  played: boolean
  position: number
}

/** Spread cached peak buckets across the full rendered width. */
export function layoutVoiceWaveBars(
  peaks: ArrayLike<number> | null,
  width: number,
  height: number,
  progress: number,
): VoiceWaveBar[] {
  if (width <= 0 || height <= 0) return []
  const source = peaks !== null && peaks.length > 0 ? peaks : null
  const count = source?.length ?? FALLBACK_BUCKETS
  const step = width / count
  const barWidth = Math.max(1.5, Math.min(5, step * 0.55))
  const playedX = Math.max(0, Math.min(1, progress)) * width

  return Array.from({ length: count }, (_, index) => {
    // Missing legacy/corrupt peaks get an honest neutral baseline, not a
    // fabricated voice shape that could be mistaken for measured audio.
    const fallback = 0.045
    const amplitude = Math.max(0, Math.min(1, source?.[index] ?? fallback))
    const barHeight = Math.max(2, amplitude * (height * 0.86))
    const x = index * step + (step - barWidth) / 2
    return {
      x,
      top: height / 2 - barHeight / 2,
      width: barWidth,
      height: barHeight,
      played: x + barWidth / 2 <= playedX,
      position: index / count,
    }
  })
}

/** Glass-compatible aqua-to-violet waveform with a gold playback sweep. */
export const VoiceTakeWaveform: Component<{
  peaks: ArrayLike<number> | null
  progress: number
  playing: boolean
  class?: string
}> = (props) => {
  let canvas: HTMLCanvasElement | undefined
  let frame: number | null = null

  const draw = (): void => {
    if (!canvas) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const rect = canvas.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return
    const pixelWidth = Math.round(rect.width * dpr)
    const pixelHeight = Math.round(rect.height * dpr)
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth
      canvas.height = pixelHeight
    }
    const context = canvas.getContext('2d')
    if (!context) return
    context.setTransform(dpr, 0, 0, dpr, 0, 0)
    context.clearRect(0, 0, rect.width, rect.height)

    const bars = layoutVoiceWaveBars(
      props.peaks,
      rect.width,
      rect.height,
      props.progress,
    )
    for (const bar of bars) {
      context.fillStyle = bar.played
        ? 'rgba(255, 233, 168, 0.95)'
        : `rgba(${Math.round(88 + 100 * bar.position)}, ${Math.round(
            166 - 26 * bar.position,
          )}, 255, 0.9)`
      context.shadowColor = context.fillStyle
      context.shadowBlur = props.playing ? 6 : 3
      context.beginPath()
      context.roundRect(bar.x, bar.top, bar.width, bar.height, bar.width / 2)
      context.fill()
    }
    context.shadowBlur = 0

    if (props.playing) {
      const playedX = Math.max(0, Math.min(1, props.progress)) * rect.width
      context.strokeStyle = 'rgba(255, 233, 168, 0.9)'
      context.lineWidth = 1.4
      context.shadowColor = '#ffe9a8'
      context.shadowBlur = 8
      context.beginPath()
      context.moveTo(playedX, 2)
      context.lineTo(playedX, rect.height - 2)
      context.stroke()
      context.shadowBlur = 0
    }
  }

  const scheduleDraw = (): void => {
    if (frame !== null) cancelAnimationFrame(frame)
    frame = requestAnimationFrame(() => {
      frame = null
      draw()
    })
  }

  createEffect(() => {
    void props.peaks
    void props.progress
    void props.playing
    scheduleDraw()
  })

  const observer =
    typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(scheduleDraw)

  onCleanup(() => {
    if (frame !== null) cancelAnimationFrame(frame)
    observer?.disconnect()
  })

  return (
    <canvas
      class={props.class}
      aria-hidden="true"
      ref={(element) => {
        canvas = element
        observer?.observe(element)
      }}
    />
  )
}
