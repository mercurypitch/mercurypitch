// Studio waveform — peaks and loudness in the lane's hue, with fade geometry, rendered without playback.
//
// A draw reads its props once: every prop read reruns the clip's geometry,
// and the fade curve used to read them for every second pixel column. The
// canvas keeps its size unless the size changes (setting it, even to the same
// value, clears and reallocates the bitmap), the colour is read again only
// when the theme or the lane's colour changes, and a canvas out of the
// timeline's view is drawn once it comes into view.
import { createEffect, createSignal, onCleanup, onMount, untrack, } from 'solid-js'
import { studioClipGainAtSourceFrame } from '@/lib/studio/model/arrangement-plan'
import type { StudioAsset, StudioClip } from '@/lib/studio/model/types'
import styles from './StudioTimeline.module.css'
import type { StudioWaveformEnvelope, StudioWaveformResource, } from './waveform-resource'
import { StudioWaveformBusyError } from './waveform-resource'

export interface StudioWaveformProps {
  clip: StudioClip
  asset?: StudioAsset
  resource: StudioWaveformResource
  sourceInFrame: number
  sourceOutFrame: number
  /** The drawn width in CSS pixels, as the parent sized it. */
  width?: number
  /** The lane's colour: a change reads the drawn colour again. */
  color?: string
}

/** Column extremes and loudness, gain applied, ready to draw as two fills. */
function envelopeColumns(
  wave: StudioWaveformEnvelope,
  clip: StudioClip,
  width: number,
  sourceInFrame: number,
  sourceOutFrame: number,
) {
  const high = new Float32Array(width)
  const low = new Float32Array(width)
  const body = new Float32Array(width)
  const duration = sourceOutFrame - sourceInFrame
  for (let x = 0; x < width; x++) {
    const from = sourceInFrame + (x / width) * duration
    const to = sourceInFrame + ((x + 1) / width) * duration
    const first = Math.floor(from / wave.framesPerBucket)
    const last = Math.min(
      wave.minima.length - 1,
      Math.floor(to / wave.framesPerBucket),
    )
    let top = 0
    let bottom = 0
    let loud = 0
    for (let bucket = first; bucket <= last; bucket++) {
      bottom = Math.min(bottom, wave.minima[bucket])
      top = Math.max(top, wave.maxima[bucket])
      loud = Math.max(loud, wave.rms[bucket])
    }
    const gain = studioClipGainAtSourceFrame(clip, (from + to) / 2)
    high[x] = Math.min(1, top * gain)
    low[x] = Math.max(-1, bottom * gain)
    body[x] = Math.min(high[x], -low[x], loud * gain)
  }
  return { high, low, body }
}

function fillBand(
  context: CanvasRenderingContext2D,
  upper: (x: number) => number,
  lower: (x: number) => number,
  width: number,
): void {
  context.beginPath()
  context.moveTo(0, upper(0))
  for (let x = 0; x < width; x++) context.lineTo(x + 1, upper(x))
  for (let x = width - 1; x >= 0; x--) context.lineTo(x, lower(x))
  context.closePath()
  context.fill()
}

/** One draw's inputs, each prop read once. */
interface WaveformFrame {
  clip: StudioClip
  sourceInFrame: number
  sourceOutFrame: number
  width: number
  height: number
  columns: number
}

/**
 * The canvas at this size and device ratio, cleared. Its bitmap is set only
 * when the size changes: setting it, even to the same value, reallocates it.
 */
function fitCanvas(
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
): CanvasRenderingContext2D | null {
  const ratio = Math.min(2, globalThis.devicePixelRatio || 1)
  const pixelWidth = Math.ceil(width * ratio)
  const pixelHeight = Math.ceil(height * ratio)
  if (canvas.width !== pixelWidth) canvas.width = pixelWidth
  if (canvas.height !== pixelHeight) canvas.height = pixelHeight
  const context = canvas.getContext('2d')
  if (!context) return null
  context.setTransform(ratio, 0, 0, ratio, 0, 0)
  context.clearRect(0, 0, width, height)
  return context
}

function drawEnvelope(
  context: CanvasRenderingContext2D,
  wave: StudioWaveformEnvelope,
  frame: WaveformFrame,
): void {
  const mid = frame.height / 2
  const reach = mid - 2
  const { high, low, body } = envelopeColumns(
    wave,
    frame.clip,
    frame.columns,
    frame.sourceInFrame,
    frame.sourceOutFrame,
  )
  context.globalAlpha = 0.42
  fillBand(
    context,
    (x) => mid - high[x] * reach,
    (x) => mid - low[x] * reach,
    frame.columns,
  )
  context.globalAlpha = 1
  fillBand(
    context,
    (x) => mid - body[x] * reach,
    (x) => mid + body[x] * reach,
    frame.columns,
  )
}

/** Shade what a fade removes and trace the gain curve over it. */
function drawFades(
  context: CanvasRenderingContext2D,
  frame: WaveformFrame,
): void {
  const { clip, columns, width, height, sourceInFrame, sourceOutFrame } = frame
  const curve: number[] = []
  const unity = { ...clip, gainDb: 0 }
  for (let x = 0; x <= columns; x += 2) {
    const source =
      sourceInFrame + (x / width) * (sourceOutFrame - sourceInFrame)
    const gain = studioClipGainAtSourceFrame(unity, source)
    curve.push(x, 1 + (1 - gain) * (height - 2))
  }
  context.beginPath()
  context.moveTo(0, 0)
  for (let i = 0; i < curve.length; i += 2)
    context.lineTo(curve[i], curve[i + 1])
  context.lineTo(columns, 0)
  context.closePath()
  context.globalAlpha = 0.14
  context.fill()
  context.beginPath()
  for (let i = 0; i < curve.length; i += 2)
    if (i === 0) context.moveTo(curve[i], curve[i + 1])
    else context.lineTo(curve[i], curve[i + 1])
  context.globalAlpha = 0.9
  context.lineWidth = 1.25
  context.stroke()
}

export function StudioWaveform(props: StudioWaveformProps) {
  let canvas: HTMLCanvasElement | undefined
  let request = 0
  let animation: number | null = null
  // The canvas's CSS height, from the resize observer once it reports.
  let cssHeight: number | null = null
  // The colour read last, and what it was read for.
  let paint: { key: string; value: string } | null = null
  let themeEpoch = 0
  // Out of the timeline's view: a draw waits until it comes into view.
  let hidden = false
  let stale = false
  const [envelope, setEnvelope] = createSignal<StudioWaveformEnvelope | null>(
    null,
  )
  const [status, setStatus] = createSignal<
    'loading' | 'ready' | 'missing' | 'busy'
  >('loading')

  // A waveform refused for memory tries again later, backing off to 30 s.
  const [retry, setRetry] = createSignal(0)
  let retryTimer: ReturnType<typeof setTimeout> | undefined
  onCleanup(() => clearTimeout(retryTimer))

  createEffect(() => {
    const asset = props.asset
    const resource = props.resource
    const attempt = retry()
    const generation = ++request
    setEnvelope(null)
    if (asset === undefined) setStatus('missing')
    else if (untrack(status) !== 'busy') setStatus('loading')
    if (asset !== undefined) {
      void resource
        .get(asset)
        .then((value) => {
          if (generation === request) {
            setEnvelope(value)
            setStatus('ready')
          }
        })
        .catch((error: unknown) => {
          if (generation !== request) return
          const busy = error instanceof StudioWaveformBusyError
          setStatus(busy ? 'busy' : 'missing')
          if (busy)
            retryTimer = setTimeout(
              () => setRetry(attempt + 1),
              Math.min(30_000, 2000 * 2 ** attempt),
            )
        })
    }
    onCleanup(() => {
      request++
      clearTimeout(retryTimer)
    })
  })

  function colour(target: HTMLCanvasElement): string {
    const key = `${themeEpoch}:${props.color ?? ''}`
    if (paint?.key !== key)
      paint = { key, value: globalThis.getComputedStyle(target).color }
    return paint.value
  }

  function draw(): void {
    if (!canvas) return
    if (hidden) {
      stale = true
      return
    }
    stale = false
    // Read once; the resize observer keeps it after that.
    cssHeight ??= canvas.getBoundingClientRect().height
    // Every prop once: each read reruns the clip's geometry.
    const width = props.width ?? canvas.clientWidth
    const frame: WaveformFrame = {
      clip: props.clip,
      sourceInFrame: props.sourceInFrame,
      sourceOutFrame: props.sourceOutFrame,
      width,
      height: cssHeight,
      columns: Math.ceil(width),
    }
    if (frame.width <= 0 || frame.height <= 0) return
    const context = fitCanvas(canvas, frame.width, frame.height)
    if (!context) return
    const color = colour(canvas)
    context.fillStyle = color
    context.strokeStyle = color
    // Silence still shows as a hairline, so an empty clip reads as audio.
    context.globalAlpha = 0.35
    context.fillRect(0, Math.round(frame.height / 2) - 0.5, frame.width, 1)
    const wave = envelope()
    if (wave) drawEnvelope(context, wave, frame)
    const { fades } = frame.clip
    if (fades.in !== undefined || fades.out !== undefined)
      drawFades(context, frame)
    context.globalAlpha = 1
  }

  function schedule(): void {
    if (animation !== null) cancelAnimationFrame(animation)
    animation = requestAnimationFrame(() => {
      animation = null
      draw()
    })
  }
  createEffect(() => {
    void props.clip
    void props.sourceInFrame
    void props.sourceOutFrame
    void props.width
    void props.color
    void envelope()
    schedule()
  })
  const observer =
    typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver((entries) => {
          const box = entries.at(-1)?.contentRect
          if (box && box.height === cssHeight) return
          cssHeight = box?.height ?? null
          schedule()
        })
  const appearance =
    typeof MutationObserver === 'undefined'
      ? null
      : new MutationObserver(() => {
          themeEpoch++
          schedule()
        })
  let view: IntersectionObserver | null = null
  onCleanup(() => {
    observer?.disconnect()
    appearance?.disconnect()
    view?.disconnect()
    if (animation !== null) cancelAnimationFrame(animation)
  })

  // Draw only what the timeline shows: a lane scrolled out of view waits.
  // Mounted first, so the timeline's scroller is there to be the root.
  onMount(() => {
    const element = canvas
    if (!element || typeof IntersectionObserver === 'undefined') return
    // Until the observer first reports, a draw waits for it.
    hidden = true
    view = new IntersectionObserver(
      (entries) => {
        const seen = entries.at(-1)?.isIntersecting ?? true
        hidden = !seen
        if (seen && stale) schedule()
      },
      {
        root: element.closest('[data-studio-timeline-viewport]'),
        rootMargin: '160px 0px',
      },
    )
    view.observe(element)
  })

  return (
    <div
      class={styles.waveform}
      classList={{ [styles.missing]: status() === 'missing' }}
    >
      <canvas
        aria-hidden="true"
        ref={(element) => {
          canvas = element
          observer?.observe(element)
          appearance?.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['data-theme'],
          })
          schedule()
        }}
      />
      <span class={status() === 'ready' ? styles.srOnly : styles.waveStatus}>
        {status() === 'missing'
          ? 'Audio missing'
          : status() === 'busy'
            ? 'Waveform unavailable'
            : status() === 'loading'
              ? 'Loading waveform'
              : 'Audio waveform'}
      </span>
    </div>
  )
}
