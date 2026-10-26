// Studio output meter — continuous loudness windows, stereo sample peaks and explicit peak-hold reset.
import { Show } from 'solid-js'
import type { StudioMeterSnapshot } from '@/lib/studio/metering/stream-meter'
import styles from './StudioOutputMeter.module.css'

interface Props {
  snapshot: StudioMeterSnapshot | null
  ready: boolean
  compact?: boolean
  peakL?: number
  peakR?: number
  onReset(): void
}
const decibels = (amplitude: number) =>
  amplitude > 0 ? 20 * Math.log10(amplitude) : -Infinity
const reading = (value: number | null | undefined) =>
  value == null ? '—' : Number.isFinite(value) ? value.toFixed(1) : '−∞'
const percent = (amplitude: number) =>
  `${Math.max(0, Math.min(100, ((decibels(amplitude) + 60) / 60) * 100))}%`

export function StudioOutputMeter(props: Props) {
  const peakL = () => props.snapshot?.peakL ?? props.peakL ?? 0
  const peakR = () => props.snapshot?.peakR ?? props.peakR ?? 0
  const peak = () => Math.max(peakL(), peakR())
  const clipped = () =>
    props.snapshot?.clipL === true || props.snapshot?.clipR === true
  return (
    <div
      class={styles.output}
      classList={{ [styles.compact]: props.compact === true }}
    >
      <div
        class={styles.stereo}
        classList={{ [styles.clipped]: clipped() }}
        role="meter"
        aria-label="Output sample peak"
        aria-valuemin={-60}
        aria-valuemax={6}
        aria-valuenow={Math.max(-60, Math.min(6, decibels(peak())))}
        aria-valuetext={
          peak() > 0 ? `${reading(decibels(peak()))} dBFS` : 'Silent'
        }
      >
        <div class={styles.bars} aria-hidden="true">
          <div>
            <span>L</span>
            <div class={styles.rail}>
              <i style={{ width: percent(peakL()) }} />
              <b style={{ left: percent(props.snapshot?.holdL ?? 0) }} />
            </div>
          </div>
          <div>
            <span>R</span>
            <div class={styles.rail}>
              <i style={{ width: percent(peakR()) }} />
              <b style={{ left: percent(props.snapshot?.holdR ?? 0) }} />
            </div>
          </div>
        </div>
        <span class={styles.peakLabel}>
          {clipped() ? 'CLIP' : 'Peak'} {reading(decibels(peak()))}
        </span>
      </div>
      <dl class={styles.windows} aria-label="Live loudness">
        <div>
          <dt title="Momentary loudness, 400 milliseconds">
            M <span>LUFS</span>
          </dt>
          <dd>{props.ready ? reading(props.snapshot?.momentaryLufs) : '—'}</dd>
        </div>
        <div>
          <dt title="Short-term loudness, 3 seconds">
            S <span>LUFS</span>
          </dt>
          <dd>{props.ready ? reading(props.snapshot?.shortTermLufs) : '—'}</dd>
        </div>
      </dl>
      <Show when={props.compact !== true}>
        <div class={styles.detail}>
          <span>
            {props.ready
              ? 'Live loudness. Export measures the whole song.'
              : 'Live loudness is unavailable until playback starts.'}
          </span>
          <button
            type="button"
            onClick={() => props.onReset()}
            disabled={!props.ready}
          >
            Reset peak hold
          </button>
        </div>
      </Show>
    </div>
  )
}
