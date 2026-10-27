// Studio output meter — continuous loudness windows, stereo sample peaks and explicit peak-hold reset.
import { For, Show } from 'solid-js'
import type { StudioMeterSnapshot } from '@/lib/studio/metering/stream-meter'
import styles from './StudioOutputMeter.module.css'

interface Props {
  snapshot: StudioMeterSnapshot | null
  ready: boolean
  compact?: boolean
  /** Upright rails with the short-term loudness under them, for the mixing desk. */
  vertical?: boolean
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
// An upright meter is shorter: fewer marks, so their labels never touch.
const VERTICAL_SCALE = [-48, -24, -12, 0]
const markAt = (mark: number) => `${((mark + 60) / 60) * 100}%`

function Rail(props: { peak: number; hold: number; vertical: boolean }) {
  const unlit = () => 100 - level(props.peak)
  return (
    <div class={styles.rail}>
      <i
        style={{
          'clip-path': props.vertical
            ? `inset(${unlit()}% 0 0 0)`
            : `inset(0 ${unlit()}% 0 0)`,
        }}
      />
      <b
        style={
          props.vertical
            ? { bottom: percent(props.hold) }
            : { left: percent(props.hold) }
        }
      />
    </div>
  )
}

export function StudioOutputMeter(props: Props) {
  const vertical = () => props.vertical === true
  const peakL = () => props.snapshot?.peakL ?? props.peakL ?? 0
  const peakR = () => props.snapshot?.peakR ?? props.peakR ?? 0
  const peak = () => Math.max(peakL(), peakR())
  const clipped = () =>
    props.snapshot?.clipL === true || props.snapshot?.clipR === true
  const channels = () => [
    { name: 'L', peak: peakL(), hold: props.snapshot?.holdL ?? 0 },
    { name: 'R', peak: peakR(), hold: props.snapshot?.holdR ?? 0 },
  ]
  const full = () => props.compact !== true && !vertical()
  return (
    <div
      class={styles.output}
      classList={{
        [styles.compact]: props.compact === true,
        [styles.vertical]: vertical(),
      }}
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
                <Rail
                  peak={channel.peak}
                  hold={channel.hold}
                  vertical={vertical()}
                />
              </div>
            )}
          </For>
          <Show when={props.compact !== true}>
            <div class={styles.scale}>
              <For each={vertical() ? VERTICAL_SCALE : SCALE}>
                {(mark) => (
                  <span
                    style={
                      vertical()
                        ? { bottom: markAt(mark) }
                        : { left: markAt(mark) }
                    }
                  >
                    {mark < 0 ? `−${-mark}` : mark}
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
      <Show when={vertical()}>
        <p class={styles.loudness} title="Short-term loudness, 3 seconds">
          <span>Short-term</span>
          <strong>
            {props.ready ? reading(props.snapshot?.shortTermLufs) : '—'}
          </strong>
          <small>LUFS</small>
        </p>
      </Show>
      <Show when={full()}>
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
