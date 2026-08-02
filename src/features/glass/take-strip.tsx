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
// Privacy contract: takes begin session-only and in-memory. A singer
// can explicitly keep one in the local voice vault; otherwise removal
// drops it immediately and leaving the page drops it. Metrics/deltas
// never depend on the persisted audio.
// ============================================================

import type { Component } from 'solid-js'
import { For, Show } from 'solid-js'
import { VoiceTakeWaveform } from '@/components/VoiceTakeWaveform'
import { computeVoicePeaks } from '@/lib/voice-capture'
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
  /** Derived numbers saved beside an explicitly kept take. */
  metrics: {
    meanAbsCents: number | null
    bestLockSec: number
    inBandPct: number
    peakResonance: number
  }
  saveState: 'idle' | 'saving' | 'saved' | 'error'
}

export const computePeaks = computeVoicePeaks

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

export const TakeStrip: Component<{
  takes: GlassTake[]
  playingId: number | null
  /** 0..1 playhead of the playing take. */
  progress: number
  /** True while a rep is actively recording — playback would collide. */
  disabled: boolean
  onToggle: (id: number) => void
  onKeep: (id: number) => void
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
                  <VoiceTakeWaveform
                    class="glass-take-wave"
                    peaks={take.peaks}
                    progress={playing() ? props.progress : 0}
                    playing={playing()}
                  />
                </span>
              </button>
              <button
                class="glass-take-keep"
                classList={{ saved: take.saveState === 'saved' }}
                disabled={
                  props.disabled ||
                  take.saveState === 'saving' ||
                  take.saveState === 'saved'
                }
                onClick={() => props.onKeep(take.id)}
                aria-label={`${
                  take.saveState === 'saved'
                    ? 'Kept'
                    : take.saveState === 'error'
                      ? 'Retry keeping'
                      : 'Keep'
                } take ${take.rep} in voice history`}
              >
                {take.saveState === 'saving'
                  ? 'Saving'
                  : take.saveState === 'saved'
                    ? 'Kept'
                    : take.saveState === 'error'
                      ? 'Retry keep'
                      : 'Keep'}
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
