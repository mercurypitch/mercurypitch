// Studio waveform — neutral source envelopes with retained fade geometry, rendered without playback.
import { createEffect, createSignal, onCleanup } from 'solid-js'
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

  createEffect(() => {
    const asset = props.asset
    const resource = props.resource
    const generation = ++request
    setEnvelope(null)
    setStatus(asset === undefined ? 'missing' : 'loading')
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
          if (generation === request)
            setStatus(
              error instanceof StudioWaveformBusyError ? 'busy' : 'missing',
            )
        })
    }
    onCleanup(() => {
      request++
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
    context.strokeStyle = globalThis.getComputedStyle(canvas).color
    context.lineWidth = 1
    const mid = height / 2
    const wave = envelope()
    const clip = props.clip
    context.beginPath()
    context.moveTo(0, mid)
    context.lineTo(width, mid)
    if (wave) {
      const duration = props.sourceOutFrame - props.sourceInFrame
      for (let x = 0; x < width; x++) {
        const from = props.sourceInFrame + (x / width) * duration
        const to = props.sourceInFrame + ((x + 1) / width) * duration
        const first = Math.floor(from / wave.framesPerBucket)
        const last = Math.min(
          wave.minima.length - 1,
          Math.floor(to / wave.framesPerBucket),
        )
        let low = 0
        let high = 0
        for (let bucket = first; bucket <= last; bucket++) {
          low = Math.min(low, wave.minima[bucket])
          high = Math.max(high, wave.maxima[bucket])
        }
        const gain = studioClipGainAtSourceFrame(clip, (from + to) / 2)
        context.moveTo(x + 0.5, mid - Math.min(1, high * gain) * (mid - 3))
        context.lineTo(x + 0.5, mid - Math.max(-1, low * gain) * (mid - 3))
      }
    }
    context.stroke()
    if (
      props.clip.fades.in !== undefined ||
      props.clip.fades.out !== undefined
    ) {
      context.globalAlpha = 0.65
      context.beginPath()
      for (let x = 0; x <= width; x += 2) {
        const source =
          props.sourceInFrame +
          (x / width) * (props.sourceOutFrame - props.sourceInFrame)
        const gain = studioClipGainAtSourceFrame({ ...clip, gainDb: 0 }, source)
        const y = 2 + (1 - gain) * (height - 4)
        if (x === 0) context.moveTo(x, y)
        else context.lineTo(x, y)
      }
      context.stroke()
    }
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
