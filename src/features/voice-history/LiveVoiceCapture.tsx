// ============================================================
// Live Voice Capture — truthful mic energy and pitch contour while recording
// ============================================================

import type { Component } from 'solid-js'
import { createEffect, createSignal, onCleanup } from 'solid-js'
import type { PitchFrame } from '@/lib/pitch-f0-stream'
import styles from './LiveVoiceCapture.module.css'

export interface LiveVoicePoint {
  level: number
  pitch: number | null
}

const MAX_POINTS = 180

export function pitchToMidi(frequency: number): number {
  return 69 + 12 * Math.log2(frequency / 440)
}

export function createLiveVoicePoint(frame: PitchFrame): LiveVoicePoint {
  const rawLevel = Math.max(0, Math.min(1, frame.rms * 10))
  return {
    level: Math.pow(rawLevel, 0.62),
    pitch: frame.f0 > 0 && frame.conf >= 0.5 ? pitchToMidi(frame.f0) : null,
  }
}

export function appendLiveVoicePoint(
  points: readonly LiveVoicePoint[],
  point: LiveVoicePoint,
  limit = MAX_POINTS,
): LiveVoicePoint[] {
  const next = [...points, point]
  return next.length > limit ? next.slice(next.length - limit) : next
}

export const LiveVoiceCapture: Component<{
  active: boolean
  frame: () => PitchFrame | null
}> = (props) => {
  let canvas: HTMLCanvasElement | undefined
  let resizeObserver: ResizeObserver | null = null
  let animationFrame: number | null = null
  let points: LiveVoicePoint[] = []
  let lastFrameTime = -1
  let cameraCenter = 60
  let lastVisualUpdate = 0
  const reducedMotion =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const [inputStatus, setInputStatus] = createSignal<
    'waiting' | 'input' | 'pitch'
  >('waiting')

  const draw = (): void => {
    if (!canvas) return
    const bounds = canvas.getBoundingClientRect()
    if (bounds.width <= 0 || bounds.height <= 0) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const width = bounds.width
    const height = bounds.height
    const pixelWidth = Math.round(width * dpr)
    const pixelHeight = Math.round(height * dpr)
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth
      canvas.height = pixelHeight
    }
    const context = canvas.getContext('2d')
    if (!context) return
    context.setTransform(dpr, 0, 0, dpr, 0, 0)
    context.clearRect(0, 0, width, height)

    const backdrop = context.createLinearGradient(0, 0, width, height)
    backdrop.addColorStop(0, 'rgba(7, 18, 33, 0.98)')
    backdrop.addColorStop(0.55, 'rgba(9, 22, 39, 0.94)')
    backdrop.addColorStop(1, 'rgba(19, 13, 39, 0.96)')
    context.fillStyle = backdrop
    context.fillRect(0, 0, width, height)

    context.strokeStyle = 'rgba(140, 185, 255, 0.09)'
    context.lineWidth = 1
    for (const ratio of [0.25, 0.5, 0.75]) {
      const y = height * ratio
      context.beginPath()
      context.moveTo(0, y)
      context.lineTo(width, y)
      context.stroke()
    }

    if (points.length === 0) return
    const step = width / Math.max(1, MAX_POINTS - 1)
    const startX = width - (points.length - 1) * step
    const middle = height * 0.54
    const maxHalfHeight = height * 0.37

    const envelope = context.createLinearGradient(0, 0, width, 0)
    envelope.addColorStop(0, 'rgba(72, 156, 255, 0.08)')
    envelope.addColorStop(0.55, 'rgba(79, 224, 218, 0.22)')
    envelope.addColorStop(1, 'rgba(166, 120, 255, 0.31)')
    context.fillStyle = envelope
    context.shadowColor = 'rgba(76, 213, 222, 0.28)'
    context.shadowBlur = reducedMotion ? 0 : 14
    context.beginPath()
    points.forEach((point, index) => {
      const x = startX + index * step
      const y = middle - Math.max(1.5, point.level * maxHalfHeight)
      if (index === 0) context.moveTo(x, y)
      else context.lineTo(x, y)
    })
    for (let index = points.length - 1; index >= 0; index--) {
      const point = points[index]!
      context.lineTo(
        startX + index * step,
        middle + Math.max(1.5, point.level * maxHalfHeight),
      )
    }
    context.closePath()
    context.fill()
    context.shadowBlur = 0

    points.forEach((point, index) => {
      const x = startX + index * step
      const halfHeight = Math.max(1.5, point.level * maxHalfHeight)
      const position = index / Math.max(1, points.length - 1)
      context.strokeStyle = `rgba(${Math.round(74 + position * 105)}, ${Math.round(218 - position * 54)}, 255, ${0.18 + point.level * 0.42})`
      context.lineWidth = Math.max(1, step * 0.48)
      context.beginPath()
      context.moveTo(x, middle - halfHeight)
      context.lineTo(x, middle + halfHeight)
      context.stroke()
    })

    const voiced = points
      .slice(-90)
      .map((point) => point.pitch)
      .filter((pitch): pitch is number => pitch !== null)
      .sort((left, right) => left - right)
    if (voiced.length > 0) {
      const target = voiced[Math.floor(voiced.length / 2)]!
      cameraCenter += (target - cameraCenter) * 0.08
    }
    const pitchY = (pitch: number): number =>
      Math.max(
        10,
        Math.min(height - 10, middle - ((pitch - cameraCenter) / 24) * height),
      )

    const trace = (): void => {
      let drawing = false
      context.beginPath()
      points.forEach((point, index) => {
        if (point.pitch === null) {
          drawing = false
          return
        }
        const x = startX + index * step
        const y = pitchY(point.pitch)
        if (!drawing) context.moveTo(x, y)
        else context.lineTo(x, y)
        drawing = true
      })
      context.stroke()
    }
    context.lineCap = 'round'
    context.lineJoin = 'round'
    context.strokeStyle = 'rgba(80, 220, 232, 0.18)'
    context.lineWidth = 9
    context.shadowColor = 'rgba(69, 216, 231, 0.42)'
    context.shadowBlur = reducedMotion ? 0 : 15
    trace()
    context.shadowBlur = 0
    context.strokeStyle = 'rgba(119, 226, 237, 0.72)'
    context.lineWidth = 3.4
    trace()
    context.strokeStyle = 'rgba(225, 251, 255, 0.96)'
    context.lineWidth = 1.35
    trace()

    let lastVoicedIndex = -1
    for (let index = points.length - 1; index >= 0; index--) {
      if (points[index]!.pitch !== null) {
        lastVoicedIndex = index
        break
      }
    }
    if (lastVoicedIndex >= 0) {
      const last = points[lastVoicedIndex]!
      const x = startX + lastVoicedIndex * step
      const y = pitchY(last.pitch!)
      const radius = 3.5 + last.level * 5
      context.fillStyle = '#ff6b70'
      context.shadowColor = 'rgba(255, 86, 100, 0.78)'
      context.shadowBlur = reducedMotion ? 0 : 15
      context.beginPath()
      context.arc(x, y, radius, 0, Math.PI * 2)
      context.fill()
      context.shadowBlur = 0
    }
  }

  const loop = (timestamp: number): void => {
    animationFrame = null
    if (!props.active) return
    if (reducedMotion && timestamp - lastVisualUpdate < 100) {
      animationFrame = requestAnimationFrame(loop)
      return
    }
    lastVisualUpdate = timestamp
    const frame = props.frame()
    if (frame !== null && frame.t !== lastFrameTime) {
      lastFrameTime = frame.t
      points = appendLiveVoicePoint(points, createLiveVoicePoint(frame))
      setInputStatus(
        frame.rms < 0.005
          ? 'waiting'
          : frame.f0 > 0 && frame.conf >= 0.5
            ? 'pitch'
            : 'input',
      )
    }
    draw()
    animationFrame = requestAnimationFrame(loop)
  }

  const stopLoop = (): void => {
    if (animationFrame !== null) cancelAnimationFrame(animationFrame)
    animationFrame = null
  }

  createEffect(() => {
    if (props.active) {
      points = []
      lastFrameTime = -1
      cameraCenter = 60
      lastVisualUpdate = 0
      setInputStatus('waiting')
      stopLoop()
      animationFrame = requestAnimationFrame(loop)
    } else {
      stopLoop()
    }
  })

  onCleanup(() => {
    stopLoop()
    resizeObserver?.disconnect()
  })

  return (
    <div class={styles.surface}>
      <div class={styles.legend} aria-hidden="true">
        <span>Input shape</span>
        <span>Pitch contour</span>
      </div>
      <canvas
        ref={(element) => {
          canvas = element
          resizeObserver =
            typeof ResizeObserver === 'undefined'
              ? null
              : new ResizeObserver(draw)
          resizeObserver?.observe(element)
        }}
        class={styles.canvas}
        data-testid="live-voice-capture"
        aria-hidden="true"
      />
      <span
        class={styles.srOnly}
        role="status"
        aria-live="polite"
        data-testid="live-voice-status"
      >
        {inputStatus() === 'pitch'
          ? 'Recording: voice input and pitch detected.'
          : inputStatus() === 'input'
            ? 'Recording: voice input detected; listening for a clear pitch.'
            : 'Recording: listening for voice input.'}
      </span>
      <span class={styles.liveEdge} aria-hidden="true" />
    </div>
  )
}
