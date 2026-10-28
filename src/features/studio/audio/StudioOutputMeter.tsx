// Studio output meter — continuous loudness windows, stereo sample peaks and explicit peak-hold reset.
//
// It redraws on every meter tick, so a tick changes only styles and the
// text of the readings: the rails and their labels stay the same elements,
// and the held peak is a band clipped out of its rail, so a tick lays
// nothing out again.
import { For, Index, Show } from 'solid-js'
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
// Scale marks in dBFS, placed on the same -60 to 0 travel as the bars.
const SCALE = [-48, -36, -24, -18, -12, -6, 0]
// An upright meter is shorter: fewer marks, so their labels never touch.
const VERTICAL_SCALE = [-48, -24, -12, 0]
const markAt = (mark: number) => `${((mark + 60) / 60) * 100}%`

function Rail(props: { peak: number; hold: number; vertical: boolean }) {
  const unlit = () => 100 - level(props.peak)
  // The held peak is a 2 px band, just under the level it holds, clipped out
  // of a mark as large as the rail: it moves without a layout, and its box
  // never leaves the rail. A hold at the floor sits just out of sight.
  const hold = () => level(props.hold)
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
        style={{
          'clip-path': props.vertical
            ? `inset(${100 - hold()}% 0 calc(${hold()}% - 2px) 0)`
            : `inset(0 ${100 - hold()}% 0 calc(${hold()}% - 2px))`,
        }}
      />
    </div>
  )
}

/** "Peak" or "CLIP", then the reading: elements kept, so a tick only changes the text. */
function PeakReading(props: { clipped: boolean; value: string }) {
  return (
    <>
      <Show when={props.clipped} fallback={<span>Peak</span>}>
        <strong>CLIP</strong>
      </Show>{' '}
      <data class={styles.reading}>{props.value}</data>
      <small>dB</small>
    </>
  )
}

export function StudioOutputMeter(props: Props) {
  const vertical = () => props.vertical === true
  const peakL = () => props.snapshot?.peakL ?? props.peakL ?? 0
  const peakR = () => props.snapshot?.peakR ?? props.peakR ?? 0
  const peak = () => Math.max(peakL(), peakR())
  const clipped = () =>
    props.snapshot?.clipL === true || props.snapshot?.clipR === true
  // By position, not identity: a tick brings new readings, never new rails.
  const channels = () => [
    { name: 'L', peak: peakL(), hold: props.snapshot?.holdL ?? 0 },
    { name: 'R', peak: peakR(), hold: props.snapshot?.holdR ?? 0 },
  ]
  const full = () => props.compact !== true && !vertical()
  const peakText = () => reading(decibels(peak()))
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
          <Index each={channels()}>
            {(channel) => (
              <div class={styles.channel}>
                <span>{channel().name}</span>
                <Rail
                  peak={channel().peak}
                  hold={channel().hold}
                  vertical={vertical()}
                />
              </div>
            )}
          </Index>
          <Show when={props.compact !== true}>
            <div class={styles.scale}>
              <For each={vertical() ? VERTICAL_SCALE : SCALE}>
                {(mark) => (
                  <span
                    data-db={mark}
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
        <Show when={!vertical()}>
          <span class={styles.peakLabel}>
            <PeakReading clipped={clipped()} value={peakText()} />
          </span>
        </Show>
      </div>
      <Show when={vertical()}>
        {/* Upright, the reading is also the reset: a meter's parts cannot be buttons. */}
        <button
          type="button"
          class={styles.peakLabel}
          classList={{ [styles.clipped]: clipped() }}
          title="Reset peak hold"
          onClick={() => props.onReset()}
        >
          <PeakReading clipped={clipped()} value={peakText()} />
        </button>
        <p class={styles.loudness} title="Short-term loudness, 3 seconds">
          <span>Short-term</span>
          <strong>
            <data class={styles.reading}>
              {props.ready ? reading(props.snapshot?.shortTermLufs) : '—'}
            </data>
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
