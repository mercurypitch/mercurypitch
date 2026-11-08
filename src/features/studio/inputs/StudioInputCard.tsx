// Studio input card — one audio input in the Inputs view: what it is, its channels, its round trip and what to know about it, the lanes on it, and a row per input and aligned pair with a live meter while it is open.
import { Index, Show } from 'solid-js'
import { AlertTriangle } from '@/components/icons'
import { INPUT_KIND_ICON } from '@/components/input-kind-icon'
import { MicLatencyWizard } from '@/features/mic-feedback/MicLatencyWizard'
import type { ChannelMeterReading } from '@/lib/audio-input/channel-meters'
import common from '../StudioPage.module.css'
import type { StudioInputDevice, StudioInputRow } from './inputs-view-model'
import { STUDIO_METER_WORDS, studioLatencyWords } from './inputs-view-model'
import styles from './StudioInputs.module.css'
import type { StudioInputsState } from './useStudioInputs'

/** A peak as the bar's share: -60 dB to full scale. */
function meterShare(peak: number): number {
  if (peak <= 0) return 0
  return Math.max(0, Math.min(1, (20 * Math.log10(peak) + 60) / 60))
}

function StudioInputMeter(props: { reading: ChannelMeterReading | null }) {
  const health = () => props.reading?.health ?? ''
  return (
    <>
      <span
        class={styles.meter}
        data-studio-input-meter=""
        data-peak={props.reading?.peak.toFixed(3) ?? ''}
        data-health={health()}
        aria-hidden="true"
      >
        <span
          class={styles.meterFill}
          style={{
            width: `${(meterShare(props.reading?.peak ?? 0) * 100).toFixed(1)}%`,
          }}
        />
      </span>
      <span class={styles.health} data-health={health()}>
        {props.reading === null
          ? ''
          : (STUDIO_METER_WORDS[props.reading.health] ?? '')}
      </span>
    </>
  )
}

export function StudioInputCard(props: {
  device: StudioInputDevice
  inputs: StudioInputsState
}) {
  const device = () => props.device
  const metered = () => props.inputs.metered()
  const here = () => metered()?.deviceId === device().deviceId
  // Open, and the browser does not say how many channels: one row, all of it.
  const whole = () => here() && metered()?.channels === null
  const rows = (): readonly StudioInputRow[] =>
    whole()
      ? [{ pick: null, label: 'Whole input', lanes: device().lanes }]
      : device().rows
  const opening = () => props.inputs.check.opening() === device().deviceId
  const heading = () => `studio-input-${device().deviceId}`
  return (
    <article
      class={styles.card}
      data-studio-input-device={device().deviceId}
      aria-labelledby={heading()}
    >
      <div class={styles.cardHead}>
        <span class={styles.kindIcon} aria-hidden="true">
          {/* Keyed rather than Dynamic, whose spread runtime would join
              every page's first paint; the card's input changes when the
              list does. */}
          <Show when={INPUT_KIND_ICON[device().kind]} keyed>
            {(Icon) => <Icon />}
          </Show>
        </span>
        <h4 id={heading()}>{device().name}</h4>
        <Show when={device().kindLabel !== ''}>
          <span class={styles.tag}>{device().kindLabel}</span>
        </Show>
        <Show when={device().isDefault}>
          <span class={styles.tag}>System default</span>
        </Show>
      </div>
      <dl class={styles.facts}>
        <dt>Channels</dt>
        <dd data-studio-input-channels="">
          {device().channels ??
            (whole()
              ? 'Not reported by this browser'
              : 'Not known until it is opened')}
        </dd>
        <dt>Latency</dt>
        <dd>{studioLatencyWords(device().latencyMs)}</dd>
        <dt>Lanes</dt>
        <dd>
          {device().lanes.length > 0 ? device().lanes.join(', ') : 'None'}
        </dd>
      </dl>
      <Show when={device().warning}>
        {(warning) => (
          <p class={styles.warning}>
            <AlertTriangle />
            {warning()}
          </p>
        )}
      </Show>
      <div class={styles.actions}>
        <Show
          when={here()}
          fallback={
            <>
              <span class={styles.state}>
                {opening() ? 'Opening…' : 'Not open'}
              </span>
              <button
                type="button"
                class={common.button}
                disabled={!props.inputs.check.canCheck() || opening()}
                title={
                  props.inputs.armed()
                    ? 'Disarm the lane to check another input'
                    : undefined
                }
                onClick={() =>
                  void props.inputs.check.check(
                    device().deviceId,
                    device().openId,
                  )
                }
              >
                Check
              </button>
            </>
          }
        >
          <span class={styles.state}>
            {metered()?.armed === true ? 'Armed lane records from it' : 'Open'}
          </span>
          <Show when={metered()?.armed === false}>
            <button
              type="button"
              class={common.button}
              onClick={() => props.inputs.check.release()}
            >
              Stop checking
            </button>
          </Show>
        </Show>
        <button
          type="button"
          class={common.button}
          disabled={props.inputs.armed()}
          title={
            props.inputs.armed()
              ? 'Disarm the lane to measure its latency'
              : undefined
          }
          aria-expanded={props.inputs.measuring() === device().deviceId}
          onClick={() =>
            props.inputs.measure(
              props.inputs.measuring() === device().deviceId ? null : device(),
            )
          }
        >
          {device().latencyMs === null ? 'Measure latency' : 'Measure again'}
        </button>
      </div>
      <Show when={props.inputs.measuring() === device().deviceId}>
        <MicLatencyWizard
          deviceId={device().openId}
          onClose={() => props.inputs.measure(null)}
        />
      </Show>
      <Show when={rows().length > 0}>
        <Show when={!whole()}>
          <p class={styles.signal}>{props.inputs.signalOn(device()) ?? ''}</p>
        </Show>
        <ul class={styles.rows}>
          <Index each={rows()}>
            {(row) => (
              <li class={styles.row} data-studio-input-row={row().label}>
                <span class={styles.rowLabel}>{row().label}</span>
                <StudioInputMeter
                  reading={props.inputs.readingOf(device(), row())}
                />
                <Show when={row().lanes.length > 0}>
                  <span class={styles.rowLanes}>{row().lanes.join(', ')}</span>
                </Show>
              </li>
            )}
          </Index>
        </ul>
      </Show>
    </article>
  )
}
