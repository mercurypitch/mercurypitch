// ============================================================
// LivePitchDebug — Real-time pitch stats during singing
//
// Shows current note, frequency, clarity, cents, MIDI, elapsed
// and frame count. Updates reactively as the user sings.
// ============================================================

import { Show } from 'solid-js'
import type { DetectedPitch } from '@/lib/pitch-detector'
import styles from './LivePitchDebug.module.css'

interface LivePitchDebugProps {
  latestFrame: () => DetectedPitch | null
  elapsed: () => number
  frameCount: () => number
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function formatCents(cents: number): string {
  const sign = cents >= 0 ? '+' : ''
  return `${sign}${cents.toFixed(0)}`
}

export function LivePitchDebug(props: LivePitchDebugProps) {
  const frame = () => props.latestFrame()
  const hasPitch = () => frame() !== null

  return (
    <div class={styles.panel} data-testid="live-pitch-debug">
      <h4 class={styles.heading}>Live Pitch Debug</h4>
      <div class={styles.grid}>
        <div class={styles.row}>
          <span class={styles.label}>Note</span>
          <span class={styles.value}>
            <Show when={hasPitch()} fallback="--">
              {frame()!.noteName || '?'}
              {frame()!.octave}
            </Show>
          </span>
        </div>
        <div class={styles.row}>
          <span class={styles.label}>Frequency</span>
          <span class={styles.value}>
            <Show when={hasPitch()} fallback="--">
              {frame()!.frequency.toFixed(1)} Hz
            </Show>
          </span>
        </div>
        <div class={styles.row}>
          <span class={styles.label}>Clarity</span>
          <span class={styles.value}>
            <Show when={hasPitch()} fallback="--">
              {frame()!.clarity.toFixed(3)}
            </Show>
          </span>
        </div>
        <div class={styles.row}>
          <span class={styles.label}>Cents</span>
          <span class={styles.value}>
            <Show when={hasPitch()} fallback="--">
              {formatCents(frame()!.cents)}
            </Show>
          </span>
        </div>
        <div class={styles.row}>
          <span class={styles.label}>MIDI</span>
          <span class={styles.value}>
            <Show when={hasPitch()} fallback="--">
              {frame()!.midi}
            </Show>
          </span>
        </div>
        <div class={styles.row}>
          <span class={styles.label}>Elapsed</span>
          <span class={styles.value}>{formatTime(props.elapsed())}</span>
        </div>
        <div class={styles.row}>
          <span class={styles.label}>Frames</span>
          <span class={styles.value}>
            {props.frameCount().toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  )
}
