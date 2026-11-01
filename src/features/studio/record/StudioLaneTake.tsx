// Studio lane take — the armed lane's level and the take growing in its lane as it records, drawn only where the lane is in view.
//
// Each chunk the recorder hands over (about every 85 ms) adds peaks, and
// the visible part of the take is drawn again from them: at most one
// canvas the width of the view, and nothing at all once the take is out
// of view. No animation frame runs: a redraw follows a chunk, a scroll or
// a zoom, and nothing else.
import { createEffect, Show } from 'solid-js'
import { STUDIO_SAMPLE_RATE } from '@/lib/studio/model/types'
import type { StudioLiveTake } from '@/lib/studio/record/studio-recorder'
import { MicSmall } from '../studio-icons'
import { frameToPixel } from '../timeline/timeline-geometry'
import { StudioInputMeter } from './StudioInputMeter'
import styles from './StudioRecord.module.css'

export interface StudioLaneTakeProps {
  live: StudioLiveTake | null
  level: number
  /** Show the level: armed, counting in or recording. */
  listening: boolean
  /** Pixels per second. */
  scale: number
  /** The view's left edge in the lane, in pixels. */
  scroll: number
  contentWidth: number
}

/** The take's span on the timeline: from where its clip will start to what has arrived. */
export function liveTakeSpan(live: StudioLiveTake): {
  from: number
  to: number
} {
  const from = Math.max(0, live.fromFrame ?? live.heardFirst)
  const arrived =
    (live.count * live.peaks.bucketFrames * STUDIO_SAMPLE_RATE) /
    live.sampleRate
  return { from, to: Math.max(from, live.heardFirst + arrived) }
}

function drawLive(
  canvas: HTMLCanvasElement,
  live: StudioLiveTake,
  firstFrame: number,
  framesPerPixel: number,
  width: number,
): void {
  const ratio = globalThis.devicePixelRatio || 1
  // The box's height, not the canvas's own, which follows its pixel size.
  const boxHeight = canvas.parentElement?.clientHeight ?? 0
  const height = boxHeight > 0 ? boxHeight : 40
  // Resizing reallocates the canvas, so it happens only when the size moves.
  const pixelWidth = Math.max(1, Math.round(width * ratio))
  const pixelHeight = Math.max(1, Math.round(height * ratio))
  if (canvas.width !== pixelWidth) canvas.width = pixelWidth
  if (canvas.height !== pixelHeight) canvas.height = pixelHeight
  const context = canvas.getContext('2d')
  if (context === null) return
  context.setTransform(ratio, 0, 0, ratio, 0, 0)
  context.clearRect(0, 0, width, height)
  context.fillStyle = window.getComputedStyle(canvas).color
  const toBucket =
    live.sampleRate / STUDIO_SAMPLE_RATE / live.peaks.bucketFrames
  const middle = height / 2
  for (let x = 0; x < width; x++) {
    const frame = firstFrame + x * framesPerPixel - live.heardFirst
    const from = Math.max(0, Math.floor(frame * toBucket))
    const to = Math.min(
      live.count,
      Math.ceil((frame + framesPerPixel) * toBucket),
    )
    let peak = 0
    for (let bucket = from; bucket < to; bucket++)
      peak = Math.max(peak, live.peaks.peaks[bucket])
    const half = Math.max(0.5, Math.min(1, peak) * (middle - 2))
    context.fillRect(x, middle - half, 1, half * 2)
  }
}

export function StudioLaneTake(props: StudioLaneTakeProps) {
  let canvas: HTMLCanvasElement | undefined
  const box = () => {
    const live = props.live
    if (live === null) return null
    const span = liveTakeSpan(live)
    const left = frameToPixel(span.from, props.scale)
    const width = frameToPixel(span.to - span.from, props.scale)
    const shownFrom = Math.max(left, props.scroll)
    const shownTo = Math.min(left + width, props.scroll + props.contentWidth)
    return { live, left, width, shownFrom, shownTo }
  }
  createEffect(() => {
    const shown = box()
    if (canvas === undefined || shown === null) return
    const width = Math.floor(shown.shownTo - shown.shownFrom)
    if (width <= 0) return
    const framesPerPixel = STUDIO_SAMPLE_RATE / props.scale
    drawLive(
      canvas,
      shown.live,
      liveTakeSpan(shown.live).from +
        (shown.shownFrom - shown.left) * framesPerPixel,
      framesPerPixel,
      width,
    )
  })
  return (
    <>
      <Show when={box()}>
        {(shown) => (
          <div
            class={styles.liveTake}
            data-studio-live-take=""
            style={{ left: `${shown().left}px`, width: `${shown().width}px` }}
          >
            <Show when={shown().shownTo > shown().shownFrom}>
              <canvas
                ref={canvas}
                class={styles.liveWave}
                style={{
                  left: `${shown().shownFrom - shown().left}px`,
                  width: `${Math.floor(shown().shownTo - shown().shownFrom)}px`,
                }}
              />
            </Show>
          </div>
        )}
      </Show>
      <Show when={props.listening}>
        <span
          class={styles.laneMeter}
          data-studio-lane-meter=""
          data-recording={props.live === null ? undefined : ''}
          style={{ left: `${props.scroll + 8}px` }}
        >
          <MicSmall />
          <StudioInputMeter level={props.level} />
        </span>
      </Show>
    </>
  )
}
