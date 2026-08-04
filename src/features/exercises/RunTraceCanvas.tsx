// ============================================================
// RunTraceCanvas — the run you just sang, given back to you
// ============================================================
//
// The live tracker scrolls a 10-second window, so a finished run leaves it and
// is gone. The result card then reported a number where it could have reported
// a shape: 71% says nothing you can practise; a contour that drifts flat at the
// top of every phrase says exactly what to work on.
//
// The trace is already published by use-base-exercise, so this is only the
// view. It draws once — the run is over, nothing moves — and redraws on resize.

import type { Component } from 'solid-js'
import { createMemo, onCleanup, onMount, Show } from 'solid-js'
import type { RunTrace } from './last-run-trace'
import { traceBounds, worstMoment } from './run-trace-view'
import styles from './RunTraceCanvas.module.css'

const PAD_X = 6
const PAD_Y = 8

const NOTE_NAMES = [
  'C',
  'C#',
  'D',
  'D#',
  'E',
  'F',
  'F#',
  'G',
  'G#',
  'A',
  'A#',
  'B',
]

function noteNameFromFreq(freq: number): string {
  const midi = Math.round(12 * Math.log2(freq / 440) + 69)
  return `${NOTE_NAMES[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`
}

export interface RunTraceCanvasProps {
  trace: RunTrace
}

export const RunTraceCanvas: Component<RunTraceCanvasProps> = (props) => {
  let canvasRef: HTMLCanvasElement | undefined

  const bounds = createMemo(() => traceBounds(props.trace))
  const worst = createMemo(() => worstMoment(props.trace))

  const draw = (): void => {
    const box = bounds()
    if (!canvasRef || box === null) return
    const ctx = canvasRef.getContext('2d')
    const parent = canvasRef.parentElement
    if (!ctx || !parent) return

    const dpr = window.devicePixelRatio || 1
    const w = parent.clientWidth
    const h = parent.clientHeight
    if (w === 0 || h === 0) return
    canvasRef.width = w * dpr
    canvasRef.height = h * dpr
    canvasRef.style.width = `${w}px`
    canvasRef.style.height = `${h}px`
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)

    const logRange = box.logMax - box.logMin
    const plotW = w - PAD_X * 2
    const plotH = h - PAD_Y * 2
    const x = (t: number): number => PAD_X + (t / box.duration) * plotW
    const y = (f: number): number =>
      PAD_Y + plotH - ((Math.log2(f) - box.logMin) / logRange) * plotH

    // Targets first, as a step line: the timeline records one point per
    // change, so a target holds until the next — drawing it as a slope would
    // show a glide the drill never asked for.
    const targets = props.trace.targets
    if (targets.length > 0) {
      ctx.strokeStyle = 'rgba(63,185,80,0.55)'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      targets.forEach((point, i) => {
        const px = x(point.t)
        const py = y(point.f)
        if (i === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
        const nextT = targets[i + 1]?.t ?? box.duration
        ctx.lineTo(x(nextT), py)
      })
      ctx.stroke()
    }

    // The sung contour. Gaps where nothing was detected stay gaps — joining
    // across a silence would draw a slide the singer never made.
    ctx.strokeStyle = 'rgba(88,166,255,0.9)'
    ctx.lineWidth = 1.8
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    ctx.beginPath()
    let penDown = false
    for (const sample of props.trace.samples) {
      if (!Number.isFinite(sample.f) || sample.f <= 0) {
        penDown = false
        continue
      }
      const px = x(sample.t)
      const py = y(sample.f)
      if (penDown) ctx.lineTo(px, py)
      else ctx.moveTo(px, py)
      penDown = true
    }
    ctx.stroke()

    const bad = worst()
    if (bad !== null) {
      const px = x(bad.t)
      const py = y(bad.f)
      ctx.strokeStyle = 'rgba(248,81,73,0.5)'
      ctx.lineWidth = 1
      ctx.setLineDash([2, 3])
      ctx.beginPath()
      ctx.moveTo(px, y(bad.target))
      ctx.lineTo(px, py)
      ctx.stroke()
      ctx.setLineDash([])

      ctx.fillStyle = '#f85149'
      ctx.beginPath()
      ctx.arc(px, py, 3.5, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  onMount(() => {
    draw()
    const parent = canvasRef?.parentElement
    if (!parent || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => draw())
    observer.observe(parent)
    onCleanup(() => observer.disconnect())
  })

  return (
    <Show when={bounds()}>
      <figure class={styles.wrap}>
        <div class={styles.plot}>
          <canvas ref={canvasRef} />
        </div>
        <figcaption class={styles.caption}>
          <span class={styles.legend}>Your run</span>
          <Show
            when={worst()}
            fallback={<span class={styles.note}>No target to compare to</span>}
          >
            {(bad) => (
              <span class={styles.note}>
                Furthest off:{' '}
                <strong>{Math.abs(Math.round(bad().cents))}¢</strong>{' '}
                {bad().cents > 0 ? 'sharp' : 'flat'} of{' '}
                {noteNameFromFreq(bad().target)} at {bad().t.toFixed(1)}s
              </span>
            )}
          </Show>
        </figcaption>
      </figure>
    </Show>
  )
}

export default RunTraceCanvas
