// Studio waveform — peaks and loudness in the lane's hue, with fade geometry, rendered without playback.
import { createEffect, createSignal, onCleanup, untrack } from 'solid-js'
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

export function StudioWaveform(props: StudioWaveformProps) {
  let canvas: HTMLCanvasElement | undefined
  let request = 0
  let animation: number | null = null
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

  function draw(): void {
    if (!canvas) return
    const width = canvas.clientWidth
    const height = canvas.clientHeight
    if (width <= 0 || height <= 0) return
    const ratio = Math.min(2, globalThis.devicePixelRatio || 1)
    canvas.width = Math.ceil(width * ratio)
    canvas.height = Math.ceil(height * ratio)
    const context = canvas.getContext('2d')
    if (!context) return
    context.setTransform(ratio, 0, 0, ratio, 0, 0)
    context.clearRect(0, 0, width, height)
    const color = globalThis.getComputedStyle(canvas).color
    context.fillStyle = color
    context.strokeStyle = color
    const mid = height / 2
    const reach = mid - 2
    const wave = envelope()
    const clip = props.clip
    const columns = Math.ceil(width)
    // Silence still shows as a hairline, so an empty clip reads as audio.
    context.globalAlpha = 0.35
    context.fillRect(0, Math.round(mid) - 0.5, width, 1)
    if (wave) {
      const { high, low, body } = envelopeColumns(
        wave,
        clip,
        columns,
        props.sourceInFrame,
        props.sourceOutFrame,
      )
      context.globalAlpha = 0.42
      fillBand(
        context,
        (x) => mid - high[x] * reach,
        (x) => mid - low[x] * reach,
        columns,
      )
      context.globalAlpha = 1
      fillBand(
        context,
        (x) => mid - body[x] * reach,
        (x) => mid + body[x] * reach,
        columns,
      )
    }
    if (
      props.clip.fades.in !== undefined ||
      props.clip.fades.out !== undefined
    ) {
      // Shade what a fade removes and trace the gain curve over it.
      const curve: number[] = []
      for (let x = 0; x <= columns; x += 2) {
        const source =
          props.sourceInFrame +
          (x / width) * (props.sourceOutFrame - props.sourceInFrame)
        const gain = studioClipGainAtSourceFrame({ ...clip, gainDb: 0 }, source)
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
    void envelope()
    schedule()
  })
  const observer =
    typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedule)
  const appearance =
    typeof MutationObserver === 'undefined'
      ? null
      : new MutationObserver(schedule)
  onCleanup(() => {
    observer?.disconnect()
    appearance?.disconnect()
    if (animation !== null) cancelAnimationFrame(animation)
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
