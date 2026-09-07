// Guitar Night amp controls expose one compact faceplate and defer detailed tone shaping.
// ============================================================

import type { Accessor } from 'solid-js'
import { createEffect, createSignal, createUniqueId, For, onCleanup, Show, untrack, } from 'solid-js'
import { Headphones, HeadphonesOff, PowerSymbol, RotateCcw, Zap, } from '@/components/icons'
import type { AudioRouteDiagnosticsSnapshot } from '@/lib/audio-route-diagnostics'
import { getGuitarAmpCabinetStatus, retryGuitarAmpCabinet, subscribeGuitarAmpCabinetStatus, } from '@/lib/guitar/guitar-amp-cabinet'
import type { GuitarElectricAmpCabinet, GuitarElectricAmpParameters, } from '@/lib/guitar/guitar-electric-amp'
import type { GuitarInputProfileKind } from '@/lib/guitar/guitar-input-profile'
import type { GuitarNightAmpPresetId } from './guitar-amp-settings'
import { GUITAR_NIGHT_AMP_PRESETS } from './guitar-amp-settings'
import ampStyles from './GuitarNightAmpControls.module.css'
import styles from './GuitarNightApp.module.css'
import { GuitarNightMonitorLatency } from './GuitarNightMonitorLatency'
import type { GuitarListeningStatus } from './useGuitarListeningController'
import type { GuitarNightAmpContinuousParameter } from './useGuitarNightAmpSettings'

interface GuitarNightAmpControlsProps {
  /** Name the actual processing target; recorded stems do not use the amp. */
  targetLabel?: string
  takeNotice?: string
  parameters: Accessor<GuitarElectricAmpParameters>
  presetId: Accessor<GuitarNightAmpPresetId>
  inputProfile: Accessor<GuitarInputProfileKind>
  canMonitor: Accessor<boolean>
  monitoringEnabled: Accessor<boolean>
  monitoringActive: Accessor<boolean>
  monitorDiagnostics?: Accessor<AudioRouteDiagnosticsSnapshot | null>
  listeningStatus?: Accessor<GuitarListeningStatus>
  /** Host-owned startup retains song/score pause and cancellation policy. */
  onStartListening?(): Promise<boolean>
  monitorInputChannel?: Accessor<number>
  monitorInputChannelCount?: Accessor<number>
  onMonitorInputChannel?(channel: number): void
  onEnabled(enabled: boolean): void
  onPreset(presetId: GuitarNightAmpPresetId): void
  onParameter(
    parameter: GuitarNightAmpContinuousParameter,
    value: number,
    persist?: boolean,
  ): void
  onParameterCommit(): void
  onCabinet(cabinet: GuitarElectricAmpCabinet): void
  onMonitor(enabled: boolean): void
  onReset(): void
}

const CABINETS: readonly {
  id: GuitarElectricAmpCabinet
  label: string
}[] = [
  { id: 'open', label: 'Open' },
  { id: 'balanced', label: 'Balanced' },
  { id: 'dark', label: 'Dark' },
]

const TONE_CONTROLS: readonly {
  key: Exclude<GuitarNightAmpContinuousParameter, 'character'>
  label: string
  minimum: number
  maximum: number
  signed: boolean
}[] = [
  { key: 'bass', label: 'Bass', minimum: -1, maximum: 1, signed: true },
  { key: 'mid', label: 'Mid', minimum: -1, maximum: 1, signed: true },
  {
    key: 'treble',
    label: 'Treble',
    minimum: -1,
    maximum: 1,
    signed: true,
  },
  {
    key: 'presence',
    label: 'Presence',
    minimum: -1,
    maximum: 1,
    signed: true,
  },
  {
    key: 'output',
    label: 'Output',
    minimum: 0,
    maximum: 1,
    signed: false,
  },
]

function percentage(value: number, signed = false): string {
  const rounded = Math.round(value * 100)
  return `${signed && rounded > 0 ? '+' : ''}${rounded}%`
}

/** A restrained room control: preset and drive first, voicing on demand. */
export function GuitarNightAmpControls(props: GuitarNightAmpControlsProps) {
  const [cabinetStatus, setCabinetStatus] = createSignal(
    getGuitarAmpCabinetStatus(),
  )
  const [monitorPending, setMonitorPending] = createSignal(false)
  const [monitorRequestFailed, setMonitorRequestFailed] = createSignal(false)
  let monitorRequest = 0
  let priorProfile = untrack(() => props.inputProfile())
  createEffect(() => {
    const profile = props.inputProfile()
    if (profile === priorProfile) return
    priorProfile = profile
    monitorRequest += 1
    setMonitorPending(false)
    setMonitorRequestFailed(false)
  })
  onCleanup(() => {
    monitorRequest += 1
  })
  const monitorHintId = createUniqueId()
  const characterHintId = createUniqueId()
  const isStudio = (): boolean => props.parameters().engine === 'studio'
  const isDefinition = (): boolean =>
    isStudio() && (props.parameters().head ?? 'definition') === 'definition'
  const modelLabel = (): string =>
    isStudio()
      ? props.parameters().head === 'heavy'
        ? 'Studio · Heavy head'
        : props.parameters().head === 'lead'
          ? 'Studio · Lead head'
          : 'Studio · Definition head'
      : 'Lite amp · Filtered cabinet'
  const formatOutput = (value: number): string => {
    const decibels = isStudio() ? (value - 0.6) * 20 : -12 + value * 15
    return `${Math.round(decibels * 10) / 10} dB`
  }
  const formatCharacter = (value: number): string => {
    if (value === 0) return 'Articulate'
    if (value === 1) return 'Tight'
    return `${Math.round(value * 100)}% toward Tight`
  }
  const cabinetHint = (): string => {
    switch (cabinetStatus()) {
      case 'loading':
        return 'Loading cabinet. Lite tone is used until it is ready.'
      case 'ready':
        return 'Cabinet IR ready.'
      case 'error':
        return 'Studio tone unavailable. Using Lite tone; try loading it again.'
      default:
        return 'Cabinet loads when you play an electric part or monitor Direct input.'
    }
  }
  onCleanup(subscribeGuitarAmpCabinetStatus(setCabinetStatus))

  const canStartMonitor = (): boolean =>
    props.inputProfile() === 'interface' &&
    props.onStartListening !== undefined &&
    (props.listeningStatus?.() === 'off' ||
      props.listeningStatus?.() === 'error')
  const requestMonitor = async (): Promise<void> => {
    if (props.monitoringEnabled()) {
      props.onMonitor(false)
      return
    }
    if (monitorPending()) return
    if (props.canMonitor()) {
      props.onMonitor(true)
      return
    }
    if (!canStartMonitor()) return
    const operation = ++monitorRequest
    setMonitorPending(true)
    setMonitorRequestFailed(false)
    try {
      const started = await props.onStartListening?.()
      if (operation !== monitorRequest) return
      if (
        started === true &&
        props.inputProfile() === 'interface' &&
        props.canMonitor()
      )
        props.onMonitor(true)
    } catch {
      if (operation === monitorRequest) setMonitorRequestFailed(true)
    } finally {
      if (operation === monitorRequest) setMonitorPending(false)
    }
  }
  const monitorAction = (): string =>
    props.monitoringEnabled()
      ? 'Turn monitoring off'
      : monitorPending()
        ? 'Opening input for monitoring'
        : canStartMonitor()
          ? 'Start Listening and monitoring'
          : 'Turn monitoring on'

  const monitorHint = (): string => {
    if (monitorRequestFailed())
      return 'Input could not open. Check Listening above and try again.'
    if (props.monitoringActive()) {
      return `Your guitar plays through the amp. Browser latency applies. ${props.takeNotice ?? 'Saved takes stay dry.'}`
    }
    if (props.inputProfile() !== 'interface') {
      return 'Choose Direct input to hear your guitar through this amp.'
    }
    if (!props.canMonitor()) {
      return canStartMonitor()
        ? 'This starts Direct-input Listening and your live sound through the amp.'
        : 'Start Listening above to enable your live sound through the amp.'
    }
    return `Browser latency applies. ${props.takeNotice ?? 'Saved takes stay dry.'}`
  }

  return (
    <section
      class={`${styles.ampControls} ${ampStyles.controls}`}
      aria-label="Guitar amp"
    >
      <div class={styles.ampFaceplate}>
        <div class={styles.ampIdentity}>
          <span aria-hidden="true">
            <Zap />
          </span>
          <span>
            <strong>Amp</strong>
            <small>{props.targetLabel ?? 'Shared electric tone'}</small>
          </span>
        </div>
        <button
          type="button"
          class={styles.ampPower}
          classList={{ [styles.ampPowerActive]: props.parameters().enabled }}
          aria-pressed={props.parameters().enabled}
          aria-label={
            props.parameters().enabled
              ? 'Bypass guitar amp'
              : 'Turn guitar amp on'
          }
          onClick={() => props.onEnabled(!props.parameters().enabled)}
        >
          <span aria-hidden="true">
            <PowerSymbol />
          </span>
          {props.parameters().enabled ? 'On' : 'Bypass'}
        </button>
      </div>

      <p class={ampStyles.model}>{modelLabel()}</p>

      <div class={ampStyles.primaryControls}>
        <label class={styles.ampPreset}>
          <span>Preset</span>
          <select
            aria-label="Guitar amp preset"
            value={props.presetId()}
            onChange={(event) =>
              props.onPreset(
                event.currentTarget.value as GuitarNightAmpPresetId,
              )
            }
          >
            <For each={GUITAR_NIGHT_AMP_PRESETS}>
              {(preset) => <option value={preset.id}>{preset.label}</option>}
            </For>
            <option value="custom" disabled={props.presetId() !== 'custom'}>
              Custom
            </option>
          </select>
        </label>

        <AmpRange
          label="Drive"
          value={() => props.parameters().drive}
          minimum={0}
          maximum={1}
          onInput={(value) => props.onParameter('drive', value, false)}
          onChange={props.onParameterCommit}
        />
      </div>

      <Show when={isDefinition()}>
        <div class={ampStyles.character}>
          <AmpRange
            label="Character"
            value={() => props.parameters().character ?? 1}
            minimum={0}
            maximum={1}
            format={formatCharacter}
            displayFormat={(value) => `${Math.round(value * 100)}%`}
            describedBy={characterHintId}
            onInput={(value) => props.onParameter('character', value, false)}
            onChange={props.onParameterCommit}
          />
          <div class={ampStyles.characterEndpoints} aria-hidden="true">
            <span>Articulate</span>
            <span>Tight</span>
          </div>
          <small id={characterHintId}>
            One head, from open attack to focused drive. The cabinet stays the
            same.
          </small>
        </div>
      </Show>

      <Show when={isStudio()}>
        <div class={ampStyles.cabinetStatus}>
          <span class={ampStyles.cabinetName}>
            Cabinet IR · Jester Cookie Monster
          </span>
          <small role="status">{cabinetHint()}</small>
          <Show when={cabinetStatus() === 'error'}>
            <button
              type="button"
              class={ampStyles.retry}
              onClick={() => retryGuitarAmpCabinet()}
            >
              Retry Studio tone
            </button>
          </Show>
        </div>
      </Show>

      <details class={styles.ampDetails}>
        <summary>Shape tone &amp; cabinet</summary>
        <div class={ampStyles.toneGrid}>
          <For each={TONE_CONTROLS}>
            {(control) => (
              <AmpRange
                label={control.label}
                value={() => props.parameters()[control.key]}
                minimum={control.minimum}
                maximum={control.maximum}
                signed={control.signed}
                format={control.key === 'output' ? formatOutput : undefined}
                onInput={(value) =>
                  props.onParameter(control.key, value, false)
                }
                onChange={props.onParameterCommit}
              />
            )}
          </For>
          <Show when={!isStudio()}>
            <label class={styles.ampCabinet}>
              <span>Cabinet</span>
              <select
                aria-label="Guitar cabinet voicing"
                value={props.parameters().cabinet}
                onChange={(event) =>
                  props.onCabinet(
                    event.currentTarget.value as GuitarElectricAmpCabinet,
                  )
                }
              >
                <For each={CABINETS}>
                  {(cabinet) => (
                    <option value={cabinet.id}>{cabinet.label}</option>
                  )}
                </For>
              </select>
            </label>
          </Show>
        </div>
        <button
          type="button"
          class={styles.ampReset}
          onClick={() => props.onReset()}
        >
          <span aria-hidden="true">
            <RotateCcw />
          </span>
          Reset amp
        </button>
      </details>

      <Show
        when={
          props.inputProfile() === 'interface' &&
          (props.monitorInputChannelCount?.() ?? 0) > 0
        }
      >
        <label class={ampStyles.monitorChannel}>
          <span>Monitor input</span>
          <select
            aria-label="Monitor input channel"
            value={props.monitorInputChannel?.() ?? 0}
            disabled={
              monitorPending() || (props.monitorInputChannelCount?.() ?? 0) <= 1
            }
            onChange={(event) =>
              props.onMonitorInputChannel?.(Number(event.currentTarget.value))
            }
          >
            <For
              each={Array.from(
                { length: props.monitorInputChannelCount?.() ?? 0 },
                (_, channel) => channel,
              )}
            >
              {(channel) => (
                <option value={channel}>Input {channel + 1} · Mono</option>
              )}
            </For>
          </select>
          <small>
            Centered in both speakers. Changing input turns monitoring off; turn
            it on when ready. Channel numbers follow the browser's input order.
          </small>
        </label>
      </Show>

      <div class={styles.ampMonitorRow}>
        <button
          type="button"
          class={styles.ampMonitor}
          classList={{
            [styles.ampMonitorActive]: props.monitoringActive(),
            [ampStyles.monitorOff]: !props.monitoringActive(),
          }}
          aria-pressed={props.monitoringEnabled()}
          aria-label={monitorAction()}
          aria-busy={monitorPending()}
          aria-describedby={monitorHintId}
          disabled={
            monitorPending() ||
            (!props.canMonitor() &&
              !canStartMonitor() &&
              !props.monitoringEnabled())
          }
          onClick={() => void requestMonitor()}
        >
          <span aria-hidden="true">
            <Show when={props.monitoringActive()} fallback={<HeadphonesOff />}>
              <Headphones />
            </Show>
          </span>
          <span>
            <strong>
              {props.monitoringActive()
                ? 'Monitoring on'
                : monitorPending()
                  ? 'Opening input'
                  : 'Monitoring off'}
            </strong>
            <small>
              {props.monitoringActive()
                ? 'Click to turn off'
                : canStartMonitor()
                  ? 'Start Listening & monitor'
                  : props.canMonitor()
                    ? 'Click to turn on'
                    : 'Direct Listening required'}
            </small>
          </span>
        </button>
        <small id={monitorHintId} class={styles.ampMonitorHint}>
          {monitorHint()}
        </small>
      </div>
      <Show when={props.monitorDiagnostics !== undefined}>
        <GuitarNightMonitorLatency
          snapshot={props.monitorDiagnostics?.() ?? null}
          monitoring={props.monitoringActive()}
        />
      </Show>
    </section>
  )
}

interface AmpRangeProps {
  label: string
  value: Accessor<number>
  minimum: number
  maximum: number
  signed?: boolean
  format?: (value: number) => string
  displayFormat?: (value: number) => string
  describedBy?: string
  onInput(value: number): void
  onChange(): void
}

function AmpRange(props: AmpRangeProps) {
  return (
    <label class={ampStyles.range}>
      <span>{props.label}</span>
      <input
        type="range"
        min={props.minimum}
        max={props.maximum}
        step="0.01"
        value={props.value()}
        aria-label={`Guitar amp ${props.label.toLowerCase()}`}
        aria-describedby={props.describedBy}
        aria-valuetext={
          props.format?.(props.value()) ??
          percentage(props.value(), props.signed)
        }
        onInput={(event) => props.onInput(Number(event.currentTarget.value))}
        onChange={() => props.onChange()}
      />
      <output aria-hidden="true">
        {props.displayFormat?.(props.value()) ??
          props.format?.(props.value()) ??
          percentage(props.value(), props.signed)}
      </output>
    </label>
  )
}
