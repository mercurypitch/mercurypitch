// ============================================================
// Guided Pitch Centre Canvas — fixed-target voice landing map
// ============================================================
//
// The canvas combines relative input energy with an exact-register pitch
// trail. Result evidence remains operable through equivalent DOM buttons, and
// pointer seeking never starts playback.

import type { Component } from 'solid-js'
import { createEffect, For, onCleanup, Show } from 'solid-js'
import { midiToNoteName } from '@/lib/frequency-to-note'
import type { PitchFrame } from '@/lib/pitch-f0-stream'
import styles from './GuidedPitchCentreCanvas.module.css'

export interface GuidedCanvasSegment {
  id: string
  targetMidi: number
  audioOffsetMs: number
  durationMs: number
  frames: readonly PitchFrame[]
}

export interface GuidedCanvasEvidence {
  id: string
  label: string
  seconds: number
}

interface GuidedPitchCentreCanvasProps {
  active: boolean
  targetMidi: number
  targetSummary?: string
  frame: () => PitchFrame | null
  phaseLabel: string
  segments?: readonly GuidedCanvasSegment[]
  durationMs?: number
  evidence?: readonly GuidedCanvasEvidence[]
  selectedEvidenceId?: string | null
  onSeekEvidence?: (evidence: GuidedCanvasEvidence) => void
}

interface RenderPoint {
  timeMs: number
  midi: number | null
  level: number
  targetMidi: number
}

const LIVE_WINDOW_MS = 3_400
const CENTS_WINDOW = 300

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value))
}

function midiFromFrame(frame: PitchFrame): number | null {
  return frame.f0 > 0 && frame.conf >= 0.5
    ? 69 + 12 * Math.log2(frame.f0 / 440)
    : null
}

function levelFromFrame(frame: PitchFrame): number {
  return Math.pow(clamp(frame.rms * 10, 0, 1), 0.62)
}

function formatSeconds(seconds: number): string {
  return `${Math.max(0, seconds).toFixed(1)}s`
}

export const GuidedPitchCentreCanvas: Component<
  GuidedPitchCentreCanvasProps
> = (props) => {
  let canvas: HTMLCanvasElement | undefined
  let observer: ResizeObserver | null = null
  let animationFrame: number | null = null
  let livePoints: RenderPoint[] = []
  let lastFrameTime = -1
  let lastTarget: number | null = null
  const reducedMotion =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const resultPoints = (): RenderPoint[] =>
    (props.segments ?? []).flatMap((segment) =>
      segment.frames.map((frame) => ({
        timeMs: segment.audioOffsetMs + frame.t * 1000,
        midi: midiFromFrame(frame),
        level: levelFromFrame(frame),
        targetMidi: segment.targetMidi,
      })),
    )

  const currentPoints = (): {
    points: readonly RenderPoint[]
    durationMs: number
    live: boolean
  } => {
    if ((props.segments?.length ?? 0) > 0) {
      return {
        points: resultPoints(),
        durationMs: Math.max(1, props.durationMs ?? 1),
        live: false,
      }
    }
    return {
      points: livePoints,
      durationMs: LIVE_WINDOW_MS,
      live: true,
    }
  }

  const draw = (): void => {
    if (canvas === undefined) return
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
    if (context === null) return
    context.setTransform(dpr, 0, 0, dpr, 0, 0)
    context.clearRect(0, 0, width, height)

    const background = context.createLinearGradient(0, 0, width, height)
    background.addColorStop(0, '#071421')
    background.addColorStop(0.58, '#0a1727')
    background.addColorStop(1, '#15132d')
    context.fillStyle = background
    context.fillRect(0, 0, width, height)

    const center = height * 0.52
    const usableHeight = height * 0.66
    context.lineWidth = 1
    for (const cents of [-200, -100, 0, 100, 200]) {
      const y = center - (cents / (CENTS_WINDOW * 2)) * usableHeight
      context.strokeStyle =
        cents === 0 ? 'rgba(255, 222, 137, 0.48)' : 'rgba(151, 187, 228, 0.10)'
      context.beginPath()
      context.moveTo(0, y)
      context.lineTo(width, y)
      context.stroke()
    }

    const data = currentPoints()
    if (data.points.length === 0) return
    const lastTime = data.points.at(-1)?.timeMs ?? 0
    const liveOrigin = Math.max(0, lastTime - data.durationMs)
    const xForTime = (timeMs: number): number =>
      data.live
        ? ((timeMs - liveOrigin) / data.durationMs) * width
        : (timeMs / data.durationMs) * width
    const yForPitch = (midi: number, targetMidi: number): number =>
      clamp(
        center -
          (((midi - targetMidi) * 100) / CENTS_WINDOW) * (usableHeight / 2),
        10,
        height - 10,
      )

    const envelope = context.createLinearGradient(0, 0, width, 0)
    envelope.addColorStop(0, 'rgba(65, 207, 212, 0.08)')
    envelope.addColorStop(0.64, 'rgba(73, 215, 219, 0.25)')
    envelope.addColorStop(1, 'rgba(151, 111, 255, 0.24)')
    context.fillStyle = envelope
    context.beginPath()
    data.points.forEach((point, index) => {
      const x = xForTime(point.timeMs)
      const y = center - Math.max(1.5, point.level * height * 0.33)
      if (index === 0) context.moveTo(x, y)
      else context.lineTo(x, y)
    })
    for (let index = data.points.length - 1; index >= 0; index -= 1) {
      const point = data.points[index]!
      context.lineTo(
        xForTime(point.timeMs),
        center + Math.max(1.5, point.level * height * 0.33),
      )
    }
    context.closePath()
    context.fill()

    const trace = (): void => {
      let drawing = false
      context.beginPath()
      for (const point of data.points) {
        if (point.midi === null) {
          drawing = false
          continue
        }
        const x = xForTime(point.timeMs)
        const y = yForPitch(point.midi, point.targetMidi)
        if (!drawing) context.moveTo(x, y)
        else context.lineTo(x, y)
        drawing = true
      }
      context.stroke()
    }
    context.lineCap = 'round'
    context.lineJoin = 'round'
    context.strokeStyle = 'rgba(62, 221, 224, 0.22)'
    context.lineWidth = 10
    context.shadowColor = 'rgba(65, 216, 221, 0.42)'
    context.shadowBlur = reducedMotion ? 0 : 13
    trace()
    context.shadowBlur = 0
    context.strokeStyle = 'rgba(104, 230, 232, 0.82)'
    context.lineWidth = 3.2
    trace()
    context.strokeStyle = 'rgba(237, 254, 255, 0.98)'
    context.lineWidth = 1.2
    trace()
  }

  const loop = (): void => {
    animationFrame = null
    if (!props.active) return
    if (props.targetMidi !== lastTarget) {
      livePoints = []
      lastFrameTime = -1
      lastTarget = props.targetMidi
    }
    const frame = props.frame()
    if (frame !== null && frame.t !== lastFrameTime) {
      lastFrameTime = frame.t
      livePoints.push({
        timeMs: frame.t * 1000,
        midi: midiFromFrame(frame),
        level: levelFromFrame(frame),
        targetMidi: props.targetMidi,
      })
      const cutoff = frame.t * 1000 - LIVE_WINDOW_MS
      livePoints = livePoints.filter((point) => point.timeMs >= cutoff)
    }
    draw()
    animationFrame = requestAnimationFrame(loop)
  }

  const stopLoop = (): void => {
    if (animationFrame !== null) cancelAnimationFrame(animationFrame)
    animationFrame = null
  }

  createEffect(() => {
    void props.segments
    void props.durationMs
    void props.selectedEvidenceId
    if (props.active) {
      stopLoop()
      animationFrame = requestAnimationFrame(loop)
    } else {
      stopLoop()
      draw()
    }
  })

  onCleanup(() => {
    stopLoop()
    observer?.disconnect()
  })

  const seekFromCanvas = (event: PointerEvent): void => {
    const evidence = props.evidence ?? []
    const durationMs = props.durationMs ?? 0
    if (
      evidence.length === 0 ||
      durationMs <= 0 ||
      props.onSeekEvidence === undefined ||
      canvas === undefined
    ) {
      return
    }
    const bounds = canvas.getBoundingClientRect()
    const seconds =
      clamp((event.clientX - bounds.left) / Math.max(1, bounds.width), 0, 1) *
      (durationMs / 1000)
    const nearest = [...evidence].sort(
      (left, right) =>
        Math.abs(left.seconds - seconds) - Math.abs(right.seconds - seconds),
    )[0]
    if (nearest !== undefined) props.onSeekEvidence(nearest)
  }

  return (
    <section class={styles.surface} aria-label="Pitch Centre voice map">
      <div class={styles.canvasHeader}>
        <div>
          <span>Pitch Centre</span>
          <strong>{props.phaseLabel}</strong>
        </div>
        <div class={styles.targetLabel}>
          <span>{props.targetSummary === undefined ? 'Target' : 'Route'}</span>
          <strong>
            {props.targetSummary ?? midiToNoteName(props.targetMidi)}
          </strong>
        </div>
      </div>
      <div class={styles.canvasWrap}>
        <canvas
          ref={(element) => {
            canvas = element
            observer =
              typeof ResizeObserver === 'undefined'
                ? null
                : new ResizeObserver(draw)
            observer?.observe(element)
          }}
          class={styles.canvas}
          data-testid="guided-pitch-centre-canvas"
          aria-hidden="true"
          onPointerDown={seekFromCanvas}
        />
        <span class={styles.targetHorizon} aria-hidden="true" />
        <Show when={(props.evidence?.length ?? 0) > 0}>
          <div class={styles.evidenceRail} aria-label="Evidence moments">
            <For each={props.evidence}>
              {(evidence, index) => (
                <button
                  type="button"
                  class={styles.evidenceMarker}
                  classList={{
                    [styles.evidenceMarkerSelected]:
                      props.selectedEvidenceId === evidence.id,
                  }}
                  style={{
                    left: `${clamp(
                      (evidence.seconds /
                        Math.max(0.001, (props.durationMs ?? 1) / 1000)) *
                        100,
                      1,
                      99,
                    )}%`,
                  }}
                  aria-label={`${evidence.label} at ${formatSeconds(evidence.seconds)}. Seek without playing.`}
                  onClick={() => props.onSeekEvidence?.(evidence)}
                >
                  <span class={styles.evidenceMarkerVisual} aria-hidden="true">
                    {index() + 1}
                  </span>
                </button>
              )}
            </For>
          </div>
        </Show>
      </div>
      <div class={styles.legend} aria-hidden="true">
        <span class={styles.targetKey}>Target centre</span>
        <span class={styles.pitchKey}>Your pitch</span>
        <span class={styles.energyKey}>Input energy</span>
      </div>
      <p class={styles.srSummary} role="status" aria-live="polite">
        {props.phaseLabel}.{' '}
        {props.targetSummary === undefined
          ? `Target note ${midiToNoteName(props.targetMidi)}.`
          : `Route ${props.targetSummary}.`}
      </p>
    </section>
  )
}
