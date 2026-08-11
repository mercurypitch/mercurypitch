// Compact Guitar Night input picker shared by score and backing rooms.
// ============================================================

import type { Accessor } from 'solid-js'
import { For, onMount, Show } from 'solid-js'
import type { GuitarInputDeviceOption, GuitarInputProfileKind, } from '@/lib/guitar/guitar-input-profile'
import type { GuitarMidiPort } from '@/lib/guitar/guitar-midi-input'
import styles from './GuitarNightApp.module.css'
import type { GuitarMidiConnectionStatus } from './useGuitarListeningController'

interface GuitarNightInputPickerProps {
  profile: Accessor<GuitarInputProfileKind>
  profileLabel: Accessor<string>
  audioInputs: Accessor<readonly GuitarInputDeviceOption[]>
  selectedAudioInputId: Accessor<string | null>
  midiInputs: Accessor<readonly GuitarMidiPort[]>
  selectedMidiInputId: Accessor<string | null>
  midiStatus: Accessor<GuitarMidiConnectionStatus>
  evidenceExportEnabled: Accessor<boolean>
  canExportEvidence: Accessor<boolean>
  switching: Accessor<boolean>
  onProfile(kind: GuitarInputProfileKind): void
  onAudioInput(deviceId: string | null): void
  onMidiInput(deviceId: string | null): void
  onRefreshAudio(): void
  onRefreshMidi(): void
  onExportEvidence(): void
}

const PROFILES: readonly {
  kind: GuitarInputProfileKind
  label: string
}[] = [
  { kind: 'microphone', label: 'Room mic' },
  { kind: 'interface', label: 'Plugged in' },
  { kind: 'midi', label: 'MIDI' },
]

export function GuitarNightInputPicker(props: GuitarNightInputPickerProps) {
  onMount(() => {
    if (props.profile() !== 'midi') props.onRefreshAudio()
  })

  const changeAudioInput = (event: Event): void => {
    const target = event.currentTarget as HTMLSelectElement
    props.onAudioInput(target.value || null)
  }

  const changeMidiInput = (event: Event): void => {
    const target = event.currentTarget as HTMLSelectElement
    props.onMidiInput(target.value || null)
  }

  return (
    <section
      class={styles.inputPicker}
      aria-label="Listening input"
      aria-busy={props.switching()}
    >
      <header>
        <strong>Input</strong>
        <small>{props.profileLabel()}</small>
      </header>

      <div
        class={styles.inputProfileChoices}
        role="group"
        aria-label="Input route"
      >
        <For each={PROFILES}>
          {(profile) => (
            <button
              type="button"
              aria-pressed={props.profile() === profile.kind}
              disabled={props.switching()}
              onClick={() => props.onProfile(profile.kind)}
            >
              {profile.label}
            </button>
          )}
        </For>
      </div>

      <Show
        when={props.profile() === 'midi'}
        fallback={
          <label class={styles.inputDeviceField}>
            <span>Audio device</span>
            <select
              aria-label="Audio input device"
              value={props.selectedAudioInputId() ?? ''}
              disabled={props.switching()}
              onChange={changeAudioInput}
              onFocus={() => props.onRefreshAudio()}
            >
              <option value="">System default</option>
              <For each={props.audioInputs()}>
                {(device) => <option value={device.id}>{device.label}</option>}
              </For>
            </select>
          </label>
        }
      >
        <Show
          when={props.midiInputs().length > 0}
          fallback={
            <button
              class={styles.inputFindDevice}
              type="button"
              disabled={
                props.switching() || props.midiStatus() === 'requesting'
              }
              onClick={() => props.onRefreshMidi()}
            >
              {props.midiStatus() === 'requesting'
                ? 'Looking for MIDI'
                : 'Find MIDI device'}
            </button>
          }
        >
          <label class={styles.inputDeviceField}>
            <span>MIDI device</span>
            <select
              aria-label="MIDI input device"
              value={props.selectedMidiInputId() ?? ''}
              disabled={props.switching()}
              onChange={changeMidiInput}
            >
              <For each={props.midiInputs()}>
                {(device) => <option value={device.id}>{device.label}</option>}
              </For>
            </select>
          </label>
        </Show>
        <Show when={props.midiStatus() === 'unavailable'}>
          <small
            class={styles.inputPickerNote}
            role="status"
            aria-live="polite"
          >
            No selected MIDI device is connected.
          </small>
        </Show>
        <Show when={props.midiStatus() === 'error'}>
          <small
            class={styles.inputPickerNote}
            role="status"
            aria-live="polite"
          >
            MIDI input is unavailable in this browser.
          </small>
        </Show>
      </Show>
      <Show when={props.evidenceExportEnabled()}>
        <div class={styles.inputEvidenceExport}>
          <button
            type="button"
            disabled={!props.canExportEvidence()}
            onClick={() => props.onExportEvidence()}
          >
            Export input evidence
          </button>
          <small>Metadata only. No audio or event timeline is included.</small>
        </div>
      </Show>
    </section>
  )
}
