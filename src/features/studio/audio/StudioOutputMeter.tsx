// Studio output meter — continuous loudness windows, stereo sample peaks and explicit peak-hold reset.
import { For, Show } from 'solid-js'
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
const level = (amplitude: number) =>
  Math.max(0, Math.min(100, ((decibels(amplitude) + 60) / 60) * 100))
const percent = (amplitude: number) => `${level(amplitude)}%`
// Scale marks in dBFS, placed on the same -60 to 0 travel as the bars.
const SCALE = [-48, -36, -24, -18, -12, -6, 0]

export function StudioOutputMeter(props: Props) {
  const peakL = () => props.snapshot?.peakL ?? props.peakL ?? 0
  const peakR = () => props.snapshot?.peakR ?? props.peakR ?? 0
  const peak = () => Math.max(peakL(), peakR())
  const clipped = () =>
    props.snapshot?.clipL === true || props.snapshot?.clipR === true
  const channels = () => [
    { name: 'L', peak: peakL(), hold: props.snapshot?.holdL ?? 0 },
    { name: 'R', peak: peakR(), hold: props.snapshot?.holdR ?? 0 },
  ]
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
        title="Output sample peak, left and right"
      >
        <div class={styles.bars} aria-hidden="true">
          <For each={channels()}>
            {(channel) => (
              <div class={styles.channel}>
                <span>{channel.name}</span>
                <div class={styles.rail}>
                  <i
                    style={{
                      'clip-path': `inset(0 ${100 - level(channel.peak)}% 0 0)`,
                    }}
                  />
                  <b style={{ left: percent(channel.hold) }} />
                </div>
              </div>
            )}
          </For>
          <Show when={props.compact !== true}>
            <div class={styles.scale}>
              <For each={SCALE}>
                {(mark) => (
                  <span style={{ left: `${((mark + 60) / 60) * 100}%` }}>
                    {mark < 0 ? `\u2212${-mark}` : mark}
                  </span>
                )}
              </For>
            </div>
          </Show>
        </div>
        <span class={styles.peakLabel}>
          <Show when={clipped()} fallback={<span>Peak</span>}>
            <strong>CLIP</strong>
          </Show>{' '}
          {reading(decibels(peak()))}
          <small>dB</small>
        </span>
      </div>
      <Show when={props.compact !== true}>
        <dl class={styles.windows} aria-label="Live loudness">
          <div>
            <dt title="Momentary loudness, 400 milliseconds">
              Momentary <span>LUFS</span>
            </dt>
            <dd>
              {props.ready ? reading(props.snapshot?.momentaryLufs) : '—'}
            </dd>
          </div>
          <div>
            <dt title="Short-term loudness, 3 seconds">
              Short-term <span>LUFS</span>
            </dt>
            <dd>
              {props.ready ? reading(props.snapshot?.shortTermLufs) : '—'}
            </dd>
          </div>
        </dl>
        <div class={styles.detail}>
          <Show
            when={props.ready}
            fallback={<span>Press play to see live loudness.</span>}
          >
            <button type="button" onClick={() => props.onReset()}>
              Reset peak hold
            </button>
          </Show>
        </div>
      </Show>
    </div>
  )
}
