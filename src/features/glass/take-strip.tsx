// ============================================================
// Glass — the takes strip (reviewable recorded reps).
//
// One card per recorded rep: the singer's own voice as a glowing
// procedural waveform (brand gradient over a faint cosmic
// backdrop), tap to play/pause through the FX rack, a shatter
// badge on the winning take, and a remove control. Desktop: a
// column beneath the FX rail. Phones: a swipeable horizontal
// strip so the pane stays big.
//
// Privacy contract unchanged: takes are session-only, in-memory —
// removal drops the audio immediately, and leaving the page drops
// everything. Metrics/deltas never depend on the audio.
// ============================================================

import type { Component } from 'solid-js'
import { createEffect, For, onCleanup, Show } from 'solid-js'
import { IconShatter } from './icons'

export interface GlassTake {
  id: number
  rep: number
  blob: Blob
  /** Seconds of audio (0 while decode is pending/failed). */
  durationSec: number
  /** Peak buckets for the waveform (null: decode pending/failed). */
  peaks: Float32Array | null
  /** This take broke the glass. */
  shattered: boolean
}

const PEAK_BUCKETS = 72

/** Max-|sample| buckets over the first channel — the waveform's bars. */
export function computePeaks(
  buffer: AudioBuffer,
  buckets: number = PEAK_BUCKETS,
): Float32Array {
  const data = buffer.getChannelData(0)
  const peaks = new Float32Array(buckets)
  const per = Math.max(1, Math.floor(data.length / buckets))
  let max = 0
  for (let b = 0; b < buckets; b++) {
    let peak = 0
    const start = b * per
    const end = Math.min(data.length, start + per)
    for (let i = start; i < end; i++) {
      const v = Math.abs(data[i])
      if (v > peak) peak = v
    }
    peaks[b] = peak
    if (peak > max) max = peak
  }
  // Normalize so a quiet take still reads as a waveform, not a flatline.
  if (max > 0.001) {
    for (let b = 0; b < buckets; b++) peaks[b] = peaks[b] / max
  }
  return peaks
}

const IconPlay: Component = () => (
  <svg
    width={16}
    height={16}
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
  >
    <path d="M8 5.5v13l10-6.5z" />
  </svg>
)

const IconPause: Component = () => (
  <svg
    width={16}
    height={16}
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
  >
    <rect x="7" y="5.5" width="3.4" height="13" rx="1" />
    <rect x="13.6" y="5.5" width="3.4" height="13" rx="1" />
  </svg>
)

const IconRemove: Component = () => (
  <svg
    width={12}
    height={12}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2.4"
    stroke-linecap="round"
    aria-hidden="true"
  >
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
)

/** The card's waveform: gradient glow bars + played-portion sweep. */
const TakeWave: Component<{
  peaks: Float32Array | null
  /** 0..1 played fraction (0 when not playing). */
  progress: number
  playing: boolean
}> = (props) => {
  let canvas: HTMLCanvasElement | undefined

  const draw = (): void => {
    if (!canvas) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const rect = canvas.getBoundingClientRect()
    if (rect.width === 0) return
    if (canvas.width !== Math.round(rect.width * dpr)) {
      canvas.width = Math.round(rect.width * dpr)
      canvas.height = Math.round(rect.height * dpr)
    }
    const c = canvas.getContext('2d')
    if (!c) return
    c.setTransform(dpr, 0, 0, dpr, 0, 0)
    const W = rect.width
    const H = rect.height
    c.clearRect(0, 0, W, H)

    const peaks = props.peaks
    const mid = H / 2
    const n = peaks?.length ?? PEAK_BUCKETS
    const step = W / n
    const barW = Math.max(1.5, step * 0.55)
    const playedX = props.progress * W

    for (let i = 0; i < n; i++) {
      // Decode pending: a quiet idle shimmer instead of silence.
      const p = peaks?.[i] ?? 0.12 + 0.06 * Math.sin(i * 0.9)
      const h = Math.max(2, p * (H * 0.86))
      const x = i * step + (step - barW) / 2
      const played = x + barW / 2 <= playedX
      // Brand gradient (aqua → violet) by position; played bars go gold.
      const hue = played ? null : i / n
      c.fillStyle = played
        ? 'rgba(255, 233, 168, 0.95)'
        : `rgba(${Math.round(88 + 100 * hue!)}, ${Math.round(
            166 - 26 * hue!,
          )}, 255, 0.9)`
      c.shadowColor = c.fillStyle
      c.shadowBlur = props.playing ? 6 : 3
      const rTop = mid - h / 2
      c.beginPath()
      c.roundRect(x, rTop, barW, h, barW / 2)
      c.fill()
    }
    c.shadowBlur = 0

    if (props.playing) {
      c.strokeStyle = 'rgba(255, 233, 168, 0.9)'
      c.lineWidth = 1.4
      c.shadowColor = '#ffe9a8'
      c.shadowBlur = 8
      c.beginPath()
      c.moveTo(playedX, 2)
      c.lineTo(playedX, H - 2)
      c.stroke()
      c.shadowBlur = 0
    }
  }

  createEffect(() => {
    // Reactive deps: peaks arrival, playhead motion, play state.
    void props.peaks
    void props.progress
    void props.playing
    requestAnimationFrame(draw)
  })

  const observer =
    typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => draw())
      : null
  onCleanup(() => observer?.disconnect())

  return (
    <canvas
      class="glass-take-wave"
      ref={(el) => {
        canvas = el
        observer?.observe(el)
      }}
    />
  )
}

export const TakeStrip: Component<{
  takes: GlassTake[]
  playingId: number | null
  /** 0..1 playhead of the playing take. */
  progress: number
  /** True while a rep is actively recording — playback would collide. */
  disabled: boolean
  onToggle: (id: number) => void
  onRemove: (id: number) => void
}> = (props) => (
  <Show when={props.takes.length > 0}>
    <div class="glass-takes" role="list" aria-label="Your recorded takes">
      <For each={props.takes}>
        {(take) => {
          const playing = (): boolean => props.playingId === take.id
          return (
            <div
              class="glass-take-card"
              classList={{ playing: playing(), shattered: take.shattered }}
              role="listitem"
            >
              <button
                class="glass-take-main"
                disabled={props.disabled}
                onClick={() => props.onToggle(take.id)}
                aria-label={`${playing() ? 'Pause' : 'Play'} take ${take.rep}`}
              >
                <span class="glass-take-btn">
                  <Show when={playing()} fallback={<IconPlay />}>
                    <IconPause />
                  </Show>
                </span>
                <span class="glass-take-body">
                  <span class="glass-take-head">
                    <span class="glass-take-label">Take {take.rep}</span>
                    <Show when={take.shattered}>
                      <span class="glass-take-badge">
                        <IconShatter size={11} /> Shattered
                      </span>
                    </Show>
                    <Show when={!take.shattered && take.durationSec > 0}>
                      <span class="glass-take-time">
                        {take.durationSec.toFixed(1)}s
                      </span>
                    </Show>
                  </span>
                  <TakeWave
                    peaks={take.peaks}
                    progress={playing() ? props.progress : 0}
                    playing={playing()}
                  />
                </span>
              </button>
              <button
                class="glass-take-remove"
                onClick={() => props.onRemove(take.id)}
                aria-label={`Remove take ${take.rep}`}
                title="Remove this take (your numbers stay)"
              >
                <IconRemove />
              </button>
            </div>
          )
        }}
      </For>
    </div>
  </Show>
)
