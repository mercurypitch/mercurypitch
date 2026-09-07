// Guitar Night amp controls expose one compact faceplate and defer detailed tone shaping.
// ============================================================

import type { Accessor } from 'solid-js'
import { createSignal, createUniqueId, For, onCleanup, Show } from 'solid-js'
import { Headphones, PowerSymbol, RotateCcw, Zap } from '@/components/icons'
import { getGuitarAmpCabinetStatus, retryGuitarAmpCabinet, subscribeGuitarAmpCabinetStatus, } from '@/lib/guitar/guitar-amp-cabinet'
import type { GuitarElectricAmpCabinet, GuitarElectricAmpParameters, } from '@/lib/guitar/guitar-electric-amp'
import type { GuitarInputProfileKind } from '@/lib/guitar/guitar-input-profile'
import type { GuitarNightAmpPresetId } from './guitar-amp-settings'
import { GUITAR_NIGHT_AMP_PRESETS } from './guitar-amp-settings'
import ampStyles from './GuitarNightAmpControls.module.css'
import styles from './GuitarNightApp.module.css'
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
  const monitorHintId = createUniqueId()
  const characterHintId = createUniqueId()
  const isStudio = (): boolean => props.parameters().engine === 'studio'
  const isDefinition = (): boolean =>
    isStudio() && props.parameters().head !== 'heavy'
  const modelLabel = (): string =>
    isStudio()
      ? props.parameters().head === 'heavy'
        ? 'Studio · Heavy head'
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

  const monitorHint = (): string => {
    if (props.monitoringActive()) {
      return `Headphones recommended. Browser latency applies. ${props.takeNotice ?? 'Saved takes stay dry.'}`
    }
    if (props.inputProfile() !== 'interface') {
      return 'Choose Direct input to hear your guitar through this amp.'
    }
    if (!props.canMonitor()) {
      return 'Turn on Listening, then monitor through headphones.'
    }
    return `Headphones recommended. Browser latency applies. ${props.takeNotice ?? 'Saved takes stay dry.'}`
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

      <div class={styles.ampMonitorRow}>
        <button
          type="button"
          class={styles.ampMonitor}
          classList={{
            [styles.ampMonitorActive]: props.monitoringActive(),
          }}
          aria-pressed={props.monitoringEnabled()}
          aria-describedby={monitorHintId}
          disabled={!props.canMonitor() && !props.monitoringEnabled()}
          onClick={() => props.onMonitor(!props.monitoringEnabled())}
        >
          <span aria-hidden="true">
            <Headphones />
          </span>
          <span>
            <strong>
              {props.monitoringActive() ? 'Monitoring on' : 'Hear my input'}
            </strong>
            <small>Direct input only</small>
          </span>
        </button>
        <small id={monitorHintId} class={styles.ampMonitorHint}>
          {monitorHint()}
        </small>
      </div>
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
