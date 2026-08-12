// Guitar Night Learn listening controls keep optional pitch input consistent across activities.
// ============================================================

import { createMemo, createSignal, Show } from 'solid-js'
import { Mic } from '@/components/icons'
import styles from './GuitarNightApp.module.css'
import { GuitarNightInputPicker } from './GuitarNightInputPicker'
import type { GuitarListeningController } from './useGuitarListeningController'

interface GuitarNightLearnListeningControlsProps {
  controller: GuitarListeningController
  hint: string
  actionRef?(element: HTMLButtonElement): void
  disabled?: boolean
}

export function GuitarNightLearnListeningControls(
  props: GuitarNightLearnListeningControlsProps,
) {
  const [adjustOpen, setAdjustOpen] = createSignal(false)
  const isListening = createMemo(
    () =>
      props.controller.status() === 'requesting' ||
      props.controller.status() === 'listening',
  )
  const label = createMemo(() =>
    isListening() ? 'Stop listening' : 'Start listening',
  )

  const toggle = (): void => {
    if (isListening()) {
      props.controller.stop()
      return
    }
    void props.controller.start()
  }

  return (
    <>
      <button
        ref={(element) => props.actionRef?.(element)}
        type="button"
        class={styles.noteHuntListen}
        aria-pressed={isListening()}
        disabled={
          props.disabled === true || props.controller.status() === 'requesting'
        }
        onClick={toggle}
      >
        <span aria-hidden="true">
          <Mic />
        </span>
        <span>
          <strong>{label()}</strong>
          <small>{props.hint}</small>
        </span>
      </button>

      <details
        class={styles.noteHuntAdjust}
        onToggle={(event) => setAdjustOpen(event.currentTarget.open)}
      >
        <summary>Adjust input</summary>
        <Show when={adjustOpen()}>
          <div>
            <GuitarNightInputPicker
              profile={props.controller.inputProfile}
              profileLabel={props.controller.inputProfileLabel}
              audioInputs={props.controller.audioInputs}
              selectedAudioInputId={props.controller.selectedAudioInputId}
              midiInputs={props.controller.midiInputs}
              selectedMidiInputId={props.controller.selectedMidiInputId}
              midiStatus={props.controller.midiConnectionStatus}
              evidenceExportEnabled={props.controller.evidenceExportEnabled}
              canExportEvidence={props.controller.canExportEvidence}
              switching={() =>
                props.controller.status() === 'requesting' ||
                props.controller.inputTakeoverPending() ||
                props.controller.midiConnectionStatus() === 'requesting'
              }
              onProfile={(kind) =>
                void props.controller.selectInputProfile(kind)
              }
              onAudioInput={(deviceId) =>
                void props.controller.selectAudioInput(deviceId)
              }
              onMidiInput={(deviceId) =>
                void props.controller.selectMidiInput(deviceId)
              }
              onRefreshAudio={() => void props.controller.refreshAudioInputs()}
              onRefreshMidi={() => void props.controller.refreshMidiInputs()}
              onExportEvidence={props.controller.exportEvidenceReport}
            />
          </div>
        </Show>
      </details>
    </>
  )
}
