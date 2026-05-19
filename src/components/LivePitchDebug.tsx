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
  whisperGain?: () => number
  setWhisperGain?: (val: number) => void
  whisperIntervalSec?: () => number
  setWhisperIntervalSec?: (val: number) => void
  whisperStatus?: () => string
  whisperBufferSecs?: () => number
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

        <Show when={props.whisperGain !== undefined}>
          <h4
            class={`${styles.heading} ${styles.fullWidth}`}
            style={{ 'margin-top': '8px', 'margin-bottom': '2px' }}
          >
            Whisper Config
          </h4>
          <div class={styles.row}>
            <span class={styles.label}>
              Gain ({props.whisperGain?.().toFixed(1)}x)
            </span>
            <input
              type="range"
              min="0.5"
              max="10"
              step="0.5"
              value={props.whisperGain?.()}
              onInput={(e) =>
                props.setWhisperGain?.(parseFloat(e.currentTarget.value))
              }
              style={{ width: '80px' }}
            />
          </div>
          <div class={styles.row}>
            <span class={styles.label}>
              Interval ({props.whisperIntervalSec?.()}s)
            </span>
            <input
              type="range"
              min="2"
              max="15"
              step="1"
              value={props.whisperIntervalSec?.()}
              onInput={(e) =>
                props.setWhisperIntervalSec?.(
                  parseInt(e.currentTarget.value, 10),
                )
              }
              style={{ width: '80px' }}
            />
          </div>
          <div class={styles.row}>
            <span class={styles.label}>Status</span>
            <span class={styles.value}>{props.whisperStatus?.()}</span>
          </div>
          <div class={styles.row}>
            <span class={styles.label}>Buffer Length</span>
            <span class={styles.value}>
              {props.whisperBufferSecs?.().toFixed(1)} s
            </span>
          </div>
        </Show>
      </div>
    </div>
  )
}
