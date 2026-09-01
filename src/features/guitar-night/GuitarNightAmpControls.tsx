// Guitar Night amp controls expose one compact faceplate and defer detailed tone shaping.
// ============================================================

import type { Accessor } from 'solid-js'
import { createUniqueId, For } from 'solid-js'
import { Headphones, PowerSymbol, RotateCcw, Zap } from '@/components/icons'
import type { GuitarElectricAmpCabinet, GuitarElectricAmpParameters, } from '@/lib/guitar/guitar-electric-amp'
import type { GuitarInputProfileKind } from '@/lib/guitar/guitar-input-profile'
import type { GuitarNightAmpPresetId } from './guitar-amp-settings'
import styles from './GuitarNightApp.module.css'
import type { GuitarNightAmpContinuousParameter } from './useGuitarNightAmpSettings'

interface GuitarNightAmpControlsProps {
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

const PRESETS: readonly {
  id: Exclude<GuitarNightAmpPresetId, 'custom'>
  label: string
}[] = [
  { id: 'studio-clean', label: 'Studio clean' },
  { id: 'edge', label: 'Edge' },
  { id: 'crunch', label: 'Crunch' },
  { id: 'lead', label: 'Lead' },
]

const CABINETS: readonly {
  id: GuitarElectricAmpCabinet
  label: string
}[] = [
  { id: 'open', label: 'Open' },
  { id: 'balanced', label: 'Balanced' },
  { id: 'dark', label: 'Dark' },
]

const TONE_CONTROLS: readonly {
  key: GuitarNightAmpContinuousParameter
  label: string
  minimum: number
  maximum: number
  signed: boolean
  format?: (value: number) => string
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
    format: (value) => `${Math.round((-12 + value * 15) * 10) / 10} dB`,
  },
]

function percentage(value: number, signed = false): string {
  const rounded = Math.round(value * 100)
  return `${signed && rounded > 0 ? '+' : ''}${rounded}%`
}

/** A restrained room control: preset and drive first, voicing on demand. */
export function GuitarNightAmpControls(props: GuitarNightAmpControlsProps) {
  const monitorHintId = createUniqueId()
  const monitorHint = (): string => {
    if (props.monitoringActive()) {
      return 'Headphones recommended. Browser latency applies. Saved takes stay dry.'
    }
    if (props.inputProfile() !== 'interface') {
      return 'Choose Direct input to hear your guitar through this amp.'
    }
    if (!props.canMonitor()) {
      return 'Turn on Listening, then monitor through headphones.'
    }
    return 'Headphones recommended. Browser latency applies. Saved takes stay dry.'
  }

  return (
    <section class={styles.ampControls} aria-label="Guitar amp">
      <div class={styles.ampFaceplate}>
        <div class={styles.ampIdentity}>
          <span aria-hidden="true">
            <Zap />
          </span>
          <span>
            <strong>Amp</strong>
            <small>Shared electric tone</small>
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

      <div class={styles.ampPrimaryControls}>
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
            <For each={PRESETS}>
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

      <details class={styles.ampDetails}>
        <summary>Shape tone &amp; cabinet</summary>
        <div class={styles.ampToneGrid}>
          <For each={TONE_CONTROLS}>
            {(control) => (
              <AmpRange
                label={control.label}
                value={() => props.parameters()[control.key]}
                minimum={control.minimum}
                maximum={control.maximum}
                signed={control.signed}
                format={control.format}
                onInput={(value) =>
                  props.onParameter(control.key, value, false)
                }
                onChange={props.onParameterCommit}
              />
            )}
          </For>
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
  onInput(value: number): void
  onChange(): void
}

function AmpRange(props: AmpRangeProps) {
  return (
    <label class={styles.ampRange}>
      <span>{props.label}</span>
      <input
        type="range"
        min={props.minimum}
        max={props.maximum}
        step="0.01"
        value={props.value()}
        aria-label={`Guitar amp ${props.label.toLowerCase()}`}
        aria-valuetext={
          props.format?.(props.value()) ??
          percentage(props.value(), props.signed)
        }
        onInput={(event) => props.onInput(Number(event.currentTarget.value))}
        onChange={() => props.onChange()}
      />
      <output aria-hidden="true">
        {props.format?.(props.value()) ??
          percentage(props.value(), props.signed)}
      </output>
    </label>
  )
}
